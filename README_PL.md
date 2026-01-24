<p align="center">
  <img src="frontend/public/shield-logo.svg" width="120" alt="FloodGate Logo" />
</p>

<h1 align="center">FloodGate: Autonomous Flood Protection System</h1>

<p align="center">
  <strong>Inteligentny System Antypowodziowy oparty na IoT</strong><br>
  Automatyczna bariera przeciwpowodziowa z monitoringiem i zdalnym sterowaniem
</p>

<p align="center">
  <a href="docs/HARDWARE_PL.md">Hardware</a> •
  <a href="README.md">🇬🇧 English</a>
</p>

---

## 🎯 Cel Aplikacji

FloodGate to system IoT służący do **automatycznej ochrony obiektów przed zalaniem**. Łączy lokalną detekcję wody (reakcja urządzenia bez zależności od chmury) ze zdalnym nadzorem i sterowaniem (panel WWW / smartfon). System umożliwia zarówno pracę automatyczną, jak i ręczne wymuszenie działania bariery (override) przez użytkownika.

Zastosowania obejmują:

- **Wjazdy do garaży:** Ochrona garaży podziemnych przed wodą opadową z ulicy
- **Wejścia do budynków:** Zabezpieczenie lokali na parterze podczas intensywnych opadów
- **Obiekty przemysłowe:** Ochrona magazynów i infrastruktury krytycznej przed zalaniem
- **Bramy techniczne:** Automatyczna bariera dla punktów dostępowych zagrożonych szkodą wodną

---

## 🌍 Język / Language

**Domyślny język to polski.** Aby przełączyć interfejs na angielski:

```bash
cd scripts
python switch_language.py en    # Przełącz na angielski
python switch_language.py pl    # Przełącz z powrotem na polski
```

Skrypt modyfikuje:

- **Wyświetlacz OLED ESP32** - etykiety (Woda, Brama, Bateria)
- **Wiadomości SMS** - powiadomienia wysyłane przez urządzenie
- **Panel sterowania (Dashboard)** - teksty interfejsu użytkownika

> Po zmianie języka przebuduj firmware ESP32: `pio run`

---

## ✨ Funkcje

| Funkcja                              | Opis                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| 🚨 **Automatyczna detekcja zalania** | Czujnik wody wyzwala natychmiastowe zamknięcie bramy          |
| 📱 **Panel w czasie rzeczywistym**   | Interfejs React przyjazny dla urządzeń mobilnych              |
| ⏱️ **Zabezpieczenie Fail-safe**      | Konfigurowalne odliczanie przed automatycznym zamknięciem     |
| 🔔 **Powiadomienia SMS**             | Alerty symulowane przez topic MQTT (Wokwi)                    |
| 📊 **Logowanie telemetrii**          | Przechowywanie danych historycznych w TimescaleDB             |
| 🌤️ **Integracja z pogodą**           | Dane meteorologiczne z Open-Meteo API                         |
| 🔄 **Dwa tryby pracy**               | AUTOMATYCZNY (natychmiastowy) lub MANUALNY (z potwierdzeniem) |
| 🎮 **Symulator ESP32**               | Pełna integracja Wokwi w VS Code                              |

---

## 🏗️ Architektura

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
│  Broker MQTT     │◄────────│  Proces roboczy (Worker) │
│  Mosquitto:1883  │         │  Telemetria → Baza       │
└────────┬─────────┘         └──────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  ESP32-S3 (Symulator Wokwi)                          │
│  Czujnik wody, Silnik, OLED, LED                     │
└───────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────┐
│  DATABASE - TimescaleDB (PostgreSQL 15)              │
│  Port: 5434                                          │
└───────────────────────────────────────────────────────┘
```

### Przepływ 1: Telemetria (co 30s)

```
                    ┌─────────────────┐
                    │  ESP32 wysyła   │
                    │  dane czujników │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Broker MQTT    │
                    │  odbiera wiad.  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Worker zapisuje│
                    │  w bazie danych │
                    └────────┬────────┘
                             │
                             ▼
               ┌─────────────────────────────┐
               │  Dane: poziom_wody, bateria │
               │  stan_bramy, timestamp      │
               └─────────────────────────────┘
```

### Przepływ 2: Komenda ręczna (Użytkownik klika przycisk)

```
                    ┌─────────────────┐
                    │  Użytkownik     │
                    │  klika przycisk │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Frontend wysyła│
                    │  POST /command  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  API publikuje  │
                    │  do MQTT        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  ESP32 odbiera  │
                    │  i rusza bramą  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Telemetria z   │
                    │  nowym stanem   │
                    └─────────────────┘
