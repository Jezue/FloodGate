@echo off
cd /d "%~dp0"
echo Starting MQTT Worker...
python worker.py
pause
