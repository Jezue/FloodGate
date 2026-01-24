/**
 * API Contract Definitions for Inteligentny System Antypowodziowy
 */

export type ConnectionStatus = 'ONLINE' | 'OFFLINE';

// Water sensor status enum values
export const WaterSensorStatus = {
  OK: 0,
  DETECTED: 1,
} as const;
export type WaterSensorStatus = typeof WaterSensorStatus[keyof typeof WaterSensorStatus];

// Curtain state enum values
export const CurtainState = {
  UP: 0,
  DOWN: 1,
  MOVING: 2,
  ERROR: 3,
} as const;
export type CurtainState = typeof CurtainState[keyof typeof CurtainState];

export type SystemMode = 'AUTOMATIC' | 'KONTROLA' | 'MANUAL';

// System state code enum values
export const SystemStateCode = {
  STANDBY_OK: 0,
  LOW_BATTERY: 1,
  PRE_ALARM_WEATHER: 2,
  ALARM_WATER: 3,
  CONTROL_WAITING: 4,
  FAIL_SAFE_ACTION: 5,
  MANUAL: 6,
  ACTUATOR_ERROR: 7,
} as const;
export type SystemStateCode = typeof SystemStateCode[keyof typeof SystemStateCode];

export interface TelemetryData {
  water_sensor_status: WaterSensorStatus;
  curtain_state: CurtainState;
  battery_soc_perc: number;
  water_level_cm: number;
}

export interface LogicState {
  current_mode: SystemMode;
  current_state_code: SystemStateCode;
  fail_safe_deadline: string | null;
}

export interface WeatherData {
  risk_index: number;
  precipitation_forecast: number;
}

export interface SystemStatusResponse {
  device_id: string;
  connection_status: ConnectionStatus;
  telemetry: TelemetryData;
  logic: LogicState;
  weather: WeatherData;
  last_seen?: string; // ISO 8601 timestamp from backend
  last_seen_ago_seconds?: number; // Seconds since last contact
}
