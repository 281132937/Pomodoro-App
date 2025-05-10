@echo off
echo Pomodoro App - Auto Setup Script
echo ================================

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js not found. Would you like to download and install it? (y/n)
    set /p choice="> "
    if /i "%choice%"=="y" (
        echo Downloading Node.js installer...
        powershell -Command "& {Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.18.0/node-v18.18.0-x64.msi' -OutFile 'node-installer.msi'}"
        echo Installing Node.js...
        start /wait msiexec /i node-installer.msi /quiet
        echo Node.js installed successfully!
    ) else (
        echo Node.js installation skipped.
        echo Would you like to try running with Python instead? (y/n)
        set /p pychoice="> "
        if /i "%pychoice%"=="y" (
            start start-python-server.bat
            exit
        ) else (
            echo You need either Node.js or Python to run this application.
            echo Please install one of them manually and run the appropriate start script.
            pause
            exit
        )
    )
)

REM Check if the installation was successful and then run the server
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Node.js is installed. Starting server...
    node serve.js
) else (
    echo Node.js was not installed correctly. Would you like to try Python instead? (y/n)
    set /p py2choice="> "
    if /i "%py2choice%"=="y" (
        start start-python-server.bat
    ) else (
        echo Please install Node.js or Python manually and run the appropriate start script.
    )
)

pause 