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

// Theme Toggle
themeSwitch.addEventListener('change', () => {
    document.body.dataset.theme = themeSwitch.checked ? 'dark' : 'light';
    localStorage.setItem('theme', themeSwitch.checked ? 'dark' : 'light');
});

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    themeSwitch.checked = savedTheme === 'dark';
    document.body.dataset.theme = savedTheme;
}

// Task Management
class Task {
    constructor(name, dueDate, duration) {
        this.id = Date.now().toString();
        this.name = name;
        
        // Ensure dueDate is a proper Date object
        this.dueDate = dueDate instanceof Date ? new Date(dueDate) : new Date(dueDate);
        
        this.duration = duration;
        this.completedSessions = 0;
        this.totalSessions = Math.ceil(duration * 4); // Convert hours to pomodoro sessions
        this.sessions = this.generateSessions();
        
        console.log(`Created task: ${this.name} with ${this.totalSessions} sessions`);
    }

    generateSessions() {
        const sessions = [];
        
        // We'll start from now and schedule forward
        // This ensures sessions are on the current day or future days
        let currentTime = new Date();
        
        // If it's after working hours, start tomorrow
        if (currentTime.getHours() >= WORKING_HOURS.end) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(WORKING_HOURS.start, 0, 0, 0);
        }
        
        // If before working hours, start at working hours start today
        if (currentTime.getHours() < WORKING_HOURS.start) {
            currentTime.setHours(WORKING_HOURS.start, 0, 0, 0);
        }
        
        console.log(`Generating ${this.totalSessions} sessions for task: ${this.name}`);
        console.log(`Starting from time: ${currentTime.toLocaleString()}`);
        
        for (let i = 0; i < this.totalSessions; i++) {
            // If we're outside working hours, move to next day's start
            if (currentTime.getHours() >= WORKING_HOURS.end) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(WORKING_HOURS.start, 0, 0, 0);
            }
            
            // Create session with explicit Date objects
            const startTime = new Date(currentTime.getTime());
            const endTime = new Date(currentTime.getTime() + POMODORO_DURATION * 1000);
            
            const session = {
                id: `session-${i}-${Date.now()}`,
                startTime: startTime,
                endTime: endTime,
                isBreak: false,
                completed: false
            };
            
            console.log(`Created session ${i+1} at ${startTime.toLocaleString()}`);
            sessions.push(session);
            
            // Move time forward by one pomodoro + break
            currentTime.setTime(currentTime.getTime() + (POMODORO_DURATION + BREAK_DURATION) * 1000);
        }
        
        return sessions;
    }
}