```

### Przepływ 3: Wykrycie wody (z Potwierdzeniem/Anulowaniem)

```
                    ┌─────────────────┐
                    │  Wykryto wodę   │
                    │ (czujnik > 2000)│
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │    TRYB    │               │    TRYB       │
       │AUTOMATYCZNY│               │   MANUALNY    │
       └──────┬─────┘               └───────┬───────┘
              │                             │
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │Zamknij     │               │ Pokaż modal   │
       │natychmiast │               │ Fail-Safe(5m) │
       │Wyślij SMS  │               └───────┬───────┘
       └────────────┘                       │
                               ┌────────────┼────────────┐
                               ▼            ▼            ▼
                       ┌──────────┐  ┌──────────┐  ┌──────────┐
                       │ ZAMKNIJ  │  │ ANULUJ   │  │ CZAS     │
                       │ TERAZ    │  │ (ignoruj)│  │ MINĄŁ    │
                       └────┬─────┘  └────┬─────┘  └────┬─────┘
                            │             │             │
                            ▼             ▼             ▼
                     ┌────────────┐ ┌────────────┐ ┌────────────┐
                     │Zamknij     │ │Brama       │ │Zamknij     │
                     │Wyślij SMS: │ │zostaje     │ │Wyślij SMS: │
                     │"Potwierdzo"│ │OTWARTA     │ │"Timeout"   │
                     └────────────┘ │Użytkownik  │ └────────────┘
                                    │bierze odp. │
                                    └────────────┘
```

### Przepływ 4: Akcja z harmonogramu

```
                    ┌─────────────────┐
                    │ Worker sprawdza │
                    │ tabelę schedule │
                    │ (co minutę)     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌────────────┐               ┌───────────────┐
       │ Brak meczu │               │ Czas zgadza   │
       │ (pomiń)    │               │ się z regułą  │
       └────────────┘               └───────┬───────┘
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                       ┌────────────┐             ┌────────────┐
                       │ Woda NIE   │             │ Woda JEST  │
                       │ wykryta    │             │ wykryta    │
                       └──────┬─────┘             └──────┬─────┘
                              │                          │
                              ▼                          ▼
                       ┌────────────┐             ┌────────────┐
                       │ Wykonaj    │             │ POMIŃ akcję│
                       │ zaplanowaną│             │ Bezpieczeń.│
                       │ akcję      │             │ ma priorytet│
                       └────────────┘             └────────────┘
