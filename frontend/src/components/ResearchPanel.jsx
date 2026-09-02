/**
 * ResearchPanel.jsx — Perplexity Research + Clinical History Modal
 * Ported from index1.html / script1.js, merged into the main dashboard.
 */
import { useState } from "react";
import { fetchResearch } from "../services/api";

function HistoryModal({ onClose, onSubmit }) {
  const [fields, setFields] = useState({
    onset: "", family: "", firstSeizure: "", triggers: "",
    duration: "", sensations: "", meds: "", effect: ""
  });
  const handleChange = (e) => setFields((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = () => {
    const query = `
CLINICAL HISTORY ANALYSIS REQUEST:
Patient Details:
- Age of Onset: ${fields.onset}
- Family History: ${fields.family}
- First Seizure: ${fields.firstSeizure}
- Triggers: ${fields.triggers}
- Duration: ${fields.duration}
- Sensations/Aura: ${fields.sensations}
- Medications: ${fields.meds}
- Treatment Effect: ${fields.effect}

INSTRUCTIONS:
Based strictly on the Cleveland Clinic epilepsy guidelines and the history above, classify the likelihood of epilepsy.
1. Start your response with exactly "YES" (if epilepsy is likely) or "NO" (if unlikely/other cause).
2. Then, provide a detailed clinical impression and recommended diagnostic steps (e.g., MRI, Sleep-deprived EEG).
    `;
    onSubmit(query);
    onClose();
  };

  const inputCls = {
    width: "100%", background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(99,102,241,0.25)", borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem", color: "var(--text)", outline: "none",
    fontFamily: "var(--font-body)", fontSize: "0.85rem",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "center", padding: "1rem" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "1.25rem", width: "100%", maxWidth: "48rem", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>📋 Clinical History &amp; Evaluation</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Please provide detailed information to assist in the diagnosis and treatment plan.</p>
          <h3 style={{ color: "#6366f1", fontWeight: 700 }}>1. General Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[["Age of Onset","onset","text","e.g. 15 years old"],["Family History","family","text","Any relatives with epilepsy?"]].map(([lbl,name,type,ph])=>(
              <label key={name}><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>{lbl}</span><br/>
              <input style={inputCls} type={type} name={name} value={fields[name]} onChange={handleChange} placeholder={ph}/></label>
            ))}
          </div>
          <h3 style={{ color: "#6366f1", fontWeight: 700 }}>2. Diagnostic Steps &amp; Seizure Profile</h3>
          <label><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>First Seizure Circumstances</span><br/>
            <textarea style={{ ...inputCls, resize: "none" }} name="firstSeizure" rows={2} value={fields.firstSeizure} onChange={handleChange} placeholder="Describe what happened during the first seizure..."/></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[["Triggers / Factors","triggers","text","e.g. Stress, Lack of sleep"],["Duration","duration","text","e.g. 1-2 minutes"]].map(([lbl,name,type,ph])=>(
              <label key={name}><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>{lbl}</span><br/>
              <input style={inputCls} type={type} name={name} value={fields[name]} onChange={handleChange} placeholder={ph}/></label>
            ))}
          </div>
          <label><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>Sensations (Before/During/After)</span><br/>
            <textarea style={{ ...inputCls, resize: "none" }} name="sensations" rows={2} value={fields.sensations} onChange={handleChange} placeholder="Describe aura, feelings during seizure, and post-ictal state..."/></label>
          <h3 style={{ color: "#6366f1", fontWeight: 700 }}>3. Treatment &amp; Medications</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>Current Medications &amp; Dosages</span><br/>
              <textarea style={{ ...inputCls, resize: "none" }} name="meds" rows={2} value={fields.meds} onChange={handleChange} placeholder="e.g. Keppra 500mg BID..."/></label>
            <label><span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--muted)" }}>Effectiveness / Side Effects</span><br/>
              <textarea style={{ ...inputCls, resize: "none" }} name="effect" rows={2} value={fields.effect} onChange={handleChange} placeholder="Has treatment controlled detections?"/></label>
          </div>
        </div>
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSubmit} className="btn btn-primary">Generate Clinical Report</button>
        </div>
      </div>
    </div>
  );
}

export default function ResearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const performQuery = async (q) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchResearch(q);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { if (query) performQuery(query); };
  const handleHistorySubmit = (q) => { setQuery("Analyzing Patient History for Epilepsy Likelihood..."); performQuery(q); };

  const choices = result?.choices?.[0]?.message?.content || "";
  const isYes = choices.trim().toUpperCase().startsWith("YES");
  const isNo = choices.trim().toUpperCase().startsWith("NO");

  return (
    <>
      {showModal && <HistoryModal onClose={() => setShowModal(false)} onSubmit={handleHistorySubmit} />}
      <section className="panel glass fade-in-up" style={{ "--delay": "0.2s" }}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">🧬 Perplexity Research</h2>
            <p className="panel-sub">Context-aware clinical citations</p>
          </div>
          <button className="btn btn-ghost" style={{ fontSize: "0.78rem" }} onClick={() => setShowModal(true)}>
            📋 Patient History Form
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search clinical citations..."
            style={{ flex: 1, background: "rgba(30,41,59,0.4)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "var(--text)", outline: "none" }}
          />
          <button className="btn btn-primary small" onClick={handleSearch} disabled={loading}>
            {loading ? "…" : "Ask"}
          </button>
        </div>

        <div style={{ minHeight: "6rem", background: "rgba(15,23,42,0.2)", borderRadius: "0.65rem", padding: "0.75rem", fontSize: "0.83rem", lineHeight: 1.6 }}>
          {loading && <p style={{ color: "#22d3ee" }}>Consulting Research Database…</p>}
          {error && (
            <p style={{ color: "#f43f5e" }}>
              {error.includes("Not found") || error.includes("404")
                ? "Research API not yet enabled on backend. Add /api/research route to Flask app."
                : `Error: ${error}`}
            </p>
          )}
          {!loading && !error && !result && (
            <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
              Context-aware citations will appear here based on detected seizure patterns…
            </p>
          )}
          {choices && (
            <>
              {isYes && (
                <div style={{ marginBottom: "0.75rem", padding: "0.6rem", background: "rgba(190,24,93,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.4rem" }}>⚠️</span>
                  <div><strong style={{ color: "#fda4af" }}>LIKELY EPILEPSY</strong><br/><small style={{ color: "#fecdd3" }}>Clinical history suggests epilepsy pattern.</small></div>
                </div>
              )}
              {isNo && (
                <div style={{ marginBottom: "0.75rem", padding: "0.6rem", background: "rgba(5,150,105,0.15)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.4rem" }}>✅</span>
                  <div><strong style={{ color: "#6ee7b7" }}>LOW LIKELIHOOD</strong><br/><small style={{ color: "#a7f3d0" }}>Symptoms may indicate non-epileptic causes.</small></div>
                </div>
              )}
              <p style={{ whiteSpace: "pre-wrap" }}>{choices}</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
