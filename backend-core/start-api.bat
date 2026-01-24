@echo off
cd /d "%~dp0"
echo Starting FastAPI Server...
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
pause
