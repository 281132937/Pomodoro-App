@echo off
echo Starting Pomodoro App with PowerShell server...
start powershell.exe -ExecutionPolicy Bypass -File simple-server.ps1
timeout /t 2 > nul
start "" "http://localhost:8000/index.html"
echo Browser should open automatically. If not, visit http://localhost:8000 