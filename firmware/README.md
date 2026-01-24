# 📟 FloodGate Firmware (ESP32-S3)

Embedded control logic for the Intelligent Flood Protection System. Built with **C++** on the **Arduino** framework using **PlatformIO**.

## 🏗️ Architecture

The firmware follows a modular state-machine design optimized for safety and non-blocking concurrency:

- **`main.cpp`:** Core logic, MQTT communication, safety-critical interrupts, and non-blocking motor control.
- **`include/Constants.h`:** Centralized GPIO pins, system thresholds, and operational parameters.
- **`include/Secrets.h`:** Credentials file (gitignored) for WiFi and MQTT configuration.
- **`include/Secrets.h.example`:** Template file for initial setup.

## ✨ Key Features

- **Edge-Heavy Safety:** Automatic water detection and gate closure executes locally without cloud dependency.
- **Fail-Safe Mechanism:** Hardware interrupt-based E-Stop and real-time limit switch validation.
- **Non-Blocking Motor Control:** AccelStepper library enables responsive MQTT/sensor processing during gate movement.
- **Secure Credentials:** WiFi/MQTT credentials in gitignored Secrets.h (never committed to repo).
- **Dual Mode Support:**
  - `PRODUCTION_MODE`: Real hardware sensors and actuators.
  - `SIMULATION_MODE`: Virtual sensors for HIL testing with Wokwi.
- **Real-time Telemetry:** Non-blocking MQTT publishing and command handling.
- **SMS Alerts:** MQTT debug topic (simulation) or SIM800L GSM module (production).
- **EEPROM Wear Protection:** Position saved only when changed (137+ year lifetime).

## 🚀 Quick Start

### 1. Requirements

- VS Code with **PlatformIO IDE** extension.
- ESP32-S3 DevKitC-1 (N8R8 recommended).
- For production SMS: SIM800L GSM module with SIM card.

### 2. Secrets Configuration (First Time)

**Create credentials file:**
```bash
cd firmware
cp include/Secrets.h.example include/Secrets.h
```

**Edit `include/Secrets.h` with your credentials:**
```cpp
#define WIFI_SSID "YOUR_WIFI_NETWORK"
#define WIFI_PASS "YOUR_PASSWORD"
#define MQTT_SERVER "192.168.x.x"           // Your backend IP
#define GSM_PHONE_NUMBER ""  // Leave empty for Wokwi, set for SIM800L production
```

**Important:** Secrets.h is gitignored and will NOT be committed to repository.

### 3. Optional Hardware Configuration

Edit `include/Constants.h` for hardware settings:
```cpp
#define PRODUCTION_MODE   true      // Set to false for Wokwi simulation
#define WATER_THRESHOLD   2000      // ADC value for water detection
#define FAIL_SAFE_SECONDS 300       // 5 minutes
#define STEPPER_STEPS_FULL 800      // Full gate travel
```

### 4. Build & Flash

Use the PlatformIO toolbar in VS Code:

1. **Build:** ✅ (compiles with your Secrets.h)
2. **Upload:** ➡️ (flashes to ESP32-S3)
3. **Monitor:** 🔌 (115200 baud for serial logs)

## 🎮 Non-Blocking Motor Control

### Design Problem & Solution

**Initial Design Challenge:**
- Motor control used blocking `delayMicroseconds()` loop
- During 30-second gate movement, processor was locked
- MQTT `client.loop()` never executed → connection timeout
- User commands (STOP) ignored during movement
- Device became unresponsive during operation

**Optimized Architecture:**
- AccelStepper library provides non-blocking state machine
- `updateStepperMotion()` called every loop iteration (~2ms per step)
- MQTT processing happens between steps
- Concurrent: motor + MQTT + sensors

### Architecture

```cpp
void loop() {
  // Critical: Non-blocking stepper (runs every iteration)
  updateStepperMotion();   // ~2ms, one step at a time
  
  // MQTT processing happens here
  client.loop();           // Full bandwidth for messages
  
  // Sensor reading
  waterLevelCm = waterLevelFromRaw(analogRead(PIN_WATER_SENSOR));
  
  // State machine logic
  // ... (no blocking delays)
}
```

