import './supabaseClient.js';

const supabase = window.supabaseClient;

const els = {
  logoutBtn: document.getElementById('logout-btn'),
  userIdentity: document.getElementById('user-identity'),
  majorBadge: document.getElementById('major-badge'),
  insightText: document.getElementById('insight-text'),
  insightMeta: document.getElementById('insight-meta'),
  hero: document.querySelector('.hero'),
  cards: document.querySelectorAll('.action-card'),
  insight: document.querySelector('.insight'),
  onboardingOverlay: document.getElementById('onboarding-overlay'),
  onboardingStep1: document.getElementById('onboarding-step-1'),
  onboardingStep2: document.getElementById('onboarding-step-2'),
  onboardingMasterPlanBtn: document.getElementById('onboarding-master-plan-btn'),
  onboardingDismissBtn: document.getElementById('onboarding-dismiss-btn'),
};

function safeText(v, fallback = '—') {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : fallback;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function requireAuthOrRedirect() {
  if (!supabase) {
    console.error('Supabase client missing. Check supabaseClient.js and CDN load.');
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

async function handleLogout() {
  if (!els.logoutBtn) return;

  els.logoutBtn.addEventListener('click', async () => {
    els.logoutBtn.disabled = true;
    els.logoutBtn.textContent = 'Logging out…';
    try {
      await supabase?.auth?.signOut();
    } finally {
      window.location.replace('index.html');
    }
  });
}

async function loadProfileBadge() {
  if (!els.majorBadge) return;

  els.majorBadge.textContent = 'Loading profile…';

  const { data, error } = await supabase
    .from('user_data')
    .select('gpa, major, grade')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('user_data fetch error:', error.message || error);
    els.majorBadge.textContent = 'Targeting —';
    return;
  }

  if (!data) {
    els.majorBadge.textContent = 'Targeting —';
    return;
  }

  els.majorBadge.textContent = `Targeting ${safeText(data.major, '—')}`;
}

function renderMarkdown(text) {
  if (!text) return '';
  return window.marked?.parse?.(text) ?? text;
}

async function loadLatestInsight() {
  if (!els.insightText || !els.insightMeta) return;

  els.insightText.textContent = 'Fetching latest strategy…';
  els.insightMeta.textContent = 'AI: awaiting signal';

  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('strategy_plan, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('ai_recommendations fetch error:', error.message || error);
    els.insightText.textContent =
      'No data analysis yet. Complete your Daily Signal.';
    els.insightMeta.textContent = 'AI: no analysis';
    return;
  }

  const row = Array.isArray(data) ? data[0] : null;
  const plan = row?.strategy_plan ? String(row.strategy_plan) : '';

  if (!plan.trim()) {
    els.insightText.textContent =
      'No data analysis yet. Complete your Daily Signal.';
    els.insightMeta.textContent = 'AI: no analysis';
    return;
  }

  els.insightText.innerHTML = renderMarkdown(plan.trim());
  els.insightMeta.textContent = `AI: ${formatDateTime(row?.created_at)}`;
}

function animateIn() {
  const gsap = window.gsap;
  if (!gsap) return;

  const targets = [
    els.hero,
    ...Array.from(els.cards || []),
    els.insight,
  ].filter(Boolean);

  gsap.from(targets, {
    opacity: 0,
    y: 18,
    duration: 0.85,
    ease: 'power3.out',
    stagger: 0.10,
    clearProps: 'transform',
  });
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

async function gateDailyCheckin(user) {
  const dailyCard = document.getElementById('card-daily'); // actual ID in dashboard.html
  if (!dailyCard) return;

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
    return;
  }

  if (logs && logs.length > 0) {
    dailyCard.classList.add('disabled');
    dailyCard.setAttribute('aria-disabled', 'true');

    const title = dailyCard.querySelector('.action-card__title');
    const text = dailyCard.querySelector('.action-card__text');
    const cta = dailyCard.querySelector('.action-card__cta');

    if (title) title.textContent = 'Daily Log Completed ✅';
    if (text) text.textContent = 'You already logged today. Come back tomorrow.';
    if (cta) cta.textContent = 'Completed';

    dailyCard.addEventListener('click', (e) => {
      e.preventDefault();
      alert("You've already logged your mood today! Come back tomorrow.");
    });
  }
}

async function hasMasterPlan(user) {
  const { data, error } = await supabase
    .from('user_data')
    .select('grade, gpa, major')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('user_data check error:', error.message || error);
    return false;
  }

  // Consider Master Plan complete if user has grade, gpa, and major
  if (!data) return false;
  
  const hasGrade = Boolean(data.grade);
  const hasGpa = typeof data.gpa === 'number' && data.gpa > 0;
  const hasMajor = Boolean(data.major && data.major.trim());

  return hasGrade && hasGpa && hasMajor;
}

function showOnboarding(step = 1) {
  if (!els.onboardingOverlay) return;

  // Ensure display is set before removing hidden class
  els.onboardingOverlay.style.display = 'grid';
  els.onboardingOverlay.classList.remove('hidden');
  
  if (step === 1) {
    els.onboardingStep1?.classList.remove('hidden');
    els.onboardingStep2?.classList.add('hidden');
  } else if (step === 2) {
    els.onboardingStep1?.classList.add('hidden');
    els.onboardingStep2?.classList.remove('hidden');
  }

  // Animate in
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) {
    const card = els.onboardingOverlay?.querySelector('.onboarding-card');
    if (card) {
      gsap.fromTo(
        card,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power3.out' }
      );
    }
  }
}

