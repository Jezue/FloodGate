# FloodGate - Dokumentacja Hardware

Ten dokument opisuje trzy konfiguracje sprzętowe:

1. **Symulator Wokwi** - Wirtualne środowisko testowe
2. **Makieta (Prototyp)** - Fizyczna miniatura do demonstracji
3. **System Produkcyjny** - Prawdziwa instalacja garażowa/przemysłowa

---

## 1. Wersja Wokwi Simulator

**Cel:** Rozwój, testowanie i demonstracja bez fizycznego sprzętu.

### Komponenty (Wirtualne)

| Komponent        | Część Wokwi                    | GPIO            | Uwagi               |
| ---------------- | ------------------------------ | --------------- | ------------------- |
| ESP32-S3 DevKit  | `esp32-s3-devkitc-1`           | -               | Główny kontroler    |
| Czujnik wody     | `analog-potentiometer`         | GPIO4 (ADC)     | Symuluje 0-50cm     |
| Czujnik baterii  | `analog-potentiometer`         | GPIO5 (ADC)     | Symuluje 0-100%     |
| Silnik krokowy   | `wokwi-stepper-motor`          | GPIO10/11       | Piny STEP/DIR       |
| Wyświetlacz OLED | `ssd1306`                      | GPIO18/19 (I2C) | 128x64 pikseli      |
| Czerwona LED     | `wokwi-led` + `wokwi-resistor` | GPIO16          | Wskaźnik zamykania  |
| Zielona LED      | `wokwi-led` + `wokwi-resistor` | GPIO17          | Wskaźnik otwierania |

### Konfiguracja Wokwi

```json
// diagram.json (uproszczony)
{
  "version": 1,
  "author": "FloodGate",
  "editor": "wokwi",
  "parts": [
    { "type": "esp32-s3-devkitc-1", "id": "esp" },
    { "type": "analog-potentiometer", "id": "water-sensor" },
    { "type": "analog-potentiometer", "id": "battery-sensor" },
    { "type": "wokwi-stepper-motor", "id": "stepper" },
    { "type": "ssd1306", "id": "oled" },
    { "type": "wokwi-led", "id": "led-down", "attrs": { "color": "red" } },
    { "type": "wokwi-led", "id": "led-up", "attrs": { "color": "green" } },
    {
      "type": "wokwi-resistor",
      "id": "r-led-down",
      "attrs": { "resistance": "220" }
    },
    {
      "type": "wokwi-resistor",
      "id": "r-led-up",
      "attrs": { "resistance": "220" }
    }
  ]
}
```

### Jak Uruchomić

1. Zainstaluj **VS Code** z rozszerzeniem **PlatformIO**
2. Zainstaluj rozszerzenie **Wokwi for VS Code**
3. Uzyskaj darmową licencję na https://wokwi.com/license
4. Otwórz `firmware/diagram.json`
5. Naciśnij `F1` → "Wokwi: Start Simulator"

> **Uwaga:** Zaktualizuj `MQTT_SERVER` w `main.cpp` na adres IP twojego PC (uruchom `ipconfig`)

---

## 2. Wersja Makieta (Prototyp)

**Cel:** Fizyczna demonstracja, prezentacja pracy dyplomowej, wystawy.

### Lista Części (BOM)

