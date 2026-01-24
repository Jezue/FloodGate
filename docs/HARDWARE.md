# FloodGate - Hardware Documentation

This document describes three hardware configurations:

1. **Wokwi Simulator** - Virtual testing environment
2. **Scale Model (Prototype)** - Physical miniature for demonstrations
3. **Production System** - Real garage/industrial installation

---

## 1. Wokwi Simulator Version

**Purpose:** Development, testing, and demonstration without physical hardware.

### Components (from diagram.json)

| Part ID       | Wokwi Type                 | GPIO            | Description                         |
| ------------- | -------------------------- | --------------- | ----------------------------------- |
| `esp`         | `board-esp32-s3-devkitc-1` | -               | Main controller with MQTT support   |
| `pot-water`   | `wokwi-potentiometer`      | GPIO4 (ADC)     | Simulates water level sensor 0-50cm |
| `pot-battery` | `wokwi-potentiometer`      | GPIO5 (ADC)     | Simulates battery level 0-100%      |
| `led-down`    | `wokwi-led` (red)          | GPIO16          | Gate closing indicator              |
| `led-up`      | `wokwi-led` (green)        | GPIO17          | Gate opening indicator              |
| `r-led-down`  | `wokwi-resistor`           | -               | 220Ω current limiter for red LED    |
| `r-led-up`    | `wokwi-resistor`           | -               | 220Ω current limiter for green LED  |
| `a4988`       | `wokwi-a4988`              | GPIO10/11       | Stepper motor driver                |
| `stepper`     | `wokwi-stepper-motor`      | -               | NEMA 17 size stepper motor          |
| `relay`       | `wokwi-relay`              | GPIO32          | E-STOP / Power control relay        |
| `oled1`       | `board-ssd1306`            | GPIO18/19 (I2C) | 128x64 OLED display @ 0x3C          |

### GPIO Pin Assignment (from firmware)

```
GPIO4  → Water sensor (ADC input)
GPIO5  → Battery sensor (ADC input)
GPIO10 → Stepper STEP signal
GPIO11 → Stepper DIR signal
GPIO16 → Red LED (gate closing)
GPIO17 → Green LED (gate opening)
GPIO18 → OLED SDA (I2C data)
GPIO19 → OLED SCL (I2C clock)
GPIO32 → Relay control (E-STOP)
```

### How to Run

1. Install **VS Code** with **PlatformIO** extension
2. Install **Wokwi for VS Code** extension
3. Get free license at https://wokwi.com/license
4. Open `firmware/diagram.json`
5. Press `F1` → "Wokwi: Start Simulator"

> **Important:** Update `MQTT_SERVER` in `main.cpp` to your PC's IP address (run `ipconfig` in terminal)

---

## 2. Scale Model Version (Prototype)

**Purpose:** Physical demonstration, thesis presentation, exhibitions.

### Bill of Materials

| ESP32-S3 DevKitC-1 | Same as Wokwi | N8R8 variant recommended |
| Water Level Sensor | Capacitive/Resistive analog sensor | **Real sensor**, NOT a potentiometer |
| Battery Monitor | Voltage divider circuit | **Real circuit**, NOT a potentiometer |
| Stepper Motor | NEMA 17 (17HS4401S or similar) | 1.5-1.7A, 1.8°/step |
| Stepper Driver | A4988 module | With heatsink, same as Wokwi |
| OLED Display | SSD1306 0.96" I2C module | 128x64, address 0x3C |
| LEDs | 5mm through-hole | Red + Green with 220Ω resistors |
| Power Supply | 5V 3A USB-C + 12V 2A DC | Separate logic and motor power |
| Relay Module | 5V single-channel relay | For motor power control |

**Estimated Total Cost: ~$60 USD / ~250 PLN**

### Wiring (matches diagram.json connections)

