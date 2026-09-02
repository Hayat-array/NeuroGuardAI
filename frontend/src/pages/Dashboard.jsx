/**
 * Dashboard.jsx — Main page layout
 * Replicates the grid layout from index.html, merging Research Panel from index1.html.
 */
import { useState, useEffect, useRef } from "react";
import { fetchStatus } from "../services/api";

import BrainVisualization from "../components/BrainVisualization";
import StreamControls from "../components/StreamControls";
import ModelTraining from "../components/ModelTraining";
import AnalyzeEEG from "../components/AnalyzeEEG";
import ProbabilityGauge from "../components/ProbabilityGauge";
import EEGChart from "../components/EEGChart";
import PatientDossier from "../components/PatientDossier";
import ResearchPanel from "../components/ResearchPanel";

export default function Dashboard({ socketState, onPatientChange }) {
  const { connected, eegBufferRef, eegTick, prediction } = socketState;
  const [threshold, setThreshold] = useState(0.5);
  const [trainingState, setTrainingState] = useState(null);
  const [lastAnalysisResult, setLastAnalysisResult] = useState(null);
  const [currentPatient, setCurrentPatient] = useState(null);

  const showSeizureAlert = prediction >= 0.75;

  // Periodic system status poll
  useEffect(() => {
    const poll = async () => {
      try {
        const d = await fetchStatus();
        if (d?.threshold !== undefined) setThreshold(d.threshold);
        if (d?.training) setTrainingState(d.training);
        if (d?.patient) {
          setCurrentPatient(d.patient);
          if (onPatientChange) onPatientChange(d.patient);
        }
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [onPatientChange]);

  const handleAnalysisResult = (result) => {
    setLastAnalysisResult({ ...result, timestamp: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) });
    if (result && typeof result.max_probability === "number") {
      socketState.setPrediction(result.max_probability);
    }
    if (result?.plot_data && socketState.setEegTick) {
      socketState.setEegTick((t) => t + 1);
    }
  };

  const handlePatientSaved = (patient) => {
    setCurrentPatient(patient);
    if (onPatientChange) onPatientChange(patient);
  };

  return (
    <main className="dashboard-grid">
      {/* LEFT COLUMN: Brain + Stream Controls + Model Training */}
      <section className="col-stack">
        <section className="panel left-panel glass-deep fade-in-up" style={{ "--delay": "0s" }}>
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Neural Activity Monitor</h2>
              <p className="panel-sub">Real-time 3D brain signal visualization</p>
            </div>
            <div className="live-badge" id="live-indicator">
              <span className="live-pulse" /> LIVE
            </div>
          </div>
          <BrainVisualization probability={prediction} />
          <StreamControls threshold={threshold} />
        </section>

        <ModelTraining initialState={trainingState} />
      </section>

      {/* MIDDLE COLUMN: Analyze + Gauge + Chart */}
      <section className="col-stack">
        <AnalyzeEEG onResult={handleAnalysisResult} eegBufferRef={eegBufferRef} />
        <ProbabilityGauge probability={prediction} />
        <EEGChart eegBufferRef={eegBufferRef} eegTick={eegTick} />
      </section>

      {/* RIGHT COLUMN: Research Panel */}
      <section className="col-stack">
        <ResearchPanel />
      </section>

      {/* BOTTOM FULL-WIDTH: Patient Dossier */}
      <PatientDossier
        onPatientSaved={handlePatientSaved}
        lastAnalysisResult={lastAnalysisResult}
      />
    </main>
  );
}
