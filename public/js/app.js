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
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const currentTaskName = document.getElementById('current-task-name');
const currentSessionDisplay = document.getElementById('current-session');
const totalSessionsDisplay = document.getElementById('total-sessions');
const themeSwitch = document.getElementById('theme-switch');
const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
const viewToggleButtons = document.querySelectorAll('.view-toggle button');

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

// Theme Toggle (desktop and mobile)
function setTheme(isDark) {
    document.body.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (themeSwitch) themeSwitch.checked = isDark;
    if (mobileThemeSwitch) mobileThemeSwitch.checked = isDark;
}

if (themeSwitch) {
    themeSwitch.addEventListener('change', () => setTheme(themeSwitch.checked));
}
if (mobileThemeSwitch) {
    mobileThemeSwitch.addEventListener('change', () => setTheme(mobileThemeSwitch.checked));
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    const isDark = savedTheme === 'dark';
    if (themeSwitch) themeSwitch.checked = isDark;
    if (mobileThemeSwitch) mobileThemeSwitch.checked = isDark;
    document.body.dataset.theme = savedTheme;
}

// Time conversion helpers
function localToUTC(localDate) {
    // Create a new date with the exact same timestamp
    // This preserves the local time as a UTC time
    const d = new Date(localDate.getTime());
    // Log for debugging
    console.log(`Converting ${localDate.toLocaleString()} (local) → ${d.toISOString()} (UTC)`);
    return d;
}

function utcToLocal(utcDate) {
    // Create a new date with the exact same timestamp
    // This preserves the UTC time as a local time
    const d = new Date(utcDate.getTime());
    // Log for debugging
    console.log(`Converting ${utcDate.toISOString()} (UTC) → ${d.toLocaleString()} (local)`);
    return d;
}

// Task Management
class Task {
    constructor(name, localDueDate, duration) {
        this.id = Date.now().toString();
        this.name = name;
        
        // Convert local due date to UTC for storage
        const dueDate = localDueDate instanceof Date ? localDueDate : new Date(localDueDate);
        this.dueDate = localToUTC(dueDate);
        
        this.duration = duration;
        this.completedSessions = 0;
        this.totalSessions = Math.ceil(duration * 4); // Convert hours to pomodoro sessions
        this.sessions = this.generateSessions(dueDate); // Pass local date for correct scheduling
    }

    generateSessions(localStartDate) {
        const sessions = [];
        let currentLocalTime = localStartDate instanceof Date ? new Date(localStartDate) : new Date();
        
        // Generate sessions in local time
        for (let i = 0; i < this.totalSessions; i++) {
            const localStartTime = new Date(currentLocalTime.getTime());
            const localEndTime = new Date(currentLocalTime.getTime() + POMODORO_DURATION * 1000);
            
            // Convert and store as UTC
            const session = {
                id: `session-${i}-${Date.now()}`,
                startTime: localToUTC(localStartTime),  // Store in UTC
                endTime: localToUTC(localEndTime),      // Store in UTC
                isBreak: false,
                completed: false
            };
            sessions.push(session);
            
            // Next session starts after pomodoro + break (still in local time)
            currentLocalTime.setTime(currentLocalTime.getTime() + (POMODORO_DURATION + BREAK_DURATION) * 1000);
        }
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
    saveTasks();
    renderTasks();
    renderCalendar();
    
    // Clear the stored data
    dueDateInput.removeAttribute('data-exact-local-time');
    
    taskForm.reset();
}

taskForm.addEventListener('submit', addTaskHandler);

// Check authentication state
auth.onAuthStateChanged(user => {
    if (user) {
        console.log('User is logged in:', user.email);
        currentUser = user;
        loadTasks(); // Load tasks from Firestore
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
        }
    }
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
                    
                    if (task.sessions && Array.isArray(task.sessions)) {
                        task.sessions.forEach(session => {
                            try {
                                // Load session times as UTC
                                if (typeof session.startTime === 'number') {
                                    session.startTime = new Date(session.startTime);
                                } else if (typeof session.startTime === 'string') {
                                    // Handle string cases (for backward compatibility)
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
                                
                                if (typeof session.endTime === 'number') {
                                    session.endTime = new Date(session.endTime);
                                } else if (typeof session.endTime === 'string') {
                                    // Handle string cases (for backward compatibility)
                                    if (session.endTime.includes('T')) {
                                        // ISO string
                                        session.endTime = new Date(session.endTime);
                                    } else {
                                        // Numeric string
                                        session.endTime = new Date(Number(session.endTime));
                                    }
                                } else if (!(session.endTime instanceof Date)) {
                                    const startTime = session.startTime || new Date();
                                    session.endTime = new Date(startTime.getTime() + POMODORO_DURATION * 1000);
                                }
                            } catch (e) {
                                const now = new Date();
                                session.startTime = now;
                                session.endTime = new Date(now.getTime() + POMODORO_DURATION * 1000);
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error processing task from localStorage:', e, task);
                }
            });
            
            tasks = parsedTasks;
            localTasksLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
    
    // If not online, just use localStorage and render
    if (!navigator.onLine) {
        console.warn('Device appears to be offline. Using localStorage tasks only.');
        renderTasks();
        renderCalendar();
        return;
    }
    
    if (currentUser) {
        // Set a timeout to fail gracefully if Firestore is slow or failing
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Firestore load operation timed out after 5 seconds'));
            }, 5000);
        });
        
