/**
 * PatientDossier.jsx — Full patient form + save/report/clear functionality
 * Exact port of the Patient Dossier panel from index.html/script.js
 */
import { useState, useCallback } from "react";
import { savePatient } from "../services/api";

function renderPatientReport(patient, lastAnalysisResult) {
  const age = patient.age || "—";
  const sex = patient.sex || "—";
  const dob = patient.dob || "—";
  const pid = patient.patient_id || "—";
  const now = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  let eegSection = "";
  if (lastAnalysisResult) {
    const ar = lastAnalysisResult;
    const probPct = (ar.max_probability * 100).toFixed(1);
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
        <div class="eeg-verdict" style="background:${riskBg};border:1px solid ${riskBdr};color:${riskClr};">${riskLabel}</div>
        <div class="eeg-stats-grid">
          <div class="eeg-stat"><span class="eeg-stat-label">Max Probability</span>
            <span class="eeg-stat-val" style="color:${probBarClr};font-size:1.35rem;font-weight:800;">${probPct}%</span>
            <div class="eeg-prob-bar-bg"><div class="eeg-prob-bar-fill" style="width:${probPct}%;background:${probBarClr};"></div></div>
          </div>
          <div class="eeg-stat"><span class="eeg-stat-label">Seizure Segments</span><span class="eeg-stat-val">${segText}</span></div>
          <div class="eeg-stat span2"><span class="eeg-stat-label">Analysis Time</span><span class="eeg-stat-val">${ar.timestamp}</span></div>
        </div>
      </div>`;
  }

  return `
    <div class="patient-report-card">
      <div class="report-header">
        <div class="report-avatar">${patient.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="report-name">${patient.name}</div>
          <div class="report-meta">ID: ${pid} &nbsp;|&nbsp; Saved: ${now}</div>
        </div>
      </div>
      <div class="report-grid">
        <div class="report-item"><span class="ri-label">Age</span><span class="ri-val">${age}</span></div>
        <div class="report-item"><span class="ri-label">Sex</span><span class="ri-val">${sex}</span></div>
        <div class="report-item"><span class="ri-label">DOB</span><span class="ri-val">${dob}</span></div>
        <div class="report-item"><span class="ri-label">Blood</span><span class="ri-val">${patient.blood_group || "—"}</span></div>
        <div class="report-item"><span class="ri-label">Phone</span><span class="ri-val">${patient.phone || "—"}</span></div>
        <div class="report-item"><span class="ri-label">Email</span><span class="ri-val">${patient.email || "—"}</span></div>
        <div class="report-item span2"><span class="ri-label">Emergency</span><span class="ri-val">${patient.emergency_contact || "—"}</span></div>
        <div class="report-item span2"><span class="ri-label">Allergies</span><span class="ri-val">${patient.allergies || "None listed"}</span></div>
        <div class="report-item span2"><span class="ri-label">Medications</span><span class="ri-val">${patient.medications || "None listed"}</span></div>
        ${patient.history_notes ? `<div class="report-item span2"><span class="ri-label">Notes</span><span class="ri-val">${patient.history_notes}</span></div>` : ""}
      </div>
      ${eegSection}
    </div>`;
}

export default function PatientDossier({ onPatientSaved, lastAnalysisResult }) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Not Saved");
  const [reportHtml, setReportHtml] = useState('<p style="opacity:0.5;font-size:0.82rem;">No active patient record yet.</p>');

  const [form, setForm] = useState({
    name: "", patient_id: "", age: "", sex: "", dob: "",
    blood_group: "", phone: "", email: "",
    emergency_contact: "", allergies: "", medications: "", history_notes: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Please enter patient name."); return; }
    setSaving(true);
    setSaveStatus("Saving…");
    try {
      const d = await savePatient(form);
      const patient = d.patient;
      setSaveStatus("✓ Saved");
      setReportHtml(renderPatientReport(patient, lastAnalysisResult));
      if (onPatientSaved) onPatientSaved(patient);
      document.getElementById("patient-overview")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setSaveStatus("Save Failed");
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setForm({ name: "", patient_id: "", age: "", sex: "", dob: "", blood_group: "", phone: "", email: "", emergency_contact: "", allergies: "", medications: "", history_notes: "" });
    setSaveStatus("Ready");
    setReportHtml('<p style="opacity:0.5;font-size:0.82rem;">No active patient record yet.</p>');
    if (onPatientSaved) onPatientSaved(null);
  };

  const downloadReport = () => {
    const printWin = window.open("", "_blank");
    printWin.document.write(`<html><head><title>NeuroGuard Report</title></head><body>${reportHtml}</body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const hasSaved = saveStatus === "✓ Saved";

  return (
    <section className="panel glass fade-in-up" style={{ "--delay": "0.15s", gridColumn: "1 / -1" }}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Patient Dossier</h2>
          <p className="panel-sub">Clinical profile</p>
        </div>
        <span
          id="patient-save-status"
          className="status-tag"
          style={{ color: hasSaved ? "#34d399" : saveStatus === "Save Failed" ? "#f43f5e" : undefined }}
        >
          {saveStatus}
        </span>
      </div>

      <div className="patient-grid">
        {[
          { id: "patient-name", label: "Full Name", name: "name", type: "text", placeholder: "Patient name" },
          { id: "patient-id", label: "Patient ID", name: "patient_id", type: "text", placeholder: "Auto if empty" },
          { id: "patient-age", label: "Age", name: "age", type: "number", placeholder: "Age" },
          { id: "patient-phone", label: "Phone", name: "phone", type: "text", placeholder: "Mobile number" },
          { id: "patient-email", label: "Email", name: "email", type: "email", placeholder: "Email" },
          { id: "patient-blood-group", label: "Blood Group", name: "blood_group", type: "text", placeholder: "e.g. O+" },
        ].map(({ id, label, name, type, placeholder }) => (
          <label key={id} className="field">
            <span>{label}</span>
            <input id={id} type={type} name={name} value={form[name]} onChange={handleChange} placeholder={placeholder} />
          </label>
        ))}

        <label className="field">
          <span>Sex</span>
          <select id="patient-sex" name="sex" value={form.sex} onChange={handleChange}>
            <option value="">Select</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Date of Birth</span>
          <input id="patient-dob" type="date" name="dob" value={form.dob} onChange={handleChange} />
        </label>

        <label className="field span-2">
          <span>Emergency Contact</span>
          <input id="patient-emergency-contact" type="text" name="emergency_contact" value={form.emergency_contact} onChange={handleChange} placeholder="Name and phone" />
        </label>
        <label className="field span-2">
          <span>Allergies</span>
          <input id="patient-allergies" type="text" name="allergies" value={form.allergies} onChange={handleChange} placeholder="Drug or food allergies" />
        </label>
        <label className="field span-2">
          <span>Current Medications</span>
          <input id="patient-medications" type="text" name="medications" value={form.medications} onChange={handleChange} placeholder="Current medications" />
        </label>
        <label className="field span-2">
          <span>Clinical Notes</span>
          <textarea id="patient-history-notes" name="history_notes" rows={3} value={form.history_notes} onChange={handleChange} placeholder="Seizure type, history, notes..." />
        </label>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <span className="btn-icon">💾</span> Save &amp; Generate Report
        </button>
        {hasSaved && (
          <button id="download-report-btn" type="button" className="btn btn-accent" onClick={downloadReport}>
            <span className="btn-icon">📥</span> Download Report
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={handleClear}>
          <span className="btn-icon">🔄</span> New Patient
        </button>
      </div>

      <div id="patient-overview" className="patient-overview" dangerouslySetInnerHTML={{ __html: reportHtml }} />
    </section>
  );
}
