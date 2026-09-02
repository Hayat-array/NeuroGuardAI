/**
 * ModelTraining.jsx — Start training, poll status, show metrics
 * Exact port of the training UI from script.js
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { startTraining, fetchTrainingStatus } from "../services/api";

export default function ModelTraining({ initialState }) {
  const [trainingState, setTrainingState] = useState(
    initialState || { status: "idle", running: false, message: "Ready to start background training.", metrics: null }
  );
  const pollRef = useRef(null);

  const pollStatus = useCallback(async () => {
    try {
      const d = await fetchTrainingStatus();
      setTrainingState(d);
      if (!d.running && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch { /* ignore */ }
  }, []);

  const ensurePolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(pollStatus, 3000);
  }, [pollStatus]);

  useEffect(() => {
    // Pick up any in-progress training on mount
    pollStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollStatus]);

  const handleStart = async () => {
    setTrainingState((s) => ({ ...s, running: true, status: "running", message: "Starting..." }));
    try {
      const d = await startTraining();
      setTrainingState(d.training || d);
      ensurePolling();
      await pollStatus();
    } catch (err) {
      setTrainingState((s) => ({ ...s, running: false, status: "failed", message: err.message }));
    }
  };

  const { running, status, message, metrics } = trainingState;

  return (
    <section className="panel glass training-panel fade-in-up" style={{ "--delay": "0.1s" }}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Model Management</h2>
          <p className="panel-sub">CNN-BiLSTM-Attention Training</p>
        </div>
        <span id="train-status-badge" className="status-tag">
          {(status || "idle").toUpperCase()}
        </span>
      </div>
      <div className="training-content">
        <p id="train-status-text" className="panel-copy" style={running ? { color: "#22d3ee" } : {}}>
          {message || "Ready to start background training."}
        </p>
        <button
          id="train-start-btn"
          type="button"
          className="btn btn-primary full"
          onClick={handleStart}
          disabled={running}
          style={{ opacity: running ? 0.72 : 1 }}
        >
          {running ? (
            <><span className="spinner" /> Training…</>
          ) : (
            <><span className="btn-icon">⚡</span> Start Training</>
          )}
        </button>
        {metrics && (
          <div id="train-metrics" className="train-metrics">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
              <div>🎯 Accuracy <strong style={{ color: "#67e8f9" }}>{(Number(metrics.accuracy || 0) * 100).toFixed(2)}%</strong></div>
              <div>📈 AUC <strong style={{ color: "#c4b5fd" }}>{Number(metrics.auc || 0).toFixed(4)}</strong></div>
              <div>✅ Sensitivity <strong style={{ color: "#6ee7b7" }}>{(Number(metrics.sensitivity || 0) * 100).toFixed(2)}%</strong></div>
              <div>🛡 Specificity <strong style={{ color: "#6ee7b7" }}>{(Number(metrics.specificity || 0) * 100).toFixed(2)}%</strong></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
