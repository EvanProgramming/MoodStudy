// Import Three.js and post-processing effects
import * as THREE from 'three';
import { EffectComposer } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// GSAP ScrollTrigger setup (must be before Lenis)
gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis Smooth Scroll
const lenis = new Lenis({
    duration: 2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    smoothTouch: false,
    touchMultiplier: 2,
});

// Integrate Lenis with GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

// Use GSAP ticker for better synchronization
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// Maintain RAF for Lenis
function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ==========================================
// THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08090a); // Silent Obsidian – warm ink black

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

// ==========================================
// LIGHTING SETUP – Pure silver/white, no color cast
// ==========================================
const ambientLight = new THREE.AmbientLight(0x444444, 0.8);
scene.add(ambientLight);

// Directional lights – soft white/silver (replaces pink/cyan)
const keyLight1 = new THREE.DirectionalLight(0xe8e8e8, 0.4);
keyLight1.position.set(-3, 3, 5);
scene.add(keyLight1);

const keyLight2 = new THREE.DirectionalLight(0xe8e8e8, 0.4);
keyLight2.position.set(3, -3, 5);
scene.add(keyLight2);

const EnlightmentLight = new THREE.DirectionalLight(0xffffff, 1.2, 250);
EnlightmentLight.position.set(0, 0, 5);
scene.add(EnlightmentLight);

const heroSpotLight = new THREE.SpotLight(0xffffff, 4, 30, Math.PI / 6, 0.8, 1.5);
heroSpotLight.position.set(0, 3, 8);
heroSpotLight.target.position.set(0, 0, 0);
heroSpotLight.target.updateMatrixWorld();
scene.add(heroSpotLight);
scene.add(heroSpotLight.target);

// ==========================================
// GEOMETRIC OBJECTS (THE MAIN CHARACTER)
// ==========================================
const objectsGroup = new THREE.Group();
scene.add(objectsGroup);

let time = 0;

// Object A: Icosahedron (Chaos)
const chaosGeometry = new THREE.IcosahedronGeometry(1.5, 0);
const chaosMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x333333,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1.0
});
const chaosMesh = new THREE.Mesh(chaosGeometry, chaosMaterial);
chaosMesh.scale.set(1.0, 1.0, 1.0);
objectsGroup.add(chaosMesh);

// Object B: Sphere – Pure silver/white, minimal bloom
const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
const materialB = new THREE.MeshPhysicalMaterial({
    color: 0xc8c8c8,
    roughness: 0.5,
    metalness: 0.95,
    transmission: 0,
    iridescence: 0,
    emissive: 0x222222,
    emissiveIntensity: 0.05
});
const sphereMesh = new THREE.Mesh(sphereGeometry, materialB);
sphereMesh.scale.set(0.0, 0.0, 0.0);
objectsGroup.add(sphereMesh);

// Store base scale for breathing animation (managed by scroll)
let sphereBaseScale = 0.0;

// Object C: TorusKnot (Future)
const torusGeometry = new THREE.TorusKnotGeometry(1.2, 0.4, 100, 16);
const chromeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 2.0
});
const torusMesh = new THREE.Mesh(torusGeometry, chromeMaterial);
torusMesh.scale.set(0.0, 0.0, 0.0);
objectsGroup.add(torusMesh);

// ==========================================
// PARTICLES – Pure silver/white stars/dust (minimal bloom)
// ==========================================
const particleCount = 3200;
const particlePositions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 40;
    particlePositions[i + 1] = (Math.random() - 0.5) * 40;
    particlePositions[i + 2] = (Math.random() - 0.5) * 40;
}
const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particlesMaterial = new THREE.PointsMaterial({
    color: 0xdddddd,
    size: 0.028,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// ==========================================
// POST-PROCESSING (BLOOM EFFECT)
// ==========================================
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35, // Strength – subtle, no neon bloom
    0.2,  // Radius – tighter
    0.45  // Threshold – only bright/silver elements glow slightly
);
composer.addPass(bloomPass);

// ==========================================
// MOUSE PARALLAX INTERACTION
// ==========================================
let mouseX = 0;
let mouseY = 0;
let targetRotationX = 0;
let targetRotationY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    
    // Map mouse position to rotation (subtle parallax effect)
    targetRotationY = mouseX * 0.3; // Left/Right
    targetRotationX = mouseY * 0.2; // Up/Down
});

