# Pomodoro Scheduler

A productivity application that uses the Pomodoro technique to help users manage their tasks and time effectively.

## Features

- Task management with Pomodoro timing
- User authentication
- Daily and weekly task views
- Customizable work/break sessions
- Responsive design for desktop and mobile
- Drag and drop task scheduling
- Mobile-friendly touch interactions
- Firebase Firestore database synchronization
- Offline support with local storage backup

## 🆕 Recent Updates

- **Improved Firebase Integration**: Tasks are now stored directly in the user document for better reliability
- **Enhanced Error Handling**: Better error recovery and retry mechanisms for data saving
- **Debugging Tools**: Added comprehensive debugging features accessible via UI button or keyboard shortcuts
- **Touch Support**: Implemented touch-friendly drag and drop for mobile devices
- **Local Servers**: Added multiple ways to run the application without Firebase CLI
- **Auto-Installation**: New auto-install-run.bat script that helps set up the environment
- **New Landing Page**: Added attractive landing page as the entry point for new users
- **Streamlined Authentication**: Improved auth flow with automatic redirects to and from the app

## Quick Start

For the easiest setup:

1. Double-click the `test-app.bat` file to start the PowerShell server and open the app
2. You'll see the landing page first, then can sign in or sign up
3. After authentication, you'll be automatically redirected to the main app

For more detailed instructions, see the [How to Run](HOW_TO_RUN.md) guide or [User Guide](USER_GUIDE.md).

## Setup Instructions

### Prerequisites

- Node.js (v14 or later recommended) or Python 3
- Firebase account
- Modern web browser

### Installation Options

#### Option 1: Using the auto-setup script
- Run `auto-install-run.bat` to automatically install Node.js and start the server

#### Option 2: Using Node.js
- Run `start-server.bat` if you already have Node.js installed

#### Option 3: Using Python
- Run `start-python-server.bat` if you have Python installed

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google Sign-in)
3. Copy the Firebase configuration from Project Settings
4. Create/update `public/firebase-config.js` with your Firebase credentials

## Troubleshooting

If you encounter issues with the application:

1. Use the "Full Firebase Debug" button (bottom right corner) to run diagnostics
2. Check the browser console (F12) for error messages
3. Refer to the [User Guide](USER_GUIDE.md) for common solutions

## Security Note

- Never commit `firebase-config.js` with your actual API keys
- Use environment variables for production deployments

## License

[MIT License](LICENSE) 