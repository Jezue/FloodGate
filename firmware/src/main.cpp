#include <AccelStepper.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <Wire.h>

#include "Constants.h"
#include "Secrets.h"

// ====== SYSTEM ARCHITECTURE ======
// MOTOR CONTROL: NON-BLOCKING
//
// This implementation uses the AccelStepper library to ensure responsive
// MQTT communication during gate movement.
//
// Key Design Principles:
// 1. Concurrency: The updateStepperMotion() function is called in every loop()
//    iteration, executing at most one step (~2ms).
// 2. Responsiveness: MQTT client.loop() and sensor readings are processed
//    between motor steps, preventing connection timeouts.
// 3. Safety: A hardware E-STOP interrupt and software timeout (2 min)
//    override any movement commands.
//
// Configuration:
// - Max Speed: 500 steps/sec
// - Acceleration: 1000 steps/sec^2

// OLED Display
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool displayOk = false;

// ====== STATE MACHINE ======
enum SystemState {
  STATE_IDLE,
  STATE_WATER_DETECTED,
  STATE_AUTO_DROP,
  STATE_MANUAL_WAIT,
  STATE_MANUAL_DROP,
  STATE_OFFLINE_FALLBACK,
  STATE_GATE_CLOSED
};

SystemState currentState = STATE_IDLE;
String stateNames[] = {"IDLE",        "WATER_DET", "AUTO_DROP", "MANUAL_WAIT",
                       "MANUAL_DROP", "OFFLINE",   "CLOSED"};

// ====== SENSOR STATE ======
int waterRaw = 0;
int batteryRaw = 0;
float waterLevelCm = 0.0;
int batteryPercent = 0;

// ====== SAFETY STATE ======
volatile bool eStopActive = false;
void IRAM_ATTR onEStop() {
  eStopActive = true;
  digitalWrite(PIN_RELAY, LOW); // Hard power cutoff
}

// ====== STEPPER POSITION TRACKING ======
// STEPPER_STEPS_FULL is now defined in Constants.h
// EEPROM storage for position persistence
const int EEPROM_ADDR_POSITION = 0; // EEPROM address for storing position

// AccelStepper for NON-BLOCKING motor control
int stepperPosition = 0;     // Current position: 0=fully open, 800=fully closed
int lastStoredPosition = -1; // Track last EEPROM write to prevent wear
bool curtainDown = false;    // Derived from position (position >= 800)

// EEPROM Wear Mitigation:
// ESP32 EEPROM has ~100k write cycles limit. We only write when position
// actually changes. lastStoredPosition prevents redundant writes during
// frequent sensor corrections. Max wear: ~200 writes per year (2 movements/day
// × 365) = lifetime >> 100k cycles

// Non-blocking stepper control
AccelStepper stepper(AccelStepper::DRIVER, PIN_STEP, PIN_DIR);
bool stepperMoving = false;
int stepperTargetPosition = 0;
int stepperLedPin = -1;
unsigned long stepperMotorStartTime = 0;
const unsigned long STEPPER_MOTOR_TIMEOUT_MS =
    120000; // 2 minutes safety timeout

// ====== THRESHOLDS ======
const float WATER_ALARM_CM = 10.0;
const float WATER_SAFE_CM = 5.0;

// ====== MANUAL TIMER ======
unsigned long manualTimeoutMinutes = 5;
unsigned long manualStartTime = 0;

// ====== SYSTEM MODE (from backend config) ======
String systemMode = "AUTOMATIC"; // AUTOMATIC or MANUAL

// ====== TELEMETRY INTERVAL ======
unsigned long lastTelemetryTime = 0;
// TELEMETRY_INTERVAL is now defined in Constants.h

// ====== OFFLINE RETRY ======
int offlineRetryCount = 0;
// OFFLINE_MAX_RETRIES and OFFLINE_RETRY_INTERVAL are now defined in Constants.h
unsigned long offlineLastRetry = 0;
bool waterAlarmAcknowledged = false; // Flag to snooze alarm

// ====== SCHEDULER LOCK ======
bool schedulerLocked = false;

// ====== BATTERY WARNING ======
bool batteryWarningSent = false;

WiFiClient espClient;
PubSubClient client(espClient);

