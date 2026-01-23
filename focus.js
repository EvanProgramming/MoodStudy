import './supabaseClient.js';
import * as THREE from 'three';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

const supabase = window.supabaseClient;

// ==========================================
// STATE MANAGEMENT
// ==========================================
let timeLeft = 25 * 60; // 25 minutes in seconds
let isRunning = false;
let mode = 'focus'; // 'focus' | 'break'
let intervalId = null;
let currentUser = null;
let focusDuration = 25; // minutes
let breakDuration = 5; // minutes

// ==========================================
// DOM ELEMENTS
// ==========================================
const els = {
    timerText: document.getElementById('timer-text'),
    timerDisplay: document.getElementById('timer-display'),
    statusPill: document.getElementById('status-pill'),
    statusText: document.getElementById('status-text'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    stopBtn: document.getElementById('stop-btn'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    durationEditor: document.getElementById('duration-editor'),
    focusDurationInput: document.getElementById('focus-duration'),
    breakDurationInput: document.getElementById('break-duration'),
    saveDurationBtn: document.getElementById('save-duration'),
    cancelDurationBtn: document.getElementById('cancel-duration'),
    sessionOverlay: document.getElementById('session-overlay'),
    sessionSummary: document.getElementById('session-summary'),
    overlayClose: document.getElementById('overlay-close'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),
};

// ==========================================
// THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505); // Deep black

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x004080, 0.2);
scene.add(ambientLight);

const pinkLight = new THREE.DirectionalLight(0xff00ff, 2.0);
pinkLight.position.set(-3, 3, 5);
scene.add(pinkLight);

const cyanLight = new THREE.DirectionalLight(0x00ffff, 2.0);
cyanLight.position.set(3, -3, 5);
scene.add(cyanLight);

// Sphere (the "Siri Orb")
const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
const sphereMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8888ff,
    roughness: 0.7,
    metalness: 1,
    transmission: 0,
    thickness: 1.5,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [100, 400],
    emissive: 0x3300ff,
    emissiveIntensity: 0.1
});
const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereMesh.scale.set(1.0, 1.0, 1.0);
scene.add(sphereMesh);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.5,
    0.1
);
composer.addPass(bloomPass);

// Animation state
let time = 0;
let sphereBaseScale = 1.0;
let breathingSpeed = 3.0; // Breathing animation speed

// ==========================================
// TIMER FUNCTIONS
// ==========================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    if (els.timerText) {
        els.timerText.textContent = formatTime(timeLeft);
    }
}

function startTimer() {
    if (intervalId) return;
    
    isRunning = true;
    updatePlayPauseIcon();
    
    intervalId = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        // Sync breathing with timer (faster breathing as time runs out)
        const progress = 1 - (timeLeft / (mode === 'focus' ? focusDuration * 60 : breakDuration * 60));
        breathingSpeed = 3.0 + progress * 2.0; // Speed up as timer progresses
        
        if (timeLeft <= 0) {
            completeSession();
        }
    }, 1000);
}

function pauseTimer() {
    if (!intervalId) return;
    
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    updatePlayPauseIcon();
}

function stopTimer() {
    pauseTimer();
    mode = 'focus';
    timeLeft = focusDuration * 60;
    updateTimerDisplay();
    updateStatus();
    breathingSpeed = 3.0;
}

function completeSession() {
    pauseTimer();
    
    // Play completion chime (using Web Audio API)
    playChime();
    
    if (mode === 'focus') {
        // Log the session to Supabase
        logFocusSession(focusDuration);
        
        // Switch to break mode
        mode = 'break';
        timeLeft = breakDuration * 60;
        updateStatus();
        updateTimerDisplay();
        
        // Show toast notification
        showToast(`Session recorded. +${focusDuration} mins added to your Daily Log.`);
        
        // Auto-start break timer (optional - you can remove this if you want manual start)
        // startTimer();
    } else {
        // Break completed - show summary and reset to focus
        showSessionComplete();
        mode = 'focus';
        timeLeft = focusDuration * 60;
        updateStatus();
        updateTimerDisplay();
    }
}

function updateStatus() {
    if (els.statusPill && els.statusText) {
        if (mode === 'focus') {
            els.statusPill.classList.remove('break');
            els.statusText.textContent = 'FOCUS';
        } else {
            els.statusPill.classList.add('break');
            els.statusText.textContent = 'BREAK';
        }
    }
}