// Task Form Handler
function addTaskHandler(e) {
    e.preventDefault();
    const name = document.getElementById('task-name').value;
    const dueDate = document.getElementById('task-due-date').value;
    const duration = parseFloat(document.getElementById('task-duration').value);

    const task = new Task(name, dueDate, duration);
    tasks.push(task);
    saveTasks();
    renderTasks();
    renderCalendar();
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
        
        // Redirect to login page if not on a local file system
        if (window.location.protocol !== 'file:') {
            window.location.href = 'login.html';
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
    if (currentUser) {
        // Load from Firestore
        console.log('🔥 FIREBASE: Attempting to load tasks from Firestore for user:', currentUser.uid);
        
        db.collection('users').doc(currentUser.uid).collection('tasks').doc('taskList')
            .get()
            .then(doc => {
                if (doc.exists && doc.data().tasks) {
                    // Convert date strings back to Date objects
                    const rawTasks = doc.data().tasks;
                    console.log('🔥 FIREBASE SUCCESS: Found', rawTasks.length, 'tasks in Firestore');
                    
                    tasks = processTasks(rawTasks);
                    console.log('🔥 FIREBASE: Tasks processed and ready for use:', tasks.length);
                } else {
                    console.log('🔥 FIREBASE: No tasks found in Firestore, starting with empty array');
                    tasks = [];
                }
                renderTasks();
                renderCalendar();
            })
            .catch(error => {
                console.error('🔥 FIREBASE ERROR: Error loading tasks from Firestore:', error);
                // Fall back to localStorage
                console.log('💾 LOCAL: Falling back to localStorage due to Firestore error');
                tasks = JSON.parse(localStorage.getItem('tasks')) || [];
                renderTasks();
                renderCalendar();
            });
    } else {
        // Load from localStorage
        console.log('💾 LOCAL: Loading from localStorage (not signed in)');
        tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        renderTasks();
        renderCalendar();
    }
}

// Process tasks after loading from Firestore to fix date objects
function processTasks(rawTasks) {
    return rawTasks.map(task => {
        // Convert dueDate string back to Date object
        if (typeof task.dueDate === 'string') {
            task.dueDate = new Date(task.dueDate);
        }
        
        // Convert session date strings back to Date objects
        if (task.sessions && Array.isArray(task.sessions)) {
            task.sessions = task.sessions.map(session => {
                if (session.startTime && typeof session.startTime === 'string') {
                    session.startTime = new Date(session.startTime);
                }
                if (session.endTime && typeof session.endTime === 'string') {
                    session.endTime = new Date(session.endTime);
                }
                return session;
            });
        }
        
        return task;
    });
}

// Save Tasks to Firestore or localStorage
function saveTasks() {
    if (currentUser) {
        // Save to Firestore
        console.log('🔥 FIREBASE: Attempting to save tasks to Firestore for user:', currentUser.uid);
        console.log('🔥 FIREBASE: Number of tasks being saved:', tasks.length);
        
        db.collection('users').doc(currentUser.uid).collection('tasks').doc('taskList')
            .set({ tasks: tasks })
            .then(() => {
                console.log('🔥 FIREBASE SUCCESS: Tasks saved to Firestore successfully');
                
                // Verify by reading back the data
                setTimeout(() => verifyFirestoreData(), 1000);
            })
            .catch(error => {
                console.error('🔥 FIREBASE ERROR: Error saving tasks to Firestore:', error);
                // Fall back to localStorage
                localStorage.setItem('tasks', JSON.stringify(tasks));
            });
    } else {
        // Save to localStorage if not signed in
        console.log('💾 LOCAL: Saving to localStorage (not signed in)');
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
}

// Add a verification function to check if data was properly saved
function verifyFirestoreData() {
    if (!currentUser) return;
    
    console.log('🔥 FIREBASE: Verifying saved data in Firestore...');
    
    db.collection('users').doc(currentUser.uid).collection('tasks').doc('taskList')
        .get()
        .then(doc => {
            if (doc.exists) {
                const firestoreTasks = doc.data().tasks || [];
                console.log('🔥 FIREBASE VERIFICATION: Found', firestoreTasks.length, 'tasks in Firestore');
                console.log('🔥 FIREBASE VERIFICATION: First task:', firestoreTasks[0]?.name || 'No tasks');
            } else {
                console.log('🔥 FIREBASE VERIFICATION: No data found in Firestore!');
            }
        })
        .catch(error => {
            console.error('🔥 FIREBASE VERIFICATION ERROR:', error);
        });
}

// Render Tasks
function renderTasks() {
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
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
        task.sessions = task.generateSessions();
        
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
    currentTask = tasks.find(task => task.id === taskId);
    if (!currentTask) return;

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
    if (timer) return;
    
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
    const hours = Array.from(
        { length: WORKING_HOURS.end - WORKING_HOURS.start }, 
        (_, i) => i + WORKING_HOURS.start
    );
    
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
    
    // Render all working hours from start to end
    for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
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
        element.style.opacity = '0.8';
        
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
        
        if (taskId && targetHour && targetDate) {
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
    
    // Calculate time difference between original and new target time
    const originalDate = new Date(originalSession.startTime);
    const originalHour = originalDate.getHours();
    const originalDay = new Date(originalDate);
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
    const dateStr = selectedDate.toDateString();
    
    tasks.forEach(task => {
        task.sessions.forEach((session, index) => {
            // Convert session.startTime to a Date object if it's a string
            if (typeof session.startTime === 'string') {
                session.startTime = new Date(session.startTime);
            }
            
            const sessionDate = new Date(session.startTime);
            
            // Check if session is on the selected day and hour
            if (sessionDate.toDateString() === dateStr && 
                sessionDate.getHours() === hour) {
                
                // Check if session is completed
                const isCompleted = session.completed || (task.completedSessions >= index + 1);
                
                // Style based on completion status
                const completionClass = isCompleted ? 'completed' : '';
                
                // Only non-completed tasks can be dragged
                const draggableAttr = !isCompleted ? 'draggable="true"' : '';
                
                // Add a play icon to indicate clickable
                const playIcon = !isCompleted ? '<span class="play-icon">▶</span>' : '';
                
                blocks.push(`
                    <div class="pomodoro-block ${completionClass}" 
                         data-task-id="${task.id}"
                         data-session-index="${index}"
                         ${draggableAttr}
                         title="${task.name} - ${isCompleted ? 'Completed' : 'Click to start, drag to reschedule'}">
                        ${playIcon}
                        ${task.name.substring(0, 15)}${task.name.length > 15 ? '...' : ''}
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
    for (let hour = WORKING_HOURS.start; hour < WORKING_HOURS.end; hour++) {
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
    const dateStr = date.toDateString();
    
    tasks.forEach(task => {
        task.sessions.forEach((session, index) => {
            // Convert session.startTime to a Date object if it's a string
            if (typeof session.startTime === 'string') {
                session.startTime = new Date(session.startTime);
            }
            
            const sessionDate = new Date(session.startTime);
            
            // Check if session is on the selected day and hour
            if (sessionDate.toDateString() === dateStr && 
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
    console.log(`Preparing to create task at hour ${hour} on ${date.toDateString()}`);
    
    // Set the task form's due date to the clicked hour/date
    const taskDueDateInput = document.getElementById('task-due-date');
    
    // Format the date for the datetime-local input
    const taskDate = new Date(date);
    taskDate.setHours(hour, 0, 0, 0);
    const dateStr = taskDate.toISOString().slice(0, 16);
    
    taskDueDateInput.value = dateStr;
    
    // Set a default name based on the time
    const taskNameInput = document.getElementById('task-name');
    taskNameInput.value = `Task at ${formatHour(hour)}`;
    
    // Set default duration to 1 hour
    const taskDurationInput = document.getElementById('task-duration');
    taskDurationInput.value = "1";
    
    // Focus the form
    taskNameInput.focus();
    taskNameInput.select(); // Select the text so user can immediately type over it
    
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

// Create a test task for today (for debugging)
function createTestTask() {
    // Create a task for today
    const taskName = "Test Task";
    const dueDate = new Date();
    dueDate.setHours(17, 0, 0, 0); // 5:00 PM today
    const duration = 2; // 2 hours
    
    console.log(`Creating test task: ${taskName} due ${dueDate.toLocaleString()}`);
    
    const task = new Task(taskName, dueDate, duration);
    tasks.push(task);
    saveTasks();
    renderTasks();
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