// ====== HELPERS ======
static int clampi(int v, int lo, int hi) {
  return (v < lo) ? lo : (v > hi) ? hi : v;
}
static float clampf(float v, float lo, float hi) {
  return (v < lo) ? lo : (v > hi) ? hi : v;
}

int batteryPercentFromRaw(int raw) {
  int pct = map(raw, 0, 4095, 0, 100);
  return clampi(pct, 0, 100);
}

float waterLevelFromRaw(int raw) {
  float cm = map(raw, 0, 4095, 0, 50);
  return clampf(cm, 0.0, 50.0);
}

// ====== EEPROM WEAR PROTECTION ======
// Only writes position if it has changed since last save
// ESP32 EEPROM: ~100k write cycles limit
// Prevents unnecessary wear from frequent saves
void saveStepperPositionIfChanged() {
  if (stepperPosition != lastStoredPosition) {
    EEPROM.write(EEPROM_ADDR_POSITION, stepperPosition >> 8);       // High byte
    EEPROM.write(EEPROM_ADDR_POSITION + 1, stepperPosition & 0xFF); // Low byte
    EEPROM.commit();
    lastStoredPosition = stepperPosition;
    Serial.printf(
        "[EEPROM] Position saved: %d steps (write cycle protection active)\n",
        stepperPosition);
  }
}

// ====== SMS NOTIFICATION FUNCTION ======
// CURRENT: Simulation mode - publishes to MQTT debug/sms topic for Wokwi
// compatibility PRODUCTION: Requires SIM800L GSM module. See production code
// snippet below.
void sendSMS(const char *message) {
  char buffer[256];
  snprintf(buffer, sizeof(buffer), "[FloodGate] %s", message);

  // SIMULATION MODE (Wokwi):
  // Publishes to MQTT topic for dashboard integration
  client.publish("debug/sms", buffer);
  Serial.println(String("[SMS] ") + buffer);

  // PRODUCTION IMPLEMENTATION (SIM800L):
  // Uncomment the block below to enable GSM support.
  // Requires: SIM800L module on UART pins defined in config.
  /*
  if (!gsmInitialized) initGSM();
  String cmd = "AT+CMGS=\"" + String(GSM_PHONE_NUMBER) + "\"";
  gsm.println(cmd);
  delay(500);
  gsm.print(buffer);
  gsm.write(26); // ASCII 26 (Ctrl+Z) to send
  */
}

void drawScreen() {
  if (!displayOk)
    return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  // Title with version
  display.println("FLOODGATE v1.0");
  display.println("--------------");

  // BATERIA (Battery)
  display.setCursor(0, 16);
  display.print("Bateria: ");
  display.print(batteryPercent);
  display.println("%");

  // Battery progress bar (100px wide, 6px tall)
  int batBarWidth = (batteryPercent * 100) / 100;          // 0-100px
  display.drawRect(14, 24, 102, 8, SSD1306_WHITE);         // Outline
  display.fillRect(15, 25, batBarWidth, 6, SSD1306_WHITE); // Fill

  // WODA (Water)
  display.setCursor(0, 34);
  display.print("Woda: ");
  display.print(waterLevelCm, 0);
  display.println("cm");

  // Water progress bar (max 50cm scale)
  int waterBarWidth = (waterLevelCm * 100) / 50; // 0-100px for 0-50cm
  if (waterBarWidth > 100)
    waterBarWidth = 100;                                     // Cap at 100px
  display.drawRect(14, 42, 102, 8, SSD1306_WHITE);           // Outline
  display.fillRect(15, 43, waterBarWidth, 6, SSD1306_WHITE); // Fill

  // BRAMA (Gate)
  display.setCursor(0, 52);
  display.print("Brama: ");
  display.println(curtainDown ? "ZAMKNIETA" : "OTWARTA");

  // Gate progress bar (INVERTED: full bar = closed, empty = open)
  display.setCursor(0, 54);
  display.print("G:");
  display.drawRect(14, 60, 114, 4, SSD1306_WHITE); // Outer
  if (stepperPosition > 0) {
    int gateBarWidth = map(stepperPosition, 0, STEPPER_STEPS_FULL, 0,
                           112); // INVERTED: position 0 = empty, max = full
    display.fillRect(15, 61, gateBarWidth, 2, SSD1306_WHITE); // Fill
  }

  display.display();
}