function updatePlayPauseIcon() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (playIcon && pauseIcon) {
        if (isRunning) {
            playIcon.classList.add('icon-hidden');
            pauseIcon.classList.remove('icon-hidden');
        } else {
            playIcon.classList.remove('icon-hidden');
            pauseIcon.classList.add('icon-hidden');
        }
    }
}

// ==========================================
// AUDIO FUNCTIONS
// ==========================================
function playChime() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.warn('Audio playback not available:', error);
    }
}

// Optional: White noise generator (can be toggled)
let whiteNoiseNode = null;
let whiteNoiseGain = null;

function startWhiteNoise() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = 4096;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        whiteNoiseNode = audioContext.createBufferSource();
        whiteNoiseNode.buffer = buffer;
        whiteNoiseNode.loop = true;
        
        whiteNoiseGain = audioContext.createGain();
        whiteNoiseGain.gain.value = 0.1; // Low volume
        
        whiteNoiseNode.connect(whiteNoiseGain);
        whiteNoiseGain.connect(audioContext.destination);
        
        whiteNoiseNode.start();
    } catch (error) {
        console.warn('White noise not available:', error);
    }
}

function stopWhiteNoise() {
    if (whiteNoiseNode) {
        whiteNoiseNode.stop();
        whiteNoiseNode = null;
        whiteNoiseGain = null;
    }
}

// ==========================================
// SUPABASE INTEGRATION
// ==========================================
async function getUtcTodayBounds() {
    const today = new Date().toISOString().split('T')[0];
    return {
        today,
        start: `${today}T00:00:00.000Z`,
        end: `${today}T23:59:59.999Z`,
    };
}

async function logFocusSession(minutes) {
    if (!supabase || !currentUser) {
        console.warn('Cannot log session: Supabase or user not available');
        return;
    }
    
    try {
        const { start, end } = await getUtcTodayBounds();
        const hoursToAdd = minutes / 60;
        
        // Check if today's log exists
        const { data: existingLogs, error: fetchError } = await supabase
            .from('daily_logs')
            .select('id, study_hours')
            .eq('user_id', currentUser.id)
            .gte('created_at', start)
            .lt('created_at', end)
            .limit(1);
        
        if (fetchError) {
            console.error('Error fetching daily log:', fetchError);
            return;
        }
        
        if (existingLogs && existingLogs.length > 0) {
            // Update existing log
            const existingLog = existingLogs[0];
            const currentStudyHours = parseFloat(existingLog.study_hours || 0);
            const newStudyHours = currentStudyHours + hoursToAdd;
            
            const { error: updateError } = await supabase
                .from('daily_logs')
                .update({
                    study_hours: newStudyHours,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingLog.id);
            
            if (updateError) {
                console.error('Error updating daily log:', updateError);
            } else {
                console.log(`Updated study_hours: ${currentStudyHours} -> ${newStudyHours}`);
            }
        } else {
            // Create new log with just study_hours
            const { error: insertError } = await supabase
                .from('daily_logs')
                .insert({
                    user_id: currentUser.id,
                    study_hours: hoursToAdd,
                    sleep_hours: 0,
                    game_hours: 0,
                    mood: 5,
                    updated_at: new Date().toISOString()
                });
            
            if (insertError) {
                console.error('Error creating daily log:', insertError);
            } else {
                console.log(`Created new daily log with study_hours: ${hoursToAdd}`);
            }
        }
    } catch (error) {
        console.error('Error logging focus session:', error);
    }
}

// ==========================================
// UI FUNCTIONS
// ==========================================
function showToast(message) {
    if (els.toast && els.toastText) {
        els.toastText.textContent = message;
        els.toast.classList.remove('hidden');
        
        setTimeout(() => {
            els.toast.classList.add('hidden');
        }, 3000);
    }
}

function showSessionComplete() {
    if (els.sessionOverlay && els.sessionSummary) {
        els.sessionSummary.textContent = `Great work! You completed a ${focusDuration}-minute focus session and a ${breakDuration}-minute break. Your progress has been recorded.`;
        els.sessionOverlay.classList.remove('hidden');
    }
}

function hideSessionComplete() {
    if (els.sessionOverlay) {
        els.sessionOverlay.classList.add('hidden');
    }
}

function openDurationEditor() {
    if (els.durationEditor) {
        els.durationEditor.classList.remove('hidden');
        if (els.focusDurationInput) els.focusDurationInput.value = focusDuration;
        if (els.breakDurationInput) els.breakDurationInput.value = breakDuration;
    }
}

function closeDurationEditor() {
    if (els.durationEditor) {
        els.durationEditor.classList.add('hidden');
    }
}

function saveDuration() {
    const newFocus = parseInt(els.focusDurationInput?.value || focusDuration, 10);
    const newBreak = parseInt(els.breakDurationInput?.value || breakDuration, 10);
    
    if (newFocus >= 1 && newFocus <= 60 && newBreak >= 1 && newBreak <= 30) {
        focusDuration = newFocus;
        breakDuration = newBreak;
        
        if (mode === 'focus' && !isRunning) {
            timeLeft = focusDuration * 60;
            updateTimerDisplay();
        }
        
        closeDurationEditor();
    }
}

// ==========================================
// FULLSCREEN API
// ==========================================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn('Error entering fullscreen:', err);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.warn('Error exiting fullscreen:', err);
        });
    }
}

