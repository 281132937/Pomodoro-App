# Pomodoro App Setup Guide

This guide will help you get the Pomodoro app running on your computer.

## Problem: App Not Loading

If you're seeing a blank page or the app isn't loading, it's likely because:

1. You're trying to open the HTML files directly (without a server)
2. The required server software (Node.js or Python) isn't installed
3. The server isn't running correctly

## Solution: Run a Local Server

The app requires a local server to function properly due to Firebase security restrictions. We've provided several ways to run a server:

### Option 1: PowerShell Server (Recommended for Windows)

This option works without installing any additional software:

1. Go to the main app folder where you extracted the files
2. Double-click on `start-powershell-server.bat`
3. A command window will open showing the server is running
4. Open your browser and navigate to http://localhost:8080

If this doesn't work, you might need to enable running PowerShell scripts:
- Open PowerShell as Administrator
- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Type "Y" to confirm

### Option 2: Install Node.js

If the PowerShell server doesn't work:

1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. After installation, return to the app folder
3. Double-click on `start-server.bat`
4. Open your browser and navigate to http://localhost:8080

### Option 3: Install Python

As another alternative:

1. Download and install Python from [python.org/downloads](https://www.python.org/downloads/)
2. During installation, make sure to check "Add Python to PATH"
3. After installation, return to the app folder
4. Double-click on `start-python-server.bat`
5. Open your browser and navigate to http://localhost:8080

## Firebase Configuration

Make sure your `firebase-config.js` file exists in the public folder and has the correct Firebase credentials:

1. Check that `public/firebase-config.js` exists
2. If it doesn't exist, create it by copying `firebase-config.example.js` and updating with your Firebase details

## Troubleshooting

1. **"The system cannot find the path specified"**: Make sure you're running the scripts from the main app folder.

2. **"'node' is not recognized as an internal or external command"**: Node.js is not installed or not in your PATH. Install Node.js from [nodejs.org](https://nodejs.org/).

3. **"'python' is not recognized as an internal or external command"**: Python is not installed or not in your PATH. Install Python from [python.org](https://www.python.org/downloads/).

4. **PowerShell execution policy error**: Run PowerShell as administrator and execute:
   ```
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

5. **Firebase errors in console**: Check that your Firebase project is set up correctly and the `firebase-config.js` file has the correct credentials.

## Still Having Problems?

If you're still having issues after trying these solutions, please:

1. Check the browser console (F12) for error messages
2. Make sure your Firebase project is properly configured
3. Try a different browser
4. Make sure your firewall isn't blocking the local server 