| Komponent         | Model/Odpowiednik fizyczny      | Uwagi                                   |
| ----------------- | ------------------------------- | --------------------------------------- |
| Mikrokontroler    | ESP32-S3-DevKitC-1-N8R8         | Zalecana wersja z anteną                |
| Czujnik wody      | Analogowy czujnik poziomu FC-28 | **Prawdziwy czujnik**, NIE potencjometr |
| Monitor baterii   | Układ dzielnika napięcia        | **Prawdziwy układ**, NIE potencjometr   |
| Silnik krokowy    | NEMA 17 (17HS4401S)             | 1.7A, 1.8°/krok                         |
| Sterownik silnika | Moduł A4988 z radiatorem        | Identyczny jak w Wokwi                  |
| Wyświetlacz OLED  | SSD1306 0.96" I2C 128x64        | Adres 0x3C                              |
| LEDy              | 5mm czerwona + zielona          | Z rezystorami 220Ω                      |
| Zasilacz logiki   | 5V 3A USB-C                     | Dla ESP32                               |
| Zasilacz silnika  | 12V 2A DC                       | Oddzielne zasilanie                     |
| Przekaźnik        | Moduł 5V 1-kanałowy             | Sterowanie mocą silnika                 |
| Płytka stykowa    | Standardowa pełnowymiarowa      | Opcjonalna                              |
| Przewody          | Zestaw M-M, M-F                 | Po 40 szt.                              |

**Szacunkowy koszt całkowity: ~250 PLN**

### Schemat Połączeń (Makieta)

```
                    ┌─────────────────────────┐
                    │      ESP32-S3           │
                    │                         │
Czujnik wody ───────┤ GPIO4 (ADC)             │
                    │                         │
Monitor baterii ────┤ GPIO5 (ADC)             │
                    │                         │
                    │ GPIO10 ─────────────────┼──── A4988 STEP
                    │ GPIO11 ─────────────────┼──── A4988 DIR
                    │                         │
                    │ GPIO16 ────[220Ω]────── │──── LED Czerwona (Anoda)
                    │ GPIO17 ────[220Ω]────── │──── LED Zielona (Anoda)
                    │                         │
                    │ GPIO18 ─────────────────┼──── OLED SDA
                    │ GPIO19 ─────────────────┼──── OLED SCL
                    │                         │
                    │ 3.3V ───────────────────┼──── Czujniki/OLED VCC
                    │ GND ────────────────────┼──── Wspólna masa
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │       A4988             │
                    ├─────────────────────────┤
     ESP32 GPIO10 ──┤ STEP                    │
     ESP32 GPIO11 ──┤ DIR                     │
     ESP32 3.3V ────┤ VDD (Logika)            │
     ESP32 GND ─────┤ GND                     │
                    │                         │
     Zasilacz 12V ──┤ VMOT ────────────────── │──── Zasilanie silnika
     12V GND ───────┤ GND                     │
                    │                         │
                    │ 1A, 1B ─────────────────┼──── NEMA 17 Cewka A
                    │ 2A, 2B ─────────────────┼──── NEMA 17 Cewka B
                    │                         │
     (do VDD) ──────┤ RESET, SLEEP            │
     (do GND) ──────┤ MS1, MS2, MS3           │
                    └─────────────────────────┘
```

### Różnice względem Wokwi

| Aspekt       | Wokwi        | Makieta            |
| ------------ | ------------ | ------------------ |
| Zasilanie    | Symulowane   | Prawdziwe 5V + 12V |
| Silnik       | Wirtualny    | Fizyczny NEMA 17   |
| Czujnik wody | Potencjometr | Prawdziwy czujnik  |
| Sieć         | Bramka Wokwi | Prawdziwe WiFi     |

---

## 3. Wersja Produkcyjna (Garaż/Przemysł)

**Cel:** Prawdziwy system ochrony przed powodzią dla garażu, piwnicy lub obiektu przemysłowego.

### Kluczowe Różnice względem Makiety

| Aspekt             | Makieta            | Produkcja                   |
| ------------------ | ------------------ | --------------------------- |
| **Silnik**         | NEMA 17 (mały)     | Silnik przemysłowy 200W-1kW |
| **Zasilanie**      | 12V 2A             | 24V-48V 20A+                |
| **Sterowanie**     | A4988 bezpośrednio | Przekaźniki + Falownik/VFD  |
| **Czujnik**        | Prosty analogowy   | Przemysłowy wodoodporny     |
| **Komunikacja**    | WiFi               | WiFi + GSM backup           |
| **Bezpieczeństwo** | Podstawowe         | E-Stop, krańcówki, UPS      |

