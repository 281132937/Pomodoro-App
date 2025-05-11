// Constants
const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const WORKING_HOURS = {
    start: 8, // 8 AM
    end: 20   // 8 PM (12-hour working day)
};
// Current view state
let currentView = 'daily';
let selectedDate = new Date(); // For daily view
let selectedWeekStart = new Date(); // For weekly view
selectedWeekStart.setDate(selectedWeekStart.getDate() - selectedWeekStart.getDay()); // Set to Sunday
selectedWeekStart.setHours(0, 0, 0, 0);

// Firebase References
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// State
let tasks = []; // Will be loaded from Firestore or localStorage
let currentTask = null;
let timer = null;
let timeLeft = POMODORO_DURATION;
let isBreak = false;
let currentSession = 1;
let totalSessions = 4;

// DOM Elements
const taskForm = document.getElementById('task-form');
const tasksContainer = document.getElementById('tasks-container');
const calendar = document.getElementById('calendar');
const minutesDisplay = document.getElementById('minutes');
const secondsDisplay = document.getElementById('seconds');
const startTimerBtn = document.getElementById('start-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const skipTimerBtn = document.getElementById('skip-timer');
const currentTaskName = document.getElementById('current-task-name');
const currentSessionDisplay = document.getElementById('current-session');
const totalSessionsDisplay = document.getElementById('total-sessions');
const themeSwitch = document.getElementById('theme-switch');
const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
const viewToggleButtons = document.querySelectorAll('.view-toggle button');
const progressSteps = document.querySelectorAll('.progress-step');
const progressCompletedLabel = document.querySelector('.progress-labels span:first-child');
const progressRemainingLabel = document.querySelector('.progress-labels span:last-child');

// Add event listeners for page visibility changes to save/restore timer state
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Page is hidden (user switched tabs or navigated away)
        saveTimerState();
    } else {
        // Page is visible again
        restoreTimerState();
    }
});

// Save state when page is unloaded or navigated away from
window.addEventListener('beforeunload', saveTimerState);
window.addEventListener('pagehide', saveTimerState);

// Save timer state in sessionStorage as well for cross-page persistence
function saveTimerState() {
    // Save timer state regardless of whether timer is active
    const timerState = {
        timeLeft: timeLeft,
        isBreak: isBreak,
        currentSession: currentSession,
        totalSessions: totalSessions,
        isActive: timer !== null,
        currentTaskId: currentTask ? currentTask.id : null,
        timestamp: Date.now(),
        startTimeBtn: startTimerBtn ? startTimerBtn.innerHTML : null,
        startBtnClass: startTimerBtn ? (startTimerBtn.classList.contains('pause-btn') ? 'pause-btn' : 'start-btn') : null
    };
    
    // Save to both localStorage (for longer persistence) and sessionStorage (for immediate tab navigation)
    localStorage.setItem('timerState', JSON.stringify(timerState));
    sessionStorage.setItem('timerState', JSON.stringify(timerState));
    console.log('Timer state saved:', timerState);
}

// Restore timer state function - check both sessionStorage (priority) and localStorage
function restoreTimerState() {
    // First try sessionStorage for most recent state (tab navigation)
    const sessionState = sessionStorage.getItem('timerState');
    // Fallback to localStorage
    const localState = localStorage.getItem('timerState');
    
    // Use the most recent state available
    const savedState = sessionState || localState;
    if (!savedState) return;
    
    try {
        const timerState = JSON.parse(savedState);
        console.log('Found saved timer state:', timerState);
        
        // Check if saved state is recent (within last 30 minutes)
        const stateAge = Date.now() - (timerState.timestamp || 0);
        if (stateAge > 30 * 60 * 1000) {
            console.log('Saved timer state is too old (> 30 minutes), ignoring');
            localStorage.removeItem('timerState');
            sessionStorage.removeItem('timerState');
            return;
        }
        
        // Calculate time passed since last save
        let timeAdjustment = 0;
        if (timerState.isActive) {
            // Calculate how many seconds passed since the state was saved
            timeAdjustment = Math.floor(stateAge / 1000);
            console.log(`Timer was active, adjusting time by ${timeAdjustment} seconds`);
        }
        
        // Restore task first if there was one
        if (timerState.currentTaskId) {
            const task = tasks.find(t => t.id === timerState.currentTaskId);
            if (task) {
                currentTask = task;
                currentTaskName.textContent = task.name;
            }
        }
        
        // Restore timer values with time adjustment if the timer was active
        if (timerState.isActive) {
            // Adjust timeLeft to account for elapsed time
            timeLeft = Math.max(0, timerState.timeLeft - timeAdjustment);
            
            // If timer reached zero during inactivity, handle session completion
            if (timeLeft <= 0) {
                // If we were in a break, move to next session
                if (timerState.isBreak) {
                    isBreak = false;
                    timeLeft = POMODORO_DURATION;
                    currentSession = timerState.currentSession + 1;
                } else {
                    // If we were in a work session, move to break
                    isBreak = true;
                    timeLeft = BREAK_DURATION;
                    // currentSession stays the same
                }
            } else {
                // Normal case - timer was running and still has time left
                isBreak = timerState.isBreak || false;
                currentSession = timerState.currentSession || 1;
            }
        } else {
            // Timer was not active, just restore the state as-is
            timeLeft = timerState.timeLeft || POMODORO_DURATION;
            isBreak = timerState.isBreak || false;
            currentSession = timerState.currentSession || 1;
        }
        
        totalSessions = timerState.totalSessions || 4;
        
        // Update display
        currentSessionDisplay.textContent = currentSession;
        totalSessionsDisplay.textContent = totalSessions;
        updateTimerDisplay();
        updateProgressBar();
        
        // Restore button state
        if (startTimerBtn) {
            if (timerState.startBtnClass === 'pause-btn') {
                startTimerBtn.classList.remove('start-btn');
                startTimerBtn.classList.add('pause-btn');
                startTimerBtn.innerHTML = '<span class="icon">❚❚</span> Pause';
                
                // Setup event listener for pause
                startTimerBtn.removeEventListener('click', startTimer);
                startTimerBtn.addEventListener('click', pauseTimer);
            } else {
                startTimerBtn.classList.remove('pause-btn');
                startTimerBtn.classList.add('start-btn');
                startTimerBtn.innerHTML = '<span class="icon">▶</span> Start';
                
                // Setup event listener for start
                startTimerBtn.removeEventListener('click', pauseTimer);
                startTimerBtn.addEventListener('click', startTimer);
            }
        }
        
        // Restart timer if it was active
        if (timerState.isActive) {
            startTimer();
        }
        
        console.log('Timer state restored');
    } catch (error) {
        console.error('Error restoring timer state:', error);
    }
}

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.querySelector('.sidebar');

mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !mobileMenuToggle.contains(e.target) && 
        sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('active');
    }
});

// Prevent body scroll when sidebar is open on mobile
function toggleBodyScroll(disable) {
    document.body.style.overflow = disable ? 'hidden' : '';
}

sidebar.addEventListener('transitionend', () => {
    if (window.innerWidth <= 768) {
        toggleBodyScroll(sidebar.classList.contains('active'));
    }
});

// Theme handling (simplified - no toggles)
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.dataset.theme = savedTheme;
} else {
    // Default to dark theme if not set
    document.body.dataset.theme = 'dark';
    localStorage.setItem('theme', 'dark');
}

// Time conversion helpers
function localToUTC(localDate) {
    if (!localDate) return new Date();
    
    // Create a new Date object to avoid modifying the original
    const d = new Date(localDate.getTime());
    console.log(`🔥 TIME CONVERSION: Converting ${localDate.toLocaleString()} (local) → ${d.toISOString()} (UTC)`);
    return d;
}

function utcToLocal(utcDate) {
    if (!utcDate) return new Date();
    
    // Create a new Date object to avoid modifying the original
    const d = new Date(utcDate.getTime());
    console.log(`🔥 TIME CONVERSION: Converting ${utcDate instanceof Date ? utcDate.toISOString() : 'invalid date'} (UTC) → ${d.toLocaleString()} (local)`);
    return d;
}

// Task Management
class Task {
    constructor(name, localDueDate, duration) {
        this.id = Date.now().toString();
        this.name = name;
        
        // Ensure localDueDate is a Date object
        const localDate = localDueDate instanceof Date ? localDueDate : new Date(localDueDate);
        console.log(`🔥 TASK CREATION: Creating task with local date: ${localDate.toLocaleString()}`);
        
        // Convert local due date to UTC for storage
        // Store as is - we'll handle timezone conversion during display
        this.dueDate = localDate;
        
        this.duration = duration;
        this.completedSessions = 0;
        this.totalSessions = Math.ceil(duration * 4); // Convert hours to pomodoro sessions
        this.sessions = this.generateSessions(localDate); // Pass local date for correct scheduling
    }

    generateSessions(localStartDate) {
        const sessions = [];
        // Ensure we're working with a proper Date object
        let currentLocalTime = localStartDate instanceof Date ? new Date(localStartDate) : new Date();
        console.log(`🔥 TASK SESSIONS: Generating sessions starting at local time: ${currentLocalTime.toLocaleString()}`);

        // Generate sessions in local time
        for (let i = 0; i < this.totalSessions; i++) {
            const localStartTime = new Date(currentLocalTime.getTime());
            const localEndTime = new Date(currentLocalTime.getTime() + POMODORO_DURATION * 1000);
            
            // Store times as they are - we'll handle timezone display elsewhere
            const session = {
                id: `session-${i}-${Date.now()}`,
                startTime: localStartTime,
                endTime: localEndTime,
                isBreak: false,
                completed: false
            };
            sessions.push(session);

            // Next session starts after pomodoro + break (still in local time)
            currentLocalTime.setTime(currentLocalTime.getTime() + (POMODORO_DURATION + BREAK_DURATION) * 1000);
        }
        
        console.log(`🔥 TASK SESSIONS: Generated ${sessions.length} sessions`);
        return sessions;
    }
}

// Task Form Handler
function addTaskHandler(e) {
    e.preventDefault();
    const name = document.getElementById('task-name').value;
    const dueDateInput = document.getElementById('task-due-date');
    const dueDateValue = dueDateInput.value;
    const duration = parseFloat(document.getElementById('task-duration').value);

    // Get the exact local time if available from calendar selection
    const exactLocalTimeStr = dueDateInput.dataset.exactLocalTime;
    
    let localDueDate;
    
    if (exactLocalTimeStr) {
        // If we have an exact local time from calendar selection, use it
        localDueDate = new Date(parseInt(exactLocalTimeStr));
        console.log(`Using exact local time from calendar: ${localDueDate.toLocaleString()}`);
    } 
    else if (dueDateValue) {
        // Otherwise parse the input as local time
        const [datePart, timePart] = dueDateValue.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        localDueDate = new Date(year, month - 1, day, hour, minute, 0, 0);
        console.log(`Using parsed local time from input: ${localDueDate.toLocaleString()}`);
    } else {
        localDueDate = new Date();
        console.log(`Using current local time: ${localDueDate.toLocaleString()}`);
    }

    // Ensure we're working with the correct local hour
    console.log(`Local due date hour: ${localDueDate.getHours()}`);
    
    // Prevent scheduling tasks in the past
    const now = new Date();
    if (localDueDate < now) {
        showNotification('You cannot schedule a task in the past.');
        return;
    }

    // Check if adding this task would exceed 2 sessions in the selected hour (all in local time)
    const hour = localDueDate.getHours();
    const dateStr = localDueDate.toDateString();
    let sessionCount = 0;
    
    tasks.forEach(task => {
        if (!task.sessions) return;
        task.sessions.forEach(session => {
            // Convert UTC time to local for comparison
            const localSessionDate = session.startTime instanceof Date ? 
                utcToLocal(session.startTime) : utcToLocal(new Date(session.startTime));
            
            if (localSessionDate.toDateString() === dateStr && 
                localSessionDate.getHours() === hour) {
                sessionCount++;
            }
        });
    });
    
    if (sessionCount >= 2) {
        showNotification('Maximum 2 Pomodoro blocks allowed per hour.');
        return;
    }

    // Create the task - it will convert to UTC internally
    console.log(`Creating new task "${name}" at local time: ${localDueDate.toLocaleString()}`);
    const task = new Task(name, localDueDate, duration);
    
    // Verify the times
    if (task.sessions && task.sessions.length > 0) {
        const firstSession = task.sessions[0];
        const localSessionTime = utcToLocal(firstSession.startTime);
        console.log(`First session UTC time: ${firstSession.startTime.toISOString()}`);
        console.log(`First session local time: ${localSessionTime.toLocaleString()} (hour ${localSessionTime.getHours()})`);
    }
    
    tasks.push(task);
    
    // Explicitly save to Firestore with confirmation
    console.log('🔥 EXPLICIT SAVE: Saving new task to Firestore...');
    
    // Save to localStorage first as backup
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
    
    // Then save to Firestore - make this async but don't wait
    if (currentUser) {
        saveTasks()
            .then(() => {
                console.log('🔥 TASK ADDED: Task saved successfully to Firestore');
            })
            .catch(error => {
                console.error('🔥 TASK ADDED ERROR: Failed to save to Firestore:', error);
                // Try again after a short delay
                setTimeout(() => saveTasks(), 2000);
            });
    } else {
        console.warn('🔥 EXPLICIT SAVE: User not logged in, skipping Firestore save');
    }
    
    renderTasks();
    renderCalendar();
    
    // Clear the stored data
    dueDateInput.removeAttribute('data-exact-local-time');
    
    taskForm.reset();
    
    showNotification('Task added successfully!');
}

