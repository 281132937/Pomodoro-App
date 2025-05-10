@echo off
echo Starting Pomodoro App Server using Python...
python serve.py
if %ERRORLEVEL% NEQ 0 (
    echo Python error! Make sure Python is installed.
    echo Try installing Python from: https://www.python.org/downloads/
    echo Or use start-server.bat if you have Node.js installed.
    pause
) 