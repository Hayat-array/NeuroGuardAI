/* ===== NeuroGuard — script.js ===== */

// ── Theme Toggle ────────────────────────────────────────────────────────────
(function applyStoredTheme() {
    const saved = localStorage.getItem("ng-theme") || "light";
    if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");
})();

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";

    html.setAttribute("data-theme", next);
    localStorage.setItem("ng-theme", next);

    const thumb = document.getElementById("toggle-thumb");
    const label = document.getElementById("toggle-label");
    if (thumb) thumb.textContent = next === "dark" ? "🌙" : "☀️";
    if (label) label.textContent = next === "dark" ? "Dark" : "Light";
}

// Apply correct icon on page load
(function syncToggleIcon() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const thumb = document.getElementById("toggle-thumb");
    const label = document.getElementById("toggle-label");
    if (thumb) thumb.textContent = isDark ? "🌙" : "☀️";
    if (label) label.textContent = isDark ? "Dark" : "Light";
})();

// ── Socket.IO ──────────────────────────────────────────────────────────────
const socket = io();

// ── State ──────────────────────────────────────────────────────────────────
let isStreaming = false;
let trainingPollHandle = null;
let currentPatient = null;
let seizureAlertTimer = null;
let lastAnalysisResult = null;   // stores latest EEG analysis to embed in patient report
let supabaseClient = null;

async function authorizationHeaders(headers = {}) {
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function initializeAuthentication() {
    const status = document.getElementById("auth-status");
    try {
        const response = await fetch("/api/auth/config");
        const config = await response.json();
        if (!response.ok || !window.supabase?.createClient) throw new Error("Authentication service is not configured.");
        supabaseClient = window.supabase.createClient(config.url, config.key);
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            document.getElementById("auth-form").classList.toggle("hidden", Boolean(session));
            document.getElementById("sign-out-btn").classList.toggle("hidden", !session);
            status.textContent = session ? `Signed in as ${session.user.email}` : "Sign in to view or save patient profiles.";
            if (session) loadPatientDetails();
            else clearPatientForm();
        });
    } catch (error) {
        status.textContent = error.message;
    }
}

document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("auth-status");
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: document.getElementById("auth-email").value.trim(),
        password: document.getElementById("auth-password").value,
    });
    if (error) status.textContent = "Invalid email or password. Check your details and try again.";
});

document.getElementById("sign-up-btn").addEventListener("click", async () => {
    const status = document.getElementById("auth-status");
    const { data, error } = await supabaseClient.auth.signUp({
        email: document.getElementById("auth-email").value.trim(),
        password: document.getElementById("auth-password").value,
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) status.textContent = error.message;
    else if (!data.session) status.textContent = "Check your email to confirm your account, then sign in.";
});

document.getElementById("sign-out-btn").addEventListener("click", async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
});

const MAX_POINTS = 200;
const eegData = new Array(MAX_POINTS).fill(0);