taskForm.addEventListener('submit', addTaskHandler);

// Check authentication state
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('User is logged in:', user.email);
        currentUser = user;
        
        // Always perform an immediate synchronization on login
        initialSynchronization().then(() => {
            // After initial sync, start the real-time listener
            loadTasks(); 
            
            // Restore timer state if available
            restoreTimerState();
        });
    } else {
        console.log('No user logged in, redirecting to login page');
        currentUser = null;
        
        // Helper function for redirects
        function redirectToLogin() {
            // For Firebase hosting
            if (window.location.hostname.includes('firebaseapp.com') || 
                window.location.hostname.includes('web.app')) {
                window.location.href = '/login';
            } else {
                // For local testing
                window.location.href = 'login.html';
            }
        }
        
        // Redirect to login page if not on a local file system
        if (window.location.protocol !== 'file:') {
            redirectToLogin();
        } else {
            // For local testing, use localStorage
            console.log('Running locally, using localStorage instead of redirecting');
            tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            renderTasks();
            renderCalendar();
            
            // Restore timer state even when using localStorage
            restoreTimerState();
        }
    }
});

// Add a reliable initial synchronization function
async function initialSynchronization() {
    console.log('🔄 INITIAL SYNC: Performing initial data synchronization...');
    
    if (!currentUser) {
        console.error('🔄 INITIAL SYNC ERROR: No user logged in');
        return;
    }
    
    try {
        // First, get the current Firestore data
        const doc = await db.collection('users').doc(currentUser.uid).get();
        
        // Check if we have existing localStorage data
        const localTasksStr = localStorage.getItem('tasks');
        const localTasks = localTasksStr ? JSON.parse(localTasksStr) : [];
        console.log(`🔄 INITIAL SYNC: Found ${localTasks.length} tasks in localStorage`);
        
        // If we have Firestore data, that takes precedence
        if (doc.exists && doc.data().tasks && Array.isArray(doc.data().tasks)) {
            const firestoreTasks = doc.data().tasks;
            console.log(`🔄 INITIAL SYNC: Found ${firestoreTasks.length} tasks in Firestore`);
            
            // Process the tasks from Firestore
            const processedTasks = firestoreTasks.map(task => {
                try {
                    const newTask = { ...task };
                    
                    // Convert dates
                    if (typeof task.dueDate === 'number') {
                        newTask.dueDate = new Date(task.dueDate);
                    } else if (typeof task.dueDate === 'string') {
                        newTask.dueDate = new Date(Number(task.dueDate));
                    } else {
                        newTask.dueDate = new Date();
                    }
                    
                    // Process sessions
                    if (!task.sessions || !Array.isArray(task.sessions)) {
                        newTask.sessions = [];
                    } else {
                        newTask.sessions = task.sessions.map(session => {
                            try {
                                const newSession = { ...session };
                                
                                // Process startTime
                                if (typeof session.startTime === 'number') {
                                    newSession.startTime = new Date(session.startTime);
                                } else if (typeof session.startTime === 'string') {
                                    newSession.startTime = new Date(Number(session.startTime));
                                } else {
                                    newSession.startTime = new Date();
                                }
                                
                                // Process endTime
                                if (typeof session.endTime === 'number') {
                                    newSession.endTime = new Date(session.endTime);
                                } else if (typeof session.endTime === 'string') {
                                    newSession.endTime = new Date(Number(session.endTime));
                                } else {
                                    const startTime = newSession.startTime || new Date();
                                    newSession.endTime = new Date(startTime.getTime() + POMODORO_DURATION * 1000);
                                }
                                
                                return newSession;
                            } catch (e) {
                                console.error('🔄 INITIAL SYNC ERROR: Failed to process session:', e);
                                const now = new Date();
                                return {
                                    id: 'recovery-session-' + Date.now(),
                                    startTime: now,
                                    endTime: new Date(now.getTime() + POMODORO_DURATION * 1000),
                                    isBreak: false,
                                    completed: false
                                };
                            }
                        });
                    }
                    
                    return newTask;
                } catch (e) {
                    console.error('🔄 INITIAL SYNC ERROR: Failed to process task:', e);
                    return null;
                }
            }).filter(Boolean);
            
            // Use the Firestore data
            tasks = processedTasks;
            
            // Update localStorage with the latest data
            localStorage.setItem('tasks', JSON.stringify(tasks));
            console.log('🔄 INITIAL SYNC: Updated localStorage with Firestore data');
            
            // Render the UI
            renderTasks();
            renderCalendar();
            
            console.log('🔄 INITIAL SYNC: Complete - using Firestore data');
        } 
        // If no Firestore data but localStorage has data, push to Firestore
        else if (localTasks.length > 0) {
            console.log('🔄 INITIAL SYNC: No Firestore data found, but localStorage has data');
            
            // Parse the localStorage tasks
            tasks = localTasks.map(task => {
                try {
                    // Process the task data
                    if (typeof task.dueDate === 'number' || typeof task.dueDate === 'string') {
                        task.dueDate = new Date(Number(task.dueDate));
                    }
                    
                    if (task.sessions) {
                        task.sessions = task.sessions.map(session => {
                            if (typeof session.startTime === 'number' || typeof session.startTime === 'string') {
                                session.startTime = new Date(Number(session.startTime));
                            }
                            if (typeof session.endTime === 'number' || typeof session.endTime === 'string') {
                                session.endTime = new Date(Number(session.endTime));
                            }
                            return session;
                        });
                    }
                    
                    return task;
                } catch (e) {
                    console.error('🔄 INITIAL SYNC ERROR: Failed to process localStorage task:', e);
                    return null;
                }
            }).filter(Boolean);
            
            // Save localStorage data to Firestore
            console.log('🔄 INITIAL SYNC: Pushing localStorage data to Firestore...');
            await saveTasks();
            
            // Render the UI
            renderTasks();
            renderCalendar();
            
            console.log('🔄 INITIAL SYNC: Complete - pushed localStorage data to Firestore');
        }
        // No data in either location
        else {
            console.log('🔄 INITIAL SYNC: No tasks found in either Firestore or localStorage');
            tasks = [];
            renderTasks();
            renderCalendar();
        }
    } catch (error) {
        console.error('🔄 INITIAL SYNC ERROR:', error);
        
        // Fallback to localStorage in case of error
        const localTasksStr = localStorage.getItem('tasks');
        if (localTasksStr) {
            try {
                const localTasks = JSON.parse(localTasksStr);
                tasks = localTasks;
                console.log('🔄 INITIAL SYNC: Falling back to localStorage data due to error');
                renderTasks();
                renderCalendar();
            } catch (e) {
                console.error('🔄 INITIAL SYNC ERROR: Failed to parse localStorage data:', e);
                tasks = [];
                renderTasks();
                renderCalendar();
            }
        }
    }
}

// Handle logout
document.addEventListener('DOMContentLoaded', () => {
    // Set up automatic save verification
    if (currentUser) {
        console.log('🔄 AUTO SYNC: Setting up automatic synchronization...');
        
        // Check for unsaved changes periodically and save if needed
        setInterval(() => {
            if (currentUser) {
                console.log('🔄 AUTO SYNC: Performing automatic verification...');
                
                // Force a save operation to ensure data is persisted
                saveTasks();
                
                // Verify data was saved correctly
                setTimeout(() => {
                    db.collection('users').doc(currentUser.uid).get()
                        .then(doc => {
                            if (doc.exists && doc.data().tasks) {
                                console.log('🔄 AUTO SYNC: Verification successful -', doc.data().tasks.length, 'tasks in Firestore');
                            } else {
                                console.error('🔄 AUTO SYNC: Verification failed - no tasks found in Firestore');
                                // Try to save again if verification failed
                                saveTasks();
                            }
                        })
                        .catch(error => {
                            console.error('🔄 AUTO SYNC ERROR:', error);
                        });
                }, 1000);
            }
        }, 30 * 1000); // Check every 30 seconds
    }
    
    // Add logout event listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log('Logging out user...');
            
            // Save any unsaved changes before logging out
            if (currentUser) {
                try {
                    console.log('🔥 LOGOUT: Saving tasks before logout...');
                    await saveTasks();
                    console.log('🔥 LOGOUT: Tasks saved successfully before logout');
                } catch (error) {
                    console.error('🔥 LOGOUT ERROR: Failed to save tasks before logout:', error);
                    // Continue with logout even if save fails
                }
            }
            
            // Clean up Firestore listener if it exists
            if (window.firestoreTaskListener) {
                window.firestoreTaskListener();
                console.log('🔥 FIREBASE: Unsubscribed from Firestore listener');
                window.firestoreTaskListener = null;
            }
            
            try {
                await firebase.auth().signOut();
                console.log('User successfully logged out');
                // The redirect will happen automatically due to the auth state change listener
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        });
    }
    
    // Set up periodic task refresh to handle any sync issues
    setInterval(() => {
        if (currentUser) {
            console.log('🔥 FIREBASE: Performing periodic task refresh...');
            // Force a refresh by temporarily unsubscribing and resubscribing
            if (window.firestoreTaskListener) {
                window.firestoreTaskListener();
                loadTasks(); // This will create a new listener
            }
        }
    }, 30 * 1000); // Refresh every 30 seconds
});

