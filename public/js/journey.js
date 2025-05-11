// Constants for Journey metrics
const POINTS_PER_SESSION = 5;
const POINTS_BONUS_FOUR_SESSIONS = 20;
const POINTS_TASK_COMPLETION = 10;

// Level thresholds
const LEVELS = [
    { level: 1, name: "Beginner", points: 0 },
    { level: 2, name: "Focused", points: 100 },
    { level: 3, name: "Dedicated", points: 250 },
    { level: 4, name: "Productive", points: 500 },
    { level: 5, name: "Master", points: 1000 },
    { level: 6, name: "Expert", points: 2000 },
    { level: 7, name: "Guru", points: 3500 },
    { level: 8, name: "Legend", points: 5000 },
    { level: 9, name: "Unstoppable", points: 7500 },
    { level: 10, name: "Productivity Wizard", points: 10000 }
];

// Badge definitions
const BADGES = [
    {
        id: "first_session",
        name: "First Step",
        description: "Complete your first Pomodoro session",
        icon: "🎯",
        requirement: 1 // sessions
    },
    {
        id: "perfect_day",
        name: "Perfect Day",
        description: "Complete 4 sessions in a day",
        icon: "🌟",
        requirement: 1 // perfect days
    },
    {
        id: "streak_3",
        name: "On a Roll",
        description: "Maintain a 3-day streak",
        icon: "🔥",
        requirement: 3 // days
    },
    {
        id: "streak_7",
        name: "Week Warrior",
        description: "Maintain a 7-day streak",
        icon: "📅",
        requirement: 7 // days
    },
    {
        id: "streak_30",
        name: "Monthly Master",
        description: "Maintain a 30-day streak",
        icon: "🏆",
        requirement: 30 // days
    },
    {
        id: "sessions_50",
        name: "Half Century",
        description: "Complete 50 Pomodoro sessions",
        icon: "⏱️",
        requirement: 50 // sessions
    },
    {
        id: "sessions_100",
        name: "Century Club",
        description: "Complete 100 Pomodoro sessions",
        icon: "💯",
        requirement: 100 // sessions
    },
    {
        id: "points_500",
        name: "Point Collector",
        description: "Earn 500 productivity points",
        icon: "💎",
        requirement: 500 // points
    },
    {
        id: "tasks_20",
        name: "Task Master",
        description: "Complete 20 tasks",
        icon: "✅",
        requirement: 20 // tasks
    },
    {
        id: "focus_24",
        name: "Day of Focus",
        description: "Accumulate 24 hours of focus time",
        icon: "⌛",
        requirement: 24 // hours
    }
];

// Firebase references
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// User journey data
let journeyData = {
    points: 0,
    sessions: 0,
    tasksCompleted: 0,
    focusTimeMinutes: 0,
    streak: {
        current: 0,
        longest: 0,
        lastActive: null
    },
    perfectDays: 0,
    dailyActivity: {},
    badges: {},
    level: 1
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log('User is logged in:', user.email);
            currentUser = user;
            
            // Load user journey data
            loadJourneyData();
            
            // Setup event listeners for theme switching
            setupThemeToggle();
            
            // Setup mobile menu toggle
            setupMobileMenu();
        } else {
            console.log('No user logged in, redirecting to login page');
            window.location.href = 'landing.html';
        }
    });
});

// Load journey data from Firestore
async function loadJourneyData() {
    try {
        if (!currentUser) return;
        
        // Start with localStorage data for immediate display
        const localDataStr = localStorage.getItem('journeyData');
        if (localDataStr) {
            try {
                const localData = JSON.parse(localDataStr);
                if (localData) {
                    console.log('Using localStorage journey data for initial display');
                    journeyData = localData;
                    updateJourneyUI();
                }
            } catch (e) {
                console.error('Error parsing localStorage journey data:', e);
            }
        }
        
        // Then synchronize with Firebase
        await syncJourneyData();
        
        // Check streak after loading data
        checkStreak();
        
    } catch (error) {
        console.error('Error loading journey data:', error);
    }
}