void sendTelemetry() {
  StaticJsonDocument<400> doc;
  doc["device_id"] = DEVICE_ID;

  // Primary telemetry fields
  doc["water_level_cm"] = waterLevelCm;
  doc["gate_closed"] = curtainDown ? 1 : 0;
  doc["battery_pct"] = batteryPercent;
  doc["state"] = stateNames[currentState];
  doc["scheduler_locked"] = schedulerLocked ? 1 : 0;

  // Backward compatibility fields
  doc["water_alarm"] = (waterLevelCm > WATER_ALARM_CM) ? 1 : 0;
  doc["water_sensor_status"] = (waterLevelCm > WATER_ALARM_CM) ? 1 : 0;
  doc["curtain_state"] = curtainDown ? 1 : 0;
  doc["battery_soc_perc"] = batteryPercent;

  // Additional telemetry
  doc["stepper_position"] = stepperPosition;
  doc["stepper_percent"] = (stepperPosition * 100) / STEPPER_STEPS_FULL;
  doc["timestamp"] = millis();

  char buffer[400];
  serializeJson(doc, buffer);
  client.publish("system/" DEVICE_ID "/status", buffer);
  Serial.println(String("[Telemetry] ") + buffer);
}

void sendWaterAlertEvent() {
  StaticJsonDocument<256>
      doc; // Increased buffer size to accommodate extra event fields
  doc["event"] = "water_detected";
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = millis();

  // Include current sensor readings for detailed event logging
  doc["water_level_cm"] = waterLevelCm;
  doc["battery_pct"] = batteryPercent;

  char buffer[256];
  serializeJson(doc, buffer);
  client.publish("system/" DEVICE_ID "/event", buffer);
  Serial.printf("[EVENT] Water Alert Sent: level=%.1fcm, battery=%d%%\n",
                waterLevelCm, batteryPercent);
  sendTelemetry(); // Immediate telemetry update on detection
}

// ====== NON-BLOCKING STEPPER CONTROL ======
// Process stepper movement in the main loop (called from loop())
// This replaces the old blocking stepperRunSteps() function
void updateStepperMotion() {
  // Safety: check for emergency stop
  if (eStopActive) {
    if (stepperMoving) {
      stepper.stop();
      stepper.disableOutputs();
      digitalWrite(PIN_RELAY, LOW);
      digitalWrite(stepperLedPin, LOW);
      Serial.println("[SAFETY] !!! EMERGENCY STOP - Motor halted.");
      stepperMoving = false;
    }
    return;
  }

  // If not currently moving, nothing to do
  if (!stepperMoving) {
    return;
  }

  // Motor timeout safety check
  if (millis() - stepperMotorStartTime > STEPPER_MOTOR_TIMEOUT_MS) {
    Serial.println("[SAFETY] Motor timeout! Force stopping.");
    stepper.stop();
    stepper.disableOutputs();
    digitalWrite(PIN_RELAY, LOW);
    if (stepperLedPin >= 0)
      digitalWrite(stepperLedPin, LOW);
    stepperMoving = false;
    return;
  }

  // Limit switches (Production Mode)
  if (PRODUCTION_MODE) {
    bool movingDown = (stepper.currentPosition() > stepper.targetPosition());

    if (movingDown && digitalRead(PIN_LIMIT_BOTTOM) == LOW) {
      Serial.println("[SAFETY] Limit switch BOTTOM reached.");
      stepperPosition = STEPPER_STEPS_FULL;
      stepper.setCurrentPosition(STEPPER_STEPS_FULL);
      stepper.stop();
      stepper.disableOutputs();
      digitalWrite(PIN_RELAY, LOW);
      if (stepperLedPin >= 0)
        digitalWrite(stepperLedPin, LOW);
      stepperMoving = false;
      curtainDown = true;
      sendTelemetry();
      return;
    }

    if (!movingDown && digitalRead(PIN_LIMIT_TOP) == LOW) {
      Serial.println("[SAFETY] Limit switch TOP reached.");
      stepperPosition = 0;
      stepper.setCurrentPosition(0);
      stepper.stop();
      stepper.disableOutputs();
      digitalWrite(PIN_RELAY, LOW);
      if (stepperLedPin >= 0)
        digitalWrite(stepperLedPin, LOW);
      stepperMoving = false;
      curtainDown = false;
      sendTelemetry();
      return;
    }
  }

  // Run one step (non-blocking)
  stepper.run();

  // Check if movement is complete
  if (stepper.currentPosition() == stepper.targetPosition()) {
    stepper.stop();
    stepper.disableOutputs();
    digitalWrite(PIN_RELAY, LOW);
    if (stepperLedPin >= 0)
      digitalWrite(stepperLedPin, LOW);
    stepperPosition = stepper.currentPosition();
    curtainDown = (stepperPosition >= STEPPER_STEPS_FULL);
    stepperMoving = false;

    // Save position to EEPROM (only if changed - wear protection)
    saveStepperPositionIfChanged();

    Serial.printf("✅ Motor movement complete. Position: %d/%d\n",
                  stepperPosition, STEPPER_STEPS_FULL);
    sendTelemetry();
  }
}