// ── EEG Chart ─────────────────────────────────────────────────────────────
const chartCtx = document.getElementById("eegChart").getContext("2d");
const chart = new Chart(chartCtx, {
    type: "line",
    data: {
        labels: Array.from({ length: MAX_POINTS }, (_, i) => i),
        datasets: [{
            label: "EEG",
            data: eegData,
            borderColor: "#22d3ee",
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.3,
            fill: {
                target: "origin",
                above: "rgba(34, 211, 238, 0.06)"
            }
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            x: { display: false },
            y: {
                display: true,
                grid: { color: "rgba(100,160,230,0.1)" },
                ticks: { color: "#6a9bbf", font: { family: "Inter", size: 10 } }
            }
        },
        plugins: { legend: { display: false } }
    }
});

function chartRenderLoop() {
    if (isStreaming) chart.update("none");
    requestAnimationFrame(chartRenderLoop);
}
chartRenderLoop();

// ── Background Floating Particles ──────────────────────────────────────────
function initBgParticles() {
    const container = document.getElementById("bg-particles");
    const count = 28;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement("div");
        const size = Math.random() * 3 + 1;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const dur = (Math.random() * 12 + 8).toFixed(1);
        const delay = (Math.random() * 8).toFixed(1);
        Object.assign(dot.style, {
            position: "absolute",
            width: `${size}px`, height: `${size}px`,
            borderRadius: "50%",
            left: `${x}%`, top: `${y}%`,
            background: i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#0ea5e9" : "#a855f7",
            opacity: (Math.random() * 0.25 + 0.06).toFixed(2),
            boxShadow: `0 0 ${size * 4}px currentColor`,
            animation: `floatDot ${dur}s ${delay}s ease-in-out infinite alternate`
        });
        container.appendChild(dot);
    }

    const style = document.createElement("style");
    style.textContent = `
        @keyframes floatDot {
            0%   { transform: translateY(0px)   translateX(0px); }
            100% { transform: translateY(-40px) translateX(20px); }
        }
    `;
    document.head.appendChild(style);
}
initBgParticles();

// ── Three.js Particle Brain ────────────────────────────────────────────────
const brainContainer = document.getElementById("brain-container");
let scene, camera, renderer, particles, particleGeo, particleMat;
let brainGroup, mouseX = 0, mouseY = 0;
let currentProbability = 0;

function initThreeJS() {
    scene = new THREE.Scene();

    // Use 1:1 fallback if container has no size yet (will be fixed by ResizeObserver)
    const W = brainContainer.clientWidth || 400;
    const H = brainContainer.clientHeight || 400;

    camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 4;   // closer = sphere appears larger

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    brainContainer.appendChild(renderer.domElement);

    // Resize renderer whenever container size changes
    new ResizeObserver(() => {
        const w = brainContainer.clientWidth;
        const h = brainContainer.clientHeight;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    }).observe(brainContainer);

    brainGroup = new THREE.Group();
    scene.add(brainGroup);

    // ── Circular point texture ──────────────────────────────────────────────
    const ptCanvas = document.createElement("canvas");
    ptCanvas.width = 64;
    ptCanvas.height = 64;
    const ptCtx = ptCanvas.getContext("2d");
    const grad = ptCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
    ptCtx.fillStyle = grad;
    ptCtx.fillRect(0, 0, 64, 64);
    const ptTexture = new THREE.CanvasTexture(ptCanvas);

    // 1) Particle sphere — Fibonacci / golden-angle for perfectly even distribution
    const PARTICLE_COUNT = 800;
    particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));   // ≈ 2.399 rad
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2; // evenly space y from +1 to -1
        const rxy = Math.sqrt(Math.max(0, 1 - y * y));   // radius at height y
        const phi = goldenAngle * i;                       // golden-angle spiral
        const r = 2.0 + (Math.random() - 0.5) * 0.12;  // larger radius

        positions[i * 3] = r * rxy * Math.cos(phi);
        positions[i * 3 + 1] = r * y;
        positions[i * 3 + 2] = r * rxy * Math.sin(phi);
        randoms[i] = Math.random();
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    particleMat = new THREE.PointsMaterial({
        size: 0.07,
        map: ptTexture,
        color: new THREE.Color("#f97316"),
        transparent: true,
        opacity: 0.92,
        alphaTest: 0.01,
        depthWrite: false,
        sizeAttenuation: true
    });
    particles = new THREE.Points(particleGeo, particleMat);
    brainGroup.add(particles);

    // 2) Wireframe core — scaled to new sphere radius
    const coreGeo = new THREE.IcosahedronGeometry(1.88, 2);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xf97316, wireframe: true, transparent: true, opacity: 0.22
    });
    brainGroup.add(new THREE.Mesh(coreGeo, coreMat));

    // Outer ring wireframe
    const outerGeo = new THREE.IcosahedronGeometry(2.05, 1);
    const outerMat = new THREE.MeshBasicMaterial({
        color: 0xfb923c, wireframe: true, transparent: true, opacity: 0.14
    });
    brainGroup.add(new THREE.Mesh(outerGeo, outerMat));

    // 3) Inner glow sphere
    const glowGeo = new THREE.SphereGeometry(1.0, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0x1e1b4b, transparent: true, opacity: 0.22
    });
    brainGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // 4) Connection lines — shorter reach matching new sphere size
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts = [];
    const pos = particleGeo.attributes.position;
    for (let i = 0; i < 80; i++) {
        const a = Math.floor(Math.random() * PARTICLE_COUNT);
        const b = Math.floor(Math.random() * PARTICLE_COUNT);
        lineVerts.push(pos.getX(a), pos.getY(a), pos.getZ(a));
        lineVerts.push(pos.getX(b), pos.getY(b), pos.getZ(b));
    }
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.28 });
    brainGroup.add(new THREE.LineSegments(lineGeo, lineMat));

    // Mouse interaction
    document.addEventListener("mousemove", e => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    animateBrain();
}