```

---

## 🚀 Szybki Start

### Wymagania

- **Docker** (dla kontenerów)
- **Python 3.10+** z pip
- **Node.js 18+** z npm
- **VS Code** z rozszerzeniem PlatformIO (dla ESP32)

### 1. Uruchom Infrastrukturę (Docker)

```bash
cd backend-infrastructure
docker-compose up -d
```

Uruchamia:

- `floodgate_db` - TimescaleDB na porcie 5434
- `floodgate_mqtt` - Mosquitto na porcie 1883

### 2. Uruchom Backend API

```bash
cd backend-core
pip install -r requirements.txt
python run_api.py
```

API dostępne na http://localhost:8001

### 3. Uruchom MQTT Worker

```bash
cd backend-core
python worker.py
```

### 4. Uruchom Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard pod adresem http://localhost:5173

### 5. Uruchom Symulator ESP32 (Wokwi)

1. Otwórz folder `firmware/` w VS Code
2. Zainstaluj rozszerzenie **Wokwi for VS Code**
3. Naciśnij `F1` → "Wokwi: Start Simulator"

> **Uwaga:** Zaktualizuj `MQTT_SERVER` w `firmware/src/main.cpp` na adres IP hosta uruchamiającego brokera. Na Windows użyj polecenia `ipconfig`, na Linux/macOS `ip a` lub `ifconfig`.

---

## 🛠️ Stos Technologiczny

### Frontend

| Technologia    | Wersja | Przeznaczenie  |
| -------------- | ------ | -------------- |
| React          | 19.2.0 | Framework UI   |
| TypeScript     | 5.9.3  | Typowanie      |
| Vite           | 7.2.4  | Bundler        |
| TailwindCSS    | 4.1    | Stylowanie     |
| TanStack Query | 5.x    | Stan serwerowy |
| Zustand        | 4.x    | Stan klienta   |
| Framer Motion  | 11.x   | Animacje       |
| Axios          | 1.x    | Klient HTTP    |

### Backend

| Technologia | Wersja | Przeznaczenie     |
| ----------- | ------ | ----------------- |
| FastAPI     | 0.109  | REST API          |
| Python      | 3.12   | Runtime           |
| Paho MQTT   | 2.0    | Klient MQTT       |
| SQLAlchemy  | 2.x    | ORM               |
| AsyncPG     | 0.29   | Driver PostgreSQL |
| Uvicorn     | 0.27   | Serwer ASGI       |

### Infrastruktura

| Technologia | Wersja | Przeznaczenie      |
| ----------- | ------ | ------------------ |
| TimescaleDB | 2.x    | Baza Time-series   |
| PostgreSQL  | 15     | Silnik bazy danych |
| Mosquitto   | 2.x    | Broker MQTT        |
| Docker      | 24.x   | Konteneryzacja     |

### Firmware

| Technologia      | Wersja | Przeznaczenie    |
| ---------------- | ------ | ---------------- |
| ESP32-S3         | -      | Mikrokontroler   |
| Arduino          | 2.0.6  | Framework        |
| PlatformIO       | 6.x    | System budowania |
| PubSubClient     | 2.8    | Biblioteka MQTT  |
| ArduinoJson      | 6.21   | Parsowanie JSON  |
| Adafruit SSD1306 | 2.5    | Wyświetlacz OLED |

---

## 📁 Struktura Projektu

```
INZYNIERKA/
├── backend-core/           # Python API + Worker
│   ├── main.py             # Aplikacja FastAPI
│   ├── worker.py           # Most MQTT → Baza danych
│   ├── database.py         # Modele SQLAlchemy
│   └── requirements.txt
├── backend-infrastructure/ # Serwisy Docker
│   └── docker-compose.yml
├── frontend/               # Aplikacja React
│   ├── src/
│   │   ├── components/     # Komponenty UI
│   │   ├── hooks/          # Custom React hooks
│   │   ├── api/            # Klient API
│   │   └── App.tsx
│   └── package.json
├── firmware/               # Kod ESP32
│   ├── src/main.cpp        # Główny firmware
│   ├── platformio.ini      # Konfiguracja PlatformIO
│   ├── diagram.json        # Obwód Wokwi
│   └── wokwi.toml          # Konfiguracja Wokwi
├── scripts/
│   └── switch_language.py  # Przełącznik języka PL/EN
├── simulation/             # Narzędzia do testów HIL
└── README.md
```

---

## 🎮 Symulacja Wokwi

Ten projekt wykorzystuje **Wokwi** do symulacji ESP32, zintegrowanego z VS Code.

### Konfiguracja

1. Zainstaluj rozszerzenie VS Code: **Wokwi for VS Code**
2. Uzyskaj darmową licencję na https://wokwi.com/license
3. Otwórz `firmware/diagram.json`
4. Naciśnij `F1` → "Wokwi: Start Simulator"

### Komponenty Obwodu

| Komponent       | GPIO   | Funkcja                    |
| --------------- | ------ | -------------------------- |
| Czujnik wody    | GPIO4  | Wejście analogowe (0-50cm) |
| Czujnik baterii | GPIO5  | Wejście analogowe (0-100%) |
| Stepper STEP    | GPIO10 | Sterowanie silnikiem       |
| Stepper DIR     | GPIO11 | Kierunek silnika           |
| LED Czerwona    | GPIO16 | Wskaźnik zamykania         |
| LED Zielona     | GPIO17 | Wskaźnik otwierania        |
| OLED SDA        | GPIO18 | Dane wyświetlacza          |
| OLED SCL        | GPIO19 | Zegar wyświetlacza         |

### Symulacja SMS

Funkcja `sendSMS()` publikuje na topic MQTT `debug/sms` zamiast wysyłać prawdziwe SMS-y. Jest to rozwiązanie dla kompatybilności z Wokwi i testowania systemu bez sprzętu GSM.

#### Wdrażanie SMS w produkcji

Dla rzeczywistych SMS w produkcji, wymagany jest **moduł GSM SIM800L**:

1. **Sprzęt:**
   - Moduł GSM SIM800L lub SIM800H
   - Karta SIM z aktywnym planem SMS
   - Zasilacz 4.2V dedykowany dla modułu (wymaga dużego prądu)
   - Połączenia TX/RX do ESP32 (piny określone w kodzie)

2. **Implementacja:**
   - Otwórz `firmware/src/main.cpp`
   - Znajdź funkcję `sendSMS()` - zawiera szczegółowy blok komentarza z kodem produkcyjnym
   - Odkomentuj kod SIM800L i zakomentuj linie MQTT
   - W `firmware/include/Secrets.h` ustaw numer telefonu: `#define GSM_PHONE_NUMBER "+48XXXXXXXXX"`

