# 📟 FloodGate Backend Core

Technical backbone of the Intelligent Flood Protection System. This module provides a RESTful API for the frontend and an asynchronous worker for IoT device telemetry.

## 🏗️ Architecture

- **FastAPI Server** (`main.py`): Serves the dashboard API and command endpoints on port `8001`.
- **MQTT Worker** (`worker.py`): Scalable subscriber that persists real-time telemetry from ESP32 devices to TimescaleDB.
- **Database Layer** (`database.py`): High-performance I/O for time-series flood data.

## 🚀 Quick Start

### 1. Requirements

Ensure the infrastructure is running:

```powershell
cd ../backend-infrastructure
docker-compose up -d
```

### 2. Environment Setup

```powershell
pip install -r requirements.txt
```

### 3. Run Services

Run both in separate terminal windows:

- **API:** `uvicorn main:app --reload --port 8001`
- **Worker:** `python worker.py`

## 📡 API Reference

### System Status

**`GET /api/v1/status/{device_id}`**

Returns current system state including device telemetry, gate position, and weather data.

Example response:
```json
{
  "device_id": "ESP32_MAIN_001",
  "connection_status": "ONLINE",
  "telemetry": {
    "water_level_cm": 3.2,
    "battery_soc_perc": 85,
    "curtain_state": 0
  },
  "logic": {
    "current_mode": "AUTOMATIC",
    "current_state_code": 0,
    "fail_safe_deadline": null
  },
  "weather": {
    "temperature_celsius": 12.5,
    "precipitation_mm": 0.0
  },
  "timestamp": 1707043200
}
```

**Weather Fields (Simplified):**
- `temperature_celsius`: Current ambient temperature
- `precipitation_mm`: Rainfall amount (real-time measurement)

Note: Risk index calculation removed (was unused). Frontend displays raw weather data.

### Commands

**`POST /api/v1/command`**

Send control commands to device (FORCE_DROP, FORCE_RAISE, CANCEL_ACTION).

```json
{
  "device_id": "ESP32_MAIN_001",
  "action": "FORCE_DROP"
}
```

### Schedules

**`GET /api/v1/schedules`**

Retrieve configured automation rules (daily raise/drop times).

## 🌉 MQTT Integration

The backend interacts with devices through the following topic structure:

### Publishing (Backend → ESP32)

- **`system/{device_id}/action`**: System-level commands
- **`system/{device_id}/user_command`**: User actions (force_drop, force_raise, cancel_action)
- **`system/{device_id}/schedule_command`**: Scheduler commands (daily_raise, daily_drop)
- **`system/{device_id}/config`**: Configuration updates

### Subscribing (ESP32 → Backend)

- **`system/{device_id}/status`**: Full device telemetry (every 30 seconds)
- **`system/{device_id}/event`**: Event logs (water detection, gate movement, errors)
- **`debug/sms`**: SMS simulation messages (development mode)

### Telemetry Frequency

- **Status Updates:** Every 30 seconds (automatic)
- **Event Log:** On-demand (water detection, gate start/stop, safety events)
- **Command Acknowledgment:** Immediate

## 🔄 Weather Data Integration

**Current Implementation:**

- `fetch_current_weather()` retrieves raw temperature and precipitation from external API
- No risk calculation performed (simplified from v2.x)
- Temperature used for frost warnings (future feature)
- Precipitation data feeds display and historical analysis

**API Integration:**
```python
def fetch_current_weather():
    # Returns (temperature_celsius, precipitation_mm)
    response = requests.get(WEATHER_API_URL, params={"lat": 50.0, "lon": 19.0})
    data = response.json()
    return (data["main"]["temp"], data.get("rain", {}).get("1h", 0.0))
```

**Design Decision:** Raw weather data allows frontend flexibility for future risk calculations or alternative algorithms without backend changes.

---

_Part of the Intelligent Flood Protection Engineering Project._