// ====== STEPPER MOVEMENT INITIATION ======
// Start a non-blocking movement sequence
// This replaces the old blocking stepperRunSteps() function
void stepperRunSteps(int steps, bool dir, int ledPin) {
  if (stepperMoving) {
    Serial.println(
        "[STEPPER] Movement already in progress, ignoring new command");
    return;
  }

  Serial.printf("[STEPPER] Initiating movement: %d steps, direction=%s\n",
                steps, dir ? "DOWN" : "UP");

  int targetPos = dir ? (stepperPosition + steps) : (stepperPosition - steps);

  // Clamp target position to valid range
  targetPos = clampi(targetPos, 0, STEPPER_STEPS_FULL);

  // Configure AccelStepper for non-blocking operation
  stepper.setCurrentPosition(stepperPosition);
  stepper.setMaxSpeed(500.0);      // Steps per second
  stepper.setAcceleration(1000.0); // Steps per second^2
  stepper.moveTo(targetPos);
  stepper.enableOutputs();

  digitalWrite(PIN_DIR, dir ? HIGH : LOW);
  digitalWrite(ledPin, HIGH); // LED ON during movement
  digitalWrite(PIN_RELAY, HIGH);
  delay(20);

  stepperMoving = true;
  stepperTargetPosition = targetPos;
  stepperLedPin = ledPin;
  stepperMotorStartTime = millis();

  Serial.printf("[STEPPER] Movement started: position %d -> %d\n",
                stepperPosition, targetPos);
}

void moveCurtain(bool down) {
  // Check if already at target position
  bool targetReached =
      down ? (stepperPosition >= STEPPER_STEPS_FULL) : (stepperPosition <= 0);
  if (targetReached) {
    Serial.printf("[MOVE] Already at %s position\n", down ? "CLOSED" : "OPEN");
    curtainDown = down;
    return;
  }

  Serial.println(down ? "🔴 CLOSING GATE..." : "🟢 OPENING GATE...");

  int ledPin = down ? PIN_LED_DOWN : PIN_LED_UP;
  int stepsNeeded =
      down ? (STEPPER_STEPS_FULL - stepperPosition) : stepperPosition;

  stepperRunSteps(stepsNeeded, down, ledPin);

  curtainDown = (stepperPosition >= STEPPER_STEPS_FULL);
  Serial.printf("✅ GATE MOVEMENT COMPLETE (position: %d/%d steps)\n",
                stepperPosition, STEPPER_STEPS_FULL);
  sendTelemetry(); // Immediate telemetry after state change
}