3. **Komendy AT (tło):**
   ```
   AT+CMGF=1              # Tryb SMS tekstowy
   AT+CMGS="phone"        # Wysłanie SMS
   [treść SMS]
   Ctrl+Z (ASCII 26)      # Potwierdzenie wysłania
   ```

Kod produkcyjny zawiera pełny przykład z obsługą SoftwareSerial i poleceniami AT.

---

## 📊 Dokumentacja API

### GET /api/v1/status/{device_id}

Zwraca aktualny status urządzenia z danymi pogodowymi.

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

Wyślij manualną komendę do urządzenia.

```json
{
  "device_id": "ESP32_MAIN_001",
  "action": "DROP" // lub "RAISE"
}
```

---

## ⚠️ Ograniczenia i Decyzje Architektoniczne

Ta sekcja dokumentuje znane ograniczenia i architektoniczne wybory będące akceptowalnymi kompromisami dla zakresu tego projektu.

### 1. Frontend: HTTP Polling vs WebSockets

**Obecna Implementacja:** Dashboard React wykorzystuje **HTTP Polling** (interwał 5 sekund) do pobierania statusu urządzenia z API backendu.

**Dlaczego Polling?**

- **Uproszczona Architektura:** Unika złożoności infrastruktury WebSocket
- **Istniejące API REST:** Backend już dostarcza solidne API REST; istniejące połączenie MQTT do komunikacji z urządzeniami
- **Kompatybilność Międzyplatformowa:** HTTP polling działa konsekwentnie w różnych warunkach sieci (zapory, proxy)
- **Wystarczająca Częstotliwość:** Odświeżanie co 5 sekund jest akceptowalne dla monitorowania powodzi

**Kompromis:** Interfejs odświeża się co 5 sekund, więc akcje podjęte przez użytkownika mogą zostać odzwierciedlone z lekkim opóźnieniem.

### 2. Powiadomienia SMS: Topic MQTT (Symulacja)

**Obecna Implementacja:** Funkcja `sendSMS()` publikuje do topic MQTT `debug/sms` dla kompatybilności symulacji Wokwi.

**Ścieżka Produkcyjna:** Wymaga modułu GSM SIM800L z implementacją poleceń AT (szablon kodu dostarczone w firmware/src/main.cpp).

### 3. Sterowanie Silnikiem: Architektura Nieblokująca

**Wyzwanie Projektowe:** Inicjalna pętla blokująca `delayMicroseconds()` podczas ruchu bramy blokowała procesor, uniemożliwiając MQTT `client.loop()` z wykonywania się. Rezultatem były limity czasu połączenia i niereagujące komendy użytkownika.

**Rozwiązanie Architektoniczne:** Implementacja biblioteki AccelStepper z nieblokującą maszyną stanów. Funkcja `updateStepperMotion()` wykonuje się na każdej iteracji pętli (~2ms na krok), umożliwiając równoczesne przetwarzanie MQTT między krokami motora.

**Rezultat:** Urządzenie utrzymuje responsywną komunikację MQTT i przetwarza komendy użytkownika natychmiast podczas ruchu bramy.

### 4. Timer Fail-Safe

Odliczanie fail-safe opiera się na liczniku po stronie klienta. W systemach krytycznych mechanizm ten powinien być zdublowany po stronie urządzenia (sprzętowy watchdog lub timer), egzekwując bezpieczny stan nawet przy braku łączności.

### 5. Zarządzanie Uwierzytelnieniami

**Wybór Projektowy:** Wrażliwe uwierzytelnienia (WiFi, MQTT, GSM) przechowywane w gitignorowanym pliku `Secrets.h`, nigdy nie zatwierdzane do repozytorium.

**Bezpieczeństwo:** Każde wdrożenie urządzenia ma unikalne `Secrets.h`; uwierzytelnienia nigdy nie widnieją w historii git.

---

## 📝 Licencja

Ten projekt jest udostępniony na licencji **PolyForm Noncommercial 1.0.0** - szczegóły w pliku [LICENSE](LICENSE).

> ⚠️ **LICENCJA:**
> Ten projekt jest udostępniony na licencji **PolyForm Noncommercial 1.0.0**.
>
> - ✅ **Darmowy:** Do użytku prywatnego, edukacyjnego i hobbystycznego (Self-Hosted).
> - ❌ **Płatny/Wymaga Zgody:** Do wszelkich zastosowań komercyjnych, odsprzedaży lub wdrażania zarobkowego.
>
> W sprawach licencji komercyjnej (B2B) proszę o kontakt: adam.gajewski.art@gmail.com

> 🎓 Stworzony jako praca inżynierska.

---

<p align="center">
  Stworzone z ❤️ przy użyciu ESP32 i Python
</p>