function animateBrain() {
    requestAnimationFrame(animateBrain);

    const t = Date.now() * 0.001;

    // Oscillate particle vertices
    const pos = particleGeo.attributes.position;
    const rand = particleGeo.attributes.aRandom;
    for (let i = 0; i < pos.count; i++) {
        const r = rand.getX(i);
        const wave = Math.sin(t * (0.6 + r * 0.8) + i * 0.02) * 0.04;
        const scale = 1 + wave * (0.5 + currentProbability);
        const ox = pos.getX(i) / (Math.abs(pos.getX(i)) > 0.01 ? pos.getX(i) / pos.getX(i) * Math.abs(pos.getX(i)) : 1);
        // Simple radial pulse
        pos.setXYZ(i,
            pos.getX(i) * (1 + wave * 0.05),
            pos.getY(i) * (1 + wave * 0.05),
            pos.getZ(i) * (1 + wave * 0.05)
        );
    }
    pos.needsUpdate = true;

    // Color shift based on probability: orange (0) → yellow-orange (0.5) → red (1)
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
        // Dark mode: warm orange→red as danger rises
        const h = 0.07 - currentProbability * 0.07;  // 0.07 (orange) → 0 (red)
        particleMat.color.setHSL(h, 1.0, 0.55 + currentProbability * 0.1);
    } else {
        // Light mode: cyan → yellow → red
        const h = 0.55 - currentProbability * 0.55;
        particleMat.color.setHSL(h, 0.9, 0.55);
    }
    particleMat.size = 0.040 + currentProbability * 0.030;
    particleMat.opacity = 0.85 + currentProbability * 0.12;

    // Rotation + mouse lean
    brainGroup.rotation.y += 0.004 + currentProbability * 0.008;
    brainGroup.rotation.x += 0.0015;
    brainGroup.rotation.y += (mouseX * 0.3 - brainGroup.rotation.y) * 0.02;
    brainGroup.rotation.x += (mouseY * -0.15 - brainGroup.rotation.x) * 0.02;

    renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
    if (!camera || !renderer) return;
    camera.aspect = brainContainer.clientWidth / brainContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(brainContainer.clientWidth, brainContainer.clientHeight);
});

// ── SVG Gauge ─────────────────────────────────────────────────────────────
const GAUGE_TOTAL = 251; // arc length of the gauge path

function updateGauge(prob) {
    const fill = document.getElementById("gauge-fill");
    const dot = document.getElementById("gauge-dot");
    if (!fill || !dot) return;

    const offset = GAUGE_TOTAL * (1 - Math.max(0, Math.min(1, prob)));
    fill.style.strokeDashoffset = offset;

    // Animate dot position along arc
    const angle = Math.PI + prob * Math.PI; // 180° to 360°
    const cx = 100 + 80 * Math.cos(angle);
    const cy = 110 + 80 * Math.sin(angle);
    dot.setAttribute("cx", cx.toFixed(1));
    dot.setAttribute("cy", cy.toFixed(1));

    // Dot color
    const dotColor = prob >= 0.75 ? "#f43f5e" : prob >= 0.45 ? "#f59e0b" : "#22d3ee";
    dot.setAttribute("fill", dotColor);
    dot.style.filter = `drop-shadow(0 0 8px ${dotColor})`;
}

