#!/usr/bin/env python3
"""
FloodGate Language Switch Script
================================
Switches UI language between Polish (pl) and English (en) across:
- ESP32 Firmware (OLED display labels, SMS messages)
- Frontend Dashboard (React components)

Usage:
  python switch_language.py pl    # Switch to Polish (default)
  python switch_language.py en    # Switch to English
  python switch_language.py       # Show current language
"""

import sys
from pathlib import Path

# Project root (relative to this script: scripts/switch_language.py)
PROJECT_ROOT = Path(__file__).parent.parent

# =============================================================================
# TRANSLATION MAPPINGS
# =============================================================================

TRANSLATIONS = {
    # -------------------------------------------------------------------------
    # ESP32 Firmware: main.cpp
    # -------------------------------------------------------------------------
    "firmware/src/main.cpp": {
        # OLED Display labels
        '"Woda: "': {
            "pl": '"Woda: "',
            "en": '"Water: "'
        },
        '"Brama: "': {
            "pl": '"Brama: "',
            "en": '"Gate: "'
        },
        '"Bateria: "': {
            "pl": '"Bateria: "',
            "en": '"Battery: "'
        },
        '"Tryb: "': {
            "pl": '"Tryb: "',
            "en": '"Mode: "'
        },
        '"TAK"': {
            "pl": '"TAK"',
            "en": '"YES"'
        },
        '"NIE"': {
            "pl": '"NIE"',
            "en": '"NO"'
        },
        '"GORA"': {
            "pl": '"GORA"',
            "en": '"UP"'
        },
        '"DOL"': {
            "pl": '"DOL"',
            "en": '"DOWN"'
        },
        '"AUTO"': {
            "pl": '"AUTO"',
            "en": '"AUTO"'
        },
        '"MANUAL"': {
            "pl": '"MANUAL"',
            "en": '"MANUAL"'
        },
        # SMS Messages
        '"Wykryto wodę! Auto-ochrona: Brama opuszczona!"': {
            "pl": '"Wykryto wodę! Auto-ochrona: Brama opuszczona!"',
            "en": '"Water detected! Auto-protection: Gate closed!"'
        },
        '"Brama opuszczona ręcznie przez użytkownika"': {
            "pl": '"Brama opuszczona ręcznie przez użytkownika"',
            "en": '"Gate closed manually by user"'
        },
        '"Brama podniesiona ręcznie przez użytkownika"': {
            "pl": '"Brama podniesiona ręcznie przez użytkownika"',
            "en": '"Gate opened manually by user"'
        },
        '"Akcja anulowana przez użytkownika"': {
            "pl": '"Akcja anulowana przez użytkownika"',
            "en": '"Action cancelled by user"'
        },
        '"Brama opuszczona na Twoją prośbę"': {
            "pl": '"Brama opuszczona na Twoją prośbę"',
            "en": '"Gate closed at your request"'
        },
        '"Woda zniknęła - możesz podnieść bramę"': {
            "pl": '"Woda zniknęła - możesz podnieść bramę"',
            "en": '"Water cleared - you can open the gate"'
        },
        '"Woda wykryta! Brama opuszczona. BRAK POŁĄCZENIA z aplikacją!"': {
            "pl": '"Woda wykryta! Brama opuszczona. BRAK POŁĄCZENIA z aplikacją!"',
            "en": '"Water detected! Gate closed. NO CONNECTION to app!"'
        },
        '"Upłynął czas! Brama opuszczona automatycznie"': {
            "pl": '"Upłynął czas! Brama opuszczona automatycznie"',
            "en": '"Time expired! Gate closed automatically"'
        },
        '"Niski poziom baterii: "': {
            "pl": '"Niski poziom baterii: "',
            "en": '"Low battery level: "'
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: TheCore.tsx (Main gate button)
    # -------------------------------------------------------------------------
    "frontend/src/components/dashboard/TheCore.tsx": {
        ">ZABEZPIECZONA<": {
            "pl": ">ZABEZPIECZONA<",
            "en": ">SECURED<"
        },
        ">WODA!<": {
            "pl": ">WODA!<",
            "en": ">WATER!<"
        },
        ">ZAMKNIĘTA<": {
            "pl": ">ZAMKNIĘTA<",
            "en": ">CLOSED<"
        },
        ">OTWARTA<": {
            "pl": ">OTWARTA<",
            "en": ">OPEN<"
        },
        ">Dotknij by otworzyć<": {
            "pl": ">Dotknij by otworzyć<",
            "en": ">Tap to open<"
        },
        ">Dotknij by zamknąć<": {
            "pl": ">Dotknij by zamknąć<",
            "en": ">Tap to close<"
        },
        ">bramę<": {
            "pl": ">bramę<",
            "en": ">gate<"
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: StatsHUD.tsx (Status display)
    # -------------------------------------------------------------------------
    "frontend/src/components/dashboard/StatsHUD.tsx": {
        ">TRYB SYSTEMU<": {
            "pl": ">TRYB SYSTEMU<",
            "en": ">SYSTEM MODE<"
        },
        "'WODA WYKRYTA'": {
            "pl": "'WODA WYKRYTA'",
            "en": "'WATER DETECTED'"
        },
        "'SUCHO'": {
            "pl": "'SUCHO'",
            "en": "'DRY'"
        },
        ">Poziom wody:": {
            "pl": ">Poziom wody:",
            "en": ">Water level:"
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: FailSafeModal.tsx
    # -------------------------------------------------------------------------
    "frontend/src/components/shared/FailSafeModal.tsx": {
        ">FAIL-SAFE AKTYWNY<": {
            "pl": ">FAIL-SAFE AKTYWNY<",
            "en": ">FAIL-SAFE ACTIVE<"
        },
        ">Wykryto wodę - tryb KONTROLA<": {
            "pl": ">Wykryto wodę - tryb KONTROLA<",
            "en": ">Water detected - CONTROL mode<"
        },
        "Kurtyna zostanie automatycznie opuszczona za": {
            "pl": "Kurtyna zostanie automatycznie opuszczona za",
            "en": "Gate will close automatically in"
        },
        ">Anuluj<": {
            "pl": ">Anuluj<",
            "en": ">Cancel<"
        },
        ">Opuść Teraz<": {
            "pl": ">Opuść Teraz<",
            "en": ">Close Now<"
        },
        "Zaakceptowanie spowoduje natychmiastowe opuszczenie kurtyny. Anulowanie pozostawi kurtynę w górze.": {
            "pl": "Zaakceptowanie spowoduje natychmiastowe opuszczenie kurtyny. Anulowanie pozostawi kurtynę w górze.",
            "en": "Accepting will close the gate immediately. Canceling will leave it open."
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: WeatherForecast.tsx
    # -------------------------------------------------------------------------
    "frontend/src/components/dashboard/WeatherForecast.tsx": {
        ">Prognoza 12h<": {
            "pl": ">Prognoza 12h<",
            "en": ">12h Forecast<"
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: SettingsDrawer.tsx
    # -------------------------------------------------------------------------
    "frontend/src/components/views/SettingsDrawer.tsx": {
        ">Tryb pracy systemu<": {
            "pl": ">Tryb pracy systemu<",
            "en": ">System mode<"
        },
        ">Natychmiastowe zamknięcie<": {
            "pl": ">Natychmiastowe zamknięcie<",
            "en": ">Immediate closure<"
        },
        ">Wymagane potwierdzenie<": {
            "pl": ">Wymagane potwierdzenie<",
            "en": ">Confirmation required<"
        },
        "'Brama zamknie się automatycznie przy wykryciu wody.'": {
            "pl": "'Brama zamknie się automatycznie przy wykryciu wody.'",
            "en": "'Gate will close automatically when water is detected.'"
        },
        "'System poprosi o potwierdzenie przed zamknięciem bramy.'": {
            "pl": "'System poprosi o potwierdzenie przed zamknięciem bramy.'",
            "en": "'System will ask for confirmation before closing the gate.'"
        },
        ">Czas na reakcję<": {
            "pl": ">Czas na reakcję<",
            "en": ">Response time<"
        },
        ">Czas oczekiwania na potwierdzenie przed automatycznym zamknięciem bramy.<": {
            "pl": ">Czas oczekiwania na potwierdzenie przed automatycznym zamknięciem bramy.<",
            "en": ">Time to confirm before automatic gate closure.<"
        },
        ">Szukam...<": {
            "pl": ">Szukam...<",
            "en": ">Searching...<"
        },
    },

    # -------------------------------------------------------------------------
    # Frontend: App.tsx (Notifications)
    # -------------------------------------------------------------------------
    "frontend/src/App.tsx": {
        "'zamknięcie'": {
            "pl": "'zamknięcie'",
            "en": "'closing'"
        },
        "'otwarcie'": {
            "pl": "'otwarcie'",
            "en": "'opening'"
        },
        "'zamknąć'": {
            "pl": "'zamknąć'",
            "en": "'close'"
        },
        "'otworzyć'": {
            "pl": "'otworzyć'",
            "en": "'open'"
        },
        "message: `Wysłano komendę:": {
            "pl": "message: `Wysłano komendę:",
            "en": "message: `Command sent:"
        },
        "message: `Nie udało się": {
            "pl": "message: `Nie udało się",
            "en": "message: `Failed to"
        },
        "bramy`": {
            "pl": "bramy`",
            "en": "gate`"
        },
        "'ŁADOWANIE SYSTEMU FLOODGATE...'": {
            "pl": "'ŁADOWANIE SYSTEMU FLOODGATE...'",
            "en": "'LOADING FLOODGATE SYSTEM...'"
        },
    },
}


def get_current_language(file_path: Path) -> str:
    """Detect current language by checking a known marker."""
    content = file_path.read_text(encoding='utf-8')
    # Check for English marker
    if '"Water: "' in content or '>WATER DETECTED<' in content:
        return 'en'
    return 'pl'


def switch_language(target_lang: str):
    """Switch all files to the target language."""
    if target_lang not in ('pl', 'en'):
        print(f"❌ Invalid language: {target_lang}. Use 'pl' or 'en'.")
        sys.exit(1)

    source_lang = 'en' if target_lang == 'pl' else 'pl'

    print(f"🔄 Switching language to: {target_lang.upper()}")
    print(f"   (from {source_lang.upper()})")
    print("-" * 50)

    changed_files = 0

    for rel_path, translations in TRANSLATIONS.items():
        file_path = PROJECT_ROOT / rel_path

        if not file_path.exists():
            print(f"⚠️  File not found: {rel_path}")
            continue

        content = file_path.read_text(encoding='utf-8')
        original_content = content
        changes_in_file = 0

        for source_text, lang_map in translations.items():
            source = lang_map[source_lang]
            target = lang_map[target_lang]

            if source in content:
                content = content.replace(source, target)
                changes_in_file += 1

        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            print(f"✅ {rel_path} ({changes_in_file} changes)")
            changed_files += 1
        else:
            print(f"⏭️  {rel_path} (no changes needed)")

    print("-" * 50)
    print(f"✅ Done! Changed {changed_files} files to {target_lang.upper()}")
    print()
    print("⚠️  Remember to rebuild:")
    print("   - Frontend: npm run dev (auto-reloads)")
    print("   - ESP32: pio run")


def show_current_language():
    """Show current language state."""
    # Check firmware
    firmware_path = PROJECT_ROOT / "firmware/src/main.cpp"
    if firmware_path.exists():
        lang = get_current_language(firmware_path)
        print(f"🔧 ESP32 Firmware: {lang.upper()}")

    # Check frontend
    thecore_path = PROJECT_ROOT / "frontend/src/components/dashboard/TheCore.tsx"
    if thecore_path.exists():
        lang = get_current_language(thecore_path)
        print(f"🖥️  Frontend: {lang.upper()}")


def main():
    if len(sys.argv) < 2:
        print("FloodGate Language Switch")
        print("=" * 30)
        print()
        show_current_language()
        print()
        print("Usage:")
        print("  python switch_language.py pl   # Polish")
        print("  python switch_language.py en   # English")
        return

    target_lang = sys.argv[1].lower()
    switch_language(target_lang)


if __name__ == "__main__":
    main()