// Save journey data to Firestore
async function saveJourneyData() {
    try {
        if (!currentUser) {
            console.warn('No user logged in, cannot save journey data to Firebase');
            return Promise.reject(new Error('No user logged in'));
        }
        
        const docRef = db.collection('users').doc(currentUser.uid).collection('journey').doc('stats');
        await docRef.set(journeyData, { merge: true });
        console.log('Journey data saved successfully to Firebase');
        
        // Also save to localStorage as backup
        try {
            localStorage.setItem('journeyData', JSON.stringify(journeyData));
            console.log('Journey data saved to localStorage as backup');
        } catch (localError) {
            console.warn('Could not save journey data to localStorage:', localError);
        }
        
        return Promise.resolve(true);
    } catch (error) {
        console.error('Error saving journey data to Firebase:', error);
        
        // Save to localStorage as backup on Firebase failure
        try {
            localStorage.setItem('journeyData', JSON.stringify(journeyData));
            console.log('Journey data saved to localStorage after Firebase failure');
        } catch (localError) {
            console.error('Complete failure saving journey data:', localError);
        }
        
        return Promise.reject(error);
    }
}

// Update UI with current journey data
function updateJourneyUI() {
    // Update points display
    document.getElementById('total-points').textContent = journeyData.points;
    document.getElementById('total-points-large').textContent = journeyData.points;
    
    // Update streak display
    document.getElementById('current-streak').textContent = journeyData.streak.current;
    document.getElementById('current-streak-large').textContent = journeyData.streak.current;
    document.getElementById('longest-streak').textContent = journeyData.streak.longest;
    
    // Count active days
    const totalActiveDays = Object.keys(journeyData.dailyActivity || {}).length;
    document.getElementById('total-active-days').textContent = totalActiveDays;
    
    // Update badges count
    const unlockedBadges = Object.values(journeyData.badges || {}).filter(b => b.unlocked).length;
    document.getElementById('total-badges').textContent = unlockedBadges;
    
    // Update level information
    updateLevelDisplay();
    
    // Update today's points
    updateTodayPoints();
    
    // Update weekly points
    updateWeeklyPoints();
    
    // Render badges
    renderBadges();
    
    // Render streak calendar
    renderStreakCalendar();
    
    // Update stats
    updateStats();
    
    // Render points chart
    renderPointsChart();
}

// Update level display
function updateLevelDisplay() {
    // Find current level based on points
    const currentLevel = LEVELS.filter(level => journeyData.points >= level.points)
        .sort((a, b) => b.points - a.points)[0];
    
    // Find next level
    const nextLevelIndex = LEVELS.findIndex(level => level.level === currentLevel.level) + 1;
    const nextLevel = nextLevelIndex < LEVELS.length ? LEVELS[nextLevelIndex] : null;
    
    // Update level display
    document.getElementById('user-level').textContent = currentLevel.level;
    document.getElementById('level-number').textContent = currentLevel.level;
    document.getElementById('level-name').textContent = currentLevel.name;
    
    // Update progress bar
    if (nextLevel) {
        const pointsForCurrentLevel = currentLevel.points;
        const pointsForNextLevel = nextLevel.points;
        const pointsNeeded = pointsForNextLevel - pointsForCurrentLevel;
        const pointsProgress = journeyData.points - pointsForCurrentLevel;
        const progressPercentage = Math.min(100, (pointsProgress / pointsNeeded) * 100);
        
        document.getElementById('level-progress-bar').style.width = `${progressPercentage}%`;
        document.getElementById('level-progress').textContent = pointsProgress;
        document.getElementById('level-target').textContent = pointsNeeded;
    } else {
        // Max level reached
        document.getElementById('level-progress-bar').style.width = '100%';
        document.getElementById('level-progress').textContent = 'MAX';
        document.getElementById('level-target').textContent = 'MAX';
    }
}

// Update today's points display
function updateTodayPoints() {
    const today = new Date().toISOString().split('T')[0];
    const todayActivity = journeyData.dailyActivity[today] || { points: 0 };
    document.getElementById('points-today').textContent = todayActivity.points || 0;
}

// Update weekly points display
function updateWeeklyPoints() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    let weeklyPoints = 0;
    
    for (let i = 0; i <= currentDay; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - currentDay + i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (journeyData.dailyActivity[dateStr]) {
            weeklyPoints += journeyData.dailyActivity[dateStr].points || 0;
        }
    }
    
    document.getElementById('points-this-week').textContent = weeklyPoints;
}

