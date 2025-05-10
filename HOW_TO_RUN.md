# Pomodoro App - How to Run

This document provides instructions for running your Pomodoro app locally.

## Option 1: Using Node.js (Recommended)

If you have Node.js installed:

1. Double-click on `start-server.bat`
2. A command window will open showing the server is running
3. Open your browser and navigate to `http://localhost:8080`

## Option 2: Using Python

If you don't have Node.js but have Python installed:

1. Double-click on `start-python-server.bat`
2. A command window will open showing the server is running
3. Open your browser and navigate to `http://localhost:8080`

## Option 3: Using a Simple HTTP Server

You can use any HTTP server that can serve static files from the `public` directory:

- Python's built-in server: `python -m http.server 8080 --directory public`
- PHP's built-in server: `php -S localhost:8080 -t public`
- Any other HTTP server you have available

## Troubleshooting Firebase Issues

If you're experiencing issues with Firebase saving or loading tasks:

1. Make sure you're logged in to the application
2. Use the "Full Firebase Debug" button (bottom right corner) to run diagnostics
3. Check the browser console (F12 or Ctrl+Shift+I) for error messages
4. Use the keyboard shortcut Ctrl+Shift+F to run the diagnostics as well

### Common Issues and Solutions

1. **Tasks not saving to Firebase:**
   - The app will always save to localStorage as a backup
   - Tasks will be synced to Firebase when you reconnect if you were offline
   - Check the browser console for any Firebase errors

2. **Cannot drag and drop tasks:**
   - Make sure you're dragging from the task's "handle" area
   - Try refreshing the page if drag and drop stops working

3. **Browser throttling warning:**
   - Some browsers limit background processing for inactive tabs
   - Keep the tab active when using the timer
   - Or use the app in a separate window

## About the App Architecture

- All data is saved to Firebase Firestore for cloud storage
- Local storage is used as a backup in case of connectivity issues
- The application works offline with limited functionality
- Tasks are stored directly in the user document in Firestore

If you need more help, contact the developer. 