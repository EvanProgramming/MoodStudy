import './supabaseClient.js';

const supabase = window.supabaseClient;

const els = {
  formCard: document.getElementById('profile-form-card'),
  gradeGroup: document.getElementById('grade-group'),
  gradeBtns: Array.from(document.querySelectorAll('#grade-group .segmented__btn')),
  gpaInput: document.getElementById('gpa-input'),
  gpaValue: document.getElementById('gpa-value'),
  gpaReadout: document.getElementById('gpa-readout'),
  majorInput: document.getElementById('major-input'),
  regionInput: document.getElementById('region-input'),
  apTags: document.getElementById('ap-tags'),
  apBtns: Array.from(document.querySelectorAll('.ap-tag')),
  apCount: document.getElementById('ap-count'),
  saveBtn: document.getElementById('save-btn'),
  toast: document.getElementById('toast'),
  sphereContainer: document.getElementById('sphere-container'),
};

const state = {
  grade: null,
  gpa: 0,
  selectedTags: new Set(),
  toastTimer: null,
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

function formatGpa(v) {
  return clamp(safeNum(v, 0), 0, 5).toFixed(1);
}

function showToast(message, { isError = false, durationMs = 1200 } = {}) {
  if (!els.toast) return;
  if (state.toastTimer) window.clearTimeout(state.toastTimer);

  els.toast.textContent = String(message || '').trim();
  els.toast.classList.toggle('is-error', Boolean(isError));
  els.toast.classList.add('is-visible');

  state.toastTimer = window.setTimeout(() => {
    els.toast?.classList?.remove('is-visible');
  }, durationMs);
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

function setGrade(grade) {
  const next = grade ? String(grade) : null;
  state.grade = next;

  els.gradeBtns.forEach((btn) => {
    const v = btn.getAttribute('data-grade');
    const selected = v === next;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function setGpa(gpa) {
  const v = clamp(safeNum(gpa, 0), 0, 5);
  state.gpa = v;

  const formatted = formatGpa(v);
  if (els.gpaInput) els.gpaInput.value = String(v);
  if (els.gpaValue) els.gpaValue.textContent = formatted;
  if (els.gpaReadout) els.gpaReadout.textContent = formatted;

  orb?.setGpa?.(v);
}

function setSelectedTags(tags) {
  let list = [];
  if (Array.isArray(tags)) {
    list = tags;
  } else if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  state.selectedTags = new Set(list.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean));

  els.apBtns.forEach((btn) => {
    const tag = btn.getAttribute('data-tag') || '';
    btn.classList.toggle('is-selected', state.selectedTags.has(tag));
    btn.setAttribute('aria-pressed', state.selectedTags.has(tag) ? 'true' : 'false');
  });

  updateApCount();
}

function updateApCount() {
  if (els.apCount) els.apCount.textContent = String(state.selectedTags.size);
}

function wireInteractions() {
  // Grade segmented buttons
  els.gradeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-grade');
      setGrade(v);
    });
  });

  // GPA slider
  const updateGpaFromInput = () => setGpa(safeNum(els.gpaInput?.value, 0));
  els.gpaInput?.addEventListener('input', updateGpaFromInput);
  els.gpaInput?.addEventListener('change', updateGpaFromInput);

  // AP tags
  els.apBtns.forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag') || '';
      if (!tag) return;

      if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
      } else {
        state.selectedTags.add(tag);
      }

      btn.classList.toggle('is-selected', state.selectedTags.has(tag));
      btn.setAttribute('aria-pressed', state.selectedTags.has(tag) ? 'true' : 'false');
      updateApCount();
    });
  });
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from('user_data')
    .select('grade, gpa, major, region, ap_courses')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('user_data fetch error:', error.message || error);
    showToast('Could not load profile. You can still save new values.', { isError: true, durationMs: 1800 });
    return null;
  }

  return data || null;
}

function applyProfileToForm(row) {
  setGrade(row?.grade ?? null);
  setGpa(row?.gpa ?? 0);
  if (els.majorInput) els.majorInput.value = row?.major ?? '';
  if (els.regionInput) els.regionInput.value = row?.region ?? '';
  setSelectedTags(row?.ap_courses ?? []);
}

async function saveProfile(user) {
  if (!els.saveBtn) return;
  els.saveBtn.disabled = true;
  els.saveBtn.classList.remove('is-saved');

  const originalLabel = els.saveBtn.textContent || 'Save Profile';
  els.saveBtn.textContent = 'Saving…';

  const gradeVal = state.grade ? String(state.grade) : null;
  const gpaVal = clamp(safeNum(els.gpaInput?.value, 0), 0, 5);
  const majorVal = (els.majorInput?.value || '').trim() || null;
  const regionVal = (els.regionInput?.value || '').trim() || null;
  const selectedTags = Array.from(state.selectedTags);

  try {
    const { error } = await supabase.from('user_data').upsert({
      user_id: user.id,
      grade: gradeVal,
      gpa: gpaVal,
      major: majorVal,
      region: regionVal,
      ap_courses: selectedTags,
      updated_at: new Date(),
    });

    if (error) throw error;

    els.saveBtn.classList.add('is-saved');
    els.saveBtn.textContent = 'Saved';
    showToast('Saved successfully.');

    window.setTimeout(() => {
      window.location.replace('dashboard.html');
    }, 1000);
  } catch (err) {
    console.warn('Profile save error:', err?.message || err);
    showToast('Save failed. Please try again.', { isError: true, durationMs: 1800 });
    els.saveBtn.textContent = originalLabel;
    els.saveBtn.disabled = false;
  }
}