### Key Functions

**`stepperRunSteps(int steps, bool dir, int ledPin)`**
- Initiates non-blocking movement
- Configures AccelStepper target and speed
- Returns immediately (does NOT block)

**`updateStepperMotion()`**
- Called every loop iteration
- Executes one step via `stepper.run()`
- Checks safety conditions (E-STOP, limits, timeout)
- Saves position to EEPROM when complete

### Configuration

```cpp
stepper.setMaxSpeed(500.0);      // Steps per second (tunable)
stepper.setAcceleration(1000.0); // Steps per second^2
const unsigned long STEPPER_MOTOR_TIMEOUT_MS = 120000;  // 2 minutes safety timeout
```

### Benefits

✅ User commands processed immediately during movement  
✅ MQTT connection stays alive  
✅ Sensors continuously sampled  
✅ 2-minute timeout prevents runaway  
✅ Physical E-STOP button still works  

## 📡 MQTT Topics & Communication

### Publishing (ESP32 → Backend)

- **`system/{DEVICE_ID}/status`** - Full device status with telemetry (every 30s)
- **`system/{DEVICE_ID}/event`** - Event logs (water detection, gate movement)
- **`debug/sms`** - SMS messages (simulation mode)

### Subscribing (Backend → ESP32)

- **`system/{DEVICE_ID}/action`** - System-level commands
- **`system/{DEVICE_ID}/user_command`** - User actions (force_drop, force_raise, cancel_action, manual_drop)
- **`system/{DEVICE_ID}/schedule_command`** - Scheduler (daily_raise, daily_drop)
- **`system/{DEVICE_ID}/config`** - Configuration updates
- **`simulation/input`** - Simulation overrides (Wokwi mode only)

### Example Telemetry

```json
{
  "device_id": "ESP32_MAIN_001",
  "connection_status": "ONLINE",
  "telemetry": {
    "water_sensor_status": 0,
    "curtain_state": 0,
    "battery_soc_perc": 85,
    "water_level_cm": 3
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
  "timestamp": 1234567890
}
```

## 💾 EEPROM Management & Wear Protection

### Overview

Gate position is persisted to EEPROM for state recovery after power loss.

### Write Cycle Protection

**Problem:** ESP32 EEPROM has ~100k write cycle limit.

**Solution:** Position only written if changed since last save.

**Calculation:**
- Estimated usage: 2 movements/day
- Writes per year: 2 × 365 = 730
- Lifetime: 100,000 ÷ 730 = **137+ years** ✓

### Implementation

```cpp
int lastStoredPosition = -1;  // Tracks last saved position

void saveStepperPositionIfChanged() {
  if (stepperPosition != lastStoredPosition) {
    EEPROM.write(EEPROM_ADDR_POSITION, stepperPosition >> 8);       // High byte
    EEPROM.write(EEPROM_ADDR_POSITION + 1, stepperPosition & 0xFF); // Low byte
    EEPROM.commit();
    lastStoredPosition = stepperPosition;
    Serial.printf("[EEPROM] Position saved: %d steps (write cycle protection active)\n",
                  stepperPosition);
  }
}
```

### Monitoring

Serial output shows EEPROM activity:
```
[EEPROM] Restored position: 400 steps (50%)
[EEPROM] Position saved: 400 steps (write cycle protection active)
```

## 📱 SMS Notifications

### Simulation Mode (Current)

The `sendSMS()` function publishes to MQTT topic `debug/sms`:
- Used for Wokwi simulation compatibility
- Dashboard can subscribe and display messages
- No real SMS sent

### Production SMS with SIM800L

For real SMS in production, use SIM800L module (code template provided).

**Setup:**
1. Connect SIM800L via UART to ESP32
2. Define pins in code (default: RX=GPIO5, TX=GPIO4)
3. Set phone number in Secrets.h:
   ```cpp
   #define GSM_PHONE_NUMBER "+48XXXXXXXXX"  // Your phone with country code
   ```