// Load Tasks from Firestore or localStorage
function loadTasks() {
    let localTasksLoaded = false;
    
    try {
        const localTasks = localStorage.getItem('tasks');
        if (localTasks) {
            const parsedTasks = JSON.parse(localTasks);
            
            parsedTasks.forEach(task => {
                try {
                    // Load due date as UTC
                    if (typeof task.dueDate === 'number') {
                        task.dueDate = new Date(task.dueDate);
                    } else if (typeof task.dueDate === 'string') {
                        // Handle string cases (for backward compatibility)
                        if (task.dueDate.includes('T')) {
                            // ISO string
                            task.dueDate = new Date(task.dueDate);
                        } else {
                            // Numeric string
                            task.dueDate = new Date(Number(task.dueDate));
                        }
                    } else if (!(task.dueDate instanceof Date)) {
                        task.dueDate = new Date();
                    }
                    
                    if (!task.sessions) {
                        task.sessions = [];
                    }
                    
                    // Process sessions if they exist
                    task.sessions = task.sessions.map(session => {
                        try {
                            // Process startTime
                            if (typeof session.startTime === 'number') {
                                session.startTime = new Date(session.startTime);
                            } else if (typeof session.startTime === 'string') {
                                if (session.startTime.includes('T')) {
                                    // ISO string
                                    session.startTime = new Date(session.startTime);
                                } else {
                                    // Numeric string
                                    session.startTime = new Date(Number(session.startTime));
                                }
                            } else if (!(session.startTime instanceof Date)) {
                                session.startTime = new Date();
                            }
                            
                            // Process endTime
                            if (typeof session.endTime === 'number') {
                                session.endTime = new Date(session.endTime);
                            } else if (typeof session.endTime === 'string') {
                                if (session.endTime.includes('T')) {
                                    // ISO string
                                    session.endTime = new Date(session.endTime);
                                } else {
                                    // Numeric string
                                    session.endTime = new Date(Number(session.endTime));
                                }
                            } else if (!(session.endTime instanceof Date)) {
                                session.endTime = new Date(session.startTime.getTime() + POMODORO_DURATION * 1000);
                            }
                        } catch (e) {
                            console.error('Error processing session from localStorage:', e);
                            // Create default times if there's an error
                            const now = new Date();
                            session.startTime = now;
                            session.endTime = new Date(now.getTime() + POMODORO_DURATION * 1000);
                        }
                        return session;
                    });
                } catch (e) {
                    console.error('Error processing task:', e);
                }
            });
            
            tasks = parsedTasks;
            localTasksLoaded = true;
            console.log('💾 LOCAL: Tasks loaded from localStorage. Count:', tasks.length);
        }
    } catch (error) {
        console.error('💾 LOCAL ERROR: Failed to load from localStorage:', error);
    }
    
    if (currentUser) {
        // Clear any existing Firestore listeners
        if (window.firestoreTaskListener) {
            window.firestoreTaskListener();
            console.log('🔥 FIREBASE: Unsubscribed from previous Firestore listener');
        }
        
        console.log('🔥 FIREBASE: Setting up real-time listener for user:', currentUser.uid);
        
        // Set up a real-time listener for Firestore updates
        window.firestoreTaskListener = db.collection('users').doc(currentUser.uid)
            .onSnapshot(
                doc => {
                    if (doc.exists && doc.data().tasks && Array.isArray(doc.data().tasks)) {
                        const firestoreTasks = doc.data().tasks;
                        console.log('🔥 FIREBASE SUCCESS: Real-time update with', firestoreTasks.length, 'tasks from Firestore');
                        
                        if (firestoreTasks.length === 0 && localTasksLoaded && tasks.length > 0) {
                            console.log('🔥 FIREBASE: Firestore has 0 tasks but localStorage has tasks, syncing to Firestore');
                            saveTasks();
                            return;
                        }
                        
                        // Convert dates from strings to Date objects
                        const processedTasks = firestoreTasks.map(task => {
                            try {
                                // Create a new task object
                                const newTask = { ...task };
                                
                                // Convert string to Date
                                if (typeof task.dueDate === 'number') {
                                    newTask.dueDate = new Date(task.dueDate);
                                } else if (typeof task.dueDate === 'string') {
                                    newTask.dueDate = new Date(Number(task.dueDate));
                                } else if (!(task.dueDate instanceof Date)) {
                                    newTask.dueDate = new Date();
                                }
                                
                                // Initialize sessions if it doesn't exist
                                if (!task.sessions || !Array.isArray(task.sessions)) {
                                    newTask.sessions = [];
                                } else {
                                    // Convert session dates
                                    newTask.sessions = task.sessions.map(session => {
                                        try {
                                            const newSession = { ...session };
                                            
                                            if (typeof session.startTime === 'number') {
                                                newSession.startTime = new Date(session.startTime);
                                            } else if (typeof session.startTime === 'string') {
                                                newSession.startTime = new Date(Number(session.startTime));
                                            } else if (!(session.startTime instanceof Date)) {
                                                newSession.startTime = new Date();
                                            }
                                            
                                            if (typeof session.endTime === 'number') {
                                                newSession.endTime = new Date(session.endTime);
                                            } else if (typeof session.endTime === 'string') {
                                                newSession.endTime = new Date(Number(session.endTime));
                                            } else {
                                                const startTime = newSession.startTime || new Date();
                                                newSession.endTime = new Date(startTime.getTime() + POMODORO_DURATION * 1000);
                                            }
                                            
                                            return newSession;
                                        } catch (e) {
                                            console.error('Error processing session from Firestore:', e, session);
                                            // Return a default session if conversion fails
                                            const now = new Date();
                                            return {
                                                id: 'recovery-session-' + Date.now(),
                                                startTime: now,
                                                endTime: new Date(now.getTime() + POMODORO_DURATION * 1000),
                                                isBreak: false,
                                                completed: false
                                            };
                                        }
                                    });
                                }
                                
                                return newTask;
                            } catch (e) {
                                console.error('Error processing task from Firestore:', e, task);
                                // Skip invalid tasks
                                return null;
                            }
                        }).filter(Boolean); // Remove any null tasks that failed processing
                        
                        // Override localStorage data with Firestore data
                        tasks = processedTasks;
                        
                        // Save back to localStorage for backup
                        try {
                            localStorage.setItem('tasks', JSON.stringify(tasks));
                        } catch (e) {
                            console.error('Failed to save tasks to localStorage after Firestore load:', e);
                        }
                        
                        // Render UI with updated tasks
                        renderTasks();
                        renderCalendar();
                    } else {
                        console.log('🔥 FIREBASE: No tasks found in Firestore or document doesn\'t exist');
                        
                        // If we already have tasks from localStorage, sync them to Firestore
                        if (localTasksLoaded && tasks.length > 0) {
                            console.log('🔥 FIREBASE: Syncing localStorage tasks to Firestore');
                            saveTasks();
                        }
                        
                        // Render what we have from localStorage
                        renderTasks();
                        renderCalendar();
                    }
                },
                error => {
                    console.error('🔥 FIREBASE ERROR with real-time listener:', error);
                    console.log('Using localStorage tasks instead');
                    
                    // Render what we have from localStorage
                    renderTasks();
                    renderCalendar();
                }
            );
    } else {
        // Just render what we have from localStorage
        renderTasks();
        renderCalendar();
    }
}

// Save Tasks to Firestore or localStorage
function saveTasks() {
    // Declare serializableTasks at the function level so it's available to all blocks
    let serializableTasks = [];
    
    // Always save to localStorage as a backup
    try {
        // Save with UTC timestamps
        serializableTasks = tasks.map(task => {
            // Task due date is already in UTC
            let dueDate;
            try {
                dueDate = task.dueDate.getTime();
            } catch (e) {
                dueDate = Date.now();
            }
            
            const sessions = Array.isArray(task.sessions) ? task.sessions : [];
            
            return {
                id: task.id,
                name: task.name,
                dueDate: dueDate,  // Store the UTC timestamp
                duration: task.duration,
                completedSessions: task.completedSessions || 0,
                totalSessions: task.totalSessions || 4,
                sessions: sessions.map(session => {
                    // Session times are already in UTC
                    let startTime, endTime;
                    try {
                        startTime = session.startTime.getTime();
                    } catch (e) {
                        startTime = Date.now();
                    }
                    try {
                        endTime = session.endTime.getTime();
                    } catch (e) {
                        endTime = Date.now() + 25 * 60 * 1000;
                    }
                    
                    return {
                        id: session.id,
                        startTime: startTime,  // Store UTC timestamp
                        endTime: endTime,      // Store UTC timestamp
                        isBreak: !!session.isBreak,
                        completed: !!session.completed
                    };
                })
            };
        });
        
        localStorage.setItem('tasks', JSON.stringify(serializableTasks));
        console.log('💾 LOCAL: Tasks saved to localStorage successfully as UTC timestamps');
    } catch (error) {
        console.error('💾 LOCAL ERROR: Failed to save to localStorage:', error);
        // If serialization failed, create a simpler version as fallback
        serializableTasks = tasks.map(task => ({
            id: task.id || Date.now().toString(),
            name: task.name || 'Unnamed Task',
            dueDate: task.dueDate instanceof Date ? task.dueDate.getTime() : Date.now(),
            duration: task.duration || 1,
            completedSessions: task.completedSessions || 0,
            totalSessions: task.totalSessions || 4,
            sessions: []
        }));
    }
    
    if (!currentUser) {
        console.warn('🔥 FIREBASE: No user logged in, skipping Firestore save');
        return Promise.resolve(); // Return resolved promise when no user is logged in
    }
    
    // Save to Firestore and return the promise
    console.log('🔥 FIREBASE: Attempting to save tasks to Firestore for user:', currentUser.uid);
    console.log('🔥 FIREBASE: Number of tasks being saved:', tasks.length);
    
    // Create a promise that resolves when the save is complete
    return new Promise((resolve, reject) => {
        try {
            // Save to Firestore using the db reference
            db.collection('users').doc(currentUser.uid)
                .set({
                    tasks: serializableTasks,
                    lastUpdated: new Date().toISOString(),
                    deviceInfo: navigator.userAgent
                }, { merge: true })
                .then(() => {
                    console.log('🔥 FIREBASE SUCCESS: Tasks saved to Firestore successfully');
                    resolve(); // Resolve the promise on success
                    
                    // Verify the data was saved correctly
                    setTimeout(() => {
                        verifyFirestoreData();
                    }, 1000);
                })
                .catch(error => {
                    console.error('🔥 FIREBASE ERROR:', error);
                    
                    // Retry once on failure
                    setTimeout(() => {
                        console.log('🔥 FIREBASE: Retrying save operation after error');
                        db.collection('users').doc(currentUser.uid)
                            .set({
                                tasks: serializableTasks,
                                lastUpdated: new Date().toISOString(),
                                retryInfo: {
                                    timestamp: new Date().toISOString(),
                                    originalError: error.message
                                }
                            }, { merge: true })
                            .then(() => {
                                console.log('🔥 FIREBASE SUCCESS: Tasks saved on retry');
                                resolve(); // Resolve the promise on successful retry
                            })
                            .catch(retryError => {
                                console.error('🔥 FIREBASE ERROR ON RETRY:', retryError);
                                alert('Error saving tasks to Firebase. Your tasks have been saved locally as a backup.');
                                reject(retryError); // Reject the promise on retry failure
                            });
                    }, 2000);
                });
        } catch (error) {
            console.error('Error preparing tasks for Firestore:', error);
            reject(error); // Reject the promise for general errors
        }
    });
}

// Add a verification function to check if data was properly saved
function verifyFirestoreData() {
    if (!currentUser) return;
    
    console.log('🔥 FIREBASE: Verifying saved data in Firestore...');
    
    // Check the main user document where tasks are stored
    db.collection('users').doc(currentUser.uid)
        .get()
        .then(doc => {
            if (doc.exists && doc.data().tasks) {
                const firestoreTasks = doc.data().tasks || [];
                console.log('🔥 FIREBASE VERIFICATION: Found', firestoreTasks.length, 'tasks in Firestore');
                console.log('🔥 FIREBASE VERIFICATION: First task:', firestoreTasks[0]?.name || 'No tasks');
                
                // Log the full tasks data for debugging
                console.log('🔥 FIREBASE VERIFICATION: Full tasks data:', JSON.stringify(firestoreTasks));
            } else {
                console.log('🔥 FIREBASE VERIFICATION: No tasks found in user document!', doc.exists ? 'Document exists' : 'Document does not exist');
                if (doc.exists) {
                    console.log('🔥 FIREBASE VERIFICATION: Document data:', JSON.stringify(doc.data()));
                }
            }
        })
        .catch(error => {
            console.error('🔥 FIREBASE VERIFICATION ERROR:', error);
        });
}

