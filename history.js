import './supabaseClient.js';

const supabase = window.supabaseClient;

// State
const state = {
    logs: [],
    thirtyDaysAgo: null,
    charts: {
        mood: null,
        balance: null
    }
};

// DOM Elements
const els = {
    moodChart: document.getElementById('mood-chart'),
    balanceChart: document.getElementById('balance-chart'),
    heatmapContainer: document.getElementById('heatmap-container'),
    emptyState: document.getElementById('empty-state')
};

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateShort(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateFromCreatedAt(createdAt) {
    // Extract date from ISO timestamp
    return createdAt.split('T')[0];
}

function prefersReducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

// Authentication
async function requireAuthOrRedirect() {
    if (!supabase) {
        console.error('Supabase client missing');
        window.location.replace('index.html');
        return null;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.warn('Auth check error:', error.message || error);
    }

    const user = data?.user;
    if (!user) {
        window.location.replace('index.html');
        return null;
    }
    return user;
}

// Fetch daily logs
async function fetchDailyLogs(user) {
    try {
        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        state.thirtyDaysAgo = thirtyDaysAgo.toISOString();

        const { data, error } = await supabase
            .from('daily_logs')
            .select('created_at, mood, sleep_hours, study_hours, game_hours')
            .eq('user_id', user.id)
            .gte('created_at', state.thirtyDaysAgo)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching daily logs:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error fetching daily logs:', err);
        return [];
    }
}

// Process data for charts
function processData(logs) {
    if (!logs || logs.length === 0) {
        return {
            labels: [],
            moodData: [],
            sleepData: [],
            studyData: [],
            gameData: [],
            dateMap: {}
        };
    }

    const labels = [];
    const moodData = [];
    const sleepData = [];
    const studyData = [];
    const gameData = [];
    const dateMap = {};

    // Create a map of all dates in the last 30 days
    const allDates = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        allDates.push(dateStr);
    }

    // Map logs by date
    logs.forEach(log => {
        const dateStr = getDateFromCreatedAt(log.created_at);
        dateMap[dateStr] = {
            mood: log.mood || null,
            sleep_hours: log.sleep_hours || 0,
            study_hours: log.study_hours || 0,
            game_hours: log.game_hours || 0
        };
    });

    // Build arrays for all dates
    allDates.forEach(dateStr => {
        const data = dateMap[dateStr] || {
            mood: null,
            sleep_hours: 0,
            study_hours: 0,
            game_hours: 0
        };

        labels.push(formatDate(dateStr));
        moodData.push(data.mood);
        sleepData.push(data.sleep_hours);
        studyData.push(data.study_hours);
        gameData.push(data.game_hours);
    });

    return {
        labels,
        moodData,
        sleepData,
        studyData,
        gameData,
        dateMap
    };
}

// Create gradient for line chart
function createGradient(ctx, chartArea) {
    if (!chartArea) {
        return 'rgba(0, 255, 255, 0.2)';
    }
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
    gradient.addColorStop(0.5, 'rgba(136, 136, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 0, 255, 0.2)');
    return gradient;
}

