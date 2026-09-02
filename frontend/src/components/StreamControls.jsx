/**
 * StreamControls.jsx — Start/Stop stream buttons + threshold badge
 */
import { useState } from "react";
import { startStream, stopStream } from "../services/api";

export default function StreamControls({ threshold }) {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    try {
      setError(null);
      await startStream();
      setStreaming(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStop = async () => {
    try {
      setError(null);
      await stopStream();
      setStreaming(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="stream-controls">
      <div className="stream-state-row">
        <span id="stream-state" className="stream-label">
          Live Stream:{" "}
          <em>{streaming ? "Running" : "Stopped"}</em>
        </span>
        <span id="threshold-badge" className="hud-pill mini">
          Threshold:{" "}
          {threshold !== undefined ? Number(threshold).toFixed(3) : "0.500"}
        </span>
      </div>
      {error && (
        <p style={{ color: "#f43f5e", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          id="btn-start"
          type="button"
          className="btn btn-success glow-success"
          onClick={handleStart}
        >
          <span className="btn-icon">▶</span> Start Stream
        </button>
        <button
          id="btn-stop"
          type="button"
          className="btn btn-danger glow-danger"
          onClick={handleStop}
        >
          <span className="btn-icon">■</span> Stop Stream
        </button>
      </div>
    </div>
  );
}
