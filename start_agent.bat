@echo off
echo.
echo ============================================
echo   Asha - Doctor Appointment Voice Agent
echo   LiveKit + Google Gemini
echo ============================================
echo.
cd /d "%~dp0backend"
echo Starting Asha agent...
echo (Press Ctrl+C to stop)
echo.
python livekit_agent.py start
pause
