import './supabaseClient.js';
import { CONFIG } from './config.js';

const HF_TOKEN = String(CONFIG?.HF_TOKEN || '').trim();

// You can swap this to any text-generation model you have access to.
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';

const supabase = window.supabaseClient;

let HfInferenceCtor = null;
async function getHfInferenceCtor() {
  if (HfInferenceCtor) return HfInferenceCtor;

  // CDN import fallback chain (keeps the page resilient if a CDN hiccups)
  const candidates = [
    'https://cdn.jsdelivr.net/npm/@huggingface/inference@2.8.0/+esm',
    'https://esm.sh/@huggingface/inference@2.8.0',
  ];

  let lastErr = null;
  for (const url of candidates) {
    try {
      const mod = await import(url);
      if (mod?.HfInference) {
        HfInferenceCtor = mod.HfInference;
        return HfInferenceCtor;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Failed to import HfInference from CDN.');
}

// A. State Management
const dailyData = { sleep_hours: 0, study_hours: 0, game_hours: 0, mood: 5 };
let currentStep = 0;
let isTransitioning = false;
let isGenerating = false;
let currentUser = null;

const els = {
  container: document.getElementById('question-container'),
  progressBar: document.getElementById('progress-bar'),
  resultOverlay: document.getElementById('result-overlay'),
  resultText: document.getElementById('result-text'),
  resultClose: document.getElementById('result-close'),
  skipType: document.getElementById('skip-type'),
};

function safeNum(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function getUtcTodayBounds() {
  // YYYY-MM-DD in UTC (matches the spec snippet)
  const today = new Date().toISOString().split('T')[0];
  return {
    today,
    start: `${today}T00:00:00.000Z`,
    end: `${today}T23:59:59.999Z`,
  };
}

async function hasDailyLogForToday(user) {
  const { start, end } = getUtcTodayBounds();
  const { data: logs, error } = await supabase
    .from('daily_logs')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(1);

  if (error) {
    console.warn('daily_logs gate check error:', error.message || error);
    return false;
  }

  return Boolean(logs && logs.length > 0);
}

function showDoneForTodayOverlay() {
  if (!els.resultOverlay || !els.resultText) return;

  const titleEl = document.getElementById('result-title');
  if (titleEl) titleEl.textContent = 'Daily Log Completed ✅';

  els.resultText.textContent =
    "You're done for today. Come back tomorrow for your next AI analysis.\n\nRedirecting to dashboard…";

  if (els.skipType) els.skipType.classList.add('hidden');
  if (els.resultClose) els.resultClose.classList.add('hidden');

  openResultOverlay();
}

async function requireAuthOrRedirect() {
  if (!supabase) {
    console.error('Supabase client missing. Check supabaseClient.js and CDN load.');
    window.location.replace('index.html');
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) console.warn('Auth check error:', error.message || error);

  const user = data?.user;
  if (!user) {
    window.location.replace('index.html');
    return null;
  }
  return user;
}

function setProgressForStep(stepIndex) {
  const stepsCount = steps.length;
  const pct = clamp(((stepIndex + 1) / stepsCount) * 100, 0, 100);
  if (els.progressBar) els.progressBar.style.width = `${pct}%`;
}

function formatHours(n) {
  const v = safeNum(n, 0);
  // Keep it clean: show .5 increments as one decimal, whole numbers as integers.
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

function stepShell({ title, subtitle, bodyHtml, showBack, nextLabel, hint }) {
  return `
    <div class="step">
      <div class="kicker">Daily Check-in</div>
      <h1 class="title">${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
      ${bodyHtml}
      <div class="nav">
        <div class="nav__left">
          ${
            showBack
              ? `<button id="back-btn" class="btn btn--ghost" type="button">Back</button>`
              : `<span class="hint">${hint || ''}</span>`
          }
        </div>
        <div class="nav__right">
          ${hint && showBack ? `<span class="hint">${hint}</span>` : ''}
          <button id="next-btn" class="btn btn--primary" type="button">${nextLabel || 'Next'}</button>
        </div>
      </div>
    </div>
  `;
}

function rangeStep({ title, subtitle, key, min = 0, max = 12, step = 0.5 }) {
  const value = clamp(safeNum(dailyData[key], 0), min, max);
  const bodyHtml = `
    <div class="range">
      <div class="range__value">
        <span id="range-value">${formatHours(value)}</span>
        <span class="range__unit">h</span>
      </div>
      <input
        id="range-input"
        class="range__input"
        type="range"
        min="${min}"
        max="${max}"
        step="${step}"
        value="${value}"
        aria-label="${title}"
      />
      <div class="range__labels">
        <span>${min}h</span>
        <span>${max}h</span>
      </div>
    </div>
  `;
  return stepShell({
    title,
    subtitle,
    bodyHtml,
    showBack: currentStep > 0,
    nextLabel: 'Next',
    hint: 'Press Enter ↵',
  });
}

function moodEmojiFor(score) {
  // score: 1..10
  const map = {
    1: '😫',
    2: '😣',
    3: '😞',
    4: '😕',
    5: '😐',
    6: '🙂',
    7: '😊',
    8: '😁',
    9: '🤩',
    10: '🚀',
  };
  return map[score] || '🙂';
}

function moodStep() {
  const selected = clamp(safeNum(dailyData.mood, 5), 1, 10);
  const buttons = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    const isSelected = score === selected;
    const emoji = moodEmojiFor(score);
    return `
      <button
        class="mood-btn ${isSelected ? 'is-selected' : ''}"
        type="button"
        data-mood="${score}"
        aria-pressed="${isSelected ? 'true' : 'false'}"
        aria-label="Mood ${score} out of 10"
      >
        <span class="mood-emoji" aria-hidden="true">${emoji}</span>
        <span class="mood-score">${score}/10</span>
      </button>
    `;
  }).join('');

  const bodyHtml = `
    <div class="mood-grid" role="group" aria-label="Mood scale">
      ${buttons}
    </div>
  `;

  return stepShell({
    title: 'How are you feeling?',
    subtitle: 'Choose a number (1–10). Tap an emoji to auto-advance.',
    bodyHtml,
    showBack: true,
    nextLabel: 'Next',
    hint: 'Tap to auto-advance',
  });
}

function summaryStep() {
  const bodyHtml = `
    <div class="loading" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <div>
        <div class="subtitle" style="margin-top:0;">Generating your daily analysis…</div>
        <div class="hint" style="margin-top:0.35rem;">This may take a moment.</div>
      </div>
    </div>
  `;

  // Keep the same shell but disable the "Next" button via JS.
  return stepShell({
    title: 'Generating your daily analysis…',
    subtitle: 'Saving today’s log and requesting an AI summary.',
    bodyHtml,
    showBack: false,
    nextLabel: 'Working…',
    hint: '',
  });
}

const steps = [
  {
    id: 'sleep',
    render: () =>
      rangeStep({
        title: 'How many hours did you sleep?',
        subtitle: 'Be honest—this is signal, not judgment.',
        key: 'sleep_hours',
        min: 0,
        max: 12,
        step: 0.5,
      }),
    attach: () => attachRangeHandlers('sleep_hours'),
  },
  {
    id: 'study',
    render: () =>
      rangeStep({
        title: 'How long was your deep work today?',
        subtitle: 'Only count focused, high-intensity study/work.',
        key: 'study_hours',
        min: 0,
        max: 12,
        step: 0.5,
      }),
    attach: () => attachRangeHandlers('study_hours'),
  },
  {
    id: 'entertainment',
    render: () =>
      rangeStep({
        title: 'How much time on games/social media?',
        subtitle: 'Estimate. Precision isn’t required.',
        key: 'game_hours',
        min: 0,
        max: 12,
        step: 0.5,
      }),
    attach: () => attachRangeHandlers('game_hours'),
  },
  {
    id: 'mood',
    render: () => moodStep(),
    attach: () => attachMoodHandlers(),
  },
  {
    id: 'summary',
    render: () => summaryStep(),
    attach: () => attachSummaryHandlers(),
  },
];

function getStepRoot() {
  return els.container?.querySelector?.('.step') || null;
}

function wireNavButtons() {
  const nextBtn = document.getElementById('next-btn');
  const backBtn = document.getElementById('back-btn');

  if (backBtn) {
    backBtn.addEventListener('click', () => prevStep());
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => nextStep());
  }
}

function attachRangeHandlers(key) {
  wireNavButtons();

  const input = document.getElementById('range-input');
  const valueEl = document.getElementById('range-value');
  const nextBtn = document.getElementById('next-btn');

  if (!input || !valueEl) return;

  const update = () => {
    const v = clamp(safeNum(input.value, 0), 0, 12);
    dailyData[key] = v;
    valueEl.textContent = formatHours(v);
  };

  input.addEventListener('input', update);
  input.addEventListener('change', update);
  update();

  // Quality-of-life: focus slider by default
  setTimeout(() => input.focus(), 0);

  // Enable next always (even 0 is valid)
  if (nextBtn) nextBtn.disabled = false;
}

function attachMoodHandlers() {
  wireNavButtons();

  const buttons = Array.from(document.querySelectorAll('.mood-btn'));
  const nextBtn = document.getElementById('next-btn');

  if (nextBtn) nextBtn.disabled = false;

  function select(score) {
    dailyData.mood = clamp(safeNum(score, 5), 1, 10);
    buttons.forEach((b) => {
      const s = Number(b.getAttribute('data-mood'));
      const isSelected = s === dailyData.mood;
      b.classList.toggle('is-selected', isSelected);
      b.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const score = Number(btn.getAttribute('data-mood'));
      select(score);
      // Auto-advance for simple clicks.
      setTimeout(() => nextStep(), 220);
    });
  });

  // Focus selected mood button for accessibility.
  const selectedBtn = buttons.find((b) => Number(b.getAttribute('data-mood')) === dailyData.mood);
  setTimeout(() => (selectedBtn || buttons[4])?.focus?.(), 0);
}

function attachSummaryHandlers() {
  wireNavButtons();

  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.disabled = true;

  if (!isGenerating) {
    isGenerating = true;
    void finalizeAndGenerate();
  }
}

function renderStep(stepIndex, { animateIn = true } = {}) {
  if (!els.container) return;

  currentStep = clamp(stepIndex, 0, steps.length - 1);
  setProgressForStep(currentStep);

  els.container.innerHTML = steps[currentStep].render();
  steps[currentStep].attach?.();

  const root = getStepRoot();
  if (!root) return;

  if (!animateIn || prefersReducedMotion() || !window.gsap) {
    root.style.opacity = '1';
    root.style.transform = 'translateX(0px)';
    return;
  }

  window.gsap.fromTo(
    root,
    { opacity: 0, x: 28 },
    { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }
  );
}

// B. Transitions (GSAP)
function nextStep() {
  if (isTransitioning) return;
  if (currentStep >= steps.length - 1) return;

  const root = getStepRoot();
  const gsap = window.gsap;

  // If no GSAP or reduced motion, just swap.
  if (!root || !gsap || prefersReducedMotion()) {
    renderStep(currentStep + 1, { animateIn: true });
    return;
  }

  isTransitioning = true;
  gsap.to(root, {
    opacity: 0,
    x: -28,
    duration: 0.28,
    ease: 'power2.in',
    onComplete: () => {
      renderStep(currentStep + 1, { animateIn: true });
      isTransitioning = false;
    },
  });
}

function prevStep() {
  if (isTransitioning) return;
  if (currentStep <= 0) return;

  const root = getStepRoot();
  const gsap = window.gsap;

  if (!root || !gsap || prefersReducedMotion()) {
    renderStep(currentStep - 1, { animateIn: true });
    return;
  }

  isTransitioning = true;
  gsap.to(root, {
    opacity: 0,
    x: 28,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      renderStep(currentStep - 1, { animateIn: true });
      isTransitioning = false;
    },
  });
}

