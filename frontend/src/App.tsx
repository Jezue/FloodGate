import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Hooks & Types
import { useSystemData, useManualCommand, useSystemStore } from './hooks/useSystemData';
import { CurtainState } from './api/types';
import { api } from './api/client';
import { useWeather } from './hooks/useWeather';

// Visuals
import { Atmosphere } from './components/visuals/Atmosphere';
import { RisingWater } from './components/visuals/RisingWater';

// Dashboard
import { TheCore } from './components/dashboard/TheCore';
import { StatsHUD } from './components/dashboard/StatsHUD';

// Layout & Views
import { BottomDock } from './components/layout/BottomDock';
import { ScheduleDrawer } from './components/views/ScheduleDrawer';
import { SettingsDrawer } from './components/views/SettingsDrawer';
import { FailSafeModal } from './components/shared/FailSafeModal';
import { TopRightInfo } from './components/shared/TopRightInfo';
import { SystemNotifications } from './components/shared/SystemNotifications';
import { useNotificationStore } from './stores/notificationStore';
import { ArrowDown, ArrowUp, XCircle } from 'lucide-react';

// Create a client
const queryClient = new QueryClient();

function Dashboard() {
  const { data, isOffline, isFetching } = useSystemData();
  const { _hasHydrated } = useSystemStore();
  const {  mutateAsync: sendCommand, isPending: isCommandPending } = useManualCommand();
  const { weather: weatherData, city, updateCity, failSafeTimeout, updateTimeout } = useWeather();
  const { addNotification, removeNotification } = useNotificationStore();

  const [activeView, setActiveView] = useState('HOME');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [optimisticMode, setOptimisticMode] = useState<'AUTOMATIC' | 'MANUAL' | null>(null);
  
  // Safe accessors
  const telemetry = data?.telemetry;
  const logic = data?.logic;
  const weather = data?.weather;

  // Use optimistic mode if set, otherwise use actual mode
  const displayMode = optimisticMode ?? (logic?.current_mode === 'MANUAL' || logic?.current_mode === 'KONTROLA' ? 'MANUAL' : 'AUTOMATIC');

  const isAlarm = telemetry?.water_sensor_status === 1;
  const isClosed = telemetry?.curtain_state === CurtainState.DOWN;
  const failSafeActive = logic?.current_state_code === 4;

  // Live countdown timer for Fail-Safe Modal
  useEffect(() => {
    if (!failSafeActive) return;

    const failSafeDeadline = logic?.fail_safe_deadline;
    if (!failSafeDeadline) return;

    // Parse deadline ONCE before interval
    let deadlineStr = failSafeDeadline;
    if (deadlineStr && !deadlineStr.endsWith('Z') && !deadlineStr.includes('+')) {
       deadlineStr += 'Z'; // Append Z if no timezone info
    }
    
    const deadlineTime = new Date(deadlineStr).getTime();
    
    if (isNaN(deadlineTime)) {
      console.error('[App] Invalid fail_safe_deadline:', failSafeDeadline);
      return;
    }
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineTime - now) / 1000));
      
      setRemainingSeconds(remaining);
      
      // Auto-close modal when countdown reaches 0 -> TRIGGER FAIL SAFE
      if (remaining === 0) {
        console.log('[FloodGate] Fail-Safe Timeout! Auto-dropping curtain.');
        api.sendUserAction(data?.device_id || '', 'manual_drop')
           .catch(err => console.error('[FloodGate] Auto-drop failed:', err));
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [failSafeActive, logic?.fail_safe_deadline, data?.device_id]);

  const handleManualCommand = async (action: 'DROP' | 'RAISE') => {
    if (isCommandPending) return;

    const actionText = action === 'DROP' ? 'zamknięcie' : 'otwarcie';
    
    // Add persistent "executing" notification and capture its ID
    const executingNotifId = addNotification({
      type: 'info',
      message: `Wykonywanie: ${actionText} bramy...`,
      icon: action === 'DROP' ? <ArrowDown size={14} /> : <ArrowUp size={14} />,
      persistent: true,
    });

    try {
      await sendCommand(action);
      
      // Replace "Wykonywanie..." with success
      if (executingNotifId) {
        removeNotification(executingNotifId);
      }
      addNotification({
        type: 'success',
        message: `Wysłano komendę: ${actionText} bramy`,
        icon: action === 'DROP' ? <ArrowDown size={14} /> : <ArrowUp size={14} />,
      });
    } catch (error) {
      // Replace "Wykonywanie..." with error notification (non-persistent so it doesn't clear system notifications)
      if (executingNotifId) {
        removeNotification(executingNotifId);
      }
      addNotification({
        type: 'error',
        message: `Nie udało się ${actionText === 'zamknięcie' ? 'zamknąć' : 'otworzyć'} bramy`,
        icon: <XCircle size={14} />,
        persistent: false, // Auto-remove after 5s, don't interfere with system notifications
      });
    }
  };

  const handleFailSafeAccept = async () => {
    console.log('[FloodGate] Accept clicked. Device:', data?.device_id);
    try {
      await api.sendUserAction(data?.device_id || '', 'manual_drop');
      console.log('[FloodGate] Accept sent successfully');
    } catch (error) {
      console.error('[FloodGate] Failed to accept alarm:', error);
      alert('Błąd wysyłania komendy!');
    }
  };

  const handleFailSafeReject = async () => {
    console.log('[FloodGate] Reject clicked. Device:', data?.device_id);
    try {
      await api.sendUserAction(data?.device_id || '', 'cancel_action');
      console.log('[FloodGate] Reject sent successfully');
    } catch (error) {
      console.error('[FloodGate] Failed to reject alarm:', error);
      alert('Błąd wysyłania komendy!');
    }
  };

  // Show loading ONLY if still fetching AND no cached data AND not hydrated yet
  // Once hydrated, show UI immediately even if loading (use defaults for missing data)
  if (!_hasHydrated) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white/20 tracking-[0.5em] text-xs font-sans">
        ŁADOWANIE SYSTEMU FLOODGATE...
      </div>
    );
  }

  // Offline state with cached data
  if (isOffline && data) {
    return (
      <div className="h-screen w-full relative font-sans overflow-hidden selection:bg-sky-500/30">
        
        {/* Top Right Info */}
        <TopRightInfo 
          battery={telemetry?.battery_soc_perc ?? 100}
          weather={{
            wind: weatherData?.windSpeed ?? 0,
            humidity: weatherData?.humidity ?? 0
          }}
          systemMode={(logic?.current_mode as 'AUTOMATIC' | 'MANUAL' | 'KONTROLA') ?? 'AUTOMATIC'}
        />

        {/* Header Logo and Title */}
        <AnimatePresence>
          {activeView === 'HOME' && (
            <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center pt-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="flex flex-col items-center gap-2"
              >
                <img 
                  src="/shield-logo.svg" 
                  alt="FloodGate Logo" 
                  className="h-12 w-12 object-contain opacity-90"
                  style={{ filter: 'invert(1)' }}
                />
                <h1 className="text-2xl font-bold text-white/90 tracking-wide">
                  FloodGate
                </h1>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* System Status Notifications */}
        <SystemNotifications />

        <Atmosphere isAlarm={isAlarm} />
        {/* Visual Water Level Animation */}
        <RisingWater 
          isWater={false}
          waterLevelCm={0}
        />
        
        <AnimatePresence>
          {activeView === 'HOME' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="relative z-30 h-full flex flex-col items-center justify-center pb-16"
            >
              {/* Device Offline Badge */}

              
              <StatsHUD 
                weather={{
                  risk_index: weather?.risk_index?.toFixed(2) ?? 'LOW',
                  rain: weatherData?.precipitation ?? 0,
                  temp: weatherData?.temperature ?? 18
                }}
                battery={telemetry?.battery_soc_perc ?? 0}
                mode={displayMode}
                isAlarm={isAlarm}
                cityName={weatherData?.cityName ?? city}
                waterLevel={telemetry?.water_level_cm ?? 0}
              />
              <TheCore 
                isClosed={isClosed} 
                isAlarm={isAlarm}
                onClick={() => handleManualCommand(isClosed ? 'RAISE' : 'DROP')}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <BottomDock activeView={activeView} setActiveView={setActiveView} />
        <FailSafeModal
          isOpen={failSafeActive}
          remainingSeconds={remainingSeconds}
          onAccept={handleFailSafeAccept}
          onReject={handleFailSafeReject}
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative font-sans overflow-hidden selection:bg-sky-500/30">
      
      {/* Top Right Info */}
      <TopRightInfo 
        battery={telemetry?.battery_soc_perc ?? 100}
        weather={{
          wind: weatherData?.windSpeed ?? 0,
          humidity: weatherData?.humidity ?? 0
        }}
        systemMode={(logic?.current_mode as 'AUTOMATIC' | 'MANUAL' | 'KONTROLA') ?? 'AUTOMATIC'}
      />

      {/* Header Logo and Title */}
      <AnimatePresence>
        {activeView === 'HOME' && (
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center pt-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col items-center gap-2"
            >
              <img 
                src="/shield-logo.svg" 
                alt="FloodGate Logo" 
                className="h-12 w-12 object-contain opacity-90"
              />
              <h1 className="text-2xl font-bold text-white/90 tracking-wide">
                FloodGate
              </h1>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Status Notifications */}
      <SystemNotifications />

      {/* 1. Background & Atmosphere */}
      <Atmosphere isAlarm={isAlarm} />
      
      {/* 2. Water Layer */}
      <RisingWater isWater={isAlarm && !isOffline} waterLevelCm={isOffline ? 0 : telemetry?.water_level_cm ?? 0} />

      {/* 3. Main Interface (HOME VIEW) */}
      <AnimatePresence>
        {activeView === 'HOME' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="relative z-30 h-full flex flex-col items-center justify-center pb-16"
          >
            {/* Loading Indicator */}
            {isFetching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 right-4 z-40"
              >
                <div className="w-2 h-2 bg-sky-500/50 rounded-full animate-pulse" />
              </motion.div>
            )}

            <StatsHUD 
              weather={{
                risk_index: weather?.risk_index?.toFixed(2) ?? 'LOW',
                rain: weatherData?.precipitation ?? 0,
                temp: weatherData?.temperature ?? 18
              }}
              battery={telemetry?.battery_soc_perc ?? 0}
              mode={displayMode}
              isAlarm={isAlarm}
              cityName={weatherData?.cityName ?? city}
              waterLevel={telemetry?.water_level_cm ?? 0}
            />
            
            <TheCore 
              isClosed={isClosed} 
              isAlarm={isAlarm}
              onClick={() => handleManualCommand(isClosed ? 'RAISE' : 'DROP')}
              isLoading={isCommandPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Schedule Module */}
      <AnimatePresence>
        {activeView === 'SCHEDULE' && <ScheduleDrawer />}
      </AnimatePresence>

      {/* 5. Settings Module */}
      <AnimatePresence>
        {activeView === 'SETTINGS' && (
          <SettingsDrawer 
            city={city} 
            onCityChange={updateCity} 
            failSafeTimeout={failSafeTimeout} 
            onTimeoutChange={updateTimeout}
            systemMode={displayMode}
            onModeChange={async (mode) => {
              try {
                // Optimistic update - show change immediately
                setOptimisticMode(mode);
                console.log(`[App] Optimistic mode update to ${mode}`);
                
                await api.changeMode(mode, data?.device_id || 'ESP32_MAIN_001');
                console.log(`[App] Mode changed confirmed: ${mode}`);
                
                // Clear optimistic mode after 2s (let real data come through)
                setTimeout(() => {
                  setOptimisticMode(null);
                }, 2000);
              } catch (error) {
                console.error('[App] Failed to change mode:', error);
                // Revert optimistic update on error
                setOptimisticMode(null);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 6. Bottom Navigation Dock */}
      <BottomDock activeView={activeView} setActiveView={setActiveView} />

      {/* 7. Fail-Safe Modal with Live Countdown */}
      <FailSafeModal
        isOpen={failSafeActive}
        remainingSeconds={remainingSeconds}
        onAccept={handleFailSafeAccept}
        onReject={handleFailSafeReject}
      />

      {/* 8. Critical Alert Overlay */}

    </div>
  );
}

// Main APP
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

export default App;