// Render Tasks
function renderTasks() {
    console.log(`Rendering ${tasks.length} tasks to the task list...`);
    tasksContainer.innerHTML = '';
    
    if (tasks.length === 0) {
        tasksContainer.innerHTML = '<div class="empty-tasks-message">No tasks yet. Add your first task!</div>';
        return;
    }
    
    tasks.forEach((task, index) => {
        try {
            // Debug info
            console.log(`Rendering task ${index}: ${task.name}, ID: ${task.id}`);
            
            // Calculate progress percentage
            const progressPercentage = (task.completedSessions / task.totalSessions) * 100 || 0;
            
            // Format due date in a cleaner way
            const dueDate = new Date(task.dueDate);
            const formattedDate = dueDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.innerHTML = `
            <h3>${task.name}</h3>
                <div class="task-info">
                    <span class="task-info-label">Due:</span>
                    <span class="task-info-value">${formattedDate}</span>
                </div>
                <div class="task-progress">
                    <div class="task-info">
                        <span class="task-info-label">Progress:</span>
                        <span class="task-info-value">${task.completedSessions}/${task.totalSessions} sessions</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
            <div class="task-buttons">
                <button onclick="startTask('${task.id}')" class="icon-btn start-icon" title="Start Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                    </svg>
                </button>
                <button onclick="editTask('${task.id}')" class="icon-btn edit-icon" title="Edit Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                    </svg>
                </button>
                <button onclick="deleteTask('${task.id}')" class="icon-btn delete-icon" title="Delete Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        `;
        tasksContainer.appendChild(taskElement);
        } catch (error) {
            console.error(`Error rendering task ${index}:`, error);
        }
    });
}

// Edit Task
function editTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (!task) return;
    
    console.log('🔥 EDIT: Editing task with ID:', taskId);
    
    // Format the date for the datetime-local input
    const dateStr = new Date(task.dueDate.getTime() - task.dueDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    
    // Populate form with task data
    const taskNameInput = document.getElementById('task-name');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskDurationInput = document.getElementById('task-duration');
    
    taskNameInput.value = task.name;
    taskDueDateInput.value = dateStr;
    taskDurationInput.value = task.duration;
    
    // Change form submit behavior temporarily
    taskForm.removeEventListener('submit', addTaskHandler);
    taskForm.addEventListener('submit', function editHandler(e) {
        e.preventDefault();
        
        // Update task with new values
        const originalName = task.name;
        task.name = taskNameInput.value;
        task.dueDate = new Date(taskDueDateInput.value);
        task.duration = parseFloat(taskDurationInput.value);
        task.totalSessions = Math.ceil(task.duration * 4);
        
        // Regenerate sessions
        if (typeof task.generateSessions === 'function') {
            task.sessions = task.generateSessions(task.dueDate);
        } else {
            console.warn('🔥 EDIT WARNING: generateSessions method not found on task object');
        }
        
        console.log('🔥 EXPLICIT SAVE: Saving edited task to Firestore...');
        
        // Save to localStorage first as backup
        try {
            localStorage.setItem('tasks', JSON.stringify(tasks));
            console.log('🔥 EDIT: Changes saved to localStorage');
        } catch (e) {
            console.error('🔥 EDIT ERROR: Failed to save to localStorage:', e);
        }
        
        // Then save to Firestore using promise
        if (currentUser) {
            saveTasks()
                .then(() => {
                    console.log('🔥 EDIT: Changes saved successfully to Firestore');
                })
                .catch(error => {
                    console.error('🔥 EDIT ERROR: Failed to save to Firestore:', error);
                    // Try again after a short delay
                    setTimeout(() => saveTasks(), 2000);
                });
        } else {
            console.warn('🔥 EDIT: User not logged in, skipping Firestore save');
        }
        
        renderTasks();
        renderCalendar();
        taskForm.reset();
        
        // Restore original form behavior
        taskForm.removeEventListener('submit', editHandler);
        taskForm.addEventListener('submit', addTaskHandler);
        
        // If on mobile, close the sidebar after editing and remove any edit indicators
        if (window.innerWidth <= 768) {
            // Remove edit indicator if present
            const editIndicator = document.querySelector('.edit-mode-indicator');
            if (editIndicator) {
                editIndicator.remove();
            }
            
            // Close the sidebar
            sidebar.classList.remove('active');
        }
        
        showNotification(`Task "${originalName}" updated!`);
    });
    
    // Focus on the name input for better UX
    taskNameInput.focus();
    
    // Highlight the form for mobile view (sidebar should already be open from showTaskOptionsMenu)
    if (window.innerWidth <= 768) {
        // Scroll form into view with a slight delay to ensure the sidebar animation completes
        taskForm.scrollIntoView({ behavior: 'smooth' });
        
        // Add a temporary class to highlight the form
        taskForm.classList.add('highlight-form');
        setTimeout(() => {
            taskForm.classList.remove('highlight-form');
        }, 1500);
    }
}

// Delete Task
function deleteTask(taskId) {
    console.log('🔥 DELETE: Deleting task with ID:', taskId);
    const taskToDelete = tasks.find(task => task.id === taskId);
    
    if (!taskToDelete) {
        console.error('🔥 DELETE ERROR: Task not found with ID', taskId);
        return;
    }
    
    // Delete from the array
    tasks = tasks.filter(task => task.id !== taskId);
    
    // Explicitly save changes to Firestore
    console.log('🔥 EXPLICIT SAVE: Saving task deletion to Firestore...');
    
    // Save to localStorage first as backup
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('🔥 DELETE: Task removed from localStorage');
    } catch (e) {
        console.error('🔥 DELETE ERROR: Failed to save to localStorage after deletion:', e);
    }
    
    // Then save to Firestore using promise
    if (currentUser) {
        saveTasks()
            .then(() => {
                console.log('🔥 DELETE: Task deletion saved successfully to Firestore');
            })
            .catch(error => {
                console.error('🔥 DELETE ERROR: Failed to save to Firestore:', error);
                // Try again after a short delay
                setTimeout(() => saveTasks(), 2000);
            });
    } else {
        console.warn('🔥 DELETE: User not logged in, skipping Firestore save');
    }
    
    renderTasks();
    renderCalendar();
    
    showNotification(`Task "${taskToDelete.name}" deleted!`);
}

// Start Task
function startTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    currentTask = task;
    currentTaskName.textContent = task.name;
    
    // Update session counter based on task progress
    currentSession = task.completedSessions + 1;
    totalSessions = task.totalSessions;
    currentSessionDisplay.textContent = currentSession;
    totalSessionsDisplay.textContent = totalSessions;
    
    // Reset timer
    timeLeft = POMODORO_DURATION;
    isBreak = false;
    updateTimerDisplay();
    updateProgressBar();
    
    // Scroll to timer section
    document.querySelector('.timer-section').scrollIntoView({ behavior: 'smooth' });
}

// Timer Functions
function startTimer() {
    // Clear any existing timer
    if (timer) {
        clearInterval(timer);
    }
    
    if (currentTask) {
        document.title = `${timeLeft > 0 ? formatTime(timeLeft) : '00:00'} - ${currentTask.name} - Pomodoro`;
    } else {
        document.title = `${timeLeft > 0 ? formatTime(timeLeft) : '00:00'} - Pomodoro`;
    }
    
    // Update button text
    startTimerBtn.innerHTML = '<span class="icon">❚❚</span> Pause';
    startTimerBtn.classList.remove('start-btn');
    startTimerBtn.classList.add('pause-btn');
    
    // Change start button to function as pause
    startTimerBtn.removeEventListener('click', startTimer);
    startTimerBtn.addEventListener('click', pauseTimer);
    
    // Get the start time for more accurate timing
    const startTime = Date.now();
    const initialTimeLeft = timeLeft;
    
    // Create a new timer with more accurate timing
    timer = setInterval(() => {
        // Calculate elapsed time since timer started
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        // Calculate current time left
        timeLeft = Math.max(0, initialTimeLeft - elapsed);
        
        updateTimerDisplay();
        
        // Save state periodically (every 10 seconds)
        if (timeLeft % 10 === 0) {
            saveTimerState();
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            // Play sound if available
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
            audio.play().catch(e => console.log('Audio play failed:', e));
            
            if (isBreak) {
                // Break is over, start next session
                isBreak = false;
                if (currentSession < totalSessions) {
                    currentSession++;
                    currentSessionDisplay.textContent = currentSession;
                    timeLeft = POMODORO_DURATION;
                    updateTimerDisplay();
                    updateProgressBar();
                    
                    // Save state before starting next session
                    saveTimerState();
                    
                    startTimer();
                } else {
                    // All sessions completed
                    completeTask();
                }
            } else {
                // Work session is over, track it in journey
                if (window.journeyTracker) {
                    // Award points for completing a session, regardless of whether it's a task session or free session
                    window.journeyTracker.addSessionCompletion();
                }
                
                // Start break
                isBreak = true;
                timeLeft = BREAK_DURATION;
                updateTimerDisplay();
                
                // Save state before starting break
                saveTimerState();
                
                startTimer();
            }
        }
    }, 1000);
    
    // Save state after timer starts
    saveTimerState();
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
    
    // Update button text
    startTimerBtn.innerHTML = '<span class="icon">▶</span> Resume';
    startTimerBtn.classList.remove('pause-btn');
    startTimerBtn.classList.add('start-btn');
    
    // Change pause button back to start
    startTimerBtn.removeEventListener('click', pauseTimer);
    startTimerBtn.addEventListener('click', startTimer);
    
    // Save the paused state
    saveTimerState();
}

function resetTimer() {
    clearInterval(timer);
    timer = null;
    timeLeft = POMODORO_DURATION;
    isBreak = false;
    updateTimerDisplay();
    
    // Reset button text
    startTimerBtn.innerHTML = '<span class="icon">▶</span> Start';
    startTimerBtn.classList.remove('pause-btn');
    startTimerBtn.classList.add('start-btn');
    
    // Make sure button is set to start
    startTimerBtn.removeEventListener('click', pauseTimer);
    startTimerBtn.addEventListener('click', startTimer);
    
    // Save the reset state
    saveTimerState();
}

function skipTimer() {
    clearInterval(timer);
    timer = null;
    
    if (isBreak) {
        // Skip break, start next session
        isBreak = false;
        if (currentSession < totalSessions) {
            currentSession++;
            currentSessionDisplay.textContent = currentSession;
            timeLeft = POMODORO_DURATION;
            updateProgressBar();
        } else {
            // All sessions completed
            completeTask();
            return;
        }
    } else {
        // Skip work session, start break
        isBreak = true;
        timeLeft = BREAK_DURATION;
    }
    
    updateTimerDisplay();
    
    // Reset button text
    startTimerBtn.innerHTML = '<span class="icon">▶</span> Start';
    
    // Make sure button is set to start
    startTimerBtn.removeEventListener('click', pauseTimer);
    startTimerBtn.addEventListener('click', startTimer);
    
    // Save the updated state after skipping
    saveTimerState();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    minutesDisplay.textContent = minutes.toString().padStart(2, '0');
    secondsDisplay.textContent = seconds.toString().padStart(2, '0');
    
    // Update session type (Focus Session or Break)
    const timerLabel = document.querySelector('.timer-label');
    if (timerLabel) {
        timerLabel.textContent = isBreak ? 'Break' : 'Focus Session';
        timerLabel.style.color = isBreak ? 'var(--secondary-color)' : 'var(--primary-color)';
    }
    
    // Update the circular progress indicator
    const totalTime = isBreak ? BREAK_DURATION : POMODORO_DURATION;
    const progress = timeLeft / totalTime; // Remaining time (0 to 1)
    
    // Check if we already have a timer outline element
    let timerOutline = document.querySelector('.timer-outline');
    if (!timerOutline) {
        // Create the timer outline element
        timerOutline = document.createElement('div');
        timerOutline.className = 'timer-outline';
        const timerCircle = document.querySelector('.timer-circle');
        if (timerCircle) {
            timerCircle.appendChild(timerOutline);
        }
    }
    
    // Reset and add break class if it's a break
    timerOutline.className = 'timer-outline';
    if (isBreak) {
        timerOutline.classList.add('break');
    }
    
    if (progress <= 0) {
        // Timer completed - hide outline
        timerOutline.style.display = 'none';
    } else {
        // Show outline
        timerOutline.style.display = 'block';
        
        // Calculate the angle in degrees
        const degrees = progress * 360;
        
        // Update clip-path to show only the remaining portion of the outline
        timerOutline.style.clipPath = `
            conic-gradient(
                transparent ${degrees}deg,
                black ${degrees}deg
            )
        `;
    }
    
    // Update document title for tab
    if (currentTask) {
        document.title = `${minutesDisplay.textContent}:${secondsDisplay.textContent} - ${currentTask.name} - Pomodoro`;
    } else {
        document.title = `${minutesDisplay.textContent}:${secondsDisplay.textContent} - Pomodoro`;
    }
}

