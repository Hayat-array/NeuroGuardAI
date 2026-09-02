/**
 * EEGChart.jsx — Live rolling EEG waveform using Chart.js
 * Reads from a shared mutable ref buffer (eegBufferRef) to avoid re-renders.
 */
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const MAX_POINTS = 200;

export default function EEGChart({ eegBufferRef, eegTick }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: Array.from({ length: MAX_POINTS }, (_, i) => i),
        datasets: [{
          label: "EEG",
          data: eegBufferRef ? eegBufferRef.current : new Array(MAX_POINTS).fill(0),
          borderColor: "#22d3ee",
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
          fill: { target: "origin", above: "rgba(34, 211, 238, 0.06)" },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { display: false },
          y: {
            display: true,
            grid: { color: "rgba(100,160,230,0.1)" },
            ticks: { color: "#6a9bbf", font: { family: "Inter", size: 10 } },
          },
        },
        plugins: { legend: { display: false } },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, []);

  // Update chart data whenever eegTick changes (without re-mounting)
  useEffect(() => {
    if (!chartRef.current || !eegBufferRef) return;
    chartRef.current.data.datasets[0].data = eegBufferRef.current;
    chartRef.current.update("none");
  }, [eegTick, eegBufferRef]);

  return (
    <section className="panel glass chart-panel fade-in-up" style={{ "--delay": "0.4s" }}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Live EEG Waveform</h2>
          <p className="panel-sub">Last 200 sample points</p>
        </div>
        <span className="pulse-dot-green" />
      </div>
      <div className="chart-wrap">
        <canvas id="eegChart" ref={canvasRef} />
      </div>
    </section>
  );
}
