-- FloodGate: Telemetry Log (Time-Series)
CREATE TABLE IF NOT EXISTS device_telemetry (
    time TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    water_level_cm FLOAT NOT NULL DEFAULT 0.0,  -- Water level in centimeters (0-50cm)
    gate_closed INT NOT NULL DEFAULT 0,         -- Gate state: 0=OPEN, 1=CLOSED
    battery_pct INT NOT NULL DEFAULT 100,       -- Battery percentage (0-100%)
    state TEXT NOT NULL DEFAULT 'IDLE',         -- System state: IDLE, WATER_DETECTED, CLOSED, etc.
    scheduler_locked INT NOT NULL DEFAULT 0,    -- Scheduler lock: 0=unlocked, 1=locked
    system_state_code INT NOT NULL DEFAULT 0,   -- Legacy state code for compatibility
    risk_index FLOAT DEFAULT 0.0                -- From WeatherData
);

-- Convert to TimescaleDB Hypertable
SELECT create_hypertable('device_telemetry', 'time', if_not_exists => TRUE);

-- FloodGate: Current Device State (Shadow)
CREATE TABLE IF NOT EXISTS current_device_state (
    device_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ,
    connection_status TEXT DEFAULT 'OFFLINE', -- 'ONLINE' | 'OFFLINE'
    
    -- Telemetry Cache (PDF-compliant field names)
    water_level_cm FLOAT DEFAULT 0.0,         -- Water level in cm (0-50cm range)
    gate_closed INT DEFAULT 0,                -- Gate state: 0=OPEN, 1=CLOSED
    battery_pct INT DEFAULT 100,              -- Battery percentage (0-100%)
    state TEXT DEFAULT 'IDLE',                -- System state: IDLE, WATER_DETECTED, CLOSED, AUTO_DROP, etc.
    scheduler_locked INT DEFAULT 0,           -- Scheduler lock: 0=unlocked, 1=locked during alarm
    
    -- Logic State
    current_mode TEXT DEFAULT 'AUTOMATIC',    -- 'AUTOMATIC' | 'KONTROLA' | 'MANUAL'
    current_state_code INT DEFAULT 0,         -- Legacy state code
    fail_safe_deadline TIMESTAMPTZ,
    
    -- Config (synced to NVS)
    fail_safe_timeout_min INT DEFAULT 5
);


COMMENT ON COLUMN current_device_state.water_level_cm IS 'Water level in centimeters (0-50cm range from analog sensor)';
COMMENT ON COLUMN current_device_state.gate_closed IS 'Gate state: 0=OPEN, 1=CLOSED';
COMMENT ON COLUMN current_device_state.battery_pct IS 'Battery percentage (0-100%)';
COMMENT ON COLUMN current_device_state.state IS 'System state from firmware: IDLE, WATER_DETECTED, CLOSED, AUTO_DROP, etc.';
COMMENT ON COLUMN current_device_state.scheduler_locked IS 'Scheduler lock: 0=unlocked, 1=locked during water alarm';


-- FloodGate: Command Queue (Async Control)
CREATE TABLE IF NOT EXISTS command_queue (
    cmd_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    action TEXT NOT NULL,            -- 'DROP' | 'RAISE' | 'ACCEPT_ALARM'
    status TEXT DEFAULT 'PENDING',   -- 'PENDING' | 'SENT' | 'EXECUTED' | 'FAILED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- FloodGate:-- ============================================================================
-- SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('OPEN', 'CLOSE')),
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    minute INT NOT NULL CHECK (minute >= 0 AND minute <= 59),
    days JSONB NOT NULL,  -- ["monday", "tuesday", "wednesday", ...]
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_device ON schedules(device_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(active);
CREATE INDEX IF NOT EXISTS idx_schedules_time ON schedules(hour, minute);

COMMENT ON TABLE schedules IS 'Harmonogramy działań (FR-10, Scenariusz S4)';
COMMENT ON COLUMN schedules.action_type IS 'Typ akcji: OPEN (podniesienie) lub CLOSE (opuszczenie)';
COMMENT ON COLUMN schedules.days IS 'Dni tygodnia w formacie JSON array, np. ["monday", "friday"]';

-- Seed initial data
INSERT INTO current_device_state (device_id, connection_status, current_mode, fail_safe_timeout_min)
VALUES ('ESP32_001', 'OFFLINE', 'AUTOMATIC', 5)
ON CONFLICT (device_id) DO NOTHING;

-- FloodGate: System Config Table (for configurable settings)
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_config (key, value)
VALUES 
    ('app_name', 'FloodGate'),
    ('water_detection_threshold', '2000'),
    ('fail_safe_timeout_min', '5'),
    ('weather_api_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- FloodGate: User Settings (for UI preferences)
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    city TEXT DEFAULT 'Warszawa',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO user_settings (city)
VALUES ('Warszawa')
ON CONFLICT DO NOTHING;