```
ESP32-S3                    Components
─────────                   ──────────
GPIO4  ──────────────────── Water Sensor (SIG/AO)
GPIO5  ──────────────────── Battery Monitor (SIG/AO)
GPIO10 ──────────────────── A4988 STEP
GPIO11 ──────────────────── A4988 DIR
GPIO16 ────[220Ω]────────── Red LED (Anode)
GPIO17 ────[220Ω]────────── Green LED (Anode)
GPIO18 ──────────────────── OLED SDA
GPIO19 ──────────────────── OLED SCL
GPIO32 ──────────────────── Relay IN
3.3V   ──────────────────── Sensors VCC, OLED VCC, A4988 VDD
5V     ──────────────────── Relay VCC, Relay COM
GND    ──────────────────── All grounds (common)

A4988                       Motor
─────                       ─────
VMOT   ←── Relay NO ←────── 12V Supply (+)
GND    ──────────────────── 12V Supply (-)
1A/1B  ──────────────────── NEMA 17 Coil A
2A/2B  ──────────────────── NEMA 17 Coil B
RESET  ─┬─ SLEEP (tied together)
        └─ 3.3V
MS1/MS2/MS3 ─────────────── GND (full step mode)
```

---

## 3. Production Version (Garage/Industrial)

**Purpose:** Real flood protection for garage, basement, or industrial facility with heavy gate (50-200 kg).

### Key Differences from Scale Model

| Aspect        | Scale Model              | Production                   |
| ------------- | ------------------------ | ---------------------------- |
| Motor         | NEMA 17 stepper (12V 1A) | Industrial AC motor 200W-1kW |
| Gate Weight   | < 1 kg                   | 50-200 kg                    |
| Motor Control | A4988 direct PWM         | SSR Relay + VFD/Contactor    |
| Water Sensor  | Simple analog            | Industrial IP68 float switch |
| Communication | WiFi only                | WiFi + GSM backup            |
| Safety        | Basic relay              | E-Stop, limit switches, UPS  |

### Bill of Materials (Production)

| Component            | Suggested Model/Part                       | Notes                                      |
| -------------------- | ------------------------------------------ | ------------------------------------------ |
| **Controller**       | ESP32-S3-DevKitC-1-N8R8                    | Same as development, with external antenna |
| **Motor**            | SIEMENS 1LA7073-4AB10 or similar           | AC 3-phase 370W geared motor               |
| **Motor Driver**     | Siemens SINAMICS V20 0.37kW or Delta VFD-E | Variable Frequency Drive                   |
| **SSR Relays**       | FOTEK SSR-25DA (x2)                        | 25A 3-32VDC input, 24-380VAC output        |
| **Water Sensor**     | Gems LS-1700 or Madison M8000              | **Industrial Float**, NOT a potentiometer  |
| **Limit Switches**   | Omron D4MC-5020 or Honeywell GLAB20A1B     | Mechanical limit switch IP67               |
| **Proximity Sensor** | Omron E2E-X5ME1                            | Inductive sensor for position backup       |
| **E-Stop Button**    | Schneider XB5AS8442 or Siemens 3SU1000     | NC contact, mushroom head 40mm             |
| **GSM Module**       | SIMCom SIM800L or Quectel A7670E           | 2G/4G LTE modem for SMS                    |
| **UPS Battery**      | Yuasa NP7-12 12V 7Ah                       | Sealed lead-acid                           |
| **Charger Module**   | XH-M603 or TP5100                          | Battery charge controller                  |
| **Power Supply**     | Mean Well DR-120-24                        | 24V 5A DIN-rail mount                      |
| **Enclosure**        | Schneider NSYCRN86300 or Rittal AE         | IP65/66 steel cabinet                      |
| **DIN Rail**         | Standard TS35                              | 35mm mounting rail                         |
| **Terminal Blocks**  | Phoenix Contact UK series                  | Screw terminals for wiring                 |

**Estimated Total Cost: ~$500-700 USD / ~2000-2800 PLN**

### Production Wiring Diagram

