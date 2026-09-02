/**
 * ProbabilityGauge.jsx — SVG arc gauge + probability bar + risk label
 * Exact port of the probability panel from index.html/script.js
 */
import { useEffect, useRef, useState } from "react";

const GAUGE_TOTAL = 251;

function animateCounter(setter, from, to, duration) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const val = from + (to - from) * t;
    setter(val);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export default function ProbabilityGauge({ probability = 0 }) {
  const prob = Math.max(0, Math.min(1, probability));
  const prevProbRef = useRef(0);
  const [displayProb, setDisplayProb] = useState(0);

  useEffect(() => {
    animateCounter(setDisplayProb, prevProbRef.current, prob, 400);
    prevProbRef.current = prob;
  }, [prob]);

  const percent = (displayProb * 100).toFixed(1);
  const offset = GAUGE_TOTAL * (1 - displayProb);
  const angle = Math.PI + displayProb * Math.PI;
  const cx = (100 + 80 * Math.cos(angle)).toFixed(1);
  const cy = (110 + 80 * Math.sin(angle)).toFixed(1);
  const dotColor = prob >= 0.75 ? "#f43f5e" : prob >= 0.45 ? "#f59e0b" : "#22d3ee";
  const textColor = prob >= 0.75 ? "#f43f5e" : prob >= 0.45 ? "#f59e0b" : "#10b981";
  const textShadow = prob >= 0.75
    ? "0 0 30px rgba(244,63,94,0.6)"
    : prob >= 0.45
    ? "0 0 24px rgba(245,158,11,0.5)"
    : "0 0 24px rgba(16,185,129,0.4)";
  const riskLabel = prob >= 0.75 ? "⚠ High Risk" : prob >= 0.45 ? "Moderate Risk" : "Low Risk";
  const riskClass = prob >= 0.75 ? "risk-badge risk-high" : prob >= 0.45 ? "risk-badge risk-mid" : "risk-badge risk-low";

  return (
    <section className="panel glass probability-panel fade-in-up" style={{ "--delay": "0.3s" }}>
      <h2 className="prob-title">Seizure Probability</h2>
      <div className="gauge-container">
        <svg className="gauge-svg" viewBox="0 0 200 120">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
          <path
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            id="gauge-fill"
            d="M 20 110 A 80 80 0 0 1 180 110"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray="251"
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
          <circle
            id="gauge-dot"
            cx={cx}
            cy={cy}
            r="7"
            fill={dotColor}
            style={{ filter: `drop-shadow(0 0 6px ${dotColor})`, transition: "cx 0.5s ease, cy 0.5s ease" }}
          />
        </svg>
        <div className="gauge-center">
          <div
            id="prediction-value"
            className="prob-value"
            style={{ color: textColor, textShadow }}
          >
            {percent}%
          </div>
          <div id="risk-label" className={riskClass}>
            {riskLabel}
          </div>
        </div>
      </div>
      <div className="prob-track">
        <div
          id="prediction-bar"
          className="prob-fill"
          style={{ width: `${percent}%`, transition: "width 0.4s ease" }}
        />
      </div>
    </section>
  );
}
