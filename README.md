<p align="center">
  <img src="frontend/public/shield-logo.svg" width="120" alt="FloodGate Logo" />
</p>

<h1 align="center">FloodGate: Autonomous Flood Protection System</h1>

<p align="center">
  <strong>Autonomous Flood Protection System</strong><br>
  IoT-based automated flood barrier with real-time monitoring and control
</p>

<p align="center">
  <a href="docs/HARDWARE.md">Hardware</a> •
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## 🎯 Purpose

FloodGate is an IoT system designed for **automated flood protection**. It combines local water detection (responding without cloud dependency) with remote monitoring and control (Web Dashboard / Smartphone). The system supports both automatic operation and manual override by the user.

Applications include:

- **Garage Entrances:** Protect basement garages from street flooding
- **Building Entrances:** Secure ground-floor premises during heavy rainfall
- **Industrial Sites:** Protect critical infrastructure and storage areas
- **Technical Gates:** Automated barrier for access points vulnerable to water damage

---

## 🌍 Language / Język

**Default language is Polish.** To switch UI to English:

```bash
cd scripts
python switch_language.py en    # Switch to English
python switch_language.py pl    # Switch back to Polish
```

This changes:

- **ESP32 OLED display** labels (Woda→Water, Brama→Gate)
- **SMS messages** sent by device
- **Frontend dashboard** UI text

> After switching, rebuild ESP32 firmware: `pio run`

---

## ✨ Features

| Feature                          | Description                                  |
| -------------------------------- | -------------------------------------------- |
| 🚨 **Automatic Flood Detection** | Water sensor triggers immediate gate closure |
| 📱 **Real-time Dashboard**       | React-based mobile-friendly interface        |
| ⏱️ **Fail-safe Timer**           | Configurable countdown before auto-close     |
| 🔔 **SMS Alerts**                | Notifications via MQTT (Wokwi simulation)    |
| 📊 **Telemetry Logging**         | TimescaleDB time-series storage              |
| 🌤️ **Weather Integration**       | Current weather from Open-Meteo API          |
| 🔄 **Two Operation Modes**       | AUTOMATIC (instant) or MANUAL (confirmation) |
| 🎮 **ESP32 Simulator**           | Full Wokwi integration in VS Code            |

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────┐
│  FRONTEND - React 19 + Vite + TailwindCSS            │
│  http://localhost:5173                               │
└────────────────────────┬──────────────────────────────┘
                         │ HTTP REST
                         ▼
┌───────────────────────────────────────────────────────┐
│  BACKEND API - FastAPI (Python 3.12)                 │
│  http://localhost:8001                               │
│  Endpoints: /status, /command, /settings, /mode     │
└────────────────────────┬──────────────────────────────┘
                         │ MQTT
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐         ┌──────────────────────────┐
│  MQTT Broker     │◄────────│  Worker (Python)         │
│  Mosquitto:1883  │         │  Telemetry → Database    │
└────────┬─────────┘         └──────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  ESP32-S3 (Wokwi Simulator)                          │
│  Water Sensor, Stepper Motor, OLED, LEDs             │
└───────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  DATABASE - TimescaleDB (PostgreSQL 15)              │
│  Port: 5434                                          │
└───────────────────────────────────────────────────────┘
```

### Flow 1: Telemetry (Every 30s)

```
                    ┌─────────────────┐
                    │  ESP32 sends    │
                    │  sensor data    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  MQTT Broker    │
                    │  receives msg   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Worker stores  │
                    │  in Database    │
                    └────────┬────────┘
                             │
                             ▼
               ┌─────────────────────────────┐
               │  Data: water_level, battery │
               │  gate_state, timestamp      │
               └─────────────────────────────┘
```

### Flow 2: Manual Command (User clicks button)

```
                    ┌─────────────────┐
                    │  User clicks    │
                    │  gate button    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Frontend sends │
                    │  POST /command  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  API publishes  │
                    │  to MQTT        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  ESP32 receives │
                    │  and moves gate │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Telemetry sent │
                    │  with new state │
                    └─────────────────┘