```
┌────────────────────────── CONTROL CABINET ──────────────────────────┐
│                                                                      │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐   │
│   │  ESP32   │     │  RELAY   │     │   VFD    │     │  MOTOR   │   │
│   │   S3     │     │  MODULE  │     │ 370W+    │     │ AC Geared│   │
│   │          │     │  (SSR)   │     │          │     │          │   │
│   │ GPIO12 ──┼─────┤ IN1 (UP) │     │          │     │          │   │
│   │ GPIO13 ──┼─────┤ IN2 (DN) │     │          │     │          │   │
│   │          │     │ NO1 ─────┼─────┤ FWD      │     │          │   │
│   │          │     │ NO2 ─────┼─────┤ REV      │     │    ▲     │   │
│   │          │     │          │     │ OUT ─────┼─────┤    │     │   │
│   └──────────┘     └──────────┘     └──────────┘     │  GATE    │   │
│        │                                              └──────────┘   │
│   ┌────┴────────────────────────────────────────────────────────┐   │
│   │                        SENSORS                               │   │
│   │                                                              │   │
│   │  GPIO4  ◄──── Float Switch #1 (water)                       │   │
│   │  GPIO5  ◄──── Float Switch #2 (backup)                      │   │
│   │  GPIO14 ◄──── Limit Switch TOP                              │   │
│   │  GPIO15 ◄──── Limit Switch BOTTOM                           │   │
│   │  GPIO2  ◄──── E-STOP Button (interrupt)                     │   │
│   │                                                              │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌────────────┐       ┌────────────┐                               │
│   │  SIM800L   │       │  UPS 12V   │                               │
│   │  GSM       │       │  Battery   │                               │
│   │  TX→GPIO16 │       │  Powers    │                               │
│   │  RX→GPIO17 │       │  ESP32     │                               │
│   └────────────┘       └────────────┘                               │
│                                                                      │
│   MAINS: 240V AC ─────────────────────────────────────────────────  │
│   GROUND: Proper earth ground REQUIRED ──────────────────────────── │
└──────────────────────────────────────────────────────────────────────┘
```

### Safety Features

| Feature                 | GPIO              | Purpose                      |
| ----------------------- | ----------------- | ---------------------------- |
| E-Stop Button           | GPIO2 (interrupt) | Immediate motor cutoff       |
| Limit Switch Top        | GPIO14            | Prevent over-travel up       |
| Limit Switch Bottom     | GPIO15            | Prevent over-travel down     |
| Redundant Water Sensors | GPIO4 + GPIO5     | No single point of failure   |
| Watchdog Timer          | Internal          | Auto-restart on freeze       |
| GSM Backup              | GPIO16/17         | Alerts when WiFi fails       |
| UPS Battery             | -                 | Operates during power outage |

### Firmware Changes for Production

See `main.cpp` - production version requires additional GPIO definitions and safety interrupt handlers for E-Stop and limit switches.

---

## 4. Technical Details

### ADC Calculations (Water & Battery)

The ESP32-S3 uses a 12-bit ADC (0-4095 range).

- **Water Level:** `analogRead(4)` is mapped from `0-4095` to `0-50cm`.
- **Battery Level:** `analogRead(5)` reads a voltage divider (2x 100kΩ). The raw value is converted to voltage and multiplied by 2. `3.0V` is considered 0%, `4.2V` is 100%.

### LED Current Limiting

For 3.3V logic and standard LEDs (Vf ≈ 2.0V):
`R = (3.3V - 2.0V) / 0.006A ≈ 220Ω`.

### Full Pinout Reference

| GPIO | Function         | Type           |
| ---- | ---------------- | -------------- |
| 4    | Water Sensor     | Analog In      |
| 5    | Battery Sensor   | Analog In      |
| 10   | Stepper STEP     | Digital Out    |
| 11   | Stepper DIR      | Digital Out    |
| 16   | Red LED          | Digital Out    |
| 17   | Green LED        | Digital Out    |
| 18   | OLED SDA         | I2C            |
| 19   | OLED SCL         | I2C            |
| 32   | Relay / E-STOP   | Digital Out    |
| 14   | Limit Top \*     | Input (Pullup) |
| 15   | Limit Bottom \*  | Input (Pullup) |
| 2    | E-STOP Button \* | Interrupt In   |

_\* Used in Production version only._

---

## Comparison Summary

| Feature           | Wokwi         | Scale Model   | Production            |
| ----------------- | ------------- | ------------- | --------------------- |
| **Cost**          | $0            | ~$60          | ~$600                 |
| **Motor Power**   | Virtual       | 12V 1A        | 240V 370W+            |
| **Gate Weight**   | N/A           | < 1 kg        | 50-200 kg             |
| **Water Sensor**  | Potentiometer | Analog sensor | IP68 Float Switch     |
| **Communication** | Wokwi Gateway | WiFi          | WiFi + GSM            |
| **Power Backup**  | N/A           | None          | UPS 12V               |
| **Safety**        | None          | Basic         | Full (E-Stop, limits) |
| **Use Case**      | Development   | Demo          | Real installation     |