function openResultOverlay() {
  if (!els.resultOverlay) return;
  els.resultOverlay.classList.remove('hidden');

  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) {
    gsap.fromTo(
      els.resultOverlay.querySelector('.result-card'),
      { opacity: 0, y: 12, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' }
    );
  }
}

function closeResultOverlay() {
  if (!els.resultOverlay) return;
  els.resultOverlay.classList.add('hidden');
}

function normalizeProfile(profile) {
  return {
    gpa: profile?.gpa ?? '—',
    major: profile?.major ?? '—',
    ap_courses: profile?.ap_courses ?? '—',
  };
}

function buildPrompt({ profile, log }) {
  const p = normalizeProfile(profile);
  const sleep = formatHours(log.sleep_hours);
  const study = formatHours(log.study_hours);
  const game = formatHours(log.game_hours);
  const mood = clamp(safeNum(log.mood, 5), 1, 10);

  return `User Profile: GPA ${p.gpa}, Aiming for ${p.major}. Today's Log: Sleep ${sleep}h, Study ${study}h, Game ${game}h, Mood ${mood}/10. Task: Give a 1-paragraph summary of their state and 1 specific advice for tomorrow.`;
}

async function fetchUserProfile() {
  return await supabase
    .from('user_data')
    .select('gpa, major, ap_courses')
    .limit(1)
    .maybeSingle();
}

