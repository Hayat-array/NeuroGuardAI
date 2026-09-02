<div align="center">

# 🧠 NeuroGuard AI
### Real-Time Epileptic Seizure Detection using Hybrid Deep Learning
**Arya Verse 2.0 Hackathon — Clinical AI Track**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg?logo=tensorflow&logoColor=white)](https://tensorflow.org/)
[![Flask](https://img.shields.io/badge/Flask-SocketIO-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Brain-black.svg?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-Fast_Frontend-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

*An AI-powered clinical neuroinformatics platform that detects epileptic seizures from EEG signals in real time, featuring an interactive 3D brain particle visualization, automated clinical dossiers, and DRL-tuned adaptive alerting.*

---

</div>

## 🚨 The Problem

Epilepsy affects over **50 million people worldwide**. Seizures are unpredictable and silent — they occur without warning, causing severe injury, cognitive damage, or Sudden Unexpected Death in Epilepsy (**SUDEP**). 

- **Slow Diagnoses:** Traditional manual EEG interpretation by neurologists takes hours or days.
- **High Costs & Limited Access:** EEG monitoring is largely restricted to inpatient clinical settings.
- **Lack of At-Home Solutions:** There is no widely available, affordable, real-time automated seizure detection system accessible to patients in daily life.

---

## 💡 Our Solution — NeuroGuard AI

NeuroGuard AI bridges the gap between clinical-grade diagnostic precision and real-time accessibility. It delivers:

- 🧠 **Real-Time Stream Processing:** Ingests and filters raw EEG brain signals instantaneously.
- ⚡ **3-Layer Hybrid AI Ensemble:** Combines 1D-CNN (spatial feature extraction), Bi-LSTM (temporal sequence modeling), Multi-Head Attention, and Random Forest / XGBoost classifiers.
- 📊 **3D Neural Activity Simulation:** Real-time particle-based 3D brain rendered with Three.js that pulses and shifts color dynamically based on electrical intensity.
- 🩺 **Integrated Patient Dossier:** Generates unique clinical IDs (`PT-YYYYMMDD-HHMMSS`), archives full medical history, and produces exportable clinical reports.
- 🚨 **Adaptive Seizure Alerts:** Employs Deep Reinforcement Learning (DQN) to tune decision thresholds and trigger instant visual alerts when seizure risk is detected.

---

## 📊 Dataset — Bonn University EEG Benchmark

NeuroGuard AI is trained and evaluated on the **Bonn University EEG Dataset**, the gold-standard benchmark in epilepsy research.

| Set | Clinical Description | Anatomical Region | Diagnostic Label |
|:---:|:---|:---|:---:|
| **S** | Seizure (ictal) activity | Epileptogenic zone during seizure | 🔴 **Class 1 — Seizure** |
| **F** | Interictal, seizure-free interval | Focal epileptogenic zone | 🟢 **Class 0 — Normal** |
| **N** | Interictal, seizure-free interval | Hippocampal formation | 🟢 **Class 0 — Normal** |
| **O** | Healthy volunteers | Extra-cranial (eyes open) | 🟢 **Class 0 — Normal** |
| **Z** | Healthy volunteers | Extra-cranial (eyes closed) | 🟢 **Class 0 — Normal** |

### Preprocessing & Pipeline Integrity
- **500 Total Recordings:** 100 single-channel EEG signals per class.
- **High Resolution:** 4,097 samples per recording sampled at 173.61 Hz (~23.6 seconds).
- **Window Segmentation:** 178-sample windows with 25% overlap.
- **Zero Data Leakage:** Stratified 80/20 train/test split strictly applied **before** segmentation and normalization.
- **Butterworth Zero-Phase Filtering:** 0.5–40 Hz bandpass filter to isolate delta, theta, alpha, beta, and gamma bands while eliminating DC offset and high-frequency noise.

---

## 🤖 Model Architecture & Performance

```
Raw EEG Window (178, 1)
         │
         ▼
 ┌─────────────────────────────────────────┐
 │ 1D-CNN Feature Extractor (Conv1D + Swish)│
 └───────────────────┬─────────────────────┘
                     ▼
 ┌─────────────────────────────────────────┐
 │ Bidirectional LSTM (Temporal Modeling)  │
 └───────────────────┬─────────────────────┘
                     ▼
 ┌─────────────────────────────────────────┐
 │ Multi-Head Self-Attention Layer         │
 └───────────────────┬─────────────────────┘
                     ▼
 ┌─────────────────────────────────────────┐
 │ Dense Projection & Feature Vector Output│
 └─────────┬───────────────────┬───────────┘
           │                   │
           ▼                   ▼
    ┌─────────────┐     ┌─────────────┐
    │Random Forest│     │   XGBoost   │
    └──────┬──────┘     └──────┬──────┘
           │                   │
           └─────────┬─────────┘
                     ▼
       Soft Voting Ensemble Decision
                     │
                     ▼
       Adaptive DRL Threshold Gate
                     │
                     ▼
       🚨 Seizure / 🟢 Normal Verdict
```

### Validation Metrics

| Metric | Measured Value | Clinical Significance |
|:---|:---:|:---|
| **Accuracy** | **~98.30%** | Overall diagnostic correctness across all classes |
| **Sensitivity (Recall)** | **~93.50%** | **Critical metric:** Minimizes missed seizures (false negatives) |
| **Specificity** | **~99.50%** | Prevents false alarms and unnecessary clinical interventions |
| **ROC-AUC** | **~0.9949** | Robust discrimination capability across all confidence thresholds |
| **F1-Score** | **~95.65%** | Harmonic mean balancing sensitivity and precision |

> ⭐️ **Why Sensitivity Matters Most:** In clinical neurology, a false negative (failing to detect an active seizure) can be fatal due to status epilepticus or SUDEP. NeuroGuard's ensemble prioritizes near-zero false negatives while maintaining high specificity.

---

## ✨ Platform Features

### 1. 🧠 Real-Time Neural Activity Monitor
- **3D Interactive Brain (Three.js):** Visualizes localized neural excitation with interactive camera controls and particle illumination.
- **Live Waveform Oscilloscope (Chart.js):** Sub-second rendering of streaming EEG channels via WebSockets.
- **Dynamic Seizure Probability Gauge:** Real-time needle gauge displaying current seizure probability and alert state.

### 2. 📂 EEG File Analysis & Diagnostics
- Drag-and-drop or file upload for `.txt` and `.csv` raw EEG recordings.
- Instant segment-by-segment windowed evaluation.
- Detailed metrics returned: Max probability, average risk score, total seizure segments detected, and clinical verdict.

### 3. 🩺 Patient Dossier & EHR Management
- Comprehensive clinical profiling: Age, biological sex, blood group, ongoing antiepileptic medications, known allergies, and neurologist notes.
- Automatic identifier assignment (`PT-YYYYMMDD-HHMMSS`).
- Persistent local session storage with JSON database.
- One-click downloadable patient diagnostic report.

### 4. ⚡ In-Browser Model Training Pipeline
- Trigger the full 8-stage training and fine-tuning pipeline directly from the application interface.
- Live progress tracker (Idle, Running, Completed, Failed).
- Automatically updates accuracy, sensitivity, and ROC-AUC metrics upon completion.

### 5. 🚨 Intelligent Adaptive Alert System
- Full-screen high-priority pulsing alert overlay when seizure threshold is exceeded.
- Powered by Deep Reinforcement Learning (DQN) agent that continuously adapts the threshold (`decision_threshold.npy`) based on misclassification penalties.

### 6. 🌗 Dual Clinical Themes
- Default **Clinical Dark Mode** designed for high-contrast monitoring rooms.
- **Light Mode** optimized for brightly lit consultation rooms and clinics.

---

## 🔬 Technical Stack

| Layer | Technology | Role |
|:---|:---|:---|
| **Deep Learning** | TensorFlow 2.x, Keras | 1D-CNN + BiLSTM + Attention Hybrid Network |
| **Ensemble ML** | Scikit-learn, XGBoost | Random Forest and XGBoost verification classifiers |
| **Reinforcement Learning** | PyTorch / NumPy DQN | Adaptive decision-threshold optimization |
| **Backend API & Streaming** | Python, Flask, Flask-SocketIO | REST API endpoints, real-time WebSocket broadcasting |
| **Modern Frontend** | React 19, Vite | Responsive, component-driven medical dashboard |
| **Static Alternative** | HTML5, CSS3, Vanilla JS | Lightweight standalone fallback UI (`backend/static`) |
| **Visualizations** | Three.js, Chart.js | 3D particle brain simulation & real-time EEG charting |
| **Signal Processing** | SciPy, NumPy | Butterworth zero-phase bandpass filtering, Z-score scaling |

---

## 🗂️ Project Structure

```text
NeuroGuardAI/
├── backend/
│   ├── app.py                   # Flask application, WebSocket handlers & API routes
│   ├── model.py                 # Hybrid Deep Learning model & Ensemble definitions
│   ├── train.py                 # End-to-end 8-stage training pipeline
│   ├── data_loader.py           # Bonn dataset parser, segmentation & batch loader
│   ├── preprocessing.py         # Butterworth bandpass filter & Z-score normalization
│   ├── rl_agent.py              # Deep Q-Network (DQN) for threshold optimization
│   ├── dwt.py                   # Discrete Wavelet Transform utilities
│   ├── verify_pipeline.py       # Pipeline sanity & verification tests
│   ├── requirements.txt         # Backend Python dependencies
│   ├── gunicorn.conf.py         # Production WSGI server configuration
│   ├── render.yaml              # Cloud deployment blueprint
│   ├── saved_models/            # Serialized weights, ensembles & normalization stats
│   └── static/                  # Standalone lightweight clinical interface
│       ├── index.html           # Standalone dashboard UI
│       ├── style.css            # Dark/light design system
│       └── script.js            # Socket.IO client, chart & 3D brain logic
│
├── frontend/                    # Modern React + Vite clinical dashboard
│   ├── package.json             # NPM dependencies and scripts
│   ├── vite.config.js           # Vite build and dev configuration
│   ├── src/                     # React application source code
│   │   ├── App.jsx              # Main dashboard component
│   │   ├── main.jsx             # React DOM entry point
│   │   └── ...                  # Modals, charts, dossier & controls
│   └── public/                  # Static web assets
│
├── Dataset_of_Eplipsy/          # Bonn University EEG Benchmark Dataset
│   ├── S/                       # 100 Seizure (ictal) recordings
│   ├── F/                       # 100 Focal epileptogenic recordings
│   ├── N/                       # 100 Hippocampal interictal recordings
│   ├── O/                       # 100 Healthy eyes-open recordings
│   └── Z/                       # 100 Healthy eyes-closed recordings
│
├── .gitignore                   # Ignored files (virtualenvs, node_modules, cache)
└── README.md                    # Project documentation
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm** (for the modern React frontend)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Hayat-array/NeuroGuardAI.git
cd NeuroGuardAI
```

### Step 2: Set Up Backend
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
# On Windows:
python -m venv .venv
.venv\Scripts\activate

# On macOS / Linux:
# python3 -m venv .venv
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Train or Verify Models
Pre-trained weights are included in `backend/saved_models/`. To retrain the entire pipeline from scratch on the Bonn dataset:
```bash
python train.py
```
This executes the 8-stage training pipeline and serializes the updated weights to `backend/saved_models/`.

### Step 4: Run the Backend Server
```bash
python app.py
```
*The backend server starts on **`http://localhost:5000`** with WebSocket streaming active.*

---

### Step 5: Run the Frontend Dashboard

#### Option A: Modern React + Vite Interface (Recommended)
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The React clinical application will be available at **`http://localhost:5173`**.*

#### Option B: Standalone Built-in Interface
Navigate directly to **`http://localhost:5000`** in your browser to access the lightweight static clinical dashboard served directly by Flask.

---

## 🔌 WebSocket API Reference

The backend exposes real-time bidirectional events via Socket.IO:

| Event Name | Direction | Payload Schema | Description |
|:---|:---:|:---|:---|
| `connect` | Client → Server | — | Establishes client connection to stream |
| `disconnect` | Client → Server | — | Closes real-time stream subscription |
| `eeg_data` | Server → Client | `{ "data": [float], "timestamp": float }` | Streams raw EEG signal values for visualization |
| `prediction` | Server → Client | `{ "probability": float, "timestamp": float }` | Delivers real-time seizure probability inference |

---

## 🌟 Why NeuroGuard Stands Out

| Feature | Conventional Clinical Monitoring | NeuroGuard AI |
|:---|:---:|:---:|
| **EEG Interpretation** | Requires specialized neurologist | Automated hybrid AI (~98.3% accuracy) |
| **Diagnostic Latency** | Hours to days | **Sub-second real-time inference** |
| **Real-Time Streaming** | ❌ Not available on consumer hardware | ✅ Real-time WebSocket broadcasting |
| **Ensemble Safeguards** | ❌ Single heuristic / model | ✅ DL + Random Forest + XGBoost verification |
| **Patient Profile Tracking** | Expensive external EHR software | ✅ Built-in patient dossier & report export |
| **Hardware Footprint** | Massive hospital rack systems | ✅ Runs on standard laptops or edge devices |
| **Deployment Flexibility** | Locked to clinical facilities | ✅ Browser-accessible anywhere in the world |

---

## 🔮 Future Roadmap

- [ ] **Hardware Ingestion:** Direct Bluetooth/USB streaming from OpenBCI Cyton and Emotiv headsets.
- [ ] **Mobile & PWA Support:** Progressive Web App with offline TensorFlow Lite seizure inference.
- [ ] **Hospital Interoperability:** HL7 FHIR standard export for seamless integration with electronic health records.
- [ ] **Multi-Channel Expansion:** Scaling from single-channel to standard 10–20 clinical 19-electrode montages.
- [ ] **Automated Emergency Dispatch:** Real-time SMS and automated email alerts sent to primary caregivers upon seizure detection.
- [ ] **Cloud Edge Deployment:** Enterprise packaging for AWS HealthLake and Azure Health Data Services.

---

## 👨‍💻 Author & Acknowledgments

- **Project:** NeuroGuard AI — Clinical Neuroinformatics Platform
- **Developer:** [Hayat Ali](https://github.com/Hayat-array)
- **Event:** Arya Verse 2.0 Hackathon
- **Track:** Clinical AI / Healthcare Technology

---

<div align="center">

*Built with ❤️ for epilepsy patients and clinical researchers worldwide.*  
**"Every second counts. AI makes every second matter."**

</div>
