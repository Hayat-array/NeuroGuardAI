# import eventlet
# eventlet.monkey_patch()

# import os
# import time
# import threading
# import numpy as np
# import requests
# from flask import Flask, jsonify, request
# from flask_socketio import SocketIO, emit
# from tensorflow.keras.models import load_model, Model
# import joblib

# from data_loader import load_data, prepare_data_for_training, segment_signals
# from preprocessing import preprocess_pipeline, z_score_normalize
# from model import EnsembleModel

# # Serve static files from 'static' folder
# app = Flask(__name__, static_url_path='', static_folder='static')
# app.config['SECRET_KEY'] = 'secret!'
# socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# # Global variables
# streaming = False
# model = None
# ensemble = None
# test_data = None
# test_labels = None
# current_index = 0

# # Perplexity API Configuration
# PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")
# PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

# def load_models_and_data():
#     global model, ensemble, test_data, test_labels
#     try:
#         # Load DL Model
#         model_path = os.path.join("saved_models", "hybrid_model.h5")
#         if os.path.exists(model_path):
#             dl_model = load_model(model_path)
            
#             # Try Loading Ensemble if available
#             rf_path = os.path.join("saved_models", "rf_model.pkl")
#             xgb_path = os.path.join("saved_models", "xgb_model.pkl")
            
#             if os.path.exists(rf_path) and os.path.exists(xgb_path):
#                 try:
#                     rf = joblib.load(rf_path)
#                     xgb = joblib.load(xgb_path)
                    
#                     ensemble = EnsembleModel(dl_model)
#                     ensemble.rf = rf
#                     ensemble.xgb = xgb
                    
#                     model = ensemble
#                     print("Ensemble Models loaded successfully.")
#                 except Exception as e:
#                     print(f"Error loading ensemble: {e}. Using Hybrid Model only.")
#                     model = dl_model
#             else:
#                 print("Ensemble models not found (Training in progress?). Using Hybrid Model only.")
#                 model = dl_model

#         else:
#             print("Models not found. Please train first.")
            
#         # Load Test Data for Streaming Simulation
#         # In a real app, this would be live data from an EEG headset
#         try:
#             from data_loader import load_data, prepare_data_for_training
#             data_sets = load_data()
#             if data_sets:
#                 # Need to replicate preprocessing logic exactly
#                 # But data_loader's prepare function expects a dict of lists
#                 # Let's just load one file directly if load_data returns valid structure
#                 # Or use proper pipeline
#                 X, y = prepare_data_for_training(data_sets, binary=True)
#                 test_data = X
#                 test_labels = y
#                 print(f"Loaded {len(test_data)} test signals.")
#             else:
#                 print("No data found in Dataset_of_Eplipsy.")
#         except Exception as e:
#              print(f"Error loading test data: {e}")
#              # Fallback to random data for pure UI demo
#              test_data = [np.random.normal(0, 1, 4097) for _ in range(5)]
        
#     except Exception as e:
#         print(f"Error loading models/data: {e}")

# @app.route('/')
# def index():
#     return app.send_static_file('index.html')

# @app.route('/api/status', methods=['GET'])
# def status():
#     return jsonify({'status': 'running', 'streaming': streaming})

# @app.route('/api/start_stream', methods=['POST'])
# def start_stream():
#     global streaming
#     if not streaming:
#         streaming = True
#         threading.Thread(target=stream_eeg_data).start()
#     return jsonify({'message': 'Streaming started'})

# @app.route('/api/stop_stream', methods=['POST'])
# def stop_stream():
#     global streaming
#     streaming = False
#     return jsonify({'message': 'Streaming stopped'})

# @app.route('/api/research', methods=['POST'])
# def research_citations():
#     """
#     Fetches research citations from Perplexity API based on detected patterns.
#     """
#     data = request.json
#     query = data.get('query', 'Latest research on epilepsy seizure prediction 2024-2026')
    
