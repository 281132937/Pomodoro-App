# Pomodoro App User Guide

This guide explains how to use the Pomodoro Timer application with all its features.

## Running the Application

1. **First-time setup**: 
   - Double-click `auto-install-run.bat` to automatically install Node.js and run the server
   - Or use one of the other options in the `HOW_TO_RUN.md` file

2. **Returning users**: 
   - Double-click `test-app.bat` for the simplest approach
   - Or double-click `start-server.bat` if you have Node.js installed
   - Or double-click `start-python-server.bat` if you have Python installed

3. **Access the application**: 
   - The browser will open automatically to the landing page
   - Sign in with your existing account or create a new one
   - After authentication, you'll be redirected to the main app

## Authentication

- **New Users**:
  - Click "Get Started" or "Sign Up" on the landing page
  - Create an account with email and password
  - Or use Google Sign-In for faster access
  
- **Returning Users**:
  - Click "Sign In" on the landing page
  - Enter your credentials
  - You'll be automatically redirected to the app

## Core Features

### Task Management

- **Adding Tasks**:
  - Fill out the task form in the sidebar with a name, due date, and duration
  - Click "Add Task" to create the task

- **Managing Tasks**:
  - Start: Begins a Pomodoro session for that task
  - Edit: Allows you to modify task details
  - Delete: Removes the task from your list

### Pomodoro Timer

- **Controls**:
  - Start: Begins the Pomodoro timer
  - Pause: Temporarily stops the timer
  - Reset: Returns the timer to its initial state

- **Sessions**:
  - The app automatically tracks which Pomodoro session you're on
  - After each 25-minute session, you'll get a 5-minute break
  - Every 4 sessions, you'll get a longer 15-minute break

### Calendar & Scheduling

- **Views**:
  - Daily: Shows tasks scheduled for the current day
  - Weekly: Shows your entire week's schedule
  
- **Task Scheduling**:
  - Drag and drop tasks to reschedule them
  - On mobile, long-press a task to enter drag mode
  - Click the + button in an hour slot to add a new task

## Troubleshooting

### Firebase Issues

If you're experiencing issues with data not saving to Firebase:

1. **Use debugging tools**:
   - Click the "Full Firebase Debug" button in the bottom right
   - Use the keyboard shortcut Ctrl+Shift+F for the same function
   
2. **Check the browser console**:
   - Press F12 or Ctrl+Shift+I to open developer tools
   - Look for any error messages in the Console tab

3. **Offline Mode**:
   - The app works offline and saves to localStorage
   - When you're back online, it will sync with Firebase

### Performance Issues

- If the app feels slow or unresponsive, try these steps:
  1. Make sure you're using a modern browser
  2. Close other browser tabs
  3. Keep the app tab active when using the timer
  4. If you see browser throttling warnings, keep the app in its own window

## Additional Features

- **Dark/Light Theme**: Toggle the moon icon to switch themes
- **Mobile View**: The app is fully responsive for mobile devices
- **Keyboard Shortcuts**:
  - Ctrl+Shift+F: Run full Firebase diagnostics
  - Ctrl+Shift+D: Show debug panel

## Data Storage

- Tasks are stored in Firebase Firestore and synchronized across devices
- Local storage is used as a backup in case of connectivity issues
- Your data is associated with your Firebase account

For more technical details, please refer to the README.md file. 