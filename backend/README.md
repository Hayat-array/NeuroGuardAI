# NeuroGuardAI — Backend

Flask + SocketIO REST API for real-time EEG epilepsy detection using a CNN-BiLSTM-Attention + Random Forest + XGBoost ensemble.

## Stack
- **Flask** + **Flask-SocketIO** (eventlet) — HTTP + WebSocket server
- **TensorFlow / Keras** — CNN-BiLSTM-Attention deep learning model
- **scikit-learn** + **XGBoost** — ensemble classifiers
- **gunicorn** (eventlet worker) — production WSGI server

## Local Setup

```bash
cd backend

# Create and activate virtual environment (already done: .venv)
python -m venv .venv
.venv\Scripts\activate   # Windows
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run (development)
python app.py
```

Server starts at http://localhost:5000

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check — {"status": "ok"} |
| GET | /api/status | System status, model info, patient snapshot |
| POST | /api/start_stream | Start real-time EEG simulation |
| POST | /api/stop_stream | Stop streaming |
| POST | /api/train/start | Start background model training |
| GET | /api/train/status | Get training progress |
| GET | /api/patient/current | Get current patient profile |
| POST | /api/patient/save | Create/update patient profile |
| POST | /api/analyze_file | Analyze EEG file or manual data |

## SocketIO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| eeg_data | server ? client | `{data: [...], timestamp: float}` |
| prediction | server ? client | `{probability: float, timestamp: float}` |

## ML Models

Model files live in `saved_models/`:
- `hybrid_model.h5` — CNN-BiLSTM-Attention (~4.4 MB)
- `rf_model.pkl` — Random Forest (~1.7 MB)
- `xgb_model.pkl` — XGBoost (~160 KB)
- `norm_stats.npy` — Training normalization statistics

> **Note**: If model files exceed 500 MB, add to `.gitignore` and download separately.

## Production (Render)

```bash
gunicorn --worker-class eventlet -w 1 app:app -c gunicorn.conf.py
```

**Important**: Only 1 worker (`-w 1`) is allowed with eventlet SocketIO (in-memory state cannot be shared across processes).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5000 | Server port (set by Render automatically) |
| FRONTEND_URL | http://localhost:5173 | Allowed CORS origin |
| SECRET_KEY | neuroguard-secret-2025 | Flask session secret |
