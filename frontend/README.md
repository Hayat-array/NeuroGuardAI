# NeuroGuardAI — Frontend

React + Vite SPA for real-time EEG epilepsy detection. Connects to the Flask backend via REST API and Socket.IO WebSocket.

## Stack
- **React 18** + **Vite** — SPA framework
- **socket.io-client** — real-time SocketIO connection to Flask backend
- **Chart.js** — live EEG waveform chart
- **Three.js** — 3D particle brain visualization

## Local Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: set VITE_API_URL=http://localhost:5000

# Run development server
npm run dev
```

App starts at http://localhost:5173

## Environment Variables

| Variable | Local | Production |
|----------|-------|------------|
| VITE_API_URL | http://localhost:5000 | https://neuroguardai-backend.onrender.com |

- `.env` → local development (NOT committed to git)
- `.env.production` → used by `npm run build` (for Vercel deploy)
- Set `VITE_API_URL` in Vercel dashboard settings too

## Vercel Deployment

1. Push code to GitHub
2. Import repo into Vercel
3. Set framework: **Vite**
4. Set environment variable: `VITE_API_URL=https://neuroguardai-backend.onrender.com`
5. Deploy — Vercel auto-runs `npm run build`, output from `dist/`

## Project Structure

```
src/
├── main.jsx              Entry point
├── App.jsx               Root: SocketIO + cold-start detection
├── assets/style.css      All CSS (copied from original)
├── services/api.js       All API calls (BASE_URL from env)
├── hooks/
│   ├── useSocketIO.js    SocketIO connection + EEG buffer
│   └── usePrediction.js  File/manual EEG analysis
└── components/
    ├── Header.jsx
    ├── BrainVisualization.jsx   Three.js particle brain
    ├── StreamControls.jsx
    ├── ModelTraining.jsx
    ├── AnalyzeEEG.jsx
    ├── ProbabilityGauge.jsx
    ├── EEGChart.jsx
    ├── PatientDossier.jsx
    ├── SeizureOverlay.jsx
    └── ResearchPanel.jsx  + Clinical History Modal
