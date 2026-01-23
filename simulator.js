import './supabaseClient.js';

const supabase = window.supabaseClient;

// Grade point mapping
const GRADE_POINTS = {
    'A': 4.0,
    'A-': 3.7,
    'B+': 3.3,
    'B': 3.0,
    'B-': 2.7,
    'C+': 2.3,
    'C': 2.0,
    'C-': 1.7,
    'D+': 1.3,
    'D': 1.0,
    'D-': 0.7,
    'F': 0.0
};

// State
const state = {
    currentGPA: 0,
    pastCredits: 12,
    courses: [],
    simulatedGPA: 0,
    animationFrame: null
};

// DOM Elements
const els = {
    currentGpa: document.getElementById('current-gpa'),
    pastCreditsInput: document.getElementById('past-credits'),
    coursesContainer: document.getElementById('courses-container'),
    addCourseBtn: document.getElementById('add-course-btn'),
    simulatedGpa: document.getElementById('simulated-gpa'),
    gpaDelta: document.getElementById('gpa-delta')
};

// Utility functions
function safeNum(v, fallback = 0) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function formatGPA(gpa) {
    return clamp(safeNum(gpa, 0), 0, 4.0).toFixed(2);
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

// Fetch user data
async function fetchUserData(user) {
    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('gpa')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.warn('Error fetching user data:', error.message || error);
            return;
        }

        if (data && typeof data.gpa === 'number' && data.gpa > 0) {
            state.currentGPA = clamp(data.gpa, 0, 4.0);
            updateCurrentGPADisplay();
        } else {
            // Default to 0 if no GPA found
            state.currentGPA = 0;
            updateCurrentGPADisplay();
        }
    } catch (err) {
        console.warn('Error fetching user data:', err);
    }
}

// Update current GPA display
function updateCurrentGPADisplay() {
    if (els.currentGpa) {
        els.currentGpa.textContent = formatGPA(state.currentGPA);
    }
}

// Calculate simulated GPA
function calculateSimulatedGPA() {
    const pastGPA = state.currentGPA;
    const pastCredits = safeNum(state.pastCredits, 0);
    
    if (pastCredits === 0 && state.courses.length === 0) {
        state.simulatedGPA = pastGPA;
        return;
    }

    // Calculate total quality points from past courses
    const pastQualityPoints = pastGPA * pastCredits;

    // Calculate quality points from new courses
    let newQualityPoints = 0;
    let newCredits = 0;

    state.courses.forEach(course => {
        const credits = safeNum(course.credits, 0);
        const gradePoints = GRADE_POINTS[course.grade] || 0;
        newQualityPoints += gradePoints * credits;
        newCredits += credits;
    });

    // Calculate new GPA
    const totalCredits = pastCredits + newCredits;
    if (totalCredits === 0) {
        state.simulatedGPA = pastGPA;
    } else {
        const totalQualityPoints = pastQualityPoints + newQualityPoints;
        state.simulatedGPA = totalQualityPoints / totalCredits;
    }

    updateSimulatedGPADisplay();
}

// Update simulated GPA display with animation
function updateSimulatedGPADisplay() {
    if (!els.simulatedGpa) return;

    const newGPA = clamp(state.simulatedGPA, 0, 4.0);
    const oldGPA = parseFloat(els.simulatedGpa.textContent) || 0;
    const delta = newGPA - oldGPA;

    // Determine color class
    const isPositive = delta > 0.001;
    const isNegative = delta < -0.001;

    // Remove existing color classes
    els.simulatedGpa.classList.remove('positive', 'negative');

    if (isPositive) {
        els.simulatedGpa.classList.add('positive');
    } else if (isNegative) {
        els.simulatedGpa.classList.add('negative');
    }

    // Update delta display
    if (els.gpaDelta) {
        els.gpaDelta.classList.remove('positive', 'negative');
        if (Math.abs(delta) < 0.001) {
            els.gpaDelta.textContent = '';
        } else {
            const sign = delta > 0 ? '+' : '';
            els.gpaDelta.textContent = `${sign}${delta.toFixed(2)}`;
            if (isPositive) {
                els.gpaDelta.classList.add('positive');
            } else if (isNegative) {
                els.gpaDelta.classList.add('negative');
            }
        }
    }

    // Animate the number change (odometer effect)
    if (prefersReducedMotion() || Math.abs(delta) < 0.001) {
        els.simulatedGpa.textContent = formatGPA(newGPA);
        return;
    }

    animateGPA(oldGPA, newGPA);
}