#     headers = {
#         "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
#         "Content-Type": "application/json"
#     }
    
#     payload = {
#         "model": "sonar-pro",
#         "messages": [
#             {"role": "system", "content": "You are a medical research assistant. Provide citations for epilepsy research."},
#             {"role": "user", "content": query}
#         ]
#     }
    
#     try:
#         # response = requests.post(PERPLEXITY_URL, json=payload, headers=headers)
#         # result = response.json()
#         # return jsonify(result)
        
#         # Mock response for demo if no API key
#         return jsonify({
#             "choices": [{
#                 "message": {
#                     "content": "Recent studies in 2025 have shown that hybrid CNN-LSTM models achieve over 99% accuracy on the Bonn dataset. Key citations include: \n1. Smith et al. (2025) 'Advanced EEG Analysis using Deep Learning'.\n2. Johnson et al. (2024) 'Real-time Seizure Prediction'."
#                 }
#             }]
#         })
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

#     except Exception as e:
#         return jsonify({'error': str(e)}), 500

# @app.route('/api/analyze_file', methods=['POST'])
# def analyze_file():
#     """
#     Analyzes uploaded EEG data (TXT/CSV) or manual entry.
#     """
#     try:
#         data = None
        
#         # 1. Check for File Upload
#         if 'file' in request.files:
#             file = request.files['file']
#             if file.filename == '':
#                 return jsonify({'error': 'No selected file'}), 400
            
#             # Read file content
#             content = file.read().decode('utf-8')
            
#             # Parse based on extension or content
#             # Assuming Bonn format (single column TXT) or CSV
#             try:
#                 # Try parsing as float per line
#                 lines = content.strip().split('\n')
#                 data = [float(x.strip()) for x in lines if x.strip()]
#             except ValueError:
#                 # Try parsing as CSV (comma packed)
#                 import pandas as pd
#                 from io import StringIO
#                 df = pd.read_csv(StringIO(content), header=None)
#                 data = df.values.flatten().tolist()
                
#         # 2. Check for Manual Entry (JSON)
#         elif request.json and 'data' in request.json:
#             raw_input = request.json['data']
#             if isinstance(raw_input, str):
#                 # Comma separated string
#                 data = [float(x.strip()) for x in raw_input.split(',') if x.strip()]
#             elif isinstance(raw_input, list):
#                 data = raw_input
                
#         if data is None or len(data) == 0:
#             return jsonify({'error': 'No valid data provided'}), 400
            
#         # 3. Process Data
#         signal_array = np.array(data)
        
#         # Need at least one window (174 points)
#         WINDOW_SIZE = 174
#         if len(signal_array) < WINDOW_SIZE:
#              # Pad if too short
#              signal_array = np.pad(signal_array, (0, WINDOW_SIZE - len(signal_array)), 'constant')
             
#         # Preprocessing & Segmentation
#         # For simplicity, we'll slide over the whole file and return the MAX probability
#         # indicating if a seizure was detected anywhere in the file.
        
#         # Preprocess entire signal first (Filter)
#         # Note: In real setup, normalization params should come from training set.
#         # Here we use the function's default or we should load saved stats.
#         # For now, using signal's own stats if training stats not available
#         # But wait, z-score normalize returns (norm_data, stats).
        
#         # Let's use the robust pipeline if possible.
#         # Ideally: filtered = preprocess_pipeline(signal_array)
#         #          norm, _ = z_score_normalize(filtered)
        
#         filtered = preprocess_pipeline(signal_array)
#         norm_signal, _ = z_score_normalize(filtered) # Zero-mean unit-variance
        
#         # Segment
#         # segment_signals now handles 1D array correctly if passed as X, 
#         # but let's be explicit and pass X=[norm_signal] just in case or rely on its internal check.
#         # It returns just segments if y is not passed.
#         segments = segment_signals([norm_signal], window_size=WINDOW_SIZE, overlap=87) # 50% overlap
        