// ── Seizure Alert ─────────────────────────────────────────────────────────
function triggerSeizureAlert(on) {
    const overlay = document.getElementById("seizure-overlay");
    if (!overlay) return;
    if (on) {
        overlay.classList.remove("hidden");
        clearTimeout(seizureAlertTimer);
        seizureAlertTimer = setTimeout(() => overlay.classList.add("hidden"), 4000);
    } else {
        overlay.classList.add("hidden");
    }
}

// ── Prediction Update ─────────────────────────────────────────────────────
function setPrediction(probability) {
    const prob = Math.max(0, Math.min(1, Number(probability) || 0));
    const percent = (prob * 100).toFixed(1);
    currentProbability = prob;

    const valueEl = document.getElementById("prediction-value");
    const barEl = document.getElementById("prediction-bar");
    const levelEl = document.getElementById("risk-label");

    // Animate value
    animateCounter(valueEl, parseFloat(valueEl.innerText || "0"), parseFloat(percent), 400,
        v => `${v.toFixed(1)}%`);

    barEl.style.width = `${percent}%`;
    updateGauge(prob);

    if (prob >= 0.75) {
        valueEl.style.color = "#f43f5e";
        valueEl.style.textShadow = "0 0 30px rgba(244,63,94,0.6)";
        levelEl.innerText = "⚠ High Risk";
        levelEl.className = "risk-badge risk-high";
        triggerSeizureAlert(true);
    } else if (prob >= 0.45) {
        valueEl.style.color = "#f59e0b";
        valueEl.style.textShadow = "0 0 24px rgba(245,158,11,0.5)";
        levelEl.innerText = "Moderate Risk";
        levelEl.className = "risk-badge risk-mid";
        triggerSeizureAlert(false);
    } else {
        valueEl.style.color = "#10b981";
        valueEl.style.textShadow = "0 0 24px rgba(16,185,129,0.4)";
        levelEl.innerText = "Low Risk";
        levelEl.className = "risk-badge risk-low";
        triggerSeizureAlert(false);
    }
}

function animateCounter(el, from, to, duration, formatter) {
    const start = performance.now();
    function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const val = from + (to - from) * t;
        el.innerText = formatter(val);
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── Status Indicator ──────────────────────────────────────────────────────
function renderConnectionState(online) {
    const dot = document.getElementById("status-indicator");
    const text = document.getElementById("status-text");
    text.innerText = online ? "ONLINE" : "OFFLINE";
    text.style.color = online ? "#34d399" : "#94a3b8";
    dot.className = `status-dot ${online ? "online" : "offline"}`;
}

// ── Patient ───────────────────────────────────────────────────────────────
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
}

function renderPatientHeader(patient) {
    const el = document.getElementById("active-patient");
    if (!patient?.name) { el.innerHTML = '<span class="pill-dot"></span>Patient: Not Selected'; return; }
    const pid = patient.patient_id ? ` (${escapeHtml(patient.patient_id)})` : "";
    el.innerHTML = `<span class="pill-dot"></span>Patient: ${escapeHtml(patient.name)}${pid}`;
}

