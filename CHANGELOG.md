# Changelog

## Version 1.1.0 (Current)

### Major Improvements
- **Firebase Integration**: 
  - Fixed issue with tasks not saving to Firebase in deployed environments
  - Changed data structure to store tasks directly in the user document instead of a nested collection
  - Added date serialization fixes to properly handle Firestore date storage

- **Error Handling**:
  - Added comprehensive error handling for Firebase operations
  - Implemented automatic retry mechanism for failed Firebase operations
  - Enhanced validation for data objects to prevent errors from invalid dates

- **Offline Support**:
  - Improved localStorage backup for offline use
  - Added automatic reconnection and synchronization when coming back online
  - Better handling of network state changes

### New Features
- **Debugging Tools**:
  - Added "Full Firebase Debug" button for thorough diagnostics
  - Implemented keyboard shortcut (Ctrl+Shift+F) for debugging
  - Enhanced console logging for easier troubleshooting

- **Mobile Experience**:
  - Added touch-friendly drag and drop for tasks on mobile devices
  - Implemented long-press gesture for drag operations
  - Added visual drag handle for better usability

- **Local Development**:
  - Created Node.js local server script (serve.js)
  - Added Python alternative server (serve.py)
  - Created auto-installation script for Windows users (auto-install-run.bat)

### User Experience
- **Drag and Drop**:
  - Fixed issues with drag and drop functionality
  - Added visual feedback during drag operations
  - Improved drop target highlighting

- **Documentation**:
  - Added detailed USER_GUIDE.md
  - Created HOW_TO_RUN.md with multiple setup options
  - Updated README.md with latest changes

## Version 1.0.0 (Initial Release)

- Basic Pomodoro timer functionality
- Task management
- Daily and weekly calendar views
- Firebase authentication
- Responsive design 