// Render badges
function renderBadges() {
    const badgesContainer = document.getElementById('badges-container');
    badgesContainer.innerHTML = '';
    
    BADGES.forEach(badge => {
        const badgeData = journeyData.badges[badge.id] || { unlocked: false };
        const unlocked = badgeData.unlocked;
        
        const badgeElement = document.createElement('div');
        badgeElement.className = `badge-item ${unlocked ? 'unlocked' : 'locked'}`;
        badgeElement.innerHTML = `
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
            ${!unlocked ? `
                <div class="badge-locked-overlay">
                    <div class="badge-locked-icon">🔒</div>
                </div>
            ` : ''}
        `;
        
        badgesContainer.appendChild(badgeElement);
    });
}

// Render streak calendar
function renderStreakCalendar() {
    const calendarContainer = document.getElementById('streak-calendar');
    calendarContainer.innerHTML = '';
    
    // Get last 28 days (4 weeks)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 27; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if this day has activity
        const dayActivity = journeyData.dailyActivity[dateStr] || { 
            sessions: 0, 
            points: 0 
        };
        
        const isActive = dayActivity.sessions > 0;
        const isPerfect = dayActivity.sessions >= 4;
        
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day ${isActive ? 'active' : ''} ${isPerfect ? 'perfect' : ''}`;
        
        // Show the day number (1-31)
        const dayNumber = date.getDate();
        
        // Create a tooltip with date and points info
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const tooltipDate = `${monthNames[date.getMonth()]} ${dayNumber}, ${date.getFullYear()}`;
        const tooltipContent = isActive ? 
            `${tooltipDate}: ${dayActivity.sessions} sessions, ${dayActivity.points} points` : 
            `${tooltipDate}: No activity`;
        
        dayElement.innerHTML = `
            <span class="day-number">${dayNumber}</span>
            ${isActive ? `<span class="day-points">+${dayActivity.points}</span>` : ''}
            <span class="calendar-day-tooltip">${tooltipContent}</span>
        `;
        
        calendarContainer.appendChild(dayElement);
    }
}

// Update stats section
function updateStats() {
    // Format focus time
    const hours = Math.floor(journeyData.focusTimeMinutes / 60);
    const minutes = journeyData.focusTimeMinutes % 60;
    document.getElementById('total-focus-time').textContent = `${hours}h ${minutes}m`;
    
    // Update other stats
    document.getElementById('total-sessions-completed').textContent = journeyData.sessions;
    document.getElementById('total-tasks-completed').textContent = journeyData.tasksCompleted;
    document.getElementById('perfect-days').textContent = journeyData.perfectDays;
}

// Render points chart
function renderPointsChart() {
    const ctx = document.getElementById('points-chart');
    
    // Replace placeholder with canvas for chart.js
    ctx.innerHTML = '<canvas id="points-chart-canvas"></canvas>';
    const canvas = document.getElementById('points-chart-canvas');
    
    // Get data for the last 30 days
    const labels = [];
    const data = [];
    
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Format date for display (e.g., "Aug 15")
        const displayDate = `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
        
        labels.push(displayDate);
        
        // Add points data
        const dayActivity = journeyData.dailyActivity[dateStr] || { points: 0 };
        data.push(dayActivity.points || 0);
    }
    
    // Create chart
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Points',
                data: data,
                backgroundColor: 'rgba(60, 110, 113, 0.7)',
                borderColor: 'rgba(60, 110, 113, 1)',
                borderWidth: 1,
                borderRadius: 5,
                hoverBackgroundColor: 'rgba(60, 110, 113, 0.9)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function(context) {
                            return `${context.parsed.y} points`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Check streak status
function checkStreak() {
    if (!journeyData.streak.lastActive) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActive = new Date(journeyData.streak.lastActive);
    lastActive.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(today - lastActive);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If more than 1 day has passed since last activity, reset streak
    if (diffDays > 1) {
        journeyData.streak.current = 0;
        saveJourneyData();
    }
}

