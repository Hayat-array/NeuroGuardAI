/**
 * api.js — Centralized API service
 * All fetch() calls go here. BASE_URL comes from the .env file.
 *
 * NOTE: Socket.IO connection is handled separately in hooks/useSocketIO.js
 *       because SocketIO needs a direct WebSocket URL, not the Vite proxy.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Shared fetch helper ──────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch("/api/health");
}

// ── System status ─────────────────────────────────────────────────────────────

export async function fetchStatus() {
  return apiFetch("/api/status");
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function startStream() {
  return apiFetch("/api/start_stream", { method: "POST" });
}

export async function stopStream() {
  return apiFetch("/api/stop_stream", { method: "POST" });
}

// ── Training ──────────────────────────────────────────────────────────────────

export async function startTraining() {
  const res = await fetch(`${BASE_URL}/api/train/start`, { method: "POST" });
  const data = await res.json();
  // 409 means already running — treat as OK
  if (!res.ok && res.status !== 409) {
    throw new Error(data?.message || "Unable to start training.");
  }
  return data;
}

export async function fetchTrainingStatus() {
  return apiFetch("/api/train/status");
}

// ── Patient ───────────────────────────────────────────────────────────────────

export async function fetchCurrentPatient() {
  return apiFetch("/api/patient/current");
}

export async function savePatient(payload) {
  const res = await fetch(`${BASE_URL}/api/patient/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || "Failed to save patient.");
  }
  return data;
}

// ── EEG Analysis ──────────────────────────────────────────────────────────────

/**
 * Upload a .txt / .csv EEG file for analysis.
 * @param {File} file
 */
export async function analyzeFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/analyze_file`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

/**
 * Analyze comma-separated EEG values entered manually.
 * @param {string} textData  comma-separated amplitude values
 */
export async function analyzeManual(textData) {
  const res = await fetch(`${BASE_URL}/api/analyze_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: textData }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

// ── Research (optional — backend route may not exist) ────────────────────────

export async function fetchResearch(query) {
  const res = await fetch(`${BASE_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}