// Initialize Mood Wave Chart
function initMoodChart(data) {
    if (!els.moodChart) return;

    const ctx = els.moodChart.getContext('2d');

    // Destroy existing chart if it exists
    if (state.charts.mood) {
        state.charts.mood.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(255, 0, 255, 0.2)');
    gradient.addColorStop(0.5, 'rgba(136, 136, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.1)');

    state.charts.mood = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Mood Score',
                data: data.moodData,
                borderColor: 'rgba(0, 255, 255, 0.8)',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgba(0, 255, 255, 0.9)',
                pointBorderColor: '#050505',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: 'rgba(255, 0, 255, 0.9)',
                pointHoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: prefersReducedMotion() ? 0 : 1000
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 5, 5, 0.95)',
                    borderColor: 'rgba(0, 255, 255, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    titleColor: 'rgba(255, 255, 255, 0.9)',
                    bodyColor: 'rgba(0, 255, 255, 0.9)',
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return `Mood: ${context.parsed.y}/10`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 11
                        }
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    min: 0,
                    max: 10,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        stepSize: 2,
                        font: {
                            size: 11
                        }
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Initialize Balance Bar Chart
function initBalanceChart(data) {
    if (!els.balanceChart) return;

    const ctx = els.balanceChart.getContext('2d');

    // Destroy existing chart if it exists
    if (state.charts.balance) {
        state.charts.balance.destroy();
    }

    state.charts.balance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Sleep',
                    data: data.sleepData,
                    backgroundColor: 'rgba(0, 255, 255, 0.6)',
                    borderColor: 'rgba(0, 255, 255, 0.8)',
                    borderWidth: 1
                },
                {
                    label: 'Study',
                    data: data.studyData,
                    backgroundColor: 'rgba(136, 136, 255, 0.6)',
                    borderColor: 'rgba(136, 136, 255, 0.8)',
                    borderWidth: 1
                },
                {
                    label: 'Game/Entertainment',
                    data: data.gameData,
                    backgroundColor: 'rgba(255, 0, 255, 0.6)',
                    borderColor: 'rgba(255, 0, 255, 0.8)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.9)',
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 5, 5, 0.95)',
                    borderColor: 'rgba(0, 255, 255, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    titleColor: 'rgba(255, 255, 255, 0.9)',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}h`;
                        },
                        footer: function(tooltipItems) {
                            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                            return `Total: ${total.toFixed(1)}h`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 11
                        }
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value + 'h';
                        }
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Generate heatmap
function generateHeatmap(dateMap) {
    if (!els.heatmapContainer) return;

    els.heatmapContainer.innerHTML = '';

    // Get all dates in the last 30 days
    const allDates = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        allDates.push(date.toISOString().split('T')[0]);
    }

    // Find max study hours for normalization
    const studyHours = Object.values(dateMap).map(d => d.study_hours || 0);
    const maxStudy = Math.max(...studyHours, 1);

    allDates.forEach(dateStr => {
        const data = dateMap[dateStr];
        const studyHours = data?.study_hours || 0;
        
        // Calculate intensity (0-5 scale)
        const intensity = Math.min(5, Math.floor((studyHours / maxStudy) * 5));
        
        const dayEl = document.createElement('div');
        dayEl.className = 'heatmap-day';
        if (data) {
            dayEl.classList.add('has-data');
        }
        dayEl.setAttribute('data-intensity', intensity);
        dayEl.setAttribute('data-date', dateStr);
        dayEl.setAttribute('title', `${formatDateShort(dateStr)}: ${studyHours.toFixed(1)}h study`);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'heatmap-tooltip';
        tooltip.textContent = `${formatDateShort(dateStr)}: ${studyHours.toFixed(1)}h`;
        dayEl.appendChild(tooltip);

        els.heatmapContainer.appendChild(dayEl);
    });
}

// Set Chart.js defaults
function configureChartDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = '#fff';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = '"Inter", sans-serif';
}

// Show/hide empty state
function toggleEmptyState(hasData) {
    if (els.emptyState) {
        if (hasData) {
            els.emptyState.classList.add('hidden');
        } else {
            els.emptyState.classList.remove('hidden');
        }
    }
}

// Initialize
async function init() {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    configureChartDefaults();

    // Fetch data
    const logs = await fetchDailyLogs(user);
    state.logs = logs;

    if (logs.length === 0) {
        toggleEmptyState(false);
        return;
    }

    toggleEmptyState(true);

    // Process data
    const chartData = processData(logs);

    // Initialize charts
    initMoodChart(chartData);
    initBalanceChart(chartData);
    generateHeatmap(chartData.dateMap);

    // Animate in
    const gsap = window.gsap;
    if (gsap && !prefersReducedMotion()) {
        const sections = document.querySelectorAll('.glass');
        gsap.from(sections, {
            opacity: 0,
            y: 20,
            duration: 0.6,
            ease: 'power3.out',
            stagger: 0.1
        });
    }
}

init();