function animateIn() {
  const gsap = window.gsap;
  if (!gsap || prefersReducedMotion()) return;

  if (els.formCard) {
    gsap.fromTo(
      els.formCard,
      { opacity: 0, x: -50 },
      { opacity: 1, x: 0, duration: 0.85, ease: 'power3.out', clearProps: 'transform' }
    );
  }

  if (els.apBtns?.length) {
    gsap.from(els.apBtns, {
      opacity: 0,
      y: 10,
      duration: 0.55,
      ease: 'power3.out',
      stagger: 0.05,
      delay: 0.18,
      clearProps: 'transform',
    });
  }
}

// -----------------------------
// Orb (Three.js mini scene)
// -----------------------------

const orb = (() => {
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let sphere = null;
  let ambient = null;
  let keyLight = null;
  let rimLight = null;

  let rafId = null;
  let t = 0;

  let targetScale = 1.0;
  let currentScale = 1.0;

  let targetEmissive = 0.10;
  let currentEmissive = 0.10;

  const c0 = { r: 0.36, g: 0.22, b: 1.0 }; // deep violet
  const c1 = { r: 0.0, g: 1.0, b: 1.0 }; // cyan
  let colorMix = 0;
  let targetColorMix = 0;

  function lerp(a, b, k) {
    return a + (b - a) * k;
  }

  function lerpColorRGB(mix) {
    const r = lerp(c0.r, c1.r, mix);
    const g = lerp(c0.g, c1.g, mix);
    const b = lerp(c0.b, c1.b, mix);
    return { r, g, b };
  }

  function sizeToContainer() {
    if (!renderer || !camera || !els.sphereContainer) return;
    const rect = els.sphereContainer.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    renderer?.dispose?.();
    renderer = null;
  }

  async function init() {
    if (!els.sphereContainer) return;

    try {
      THREE = await import('three');
    } catch (e) {
      console.warn('Three import failed. Orb will use static container.', e?.message || e);
      return;
    }

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 3.2;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    els.sphereContainer.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    keyLight = new THREE.DirectionalLight(0x00ffff, 1.15);
    keyLight.position.set(2.4, 1.2, 3.2);
    scene.add(keyLight);

    rimLight = new THREE.DirectionalLight(0xff00ff, 0.75);
    rimLight.position.set(-2.2, -1.1, 2.2);
    scene.add(rimLight);

    const geom = new THREE.SphereGeometry(1, 72, 72);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x6d5bff,
      roughness: 0.16,
      metalness: 0.15,
      transmission: 0.35,
      thickness: 1.0,
      ior: 1.35,
      clearcoat: 0.9,
      clearcoatRoughness: 0.22,
      emissive: new THREE.Color(0x2200ff),
      emissiveIntensity: 0.12,
    });

    sphere = new THREE.Mesh(geom, material);
    scene.add(sphere);

    sizeToContainer();

    const ro = window.ResizeObserver
      ? new ResizeObserver(() => sizeToContainer())
      : null;
    ro?.observe?.(els.sphereContainer);
    window.addEventListener('resize', sizeToContainer);

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!renderer || !scene || !camera || !sphere) return;

      t += 0.01;

      // smooth towards targets
      currentScale = lerp(currentScale, targetScale, 0.08);
      currentEmissive = lerp(currentEmissive, targetEmissive, 0.08);
      colorMix = lerp(colorMix, targetColorMix, 0.08);

      const wobble = 1 + Math.sin(t * 2.6) * 0.02;
      const finalScale = currentScale * wobble;
      sphere.scale.set(finalScale, finalScale, finalScale);
      sphere.rotation.y += 0.006;
      sphere.rotation.x += 0.0035;

      const rgb = lerpColorRGB(colorMix);
      sphere.material.color.setRGB(rgb.r, rgb.g, rgb.b);
      sphere.material.emissiveIntensity = currentEmissive;

      // subtle light orbit for iridescent feel
      keyLight.position.x = 2.4 + Math.sin(t * 0.7) * 0.35;
      rimLight.position.y = -1.1 + Math.cos(t * 0.6) * 0.35;

      renderer.render(scene, camera);
    };

    animate();
  }

  function setGpa(gpa) {
    const norm = clamp(safeNum(gpa, 0), 0, 5) / 5;
    targetScale = 0.88 + norm * 0.34;
    targetEmissive = 0.08 + norm * 0.34;
    targetColorMix = norm;
  }

  return { init, setGpa, stop };
})();

async function init() {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  wireInteractions();

  // Initialize UI defaults immediately
  setGrade(null);
  setGpa(0);
  setSelectedTags([]);

  // Orb can initialize in parallel with DB load (visual should appear fast).
  void orb.init();

  const row = await loadProfile(user);
  if (row) applyProfileToForm(row);

  if (els.saveBtn) {
    els.saveBtn.addEventListener('click', () => void saveProfile(user));
  }

  animateIn();
}

init();