4. Uncomment SIM800L code block in `sendSMS()` function
5. Requires dedicated 4.2V power supply for GSM module

**AT Commands Used:**
```
AT+CMGF=1                    # Set SMS text mode
AT+CMGS="+48123456789"       # Start SMS to phone
[SMS content here]           # Message body
Ctrl+Z (ASCII 26)            # Send confirmation
```

**Complete template:** See main.cpp `sendSMS()` function for production code.

## 🔐 Security & Credentials

### Secrets Management

- **Secrets.h** - GITIGNORED (your actual credentials)
  - WiFi SSID and password
  - MQTT server address
  - GSM phone number (if applicable)

- **Secrets.h.example** - COMMITTED (template only)
  - Shows structure and format
  - Contains dummy/placeholder values
  - Used for initial setup via `cp Secrets.h.example Secrets.h`

### Best Practices

```bash
# First time: copy template
cp include/Secrets.h.example include/Secrets.h

# Edit with your credentials
nano include/Secrets.h

# Verify it's in .gitignore (it is!)
git status  # Secrets.h should NOT appear
```

## 🧪 Testing & Debugging

### Serial Monitor

All firmware actions logged to serial (115200 baud):
```
[STEPPER] Initiating movement: 800 steps, direction=DOWN
[STEPPER] Movement started: position 0 -> 800
[SAFETY] Motor timeout! Force stopping.
[EEPROM] Position saved: 800 steps (write cycle protection active)
```

### Wokwi Simulation

```bash
# In VS Code with Wokwi extension
F1 → "Wokwi: Start Simulator"

# Firmware runs with:
WIFI_SSID = "Wokwi-GUEST"
MQTT_SERVER = 192.168.x.x (your PC IP)
```

### Production Mode

Set in Constants.h:
```cpp
#define PRODUCTION_MODE true
```

Enables:
- Limit switch validation
- E-STOP button interrupt
- Real hardware sensor processing

## 🔧 Hardware Reference

| Pin (GPIO) | Function         | Component                | Type  |
|----------|------------------|--------------------------|-------|
| 4        | Water Sensor     | Analog input (0-50cm)    | ADC1  |
| 5        | Battery Sensor   | Analog input (0-100%)    | ADC1  |
| 10       | Stepper STEP     | Motor control pulse      | GPIO  |
| 11       | Stepper DIR      | Motor direction control  | GPIO  |
| 16       | LED Red          | Gate closing indicator   | GPIO  |
| 17       | LED Green        | Gate opening indicator   | GPIO  |
| 18       | OLED SDA         | Display data line        | I2C   |
| 19       | OLED SCL         | Display clock line       | I2C   |
| 14 (Prod)| Limit Switch Top | Position detection       | GPIO  |
| 15 (Prod)| Limit Sw. Bottom | Position detection       | GPIO  |
| 2 (Prod) | E-STOP Button    | Emergency stop interrupt | GPIO  |
| 32       | Relay Control    | Motor power enable       | GPIO  |

## 📚 Dependencies (PlatformIO)

```ini
[env:esp32s3]
lib_deps =
  knolleary/PubSubClient @ ^2.8           # MQTT client
  bblanchon/ArduinoJson @ ^6.21.3         # JSON parsing
  adafruit/Adafruit SSD1306 @ ^2.5.9      # OLED display
  adafruit/Adafruit GFX Library @ ^1.11.9 # Graphics
  waspinator/AccelStepper @ ^1.61         # Non-blocking motor control
```

## 🎓 Architecture Improvements

| Aspect | Previous | Current |
|--------|------|-------|
| Motor Control | Blocking loop | Non-blocking AccelStepper |
| MQTT During Movement | ❌ Timeout | ✅ Responsive |
| User Commands | ❌ Ignored | ✅ Immediate |
| Credential Storage | Hardcoded | ✅ Secrets.h |
| EEPROM Wear | Unprotected | ✅ Change detection |
| Position Recovery | Manual | ✅ Automatic |

---

_Part of the Intelligent Flood Protection Engineering Project._