// ==========================================
// SCROLL HINT (Interactive "Scroll Down" prompt)
// ==========================================
const scrollHint = document.getElementById('scroll-hint');
const signalsSection = document.querySelector('[data-section="signals"]');

function setScrollHintVisible(visible) {
    if (!scrollHint) return;
    scrollHint.classList.toggle('is-hidden', !visible);
    scrollHint.setAttribute('aria-hidden', String(!visible));
    scrollHint.setAttribute('tabindex', visible ? '0' : '-1');
}

if (scrollHint) {
    // Initial state: visible at the top
    setScrollHintVisible(true);

    scrollHint.addEventListener('click', () => {
        // Scroll to next section using Lenis for smoothness
        if (signalsSection) {
            lenis.scrollTo(signalsSection);
        } else {
            lenis.scrollTo(window.innerHeight);
        }
        setScrollHintVisible(false);
    });
}

// ==========================================
// SCROLL TRIGGER - OBJECT MORPHING & POSITIONING
// ==========================================
let scrollProgress = 0;

lenis.on('scroll', ({ scroll, limit, velocity }) => {
    // Calculate scroll progress (0 to 1)
    scrollProgress = limit ? (scroll / limit) : 0;

    // Hide hint after user starts scrolling; show again when back at top
    if (scrollHint) {
        setScrollHintVisible(scroll <= 10);
    }
    
    // Section 1 (Hero - 0 to 0.33): Chaos object, center position
    // Section 2 (0.33 to 0.67): Glass Sphere, move right
    // Section 3 (0.67 to 1.0): Torus, move left
    
    let objectsGroupX = 0;
    let ambientIntensity = 0.5;
    let pointLightIntensity = 0;
    let keyLight1Intensity = 0.4;
    let keyLight2Intensity = 0.4;
    let heroSpotLightIntensity = 0;
    
    // Section 1 -> 2: Chaos to Glass Sphere (earlier transition to match content cards)
    if (scrollProgress < 0.28) {
        const t = scrollProgress * 3.57; // Map 0-0.28 to 0-1 (faster transition, earlier start)
        const chaosScale = 1.0 - t;
        sphereBaseScale = t; // Store base scale for breathing animation
        
        chaosMesh.scale.set(chaosScale, chaosScale, chaosScale);
        // Don't set sphereMesh.scale here - let breathing animation handle it
        torusMesh.scale.set(0, 0, 0);
        
        // Position: center (0) -> right (3) as we transition to sphere
        objectsGroupX = t * 3;
        
        // Brightness: hero brighter, sphere section neutral silver
        if (t < 0.33) {
            const heroBrightness = 1.0 - t * 3;
            ambientIntensity = 0.5 + heroBrightness * 1.2;
            pointLightIntensity = heroBrightness * 2.5;
            keyLight1Intensity = 0.3 + heroBrightness * 0.2;
            keyLight2Intensity = 0.3 + heroBrightness * 0.2;
            heroSpotLightIntensity = heroBrightness * 4;
        } else {
            ambientIntensity = 0.35;
            pointLightIntensity = 0;
            keyLight1Intensity = 0.5;
            keyLight2Intensity = 0.5;
            heroSpotLightIntensity = 0;
        }
    } 
    // Section 2 -> 3: Glass Sphere to Torus (earlier transition to match content cards)
    else {
        const t = Math.min(1, (scrollProgress - 0.28) / 0.36); // Map 0.28-0.64 to 0-1 (aligned with section positions)
        sphereBaseScale = 1.0 - t; // Store base scale for breathing animation
        const torusScale = t;
        
        chaosMesh.scale.set(0, 0, 0);
        // Don't set sphereMesh.scale here - let breathing animation handle it
        torusMesh.scale.set(torusScale, torusScale, torusScale);
        
        // Position: right (3) -> left (-3) as we transition to torus
        objectsGroupX = 3 - t * 6; // 3 -> -3
        
        // Brightness: normal in middle, brighter at end
        if (t > 0.67) {
            // Last section - brighter
            const endProgress = (t - 0.67) / 0.33; // Map 0.67-1.0 to 0-1
            ambientIntensity = 0.5 + endProgress * 0.5; // 0.5 -> 1.0
            pointLightIntensity = endProgress * 2; // 0 -> 2.0
        } else {
            ambientIntensity = 0.5;
            pointLightIntensity = 0;
        }
        
        // Rotate torus rapidly then settle (calculation effect)
        if (t > 0.5) {
            const rapidRotation = (t - 0.5) * 2 * Math.PI * 5;
            torusMesh.rotation.z = rapidRotation * (1 - t);
        }
    }
    
    // Apply position
    objectsGroup.position.x = objectsGroupX;
    
    // Update lighting brightness
    ambientLight.intensity = ambientIntensity;
    EnlightmentLight.intensity = pointLightIntensity;
    keyLight1.intensity = keyLight1Intensity;
    keyLight2.intensity = keyLight2Intensity;
    heroSpotLight.intensity = heroSpotLightIntensity;
});

