/**
 * App.jsx — Root component
 * Sets up SocketIO connection context and renders the Dashboard.
 * Handles cold-start detection (Render free tier sleeps after 15 min inactivity).
 */
import { useState, useEffect } from "react";
import { useSocketIO } from "./hooks/useSocketIO";
import { checkHealth } from "./services/api";
import Header from "./components/Header";
import SeizureOverlay from "./components/SeizureOverlay";
import Dashboard from "./pages/Dashboard";

// Background particles (same as original script.js initBgParticles)
function initBgParticles() {
  const container = document.getElementById("bg-particles");
  if (!container || container.childNodes.length > 0) return;
  const count = 28;
  const style = document.createElement("style");
  style.textContent = `@keyframes floatDot { 0%{transform:translateY(0px) translateX(0px);} 100%{transform:translateY(-40px) translateX(20px);} }`;
  document.head.appendChild(style);
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    const size = Math.random() * 3 + 1;
    Object.assign(dot.style, {
      position: "absolute",
      width: `${size}px`, height: `${size}px`,
      borderRadius: "50%",
      left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
      background: i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#0ea5e9" : "#a855f7",
      opacity: (Math.random() * 0.25 + 0.06).toFixed(2),
      boxShadow: `0 0 ${size * 4}px currentColor`,
      animation: `floatDot ${(Math.random() * 12 + 8).toFixed(1)}s ${(Math.random() * 8).toFixed(1)}s ease-in-out infinite alternate`,
    });
    container.appendChild(dot);
  }
}

export default function App() {
  const socketState = useSocketIO();
  const [currentPatient, setCurrentPatient] = useState(null);
  const [coldStart, setColdStart] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  // Cold-start check: poll /api/health until backend responds
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s max wait
    let timer = null;

    const ping = async () => {
      attempts++;
      try {
        await checkHealth();
        setBackendReady(true);
        setColdStart(false);
      } catch {
        if (attempts >= 2) setColdStart(true);
        if (attempts < maxAttempts) {
          timer = setTimeout(ping, 3000);
        }
      }
    };

    ping();
    return () => clearTimeout(timer);
  }, []);

  // Particles + background grid
  useEffect(() => {
    initBgParticles();
  }, []);

  return (
    <>
      <SeizureOverlay visible={socketState.prediction >= 0.75} />
      <div className="bg-particles" id="bg-particles" />
      <div className="bg-grid" />
      <div className="scanline" />

      {coldStart && !backendReady && (
        <div style={{
          position: "fixed", top: "4.5rem", left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.4)", borderRadius: "0.65rem",
          padding: "0.5rem 1.2rem", fontSize: "0.82rem", color: "#f59e0b",
          backdropFilter: "blur(8px)", whiteSpace: "nowrap",
        }}>
          ⏳ Backend waking up, please wait… (Render cold start may take 30–60s)
        </div>
      )}

      <Header connected={socketState.connected} currentPatient={currentPatient} />
      <Dashboard socketState={socketState} onPatientChange={setCurrentPatient} />
    </>
  );
}
