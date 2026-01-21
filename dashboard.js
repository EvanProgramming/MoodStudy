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

  els.insightText.textContent = plan.trim();
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

  await Promise.allSettled([gateDailyCheckin(user), loadProfileBadge(), loadLatestInsight()]);

  animateIn();
}

init();