### Lista Części (Produkcja)

| Komponent              | Sugerowany model                            | Uwagi                             |
| ---------------------- | ------------------------------------------- | --------------------------------- |
| **Kontroler**          | ESP32-S3-DevKitC-1-N8R8                     | Z anteną zewnętrzną               |
| **Silnik**             | SIEMENS 1LA7073-4AB10 lub podobny           | AC 3-fazowy 370W z przekładnią    |
| **Falownik**           | Siemens SINAMICS V20 0.37kW lub Delta VFD-E | Soft start/stop                   |
| **Przekaźniki SSR**    | FOTEK SSR-25DA (x2)                         | 25A, 3-32VDC wejście              |
| **Czujnik wody**       | Gems LS-1700 lub Madison M8000              | **Pływak IP68**, NIE potencjometr |
| **Krańcówki**          | Omron D4MC-5020 lub Honeywell GLAB20A1B     | Mechaniczne IP67                  |
| **Czujnik indukcyjny** | Omron E2E-X5ME1                             | Backup pozycji                    |
| **Przycisk E-Stop**    | Schneider XB5AS8442 lub Siemens 3SU1000     | Grzybek 40mm, NC                  |
| **Moduł GSM**          | SIMCom SIM800L lub Quectel A7670E           | 2G/4G LTE modem                   |
| **Akumulator UPS**     | Yuasa NP7-12 12V 7Ah                        | Kwasowo-ołowiowy                  |
| **Ładowarka**          | XH-M603 lub TP5100                          | Kontroler ładowania               |
| **Zasilacz**           | Mean Well DR-120-24                         | 24V 5A, szyna DIN                 |
| **Obudowa**            | Schneider NSYCRN86300 lub Rittal AE         | IP65/66, stalowa                  |
| **Szyna DIN**          | Standard TS35                               | Montaż 35mm                       |
| **Złączki**            | Phoenix Contact UK series                   | Zaciski śrubowe                   |

**Szacunkowy koszt całkowity: ~2000-2800 PLN**

### Schemat Połączeń (Produkcja)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SZAFKA STEROWNICZA                               │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                                                                  │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │ │
│  │  │   ESP32     │    │ MODUŁ       │    │ STEROWNIK   │          │ │
│  │  │   -S3       │    │ PRZEKAŹN.   │    │ SILNIKA     │          │ │
│  │  │             │    │             │    │ (VFD)       │          │ │
│  │  │  GPIO12 ────┼────┤ IN1 (GÓRA)  │    │             │          │ │
│  │  │  GPIO13 ────┼────┤ IN2 (DÓŁ)   │    │             │          │ │
│  │  │             │    │             │    │             │          │ │
│  │  │             │    │ COM ────────┼────┤ FWD/REV     │          │ │
│  │  │             │    │ NO1 ────────┼────┤ RUN         │          │ │
│  │  │             │    │             │    │             │          │ │
│  │  └─────────────┘    └─────────────┘    └──────┬──────┘          │ │
│  │        │                                      │                  │ │
│  │        │ Logika 3.3V                         │ 380V/240V AC     │ │
│  │        ▼                                      ▼                  │ │
│  │  ┌─────────────┐                        ┌─────────────┐          │ │
│  │  │  CZUJNIKI   │                        │   SILNIK    │          │ │
│  │  │             │                        │   370W      │          │ │
│  │  │ Pływak ─────┼─ GPIO4                 │ Przekładn.  │          │ │
│  │  │ Pływak ─────┼─ GPIO5 (backup)        │             │          │ │
│  │  │             │                        │   ▲         │          │ │
│  │  │ Krańc.góra ─┼─ GPIO14                │   │ Sprzęg. │          │ │
│  │  │ Krańc.dół ──┼─ GPIO15                │   ▼         │          │ │
│  │  │             │                        │  [BRAMA]    │          │ │
│  │  │ E-STOP ─────┼─ GPIO2 (przerwanie)    │             │          │ │
│  │  │             │                        └─────────────┘          │ │
│  │  └─────────────┘                                                 │ │
│  │                                                                  │ │
│  │  ┌─────────────┐    ┌─────────────┐                             │ │
│  │  │    GSM      │    │    UPS      │                             │ │
│  │  │  SIM800L    │    │  12V 7Ah    │                             │ │
│  │  │             │    │             │                             │ │
│  │  │  TX ────────┼─ GPIO16          │                             │ │
│  │  │  RX ────────┼─ GPIO17          │                             │ │
│  │  │             │    │  Zasila ESP32 podczas awarii              │ │
│  │  └─────────────┘    └─────────────┘                             │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ZASILANIE: 240V AC ───────────────────────────────────────────────  │
│  UZIEMIENIE: Wymagane prawidłowe uziemienie ─────────────────────── │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Funkcje Bezpieczeństwa (Produkcja)