async function saveAIResult({ userId, aiText }) {
  // 1. Clean the text (remove quotes if needed)
  const cleanText = String(aiText || '').trim();

  // 2. Insert into Supabase
  const { error: aiSaveError } = await supabase
    .from('ai_recommendations')
    .insert({
      user_id: userId,
      strategy_plan: cleanText, // Column Name: strategy_plan
      // recommended_unis: [],   // Optional: if your prompt returns JSON, parse it here
      created_at: new Date(),
    });

  if (aiSaveError) {
    console.error('Failed to save AI result:', aiSaveError);
  } else {
    console.log('AI Result saved to DB!');
  }

  return { cleanText, aiSaveError };
}

async function callAI(prompt) {
  if (!HF_TOKEN || HF_TOKEN === 'YOUR_NEW_HF_TOKEN_HERE') {
    throw new Error('HF_TOKEN is not set. Add your Hugging Face token in config.js.');
  }

  const HfInference = await getHfInferenceCtor();
  const hf = new HfInference(HF_TOKEN);
  const res = await hf.textGeneration({
    model: HF_MODEL,
    inputs: prompt,
    parameters: {
      max_new_tokens: 220,
      temperature: 0.7,
      return_full_text: false,
    },
  });

  const text = (res?.generated_text ?? '').trim();
  if (!text) throw new Error('AI returned an empty response.');
  return text;
}

