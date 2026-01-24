import axios from 'axios';
import type { 
  SystemStatusResponse
} from './types';

// FloodGate: Points to the Python FastAPI Backend (Port 8001)
const API_BASE_URL = 'http://localhost:8001/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // GET Status with weather data
  fetchStatus: async (deviceId: string): Promise<SystemStatusResponse> => {
    try {
      const response = await apiClient.get<SystemStatusResponse>(`/status/${deviceId}`);
      return response.data;
    } catch (error) {
      console.warn("[FloodGate API Error] Fetch Status failed:", error);
      throw error;
    }
  },

  // POST User Action (v2.0: force_raise, force_drop, cancel_action, manual_drop)
  sendUserAction: async (deviceId: string, action: string): Promise<void> => {
    await apiClient.post('/user/action', { device_id: deviceId, action });
  },

  // GET System Health
  fetchHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // GET Enum Definitions (for type synchronization)
  fetchEnums: async () => {
    const response = await apiClient.get('/config/enums');
    return response.data;
  },

  // GET List of Devices (multi-device support)
  fetchDevices: async () => {
    const response = await apiClient.get('/devices');
    return response.data;
  },

  // GET User Settings
  fetchSettings: async () => {
    const response = await apiClient.get('/settings');
    return response.data;
  },
  
  // PUT User Settings
  updateSettings: async (settings: { city: string; fail_safe_timeout_min: number }) => {
    const response = await apiClient.put('/settings', settings);
    return response.data;
  },

  // POST Change System Mode
  changeMode: async (mode: 'AUTOMATIC' | 'MANUAL', deviceId: string = 'ESP32_MAIN_001') => {
    const response = await apiClient.post('/mode', { device_id: deviceId, mode });
    return response.data;
  },
};