| Funkcja              | Implementacja                       | Cel                                |
| -------------------- | ----------------------------------- | ---------------------------------- |
| **Przycisk E-Stop**  | Przerwanie sprzętowe GPIO           | Natychmiastowe zatrzymanie silnika |
| **Krańcówki**        | Pozycje góra + dół                  | Zapobieganie przekroczeniu zakresu |
| Fizyczny przełącznik | Obejście sterowania elektronicznego |

---

## 4. Szczegóły Techniczne

### Kalkulacja ADC (Woda i Bateria)

ESP32-S3 posiada 12-bitowy przetwornik ADC (zakres 0-4095).

- **Poziom wody:** `analogRead(4)` jest mapowany z zakresu `0-4095` na `0-50 cm`.
- **Poziom baterii:** `analogRead(5)` odczytuje napięcie przez dzielnik (2x 100kΩ). Wartość surowa jest zamieniana na napięcie i mnożona przez 2. Napięcie `3.0V` to 0%, a `4.2V` to 100%.

### Ograniczenie prądu LED

Dla logiki 3.3V i standardowych diod (Vf ≈ 2.0V):
`R = (3.3V - 2.0V) / 0.006A ≈ 220Ω`.

### Pełna lista wyprowadzeń (Pinout)

| GPIO | Funkcja             | Typ            |
| ---- | ------------------- | -------------- |
| 4    | Czujnik wody        | Analog In      |
| 5    | Czujnik baterii     | Analog In      |
| 10   | Stepper STEP        | Digital Out    |
| 11   | Stepper DIR         | Digital Out    |
| 16   | LED Czerwona        | Digital Out    |
| 17   | LED Zielona         | Digital Out    |
| 18   | OLED SDA            | I2C            |
| 19   | OLED SCL            | I2C            |
| 32   | Przekaźnik / E-STOP | Digital Out    |
| 14   | Krańcówka góra \*   | Input (Pullup) |
| 15   | Krańcówka dół \*    | Input (Pullup) |
| 2    | Przycisk E-STOP \*  | Interrupt In   |

_\* Używane tylko w wersji produkcyjnej._

---

### Zmiany w Firmware dla Produkcji