// Refresh ScrollTrigger when content is loaded
window.addEventListener('load', () => {
    ScrollTrigger.refresh();
});

setTimeout(() => {
    ScrollTrigger.refresh();
}, 100);

// ==========================================
// TEXT ANIMATION (Decoding Effect)
// ==========================================
const heroTitle = document.getElementById('hero-title');
const heroSubtitle = document.querySelector('.hero-subtitle');

// Split text into characters (italicize "MOOD" for editorial look)
function splitText(element) {
    const text = element.textContent;
    element.innerHTML = '';
    const italicEnd = text.indexOf(' ') >= 0 ? text.indexOf(' ') : 4; // "MOOD " -> first 4 chars italic
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const spanClass = char === ' ' ? 'char' : (i < italicEnd ? 'char italic' : 'char');
        if (char === ' ') {
            element.innerHTML += '<span class="char">&nbsp;</span>';
        } else {
            element.innerHTML += `<span class="${spanClass}">${char}</span>`;
        }
    }
}

if (heroTitle) {
    splitText(heroTitle);
    const chars = heroTitle.querySelectorAll('.char');
    gsap.set(chars, { opacity: 0 });
    heroTitle.classList.add('is-split');

    // Decoding animation
    chars.forEach((char, index) => {
        gsap.fromTo(char,
            {
                opacity: 0,
                y: 50,
                rotationX: -90
            },
            {
                opacity: 1,
                y: 0,
                rotationX: 0,
                duration: 0.5,
                delay: index * 0.03,
                ease: 'power3.out'
            }
        );
    });
}

// Hero subtitle animation
if (heroSubtitle) {
    gsap.fromTo(heroSubtitle,
        {
            opacity: 0,
            y: 30
        },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            delay: 0.8,
            ease: 'power3.out'
        }
    );
}

// ==========================================
// HERO CTA: Session check and button behavior
// ==========================================
(async function initHeroCta() {
    const heroCta = document.getElementById('hero-cta');
    const textEl = heroCta?.querySelector('.hero-cta__text');
    if (!heroCta || !textEl) return;

    let hasSession = false;
    try {
        const supabase = window.supabaseClient;
        if (supabase?.auth) {
            const { data: { session } } = await supabase.auth.getSession();
            hasSession = !!session;
        }
    } catch (_) {}

    if (hasSession) {
        textEl.textContent = 'Resume Session';
        heroCta.setAttribute('aria-label', 'Resume your session');
        heroCta.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.location.href = 'dashboard.html';
        }, true);
    } else {
        textEl.textContent = 'Initialize System';
        heroCta.setAttribute('aria-label', 'Initialize system');
    }
})();