function hideOnboarding() {
  if (!els.onboardingOverlay) return;
  
  const gsap = window.gsap;
  if (gsap && !prefersReducedMotion()) {
    const card = els.onboardingOverlay?.querySelector('.onboarding-card');
    if (card) {
      gsap.to(card, {
        opacity: 0,
        y: -10,
        scale: 0.98,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          els.onboardingOverlay?.classList.add('hidden');
          els.onboardingOverlay.style.display = 'none';
        }
      });
    } else {
      els.onboardingOverlay?.classList.add('hidden');
      els.onboardingOverlay.style.display = 'none';
    }
  } else {
    els.onboardingOverlay?.classList.add('hidden');
    els.onboardingOverlay.style.display = 'none';
  }
}

function wireOnboarding() {
  if (!els.onboardingMasterPlanBtn || !els.onboardingDismissBtn) return;

  // Navigate to Master Plan
  els.onboardingMasterPlanBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });

  // Dismiss onboarding (step 2)
  els.onboardingDismissBtn.addEventListener('click', () => {
    hideOnboarding();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.onboardingOverlay && !els.onboardingOverlay.classList.contains('hidden')) {
      // Only allow closing on step 2, not step 1 (force them to go to Master Plan)
      if (els.onboardingStep2 && !els.onboardingStep2.classList.contains('hidden')) {
        hideOnboarding();
      }
    }
  });
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
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
const interactiveElements = document.querySelectorAll('button, a, .action-card');
interactiveElements.forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

// Update interactive elements when DOM changes
const observer = new MutationObserver(() => {
  const newElements = document.querySelectorAll('button, a, .action-card');
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

  const identity =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'Operator';

  if (els.userIdentity) {
    els.userIdentity.textContent = safeText(identity, 'Operator');
  }

  await handleLogout();
  wireOnboarding();

  // Ensure overlay starts hidden (for browser compatibility)
  if (els.onboardingOverlay) {
    els.onboardingOverlay.classList.add('hidden');
    els.onboardingOverlay.style.display = 'none';
  }

  // Check URL parameter for onboarding step
  const urlParams = new URLSearchParams(window.location.search);
  const onboardingStep = urlParams.get('onboarding');

  // Check if user has completed Master Plan
  const hasPlan = await hasMasterPlan(user);
  
  if (onboardingStep === 'step2' && hasPlan) {
    // User just completed Master Plan, show step 2
    showOnboarding(2);
    // Clean up URL
    window.history.replaceState({}, '', 'dashboard.html');
  } else if (!hasPlan) {
    // Show onboarding step 1 (Master Plan)
    showOnboarding(1);
  } else {
    // Explicitly ensure overlay is hidden if user has completed Master Plan
    if (els.onboardingOverlay) {
      els.onboardingOverlay.classList.add('hidden');
      els.onboardingOverlay.style.display = 'none';
    }
  }

  await Promise.allSettled([gateDailyCheckin(user), loadProfileBadge(), loadLatestInsight()]);

  animateIn();
}

init();

