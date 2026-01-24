import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { 
  type SystemStatusResponse
} from '../api/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// --- CONFIGURATION ---
const DEFAULT_DEVICE_ID = 'ESP32_MAIN_001'; // Matches Firmware & DB

// --- GLOBAL STORE (Client State) with localStorage ---
interface SystemStore {
  deviceId: string;
  setDeviceId: (id: string) => void;
  isOffline: boolean;
  setOffline: (status: boolean) => void;
  cachedData: SystemStatusResponse | null;
  setCachedData: (data: SystemStatusResponse) => void;
  lastSeenTime: number | null;
  setLastSeenTime: (time: number) => void;
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useSystemStore = create<SystemStore>()(
  persist(
    (set) => ({
      deviceId: DEFAULT_DEVICE_ID,
      setDeviceId: (id) => set({ deviceId: id }),
      isOffline: false,
      setOffline: (status) => set({ isOffline: status }),
      cachedData: null,
      setCachedData: (data) => set({ cachedData: data }),
      lastSeenTime: null,
      setLastSeenTime: (time) => set({ lastSeenTime: time }),
      _hasHydrated: false,
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
    }),
    {
      name: 'floodgate-system-store', // localStorage key
      partialize: (state) => ({
        cachedData: state.cachedData,
        lastSeenTime: state.lastSeenTime,
        // Don't persist isOffline - should be re-detected on load
      }),
      onRehydrateStorage: () => (state) => {
        // Called after hydration
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// --- HOOKS ---

export const useSystemData = () => {
  const { deviceId, setOffline, setCachedData, cachedData, isOffline, setLastSeenTime } = useSystemStore();

  const query = useQuery({
    queryKey: ['systemStatus', deviceId],
    queryFn: async () => {
      if (!deviceId) return null;

      try {
        const data = await api.fetchStatus(deviceId);
        setOffline(false);
        setCachedData(data);
        
        // Update lastSeenTime from backend data (ESP32's actual last contact time)
        if (data.last_seen) {
          const lastSeenDate = new Date(data.last_seen).getTime();
          setLastSeenTime(lastSeenDate);
        }
        
        return data;
      } catch (error) {
        setOffline(true);
        // Return cached data if available (graceful offline)
        if (cachedData) {
          return cachedData;
        }
        throw error;
      }
    },
    // ===== POLLING STRATEGY (HTTP vs WebSockets) =====
    // Decision: HTTP Polling over WebSockets for simplified architecture
    // - Polling Interval: 5 seconds (acceptable for flood monitoring)
    // - Trade-off: UI refresh delay of ~5 seconds in exchange for simpler backend
    // - Network-aware: Continues polling in background, refreshes on tab focus/reconnect
    // - Future: WebSockets can be added to backend (python-socketio) for sub-second updates
    refetchInterval: 5000,
    refetchIntervalInBackground: true, // keep polling even when tab not focused
    refetchOnMount: true, // INSTANT: fetch immediately when component mounts
    refetchOnWindowFocus: true, // INSTANT: fetch when user switches back to tab
    refetchOnReconnect: true, // INSTANT: fetch when internet reconnects
    staleTime: 0, // Always consider data stale = always fetch fresh
    networkMode: 'always', // keep polling even if navigator goes offline
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  return {
    data: query.data || cachedData,
    error: query.error,
    isLoading: query.isLoading && !cachedData, // Show loading only if no cached data
    isOffline: isOffline || query.isError,
    isFetching: query.isFetching,
  };
};

export const useManualCommand = () => {
  const queryClient = useQueryClient();
  const { deviceId, lastSeenTime } = useSystemStore();

  return useMutation({
    mutationFn: async (action: 'DROP' | 'RAISE') => {
       console.log(`[useManualCommand] Sending command: ${action} to ${deviceId}...`);
       console.log(`[useManualCommand] Last seen before command:`, lastSeenTime);
       
       const beforeCommandTime = Date.now();
       
       // Send command to backend (publishes to MQTT)
       // Using v2.0 User Action API for priority & consistency
       const mappedAction = action === 'DROP' ? 'force_drop' : 'force_raise';
       await api.sendUserAction(deviceId, mappedAction);
       console.log(`[useManualCommand] Backend accepted command, waiting for ESP32 response...`);
       
       // Phase 1: wait for ACK (any telemetry heartbeat newer than command)
      const checkInterval = 500; // Check every 500ms
      const ackTimeout = 35000; // 35 seconds to see any heartbeat (telemetry is every 30s)
      const finalTimeout = 60000; // 60 seconds to see target curtain state
      let waited = 0;

       let ackReceived = false;
       
       while (true) {
         const targetTimeout = ackReceived ? finalTimeout : ackTimeout;
         if (waited >= targetTimeout) {
           break;
         }
         await new Promise(resolve => setTimeout(resolve, checkInterval));
         waited += checkInterval;
         
         const currentState = useSystemStore.getState();
         const currentLastSeen = currentState.lastSeenTime;
         const curtainState = currentState.cachedData?.telemetry?.curtain_state;
         const expectedCurtain = action === 'DROP' ? 1 : 0;

         const respondedByTime = currentLastSeen && currentLastSeen > beforeCommandTime;
         const respondedByCurtain = curtainState === expectedCurtain;

         // ACK phase
         if (!ackReceived && respondedByTime) {
           ackReceived = true;
           console.log(`[useManualCommand] ACK received at ${waited}ms`);
         }

         // Final success when target curtain state reached
         if (respondedByCurtain) {
           console.log(`[useManualCommand] Curtain state reached target at ${waited}ms`);
           return action;
         }

         // If no ACK within ackTimeout, continue waiting but log
         if (!ackReceived && waited >= ackTimeout && waited % 2000 === 0) {
           console.warn(`[useManualCommand] Still waiting for ACK... waited ${waited}ms`);
         }

         // If ACK received but state not yet reached and we exceed finalTimeout -> fail
         if (ackReceived && waited >= finalTimeout) {
           break;
         }
       }
       
       // Timeout - ESP32 didn't respond
       console.error(`[useManualCommand] ESP32 timeout after ${ackReceived ? finalTimeout : ackTimeout}ms`);
       throw new Error('ESP32 nie odpowiedział - sprawdź połączenie');
    },
    onSuccess: () => {
      console.log('[useManualCommand] Command success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
  });
};

export const useDeviceList = () => {
  return useQuery({
    queryKey: ['deviceList'],
    queryFn: async () => {
      try {
        const response = await api.fetchDevices();
        return response.devices || [];
      } catch (error) {
        console.error("[FloodGate] Failed to fetch device list:", error);
        return [];
      }
    },
    refetchInterval: 5000, // Fetch devices every 5 seconds
    retry: 2,
  });
};
