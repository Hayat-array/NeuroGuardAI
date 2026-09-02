/**
 * AnalyzeEEG.jsx — File upload + manual paste + results display
 * Exact port of the "Analyze EEG Signal" panel from index.html/script.js
 */
import { useRef } from "react";
import { usePrediction } from "../hooks/usePrediction";

const MAX_POINTS = 200;

export default function AnalyzeEEG({ onResult, eegBufferRef }) {
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const { loading, error, result, runFileAnalysis, runManualAnalysis } = usePrediction();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await runFileAnalysis(file);
      if (data.plot_data && eegBufferRef) {
        const preview = data.plot_data.slice(0, MAX_POINTS);
        while (preview.length < MAX_POINTS) preview.push(0);
        eegBufferRef.current.splice(0, MAX_POINTS, ...preview);
      }
      if (onResult) onResult(data);
    } catch { /* error shown below */ }
  };

  const handleManual = async () => {
    const val = textRef.current?.value.trim();
    if (!val) { alert("Please enter EEG data values."); return; }
    try {
      const data = await runManualAnalysis(val);
      if (onResult) onResult(data);
    } catch { /* error shown below */ }
  };

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  return (
    <section className="panel glass fade-in-up" style={{ "--delay": "0.1s" }}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Analyze EEG Signal</h2>
          <p className="panel-sub">Upload file or paste raw values</p>
        </div>
        <span id="upload-status" className="status-tag" style={{
          color: loading ? "#f59e0b" : error ? "#f43f5e" : result ? "#34d399" : undefined
        }}>
          {loading ? "Analyzing…" : error ? "Failed" : result ? "✓ Complete" : "Ready"}
        </span>
      </div>

      <label className="field-label">Upload EEG File</label>
      <label className="file-select" id="file-drop-zone">
        <div className="file-icon">📂</div>
        <span>Drop or Select .txt / .csv</span>
        <input
          type="file"
          id="file-upload"
          accept=".txt,.csv"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

      <label className="field-label">Or Paste Raw EEG Values</label>
      <div className="inline-textarea">
        <textarea
          id="manual-input"
          ref={textRef}
          rows={3}
          placeholder="Comma separated EEG amplitude values..."
        />
        <button type="button" className="btn btn-primary small" onClick={handleManual}>
          Analyze
        </button>
      </div>

      {error && (
        <p style={{ color: "#f43f5e", fontSize: "0.8rem", marginTop: "0.4rem" }}>{error}</p>
      )}

      {result && (
        <div id="analysis-result" className="analysis-result">
          <div className="result-row">
            <span>Max Probability</span>
            <strong id="result-prob">{(result.max_probability * 100).toFixed(1)}%</strong>
          </div>
          <div className="result-row">
            <span>Seizure Segments</span>
            <strong id="result-segments">
              {result.seizure_segments_count} / {result.total_segments}
            </strong>
          </div>
          <div
            id="result-verdict"
            className="verdict"
            style={{
              background: result.seizure_detected
                ? isDark ? "rgba(190,24,93,0.22)" : "rgba(254,205,211,0.7)"
                : isDark ? "rgba(5,150,105,0.18)" : "rgba(209,250,229,0.8)",
              border: result.seizure_detected
                ? isDark ? "1px solid rgba(244,63,94,0.6)" : "1px solid rgba(225,29,72,0.45)"
                : isDark ? "1px solid rgba(52,211,153,0.5)" : "1px solid rgba(16,185,129,0.45)",
              color: result.seizure_detected
                ? isDark ? "#fda4af" : "#be123c"
                : isDark ? "#6ee7b7" : "#065f46",
            }}
          >
            {result.seizure_detected ? "⚠ SEIZURE DETECTED" : "✓ NO SEIZURE DETECTED"}
          </div>
        </div>
      )}
    </section>
  );
}
