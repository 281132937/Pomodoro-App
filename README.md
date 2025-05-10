# Pomodoro Scheduler

A modern, full-featured productivity app that uses the Pomodoro technique to help you manage your time, tasks, and focus. Built for the web with Firebase integration, responsive design, and a beautiful user experience.

---

## Table of Contents
- [Features](#features)
- [Live Demo](#live-demo)
- [Screenshots](#screenshots)
- [File Structure](#file-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Firebase Configuration](#firebase-configuration)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
- [Security & Best Practices](#security--best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features
- **Pomodoro Timer**: 25-minute focus sessions with automatic short and long breaks
- **Task Management**: Add, edit, delete, and schedule tasks with durations
- **Daily & Weekly Calendar**: Visualize your tasks by hour or week, drag-and-drop to reschedule
- **User Authentication**: Email/password and Google sign-in
- **Cloud Sync**: Tasks are stored in Firebase Firestore and sync across devices
- **Offline Support**: Works offline with localStorage backup
- **Responsive Design**: Mobile-friendly, touch-optimized, and desktop-ready
- **Theme Toggle**: Light and dark mode with persistent preference
- **Custom 404 Page**: Friendly error page for missing routes

---

## Live Demo
Deploy to your own Firebase project or run locally for testing.

---

## Screenshots
*Add screenshots here if desired*

---

## File Structure
```
public/
  app.html           # Main app UI
  landing.html       # Landing page (default entry)
  login.html         # Authentication page
  404.html           # Custom error page
  firebase-config.js # Your Firebase credentials (DO NOT COMMIT REAL KEYS)
  js/
    app.js           # Main app logic
    auth.js          # Authentication logic
  css/
    style.css        # Main app styles
    landing.css      # Landing page styles
    login.css        # Login/signup styles
firebase.json        # Firebase Hosting config
firestore.rules      # Firestore security rules
firestore.indexes.json # Firestore indexes
.gitignore           # Ignore sensitive/dev files
```

---

## Prerequisites
- [Node.js](https://nodejs.org/) (for local testing, not required for Firebase Hosting)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- A [Firebase project](https://console.firebase.google.com/)
- Modern web browser (Chrome, Firefox, Edge, Safari)

---

## Setup & Installation
1. **Clone the repository**
   ```sh
   git clone <your-repo-url>
   cd <project-directory>
   ```
2. **Install Firebase CLI** (if not already installed)
   ```sh
   npm install -g firebase-tools
   ```
3. **Login to Firebase**
   ```sh
   firebase login
   ```
4. **Initialize Firebase in your project**
   ```sh
   firebase init
   # Choose Hosting and Firestore, set 'public' as the public directory
   ```
5. **Configure Firebase credentials**
   - Go to your Firebase Console > Project Settings > General > Your apps
   - Copy your web app config and paste it into `public/firebase-config.js`
   - **Never commit your real API keys to public repos!**

---

## Firebase Configuration
- `public/firebase-config.js` must contain your Firebase project credentials:
  ```js
  const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
    measurementId: "..."
  };
  firebase.initializeApp(firebaseConfig);
  if (firebase.analytics) { firebase.analytics(); }
  ```
- This file is **.gitignored** for security. Use a template or environment variables for production.

---

## Deployment
1. **Build and deploy to Firebase Hosting**
   ```sh
   firebase deploy
   ```
2. **Your app will be live at** `https://<your-project-id>.web.app` or `firebaseapp.com`
3. **Routing** is handled by `firebase.json`:
   - `/` → `landing.html`
   - `/app` → `app.html`
   - `/login` → `login.html`
   - All other routes → `landing.html`

---

## Usage Guide
### Landing Page
- Welcome screen with feature highlights and call-to-action
- Sign in or sign up to access your tasks

### Authentication
- Email/password and Google sign-in supported
- Secure authentication via Firebase Auth
- Redirects to main app after login

### Main App (`app.html`)
- **Sidebar**: Add new tasks (name, due date, duration)
- **Task List**: View, start, edit, or delete tasks
- **Timer**: Pomodoro timer with start, pause, reset, and session tracking
- **Calendar**: Switch between daily and weekly views, drag-and-drop to reschedule
- **Theme Toggle**: Switch between light and dark mode
- **Mobile Support**: Responsive layout, touch drag-and-drop, mobile menu

### Calendar & Scheduling
- **Daily View**: See tasks by hour, add tasks to specific times
- **Weekly View**: Visualize your week, drag tasks between days/hours
- **Drag-and-Drop**: Move tasks and sessions with mouse or touch

### Data Storage
- **Cloud Sync**: All tasks are stored in Firestore under your user document
- **Offline Support**: Tasks are backed up in localStorage and sync when online

### Error Handling
- Custom 404 page for missing routes
- Friendly error messages for auth and data issues

---

## Security & Best Practices
- **Never commit `firebase-config.js` with real API keys**
- Use environment variables or CI/CD secrets for production
- Firestore rules restrict access to authenticated users' own data:
  ```
  match /users/{userId}/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```
- All sensitive files are listed in `.gitignore`

---

## Troubleshooting
- **Auth Issues**: Make sure Firebase Auth is enabled (Email/Password, Google)
- **Data Not Syncing**: Check Firestore rules and your network connection
- **App Not Loading**: Check browser console for errors, verify Firebase config
- **Offline Mode**: App works offline, but syncs when back online
- **404 Errors**: Custom 404 page is shown for unknown routes

---

## Contributing
Pull requests and issues are welcome! Please:
- Open an issue for bugs or feature requests
- Fork and submit a PR for improvements
- Follow code style and security best practices

---

## License
[MIT License](LICENSE) 