void callback(char *topic, byte *payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++)
    msg += (char)payload[i];

  String t = String(topic);

  // Handle retained config messages
  if (t == "system/" DEVICE_ID "/config") {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      systemMode = doc["system_mode"] | "AUTOMATIC";
      manualTimeoutMinutes = doc["fail_safe_timeout_min"] | 5;
      Serial.printf("[CONFIG] system_mode=%s, timeout=%lu min\n",
                    systemMode.c_str(), manualTimeoutMinutes);
    }
  }

  if (t == "system/" DEVICE_ID "/action") {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {

      if (doc["mode"] == "AUTO") {
        Serial.println("[ACTION] Backend: AUTO mode");
        currentState = STATE_AUTO_DROP;
        schedulerLocked = true;
        sendSMS("Wykryto wodę! Auto-ochrona: Brama opuszczona!");
      }

      else if (doc["mode"] == "MANUAL") {
        manualTimeoutMinutes = doc["timeout_minutes"] | 5;
        Serial.printf("[ACTION] Backend: MANUAL mode, timeout=%lu min\n",
                      manualTimeoutMinutes);
        currentState = STATE_MANUAL_WAIT;
        manualStartTime = millis();
        schedulerLocked = true;

        char smsBuffer[128];
        snprintf(smsBuffer, sizeof(smsBuffer),
                 "Wykryto wodę! Czekam na Twoją decyzję (%lu min)",
                 manualTimeoutMinutes);
        sendSMS(smsBuffer);
      }
    }
  }

  if (t == "system/" DEVICE_ID "/user_command") {
    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      String cmd = doc["command"];

      if (cmd == "force_drop") {
        Serial.println("[USER] Force DROP");
        moveCurtain(true);
        currentState = STATE_GATE_CLOSED;
        schedulerLocked = true;
        sendSMS("Brama opuszczona ręcznie przez użytkownika");
      } else if (cmd == "force_raise") {
        Serial.println("[USER] Force RAISE");
        moveCurtain(false);
        currentState = STATE_IDLE;
        schedulerLocked = false;
        sendSMS("Brama podniesiona ręcznie przez użytkownika");
      } else if (cmd == "cancel_action") {
        Serial.println("[USER] Cancel action");
        currentState = STATE_IDLE;
        schedulerLocked = false;
        waterAlarmAcknowledged = true; // SNOOZE alarm until water drops
        sendSMS("Akcja anulowana przez użytkownika");
      } else if (cmd == "manual_drop") {
        Serial.println("[USER] Manual DROP confirmed");
        currentState = STATE_MANUAL_DROP;
        sendSMS("Brama opuszczona na Twoją prośbę");
      }
    }
  }

  if (t == "system/" DEVICE_ID "/schedule_command") {
    if (schedulerLocked) {
      Serial.println("[SCHEDULER] BLOCKED - alarm active");
      return;
    }

    StaticJsonDocument<128> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      String cmd = doc["command"];
      if (cmd == "daily_raise") {
        Serial.println("[SCHEDULER] Daily raise");
        moveCurtain(false);
      } else if (cmd == "daily_drop") {
        Serial.println("[SCHEDULER] Daily drop");
        moveCurtain(true);
      }
    }
  }

  if (t == "simulation/input" && SIMULATION_MODE) {
    StaticJsonDocument<200> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      if (doc.containsKey("set_water"))
        waterRaw = doc["set_water"];
      if (doc.containsKey("set_battery_raw"))
        batteryRaw = doc["set_battery_raw"];
      Serial.printf("[SIM] override: water=%d batRaw=%d\n", waterRaw,
                    batteryRaw);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println("\n\n🚀 FloodGate Firmware v" FW_VERSION);
  Serial.println("=== Starting Up ===\n");

  // Initialize EEPROM
  EEPROM.begin(512);
  stepperPosition = (EEPROM.read(EEPROM_ADDR_POSITION) << 8) |
                    EEPROM.read(EEPROM_ADDR_POSITION + 1);
  if (stepperPosition == 0xFFFF || stepperPosition > STEPPER_STEPS_FULL) {
    // EEPROM uninitialized or corrupted - assume fully open
    stepperPosition = 0;
    Serial.println("[EEPROM] Uninitialized - set to OPEN (0 steps)");
  } else {
    Serial.printf("[EEPROM] Restored position: %d steps (%d%%)\n",
                  stepperPosition,
                  (stepperPosition * 100) / STEPPER_STEPS_FULL);
  }
  // Initialize lastStoredPosition to prevent unnecessary writes on startup
  lastStoredPosition = stepperPosition;
  curtainDown = (stepperPosition >= STEPPER_STEPS_FULL);

  pinMode(PIN_LED_DOWN, OUTPUT);
  pinMode(PIN_LED_UP, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  pinMode(PIN_DIR, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);

  // Safety configuration
  if (PRODUCTION_MODE) {
    pinMode(PIN_LIMIT_TOP, INPUT_PULLUP);
    pinMode(PIN_LIMIT_BOTTOM, INPUT_PULLUP);
    pinMode(PIN_ESTOP_BUTTON, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_ESTOP_BUTTON), onEStop, FALLING);
  }

  digitalWrite(PIN_LED_DOWN, LOW);
  digitalWrite(PIN_LED_UP, LOW);
  digitalWrite(PIN_STEP, LOW);
  digitalWrite(PIN_DIR, LOW);
  digitalWrite(PIN_RELAY, LOW);

  // Initialize AccelStepper for non-blocking motor control
  stepper.setCurrentPosition(stepperPosition);
  stepper.setMaxSpeed(500.0);      // Steps per second
  stepper.setAcceleration(1000.0); // Steps per second^2
  stepper.disableOutputs();        // Disable until needed
  Serial.println("[STEPPER] AccelStepper initialized (non-blocking mode)");

  // Test LEDs at startup
  Serial.println("[TEST] Testing LEDs...");
  digitalWrite(PIN_LED_DOWN, HIGH);
  Serial.println("[TEST] RED LED (GPIO26) ON");
  delay(1000);
  digitalWrite(PIN_LED_DOWN, LOW);

  digitalWrite(PIN_LED_UP, HIGH);
  Serial.println("[TEST] GREEN LED (GPIO27) ON");
  delay(1000);
  digitalWrite(PIN_LED_UP, LOW);
  Serial.println("[TEST] LED test complete\n"); // Initialize I2C and Display
  Wire.begin(PIN_SDA, PIN_SCL);
  displayOk = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (displayOk) {
    Serial.println("✓ OLED Display initialized");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("FloodGate");
    display.println("Version 1.0");
    display.println("Booting...");
    display.display();
  } else {
    Serial.println("❌ OLED init failed");
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("📡 Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(300);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.println("   IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
  }

  client.setServer(MQTT_SERVER, 1883);
  client.setCallback(callback);

  // Try to connect to MQTT (max 3 attempts, non-blocking)
  Serial.print("⏳ Connecting to MQTT");
  int mqttAttempts = 0;
  while (!client.connected() && mqttAttempts < 3) {
    Serial.print(".");
    if (client.connect(DEVICE_ID)) {
      Serial.println(" ✅");
      client.subscribe("system/" DEVICE_ID "/action");
      client.subscribe("system/" DEVICE_ID "/user_command");
      client.subscribe("system/" DEVICE_ID "/schedule_command");
      client.subscribe("system/" DEVICE_ID "/config");
      if (SIMULATION_MODE)
        client.subscribe("simulation/input");
      sendTelemetry();
      break;
    }
    mqttAttempts++;
    delay(1000);
  }

  if (!client.connected()) {
    Serial.println(" ❌");
    Serial.println("⚠️  MQTT offline - running in AUTONOMOUS mode");
  }

  Serial.println("✓ Sensors initialized");
  Serial.println("✓ Entering main loop\n");

  // Update OLED to show ready state
  if (displayOk) {
  }
}

void loop() {
  // ===== CRITICAL: Non-blocking motor control (runs every iteration) =====
  // This allows MQTT to be processed even during motor movement
  updateStepperMotion();

  // Non-blocking MQTT reconnect (try every 30 seconds)
  static unsigned long lastMqttRetry = 0;
  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastMqttRetry > 30000) { // Try every 30 seconds
      lastMqttRetry = now;
      Serial.print("⏳ MQTT reconnect...");
      if (client.connect(DEVICE_ID)) {
        Serial.println(" ✅");
        client.subscribe("system/" DEVICE_ID "/action");
        client.subscribe("system/" DEVICE_ID "/user_command");
        client.subscribe("system/" DEVICE_ID "/schedule_command");
        client.subscribe("system/" DEVICE_ID "/config");
        if (SIMULATION_MODE)
          client.subscribe("simulation/input");
        offlineRetryCount = 0;
        sendTelemetry();
      } else {
        Serial.println(" ❌");
        offlineRetryCount++;
      }
    }
  } else {
    client.loop(); // Process MQTT messages only when connected
  }

  waterRaw = analogRead(PIN_WATER_SENSOR);
  batteryRaw = analogRead(PIN_BATTERY_SENSOR);
  waterLevelCm = waterLevelFromRaw(waterRaw);
  batteryPercent = batteryPercentFromRaw(batteryRaw);

  switch (currentState) {

  case STATE_IDLE:
    schedulerLocked = false;

    // Reset snooze flag if water drops below safe level
    if (waterLevelCm < WATER_SAFE_CM) {
      waterAlarmAcknowledged = false;
    }

    // Low battery warning - send only once
    if (batteryPercent < 15) {
      if (!batteryWarningSent) {
        Serial.println("WARNING: Low battery! Remaining: " +
                       String(batteryPercent) + "%. Please charge soon.");
        String msg =
            "⚠️ Niski poziom baterii! Pozostało: " + String(batteryPercent) +
            "%";
        sendSMS(msg.c_str());
        batteryWarningSent = true;
      }
    } else {
      // Reset flag when battery goes above 15%
      batteryWarningSent = false;
    }

    // Check for water alarm ONLY if not acknowledged
    if (waterLevelCm > WATER_ALARM_CM && !waterAlarmAcknowledged) {
      Serial.println("💧 WATER DETECTED!");
      currentState = STATE_WATER_DETECTED;
      schedulerLocked = true;
      sendWaterAlertEvent();
      offlineRetryCount = 0;
      offlineLastRetry = millis();
    }

    if (curtainDown && waterLevelCm < WATER_SAFE_CM) {
      static unsigned long lastMsg = 0;
      if (millis() - lastMsg > 60000) {
        sendSMS("Woda zniknęła - możesz podnieść bramę");
        lastMsg = millis();
      }
    }
    break;

  case STATE_WATER_DETECTED:
    // Wait for backend response.
    // If backend doesn't respond within 5 seconds in AUTOMATIC mode -> CLOSE
    // IMMEDIATELY
    if (systemMode == "AUTOMATIC" && (millis() - offlineLastRetry > 5000)) {
      Serial.println("[FAIL-SAFE] Backend dead? Auto-drop in 5s triggered!");
      sendSMS("Woda wykryta! Brama opuszczona. BRAK POŁĄCZENIA z aplikacją!");
      currentState = STATE_AUTO_DROP;
    }
    // Fallback dla trybu MANUAL lub innych (stara logika offline)
    else if (millis() - offlineLastRetry > OFFLINE_RETRY_INTERVAL) {
      offlineRetryCount++;
      offlineLastRetry = millis();
      Serial.printf("[OFFLINE] Retry %d/%d - No response from backend\n",
                    offlineRetryCount, OFFLINE_MAX_RETRIES);
      sendWaterAlertEvent(); // Retry event

      if (offlineRetryCount >= OFFLINE_MAX_RETRIES) {
        Serial.println("[OFFLINE] Max retries! Auto-drop!");
        currentState = STATE_OFFLINE_FALLBACK;
      }
    }
    break;

  case STATE_OFFLINE_FALLBACK:
    // Max retries reached, drop curtain now
    Serial.println(
        "[OFFLINE] No backend response after retries! Auto-drop for safety!");
    sendSMS("Woda wykryta! Brama opuszczona. BRAK POŁĄCZENIA z aplikacją!");
    moveCurtain(true);
    currentState = STATE_GATE_CLOSED;
    break;

  case STATE_AUTO_DROP:
    moveCurtain(true);
    currentState = STATE_GATE_CLOSED;
    break;

  case STATE_MANUAL_WAIT: {
    unsigned long elapsed = (millis() - manualStartTime) / 1000;
    unsigned long timeoutSec = manualTimeoutMinutes * 60;

    if (elapsed > timeoutSec) {
      Serial.println("[MANUAL] Timeout! Auto-drop!");
      sendSMS("Upłynął czas! Brama opuszczona automatycznie");
      moveCurtain(true);
      currentState = STATE_GATE_CLOSED;
    }
  } break;

  case STATE_MANUAL_DROP:
    moveCurtain(true);
    currentState = STATE_GATE_CLOSED;
    break;

  case STATE_GATE_CLOSED:
    schedulerLocked = true;

    if (waterLevelCm < WATER_SAFE_CM) {
      static unsigned long lastWaterGoneMsg = 0;
      if (millis() - lastWaterGoneMsg > 60000) {
        sendSMS("Woda zniknęła - możesz podnieść bramę");
        lastWaterGoneMsg = millis();
      }
    }
    break;
  }

  static unsigned long lastUpdate = 0;
  static unsigned long lastDisplay = 0;

  // Update display every 1 second
  if (millis() - lastDisplay > 1000) {
    lastDisplay = millis();
    drawScreen();
  }

  // Send telemetry every 30 seconds
  if (millis() - lastUpdate > 30000) {
    lastUpdate = millis();
    sendTelemetry();
  }
}