```cpp
// Dodaj do main.cpp dla wersji produkcyjnej

// Dodatkowe definicje GPIO
#define PIN_RELAY_UP      12    // Przekaźnik silnika GÓRA
#define PIN_RELAY_DOWN    13    // Przekaźnik silnika DÓŁ
#define PIN_LIMIT_TOP     14    // Krańcówka górna
#define PIN_LIMIT_BOTTOM  15    // Krańcówka dolna
#define PIN_ESTOP         2     // Wyłącznik awaryjny (przerwanie)
#define PIN_WATER_BACKUP  5     // Zapasowy czujnik wody
#define PIN_GSM_TX        16    // SIM800L TX
#define PIN_GSM_RX        17    // SIM800L RX

// Przerwanie bezpieczeństwa
void IRAM_ATTR onEStop() {
  digitalWrite(PIN_RELAY_UP, LOW);
  digitalWrite(PIN_RELAY_DOWN, LOW);
  emergencyStopActive = true;
}

void setup() {
  // ... istniejący setup ...

  // Bezpieczeństwo produkcyjne
  pinMode(PIN_ESTOP, INPUT_PULLUP);
  attachInterrupt(PIN_ESTOP, onEStop, FALLING);

  pinMode(PIN_LIMIT_TOP, INPUT_PULLUP);
  pinMode(PIN_LIMIT_BOTTOM, INPUT_PULLUP);
}

// Sterowanie silnikiem z krańcówkami
void moveGate(bool down) {
  if (emergencyStopActive) return;

  if (down && digitalRead(PIN_LIMIT_BOTTOM) == LOW) {
    // Już na dole
    return;
  }
  if (!down && digitalRead(PIN_LIMIT_TOP) == LOW) {
    // Już na górze
    return;
  }

  digitalWrite(down ? PIN_RELAY_DOWN : PIN_RELAY_UP, HIGH);

  // Czekaj na krańcówkę lub timeout
  unsigned long startTime = millis();
  while (millis() - startTime < MOTOR_TIMEOUT_MS) {
    if (down && digitalRead(PIN_LIMIT_BOTTOM) == LOW) break;
    if (!down && digitalRead(PIN_LIMIT_TOP) == LOW) break;
    if (emergencyStopActive) break;
    delay(10);
  }

  digitalWrite(PIN_RELAY_UP, LOW);
  digitalWrite(PIN_RELAY_DOWN, LOW);
}
```

### Prawdziwa Implementacja SMS (Produkcja)

Zamień symulację `sendSMS()` przez MQTT na prawdziwy GSM:

```cpp
#include <SoftwareSerial.h>

SoftwareSerial gsm(PIN_GSM_RX, PIN_GSM_TX);

void sendRealSMS(const char* message) {
  gsm.println("AT+CMGF=1");  // Tryb tekstowy
  delay(100);
  gsm.println("AT+CMGS=\"+48123456789\"");  // Numer telefonu
  delay(100);
  gsm.print(message);
  delay(100);
  gsm.write(26);  // Ctrl+Z do wysłania
  delay(5000);
}
```

---

## Tabela Porównawcza

| Funkcja                | Wokwi        | Makieta          | Produkcja              |
| ---------------------- | ------------ | ---------------- | ---------------------- |
| **Koszt**              | 0 zł         | ~250 zł          | ~2500 zł               |
| **Moc silnika**        | Wirtualna    | 12V 1A           | 240V 370W              |
| **Waga bramy**         | N/A          | <1 kg            | 50-200 kg              |
| **Czujnik wody**       | Potencjometr | Analogowy        | Przemysłowy pływak     |
| **Komunikacja**        | Bramka Wokwi | WiFi             | WiFi + GSM             |
| **Zasilanie zapasowe** | N/A          | N/A              | UPS 12V                |
| **Bezpieczeństwo**     | N/A          | Podstawowe       | Pełne (E-Stop, krańc.) |
| **Wodoodporność**      | N/A          | Nie              | Obudowa IP65           |
| **Zastosowanie**       | Rozwój       | Demo/Praca dypl. | Prawdziwa instalacja   |

---

## Zalecana Ścieżka Rozwoju

1. **Zacznij od Wokwi** - Rozwijaj i testuj całą logikę
2. **Zbuduj Makietę** - Zwaliduj integrację fizyczną
3. **Wdróż Produkcję** - Instaluj z pełnymi zabezpieczeniami

Każdy etap waliduje poprzedni przed zaangażowaniem się w droższy sprzęt.