function setPatientForm(p) {
    if (!p) return;
    document.getElementById("patient-name").value = p.name || "";
    document.getElementById("patient-id").value = p.patient_id || "";
    document.getElementById("patient-age").value = p.age || "";
    document.getElementById("patient-sex").value = p.sex || "";
    document.getElementById("patient-dob").value = p.dob || "";
    document.getElementById("patient-phone").value = p.phone || "";
    document.getElementById("patient-email").value = p.email || "";
    document.getElementById("patient-blood-group").value = p.blood_group || "";
    document.getElementById("patient-emergency-contact").value = p.emergency_contact || "";
    document.getElementById("patient-allergies").value = p.allergies || "";
    document.getElementById("patient-medications").value = p.medications || "";
    document.getElementById("patient-history-notes").value = p.history_notes || "";
}

function getPatientFormPayload() {
    return {
        name: document.getElementById("patient-name").value.trim(),
        patient_id: document.getElementById("patient-id").value.trim(),
        age: document.getElementById("patient-age").value.trim(),
        sex: document.getElementById("patient-sex").value,
        dob: document.getElementById("patient-dob").value,
        phone: document.getElementById("patient-phone").value.trim(),
        email: document.getElementById("patient-email").value.trim(),
        blood_group: document.getElementById("patient-blood-group").value.trim(),
        emergency_contact: document.getElementById("patient-emergency-contact").value.trim(),
        allergies: document.getElementById("patient-allergies").value.trim(),
        medications: document.getElementById("patient-medications").value.trim(),
        history_notes: document.getElementById("patient-history-notes").value.trim()
    };
}