// Animate GPA change (odometer effect)
function animateGPA(from, to) {
    if (state.animationFrame) {
        cancelAnimationFrame(state.animationFrame);
    }

    const duration = 500; // ms
    const startTime = performance.now();
    const startValue = from;
    const endValue = to;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        const currentValue = startValue + (endValue - startValue) * eased;
        els.simulatedGpa.textContent = formatGPA(currentValue);

        if (progress < 1) {
            state.animationFrame = requestAnimationFrame(animate);
        } else {
            state.animationFrame = null;
            els.simulatedGpa.textContent = formatGPA(endValue);
        }
    }

    state.animationFrame = requestAnimationFrame(animate);
}

// Course management
function addCourse() {
    const courseId = Date.now();
    const course = {
        id: courseId,
        name: '',
        credits: 1,
        grade: 'A'
    };

    state.courses.push(course);
    renderCourses();
    calculateSimulatedGPA();
}

function removeCourse(courseId) {
    state.courses = state.courses.filter(c => c.id !== courseId);
    renderCourses();
    calculateSimulatedGPA();
}

function updateCourse(courseId, field, value) {
    const course = state.courses.find(c => c.id === courseId);
    if (course) {
        course[field] = value;
        calculateSimulatedGPA();
    }
}

// Render courses
function renderCourses() {
    if (!els.coursesContainer) return;

    if (state.courses.length === 0) {
        els.coursesContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.5);">
                No courses added. Click "Add Course" to start simulating.
            </div>
        `;
        return;
    }

    els.coursesContainer.innerHTML = state.courses.map(course => `
        <div class="course-row" role="listitem" data-course-id="${course.id}">
            <input
                type="text"
                class="course-input"
                placeholder="Course Name"
                value="${course.name}"
                data-field="name"
                aria-label="Course name"
            >
            <input
                type="number"
                class="course-input course-input--number"
                min="0"
                step="0.5"
                value="${course.credits}"
                data-field="credits"
                aria-label="Credits"
            >
            <select
                class="course-select"
                data-field="grade"
                aria-label="Projected grade"
            >
                ${Object.keys(GRADE_POINTS).map(grade => `
                    <option value="${grade}" ${course.grade === grade ? 'selected' : ''}>
                        ${grade} (${GRADE_POINTS[grade].toFixed(1)})
                    </option>
                `).join('')}
            </select>
            <button
                class="btn-delete"
                type="button"
                aria-label="Delete course"
                data-action="delete"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Attach event listeners
    els.coursesContainer.querySelectorAll('.course-row').forEach(row => {
        const courseId = parseInt(row.dataset.courseId, 10);
        
        // Name input
        const nameInput = row.querySelector('[data-field="name"]');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                updateCourse(courseId, 'name', e.target.value);
            });
        }

        // Credits input
        const creditsInput = row.querySelector('[data-field="credits"]');
        if (creditsInput) {
            creditsInput.addEventListener('input', (e) => {
                updateCourse(courseId, 'credits', safeNum(e.target.value, 1));
            });
        }

        // Grade select
        const gradeSelect = row.querySelector('[data-field="grade"]');
        if (gradeSelect) {
            gradeSelect.addEventListener('change', (e) => {
                updateCourse(courseId, 'grade', e.target.value);
            });
        }

        // Delete button
        const deleteBtn = row.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                removeCourse(courseId);
            });
        }
    });
}

// Event listeners
function wireEvents() {
    // Past credits input
    if (els.pastCreditsInput) {
        els.pastCreditsInput.addEventListener('input', (e) => {
            state.pastCredits = safeNum(e.target.value, 12);
            calculateSimulatedGPA();
        });
    }

    // Add course button
    if (els.addCourseBtn) {
        els.addCourseBtn.addEventListener('click', addCourse);
    }
}

// Initialize
async function init() {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    await fetchUserData(user);
    wireEvents();
    calculateSimulatedGPA();

    // Initial animation
    const gsap = window.gsap;
    if (gsap && !prefersReducedMotion()) {
        const cards = document.querySelectorAll('.glass');
        gsap.from(cards, {
            opacity: 0,
            y: 20,
            duration: 0.6,
            ease: 'power3.out',
            stagger: 0.1
        });
    }
}

init();