#         if len(segments) == 0:
#             # Fallback for single segment
#             segments = [norm_signal[:WINDOW_SIZE]]
            
#         segments = np.array(segments)
#         # Reshape for model: (Batch, 174, 1)
#         X_input = segments.reshape(segments.shape[0], WINDOW_SIZE, 1)
        
#         # Predict
#         if model:
#             preds = model.predict(X_input, verbose=0)
#             # preds is likely (N, 1)
#             probabilities = preds.flatten()
            
#             # Aggregate Results
#             max_prob = float(np.max(probabilities))
#             avg_prob = float(np.mean(probabilities))
            
#             # Detect Seizure sites (indices where prob > 0.5)
#             seizure_indices = np.where(probabilities > 0.5)[0].tolist()
            
#             return jsonify({
#                 'max_probability': max_prob,
#                 'avg_probability': avg_prob,
#                 'seizure_detected': max_prob > 0.5,
#                 'total_segments': len(segments),
#                 'seizure_segments_count': len(seizure_indices),
#                 'plot_data': norm_signal[:1000].tolist() # Return first 1000 pts for preview
#             })
#         else:
#             return jsonify({'error': 'Model not loaded'}), 503
            
#     except Exception as e:
#         return jsonify({'error': f"Processing failed: {str(e)}"}), 500

# def stream_eeg_data():
#     global current_index, streaming, test_data
    
#     # Simulate streaming window by window
#     # Window size 174
#     window_size = 174
    
#     if test_data is None:
#         print("No test data to stream.")
#         return

#     signal = test_data[0] # Stream the first signal for demo
    
#     ptr = 0
#     while streaming and ptr + window_size <= len(signal):
#         segment = signal[ptr:ptr+window_size]
        
#         # Preprocess
#         # filtered = preprocess_pipeline(segment) # Might need to adjust for single window
#         # norm, _ = z_score_normalize(filtered) # Use pre-calculated stats in real app
        
#         # Emit raw data for frontend visualization
#         socketio.emit('eeg_data', {'data': segment.tolist(), 'timestamp': time.time()})
        
#         # Model Prediction
#         if ptr % (window_size * 5) == 0: # Predict every 5 seconds equivalent
#             if model:
#                 try:
#                     # Reshape for model (Batch, Time, Channels)
#                     input_seg = segment.reshape(1, window_size, 1)
                    
#                     # Predict
#                     # verbose=0 to prevent clutter in logs
#                     prob = model.predict(input_seg, verbose=0)[0][0]
                    
#                     socketio.emit('prediction', {'probability': float(prob), 'timestamp': time.time()})
#                 except Exception as e:
#                     print(f"Prediction Error: {e}")
#                     # Fallback if prediction fails
#                     socketio.emit('prediction', {'probability': 0.0, 'timestamp': time.time()})
#             else:
#                  print("Model not loaded, prediction skipped.")
        
#         ptr += 20 # Step size for streaming speed
#         time.sleep(0.05) # Control stream rate
        
# if __name__ == '__main__':
#     load_models_and_data()
#     socketio.run(app, debug=True, port=5000)
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

import eventlet
eventlet.monkey_patch()

import os
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

# ── CORS ── allow all origins for dev and production ──────────────────────────
CORS(app, resources={r"/*": {"origins": "*"}})

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet'
)

# ── Global State ───────────────────────────────────────────────────────────────
streaming   = False
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

    # EnsembleModel does not accept verbose kwarg; Keras model does.
    if isinstance(local_model, EnsembleModel):
        probs = local_model.predict(x_batch)
    else:
        probs = local_model.predict(x_batch, verbose=0)

    probs = np.array(probs, dtype=np.float32).reshape(-1)
    return np.clip(probs, 0.0, 1.0)


# ── Model Loading ──────────────────────────────────────────────────────────────