function renderPatientReport(patient) {
    const el = document.getElementById("patient-overview");
    if (!patient?.name) {
        el.innerHTML = `<p style="opacity:0.5;font-size:0.82rem;">No active patient record yet.</p>`;
        return;
    }
    const age = escapeHtml(patient.age || "—");
    const sex = escapeHtml(patient.sex || "—");
    const dob = escapeHtml(patient.dob || "—");
    const pid = escapeHtml(patient.patient_id || "—");
    const now = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

    // ── EEG analysis section (only shown when analysis has been run) ──────────
    let eegSection = "";
    if (lastAnalysisResult) {
        const ar = lastAnalysisResult;
        const probPct = (ar.max_probability * 100).toFixed(1);
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const detected = ar.seizure_detected;
        const riskLabel = detected ? "⚠️ SEIZURE DETECTED" : "✅ NO SEIZURE";
        const riskBg = detected
            ? (isDark ? "rgba(190,24,93,0.22)" : "rgba(254,205,211,0.7)")
            : (isDark ? "rgba(5,150,105,0.18)" : "rgba(209,250,229,0.8)");
        const riskBdr = detected
            ? (isDark ? "rgba(244,63,94,0.55)" : "rgba(225,29,72,0.45)")
            : (isDark ? "rgba(52,211,153,0.45)" : "rgba(16,185,129,0.45)");
        const riskClr = detected
            ? (isDark ? "#fda4af" : "#be123c")
            : (isDark ? "#6ee7b7" : "#065f46");
        const probBarClr = detected ? "#f43f5e" : "#10b981";
        const segText = `${ar.seizure_segments_count} / ${ar.total_segments}`;

        eegSection = `
        <div class="report-eeg-section">
          <div class="report-section-title">EEG Epilepsy Analysis Report</div>
          <div class="eeg-verdict" style="background:${riskBg};border:1px solid ${riskBdr};color:${riskClr};">
            ${riskLabel}
          </div>
          <div class="eeg-stats-grid">
            <div class="eeg-stat">
              <span class="eeg-stat-label">Max Probability</span>
              <span class="eeg-stat-val" style="color:${probBarClr};font-size:1.35rem;font-weight:800;">${probPct}%</span>
              <div class="eeg-prob-bar-bg">
                <div class="eeg-prob-bar-fill" style="width:${probPct}%;background:${probBarClr};"></div>
              </div>
            </div>
            <div class="eeg-stat">
              <span class="eeg-stat-label">Seizure Segments</span>
              <span class="eeg-stat-val">${segText}</span>
            </div>
            <div class="eeg-stat span2">
              <span class="eeg-stat-label">Analysis Time</span>
              <span class="eeg-stat-val">${ar.timestamp}</span>
            </div>
          </div>
        </div>`;
    }

    // ── EEG waveform snapshot ──────────────────────────────────────────────────
    let eegChartSnapshot = "";
    try {
        const chartCanvas = document.getElementById("eegChart");
        if (chartCanvas && chart) {
            const dataUrl = chartCanvas.toDataURL("image/png");
            eegChartSnapshot = `
        <div class="report-eeg-section">
          <div class="report-section-title">Live EEG Waveform Snapshot</div>
          <img src="${dataUrl}" alt="EEG Snapshot"
               style="width:100%;border-radius:8px;border:1px solid rgba(99,102,241,0.15);
                      margin-top:0.3rem;display:block;" />
        </div>`;
        }
    } catch (e) { /* skip if canvas unavailable */ }

    el.innerHTML = `
      <div class="patient-report-card">
        <div class="report-header">
          <div class="report-avatar">${escapeHtml(patient.name.charAt(0).toUpperCase())}</div>
          <div>
            <div class="report-name">${escapeHtml(patient.name)}</div>
            <div class="report-meta">ID: ${pid} &nbsp;|&nbsp; Saved: ${now}</div>
          </div>
        </div>
        <div class="report-grid">
          <div class="report-item"><span class="ri-label">Age</span><span class="ri-val">${age}</span></div>
          <div class="report-item"><span class="ri-label">Sex</span><span class="ri-val">${sex}</span></div>
          <div class="report-item"><span class="ri-label">DOB</span><span class="ri-val">${dob}</span></div>
          <div class="report-item"><span class="ri-label">Blood</span><span class="ri-val">${escapeHtml(patient.blood_group || '—')}</span></div>
          <div class="report-item"><span class="ri-label">Phone</span><span class="ri-val">${escapeHtml(patient.phone || '—')}</span></div>
          <div class="report-item"><span class="ri-label">Email</span><span class="ri-val">${escapeHtml(patient.email || '—')}</span></div>
          <div class="report-item span2"><span class="ri-label">Emergency</span><span class="ri-val">${escapeHtml(patient.emergency_contact || '—')}</span></div>
          <div class="report-item span2"><span class="ri-label">Allergies</span><span class="ri-val">${escapeHtml(patient.allergies || 'None listed')}</span></div>
          <div class="report-item span2"><span class="ri-label">Medications</span><span class="ri-val">${escapeHtml(patient.medications || 'None listed')}</span></div>
          ${patient.history_notes ? `<div class="report-item span2"><span class="ri-label">Notes</span><span class="ri-val">${escapeHtml(patient.history_notes)}</span></div>` : ''}
        </div>
        ${eegChartSnapshot}
        ${eegSection}
      </div>`;
}

// loadPatientDetails: load server state into JS only (do NOT fill form — fresh each session)
async function loadPatientDetails() {
    try {
        const r = await fetch("/api/patient/current", { headers: await authorizationHeaders() });
        const d = await r.json();
        if (d?.patient) {
            currentPatient = d.patient;
            renderPatientHeader(currentPatient);  // update header pill only
            // Do NOT call setPatientForm() — keep the form blank for new session
        }
    } catch { }
}

