# Pomodoro Timer Web App

A modern, responsive Pomodoro timer web application to boost productivity with task management, calendar view, and focus music integration.

## 🚀 Features

- **Pomodoro Timer**: 25-minute work sessions with 5-minute breaks
- **Task Management**: Create, edit, and delete tasks with due dates
- **Calendar View**: Daily and weekly calendar views with drag-and-drop rescheduling
- **Focus Music**: Integrated Spotify playlist selection for background music
- **Dark/Light Mode**: Toggle between dark (default) and light themes
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Local Storage**: Saves your tasks and timer state between sessions
- **Firebase Integration**: Optional cloud sync of tasks across devices (requires setup)

## 🖥️ Screenshots

- Modern UI with dark theme as default
- Responsive calendar views for organizing tasks
- Task management with icon-based controls
- Integrated Spotify playlists for focus music

## 🛠️ Setup & Installation

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/pomodoro-clean.git
   cd pomodoro-clean
   ```

2. **Launch the app locally**

   Using Node.js HTTP server:
   ```
   cd public
   node -e "require('http').createServer((req, res) => { const fs = require('fs'); const path = require('path'); const filePath = req.url === '/' ? '/app.html' : req.url; const extname = String(path.extname(filePath)).toLowerCase(); const mimeTypes = {'html':'text/html', 'js':'text/javascript', 'css':'text/css', 'ico':'image/x-icon', 'svg':'image/svg+xml'}; const contentType = mimeTypes[extname.substring(1)] || 'text/plain'; try { const content = fs.readFileSync(__dirname + filePath); res.writeHead(200, {'Content-Type': contentType}); res.end(content, 'utf-8'); } catch(e) { res.writeHead(404); res.end('File not found: ' + filePath); console.error(e); } }).listen(8098, () => console.log('Server running at http://localhost:8098/'));"
   ```

   Or use any other local server of your choice that can serve static files.

3. **Open the app in your browser**
   - Navigate to: `http://localhost:8098/`

## 🌐 Firebase Setup (Optional)

For cloud sync functionality:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com/)
2. Enable Authentication and Firestore services
3. Create a `firebase-config.js` file in the public directory with your Firebase configuration
4. Format it like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   
   // Initialize Firebase
   firebase.initializeApp(firebaseConfig);
   ```

## 📱 Mobile View Features

- Responsive design adapts to different screen sizes
- Mobile-optimized UI elements with better touch targets
- Slide-out sidebar for navigation and task management
- Task options menu optimized for touch interactions
- Edit mode with visual indicators and smooth transitions
- Improved task editing with automatic sidebar activation
- Enhanced visual feedback when editing tasks from calendar view

## 🧩 Key Components

- `app.html`: Main application page
- `js/app.js`: Core application logic and functionality
- `css/style.css`: Styling including dark mode theme
- `login.html` & `landing.html`: Authentication and landing pages

## ✨ Recent Improvements

- Dark mode set as default theme
- Improved mobile view layout and usability
- Enhanced calendar navigation with better visual styling
- Task options menu with improved mobile interaction
- Spotify integration with theme-aware embedding
- Fixed mobile task editing in calendar view
- Added visual cues and animations for better user experience
- Improved form highlighting when editing tasks
- Added "Edit Task Here" indicator for better mobile UX
- Enhanced task option menus with mobile-optimized positioning

## 🤝 Contributing

Contributions are welcome! Feel free to submit pull requests or open issues for bugs and feature requests.

## 📄 License

[MIT License](LICENSE) 