<div align="center">

#  NeuroGuard AI
### *Real-Time Epileptic Seizure Detection using Hybrid Deep Learning*


> **Arya Verse 2.0 Hackathon — Clinical AI Track**
> An AI-powered clinical neuroinformatics platform that detects epileptic seizures from EEG signals in real time, with 3D brain visualization and a patient management system.

</div>

---

## 🚨 The Problem

Epilepsy affects **over 50 million people worldwide**. Seizures are unpredictable and silent — they occur without warning, causing injury, cognitive damage, or sudden unexpected death in epilepsy (SUDEP). Manual EEG reading by neurologists is slow, expensive, and only available in hospitals.

> **There is no affordable, real-time, automated seizure detection system accessible to patients at home.**

---

## 💡 Our Solution — NeuroGuard AI

A **full-stack clinical AI platform** that:
- 🧠 Analyzes raw EEG brain signals in real time
- ⚡ Detects seizures instantly using a 3-layer AI ensemble
- 📊 Visualizes brain activity in 3D
- 🩺 Manages patient clinical profiles and generates downloadable reports
- 🚨 Triggers visual alerts when seizure probability exceeds a tuned threshold

---

## 📊 Dataset — Bonn University EEG

The gold-standard benchmark for epilepsy AI research.

| Set | Description | Label |
|-----|-------------|-------|
| **S** | Seizure (ictal) activity | 🔴 Class 1 — Seizure |
| **F** | Interictal, focal epileptogenic zone | 🟢 Class 0 — Normal |
| **N** | Interictal, hippocampal region | 🟢 Class 0 — Normal |
| **O** | Healthy, eyes open | 🟢 Class 0 — Normal |
| **Z** | Healthy, eyes closed | 🟢 Class 0 — Normal |

- 📁 **500 recordings** (100 per set)
- 📏 **4,097 samples** per recording at **173.61 Hz** (~23.6 seconds)
- 🪟 Segmented into **178-sample windows** with **25% overlap**
- 🔀 **80/20 stratified train/test split** (split before preprocessing to eliminate data leakage)

---

## 🤖 Model Performance

| Metric | Value |
|--------|-------|
| **Accuracy** | ~98.30% |
| **Sensitivity** *(Seizure Recall)* | ~93.50% |
| **Specificity** *(Non-Seizure Recall)* | ~99.50% |
| **ROC-AUC** | ~0.9949 |
| **F1-Score** | ~95.65% |

> ⭐ **Sensitivity is the most critical metric** for epilepsy detection. Missing a real seizure (false negative) can be life-threatening. This model prioritizes near-zero false negatives.

---

## ✨ Platform Features

### 1. 🧠 Real-Time Neural Activity Monitor
- 3D brain particle visualization (Three.js) that pulses with EEG signal intensity
- WebSocket-based live EEG waveform chart (Chart.js)
- Seizure probability gauge with animated needle and risk badge

### 2. 📂 EEG File Analysis
- Upload `.txt` or `.csv` EEG recordings for instant batch analysis
- Returns max probability, average probability, number of seizure segments
- Clear SEIZURE DETECTED / NO SEIZURE DETECTED verdict

### 3. 🩺 Patient Dossier
- Complete clinical profile: name, age, sex, blood group, medications, allergies, history notes
- Auto-generated unique Patient ID (format: `PT-YYYYMMDD-HHMMSS`)
- Downloadable clinical report
- Persistent storage with session history (JSON)

### 4. ⚡ Model Training Dashboard
- Trigger full training pipeline from the UI without touching code
- Live training status (idle / running / completed / failed)
- Post-training metrics displayed: accuracy, sensitivity, specificity, AUC

### 5. 🚨 Seizure Alert System
- Full-screen pulsing red overlay when probability exceeds tuned threshold
- Adaptive threshold loaded from `decision_threshold.npy` (DRL-tuned)

### 6. 🌗 Dark / Light Mode
- Clinical dark mode by default
- Toggle to light mode for bright clinical environments