// Add a function to show points earned notification
function showPointsNotification(points, reason) {
    if (!points) return;
    
    const notification = document.createElement('div');
    notification.className = 'badge-notification points-notification';
    notification.innerHTML = `
        <div class="badge-icon points-icon">🏆</div>
        <div class="badge-info">
            <div class="badge-name">+${points} Points!</div>
            <div class="badge-description">${reason || 'You earned points!'}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show animation
    setTimeout(() => {
        notification.classList.add('visible');
    }, 100);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 4000);
}

// Update addSessionCompletion to show notifications
function addSessionCompletion() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize today's activity if not exists
    if (!journeyData.dailyActivity[today]) {
        journeyData.dailyActivity[today] = {
            sessions: 0,
            points: 0,
            tasks: 0
        };
    }
    
    // Increment sessions
    journeyData.sessions++;
    journeyData.dailyActivity[today].sessions = (journeyData.dailyActivity[today].sessions || 0) + 1;
    
    // Add points for session
    const pointsEarned = POINTS_PER_SESSION;
    journeyData.points += pointsEarned;
    journeyData.dailyActivity[today].points = (journeyData.dailyActivity[today].points || 0) + pointsEarned;
    
    // Add focus time (25 minutes per session)
    journeyData.focusTimeMinutes += 25;
    
    // Show notification for points earned
    showPointsNotification(pointsEarned, 'Completed a focus session!');
    
    // Check for 4 sessions in a day bonus
    if (journeyData.dailyActivity[today].sessions === 4) {
        const bonusPoints = POINTS_BONUS_FOUR_SESSIONS;
        journeyData.points += bonusPoints;
        journeyData.dailyActivity[today].points += bonusPoints;
        journeyData.perfectDays++;
        
        // Show notification for bonus
        setTimeout(() => {
            showPointsNotification(bonusPoints, 'Bonus for completing 4 sessions today!');
        }, 1500);
        
        // Check for perfect day badge
        checkBadgeUnlock('perfect_day');
    }
    
    // Check streaks
    updateStreak();
    
    // Check for session-based badges
    checkBadgeUnlock('first_session');
    checkBadgeUnlock('sessions_50');
    checkBadgeUnlock('sessions_100');
    
    // Check for points-based badges
    checkBadgeUnlock('points_500');
    
    // Check if we need to level up
    updateLevel();
    
    // Add lastUpdated timestamp for syncing
    journeyData.lastUpdated = Date.now();
    
    // IMPORTANT: Save the data immediately to ensure it's persisted
    console.log('Journey: Saving session completion data to Firebase...');
    
    // Save the data with a retry mechanism
    const savePromise = saveJourneyData();
    
    // Add retry on failure
    savePromise.catch(error => {
        console.error('Failed to save journey data on first attempt:', error);
        // Try again after 2 seconds
        setTimeout(() => {
            console.log('Journey: Retrying save operation...');
            saveJourneyData()
                .catch(retryError => {
                    console.error('Failed to save journey data on retry:', retryError);
                });
        }, 2000);
    });
    
    // Update the UI
    updateJourneyUI();
    
    // Return the points earned for this session (useful for notifications)
    return pointsEarned;
}

// Update streak data
function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = journeyData.streak.lastActive;
    
    if (!lastActive) {
        // First activity
        journeyData.streak.current = 1;
        journeyData.streak.lastActive = today;
    } else {
        const lastActiveDate = new Date(lastActive);
        lastActiveDate.setHours(0, 0, 0, 0);
        
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        
        const diffTime = Math.abs(todayDate - lastActiveDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Yesterday was the last activity - streak continues
            journeyData.streak.current++;
            journeyData.streak.lastActive = today;
        } else if (diffDays === 0) {
            // Already active today - no change to streak
        } else {
            // Streak broken
            journeyData.streak.current = 1;
            journeyData.streak.lastActive = today;
        }
    }
    
    // Update longest streak
    if (journeyData.streak.current > journeyData.streak.longest) {
        journeyData.streak.longest = journeyData.streak.current;
    }
    
    // Check for streak badges
    checkBadgeUnlock('streak_3');
    checkBadgeUnlock('streak_7');
    checkBadgeUnlock('streak_30');
}

// Add task completion to journey data
function addTaskCompletion() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize today's activity if not exists
    if (!journeyData.dailyActivity[today]) {
        journeyData.dailyActivity[today] = {
            sessions: 0,
            points: 0,
            tasks: 0
        };
    }
    
    // Increment task completions
    journeyData.tasksCompleted++;
    journeyData.dailyActivity[today].tasks = (journeyData.dailyActivity[today].tasks || 0) + 1;
    
    // Add points for task completion
    const pointsEarned = POINTS_TASK_COMPLETION;
    journeyData.points += pointsEarned;
    journeyData.dailyActivity[today].points = (journeyData.dailyActivity[today].points || 0) + pointsEarned;
    
    // Show notification for points earned
    showPointsNotification(pointsEarned, 'Completed a task!');
    
    // Check for task-based badges
    checkBadgeUnlock('tasks_20');
    
    // Check if we need to level up
    updateLevel();
    
    // Add lastUpdated timestamp for syncing
    journeyData.lastUpdated = Date.now();
    
    // Save the data with a retry mechanism
    console.log('Journey: Saving task completion data to Firebase...');
    const savePromise = saveJourneyData();
    
    // Add retry on failure
    savePromise.catch(error => {
        console.error('Failed to save journey data on first attempt:', error);
        // Try again after 2 seconds
        setTimeout(() => {
            console.log('Journey: Retrying save operation...');
            saveJourneyData()
                .catch(retryError => {
                    console.error('Failed to save journey data on retry:', retryError);
                });
        }, 2000);
    });
    
    // Update the UI
    updateJourneyUI();
    
    // Return points earned
    return pointsEarned;
}

// Check if a badge should be unlocked
function checkBadgeUnlock(badgeId) {
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) return;
    
    // Skip if already unlocked
    if (journeyData.badges[badgeId] && journeyData.badges[badgeId].unlocked) {
        return;
    }
    
    let unlocked = false;
    
    // Check requirements
    switch (badgeId) {
        case 'first_session':
            unlocked = journeyData.sessions >= badge.requirement;
            break;
        case 'perfect_day':
            unlocked = journeyData.perfectDays >= badge.requirement;
            break;
        case 'streak_3':
        case 'streak_7':
        case 'streak_30':
            unlocked = journeyData.streak.current >= badge.requirement;
            break;
        case 'sessions_50':
        case 'sessions_100':
            unlocked = journeyData.sessions >= badge.requirement;
            break;
        case 'points_500':
            unlocked = journeyData.points >= badge.requirement;
            break;
        case 'tasks_20':
            unlocked = journeyData.tasksCompleted >= badge.requirement;
            break;
        case 'focus_24':
            unlocked = journeyData.focusTimeMinutes >= (badge.requirement * 60);
            break;
    }
    
    if (unlocked) {
        // Update badge status
        journeyData.badges[badgeId] = {
            unlocked: true,
            unlockedAt: new Date().toISOString()
        };
        
        // Show notification
        showBadgeUnlockNotification(badge);
    }
}

// Show badge unlock notification
function showBadgeUnlockNotification(badge) {
    const notification = document.createElement('div');
    notification.className = 'badge-notification';
    notification.innerHTML = `
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-info">
            <div class="badge-name">${badge.name}</div>
            <div class="badge-description">${badge.description}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show animation
    setTimeout(() => {
        notification.classList.add('visible');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
}

// Setup theme toggle
function setupThemeToggle() {
    const themeSwitch = document.getElementById('theme-switch');
    const mobileThemeSwitch = document.getElementById('mobile-theme-switch');
    
    // Set initial state based on localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.dataset.theme = savedTheme;
    
    themeSwitch.checked = savedTheme === 'dark';
    mobileThemeSwitch.checked = savedTheme === 'dark';
    
    // Add event listeners
    themeSwitch.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.body.dataset.theme = theme;
        localStorage.setItem('theme', theme);
        mobileThemeSwitch.checked = this.checked;
    });
    
    mobileThemeSwitch.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.body.dataset.theme = theme;
        localStorage.setItem('theme', theme);
        themeSwitch.checked = this.checked;
    });
}