function fallbackAnalysis(profile) {
  const p = normalizeProfile(profile);
  const mood = clamp(safeNum(dailyData.mood, 5), 1, 10);

  const sleep = safeNum(dailyData.sleep_hours, 0);
  const study = safeNum(dailyData.study_hours, 0);
  const game = safeNum(dailyData.game_hours, 0);

  const sleepNote = sleep < 6 ? 'Sleep is low—expect higher cognitive friction.' : sleep >= 8 ? 'Sleep looks solid—good recovery.' : 'Sleep is okay, but more would help consistency.';
  const focusNote = study >= 4 ? 'Deep work is strong.' : study >= 2 ? 'Deep work is moderate.' : 'Deep work is low—tomorrow needs a cleaner block.';
  const distractNote = game >= 4 ? 'Entertainment time is high; attention may be fragmented.' : game >= 2 ? 'Entertainment time is moderate.' : 'Entertainment time is low; good restraint.';

  const advice =
    sleep < 7
      ? 'Tomorrow: lock in a fixed bedtime and protect the first 90 minutes after waking for focused work.'
      : study < 2
        ? 'Tomorrow: schedule a single 90-minute deep work block (phone out of reach) before any entertainment.'
        : game >= 4
          ? 'Tomorrow: cap games/social to a fixed 60–90 minute window after your main deep work block.'
          : 'Tomorrow: repeat what worked—start with your hardest task first, then reward yourself after.';

  return `User Profile: GPA ${p.gpa}, Aiming for ${p.major}. Today’s signal suggests: ${sleepNote} ${focusNote} ${distractNote} Mood is ${mood}/10, which is a useful indicator of load vs recovery. Advice: ${advice}`;
}

function typewriter(el, text, { speedMs = 14 } = {}) {
  if (!el) return { stop: () => {}, finish: () => {} };

  if (speedMs <= 0) {
    el.textContent = text;
    return { stop: () => {}, finish: () => {} };
  }

  let i = 0;
  let stopped = false;
  let timer = null;

  el.textContent = '';

  const tick = () => {
    if (stopped) return;
    i += 1;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      timer = null;
      return;
    }
    timer = window.setTimeout(tick, speedMs);
  };

  timer = window.setTimeout(tick, speedMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    },
    finish: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      el.textContent = text;
    },
  };
}

