import './supabaseClient.js';

const supabase = window.supabaseClient;

/*
 * SQL Command to create the milestones table:
 * 
 * CREATE TABLE milestones (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   title TEXT NOT NULL,
 *   due_date DATE NOT NULL,
 *   category TEXT NOT NULL CHECK (category IN ('Exam', 'Application', 'Project')),
 *   priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
 *   status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_milestones_user_id ON milestones(user_id);
 * CREATE INDEX idx_milestones_due_date ON milestones(due_date);
 */

// State
const state = {
    milestones: [],
    dailyLogs: []
};

// DOM Elements
const els = {
    missionsGrid: document.getElementById('missions-grid'),
    emptyState: document.getElementById('empty-state'),
    addMissionBtn: document.getElementById('add-mission-btn'),
    emptyAddBtn: document.getElementById('empty-add-btn'),
    addModal: document.getElementById('add-modal'),
    modalBackdrop: document.querySelector('.modal-backdrop'),
    modalClose: document.querySelector('.modal-close'),
    missionForm: document.getElementById('mission-form'),
    cancelBtn: document.getElementById('cancel-btn')
};

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

function calculateDaysRemaining(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function getUrgencyState(daysRemaining) {
    if (daysRemaining > 30) {
        return 'safe';
    } else if (daysRemaining >= 7) {
        return 'caution';
    } else {
        return 'critical';
    }
}

function getUrgencyColor(state) {
    switch (state) {
        case 'safe':
            return 'rgba(0, 255, 136, 0.95)';
        case 'caution':
            return 'rgba(255, 200, 0, 0.95)';
        case 'critical':
            return 'rgba(255, 80, 80, 0.95)';
        default:
            return 'rgba(255, 255, 255, 0.7)';
    }
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

// Fetch milestones
async function fetchMilestones(user) {
    try {
        const { data, error } = await supabase
            .from('milestones')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('due_date', { ascending: true });

        if (error) {
            console.error('Error fetching milestones:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Error fetching milestones:', err);
        return [];
    }
}

// Fetch daily logs for AI context
async function fetchDailyLogs(user) {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_logs')
            .select('created_at, game_hours')
            .eq('user_id', user.id)
            .gte('created_at', `${yesterdayStr}T00:00:00.000Z`)
            .lt('created_at', `${yesterdayStr}T23:59:59.999Z`)
            .limit(1);

        if (error) {
            console.warn('Error fetching daily logs:', error);
            return null;
        }

        return data && data.length > 0 ? data[0] : null;
    } catch (err) {
        console.warn('Error fetching daily logs:', err);
        return null;
    }
}

// Add milestone
async function addMilestone(user, milestoneData) {
    try {
        const { data, error } = await supabase
            .from('milestones')
            .insert({
                user_id: user.id,
                title: milestoneData.title,
                due_date: milestoneData.due_date,
                category: milestoneData.category,
                priority: milestoneData.priority,
                status: 'active'
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding milestone:', error);
            throw error;
        }

        return data;
    } catch (err) {
        console.error('Error adding milestone:', err);
        throw err;
    }
}

// Delete milestone
async function deleteMilestone(milestoneId) {
    try {
        const { error } = await supabase
            .from('milestones')
            .update({ status: 'cancelled' })
            .eq('id', milestoneId);

        if (error) {
            console.error('Error deleting milestone:', error);
            throw error;
        }
    } catch (err) {
        console.error('Error deleting milestone:', err);
        throw err;
    }
}

// Check AI warning condition
function shouldShowWarning(milestone, dailyLog) {
    const daysRemaining = calculateDaysRemaining(milestone.due_date);
    
    if (daysRemaining < 7 && dailyLog && dailyLog.game_hours > 2) {
        return true;
    }
    
    return false;
}

// Calculate progress percentage for ring
function calculateProgress(daysRemaining, totalDays = 60) {
    if (daysRemaining <= 0) return 100;
    if (daysRemaining >= totalDays) return 0;
    
    const progress = ((totalDays - daysRemaining) / totalDays) * 100;
    return Math.min(100, Math.max(0, progress));
}

// Render mission card
function renderMissionCard(milestone, dailyLog, index = 0) {
    const daysRemaining = calculateDaysRemaining(milestone.due_date);
    const urgencyState = getUrgencyState(daysRemaining);
    const showWarning = shouldShowWarning(milestone, dailyLog);
    const progress = calculateProgress(daysRemaining);
    const circumference = 2 * Math.PI * 37; // radius = 37
    const offset = circumference - (progress / 100) * circumference;

    const daysText = daysRemaining < 0 
        ? `${Math.abs(daysRemaining)} days overdue`
        : daysRemaining === 0 
            ? 'Due today'
            : daysRemaining === 1
                ? '1 day remaining'
                : `${daysRemaining} days remaining`;

    return `
        <div class="mission-card ${urgencyState}" role="listitem" data-milestone-id="${milestone.id}">
            <div class="mission-header">
                <div>
                    <h3 class="mission-title">${escapeHtml(milestone.title)}</h3>
                </div>
                <button class="mission-delete" type="button" aria-label="Delete mission" data-action="delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <div class="mission-meta">
                <span class="mission-badge category">${escapeHtml(milestone.category)}</span>
                <span class="mission-badge priority-${milestone.priority.toLowerCase()}">${escapeHtml(milestone.priority)}</span>
                ${showWarning ? '<span class="mission-badge warning">⚠️ High Distraction Detected</span>' : ''}
            </div>
            
            <div class="mission-countdown">
                <div class="countdown-label">Time Remaining</div>
                <div class="countdown-value ${urgencyState}">${daysText}</div>
            </div>
            
            <div class="progress-ring">
                <svg viewBox="0 0 80 80">
                    <circle class="progress-ring-circle progress-ring-bg" cx="40" cy="40" r="37"></circle>
                    <circle 
                        class="progress-ring-circle progress-ring-fill ${urgencyState}" 
                        cx="40" 
                        cy="40" 
                        r="37"
                        style="stroke-dashoffset: ${offset}"
                    ></circle>
                </svg>
                <div class="progress-ring-text">${Math.round(progress)}%</div>
            </div>
            
            <div style="text-align: center; font-size: 0.85rem; color: rgba(255, 255, 255, 0.6);">
                Due: ${formatDate(milestone.due_date)}
            </div>
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render all missions
function renderMissions() {
    if (!els.missionsGrid) return;

    if (state.milestones.length === 0) {
        els.missionsGrid.innerHTML = '';
        if (els.emptyState) {
            els.emptyState.classList.remove('hidden');
        }
        return;
    }

    if (els.emptyState) {
        els.emptyState.classList.add('hidden');
    }

    // Fetch daily logs once for all milestones
    fetchDailyLogs(state.currentUser).then(dailyLog => {
        els.missionsGrid.innerHTML = state.milestones.map((milestone, index) => 
            renderMissionCard(milestone, dailyLog, index)
        ).join('');

        // Attach delete handlers
        els.missionsGrid.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const card = e.target.closest('.mission-card');
                const milestoneId = card?.dataset?.milestoneId;
                
                if (milestoneId && confirm('Are you sure you want to delete this mission?')) {
                    try {
                        await deleteMilestone(milestoneId);
                        await loadMilestones();
                    } catch (err) {
                        alert('Failed to delete mission. Please try again.');
                    }
                }
            });
        });

        // Apply decreasing brightness based on card order (more gradual decrease)
        const cards = els.missionsGrid.querySelectorAll('.mission-card');
        const gsap = window.gsap;
        
        if (gsap && !prefersReducedMotion()) {
            // Animate in, then apply opacity based on order
            cards.forEach((card, index) => {
                // Calculate opacity: start at 1.0, decrease by 0.07 per card
                // This ensures even the 10th card is still at 0.3 opacity minimum
                const targetOpacity = Math.max(0.3, 1.0 - (index * 0.07));
                
                gsap.fromTo(card, 
                    { opacity: 0, y: 20 },
                    { 
                        opacity: targetOpacity, 
                        y: 0, 
                        duration: 0.5, 
                        delay: index * 0.1,
                        ease: 'power3.out' 
                    }
                );
            });
        } else {
            // No animation - just set opacity directly
            cards.forEach((card, index) => {
                const opacity = Math.max(0.3, 1.0 - (index * 0.07));
                card.style.opacity = opacity;
            });
        }
    });
}

// Load milestones
async function loadMilestones() {
    if (!state.currentUser) return;
    
    state.milestones = await fetchMilestones(state.currentUser);
    renderMissions();
}

// Modal functions
function openModal() {
    if (els.addModal) {
        els.addModal.classList.remove('hidden');
        // Reset form
        if (els.missionForm) {
            els.missionForm.reset();
            // Set minimum date to today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('mission-date');
            if (dateInput) {
                dateInput.setAttribute('min', today);
            }
        }
        
        // Animate in
        const gsap = window.gsap;
        if (gsap && !prefersReducedMotion()) {
            const content = els.addModal.querySelector('.modal-content');
            if (content) {
                gsap.fromTo(content,
                    { opacity: 0, scale: 0.95, y: 20 },
                    { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power3.out' }
                );
            }
        }
    }
}

function closeModal() {
    if (els.addModal) {
        const gsap = window.gsap;
        if (gsap && !prefersReducedMotion()) {
            const content = els.addModal.querySelector('.modal-content');
            if (content) {
                gsap.to(content, {
                    opacity: 0,
                    scale: 0.95,
                    y: -10,
                    duration: 0.2,
                    ease: 'power2.in',
                    onComplete: () => {
                        els.addModal.classList.add('hidden');
                    }
                });
            } else {
                els.addModal.classList.add('hidden');
            }
        } else {
            els.addModal.classList.add('hidden');
        }
    }
}

// Event listeners
function wireEvents() {
    // Add mission button
    if (els.addMissionBtn) {
        els.addMissionBtn.addEventListener('click', openModal);
    }

    if (els.emptyAddBtn) {
        els.emptyAddBtn.addEventListener('click', openModal);
    }

    // Modal close
    if (els.modalClose) {
        els.modalClose.addEventListener('click', closeModal);
    }

    if (els.modalBackdrop) {
        els.modalBackdrop.addEventListener('click', closeModal);
    }

    if (els.cancelBtn) {
        els.cancelBtn.addEventListener('click', closeModal);
    }

    // Form submit
    if (els.missionForm) {
        els.missionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!state.currentUser) return;

            const formData = new FormData(e.target);
            const title = document.getElementById('mission-name').value.trim();
            const due_date = document.getElementById('mission-date').value;
            const category = document.getElementById('mission-category').value;
            const priority = document.getElementById('mission-priority').value;

            if (!title || !due_date || !category || !priority) {
                alert('Please fill in all fields.');
                return;
            }

            try {
                await addMilestone(state.currentUser, {
                    title,
                    due_date,
                    category,
                    priority
                });
                
                closeModal();
                await loadMilestones();
            } catch (err) {
                alert('Failed to add mission. Please try again.');
                console.error(err);
            }
        });
    }

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && els.addModal && !els.addModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Initialize
async function init() {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    state.currentUser = user;
    
    wireEvents();
    await loadMilestones();

    // Animate in
    const gsap = window.gsap;
    if (gsap && !prefersReducedMotion()) {
        const container = document.querySelector('.container');
        if (container) {
            gsap.from(container, {
                opacity: 0,
                y: 20,
                duration: 0.6,
                ease: 'power3.out'
            });
        }
    }
}

init();
