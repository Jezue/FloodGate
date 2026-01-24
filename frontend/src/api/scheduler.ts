import axios from 'axios';

// Backend API base URL (matches client.ts)
const API_URL = 'http://localhost:8001/api/v1';

export interface Schedule {
  id: number;
  device_id: string;
  action_type: 'OPEN' | 'CLOSE' | 'DROP' | 'RAISE';
  custom_label: string;
  hour: number;
  minute: number;
  days: number[]; // 1=Mon, 7=Sun
  active: boolean;
}

export interface CreateScheduleDto {
  device_id: string;
  action_type: string;
  custom_label: string; 
  hour: number;
  minute: number;
  days: number[];
}

export const schedulerApi = {
  // Fetch all schedules
  getSchedules: async (): Promise<Schedule[]> => {
    const response = await axios.get(`${API_URL}/schedules`);
    return response.data;
  },

  // Create a new schedule
  createSchedule: async (data: CreateScheduleDto): Promise<Schedule> => {
    const response = await axios.post(`${API_URL}/schedules`, data);
    return response.data;
  },

  // Delete a schedule by ID
  deleteSchedule: async (id: number): Promise<void> => {
    await axios.delete(`${API_URL}/schedules/${id}`);
  },

  // Toggle schedule active state
  toggleSchedule: async (id: number): Promise<void> => {
    await axios.put(`${API_URL}/schedules/${id}/toggle`);
  }
};
