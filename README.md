# Pomodoro Scheduler

A productivity application that uses the Pomodoro technique to help users manage their tasks and time effectively.

## Features

- Task management with Pomodoro timing
- User authentication
- Daily and weekly task views
- Customizable work/break sessions
- Responsive design for desktop and mobile

## Setup Instructions

### Prerequisites

- Node.js (v14 or later recommended)
- Firebase account

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/pomodoro-scheduler.git
   cd pomodoro-scheduler
   ```

2. Firebase Setup:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password and Google Sign-in)
   - Copy the Firebase configuration from Project Settings
   - Create a file `public/firebase-config.js` based on the example file:
     ```
     cp public/firebase-config.example.js public/firebase-config.js
     ```
   - Update `public/firebase-config.js` with your Firebase credentials

3. Local Development:
   - Install Firebase CLI:
     ```
     npm install -g firebase-tools
     ```
   - Login to Firebase:
     ```
     firebase login
     ```
   - Initialize Firebase project:
     ```
     firebase init
     ```
   - Start local development server:
     ```
     firebase serve
     ```

4. Deployment:
   ```
   firebase deploy
   ```

## Security Note

- Never commit `firebase-config.js` with your actual API keys
- Use environment variables for production deployments

## License

[MIT License](LICENSE) 