// ==========================================
// MAGNETIC BUTTON EFFECT
// ==========================================
const magneticBtn = document.getElementById('start-btn');
let targetBtnX = 0;
let targetBtnY = 0;
let currentBtnX = 0;
let currentBtnY = 0;

let rafId = null;
if (magneticBtn) {
    function updateMagneticButton() {
        currentBtnX += (targetBtnX - currentBtnX) * 0.1;
        currentBtnY += (targetBtnY - currentBtnY) * 0.1;

        gsap.set(magneticBtn, {
            x: currentBtnX * 0.3,
            y: currentBtnY * 0.3
        });

        if (Math.abs(targetBtnX) > 0.1 || Math.abs(targetBtnY) > 0.1) {
            rafId = requestAnimationFrame(updateMagneticButton);
        }
    }

    magneticBtn.addEventListener('mousemove', (e) => {
        const rect = magneticBtn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        targetBtnX = e.clientX - centerX;
        targetBtnY = e.clientY - centerY;

        if (!rafId) {
            rafId = requestAnimationFrame(updateMagneticButton);
        }
    });

    magneticBtn.addEventListener('mouseleave', () => {
        targetBtnX = 0;
        targetBtnY = 0;

        gsap.to(magneticBtn, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: 'power2.out'
        });

        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        currentBtnX = 0;
        currentBtnY = 0;
    });
}

// ==========================================
// CUSTOM CURSOR
// ==========================================
const cursor = document.createElement('div');
cursor.className = 'custom-cursor';
document.body.appendChild(cursor);

document.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.3,
        ease: 'power2.out'
    });
});

// Cursor hover effect on interactive elements
const interactiveElements = document.querySelectorAll('button, a, .goal-item');
interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
});

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.01;
    const elapsedTime = time;
    
    // Orbiting key lights – subtle silver movement
    keyLight1.position.x = Math.sin(elapsedTime * 0.5) * 8;
    keyLight1.position.z = Math.cos(elapsedTime * 0.5) * 8;
    keyLight1.position.y = 2 + Math.sin(elapsedTime * 0.3) * 1.5;

    keyLight2.position.x = Math.cos(elapsedTime * 0.5) * 8;
    keyLight2.position.z = -Math.sin(elapsedTime * 0.5) * 8;
    keyLight2.position.y = 2 + Math.cos(elapsedTime * 0.3) * 1.5;
    
    // Keep spotlight target pointing at object center (moves with objectsGroup)
    heroSpotLight.target.position.set(objectsGroup.position.x, 0, 0);
    heroSpotLight.target.updateMatrixWorld();
    
    // Continuous rotation on all objects
    chaosMesh.rotation.x += 0.005;
    chaosMesh.rotation.y += 0.005;
    
    sphereMesh.rotation.x += 0.005;
    sphereMesh.rotation.y += 0.005;
    
    torusMesh.rotation.x += 0.005;
    torusMesh.rotation.y += 0.008;
    
    // Breathing animation for Object B (Sphere) - "Siri Orb" effect
    if (sphereBaseScale > 0.01) {
        // Sphere is visible - apply breathing/wobble effect
        const breathingScale = 1.0 + Math.sin(elapsedTime * 3.0) * 0.05;
        const finalScale = sphereBaseScale * breathingScale;
        sphereMesh.scale.set(finalScale, finalScale, finalScale);
    } else {
        sphereMesh.scale.set(0, 0, 0);
    }
    
    // Mouse parallax - smooth rotation interpolation
    objectsGroup.rotation.y += (targetRotationY - objectsGroup.rotation.y) * 0.05;
    objectsGroup.rotation.x += (targetRotationX - objectsGroup.rotation.x) * 0.05;
    
    // Render with post-processing
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
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});

// ==========================================
// SECTION ANIMATIONS ON SCROLL
// ==========================================
gsap.utils.toArray('.section').forEach((section, index) => {
    if (index === 0) return; // Skip hero section
    
    gsap.fromTo(section.querySelector('.glass-card'),
        {
            opacity: 0,
            y: 100
        },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse',
                scroller: window
            }
        }
    );
});
