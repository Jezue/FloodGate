#ifndef CONSTANTS_H
#define CONSTANTS_H

// ==========================================================================
#define PRODUCTION_MODE true // Set to false for simulation/makieta
#define SIMULATION_MODE (!PRODUCTION_MODE)
// GPIO PIN ASSIGNMENTS (Matches diagram.json)
// ==========================================================================

// Sensors (Analog)
#define PIN_WATER_SENSOR 4   // ADC1_CH3
#define PIN_BATTERY_SENSOR 5 // ADC1_CH4

// Stepper Motor (Digital Out)
#define PIN_STEP 10
#define PIN_DIR 11

// Status Indicators (Digital Out)
#define PIN_LED_DOWN 16 // Red LED
#define PIN_LED_UP 17   // Green LED

// OLED Display (I2C)
#define PIN_SDA 18
#define PIN_SCL 19

// Power / E-STOP Control
#define PIN_RELAY 32

// ==========================================================================
// PRODUCTION-ONLY PINS
// ==========================================================================
#define PIN_LIMIT_TOP 14
#define PIN_LIMIT_BOTTOM 15
#define PIN_ESTOP_BUTTON 2

// ==========================================================================
// SYSTEM PARAMETERS
// ==========================================================================
#define FW_VERSION "1.0"
#define WATER_THRESHOLD 2000     // ADC value trigger
#define FAIL_SAFE_SECONDS 300    // 5 minutes
#define TELEMETRY_INTERVAL 30000 // 30 seconds
#define STATUS_CHECK_MS 5000     // 5 seconds
#define MOTOR_TIMEOUT_MS 10000   // 10 seconds safety timeout
#define OFFLINE_MAX_RETRIES 3
#define OFFLINE_RETRY_INTERVAL 30000
#define STEPPER_STEPS_FULL 800

#endif
