/**
 * Header.jsx — Topbar with brand, patient pill, status indicator, theme toggle
 */
import { useEffect, useState } from "react";

export default function Header({ connected, currentPatient }) {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("ng-theme") === "dark";
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("ng-theme", "dark");
    } else {
      html.removeAttribute("data-theme");
      localStorage.setItem("ng-theme", "light");
    }
  }, [isDark]);

  // Restore saved theme on first render
  useEffect(() => {
    const saved = localStorage.getItem("ng-theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => setIsDark((d) => !d);

  const patientText = currentPatient?.name
    ? `Patient: ${currentPatient.name}${currentPatient.patient_id ? ` (${currentPatient.patient_id})` : ""}`
    : "Patient: Not Selected";

  return (
    <header className="topbar">
      <div className="brand-group">
        <div className="brand-icon">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="17" stroke="url(#brandGrad)" strokeWidth="2" />
            <path
              d="M9 18 Q 12 10, 15 18 Q 18 26, 21 18 Q 24 10, 27 18"
              stroke="#22d3ee"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="36" y2="36">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <p className="kicker">Clinical Neuroinformatics Platform</p>
          <h1 className="brand">
            NeuroGuard<span className="brand-ai">AI</span>
          </h1>
          <p className="subtitle">
            CNN-BiLSTM-Attention · Ensemble Verification · Real-time EEG Analysis
          </p>
        </div>
      </div>

      <div className="topbar-right">
        <div id="active-patient" className="hud-pill patient-pill">
          <span className="pill-dot" />
          {patientText}
        </div>
        <div className="status-box">
          <button
            className="theme-toggle"
            id="theme-toggle-btn"
            title="Toggle dark/light mode"
            onClick={toggleTheme}
          >
            <div className="toggle-track">
              <div className="toggle-thumb" id="toggle-thumb">
                {isDark ? "🌙" : "☀️"}
              </div>
            </div>
            <span className="toggle-icon" id="toggle-label">
              {isDark ? "Dark" : "Light"}
            </span>
          </button>
          <span
            id="status-indicator"
            className={"status-dot " + (connected ? "online" : "offline")}
          />
          <span
            id="status-text"
            style={{ color: connected ? "#34d399" : "#94a3b8" }}
          >
            {connected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