        // Load from Firestore
        console.log('🔥 FIREBASE: Attempting to load tasks from Firestore for user:', currentUser.uid);
        
        // Get the user document
        const firestorePromise = firebase.firestore().collection('users').doc(currentUser.uid)
            .get()
            .then(doc => {
                if (doc.exists && doc.data().tasks && Array.isArray(doc.data().tasks)) {
                    const firestoreTasks = doc.data().tasks;
                    console.log('🔥 FIREBASE SUCCESS: Found', firestoreTasks.length, 'tasks in Firestore');
                    
                    if (firestoreTasks.length === 0 && localTasksLoaded && tasks.length > 0) {
                        console.log('🔥 FIREBASE: Firestore has 0 tasks but localStorage has tasks, keeping localStorage tasks');
                        // Keep using the localStorage tasks, they might not have been saved to Firestore yet
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
                                        } else if (!(session.endTime instanceof Date)) {
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
                } else {
                    console.log('🔥 FIREBASE: No tasks found in Firestore');
                    
                    // If we already have tasks from localStorage, sync them to Firestore
                    if (localTasksLoaded && tasks.length > 0) {
                        console.log('🔥 FIREBASE: Syncing localStorage tasks to Firestore');
                        saveTasks();
                    }
                }
                
                // Render UI
                renderTasks();
                renderCalendar();
            })
            .catch(error => {
                console.error('🔥 FIREBASE ERROR loading tasks:', error);
                console.log('Using localStorage tasks instead');
                
                // Already loaded from localStorage above
                renderTasks();
                renderCalendar();
            });
        
        // Race between Firebase and timeout
        Promise.race([firestorePromise, timeoutPromise])
            .catch(error => {
                console.error('🔥 FIREBASE LOAD TIMEOUT:', error);
                console.log('Firebase load timed out, using localStorage tasks instead');
                
                // Render what we have from localStorage if we loaded something
                if (localTasksLoaded) {
                    renderTasks();
                    renderCalendar();
                }
            });
    } else {
        // Just render what we have from localStorage
        renderTasks();
        renderCalendar();
    }
}