---

## 🔬 Technical Stack

| Layer | Technology |
|-------|-----------|
| **Deep Learning** | TensorFlow 2.x — CNN-BiLSTM-Attention |
| **Ensemble ML** | Scikit-learn Random Forest + XGBoost |
| **Adaptive Alerting** | Deep Reinforcement Learning (DQN) |
| **Backend API** | Python Flask + Flask-SocketIO (eventlet) |
| **Frontend** | Vanilla HTML5 / CSS3 / JavaScript |
| **Visualization** | Chart.js (EEG chart) + Three.js (3D brain) |
| **Real-time** | WebSocket (Socket.IO) |
| **Data Processing** | NumPy, SciPy (Butterworth zero-phase filter) |

---

## 🗂️ Project Structure

```
NeuroGuard/
│
├── backend/
│   ├── app.py              # Flask server + WebSocket + all API routes
│   ├── model.py            # CNN-BiLSTM-Attention + EnsembleModel class
│   ├── train.py            # Full 8-stage training pipeline
│   ├── data_loader.py      # Bonn dataset loader + segmentation
│   ├── preprocessing.py    # Bandpass filter + Z-score normalization
│   ├── rl_agent.py         # DRL agent for adaptive threshold tuning
│   ├── requirements.txt    # Python dependencies
│   └── static/
│       ├── index.html      # Main UI
│       ├── style.css       # Design system (dark/light themes)
│       └── script.js       # WebSocket client + charts + UI logic
│
├── Dataset_of_Eplipsy/     # Bonn EEG Dataset
│   ├── S/  (100 seizure recordings)
│   ├── F/  (100 focal interictal)
│   ├── N/  (100 non-focal interictal)
│   ├── O/  (100 healthy, eyes open)
│   └── Z/  (100 healthy, eyes closed)
│
└── README.md
```

---

## 🚀 Setup & Run

### Prerequisites
- Python 3.10+
- pip

### 1. Create virtual environment
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
```

### 2. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Train the models
```bash
python train.py
```
This runs the full 8-stage pipeline and saves models to `backend/saved_models/`.

### 4. Start the server
```bash
python app.py
```
Open **http://localhost:5000** in your browser.

---

**WebSocket Events (server → client)**

| Event | Payload |
|-------|---------|
| `eeg_data` | `{ data: float[], timestamp: float }` |
| `prediction` | `{ probability: float, timestamp: float }` |

---

## 🌟 Why NeuroGuard Stands Out

| Feature | Traditional Tools | NeuroGuard AI |
|---------|------------------|---------------|
| EEG Interpretation | Expert neurologist required | Automated AI, ~99% accuracy |
| Detection Speed | Hours / days | Sub-second |
| Real-time Analysis | ❌ Not available | ✅ WebSocket streaming |
| Ensemble Verification | ❌ Single model | ✅ DL + RF + XGBoost |
| Patient Management | Separate EHR system | ✅ Built-in dossier |
| Cost | Very high | Low (runs on a laptop) |
| Accessibility | Hospital only | Browser anywhere |

---

## 🔮 Future Roadmap

- [ ] 📡 Live EEG hardware integration (OpenBCI, Emotiv)
- [ ] 📱 Mobile-first PWA with offline seizure detection
- [ ] 🏥 HL7 FHIR integration for hospital EHR systems
- [ ] 🌐 Multi-channel (19-electrode) EEG support
- [ ] 🔔 SMS/email emergency alert system
- [ ] ☁️ Cloud deployment (Azure Medical Imaging)

---

## 👨‍💻 Team

**Project:** NeuroGuard AI — Clinical Neuroinformatics Platform
**Event:** Arya Verse 2.0 Hackathon
**Track:** Clinical AI / Healthcare Technology

---

<div align="center">

*Built with ❤️ for epilepsy patients worldwide*

**"Every second counts. AI makes every second matter."**

</div>