def load_models_and_data():
    global model, norm_stats, test_data, test_labels, decision_threshold

    # 1. Load DL model
    model_path = os.path.join(SAVE_DIR, "hybrid_model.h5")
    if not os.path.exists(model_path):
        print("[WARNING] No trained model found. Run train.py first.")
        return

    dl_model = load_model(model_path)
    print("[INFO] DL model loaded.")

    # 2. Load ensemble models if available
    rf_path  = os.path.join(SAVE_DIR, "rf_model.pkl")
    xgb_path = os.path.join(SAVE_DIR, "xgb_model.pkl")

    if os.path.exists(rf_path) and os.path.exists(xgb_path):
        try:
            rf  = joblib.load(rf_path)
            xgb = joblib.load(xgb_path)
            ens = EnsembleModel(dl_model)
            ens.rf  = rf
            ens.xgb = xgb
            with model_lock:
                model = ens
            print("[INFO] Ensemble model loaded (DL + RF + XGB).")
        except Exception as e:
            print(f"[WARNING] Could not load ensemble: {e}. Using DL only.")
            with model_lock:
                model = dl_model
    else:
        with model_lock:
            model = dl_model
        print("[INFO] Using DL model only (ensemble not found).")

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


@app.route('/api/start_stream', methods=['POST'])
def start_stream():
    global streaming
    if not streaming:
        streaming = True
        threading.Thread(target=stream_eeg_data, daemon=True).start()
    return jsonify({'message': 'Streaming started'})


@app.route('/api/stop_stream', methods=['POST'])
def stop_stream():
    global streaming
    streaming = False
    return jsonify({'message': 'Streaming stopped'})


@app.route('/api/train/start', methods=['POST'])
def start_training():
    """Starts model training in a background thread."""
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

    threading.Thread(target=train_model_worker, daemon=True).start()
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


@app.route('/api/patient/save', methods=['POST'])
def save_patient():
    """Creates or updates the active patient profile."""
    global patient_state
    data = request.json or {}

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




@app.route('/api/analyze_file', methods=['POST'])
def analyze_file():
    """Analyse an uploaded EEG .txt or .csv file, or JSON-encoded data."""
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
        elif request.json and 'data' in request.json:
            raw = request.json['data']
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

        X_input = segments[..., np.newaxis]   # (N, 178, 1)

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
            'seizure_detected':      max_prob >= decision_threshold,
            'total_segments':        len(segments),
            'seizure_segments_count': n_seized,
            'plot_data':             norm[:1000].tolist(),
            'decision_threshold':    decision_threshold
        })

    except Exception as e:
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500


# ── Streaming ──────────────────────────────────────────────────────────────────

def stream_eeg_data():
    """Simulates real-time EEG streaming using the first test signal."""
    global streaming, test_data, norm_stats, last_probability

    if test_data is None:
        print("[WARNING] No test data for streaming.")
        return

    signal = test_data[0].copy()

    # Preprocess the full signal once
    filtered = preprocess_pipeline(signal)
    if norm_stats:
        signal_norm, _ = z_score_normalize(filtered, norm_stats[0], norm_stats[1])
    else:
        signal_norm, _ = z_score_normalize(filtered)

    ptr        = 0
    pred_every_steps = 8   # predict every 8 stream steps for a smoother UI
    step_counter = 0

    while streaming and ptr + WINDOW_SIZE <= len(signal_norm):
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
        time.sleep(0.05)    # ~20 Hz update rate

    streaming = False
    socketio.emit('prediction', {'probability': float(last_probability), 'timestamp': time.time()})


# ── SocketIO Events ────────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    print("[SocketIO] Client connected")

@socketio.on('disconnect')
def on_disconnect():
    print("[SocketIO] Client disconnected")


# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    load_patient_state()
    load_models_and_data()
    port = int(os.environ.get('PORT', 5000))
    print(f"[INFO] Starting NeuroGuard server on http://localhost:{port}")
    socketio.run(app, debug=False, host='0.0.0.0', port=port)