// Setup mobile menu toggle
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !mobileMenuToggle.contains(e.target) && 
            sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });
}

// Handle logout
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            firebase.auth().signOut()
                .then(() => {
                    console.log('User logged out successfully');
                    window.location.href = 'landing.html';
                })
                .catch(error => {
                    console.error('Error logging out:', error);
                });
        });
    }
});

// Export functions for other pages to use
window.journeyTracker = {
    addSessionCompletion,
    addTaskCompletion
};

// Add a function to update user level based on points
function updateLevel() {
    // Find the current level based on points
    const newLevel = LEVELS.filter(level => journeyData.points >= level.points)
        .sort((a, b) => b.level - a.level)[0];
    
    // Check if the level has changed
    if (newLevel && newLevel.level > journeyData.level) {
        console.log(`Level up! From ${journeyData.level} to ${newLevel.level}`);
        journeyData.level = newLevel.level;
        
        // Show a level up notification
        const notification = document.createElement('div');
        notification.className = 'badge-notification level-notification';
        notification.innerHTML = `
            <div class="badge-icon level-up-icon">⬆️</div>
            <div class="badge-info">
                <div class="badge-name">Level Up!</div>
                <div class="badge-description">You reached level ${newLevel.level}: ${newLevel.name}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Show animation
        setTimeout(() => {
            notification.classList.add('visible');
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }
}

// Add a function to synchronize journey data between pages
async function syncJourneyData() {
    if (!currentUser) {
        console.warn('No user logged in, cannot sync journey data');
        return;
    }
    
    console.log('Synchronizing journey data...');
    
    // First, try to load from localStorage as a fast initial load
    const localDataStr = localStorage.getItem('journeyData');
    let localData = null;
    
    if (localDataStr) {
        try {
            localData = JSON.parse(localDataStr);
            console.log('Found journey data in localStorage:', localData);
            
            // Use local data for initial display
            if (localData) {
                journeyData = localData;
                updateJourneyUI();
            }
        } catch (e) {
            console.error('Error parsing localStorage journey data:', e);
        }
    }
    
    try {
        // Now try to get the Firebase data
        const docRef = db.collection('users').doc(currentUser.uid).collection('journey').doc('stats');
        const doc = await docRef.get();
        
        if (doc.exists) {
            const firebaseData = doc.data();
            console.log('Found journey data in Firebase:', firebaseData);
            
            // If we have Firebase data
            if (firebaseData) {
                // Compare timestamps if available
                const localTimestamp = localData?.lastUpdated || 0;
                const firebaseTimestamp = firebaseData.lastUpdated || 0;
                
                // Use the newer data
                if (!localData || firebaseTimestamp > localTimestamp) {
                    console.log('Using Firebase journey data as it is newer');
                    journeyData = firebaseData;
                    
                    // Update localStorage with the Firebase data
                    try {
                        localStorage.setItem('journeyData', JSON.stringify(journeyData));
                    } catch (e) {
                        console.warn('Could not save Firebase journey data to localStorage:', e);
                    }
                } else {
                    console.log('Using localStorage journey data as it is newer');
                    // If local data is newer, update Firebase
                    journeyData = localData;
                    docRef.set(journeyData, { merge: true })
                        .then(() => console.log('Updated Firebase with newer localStorage data'))
                        .catch(e => console.error('Error updating Firebase with localStorage data:', e));
                }
                
                // Update the UI with final data
                updateJourneyUI();
            }
        } else if (localData) {
            // No Firebase data but we have local data - save it to Firebase
            console.log('No Firebase data found, saving localStorage data to Firebase');
            docRef.set(localData, { merge: true })
                .then(() => console.log('Saved localStorage journey data to Firebase'))
                .catch(e => console.error('Error saving localStorage data to Firebase:', e));
        } else {
            // No data at all - create new journey data
            console.log('No journey data found, creating new data');
            journeyData = {
                points: 0,
                sessions: 0,
                tasksCompleted: 0,
                focusTimeMinutes: 0,
                streak: {
                    current: 0,
                    longest: 0,
                    lastActive: null
                },
                perfectDays: 0,
                dailyActivity: {},
                badges: {},
                level: 1,
                lastUpdated: Date.now()
            };
            
            // Save the new data
            saveJourneyData();
            updateJourneyUI();
        }
    } catch (error) {
        console.error('Error syncing journey data:', error);
        
        // If Firebase fails but we have local data, use that
        if (localData) {
            console.log('Using localStorage data due to Firebase error');
            journeyData = localData;
            updateJourneyUI();
        }
    }
} 