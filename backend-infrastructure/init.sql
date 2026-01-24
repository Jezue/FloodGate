-- FloodGate: Telemetry Log (Time-Series)
CREATE TABLE IF NOT EXISTS device_telemetry (
    time TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    water_sensor_status INT NOT NULL, -- Enum: 0=OK, 1=DETECTED
    curtain_state INT NOT NULL,       -- Enum: 0=UP, 1=DOWN, 2=MOVING, 3=ERROR
    battery_soc_perc INT NOT NULL,
    system_state_code INT NOT NULL,   -- Enum: 0=STANDBY, 1=LOW_BATTERY, 2=PRE_ALARM, 3=ALARM_WATER...
    risk_index FLOAT DEFAULT 0.0      -- From WeatherData
);

-- Convert to TimescaleDB Hypertable
SELECT create_hypertable('device_telemetry', 'time', if_not_exists => TRUE);

-- FloodGate: Current Device State (Shadow)
CREATE TABLE IF NOT EXISTS current_device_state (
    device_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ,
    connection_status TEXT DEFAULT 'OFFLINE', -- 'ONLINE' | 'OFFLINE'
    
    -- Telemetry Cache
    water_sensor_status INT DEFAULT 0,
    curtain_state INT DEFAULT 0,
    battery_soc_perc INT DEFAULT 100,
    
    -- Logic State
    current_mode TEXT DEFAULT 'AUTOMATIC',    -- 'AUTOMATIC' | 'KONTROLA' | 'MANUAL'
    current_state_code INT DEFAULT 0,
    fail_safe_deadline TIMESTAMPTZ,
    
    -- Config (synced to NVS)
    fail_safe_timeout_min INT DEFAULT 5
);

-- FloodGate: Command Queue (Async Control)
CREATE TABLE IF NOT EXISTS command_queue (
    cmd_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    action TEXT NOT NULL,            -- 'DROP' | 'RAISE' | 'ACCEPT_ALARM'
    status TEXT DEFAULT 'PENDING',   -- 'PENDING' | 'SENT' | 'EXECUTED' | 'FAILED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- FloodGate: Seed Initial Device
INSERT INTO current_device_state (device_id, last_seen, connection_status)
VALUES ('ESP32_MAIN_001', NOW(), 'OFFLINE')
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