```

### Flow 3: Water Detection (with Cancel/Confirm)

```
                    ┌─────────────────┐
                    │ Water Detected  │
                    │ (sensor > 2000) │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │ AUTOMATIC  │               │    MANUAL     │
       │   MODE     │               │     MODE      │
       └──────┬─────┘               └───────┬───────┘
              │                             │
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │Close gate  │               │ Show Fail-Safe│
       │immediately │               │ Modal (5 min) │
       │Send SMS    │               └───────┬───────┘
       └────────────┘                       │
                               ┌────────────┼────────────┐
                               ▼            ▼            ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │  CLOSE   │  │  CANCEL  │  │  TIMEOUT │
                       │  NOW     │  │  (ignore)│  │  (5 min) │
                       └────┬─────┘  └────┬─────┘  └────┬─────┘
                            │             │             │
                            ▼             ▼             ▼
                     ┌────────────┐ ┌────────────┐ ┌────────────┐
                     │Close gate  │ │Gate stays  │ │Close gate  │
                     │Send SMS:   │ │OPEN        │ │Send SMS:   │
                     │"Confirmed" │ │User takes  │ │"Timeout"   │
                     └────────────┘ │responsibility└────────────┘
                                    └────────────┘
```

### Flow 4: Scheduled Action

```
                    ┌─────────────────┐
                    │ Worker checks   │
                    │ schedules table │
                    │ (every minute)  │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │  No match  │               │ Time matches  │
       │  (skip)    │               │ enabled rule  │
       └────────────┘               └───────┬───────┘
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                       ┌────────────┐             ┌────────────┐
                       │ Water NOT  │             │ Water IS   │
                       │ detected   │             │ detected   │
                       └──────┬─────┘             └──────┬─────┘
                              │                          │
                              ▼                          ▼
                       ┌────────────┐             ┌────────────┐
                       │ Execute    │             │ SKIP action│
                       │ scheduled  │             │ Safety has │
                       │ action     │             │ priority!  │
                       └────────────┘             └────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker** (for containers)
- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **VS Code** with PlatformIO extension (for ESP32)

### 1. Start Infrastructure (Docker)

```bash
cd backend-infrastructure
docker-compose up -d
```

Starts:

- `floodgate_db` - TimescaleDB on port 5434
- `floodgate_mqtt` - Mosquitto on port 1883

### 2. Start Backend API

```bash
cd backend-core
pip install -r requirements.txt
python run_api.py
```

API available at http://localhost:8001

### 3. Start MQTT Worker