function updateFullscreenIcon() {
    const enterIcon = document.getElementById('fullscreen-enter');
    const exitIcon = document.getElementById('fullscreen-exit');
    
    if (enterIcon && exitIcon) {
        if (document.fullscreenElement) {
            enterIcon.classList.add('icon-hidden');
            exitIcon.classList.remove('icon-hidden');
        } else {
            enterIcon.classList.remove('icon-hidden');
            exitIcon.classList.add('icon-hidden');
        }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
if (els.playPauseBtn) {
    els.playPauseBtn.addEventListener('click', () => {
        if (isRunning) {
            pauseTimer();
            stopWhiteNoise();
        } else {
            startTimer();
            // Optional: start white noise when timer starts
            // startWhiteNoise();
        }
    });
}

if (els.stopBtn) {
    els.stopBtn.addEventListener('click', () => {
        stopTimer();
        stopWhiteNoise();
    });
}

if (els.timerDisplay) {
    els.timerDisplay.addEventListener('click', () => {
        if (!isRunning) {
            openDurationEditor();
        }
    });
}

if (els.fullscreenBtn) {
    els.fullscreenBtn.addEventListener('click', toggleFullscreen);
}

if (els.saveDurationBtn) {
    els.saveDurationBtn.addEventListener('click', saveDuration);
}

if (els.cancelDurationBtn) {
    els.cancelDurationBtn.addEventListener('click', closeDurationEditor);
}

if (els.overlayClose) {
    els.overlayClose.addEventListener('click', hideSessionComplete);
}

// Fullscreen change listener
document.addEventListener('fullscreenchange', updateFullscreenIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
document.addEventListener('MSFullscreenChange', updateFullscreenIcon);

// ==========================================
// THREE.JS ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.01;
    const elapsedTime = time;
    
    // Orbiting lights
    pinkLight.position.x = Math.sin(elapsedTime * 0.5) * 8;
    pinkLight.position.z = Math.cos(elapsedTime * 0.5) * 8;
    pinkLight.position.y = 2 + Math.sin(elapsedTime * 0.3) * 1.5;
    
    cyanLight.position.x = Math.cos(elapsedTime * 0.5) * 8;
    cyanLight.position.z = -Math.sin(elapsedTime * 0.5) * 8;
    cyanLight.position.y = 2 + Math.cos(elapsedTime * 0.3) * 1.5;
    
    // Sphere rotation
    sphereMesh.rotation.x += 0.005;
    sphereMesh.rotation.y += 0.005;
    
    // Breathing animation - synced with timer
    if (isRunning) {
        // Breathing effect (pulse in sync with timer seconds)
        const breathingScale = 1.0 + Math.sin(elapsedTime * breathingSpeed) * 0.08;
        sphereMesh.scale.set(breathingScale, breathingScale, breathingScale);
    } else {
        // Idle rotation when paused
        const idleScale = 1.0 + Math.sin(elapsedTime * 1.5) * 0.03;
        sphereMesh.scale.set(idleScale, idleScale, idleScale);
    }
    
    composer.render();
}
animate();

// ==========================================
// WINDOW RESIZE HANDLER
// ==========================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// AUTHENTICATION & INITIALIZATION
// ==========================================
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

async function init() {
    const user = await requireAuthOrRedirect();
    if (!user) return;
    
    currentUser = user;
    
    // Initialize UI
    updateTimerDisplay();
    updateStatus();
    updatePlayPauseIcon();
    updateFullscreenIcon();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (isRunning) {
                pauseTimer();
                stopWhiteNoise();
            } else {
                startTimer();
            }
        } else if (e.key === 'Escape') {
            if (!els.durationEditor?.classList.contains('hidden')) {
                closeDurationEditor();
            } else if (!els.sessionOverlay?.classList.contains('hidden')) {
                hideSessionComplete();
            }
        }
    });
}

init();
