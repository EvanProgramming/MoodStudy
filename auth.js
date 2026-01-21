(() => {
  const overlay = document.getElementById('auth-overlay');
  const card = document.getElementById('auth-card');
  const closeBtn = document.getElementById('auth-close');
  const startBtn = document.getElementById('start-btn');

  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit');
  const errorEl = document.getElementById('auth-error');

  if (!overlay || !card || !closeBtn || !startBtn || !tabLogin || !tabRegister || !form || !emailInput || !passwordInput || !submitBtn || !errorEl) {
    console.warn('Auth modal elements missing from DOM.');
    return;
  }

  /** @type {'login'|'register'} */
  let mode = 'login';

  function setError(message) {
    errorEl.textContent = message || '';
  }

  function shake() {
    card.classList.remove('shake');
    // Force reflow so animation can re-trigger
    void card.offsetWidth;
    card.classList.add('shake');
  }

  card.addEventListener('animationend', (e) => {
    if (e.animationName === 'authShake') {
      card.classList.remove('shake');
    }
  });

  function setMode(nextMode) {
    mode = nextMode;

    const isLogin = mode === 'login';
    tabLogin.classList.toggle('is-active', isLogin);
    tabRegister.classList.toggle('is-active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));

    submitBtn.textContent = isLogin ? 'CONNECT' : 'REGISTER';
    passwordInput.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
    setError('');
  }

  function openModal() {
    overlay.classList.remove('hidden');
    setError('');
    setMode(mode);
    setTimeout(() => emailInput.focus(), 0);
  }

  function closeModal() {
    overlay.classList.add('hidden');
    setError('');
  }

  // Open modal when "Start Syncing" is clicked
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });

  // Close modal
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  // Mode toggle
  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');

    const email = String(emailInput.value || '').trim();
    const password = String(passwordInput.value || '');

    if (!email || !password) {
      setError('Email and password are required.');
      shake();
      return;
    }

    const client = window.supabaseClient;
    if (!client) {
      setError('Supabase is not configured yet. Fill in YOUR_SUPABASE_URL and YOUR_SUPABASE_KEY in supabaseClient.js.');
      shake();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? 'CONNECTING…' : 'REGISTERING…';

    try {
      let result;
      if (mode === 'register') {
        result = await client.auth.signUp({ email, password });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        setError(result.error.message || 'Authentication failed.');
        shake();
        return;
      }

      alert('Welcome');
      window.location.href = 'dashboard.html';
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
      shake();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'CONNECT' : 'REGISTER';
    }
  });
})();