function updateProgressBar() {
    // Update the progress steps
    if (progressSteps) {
        for (let i = 0; i < progressSteps.length; i++) {
            if (i < currentSession - 1) {
                progressSteps[i].classList.add('completed');
            } else {
                progressSteps[i].classList.remove('completed');
            }
        }
    }
    
    // Update progress labels
    if (progressCompletedLabel && progressRemainingLabel) {
        progressCompletedLabel.textContent = `${currentSession - 1} completed`;
        progressRemainingLabel.textContent = `${totalSessions - (currentSession - 1)} remaining`;
    }
}

// Timer Controls
startTimerBtn.addEventListener('click', startTimer);
resetTimerBtn.addEventListener('click', resetTimer);
skipTimerBtn.addEventListener('click', skipTimer);

// View Toggle
viewToggleButtons.forEach(button => {
    button.addEventListener('click', () => {
        viewToggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentView = button.dataset.view;
        renderCalendar();
    });
});

// Calendar Rendering
function renderCalendar() {
    // Clear any existing content
    calendar.innerHTML = '';
    console.log("Rendering calendar view:", currentView);
    
    // Add date navigation controls
    const navContainer = document.createElement('div');
    navContainer.className = 'calendar-nav';
    
    if (currentView === 'daily') {
        const dateStr = selectedDate.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        navContainer.innerHTML = `
            <button id="prev-day" title="Previous Day"><i class="nav-icon">◀</i></button>
            <span class="current-date">${dateStr}</span>
            <button id="next-day" title="Next Day"><i class="nav-icon">▶</i></button>
            <button id="today-btn" class="today-button">Today</button>
        `;
        
        calendar.appendChild(navContainer);
        
        // Add event listeners for navigation buttons
        document.getElementById('prev-day').addEventListener('click', () => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() - 1);
            selectedDate = newDate;
            renderCalendar();
        });
        
        document.getElementById('next-day').addEventListener('click', () => {
            const newDate = new Date(selectedDate);
            newDate.setDate(selectedDate.getDate() + 1);
            selectedDate = newDate;
            renderCalendar();
        });
        
        document.getElementById('today-btn').addEventListener('click', () => {
            selectedDate = new Date();
            renderCalendar();
        });
        
        // Create container for calendar content directly here
        renderDailyCalendar();
    } else {
        // Weekly view rendering
        const weekEndDate = new Date(selectedWeekStart);
        weekEndDate.setDate(selectedWeekStart.getDate() + 6);
        
        const weekStartStr = selectedWeekStart.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
        });
        
        const weekEndStr = weekEndDate.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric' 
        });
        
        navContainer.innerHTML = `
            <button id="prev-week" title="Previous Week"><i class="nav-icon">◀</i></button>
            <span class="current-date">${weekStartStr} - ${weekEndStr}</span>
            <button id="next-week" title="Next Week"><i class="nav-icon">▶</i></button>
            <button id="this-week-btn" class="today-button">This Week</button>
        `;
        
        calendar.appendChild(navContainer);
        
        // Add event listeners for navigation buttons
        document.getElementById('prev-week').addEventListener('click', () => {
            const newWeekStart = new Date(selectedWeekStart);
            newWeekStart.setDate(selectedWeekStart.getDate() - 7);
            selectedWeekStart = newWeekStart;
            renderCalendar();
        });
        
        document.getElementById('next-week').addEventListener('click', () => {
            const newWeekStart = new Date(selectedWeekStart);
            newWeekStart.setDate(selectedWeekStart.getDate() + 7);
            selectedWeekStart = newWeekStart;
            renderCalendar();
        });
        
        document.getElementById('this-week-btn').addEventListener('click', () => {
            const today = new Date();
            selectedWeekStart = new Date(today);
            selectedWeekStart.setDate(today.getDate() - today.getDay());
            selectedWeekStart.setHours(0, 0, 0, 0);
            renderCalendar();
        });
        
        // Create container for calendar content
        const calendarContent = document.createElement('div');
        calendarContent.className = 'calendar-content';
        calendar.appendChild(calendarContent);
        
        // Render the weekly view inside the content container
        renderWeeklyView();
    }
}

// Render the daily calendar
function renderDailyCalendar() {
    // Create daily calendar content container
    const calendarContent = document.createElement('div');
    calendarContent.className = 'calendar-content';
    calendar.appendChild(calendarContent);
    
    // Create container for hours
    const hoursContainer = document.createElement('div');
    hoursContainer.className = 'daily-hours-container';
    calendarContent.appendChild(hoursContainer);
    
    // Generate hours from working hours range - make sure this creates enough hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    console.log("Hours to render:", hours, "Start:", WORKING_HOURS.start, "End:", WORKING_HOURS.end);
    
    // Check if working hours are properly defined
    if (hours.length === 0) {
        console.error("No hours to display. Working hours configuration issue.");
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-calendar-message';
        emptyMessage.textContent = 'No hours configured for the day. Check your working hours settings.';
        hoursContainer.appendChild(emptyMessage);
        return;
    }
    
    // Render all 24 hours using the hours array
    for (let hour of hours) {
        const hourElement = document.createElement('div');
        hourElement.className = 'calendar-hour';
        hourElement.dataset.hour = hour;
        hourElement.dataset.date = selectedDate.toISOString();
        
        // Add a class for current hour to highlight it
        const now = new Date();
        if (now.getHours() === hour && 
            now.toDateString() === selectedDate.toDateString()) {
            hourElement.classList.add('current-hour');
        }
        
        // Format the hour (8:00 AM, etc.)
        const formattedHour = formatHour(hour);
        
        // Get tasks for this hour
        const hourBlocks = getTasksForHour(hour);
        
        hourElement.innerHTML = `
            <div class="hour-label">${formattedHour}</div>
            <div class="hour-blocks" data-hour="${hour}" data-date="${selectedDate.toISOString()}">
                ${hourBlocks}
                <button class="add-task-hour-btn" title="Add task at ${formattedHour}">+</button>
            </div>
        `;
        
        // Add the hour element to the container
        hoursContainer.appendChild(hourElement);
        
        // Add event listener to handle clicking on this hour
        const addButton = hourElement.querySelector('.add-task-hour-btn');
        addButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent other click events from firing
            handleHourClick(hour, selectedDate);
        });
        
        // Also make the entire hour row clickable
        hourElement.addEventListener('click', (e) => {
            // Don't trigger if clicking on a task or the add button directly
            if (!e.target.closest('.pomodoro-block') && !e.target.classList.contains('add-task-hour-btn')) {
                handleHourClick(hour, selectedDate);
            }
        });
        
        // Add click handlers to task blocks
        const taskBlocks = hourElement.querySelectorAll('.pomodoro-block:not(.completed)');
        taskBlocks.forEach(block => {
            // Setup drag and drop (now includes click handler for options menu)
            setupDragAndDrop(block);
        });
        
        // Make hour blocks a drop target
        const hourBlocksContainer = hourElement.querySelector('.hour-blocks');
        setupDropTarget(hourBlocksContainer);
    }
}

// Add drag and drop functionality
let draggedElement = null;
let isDragging = false;

