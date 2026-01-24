-- FloodGate v2.0: Database Migration Script
-- Adds columns required for ESP32 firmware v2.0.0-s3-advanced integration

-- Add new columns to current_device_state
ALTER TABLE current_device_state 
ADD COLUMN IF NOT EXISTS water_level_cm FLOAT DEFAULT 0.0;

ALTER TABLE current_device_state 
ADD COLUMN IF NOT EXISTS system_state TEXT DEFAULT 'IDLE';

ALTER TABLE current_device_state 
ADD COLUMN IF NOT EXISTS scheduler_locked INT DEFAULT 0;

-- Create alarm_log table for tracking water events
CREATE TABLE IF NOT EXISTS alarm_log (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    alarm_type TEXT NOT NULL,        -- 'water_detected', 'battery_low', etc.
    mode_used TEXT NOT NULL,         -- 'AUTO', 'MANUAL'
    timeout_minutes INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_alarm_log_device_id ON alarm_log(device_id);
CREATE INDEX IF NOT EXISTS idx_alarm_log_created_at ON alarm_log(created_at DESC);

-- Update existing device to have default values
UPDATE current_device_state 
SET 
    water_level_cm = 0.0,
    system_state = 'IDLE',
    scheduler_locked = 0
WHERE device_id = 'ESP32_MAIN_001';

-- Add test device with v2.0 schema
INSERT INTO current_device_state (
    device_id, 
    last_seen, 
    connection_status,
    water_level_cm,
    system_state,
    scheduler_locked,
    current_mode,
    fail_safe_timeout_min
)
VALUES (
    'FG_TEST_GEMINI_001', 
    NOW(), 
    'OFFLINE',
    0.0,
    'IDLE',
    0,
    'AUTOMATIC',
    5
)
ON CONFLICT (device_id) DO UPDATE SET
    water_level_cm = EXCLUDED.water_level_cm,
    system_state = EXCLUDED.system_state,
    scheduler_locked = EXCLUDED.scheduler_locked;

COMMIT;
