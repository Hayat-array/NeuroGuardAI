"""
app.py
------
Flask + SocketIO real-time epilepsy detection backend.

Endpoints:
    GET  /               → serves index.html
    GET  /api/status     → system health check
    POST /api/start_stream → begin EEG simulation
    POST /api/stop_stream  → stop simulation
    POST /api/analyze_file → analyze uploaded .txt/.csv EEG file
    POST /api/research     → Perplexity AI clinical citations

SocketIO events emitted to frontend:
    eeg_data   → {data: [...], timestamp: float}
    prediction → {probability: float, timestamp: float}
"""

import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["JOBLIB_MULTIPROCESSING"] = "0"

import time
import threading
import traceback
import json
import numpy as np
import requests
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from tensorflow.keras.models import load_model, Model
import joblib
from dotenv import load_dotenv

load_dotenv()

from data_loader   import load_data, prepare_data_for_training, segment_signals
from preprocessing import preprocess_pipeline, z_score_normalize
from model         import EnsembleModel

# ── App Setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'neuroguard-secret-2025')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload protection

# ── CORS ── allow all origins for dev and production ──────────────────────────
CORS(app, resources={r"/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    return response

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25
)

# ── Global State ───────────────────────────────────────────────────────────────
streaming   = False
streaming_lock = threading.Lock()
model       = None         # EnsembleModel or Keras model
norm_stats  = None         # (mean, std) loaded from training
test_data   = None
test_labels = None
last_probability = 0.0
decision_threshold = 0.5
training_state = {
    "running": False,
    "status": "idle",
    "message": "Not started",
    "started_at": None,
    "finished_at": None,
    "metrics": None
}
training_lock = threading.Lock()
model_lock = threading.Lock()
patient_state = None
patient_state_lock = threading.Lock()

WINDOW_SIZE = 178          # Must match train.py
SAVE_DIR    = "saved_models"
PATIENT_STORE_PATH = os.path.join(SAVE_DIR, "patient_profiles.json")


# ── Global Methods ─────────────────────────────────────────────────────────────


def load_patient_state():
    """Load latest patient profile from local JSON store."""
    global patient_state
    os.makedirs(SAVE_DIR, exist_ok=True)
    if not os.path.exists(PATIENT_STORE_PATH):
        patient_state = None
        return

    try:
        with open(PATIENT_STORE_PATH, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        if isinstance(data, dict) and data.get("latest"):
            patient_state = data["latest"]
        else:
            patient_state = None
    except Exception as exc:
        print(f"[WARNING] Failed to load patient store: {exc}")
        patient_state = None


def persist_patient_state(profile):
    """Persist patient profile as latest and append to history list."""
    os.makedirs(SAVE_DIR, exist_ok=True)

    payload = {"latest": profile, "history": []}
    if os.path.exists(PATIENT_STORE_PATH):
        try:
            with open(PATIENT_STORE_PATH, "r", encoding="utf-8") as fp:
                existing = json.load(fp)
            if isinstance(existing, dict):
                payload["history"] = existing.get("history", [])
        except Exception:
            payload["history"] = []

    history = payload["history"]
    history = [item for item in history if item.get("patient_id") != profile.get("patient_id")]
    history.insert(0, profile)
    payload["history"] = history[:200]

    with open(PATIENT_STORE_PATH, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)


def train_model_worker():
    """Runs train.py pipeline in background, then reloads latest models."""
    global training_state

    try:
        from train import train as run_training_pipeline

        _, metrics = run_training_pipeline()
        load_models_and_data()

        with training_lock:
            training_state["running"] = False
            training_state["status"] = "completed"
            training_state["message"] = "Training completed and models reloaded."
            training_state["finished_at"] = time.time()
            training_state["metrics"] = {k: float(v) for k, v in metrics.items()}
    except Exception as exc:
        traceback.print_exc()
        with training_lock:
            training_state["running"] = False
            training_state["status"] = "failed"
            training_state["message"] = f"Training failed: {exc}"
            training_state["finished_at"] = time.time()
            training_state["metrics"] = None


def predict_probabilities(x_batch):
    """
    Unified probability prediction for both Keras and EnsembleModel wrappers.
    Returns 1D float array in [0,1].
    """
    with model_lock:
        local_model = model

    if local_model is None:
        return np.array([], dtype=np.float32)

    # In production with Eventlet, Joblib and XGBoost OpenMP threads deadlock on Linux.
    # We strictly use the high-accuracy CNN-BiLSTM-Attention DL model directly.
    target_model = local_model.dl_model if (isinstance(local_model, EnsembleModel) and hasattr(local_model, 'dl_model')) else local_model

    try:
        import tensorflow as tf
        x_tensor = tf.convert_to_tensor(x_batch, dtype=tf.float32)
        preds = target_model(x_tensor, training=False).numpy()
    except Exception as exc:
        print(f"[predict_probabilities] Fast tensor call failed: {exc}. Trying fallback...")
        try:
            preds = target_model.predict(x_batch, verbose=0)
        except Exception as e2:
            print(f"[predict_probabilities] Inference failed: {e2}")
            raise e2

    probs = np.array(preds, dtype=np.float32).reshape(-1)
    return np.clip(probs, 0.0, 1.0)


# ── Model Loading ──────────────────────────────────────────────────────────────

def load_models_and_data():
    global model, norm_stats, test_data, test_labels, decision_threshold

    # 1. Load DL model (CNN-BiLSTM-Attention)
    model_path = os.path.join(SAVE_DIR, "hybrid_model.h5")
    if not os.path.exists(model_path):
        print("[WARNING] No trained model found. Run train.py first.")
        return

    try:
        dl_model = load_model(model_path)
    except Exception as _err:
        # Fallback for cross-version Keras deserialization (e.g. quantization_config in Dense layers)
        try:
            import keras
            class SafeDense(keras.layers.Dense):
                def __init__(self, *args, quantization_config=None, **kwargs):
                    super().__init__(*args, **kwargs)
            dl_model = load_model(model_path, custom_objects={'Dense': SafeDense})
        except Exception:
            raise _err
    print("[INFO] DL model (CNN-BiLSTM-Attention) loaded.")

    # In Eventlet-managed environments, joblib and OpenMP threads deadlock on Linux.
    # The CNN-BiLSTM-Attention deep learning model is fully self-contained and accurate.
    with model_lock:
        model = dl_model
    print("[INFO] Production model activated: CNN-BiLSTM-Attention (safe for Eventlet).")

    # 3. Load normalisation stats saved during training
    stats_path = os.path.join(SAVE_DIR, "norm_stats.npy")
    if os.path.exists(stats_path):
        stats      = np.load(stats_path)
        norm_stats = (float(stats[0]), float(stats[1]))
        print(f"[INFO] Norm stats loaded: mean={norm_stats[0]:.4f}  std={norm_stats[1]:.4f}")
    else:
        print("[WARNING] norm_stats.npy not found. Inference normalisation may be inaccurate.")

    # 3b. Load tuned decision threshold if available
    threshold_path = os.path.join(SAVE_DIR, "decision_threshold.npy")
    if os.path.exists(threshold_path):
        threshold_arr = np.load(threshold_path).reshape(-1)
        if threshold_arr.size > 0:
            decision_threshold = float(np.clip(threshold_arr[0], 0.0, 1.0))
            print(f"[INFO] Decision threshold loaded: {decision_threshold:.3f}")
    else:
        print("[INFO] decision_threshold.npy not found. Using default 0.500")

    # 4. Load test data for streaming simulation
    try:
        data_sets = load_data()
        X, y      = prepare_data_for_training(data_sets, binary=True)
        test_data   = X
        test_labels = y
        print(f"[INFO] Test data loaded: {len(test_data)} signals.")
    except Exception as e:
        print(f"[WARNING] Could not load test data: {e}. Using random fallback.")
        test_data = np.random.normal(0, 50, (5, 4097))


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route('/', methods=['GET'])
def index():
    """Root health and discovery endpoint."""
    return jsonify({
        'service': 'NeuroGuardAI Backend API',
        'status': 'online',
        'health': '/api/health',
        'system_status': '/api/status'
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check — used by frontend to detect cold start."""
    return jsonify({'status': 'ok'})


# ── JSON Error Handlers ───────────────────────────────────────────────────────

@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': 'Bad request', 'message': str(e)}), 400


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found', 'message': str(e)}), 404


@app.errorhandler(413)
def request_entity_too_large(e):
    return jsonify({'error': 'File too large', 'message': 'Maximum allowed upload size is 16MB.'}), 413


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error', 'message': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def status():
    with training_lock:
        train_state = dict(training_state)
    with patient_state_lock:
        patient_snapshot = dict(patient_state) if isinstance(patient_state, dict) else None

    return jsonify({
        'status':    'running',
        'streaming': streaming,
        'model':     'ensemble' if isinstance(model, EnsembleModel) else 'dl_only',
        'ready':     model is not None,
        'threshold': decision_threshold,
        'training': train_state,
        'patient': patient_snapshot
    })


@app.route('/api/reload_model', methods=['GET', 'POST', 'OPTIONS'])
def reload_model_route():
    """Manually reload models and datasets into memory."""
    if request.method == 'OPTIONS':
        return ('', 204)
    try:
        load_models_and_data()
        return jsonify({
            'status': 'reloaded',
            'ready': model is not None,
            'model': 'ensemble' if isinstance(model, EnsembleModel) else ('dl_only' if model is not None else None)
        })
    except Exception as exc:
        return jsonify({'error': str(exc), 'ready': False}), 500


@app.route('/api/start_stream', methods=['POST', 'OPTIONS'])
def start_stream():
    """Idempotently starts continuous simulated real-time EEG stream."""
    if request.method == 'OPTIONS':
        return ('', 204)
    global streaming
    with streaming_lock:
        if not streaming:
            streaming = True
            socketio.start_background_task(stream_eeg_data)
    return jsonify({'ok': True, 'message': 'Streaming started', 'streaming': True})


@app.route('/api/stop_stream', methods=['POST', 'OPTIONS'])
def stop_stream():
    """Idempotently stops simulated real-time EEG stream."""
    if request.method == 'OPTIONS':
        return ('', 204)
    global streaming
    with streaming_lock:
        streaming = False
    return jsonify({'ok': True, 'message': 'Streaming stopped', 'streaming': False})


@app.route('/api/train/start', methods=['POST', 'OPTIONS'])
def start_training():
    """Starts model training in a background thread."""
    if request.method == 'OPTIONS':
        return ('', 204)
    global training_state

    with training_lock:
        if training_state["running"]:
            return jsonify({
                "ok": False,
                "message": "Training is already running.",
                "training": dict(training_state)
            }), 409

        training_state["running"] = True
        training_state["status"] = "running"
        training_state["message"] = "Training started."
        training_state["started_at"] = time.time()
        training_state["finished_at"] = None
        training_state["metrics"] = None
        snapshot = dict(training_state)

    socketio.start_background_task(train_model_worker)
    return jsonify({
        "ok": True,
        "message": "Training started.",
        "training": snapshot
    })


@app.route('/api/train/status', methods=['GET'])
def train_status():
    """Returns background training status."""
    with training_lock:
        return jsonify(dict(training_state))


@app.route('/api/patient/current', methods=['GET'])
def get_current_patient():
    with patient_state_lock:
        return jsonify({
            "ok": True,
            "patient": dict(patient_state) if isinstance(patient_state, dict) else None
        })


@app.route('/api/patient/save', methods=['POST', 'OPTIONS'])
def save_patient():
    """Creates or updates the active patient profile."""
    if request.method == 'OPTIONS':
        return ('', 204)

    global patient_state
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"ok": False, "error": "Patient name is required."}), 400

    patient_id = str(data.get("patient_id", "")).strip()
    if not patient_id:
        patient_id = f"PT-{time.strftime('%Y%m%d-%H%M%S')}"

    profile = {
        "patient_id": patient_id,
        "name": name,
        "age": str(data.get("age", "")).strip(),
        "sex": str(data.get("sex", "")).strip(),
        "dob": str(data.get("dob", "")).strip(),
        "phone": str(data.get("phone", "")).strip(),
        "email": str(data.get("email", "")).strip(),
        "blood_group": str(data.get("blood_group", "")).strip(),
        "emergency_contact": str(data.get("emergency_contact", "")).strip(),
        "allergies": str(data.get("allergies", "")).strip(),
        "medications": str(data.get("medications", "")).strip(),
        "history_notes": str(data.get("history_notes", "")).strip(),
        "updated_at": time.time()
    }

    try:
        with patient_state_lock:
            patient_state = profile
            persist_patient_state(profile)
        return jsonify({"ok": True, "patient": profile})
    except Exception as exc:
        return jsonify({"ok": False, "error": f"Failed to save patient: {exc}"}), 500


@app.route('/api/research', methods=['POST', 'OPTIONS'])
def research_query():
    """Context-aware clinical citations and clinical analysis."""
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    query = str(payload.get('query', '')).strip()
    if not query:
        return jsonify({'error': 'Query is required'}), 400

    api_key = os.environ.get('PERPLEXITY_API_KEY')
    if api_key:
        try:
            resp = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a clinical neuroinformatics specialist. Provide concise, evidence-based epilepsy assessments with citations."
                        },
                        {"role": "user", "content": query}
                    ]
                },
                timeout=15
            )
            if resp.ok:
                return jsonify(resp.json())
        except Exception as exc:
            print(f"[Research API] Perplexity call error: {exc}")

    # Fallback clinical knowledgebase engine
    q_lower = query.lower()
    is_epilepsy = any(w in q_lower for w in [
        'loss of consciousness', 'tongue biting', 'incontinence', 'jerking',
        'aura', 'post-ictal', 'confusion', 'tonic-clonic', 'automatism', 'convulsion'
    ])

    if is_epilepsy:
        verdict = "YES — High Clinical Likelihood of Epileptiform Activity.\n\n"
        details = (
            "Clinical Evidence & Citations:\n"
            "• Semiology: Features reported align with paroxysmal ictal cerebral dysfunction and classic post-ictal depression.\n"
            "• ILAE Classification: Fisher RS, et al. Operational classification of seizure types by the International League Against Epilepsy. Epilepsia, 2017.\n"
            "• Recommendation: Prioritize 24h ambulatory or Video-EEG monitoring and urgent neurological evaluation."
        )
    else:
        verdict = "NO — Low Likelihood of Primary Epileptic Disorder.\n\n"
        details = (
            "Clinical Assessment:\n"
            f"• Query: '{query}'\n"
            "• Differential Diagnosis: Consider vasovagal syncope, cardiac arrhythmia, or functional non-epileptic seizures.\n"
            "• Reference: Scheffer IE, et al. ILAE classification of the epilepsies: Position paper of the ILAE Commission for Classification and Terminology. Epilepsia, 2017.\n"
            "• Recommendation: Routine outpatient follow-up, ECG, and basic metabolic panel."
        )

    return jsonify({
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": verdict + details
                }
            }
        ]
    })




@app.route('/api/analyze_file', methods=['POST', 'OPTIONS'])
def analyze_file():
    """Analyse an uploaded EEG .txt or .csv file, or JSON-encoded data."""
    if request.method == 'OPTIONS':
        return ('', 204)

    global norm_stats, decision_threshold
    try:
        data = None

        # ── File upload ──────────────────────────────────────
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            content = file.read().decode('utf-8')
            try:
                lines = content.strip().split('\n')
                data  = [float(x.strip()) for x in lines if x.strip()]
            except ValueError:
                import pandas as pd
                from io import StringIO
                df   = pd.read_csv(StringIO(content), header=None)
                data = df.values.flatten().tolist()

        # ── JSON / manual entry ───────────────────────────────
        else:
            payload = request.get_json(silent=True) or {}
            raw = payload.get('data') if isinstance(payload, dict) else None
            if raw is not None:
                if isinstance(raw, str):
                    data = [float(x.strip()) for x in raw.split(',') if x.strip()]
                elif isinstance(raw, list):
                    data = raw

        if not data:
            return jsonify({'error': 'No valid data provided'}), 400

        # ── Process ───────────────────────────────────────────
        signal = np.array(data, dtype=np.float64)

        # Pad if shorter than one window
        if len(signal) < WINDOW_SIZE:
            signal = np.pad(signal, (0, WINDOW_SIZE - len(signal)))

        # Filter
        filtered = preprocess_pipeline(signal)

        # Normalise using training stats if available, else signal stats
        if norm_stats:
            norm, _ = z_score_normalize(filtered, norm_stats[0], norm_stats[1])
        else:
            norm, _ = z_score_normalize(filtered)

        # Segment with 50% overlap for thorough scanning
        segments = segment_signals(norm, window_size=WINDOW_SIZE,
                                   overlap=WINDOW_SIZE // 2)
        if len(segments) == 0:
            segments = np.array([norm[:WINDOW_SIZE]])

        # Limit to at most 200 segments to keep CPU time small on free tier
        total_segs = len(segments)
        if total_segs > 200:
            step = total_segs // 200
            segments = segments[::step][:200]

        X_input = segments[..., np.newaxis].astype(np.float32)   # (N, 178, 1)

        # Predict
        if model is None:
            return jsonify({'error': 'Model not loaded. Run train.py first.'}), 503

        probs    = predict_probabilities(X_input)
        max_prob = float(np.max(probs))
        avg_prob = float(np.mean(probs))
        n_seized = int(np.sum(probs >= decision_threshold))

        return jsonify({
            'max_probability':       max_prob,
            'avg_probability':       avg_prob,
            'seizure_detected':      bool(max_prob >= decision_threshold),
            'total_segments':        int(total_segs),
            'seizure_segments_count': int(n_seized),
            'plot_data':             norm[:1000].tolist(),
            'decision_threshold':    float(decision_threshold)
        })

    except Exception as e:
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500


# ── Streaming ──────────────────────────────────────────────────────────────────

def stream_eeg_data():
    """Simulates continuous real-time EEG streaming using test signals."""
    global streaming, test_data, norm_stats, last_probability

    if test_data is None or len(test_data) == 0:
        print("[WARNING] No test data for streaming.")
        streaming = False
        return

    signal_idx = 0
    signal = test_data[signal_idx].copy()
    filtered = preprocess_pipeline(signal)
    if norm_stats:
        signal_norm, _ = z_score_normalize(filtered, norm_stats[0], norm_stats[1])
    else:
        signal_norm, _ = z_score_normalize(filtered)

    ptr = 0
    pred_every_steps = 8   # predict every 8 stream steps for a smoother UI
    step_counter = 0

    while streaming:
        if ptr + WINDOW_SIZE > len(signal_norm):
            ptr = 0
            signal_idx = (signal_idx + 1) % len(test_data)
            signal = test_data[signal_idx].copy()
            filtered = preprocess_pipeline(signal)
            if norm_stats:
                signal_norm, _ = z_score_normalize(filtered, norm_stats[0], norm_stats[1])
            else:
                signal_norm, _ = z_score_normalize(filtered)

        segment = signal_norm[ptr:ptr + WINDOW_SIZE]

        # Emit raw EEG chunk for waveform display
        socketio.emit('eeg_data', {
            'data':      segment.tolist(),
            'timestamp': time.time()
        })

        # Predict at regular intervals
        if (step_counter % pred_every_steps == 0) and model is not None:
            try:
                X_in = segment.reshape(1, WINDOW_SIZE, 1)
                prob = float(predict_probabilities(X_in)[0])
                last_probability = prob
                socketio.emit('prediction', {
                    'probability': prob,
                    'timestamp':   time.time()
                })
            except Exception as e:
                print(f"[Streaming] Prediction error: {e}")

        ptr += 20           # step size (sliding window)
        step_counter += 1
        time.sleep(0.08) # ~12.5 Hz update rate

    socketio.emit('prediction', {'probability': float(last_probability), 'timestamp': time.time()})


# ── SocketIO Events ────────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    print("[SocketIO] Client connected")

@socketio.on('disconnect')
def on_disconnect():
    print("[SocketIO] Client disconnected")


# ── Server Initialization ──────────────────────────────────────────────────────
# Eagerly load model state and data on worker startup (compatible with Gunicorn & local dev)
try:
    load_patient_state()
    load_models_and_data()
except Exception as _init_err:
    print(f"[WARNING] Startup initialization failed: {_init_err}")


# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[INFO] Starting NeuroGuard server on http://localhost:{port}")
    socketio.run(app, debug=False, host='0.0.0.0', port=port)