// Save Tasks to Firestore or localStorage
function saveTasks() {
    // Always save to localStorage as a backup
    try {
        // Save with UTC timestamps
        const serializableTasks = tasks.map(task => {
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
    }
    
    if (!currentUser) {
        console.warn('🔥 FIREBASE: No user logged in, skipping Firestore save');
        return;
    }
    
    // Save to Firestore
    console.log('🔥 FIREBASE: Attempting to save tasks to Firestore for user:', currentUser.uid);
    console.log('🔥 FIREBASE: Number of tasks being saved:', tasks.length);
    
    try {
        // Use the same serializableTasks as above
        const savePromise = firebase.firestore().collection('users').doc(currentUser.uid)
            .set({
                tasks: serializableTasks,
                lastUpdated: new Date().toISOString(),
                deviceInfo: navigator.userAgent
            }, { merge: true });
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firestore operation timed out after 10 seconds')), 10000);
        });
        Promise.race([savePromise, timeoutPromise])
            .then(() => {
                console.log('🔥 FIREBASE SUCCESS: Tasks saved to Firestore successfully');
                setTimeout(() => {
                    verifyFirestoreData();
                }, 1000);
            })
            .catch(error => {
                console.error('🔥 FIREBASE ERROR:', error);
                setTimeout(() => {
                    console.log('🔥 FIREBASE: Retrying save operation after error');
                    firebase.firestore().collection('users').doc(currentUser.uid)
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
                        })
                        .catch(retryError => {
                            console.error('🔥 FIREBASE ERROR ON RETRY:', retryError);
                            alert('Error saving tasks to Firebase. Your tasks have been saved locally as a backup.');
                        });
                }, 2000);
            });
    } catch (error) {
        console.error('Error preparing tasks for Firestore:', error);
    }
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
                <button onclick="startTask('${task.id}')">Start</button>
                <button onclick="editTask('${task.id}')">Edit</button>
                <button onclick="deleteTask('${task.id}')">Delete</button>
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
        task.name = taskNameInput.value;
        task.dueDate = new Date(taskDueDateInput.value);
        task.duration = parseFloat(taskDurationInput.value);
        task.totalSessions = Math.ceil(task.duration * 4);
        task.sessions = task.generateSessions(task.dueDate);
        
        saveTasks();
        renderTasks();
        renderCalendar();
        taskForm.reset();
        
        // Restore original form behavior
        taskForm.removeEventListener('submit', editHandler);
        taskForm.addEventListener('submit', addTaskHandler);
    });
    
    // Focus on the name input for better UX
    taskNameInput.focus();
    
    // If on mobile, scroll to the form
    if (window.innerWidth <= 768) {
        sidebar.classList.add('active');
        setTimeout(() => {
            taskForm.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
}

// Delete Task
function deleteTask(taskId) {
    tasks = tasks.filter(task => task.id !== taskId);
    saveTasks();
    renderTasks();
    renderCalendar();
}

// Start Task
function startTask(taskId) {
    if (!tasks || tasks.length === 0) {
        showNotification('No tasks available');
        return;
    }
    currentTask = tasks.find(task => task.id === taskId);
    if (!currentTask) {
        showNotification('Task not found');
        return;
    }
    // Find the next uncompleted session
    const nextSession = currentTask.sessions.find((session, idx) => !session.completed && idx === currentTask.completedSessions);
    if (nextSession) {
        const now = new Date();
        const sessionDate = nextSession.startTime instanceof Date ? nextSession.startTime : new Date(nextSession.startTime);
        // Only allow starting if session is scheduled for today and current hour
        if (
            now.toDateString() !== sessionDate.toDateString() ||
            now.getHours() !== sessionDate.getHours()
        ) {
            showNotification(`This task is scheduled for ${sessionDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} on ${sessionDate.toLocaleDateString()}. You can't start it now.`);
            return;
        }
    }
    currentTaskName.textContent = currentTask.name;
    currentSession = currentTask.completedSessions + 1;
    totalSessions = currentTask.totalSessions;
    currentSessionDisplay.textContent = currentSession;
    totalSessionsDisplay.textContent = totalSessions;
    resetTimer();
    startTimer();
}

// Timer Functions
function startTimer() {
    if (timer) {
        showNotification('Task already started');
        return;
    }
    timer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            timer = null;
            
            if (!isBreak) {
                currentTask.completedSessions++;
                saveTasks();
                renderTasks();
                
                if (currentTask.completedSessions < currentTask.totalSessions) {
                    isBreak = true;
                    timeLeft = BREAK_DURATION;
                    showNotification('Break time!');
                    startTimer();
                } else {
                    showNotification('Task completed!');
                    resetTimer();
                }
            } else {
                isBreak = false;
                timeLeft = POMODORO_DURATION;
                showNotification('Break over! Back to work!');
                startTimer();
            }
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
}

function resetTimer() {
    clearInterval(timer);
    timer = null;
    timeLeft = POMODORO_DURATION;
    isBreak = false;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    minutesDisplay.textContent = minutes.toString().padStart(2, '0');
    secondsDisplay.textContent = seconds.toString().padStart(2, '0');
}

// Timer Controls
startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);

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
            <button id="prev-day">❮</button>
            <span class="current-date">${dateStr}</span>
            <button id="next-day">❯</button>
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
            <button id="prev-week">❮</button>
            <span class="current-date">${weekStartStr} - ${weekEndStr}</span>
            <button id="next-week">❯</button>
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
            // Click to start task
            block.addEventListener('click', (e) => {
                // Only handle click if not dragging
                if (!isDragging) {
                    const taskId = block.dataset.taskId;
                    if (taskId) {
                        startTask(taskId);
                        
                        // Scroll to timer section
                        document.querySelector('.timer-section').scrollIntoView({ 
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
            
            // Set up drag events
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

function setupDragAndDrop(element) {
    // Add a visual drag handle for better usability
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to reschedule';
    element.appendChild(dragHandle);
    
    // Setup touch events for mobile
    let touchStartX, touchStartY;
    
    element.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        
        // Add a timeout to distinguish between tap and long press
        element.touchTimeout = setTimeout(() => {
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
        if (!element.classList.contains('touch-dragging')) return;
        
        // Prevent scrolling while dragging
        e.preventDefault();
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        // Calculate the distance moved
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        
        // Update element position
        element.style.position = 'absolute';
        element.style.top = `${element.touchOriginalTop + deltaY}px`;
        element.style.left = `${element.touchOriginalLeft + deltaX}px`;
        element.style.zIndex = '1000';
        
        // Find potential drop targets
        const elementsUnderTouch = document.elementsFromPoint(touchX, touchY);
        const dropTarget = elementsUnderTouch.find(el => el.classList.contains('hour-block'));
        
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
        clearTimeout(element.touchTimeout);
        
        // If we're in drag mode
        if (element.classList.contains('touch-dragging')) {
            const touchX = e.changedTouches[0].clientX;
            const touchY = e.changedTouches[0].clientY;
            
            // Find the drop target
            const elementsUnderTouch = document.elementsFromPoint(touchX, touchY);
            const dropTarget = elementsUnderTouch.find(el => el.classList.contains('hour-block'));
            
            if (dropTarget) {
                // Get the task ID and session index from the dragged element
                const taskId = element.dataset.taskId;
                const sessionIndex = parseInt(element.dataset.sessionIndex);
                
                // Get the target hour and date
                const targetHour = parseInt(dropTarget.dataset.hour);
                const targetDate = new Date(dropTarget.dataset.date);
                
                if (taskId && targetHour && targetDate) {
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
    console.log(`Rescheduling task ${taskId}, session ${sessionIndex} to ${targetDate.toDateString()} at ${targetHour}:00`);
    
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('Task not found:', taskId);
        return;
    }
    
    // Get the original session
    const originalSession = task.sessions[sessionIndex];
    if (!originalSession) {
        console.error('Session not found:', sessionIndex);
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
    
    console.log(`Time difference: ${daysDiff} days, ${hoursDiff} hours, total: ${totalMillisecondsDiff} ms`);
    
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
            
            console.log(`Moved session ${i} from ${oldStart.toLocaleString()} to ${newStart.toLocaleString()}`);
        }
    }
    
    // Save and re-render
    saveTasks();
    renderCalendar();
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
            
            // Handle task start
            const taskBlocks = cell.querySelectorAll('.pomodoro-block:not(.completed)');
            taskBlocks.forEach(block => {
                block.addEventListener('click', (e) => {
                    if (!isDragging) {
                        const taskId = block.dataset.taskId;
                        if (taskId) {
                            startTask(taskId);
                            document.querySelector('.timer-section').scrollIntoView({ 
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }
                });
                
                // Set up drag events
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
        db.collection('users').doc(currentUser.uid).collection('tasks').doc('taskList')
            .delete()
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
freeTimerBtn.style.marginLeft = '1rem';
freeTimerBtn.style.background = '#4ecdc4';
freeTimerBtn.style.color = 'white';
freeTimerBtn.style.border = 'none';
freeTimerBtn.style.borderRadius = '8px';
freeTimerBtn.style.padding = '0.8rem 1.5rem';
freeTimerBtn.style.cursor = 'pointer';
freeTimerBtn.addEventListener('click', () => {
    currentTask = null;
    currentTaskName.textContent = 'Free Timer';
    currentSessionDisplay.textContent = '1';
    totalSessionsDisplay.textContent = '1';
    resetTimer();
    startTimer();
});
document.querySelector('.timer-controls').appendChild(freeTimerBtn); 