# NeuroGuardAI � Backend

Flask + SocketIO REST API for real-time EEG epilepsy detection using a CNN-BiLSTM-Attention + Random Forest + XGBoost ensemble.

## Stack
- **Flask** + **Flask-SocketIO** (eventlet) � HTTP + WebSocket server
- **TensorFlow / Keras** � CNN-BiLSTM-Attention deep learning model
- **scikit-learn** + **XGBoost** � ensemble classifiers
- **gunicorn** (eventlet worker) � production WSGI server

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
| GET | /api/health | Health check � {"status": "ok"} |
| GET | /api/status | System status and model info |
| POST | /api/start_stream | Start real-time EEG simulation |
| POST | /api/stop_stream | Stop streaming |
| POST | /api/train/start | Start background model training |
| GET | /api/train/status | Get training progress |
| GET | /api/auth/config | Return the public Supabase URL and publishable key |
| GET | /api/patient/current | Get the signed-in user's profile (Supabase bearer token required) |
| POST | /api/patient/save | Create/update the signed-in user's profile (Supabase bearer token required) |
| POST | /api/analyze_file | Analyze EEG file or manual data |

## SocketIO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| eeg_data | server ? client | `{data: [...], timestamp: float}` |
| prediction | server ? client | `{probability: float, timestamp: float}` |

## ML Models

Model files live in `saved_models/`:
- `hybrid_model.h5` � CNN-BiLSTM-Attention (~4.4 MB)
- `rf_model.pkl` � Random Forest (~1.7 MB)
- `xgb_model.pkl` � XGBoost (~160 KB)
- `norm_stats.npy` � Training normalization statistics

> **Note**: If model files exceed 500 MB, add to `.gitignore` and download separately.

## Automated checks

From the repository root, run `python -m unittest discover -s backend/tests -v` and `python -m compileall -q backend`. The patient-route tests use a Flask test client and mock Supabase Auth/PostgREST requests; they verify anonymous requests are denied, route queries are scoped to the verified token subject, and client-supplied user IDs cannot select another account.

## Production (Render)

```bash
gunicorn --worker-class eventlet -w 1 app:app -c gunicorn.conf.py
```

**Important**: Only 1 worker (`-w 1`) is allowed with eventlet SocketIO (in-memory state cannot be shared across processes).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5000 | Server port (set by Render automatically) |
| FRONTEND_URL | — | Exact allowed frontend origin; configure it in Render and locally in `.env` |
| CORS_ALLOWED_ORIGINS | — | Optional comma-separated exact origins when more than one frontend origin is needed |
| SECRET_KEY | — | Required in production; generate a fresh random value and set it as a Render secret |
| SUPABASE_URL | — | Supabase project URL, supplied to Render as a server environment variable |
| SUPABASE_PUBLISHABLE_KEY | — | Public Supabase publishable key; server-side requests forward the signed-in user's JWT and rely on RLS |

Never configure the service-role key in the browser or use it for patient profile requests. Set the frontend's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel. Supabase email confirmation must be enabled/configured for the app's deployed redirect URL. The patient profile schema and user-only RLS policies are versioned under `supabase/migrations/`.