async function finalizeAndGenerate() {
  // C. The Final Step (Save & AI)
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.disabled = true;

  // 1) Verify Data Collection (force numeric types right before save)
  const sleepValRaw = parseFloat(dailyData.sleep_hours || 0);
  const studyValRaw = parseFloat(dailyData.study_hours || 0);
  const gameValRaw = parseFloat(dailyData.game_hours || 0);
  const moodValRaw = parseInt(dailyData.mood || 5, 10);

  const sleepVal = Number.isFinite(sleepValRaw) ? sleepValRaw : 0;
  const studyVal = Number.isFinite(studyValRaw) ? studyValRaw : 0;
  const gameVal = Number.isFinite(gameValRaw) ? gameValRaw : 0;
  const moodVal = Number.isFinite(moodValRaw) ? moodValRaw : 5;

  // Keep state in sync (prevents any downstream mismatch)
  dailyData.sleep_hours = sleepVal;
  dailyData.study_hours = studyVal;
  dailyData.game_hours = gameVal;
  dailyData.mood = clamp(moodVal, 1, 10);

  let profile = null;
  let analysisText = '';

  try {
    // 2) Verify Database Insert (schema mapping + hard fail on error)
    const userId = currentUser?.id;
    if (!userId) {
      throw new Error('No authenticated user found. Please log in again.');
    }

    const { error: logError } = await supabase
      .from('daily_logs')
      .insert({
        user_id: userId,
        sleep_hours: sleepVal, // Column: sleep_hours
        study_hours: studyVal, // Column: study_hours
        game_hours: gameVal, // Column: game_hours
        mood: dailyData.mood, // Column: mood
        updated_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Log Error:', logError);
      throw logError; // Stop execution if save fails
    }

    // Fetch context (strict column compliance)
    const profileRes = await fetchUserProfile();
    if (profileRes.error) throw profileRes.error;
    profile = profileRes.data || null;

    // 3) Verify AI Logic (only after save confirmed; use numeric values)
    const prompt = buildPrompt({
      profile,
      log: {
        sleep_hours: sleepVal,
        study_hours: studyVal,
        game_hours: gameVal,
        mood: dailyData.mood,
      },
    });

    try {
      analysisText = await callAI(prompt);
    } catch (aiErr) {
      console.warn('AI call failed, using fallback analysis:', aiErr?.message || aiErr);
      analysisText = fallbackAnalysis(profile);
    }

    // Save AI result (must include user_id + strategy_plan + created_at)
    const { cleanText } = await saveAIResult({ userId, aiText: analysisText });
    analysisText = cleanText;
  } catch (err) {
    console.warn('Daily finalize error:', err?.message || err);
    if (!analysisText) {
      analysisText =
        'Something went wrong while saving or generating your analysis. Your daily values may not have been recorded. Please try again.';
    }
  }

  // Show result overlay with typewriter effect
  openResultOverlay();

  const textEl = els.resultText;
  const writer = typewriter(textEl, analysisText, { speedMs: prefersReducedMotion() ? 0 : 14 });

  if (els.skipType) {
    els.skipType.onclick = () => writer.finish();
  }

  // Close handlers
  if (els.resultClose) els.resultClose.onclick = () => closeResultOverlay();
  if (els.resultOverlay) {
    els.resultOverlay.addEventListener('click', (e) => {
      if (e.target === els.resultOverlay) closeResultOverlay();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.resultOverlay && !els.resultOverlay.classList.contains('hidden')) {
      closeResultOverlay();
    }
  });
}

function wireGlobalKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (els.resultOverlay && !els.resultOverlay.classList.contains('hidden')) return;

    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase?.() || '';
    if (tag === 'button' || tag === 'a') return;

    // Enter acts like Next for the flow.
    nextStep();
  });
}

// ==========================================
// CUSTOM CURSOR
// ==========================================
const cursor = document.createElement('div');
cursor.className = 'custom-cursor';
document.body.appendChild(cursor);

document.addEventListener('mousemove', (e) => {
  if (window.gsap) {
    window.gsap.to(cursor, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.3,
      ease: 'power2.out'
    });
  } else {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  }
});

// Cursor hover effect on interactive elements
const interactiveElements = document.querySelectorAll('button, a, .mood-btn, .range__input');
interactiveElements.forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

// Update interactive elements when DOM changes
const observer = new MutationObserver(() => {
  const newElements = document.querySelectorAll('button, a, .mood-btn, .range__input');
  newElements.forEach(el => {
    if (!el.hasAttribute('data-cursor-wired')) {
      el.setAttribute('data-cursor-wired', 'true');
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

async function init() {
  const user = await requireAuthOrRedirect();
  if (!user) return;
  currentUser = user;

  // Double-check gate: block direct URL access if already logged today
  const alreadyLoggedToday = await hasDailyLogForToday(user);
  if (alreadyLoggedToday) {
    showDoneForTodayOverlay();
    setTimeout(() => window.location.replace('dashboard.html'), 3000);
    return;
  }

  wireGlobalKeys();

  // Initialize defaults
  dailyData.sleep_hours = clamp(safeNum(dailyData.sleep_hours, 0), 0, 12);
  dailyData.study_hours = clamp(safeNum(dailyData.study_hours, 0), 0, 12);
  dailyData.game_hours = clamp(safeNum(dailyData.game_hours, 0), 0, 12);
  dailyData.mood = clamp(safeNum(dailyData.mood, 5), 1, 10);

  renderStep(0, { animateIn: false });

  // Kick progress to 20% immediately (matches 5-step spec).
  setTimeout(() => setProgressForStep(0), 0);
}

init();

