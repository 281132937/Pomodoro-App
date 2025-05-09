// Constants
const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes in seconds
const WORKING_HOURS = {
    start: 8, // 8 AM
    end: 20   // 8 PM
};
// Current view state
let currentView = 'daily';
let selectedDate = new Date(); // For daily view
let selectedWeekStart = new Date(); // For weekly view
selectedWeekStart.setDate(selectedWeekStart.getDate() - selectedWeekStart.getDay()); // Set to Sunday
selectedWeekStart.setHours(0, 0, 0, 0);

// State
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
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
        this.dueDate = new Date(dueDate);
        this.duration = duration;
        this.completedSessions = 0;
        this.totalSessions = Math.ceil(duration * 4); // Convert hours to pomodoro sessions
        this.sessions = this.generateSessions();
    }

    generateSessions() {
        const sessions = [];
        let currentTime = new Date(this.dueDate);
        currentTime.setHours(WORKING_HOURS.start, 0, 0, 0);

        for (let i = 0; i < this.totalSessions; i++) {
            if (currentTime.getHours() >= WORKING_HOURS.end) {
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(WORKING_HOURS.start, 0, 0, 0);
            }

            sessions.push({
                startTime: new Date(currentTime),
                endTime: new Date(currentTime.getTime() + POMODORO_DURATION * 1000),
                isBreak: false,
                completed: false
            });

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

// Save Tasks to localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Render Tasks
function renderTasks() {
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.innerHTML = `
            <h3>${task.name}</h3>
            <p>Due: ${task.dueDate.toLocaleString()}</p>
            <p>Progress: ${task.completedSessions}/${task.totalSessions} sessions</p>
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
    calendar.innerHTML = '';
    
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
        
        renderDailyView();
    } else {
        // For weekly view
        const weekEndDate = new Date(selectedWeekStart);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        
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
        
        renderWeeklyView();
    }
}

// Daily View Rendering
function renderDailyView() {
    const hours = Array.from({ length: WORKING_HOURS.end - WORKING_HOURS.start }, (_, i) => i + WORKING_HOURS.start);
    
    hours.forEach(hour => {
        const hourElement = document.createElement('div');
        hourElement.className = 'calendar-hour';
        hourElement.innerHTML = `
            <div class="hour-label">${formatHour(hour)}</div>
            <div class="hour-blocks">
                ${renderDailyHourBlocks(hour)}
            </div>
        `;
        calendar.appendChild(hourElement);
    });
}

// Weekly View Rendering
function renderWeeklyView() {
    // Create week header
    const weekHeader = document.createElement('div');
    weekHeader.className = 'week-header';
    
    // Create day headers
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let headerHTML = '<div class="week-time-header">Time</div>';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(selectedWeekStart);
        day.setDate(selectedWeekStart.getDate() + i);
        const dateStr = `${day.getMonth() + 1}/${day.getDate()}`;
        const isToday = day.toDateString() === today.toDateString();
        const todayClass = isToday ? 'today' : '';
        
        headerHTML += `
            <div class="week-day-header ${todayClass}">
                <div class="day-name">${dayNames[i]}</div>
                <div class="day-date">${dateStr}</div>
            </div>
        `;
    }
    
    weekHeader.innerHTML = headerHTML;
    calendar.appendChild(weekHeader);
    
    // Create time slots for each hour
    const hours = Array.from(
        { length: WORKING_HOURS.end - WORKING_HOURS.start }, 
        (_, i) => i + WORKING_HOURS.start
    );
    
    hours.forEach(hour => {
        const hourRow = document.createElement('div');
        hourRow.className = 'week-row';
        
        // Hour label
        let rowHTML = `<div class="week-hour-label">${formatHour(hour)}</div>`;
        
        // Day cells
        for (let i = 0; i < 7; i++) {
            const day = new Date(selectedWeekStart);
            day.setDate(selectedWeekStart.getDate() + i);
            day.setHours(hour, 0, 0, 0);
            
            const isToday = day.toDateString() === today.toDateString();
            const todayClass = isToday ? 'today' : '';
            
            rowHTML += `
                <div class="week-cell ${todayClass}">
                    ${renderWeeklyHourBlocks(day)}
                </div>
            `;
        }
        
        hourRow.innerHTML = rowHTML;
        calendar.appendChild(hourRow);
    });
}

function renderWeeklyHourBlocks(date) {
    const blocks = [];
    const hour = date.getHours();
    const dateStr = date.toDateString();
    
    tasks.forEach(task => {
        task.sessions.forEach(session => {
            const sessionDate = new Date(session.startTime);
            
            if (sessionDate.toDateString() === dateStr && 
                sessionDate.getHours() === hour && 
                !session.completed) {
                
                blocks.push(`
                    <div class="pomodoro-block weekly-block" title="${task.name}">
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

function renderDailyHourBlocks(hour) {
    const blocks = [];
    const displayDate = new Date(selectedDate);
    displayDate.setHours(0, 0, 0, 0);

    tasks.forEach(task => {
        task.sessions.forEach(session => {
            const sessionDate = new Date(session.startTime);
            sessionDate.setHours(0, 0, 0, 0);

            if (sessionDate.getTime() === displayDate.getTime() && 
                session.startTime.getHours() === hour && 
                !session.completed) {
                
                const blockWidth = Math.min(100, (POMODORO_DURATION / 3600) * 100);
                blocks.push(`
                    <div class="pomodoro-block" style="width: ${blockWidth}%">
                        ${task.name}
                    </div>
                `);
            }
        });
    });

    if (blocks.length === 0) {
        return '<div class="empty-hour"></div>';
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

// Utility functions
function formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
}

// Initialize
renderTasks();
renderCalendar(); 