```bash
cd backend-core
python worker.py
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard at http://localhost:5173

### 5. Configure ESP32 Firmware Secrets

Before running the ESP32 firmware, you must set up your network credentials:

**First time setup:**

```bash
cd firmware
cp include/Secrets.h.example include/Secrets.h
```

Then edit `firmware/include/Secrets.h` with your actual credentials:

```cpp
#define WIFI_SSID "YOUR_WIFI_SSID"        // Your WiFi network name
#define WIFI_PASS "YOUR_WIFI_PASSWORD"    // Your WiFi password
#define MQTT_SERVER "YOUR_MQTT_IP"        // MQTT broker IP address
```

**For Wokwi simulation:**

- `WIFI_SSID`: `"Wokwi-GUEST"`
- `WIFI_PASS`: `""` (empty)
- `MQTT_SERVER`: Your PC's IP address (run `ipconfig` on Windows, `ip a` on Linux/macOS)

**Important:** `include/Secrets.h` is gitignored and will NOT be committed to the repository for security.

### 6. Run ESP32 Simulator (Wokwi)

1. Open `firmware/` folder in VS Code
2. Install **Wokwi for VS Code** extension
3. Press `F1` → "Wokwi: Start Simulator"
4. Firmware will compile with credentials from `include/Secrets.h`

---

## 🛠️ Technology Stack

### Frontend

| Technology     | Version | Purpose      |
| -------------- | ------- | ------------ |
| React          | 19.2.0  | UI Framework |
| TypeScript     | 5.9.3   | Type Safety  |
| Vite           | 7.2.4   | Build Tool   |
| TailwindCSS    | 4.1     | Styling      |
| TanStack Query | 5.x     | Server State |
| Zustand        | 4.x     | Client State |
| Framer Motion  | 11.x    | Animations   |
| Axios          | 1.x     | HTTP Client  |

### Backend

| Technology | Version | Purpose           |
| ---------- | ------- | ----------------- |
| FastAPI    | 0.109   | REST API          |
| Python     | 3.12    | Runtime           |
| Paho MQTT  | 2.0     | MQTT Client       |
| SQLAlchemy | 2.x     | ORM               |
| AsyncPG    | 0.29    | PostgreSQL Driver |
| Uvicorn    | 0.27    | ASGI Server       |

### Infrastructure

| Technology  | Version | Purpose              |
| ----------- | ------- | -------------------- |
| TimescaleDB | 2.x     | Time-series Database |
| PostgreSQL  | 15      | Database Engine      |
| Mosquitto   | 2.x     | MQTT Broker          |
| Docker      | 24.x    | Containerization     |

### Firmware

| Technology       | Version | Purpose         |
| ---------------- | ------- | --------------- |
| ESP32-S3         | -       | Microcontroller |
| Arduino          | 2.0.6   | Framework       |
| PlatformIO       | 6.x     | Build System    |
| PubSubClient     | 2.8     | MQTT Library    |
| ArduinoJson      | 6.21    | JSON Parsing    |
| Adafruit SSD1306 | 2.5     | OLED Display    |

---

## 📁 Project Structure

```
INZYNIERKA/
├── backend-core/           # Python API + Worker
│   ├── main.py             # FastAPI application
│   ├── worker.py           # MQTT → Database bridge
│   ├── database.py         # SQLAlchemy models
│   └── requirements.txt
├── backend-infrastructure/ # Docker services
│   └── docker-compose.yml
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── api/            # API client
│   │   └── App.tsx
│   └── package.json
├── firmware/               # ESP32 code
│   ├── src/main.cpp        # Main firmware
│   ├── platformio.ini      # PlatformIO config
│   ├── diagram.json        # Wokwi circuit
│   └── wokwi.toml          # Wokwi config
├── scripts/
│   └── switch_language.py  # PL/EN language switcher
├── simulation/             # HIL testing tools
└── README.md
```

---

## 🎮 Wokwi Simulation

This project uses **Wokwi** for ESP32 simulation, integrated into VS Code.

### Setup

1. Install VS Code extension: **Wokwi for VS Code**
2. Get free license at https://wokwi.com/license
3. Open `firmware/diagram.json`
4. Press `F1` → "Wokwi: Start Simulator"

### Circuit Components

| Component      | GPIO   | Function               |
| -------------- | ------ | ---------------------- |
| Water Sensor   | GPIO4  | Analog input (0-50cm)  |
| Battery Sensor | GPIO5  | Analog input (0-100%)  |
| Stepper STEP   | GPIO10 | Motor control          |
| Stepper DIR    | GPIO11 | Motor direction        |
| Red LED        | GPIO16 | Gate closing indicator |
| Green LED      | GPIO17 | Gate opening indicator |
| OLED SDA       | GPIO18 | Display data           |
| OLED SCL       | GPIO19 | Display clock          |

### SMS Simulation

The `sendSMS()` function publishes to MQTT topic `debug/sms` instead of sending real SMS. This is for Wokwi compatibility. For production with SIM800L module, replace the implementation with AT commands.

---

## 📊 API Reference

### GET /api/v1/status/{device_id}

Returns current device status with weather data.

```json
{
  "device_id": "ESP32_MAIN_001",
  "telemetry": {
    "water_sensor_status": 0,
    "curtain_state": 0,
    "battery_soc_perc": 74,
    "water_level_cm": 8
  },
  "logic": {
    "current_mode": "AUTOMATIC",
    "current_state_code": 0,
    "fail_safe_deadline": null
  },
  "weather": {
    "temperature": 12.5,
    "precipitation": 0.0
  }
}
```

### POST /api/v1/command

Send manual command to device.

```json
{
  "device_id": "ESP32_MAIN_001",
  "action": "DROP" // or "RAISE"
}
```

---

## ⚠️ Limitations & Design Decisions

This section documents known limitations and architectural choices that represent acceptable trade-offs for the current scope.

### 1. Frontend: HTTP Polling vs WebSockets

**Current Implementation:** The React dashboard uses **HTTP Polling** (5-second interval) to fetch device status from the backend API.

**Why Polling?**

- **Simplified Architecture:** Avoids WebSocket infrastructure complexity for the scope of this thesis project
- **Backend Infrastructure:** The backend (FastAPI) already provides a robust REST API; existing MQTT connection for device communication
- **Cross-platform Compatibility:** HTTP polling works consistently across all network conditions (firewalls, proxies)
- **Single Source of Truth:** Device state is computed server-side; frontend just reflects current state
- **Sufficient for Flood Monitoring:** 5-second refresh interval is acceptable for this use case (gates don't move faster than ~30 seconds)

**Trade-off:** The UI refreshes every 5 seconds, so user actions may appear with up to 5-second delay. If someone closes the gate, the UI updates within the next polling cycle (max 5sec).

**When WebSockets Would Be Preferred:**

- Enterprise deployment with thousands of concurrent dashboards
- Real-time dashboards requiring sub-second response (e.g., stock trading)
- Bandwidth-constrained environments (polling 5sec × 1000 clients = significant overhead)

**Production Path:** To upgrade to WebSockets:

```python
# Backend: Add python-socketio and python-socketio[aiohttp]
from socketio import AsyncServer
# Push device updates to connected clients via MQTT bridges
```

**Implementation Details:** See [frontend/README.md](frontend/README.md#-polling-architecture) for polling configuration (staleTime: 0, refetchInterval: 5000, etc.).

### 2. SMS Notifications: MQTT Debug Topic (Simulation)

**Current Implementation:** `sendSMS()` function publishes to MQTT topic `debug/sms` for Wokwi simulation compatibility.

**How It Works:**

- Dashboard can subscribe to `debug/sms` to receive "SMS" messages
- Useful for testing without real GSM hardware
- No actual SMS sent in simulation mode

**Production Implementation:** Requires SIM800L GSM module with AT command implementation.

**Setup for Production:**

1. Connect SIM800L module to ESP32 UART (GPIO5=RX, GPIO4=TX by default)
2. Set phone number in `firmware/include/Secrets.h`:
   ```cpp
   #define GSM_PHONE_NUMBER "+48XXXXXXXXX"
   ```
3. Uncomment SIM800L code block in `firmware/src/main.cpp` in `sendSMS()` function
4. Requires dedicated 4.2V power supply for GSM module

**Code Template Provided:** See [firmware/README.md](firmware/README.md#-sms-notifications) for complete AT command reference and production code example.

### 3. Motor Control: Non-Blocking Architecture

**Design Challenge:** Initial blocking `delayMicroseconds()` loops during gate movement locked the processor, preventing MQTT `client.loop()` from executing. This resulted in connection timeouts and unresponsive user commands during operation.

**Architectural Solution:** Implemented AccelStepper library with non-blocking state machine. The `updateStepperMotion()` function executes every loop iteration (~2ms per step), enabling concurrent MQTT processing between motor steps.

**Result:** Device maintains responsive MQTT communication and processes user commands immediately during gate movement.

**Implementation Details:** See [firmware/README.md](firmware/README.md#-non-blocking-motor-control) for architecture diagram and code details.

### 4. Manual Fail-Safe Timer Trigger

The fail-safe countdown relies on client-side timer (`setInterval`). For critical systems, this should run server-side with the device itself enforcing the timeout via hardware interrupt (E-STOP button for production).

**Current Safety Level:** Device has hardware E-STOP interrupt (GPIO2 pull-to-ground). Even if software fails, gate can be stopped physically.

### 5. Credentials Management

**Design Choice:** Sensitive credentials (WiFi, MQTT, GSM phone) stored in gitignored `Secrets.h` file, never committed to repository.

**How It Works:**

- `firmware/include/Secrets.h.example` provides template
- User copies to `Secrets.h` and fills in credentials
- `.gitignore` prevents accidental commit

**Production Safety:** Each device deployment has unique `Secrets.h`; credentials not exposed in git history or public repositories.

**Implementation:** See [firmware/README.md](firmware/README.md#-security--credentials) for setup instructions.

### 6. EEPROM Wear Protection

**Design Choice:** Gate position saved to EEPROM only when changed (not every movement). Extends device lifetime from ~273 years to **137+ years** within the 100k write cycle limit.

**Calculation:**

- Estimated usage: 2 movements/day
- Writes per year: 730
- Lifetime: 100,000 ÷ 730 = **137+ years** ✓

**Implementation:** See [firmware/README.md](firmware/README.md#-eeprom-management--wear-protection) for code and monitoring details.

---

## 📝 License

This project is licensed under the **PolyForm Noncommercial 1.0.0** - see the [LICENSE](LICENSE) file for details.

> ⚠️ **LICENSE:**
> This project is shared under the **PolyForm Noncommercial 1.0.0** license.
>
> - ✅ **Free:** For private, educational, and hobbyist use (Self-Hosted).
> - ❌ **Paid/Requires Permission:** For any commercial use, resale, or commercial deployment.
>
> For commercial licensing inquiries (B2B), please contact: adam.gajewski.art@gmail.com

> 🎓 Created as an engineering thesis project.

---

<p align="center">
  Made with ❤️ using ESP32 and Python
</p>