async function savePatientDetails() {
    const payload = getPatientFormPayload();
    const statusEl = document.getElementById("patient-save-status");
    if (!payload.name) { alert("Please enter patient name."); return; }

    statusEl.innerText = "Saving…";
    try {
        const r = await fetch("/api/patient/save", {
            method: "POST",
            headers: await authorizationHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d?.error || "Failed to save patient.");
        currentPatient = d.patient;
        renderPatientHeader(currentPatient);
        renderPatientReport(currentPatient);
        statusEl.innerText = "✓ Saved";
        statusEl.style.color = "#34d399";
        // Scroll report into view
        document.getElementById("patient-overview").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
        statusEl.innerText = "Save Failed";
        statusEl.style.color = "#f43f5e";
        alert(`Save failed: ${err.message}`);
    }
}

function clearPatientForm() {
    setPatientForm({}); // blank all fields
    currentPatient = null;
    lastAnalysisResult = null;
    document.getElementById("active-patient").innerHTML = `<span class="pill-dot"></span>Patient: Not Selected`;
    document.getElementById("patient-overview").innerHTML = `<p style="opacity:0.5;font-size:0.82rem;">No active patient record yet.</p>`;
    const statusEl = document.getElementById("patient-save-status");
    statusEl.innerText = "Ready";
    statusEl.style.color = "";
}

// ── Socket Events ─────────────────────────────────────────────────────────
socket.on("connect", () => renderConnectionState(true));
socket.on("disconnect", () => renderConnectionState(false));

socket.on("eeg_data", msg => {
    const chunk = msg.data || [];
    eegData.splice(0, chunk.length);
    eegData.push(...chunk);
    chart.data.datasets[0].data = eegData;
});

socket.on("prediction", msg => setPrediction(msg.probability));

// ── Stream Controls ───────────────────────────────────────────────────────
function startStream() {
    fetch("/api/start_stream", { method: "POST" });
    isStreaming = true;
    const lbl = document.getElementById("stream-state");
    lbl.innerHTML = 'Live Stream: <em>Running</em>';
}

function stopStream() {
    fetch("/api/stop_stream", { method: "POST" });
    isStreaming = false;
    const lbl = document.getElementById("stream-state");
    lbl.innerHTML = 'Live Stream: <em>Stopped</em>';
}

// ── Training ──────────────────────────────────────────────────────────────
function renderTrainingState(state) {
    const badge = document.getElementById("train-status-badge");
    const text = document.getElementById("train-status-text");
    const btn = document.getElementById("train-start-btn");
    const metrics = document.getElementById("train-metrics");
    if (!badge || !text || !btn || !metrics) return;

    const status = state?.status || "idle";
    const running = !!state?.running;
    const message = state?.message || "Not started";

    badge.innerText = status.toUpperCase();

    if (running) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Training…';
        btn.style.opacity = "0.72";
        text.innerHTML = `<span style="color:#22d3ee;">${message}</span>`;
    } else {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">⚡</span> Start Training';
        btn.style.opacity = "1";
        text.innerText = message;
    }

    if (state?.metrics) {
        const m = state.metrics;
        metrics.classList.remove("hidden");
        metrics.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;">
                <div>🎯 Accuracy <strong style="color:#67e8f9">${(Number(m.accuracy || 0) * 100).toFixed(2)}%</strong></div>
                <div>📈 AUC <strong style="color:#c4b5fd">${Number(m.auc || 0).toFixed(4)}</strong></div>
                <div>✅ Sensitivity <strong style="color:#6ee7b7">${(Number(m.sensitivity || 0) * 100).toFixed(2)}%</strong></div>
                <div>🛡 Specificity <strong style="color:#6ee7b7">${(Number(m.specificity || 0) * 100).toFixed(2)}%</strong></div>
            </div>`;
    } else {
        metrics.classList.add("hidden");
        metrics.innerHTML = "";
    }
}

async function fetchTrainingStatus() {
    try {
        const r = await fetch("/api/train/status");
        const d = await r.json();
        renderTrainingState(d);
        if (!d.running && trainingPollHandle) {
            clearInterval(trainingPollHandle);
            trainingPollHandle = null;
        }
    } catch { }
}

function ensureTrainingPolling() {
    if (trainingPollHandle) return;
    trainingPollHandle = setInterval(fetchTrainingStatus, 3000);
}

async function startModelTraining() {
    const btn = document.getElementById("train-start-btn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Starting…';
    try {
        const r = await fetch("/api/train/start", { method: "POST" });
        const d = await r.json();
        if (!r.ok && r.status !== 409) throw new Error(d?.message || "Unable to start training.");
        renderTrainingState(d.training || d);
        ensureTrainingPolling();
        await fetchTrainingStatus();
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">⚡</span> Start Training';
        alert(`Training start failed: ${err.message}`);
    }
}

// ── File Upload / Analyze ─────────────────────────────────────────────────
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    await runAnalysis(null, file);
}

async function handleManualInput() {
    const val = document.getElementById("manual-input").value.trim();
    if (!val) { alert("Please enter EEG data values."); return; }
    await runAnalysis(val, null);
}

async function runAnalysis(textData, file) {
    const statusEl = document.getElementById("upload-status");
    const resultEl = document.getElementById("analysis-result");

    statusEl.innerText = "Analyzing…";
    statusEl.style.color = "#f59e0b";
    resultEl.classList.add("hidden");

    try {
        let response;
        if (file) {
            const form = new FormData();
            form.append("file", file);
            response = await fetch("/api/analyze_file", { method: "POST", body: form });
        } else {
            response = await fetch("/api/analyze_file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: textData })
            });
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        statusEl.innerText = "✓ Complete";
        statusEl.style.color = "#34d399";
        resultEl.classList.remove("hidden");

        document.getElementById("result-prob").innerText = `${(data.max_probability * 100).toFixed(1)}%`;
        document.getElementById("result-segments").innerText = `${data.seizure_segments_count} / ${data.total_segments}`;
        setPrediction(data.max_probability);

        const verdictEl = document.getElementById("result-verdict");
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (data.seizure_detected) {
            verdictEl.innerText = "⚠ SEIZURE DETECTED";
            verdictEl.style.background = isDark ? "rgba(190,24,93,0.22)" : "rgba(254,205,211,0.7)";
            verdictEl.style.border = isDark ? "1px solid rgba(244,63,94,0.6)" : "1px solid rgba(225,29,72,0.45)";
            verdictEl.style.color = isDark ? "#fda4af" : "#be123c";
        } else {
            verdictEl.innerText = "✓ NO SEIZURE DETECTED";
            verdictEl.style.background = isDark ? "rgba(5,150,105,0.18)" : "rgba(209,250,229,0.8)";
            verdictEl.style.border = isDark ? "1px solid rgba(52,211,153,0.5)" : "1px solid rgba(16,185,129,0.45)";
            verdictEl.style.color = isDark ? "#6ee7b7" : "#065f46";
        }

        // Store analysis result and update patient report if one is active
        lastAnalysisResult = {
            max_probability: data.max_probability,
            seizure_detected: data.seizure_detected,
            seizure_segments_count: data.seizure_segments_count,
            total_segments: data.total_segments,
            timestamp: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
        };
        if (currentPatient) renderPatientReport(currentPatient);

        if (data.plot_data) {
            const preview = data.plot_data.slice(0, MAX_POINTS);
            while (preview.length < MAX_POINTS) preview.push(0);
            eegData.splice(0, MAX_POINTS, ...preview);
            chart.update();
        }
    } catch (err) {
        statusEl.innerText = "Failed";
        statusEl.style.color = "#f43f5e";
        alert(`Analysis failed: ${err.message}`);
    }
}

// ── System Status ─────────────────────────────────────────────────────────
async function fetchSystemStatus() {
    try {
        const r = await fetch("/api/status");
        const d = await r.json();
        if (d?.threshold !== undefined) {
            document.getElementById("threshold-badge").innerText = `Threshold: ${Number(d.threshold).toFixed(3)}`;
        }
        if (d?.training) renderTrainingState(d.training);
    } catch { }
}

// ── Init ──────────────────────────────────────────────────────────────────
initThreeJS();
setPrediction(0);
renderConnectionState(false);
initializeAuthentication();
fetchSystemStatus();
fetchTrainingStatus();
ensureTrainingPolling();
setInterval(fetchSystemStatus, 5000);