// Add a function to show a task options menu
function showTaskOptionsMenu(e, taskId, block) {
    e.stopPropagation();
    
    // Remove any existing menus
    const existingMenu = document.querySelector('.task-options-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'task-options-menu';
    menu.innerHTML = `
        <div class="option" data-action="start">Start</div>
        <div class="option" data-action="edit">Edit</div>
        <div class="option" data-action="delete">Delete</div>
    `;
    
    // Position menu near the clicked element
    const rect = block.getBoundingClientRect();
    menu.style.position = 'absolute';
    
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // For mobile, position the menu in a more accessible location
        menu.style.top = `${rect.top + window.scrollY - 10}px`;
        menu.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 150)}px`;
        menu.classList.add('mobile-menu');
    } else {
        // Desktop positioning
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
    }
    
    // Add click handlers
    menu.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        
        // First remove the menu regardless of action
        menu.remove();
        
        if (action === 'start') {
            startTask(taskId);
            // Scroll to timer section
            document.querySelector('.timer-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        } else if (action === 'edit') {
            // For mobile view, immediately open the sidebar before editing
            if (isMobile && sidebar) {
                // First activate the sidebar
                sidebar.classList.add('active');
                
                // Show edit indicator in the sidebar header
                const task = tasks.find(task => task.id === taskId);
                if (task) {
                    // Add a visual indicator that we're in edit mode
                    const editIndicator = document.createElement('div');
                    editIndicator.className = 'edit-mode-indicator';
                    editIndicator.textContent = 'Editing Task: ' + task.name;
                    
                    // Remove existing indicator if any
                    const existingIndicator = document.querySelector('.edit-mode-indicator');
                    if (existingIndicator) {
                        existingIndicator.remove();
                    }
                    
                    // Add indicator to the sidebar
                    const sidebarHeader = document.querySelector('.sidebar-header');
                    if (sidebarHeader) {
                        sidebarHeader.appendChild(editIndicator);
                        
                        // Add animation to make it more noticeable
                        editIndicator.style.animation = 'pulse 1s infinite';
                    }
                }
                
                // Give a small delay for sidebar animation, then edit
                setTimeout(() => {
                    editTask(taskId);
                }, 100);
            } else {
                // For desktop, just edit directly
                editTask(taskId);
            }
        } else if (action === 'delete') {
            if (confirm('Are you sure you want to delete this task?')) {
                deleteTask(taskId);
            }
        }
    });
    
    // Close menu when clicking elsewhere
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
    
    // Add to document
    document.body.appendChild(menu);
}

// Update the setupDragAndDrop function to include the context menu
function setupDragAndDrop(element) {
    // Add a visual drag handle for better usability
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to reschedule';
    element.appendChild(dragHandle);
    
    // Add click handler for options menu
    element.addEventListener('click', (e) => {
        // Only handle click if not dragging
        if (!isDragging) {
            const taskId = element.dataset.taskId;
            if (taskId) {
                showTaskOptionsMenu(e, taskId, element);
            }
        }
    });
    
    // Setup touch events for mobile
    let touchStartX, touchStartY;
    let touchStartTime;
    let touchTimeout;
    let movedDistance = 0;
    
    element.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        movedDistance = 0;
        
        // Add a timeout to distinguish between tap and long press
        touchTimeout = setTimeout(() => {
            console.log('Long press detected - starting drag mode');
            element.classList.add('touch-dragging');
            element.setAttribute('aria-grabbed', 'true');
            
            // Show visual feedback
            element.style.opacity = '0.6';
            element.style.transform = 'scale(1.05)';
            
            // Store original position for calculation
            element.touchOriginalTop = element.offsetTop;
            element.touchOriginalLeft = element.offsetLeft;
        }, 500); // 500ms long press to start dragging
    }, { passive: false });
    
    element.addEventListener('touchmove', (e) => {
        // Calculate distance moved for tap vs. drag distinction
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        movedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (!element.classList.contains('touch-dragging')) return;
        
        // Prevent scrolling while dragging
        e.preventDefault();
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        // Calculate the distance moved for dragging
        const deltaX2 = touchX - touchStartX;
        const deltaY2 = touchY - touchStartY;
        
        // Update element position
        element.style.position = 'absolute';
        element.style.top = `${element.touchOriginalTop + deltaY2}px`;
        element.style.left = `${element.touchOriginalLeft + deltaX2}px`;
        element.style.zIndex = '1000';
        
        // Find potential drop targets
        const elementsUnderTouch = document.elementsFromPoint(touchX, touchY);
        const dropTarget = elementsUnderTouch.find(el => el.classList.contains('hour-blocks'));
        
        // Highlight potential drop target
        document.querySelectorAll('.drop-target-hover').forEach(el => {
            el.classList.remove('drop-target-hover');
        });
        
        if (dropTarget) {
            dropTarget.classList.add('drop-target-hover');
        }
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
        // Clear the timeout to prevent drag mode
        clearTimeout(touchTimeout);
        
        // Calculate timing for tap vs. long press
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;
        
        // If we're in drag mode
        if (element.classList.contains('touch-dragging')) {
            const touchX = e.changedTouches[0].clientX;
            const touchY = e.changedTouches[0].clientY;
            
            // Find the drop target
            const elementsUnderTouch = document.elementsFromPoint(touchX, touchY);
            const dropTarget = elementsUnderTouch.find(el => el.classList.contains('hour-blocks'));
            
            if (dropTarget) {
                // Get the task ID and session index from the dragged element
                const taskId = element.dataset.taskId;
                const sessionIndex = parseInt(element.dataset.sessionIndex);
                
                // Get the target hour and date
                const targetHour = parseInt(dropTarget.dataset.hour);
                const targetDate = new Date(dropTarget.dataset.date);
                
                if (taskId && targetHour != null && targetDate) {
                    rescheduleTask(taskId, sessionIndex, targetHour, targetDate);
                }
            }
            
            // Reset element styles
            element.style.position = '';
            element.style.top = '';
            element.style.left = '';
            element.style.zIndex = '';
            element.style.opacity = '';
            element.style.transform = '';
            element.classList.remove('touch-dragging');
            element.setAttribute('aria-grabbed', 'false');
            
            // Remove all drop target highlights
            document.querySelectorAll('.drop-target-hover').forEach(el => {
                el.classList.remove('drop-target-hover');
            });
        } else {
            // This was a tap, not a drag - show the menu if it was a short tap without much movement
            if (touchDuration < 300 && movedDistance < 10) {
                const taskId = element.dataset.taskId;
                if (taskId) {
                    showTaskOptionsMenu(e, taskId, element);
                }
            }
        }
    }, { passive: false });
    
    // Regular mouse drag and drop
    element.addEventListener('dragstart', (e) => {
        isDragging = true;
        draggedElement = element;
        e.dataTransfer.setData('text/plain', element.dataset.taskId);
        e.dataTransfer.setData('session-index', element.dataset.sessionIndex);
        
        // Add a class for styling
        element.classList.add('dragging');
        
        // For better drag image
        setTimeout(() => {
            element.style.opacity = '0.4';
        }, 0);
    });
    
    element.addEventListener('dragend', (e) => {
        isDragging = false;
        draggedElement = null;
        element.classList.remove('dragging');
        element.style.opacity = '';
        
        // Remove all drop target highlights
        document.querySelectorAll('.drop-target-hover').forEach(el => {
            el.classList.remove('drop-target-hover');
        });
    });
}

function setupDropTarget(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        element.classList.add('drop-target-hover');
    });
    
    element.addEventListener('dragleave', (e) => {
        element.classList.remove('drop-target-hover');
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drop-target-hover');
        
        // Get the task ID and session index from the dragged element
        const taskId = e.dataTransfer.getData('text/plain');
        const sessionIndex = parseInt(e.dataTransfer.getData('session-index'));
        
        // Get the target hour and date
        const targetHour = parseInt(element.dataset.hour);
        const targetDate = new Date(element.dataset.date);
        
        if (taskId && targetHour != null && targetDate) {
            rescheduleTask(taskId, sessionIndex, targetHour, targetDate);
        }
    });
}

// Reschedule a task's sessions to a new time
function rescheduleTask(taskId, sessionIndex, targetHour, targetDate) {
    console.log(`🔥 RESCHEDULE: Rescheduling task ${taskId}, session ${sessionIndex} to ${targetDate.toDateString()} at ${targetHour}:00`);
    
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('🔥 RESCHEDULE ERROR: Task not found:', taskId);
        return;
    }
    
    // Get the original session
    const originalSession = task.sessions[sessionIndex];
    if (!originalSession) {
        console.error('🔥 RESCHEDULE ERROR: Session not found:', sessionIndex);
        return;
    }

    // Check if target hour already has 2 tasks (excluding the one being moved)
    const localDateStr = targetDate.toDateString();
    let sessionCount = 0;
    
    tasks.forEach(t => {
        if (!t.sessions) return;
        
        t.sessions.forEach((session, idx) => {
            // Skip the session we're moving
            if (t.id === taskId && idx === sessionIndex) return;
            
            // Convert UTC time to local for comparison
            const localSessionDate = session.startTime instanceof Date ? 
                utcToLocal(session.startTime) : utcToLocal(new Date(session.startTime));
            
            if (localSessionDate.toDateString() === localDateStr && 
                localSessionDate.getHours() === targetHour) {
                sessionCount++;
            }
        });
    });
    
    if (sessionCount >= 2) {
        showNotification('Cannot reschedule: Maximum 2 Pomodoro blocks allowed per hour.');
        return;
    }
    
    // Calculate time difference between original and new target time
    const originalDate = originalSession.startTime instanceof Date ? 
        originalSession.startTime : new Date(originalSession.startTime);
    const originalLocalDate = utcToLocal(originalDate);
    const originalHour = originalLocalDate.getHours();
    const originalDay = new Date(originalLocalDate);
    originalDay.setHours(0, 0, 0, 0);
    
    const targetDay = new Date(targetDate);
    targetDay.setHours(0, 0, 0, 0);
    
    // Calculate time difference in hours
    const daysDiff = (targetDay - originalDay) / (24 * 60 * 60 * 1000);
    const hoursDiff = targetHour - originalHour;
    const totalMillisecondsDiff = (daysDiff * 24 + hoursDiff) * 60 * 60 * 1000;
    
    console.log(`🔥 RESCHEDULE: Time difference: ${daysDiff} days, ${hoursDiff} hours, total: ${totalMillisecondsDiff} ms`);
    
    // Update all subsequent sessions with the same time shift
    for (let i = sessionIndex; i < task.sessions.length; i++) {
        const session = task.sessions[i];
        
        // Only move uncompleted sessions
        if (!session.completed) {
            const oldStart = new Date(session.startTime);
            const oldEnd = new Date(session.endTime);
            
            // Apply the time shift
            const newStart = new Date(oldStart.getTime() + totalMillisecondsDiff);
            const newEnd = new Date(oldEnd.getTime() + totalMillisecondsDiff);
            
            // Update the session times
            session.startTime = newStart;
            session.endTime = newEnd;
            
            console.log(`🔥 RESCHEDULE: Moved session ${i} from ${oldStart.toLocaleString()} to ${newStart.toLocaleString()}`);
        }
    }
    
    // Save to localStorage first as backup
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('🔥 RESCHEDULE: Changes saved to localStorage');
    } catch (e) {
        console.error('🔥 RESCHEDULE ERROR: Failed to save to localStorage:', e);
    }
    
    // Then save to Firestore using promise
    if (currentUser) {
        console.log('🔥 RESCHEDULE: Saving changes to Firestore...');
        saveTasks()
            .then(() => {
                console.log('🔥 RESCHEDULE: Changes saved successfully to Firestore');
            })
            .catch(error => {
                console.error('🔥 RESCHEDULE ERROR: Failed to save to Firestore:', error);
                // Try again after a short delay
                setTimeout(() => saveTasks(), 2000);
            });
    } else {
        console.warn('🔥 RESCHEDULE: User not logged in, skipping Firestore save');
    }
    
    // Re-render
    renderCalendar();
    
    showNotification('Task rescheduled successfully!');
}

// Get tasks for a specific hour
function getTasksForHour(hour) {
    const blocks = [];
    const localDateStr = selectedDate.toDateString();
    
    if (!tasks || tasks.length === 0) {
        return '';
    }
    
    tasks.forEach(task => {
        if (!task.sessions || !Array.isArray(task.sessions)) {
            console.error('Task has no sessions array:', task);
            return;
        }
        
        task.sessions.forEach((session, index) => {
            // Make sure session has valid startTime
            if (!session.startTime) {
                console.error('Session has no startTime:', session);
                return;
            }
            
            // Convert session.startTime from UTC to local for display
            const sessionDate = session.startTime instanceof Date ? 
                utcToLocal(session.startTime) : utcToLocal(new Date(session.startTime));
            
            // Check if session is on the selected day and hour in local time
            if (sessionDate.toDateString() === localDateStr && 
                sessionDate.getHours() === hour) {
                
                // Check if session is completed
                const isCompleted = session.completed || (task.completedSessions >= index + 1);
                
                // Style based on completion status
                const completionClass = isCompleted ? 'completed' : '';
                
                // Only non-completed tasks can be dragged
                const draggableAttr = !isCompleted ? 'draggable="true"' : '';
                
                // Add a play icon to indicate clickable (on the left of the task name)
                const playIcon = !isCompleted ? '<span class="play-icon">▶</span>' : '';
                blocks.push(`
                    <div class="pomodoro-block ${completionClass}" 
                         data-task-id="${task.id}"
                         data-session-index="${index}"
                         ${draggableAttr}
                         title="${task.name} - ${isCompleted ? 'Completed' : 'Click to start, drag to reschedule'}">
                        ${playIcon}${task.name.substring(0, 15)}${task.name.length > 15 ? '...' : ''}
                    </div>
                `);
            }
        });
    });
    
    if (blocks.length === 0) {
        return '';
    }
    
    return blocks.join('');
}

// Render the weekly view
function renderWeeklyView() {
    const calendarContent = document.querySelector('.calendar-content');
    if (!calendarContent) return;
    
    // Create weekly grid container
    const weekGrid = document.createElement('div');
    weekGrid.className = 'week-grid';
    calendarContent.appendChild(weekGrid);
    
    // Create header row with day names
    const headerRow = document.createElement('div');
    headerRow.className = 'week-row header-row';
    
    // Add empty cell for hour labels
    headerRow.innerHTML = '<div class="week-cell hour-label-cell"></div>';
    
    // Create day headers
    for (let i = 0; i < 7; i++) {
        const day = new Date(selectedWeekStart);
        day.setDate(selectedWeekStart.getDate() + i);
        
        const isToday = day.toDateString() === new Date().toDateString();
        const dayName = day.toLocaleDateString(undefined, { weekday: 'short' });
        const dayNum = day.getDate();
        
        headerRow.innerHTML += `
            <div class="week-cell day-header ${isToday ? 'today' : ''}">
                <div class="day-name">${dayName}</div>
                <div class="day-number">${dayNum}</div>
            </div>
        `;
    }
    
    weekGrid.appendChild(headerRow);
    
    // Create hour rows
    for (let hour = 0; hour < 24; hour++) {
        const hourRow = document.createElement('div');
        hourRow.className = 'week-row';
        
        // Add hour label
        hourRow.innerHTML = `
            <div class="week-cell hour-label">
                ${formatHour(hour)}
            </div>
        `;
        
        // Add cells for each day
        for (let i = 0; i < 7; i++) {
            const day = new Date(selectedWeekStart);
            day.setDate(selectedWeekStart.getDate() + i);
            day.setHours(hour, 0, 0, 0);
            
            // Get tasks for this hour and day
            const hourBlocks = renderWeeklyHourBlocks(day);
            
            const cell = document.createElement('div');
            cell.className = 'week-cell hour-cell';
            cell.dataset.hour = hour;
            cell.dataset.date = day.toISOString();
            
            const now = new Date();
            if (now.getHours() === hour && 
                now.toDateString() === day.toDateString()) {
                cell.classList.add('current-hour');
            }
            
            cell.innerHTML = `
                <div class="hour-blocks" data-hour="${hour}" data-date="${day.toISOString()}">
                    ${hourBlocks}
                    <button class="add-task-hour-btn" title="Add task at ${formatHour(hour)}">+</button>
                </div>
            `;
            
            // Add event listener for adding task at this time
            cell.addEventListener('click', (e) => {
                // Don't trigger if clicking on a task or the add button directly
                if (!e.target.closest('.pomodoro-block') && !e.target.classList.contains('add-task-hour-btn')) {
                    handleHourClick(hour, day);
                }
            });
            
            // Also add click handler to the add button
            const addButton = cell.querySelector('.add-task-hour-btn');
            if (addButton) {
                addButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleHourClick(hour, day);
                });
            }
            
            // Handle task actions
            const taskBlocks = cell.querySelectorAll('.pomodoro-block:not(.completed)');
            taskBlocks.forEach(block => {
                // Setup drag and drop (now includes click handler for options menu)
                setupDragAndDrop(block);
            });
            
            // Make hour blocks a drop target
            const hourBlocksContainer = cell.querySelector('.hour-blocks');
            setupDropTarget(hourBlocksContainer);
            
            hourRow.appendChild(cell);
        }
        
        weekGrid.appendChild(hourRow);
    }
}

// Render the task blocks for a specific hour and day in the weekly view
function renderWeeklyHourBlocks(date) {
    const blocks = [];
    const hour = date.getHours();
    const localDateStr = date.toDateString();
    
    if (!tasks || tasks.length === 0) {
        return '';
    }
    
    tasks.forEach(task => {
        if (!task.sessions || !Array.isArray(task.sessions)) {
            console.error('Task has no sessions array:', task);
            return;
        }
        
        task.sessions.forEach((session, index) => {
            // Make sure session has valid startTime
            if (!session.startTime) {
                console.error('Session has no startTime:', session);
                return;
            }
            
            // Convert session.startTime from UTC to local for display
            const sessionDate = session.startTime instanceof Date ? 
                utcToLocal(session.startTime) : utcToLocal(new Date(session.startTime));
            
            // Check if session is on the selected day and hour
            if (sessionDate.toDateString() === localDateStr && 
                sessionDate.getHours() === hour) {
                
                // Check if session is completed
                const isCompleted = session.completed || (task.completedSessions >= index + 1);
                
                // Style based on completion status
                const completionClass = isCompleted ? 'completed' : '';
                
                // Make it draggable for non-completed tasks
                const draggableAttr = !isCompleted ? 'draggable="true"' : '';
                
                // Add a play icon to indicate clickable
                const playIcon = !isCompleted ? '<span class="play-icon">▶</span>' : '';
                
                blocks.push(`
                    <div class="pomodoro-block weekly-block ${completionClass}" 
                         data-task-id="${task.id}"
                         data-session-index="${index}"
                         ${draggableAttr}
                         title="${task.name} - ${isCompleted ? 'Completed' : 'Click to start, drag to reschedule'}">
                        ${playIcon}
                        ${task.name.substring(0, 10)}${task.name.length > 10 ? '...' : ''}
                    </div>
                `);
            }
        });
    });

    if (blocks.length === 0) {
        return '';
    }

    return blocks.join('');
}

// Notifications
function showNotification(message) {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        new Notification(message);
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(message);
            }
        });
    }
}

// Handle click on an hour to create a task
function handleHourClick(hour, date) {
    // Check if there are already 2 sessions in this hour
    const localDate = new Date(date);
    const localDateStr = localDate.toDateString();
    let sessionCount = 0;
    
    tasks.forEach(task => {
        if (!task.sessions) return;
        task.sessions.forEach(session => {
            // Convert UTC time to local for comparison
            const localSessionDate = session.startTime instanceof Date ? 
                utcToLocal(session.startTime) : utcToLocal(new Date(session.startTime));
            
            if (localSessionDate.toDateString() === localDateStr && 
                localSessionDate.getHours() === hour) {
                sessionCount++;
            }
        });
    });
    
    if (sessionCount >= 2) {
        showNotification('Maximum 2 Pomodoro blocks allowed per hour.');
        return;
    }

    console.log(`Preparing to create task at hour ${hour} on ${localDate.toLocaleDateString()}`);
    
    // Create an exact date for this hour (in local time)
    const exactDateTime = new Date(date);
    exactDateTime.setHours(hour, 0, 0, 0);
    
    console.log(`Exact local date-time: ${exactDateTime.toLocaleString()}`);
    console.log(`Local hour: ${exactDateTime.getHours()}`);

    // Format the date for the datetime-local input (YYYY-MM-DDTHH:MM format)
    const year = exactDateTime.getFullYear();
    const month = String(exactDateTime.getMonth() + 1).padStart(2, '0');
    const day = String(exactDateTime.getDate()).padStart(2, '0');
    const hourStr = String(exactDateTime.getHours()).padStart(2, '0');
    const minuteStr = String(exactDateTime.getMinutes()).padStart(2, '0');
    
    const dateTimeStr = `${year}-${month}-${day}T${hourStr}:${minuteStr}`;
    
    // Set the task form's due date
    const taskDueDateInput = document.getElementById('task-due-date');
    taskDueDateInput.value = dateTimeStr;
    
    // Store the exact local date/time
    taskDueDateInput.dataset.exactLocalTime = exactDateTime.getTime().toString();
    
    // Set a default name based on the time
    const taskNameInput = document.getElementById('task-name');
    taskNameInput.value = `Task at ${formatHour(hour)}`;
    
    // Set default duration to 1 hour
    const taskDurationInput = document.getElementById('task-duration');
    taskDurationInput.value = "1";
    
    // Focus the form
    taskNameInput.focus();
    taskNameInput.select();
    
    // If on mobile, open the sidebar
    if (window.innerWidth <= 768) {
        sidebar.classList.add('active');
        setTimeout(() => {
            taskForm.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
}

// Utility functions
function formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
}

// Initialize
renderTasks();

// Create a function to reset all tasks and generate new test data
function resetAndCreateTestTasks() {
    if (currentUser) {
        // Clear tasks in Firestore
        db.collection('users').doc(currentUser.uid)
            .set({ tasks: [] }, { merge: true })
            .then(() => {
                console.log('Firestore tasks deleted successfully');
                tasks = [];
                createTestTasksForToday();
            })
            .catch(error => {
                console.error('Error deleting Firestore tasks:', error);
                // Try anyway
                tasks = [];
                createTestTasksForToday();
            });
    } else {
        // Clear localStorage
        localStorage.removeItem('tasks');
        tasks = [];
        createTestTasksForToday();
    }
}

// If no tasks exist and we're in a development environment, add a test button
if (tasks.length === 0) {
    console.log("No tasks found, adding test data generation button");
    addTestDataButton();
} else {
    renderCalendar();
    // Inspect existing tasks
    inspectTasks();
}

// For development purposes only - remove in production
// resetAndCreateTestTasks();

// Add a button to the UI to generate test tasks for development purposes
// This is safer than automatically generating test tasks
function addTestDataButton() {
    // Only add in development environments or when testing
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.protocol === 'file:') {
        
        const container = document.querySelector('.view-toggle');
        const testButton = document.createElement('button');
        testButton.textContent = 'Generate Test Data';
        testButton.className = 'test-data-button';
        testButton.style.marginLeft = 'auto';
        testButton.addEventListener('click', resetAndCreateTestTasks);
        container.appendChild(testButton);
        
        console.log('Test data button added for development');
    }
}

// Add a debug function to check Firebase connection
function debugFirebaseConnection() {
    // Check if Firebase is initialized
    if (typeof firebase !== 'undefined') {
        console.log('🔥 FIREBASE DEBUG: Firebase SDK loaded successfully');
        
        // Check auth status
        if (auth) {
            console.log('🔥 FIREBASE DEBUG: Auth initialized');
            const user = auth.currentUser;
            if (user) {
                console.log('🔥 FIREBASE DEBUG: User signed in as:', user.email);
                console.log('🔥 FIREBASE DEBUG: User ID:', user.uid);
            } else {
                console.log('🔥 FIREBASE DEBUG: No user signed in');
            }
        } else {
            console.error('🔥 FIREBASE DEBUG: Auth not initialized');
        }
        
        // Check Firestore connection
        if (db) {
            console.log('🔥 FIREBASE DEBUG: Firestore initialized');
            
            // Run a simple test query
            db.collection('_connectionTest')
                .doc('test')
                .set({ timestamp: firebase.firestore.FieldValue.serverTimestamp() })
                .then(() => {
                    console.log('🔥 FIREBASE DEBUG: Successfully wrote to Firestore');
                    return db.collection('_connectionTest').doc('test').get();
                })
                .then(doc => {
                    console.log('🔥 FIREBASE DEBUG: Successfully read from Firestore');
                    console.log('🔥 FIREBASE DEBUG: Server timestamp:', doc.data()?.timestamp);
                })
                .catch(error => {
                    console.error('🔥 FIREBASE DEBUG: Firestore error:', error);
                });
        } else {
            console.error('🔥 FIREBASE DEBUG: Firestore not initialized');
        }
    } else {
        console.error('🔥 FIREBASE DEBUG: Firebase SDK not loaded');
    }
}

// Run debug function when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(debugFirebaseConnection, 2000); // Wait 2 seconds for Firebase to initialize
    
    // Add a debug button in development environments
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.protocol === 'file:') {
        
        const container = document.querySelector('.sidebar-header');
        const debugButton = document.createElement('button');
        debugButton.textContent = '🔥';
        debugButton.title = 'Test Firebase Connection';
        debugButton.className = 'firebase-debug-button';
        debugButton.style.marginLeft = '10px';
        debugButton.addEventListener('click', debugFirebaseConnection);
        container.appendChild(debugButton);
    }
});

// Add this function near the end of the file
function debugFullFirebaseSystem() {
    console.log('===== FULL FIREBASE SYSTEM DEBUG =====');
    
    // Check if Firebase is initialized
    if (!firebase.app) {
        console.error('Firebase not initialized!');
        alert('Firebase not initialized! Check console for details.');
        return;
    }
    
    // Check authentication
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('No user is signed in');
        alert('Error: No user is signed in. Please log in first.');
        return;
    }
    
    console.log('Current user:', user.email, 'UID:', user.uid);
    console.log('Current local tasks:', tasks.length, tasks);
    
    // First, try to connect with a simple write/read to test connectivity
    const testDocRef = firebase.firestore().collection('_connectionTest').doc(user.uid);
    const testData = { 
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent,
        test: 'Connection Test' 
    };
    
    console.log('🔥 STEP 1: Testing basic Firestore connectivity...');
    
    testDocRef.set(testData)
        .then(() => {
            console.log('🔥 STEP 1 SUCCESS: Write to test document completed');
            
            // Read back the test document
            return testDocRef.get();
        })
        .then((doc) => {
            if (doc.exists) {
                console.log('🔥 STEP 1 SUCCESS: Test document read successfully', doc.data());
                
                // Proceed to step 2 - retrieve user document
                console.log('🔥 STEP 2: Reading user document...');
                return firebase.firestore().collection('users').doc(user.uid).get();
            } else {
                throw new Error('Test document not found after writing!');
            }
        })
        .then((doc) => {
            console.log('🔥 STEP 2 SUCCESS: User document read status:', doc.exists ? 'EXISTS' : 'DOES NOT EXIST');
            if (doc.exists) {
                console.log('User document data:', doc.data());
                
                if (doc.data().tasks) {
                    console.log('Tasks found in user document:', doc.data().tasks.length);
                } else {
                    console.log('No tasks array found in user document');
                }
            }
            
            // Proceed to step 3 - attempt to write a test task
            console.log('🔥 STEP 3: Attempting to write a test task...');
            
            // Create a test task
            const testTask = {
                id: 'debug-test-' + Date.now(),
                name: 'Firebase Debug Test Task',
                dueDate: new Date().toISOString(),
                duration: 1,
                completedSessions: 0,
                totalSessions: 4,
                sessions: [{
                    id: 'test-session-' + Date.now(),
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
                    isBreak: false,
                    completed: false
                }]
            };
            
            return firebase.firestore().collection('users').doc(user.uid)
                .set({
                    tasks: [testTask],
                    lastUpdated: new Date().toISOString(),
                    debugInfo: {
                        timestamp: new Date().toISOString(),
                        browser: navigator.userAgent
                    }
                }, { merge: true });
        })
        .then(() => {
            console.log('🔥 STEP 3 SUCCESS: Test task written successfully');
            
            // Verify the write
            console.log('🔥 STEP 4: Verifying test task was saved...');
            return firebase.firestore().collection('users').doc(user.uid).get();
        })
        .then((doc) => {
            if (doc.exists && doc.data().tasks) {
                console.log('🔥 STEP 4 SUCCESS: User document read after test task write:', doc.data().tasks.length, 'tasks found');
                console.log('Tasks data:', JSON.stringify(doc.data().tasks));
                alert('Firebase debugging completed successfully! Check the console for detailed results.');
            } else {
                console.error('🔥 STEP 4 FAILURE: Task write verification failed', doc.exists);
                alert('Firebase test completed with errors. Check console for details.');
            }
        })
        .catch((error) => {
            console.error('🔥 FIREBASE DEBUG ERROR:', error);
            alert('Firebase test failed: ' + error.message);
        });
}

// Always show the next upcoming task in the main section
function showUpcomingTask() {
    // Find the next session across all tasks
    let nextTask = null;
    let nextSessionTime = null;
    tasks.forEach(task => {
        const nextSession = task.sessions.find((session, idx) => !session.completed && idx === task.completedSessions);
        if (nextSession) {
            const sessionDate = nextSession.startTime instanceof Date ? nextSession.startTime : new Date(nextSession.startTime);
            if (!nextSessionTime || sessionDate < nextSessionTime) {
                nextSessionTime = sessionDate;
                nextTask = task;
            }
        }
    });
    if (nextTask) {
        currentTask = nextTask;
        currentTaskName.textContent = nextTask.name;
        currentSession = nextTask.completedSessions + 1;
        totalSessions = nextTask.totalSessions;
        currentSessionDisplay.textContent = currentSession;
        totalSessionsDisplay.textContent = totalSessions;
    } else {
        currentTask = null;
        currentTaskName.textContent = 'No task selected';
        currentSessionDisplay.textContent = '1';
        totalSessionsDisplay.textContent = '4';
    }
}

// Call showUpcomingTask on load and after tasks change
renderTasks = (function(orig) {
    return function() {
        orig.apply(this, arguments);
        showUpcomingTask();
    };
}(renderTasks));

// Free timer option
const freeTimerBtn = document.createElement('button');
freeTimerBtn.textContent = 'Start Free Timer';
freeTimerBtn.className = 'timer-btn free-timer-btn';
freeTimerBtn.addEventListener('click', () => {
    currentTask = null;
    currentTaskName.textContent = 'Free Timer';
    currentSessionDisplay.textContent = '1';
    totalSessionsDisplay.textContent = '1';
    
    // Reset and start timer
    clearInterval(timer);
    timeLeft = POMODORO_DURATION;
    isBreak = false;
    
    // Update display before starting
    updateTimerDisplay();
    updateProgressBar();
    
    // Start the timer
    startTimer();
});
document.querySelector('.timer-controls').appendChild(freeTimerBtn);

// Add some CSS for the options menu
const styleTag = document.createElement('style');
styleTag.innerHTML = `
.task-options-menu {
    background: #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    z-index: 1000;
}
.task-options-menu .option {
    padding: 8px 16px;
    cursor: pointer;
    white-space: nowrap;
}
.task-options-menu .option:hover {
    background: #444;
}
`;
document.head.appendChild(styleTag);

// Enhanced automatic task saving and synchronization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize task data synchronization status tracker
    window.lastSavedTasksHash = '';
    
    // Function to calculate a simple hash of tasks for change detection
    function calculateTasksHash() {
        try {
            return JSON.stringify(tasks).length + '-' + tasks.length;
        } catch (e) {
            return Date.now().toString();
        }
    }
    
    // Function to check if tasks have changed and need saving
    function checkAndSaveTasks() {
        if (!currentUser) return Promise.resolve();
        
        const currentHash = calculateTasksHash();
        
        // Only save if tasks have changed since last save
        if (currentHash !== window.lastSavedTasksHash) {
            console.log('🔄 AUTO SYNC: Tasks have changed, saving automatically...');
            window.lastSavedTasksHash = currentHash;
            
            return saveTasks().then(() => {
                console.log('🔄 AUTO SYNC: Tasks saved automatically');
            }).catch(error => {
                console.error('🔄 AUTO SYNC ERROR:', error);
                // Reset hash so we'll try again
                window.lastSavedTasksHash = '';
            });
        } else {
            console.log('🔄 AUTO SYNC: No changes detected, skipping save');
            return Promise.resolve();
        }
    }
    
    // Save whenever the page visibility changes (user tabs back in)
    window.addEventListener('visibilitychange', () => {
        // When user returns to the tab, force a refresh of data
        if (document.visibilityState === 'visible' && currentUser) {
            console.log('🔄 AUTO SYNC: Page visibility changed to visible, refreshing data...');
            // Check if we need to save any changes first
            checkAndSaveTasks().then(() => {
                // Then refresh from Firestore
                // Unsubscribe from current listener if any
                if (window.firestoreTaskListener) {
                    window.firestoreTaskListener();
                    window.firestoreTaskListener = null;
                }
                
                // Reload tasks with a fresh listener
                loadTasks();
            });
        } else if (document.visibilityState === 'hidden' && currentUser) {
            // Save when the user leaves the tab
            console.log('🔄 AUTO SYNC: Page visibility changed to hidden, saving data...');
            checkAndSaveTasks();
        }
    });
    
    // Also save when user is about to leave the page
    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            console.log('🔄 AUTO SYNC: Page unloading, saving changes...');
            // Sync to localStorage for sure
            try {
                localStorage.setItem('tasks', JSON.stringify(tasks));
            } catch (e) {
                console.error('Failed to save to localStorage on unload:', e);
            }
            
            // Try to save to Firestore (may not complete if page closes too quickly)
            saveTasks();
        }
    });
    
    // Run auto-save frequently
    const autoSaveInterval = setInterval(() => {
        if (currentUser) {
            checkAndSaveTasks();
        }
    }, 5000); // Check every 5 seconds
    
    // Also periodically verify data with Firestore
    setInterval(() => {
        if (currentUser) {
            console.log('🔄 AUTO SYNC: Performing verification check...');
            
            // Verify data in Firestore matches our local data
            db.collection('users').doc(currentUser.uid).get()
                .then(doc => {
                    if (doc.exists && doc.data().tasks) {
                        console.log('🔄 AUTO SYNC: Verification found', doc.data().tasks.length, 'tasks in Firestore');
                        
                        // Check if the number of tasks matches
                        if (doc.data().tasks.length !== tasks.length) {
                            console.log('🔄 AUTO SYNC: Task count mismatch, forcing save...');
                            saveTasks();
                        }
                    } else {
                        console.error('🔄 AUTO SYNC: Verification failed - no tasks found in Firestore');
                        // Force a save if no tasks found
                        saveTasks();
                    }
                })
                .catch(error => {
                    console.error('🔄 AUTO SYNC ERROR:', error);
                });
        }
    }, 30 * 1000); // Check every 30 seconds
    
    // Add logout event listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log('Logging out user...');
            
            // Clear auto-save interval
            clearInterval(autoSaveInterval);
            
            // Save any unsaved changes before logging out
            if (currentUser) {
                try {
                    console.log('🔥 LOGOUT: Saving tasks before logout...');
                    await saveTasks();
                    console.log('🔥 LOGOUT: Tasks saved successfully before logout');
                } catch (error) {
                    console.error('🔥 LOGOUT ERROR: Failed to save tasks before logout:', error);
                    // Continue with logout even if save fails
                }
            }
            
            // Clean up Firestore listener if it exists
            if (window.firestoreTaskListener) {
                window.firestoreTaskListener();
                console.log('🔥 FIREBASE: Unsubscribed from Firestore listener');
                window.firestoreTaskListener = null;
            }
            
            try {
                await firebase.auth().signOut();
                console.log('User successfully logged out');
                // The redirect will happen automatically due to the auth state change listener
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        });
    }
    
    // Set up periodic task refresh to handle any sync issues
    setInterval(() => {
        if (currentUser) {
            console.log('🔥 FIREBASE: Performing periodic task refresh...');
            // Force a refresh by temporarily unsubscribing and resubscribing
            if (window.firestoreTaskListener) {
                window.firestoreTaskListener();
                loadTasks(); // This will create a new listener
            }
        }
    }, 60 * 1000); // Refresh every 60 seconds
}); 

// Add a robust direct Firebase test and debug indicator
document.addEventListener('DOMContentLoaded', () => {
    // Never show debug, completely disabled
    const isDebugEnabled = false;
    
    // Debug functions will still log to console but not display visually
    const debugStatusEl = document.createElement('div');
    
    // Helper function to retry an operation - kept for manual testing
    async function retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < maxRetries) {
                    // Wait before next retry
                    await new Promise(resolve => setTimeout(resolve, delay));
                    // Increase delay for next attempt
                    delay *= 1.5;
                }
            }
        }
        
        throw lastError;
    }
    
    // Function to directly test Firebase Firestore - available for manual testing
    window.testFirestore = async function() {
        // Never show debug elements
        return;
    }
}); 

// Theme toggle functionality
function setTheme(isDark) {
    document.body.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Update all toggle switches
    const themeSwitch = document.getElementById('theme-switch');
    const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
    
    if (themeSwitch) {
        themeSwitch.checked = isDark;
    }
    
    if (mobileThemeSwitch) {
        mobileThemeSwitch.checked = isDark;
    }
}

// Listen for theme switch changes when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const themeSwitch = document.getElementById('theme-switch');
    const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
    
    // Add listeners to both switches
    if (themeSwitch) {
        themeSwitch.addEventListener('change', function() {
            setTheme(this.checked);
        });
    }
    
    if (mobileThemeSwitch) {
        mobileThemeSwitch.addEventListener('change', function() {
            setTheme(this.checked);
        });
    }
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme === 'dark');
    } else {
        // Default to dark theme
        setTheme(true);
    }
}); 

// Complete task function
function completeTask() {
    // Check if completing a task or just free sessions
    if (currentTask) {
        console.log('Completing task:', currentTask.name);
        
        // Find the task in our tasks array
        const task = tasks.find(t => t.id === currentTask.id);
        if (!task) {
            console.error('Task not found in tasks array');
            return;
        }
        
        // Update completed sessions
        task.completedSessions = Math.min(task.totalSessions, task.completedSessions + currentSession);
        
        // Mark sessions as completed
        for (let i = 0; i < currentSession; i++) {
            if (task.sessions[i]) {
                task.sessions[i].completed = true;
            }
        }
        
        // Add journey points for task completion if all sessions are done
        if (task.completedSessions >= task.totalSessions && window.journeyTracker) {
            window.journeyTracker.addTaskCompletion();
        }
        
        // Save to localStorage and Firestore
        localStorage.setItem('tasks', JSON.stringify(tasks));
        
        if (currentUser) {
            saveTasks()
                .then(() => {
                    console.log('Task saved successfully to Firestore');
                })
                .catch(error => {
                    console.error('Failed to save to Firestore:', error);
                    setTimeout(() => saveTasks(), 2000);
                });
        }
        
        // Show notification
        const audio = new Audio('https://actions.google.com/sounds/v1/notifications/crisp_success_chime.ogg');
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        alert(`Task "${currentTask.name}" completed!`);
    } else {
        // This was a free session without a task
        console.log('Completing free pomodoro sessions');
        
        // Show notification
        const audio = new Audio('https://actions.google.com/sounds/v1/notifications/crisp_success_chime.ogg');
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        alert(`Completed ${currentSession} pomodoro sessions!`);
    }
    
    // Reset timer display
    resetTimer();
    
    // Reset current task
    currentTask = null;
    currentTaskName.textContent = 'No task selected';
    
    // Reset session counter
    currentSession = 1;
    totalSessions = 4;
    currentSessionDisplay.textContent = currentSession;
    totalSessionsDisplay.textContent = totalSessions;
    updateProgressBar();
    
    // Clear the timer state since the task is completed
    localStorage.removeItem('timerState');
    sessionStorage.removeItem('timerState');
    
    // Re-render UI
    renderTasks();
    renderCalendar();
}

// Helper function to format time for display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}