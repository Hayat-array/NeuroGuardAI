# import numpy as np
# import tensorflow as tf
# from sklearn.model_selection import train_test_split
# from sklearn.metrics import classification_report, accuracy_score, roc_auc_score, confusion_matrix
# import joblib
# import os

# from data_loader import load_data, prepare_data_for_training, segment_signals
# from preprocessing import preprocess_pipeline, z_score_normalize
# from model import build_hybrid_model, EnsembleModel

# # Configuration
# WINDOW_SIZE = 174  # 1 second
# OVERLAP = 87       # 50% overlap
# BATCH_SIZE = 32
# EPOCHS = 2 # Optimized for speed
# SAVE_DIR = "saved_models"

# if not os.path.exists(SAVE_DIR):
#     os.makedirs(SAVE_DIR)

# def train():
#     print("--- 1. Loading Data ---")
#     data_sets = load_data()
#     X_raw, y_raw = prepare_data_for_training(data_sets, binary=True)
    
#     print(f"Total raw samples: {X_raw.shape}")
    
#     # --- 2. Train/Test Split (Strict Zero Leakage) ---
#     # We split BEFORE preprocessing and segmentation to ensure no data overlap via windows
#     X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
#         X_raw, y_raw, test_size=0.2, random_state=42, stratify=y_raw
#     )
    
#     print("--- 3. Preprocessing ---")
#     # Apply Filtering
#     X_train_filt = preprocess_pipeline(X_train_raw)
#     X_test_filt = preprocess_pipeline(X_test_raw)
    
#     # Apply Normalization (Learn stats from Train, Apply to Test)
#     # We need to flatten to compute global stats or compute per channel? 
#     # Usually Z-score is per sample or global. Let's do global for the dataset relative to training.
#     train_mean = np.mean(X_train_filt)
#     train_std = np.std(X_train_filt)
    
#     X_train_norm, _ = z_score_normalize(X_train_filt, train_mean, train_std)
#     X_test_norm, _ = z_score_normalize(X_test_filt, train_mean, train_std)
    
#     print("--- 4. Segmentation ---")
#     X_train_seg, y_train_seg = segment_signals(X_train_norm, y_train_raw, WINDOW_SIZE, OVERLAP)
#     X_test_seg, y_test_seg = segment_signals(X_test_norm, y_test_raw, WINDOW_SIZE, OVERLAP)
    
#     # Reshape for CNN (samples, timesteps, channels)
#     X_train_seg = X_train_seg[..., np.newaxis]
#     X_test_seg = X_test_seg[..., np.newaxis]
    
#     print(f"Training Data Img Shape: {X_train_seg.shape}")
#     print(f"Testing Data Img Shape: {X_test_seg.shape}")
    
#     print("--- 5. Model Training ---")
#     input_shape = (WINDOW_SIZE, 1)
#     dl_model = build_hybrid_model(input_shape)
    
#     dl_model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
#     dl_model.summary()
    
#     dl_model.fit(
#         X_train_seg, y_train_seg,
#         validation_split=0.1,
#         epochs=EPOCHS,
#         batch_size=BATCH_SIZE
#     )
    
#     # Save DL Model
#     dl_model.save(os.path.join(SAVE_DIR, "hybrid_model.h5"))
#     print("DL Model Saved.")
    
#     print("--- 6. Ensemble Training ---")
#     ensemble = EnsembleModel(dl_model)
#     # We use a subset of train data or the whole train data to train the ensemble heads
#     # Ideally should use a hold-out validation set to train the ensemble to avoid overfitting to DL features
#     # But for this implementation we'll use the training data.
#     ensemble.fit(X_train_seg, y_train_seg)
    
#     # Save Ensemble Models
#     joblib.dump(ensemble.rf, os.path.join(SAVE_DIR, "rf_model.pkl"))
#     joblib.dump(ensemble.xgb, os.path.join(SAVE_DIR, "xgb_model.pkl"))
#     print("Ensemble Models Saved.")
    
#     print("--- 7. Evaluation ---")
#     y_pred_prob = ensemble.predict(X_test_seg)
#     y_pred = (y_pred_prob > 0.5).astype(int)
    
#     print("\nClassification Report:")
#     print(classification_report(y_test_seg, y_pred))
    
#     roc = roc_auc_score(y_test_seg, y_pred_prob)
#     print(f"ROC-AUC Score: {roc:.4f}")
    
#     cm = confusion_matrix(y_test_seg, y_pred)
#     print("Confusion Matrix:")
#     print(cm)

# if __name__ == "__main__":
#     train()
"""
train.py
--------
Industry-level training pipeline:
    1. Load all 5 EEG sets (S, F, N, O, Z)
    2. Strict train/test split BEFORE any preprocessing
    3. Bandpass filter + Z-score normalisation (no data leakage)
    4. Segment into 1-second windows (178 samples)
    5. Train CNN-BiLSTM-Attention model with callbacks
    6. Train Ensemble (RF + XGBoost) on DL features
    7. Full evaluation: accuracy, sensitivity, specificity, AUC
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.callbacks import (
    EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, roc_auc_score,
    confusion_matrix, accuracy_score
)
import joblib

from data_loader    import load_data, prepare_data_for_training, segment_signals
from preprocessing  import preprocess_pipeline, z_score_normalize
from model          import build_hybrid_model, EnsembleModel

# ── Configuration ─────────────────────────────────────────────────────────────
WINDOW_SIZE  = 178     # 1 second at 173.61 Hz  (matches paper exactly)
OVERLAP      = 44      # 25% overlap — halves segment count vs 50%, still good accuracy
BATCH_SIZE   = 64      # larger batches → faster GPU/CPU throughput
EPOCHS       = 100     # EarlyStopping will halt early when needed
TEST_SIZE    = 0.20    # 80/20 split
RANDOM_SEED  = 42
SAVE_DIR     = "saved_models"

os.makedirs(SAVE_DIR, exist_ok=True)


def print_section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print(f"{'='*55}")


def evaluate(y_true, y_pred, y_prob, label="Test Set"):
    """Prints full classification metrics."""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    sensitivity = tp / (tp + fn + 1e-8)
    specificity = tn / (tn + fp + 1e-8)
    accuracy    = accuracy_score(y_true, y_pred)
    auc         = roc_auc_score(y_true, y_prob)
    f1_seizure  = 2*tp / (2*tp + fp + fn + 1e-8)

    print(f"\n── {label} Results ──")
    print(f"  Accuracy    : {accuracy*100:.2f}%")
    print(f"  Sensitivity : {sensitivity*100:.2f}%  (True Positive Rate)")
    print(f"  Specificity : {specificity*100:.2f}%  (True Negative Rate)")
    print(f"  F1-Score    : {f1_seizure*100:.2f}%")
    print(f"  ROC-AUC     : {auc:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"              Pred 0   Pred 1")
    print(f"  Actual 0  [{tn:6d}  {fp:6d}]   (Non-Seizure)")
    print(f"  Actual 1  [{fn:6d}  {tp:6d}]   (Seizure)")
    print(f"\n{classification_report(y_true, y_pred, target_names=['Non-Seizure','Seizure'])}")

    return {'accuracy': accuracy, 'sensitivity': sensitivity,
            'specificity': specificity, 'f1': f1_seizure, 'auc': auc}


def train():
    # ── 1. Load ───────────────────────────────────────────────────────────────
    print_section("1 / 7  Loading Data")
    data_sets = load_data()
    X_raw, y_raw = prepare_data_for_training(data_sets, binary=True)

    # ── 2. Train / Test Split (BEFORE preprocessing — no leakage) ─────────────
    print_section("2 / 7  Train / Test Split (80 / 20, stratified)")
    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
        X_raw, y_raw,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=y_raw
    )
    print(f"  Train: {X_train_raw.shape}  |  Test: {X_test_raw.shape}")

    # ── 3. Preprocessing ──────────────────────────────────────────────────────
    print_section("3 / 7  Preprocessing (Bandpass + Z-score)")

    print("  Applying zero-phase Butterworth bandpass filter [0.5–50 Hz]...")
    X_train_filt = preprocess_pipeline(X_train_raw)
    X_test_filt  = preprocess_pipeline(X_test_raw)

    print("  Computing normalisation stats from TRAINING set only...")
    train_mean = float(np.mean(X_train_filt))
    train_std  = float(np.std(X_train_filt))
    print(f"  mean={train_mean:.4f}  std={train_std:.4f}")

    X_train_norm, _ = z_score_normalize(X_train_filt, train_mean, train_std)
    X_test_norm,  _ = z_score_normalize(X_test_filt,  train_mean, train_std)

    # Save normalisation stats for inference / app.py
    np.save(os.path.join(SAVE_DIR, "norm_stats.npy"),
            np.array([train_mean, train_std]))
    print(f"  Norm stats saved → {SAVE_DIR}/norm_stats.npy")

    # ── 4. Segmentation ───────────────────────────────────────────────────────
    print_section("4 / 7  Segmentation (window=178, overlap=89)")

    X_train_seg, y_train_seg = segment_signals(
        X_train_norm, y_train_raw, WINDOW_SIZE, OVERLAP)
    X_test_seg,  y_test_seg  = segment_signals(
        X_test_norm,  y_test_raw,  WINDOW_SIZE, OVERLAP)

    # Reshape: (samples, timesteps, channels)
    X_train_seg = X_train_seg[..., np.newaxis]
    X_test_seg  = X_test_seg[...,  np.newaxis]

    print(f"  Train segments: {X_train_seg.shape}")
    print(f"  Test  segments: {X_test_seg.shape}")
    u, c = np.unique(y_train_seg, return_counts=True)
    print(f"  Train class dist: {dict(zip(u.astype(int), c))}")

    # ── 5. Build & Train DL Model ─────────────────────────────────────────────
    print_section("5 / 7  Training CNN-BiLSTM-Attention Model")

    input_shape = (WINDOW_SIZE, 1)
    dl_model = build_hybrid_model(input_shape, num_classes=2, use_gru=False)
    dl_model.summary()

    callbacks = [
        EarlyStopping(
            monitor='val_accuracy',
            patience=8,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=4,
            min_lr=1e-6,
            verbose=1
        ),
        ModelCheckpoint(
            filepath=os.path.join(SAVE_DIR, "hybrid_model.h5"),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        )
    ]

    history = dl_model.fit(
        X_train_seg, y_train_seg,
        validation_split=0.10,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1
    )

    # Quick DL-only evaluation
    dl_prob  = dl_model.predict(X_test_seg, verbose=0).flatten()
    dl_pred  = (dl_prob > 0.5).astype(int)
    print("\n── DL Model (before ensemble) ──")
    evaluate(y_test_seg, dl_pred, dl_prob, label="DL Only")

    # ── 6. Train Ensemble ──────────────────────────────────────────────────────
    print_section("6 / 7  Training Ensemble (RF + XGBoost)")

    ensemble = EnsembleModel(dl_model)
    ensemble.fit(X_train_seg, y_train_seg)

    joblib.dump(ensemble.rf,  os.path.join(SAVE_DIR, "rf_model.pkl"))
    joblib.dump(ensemble.xgb, os.path.join(SAVE_DIR, "xgb_model.pkl"))
    print(f"  Ensemble models saved → {SAVE_DIR}/")

    # ── 7. Final Evaluation ────────────────────────────────────────────────────
    print_section("7 / 7  Final Evaluation on Hold-out Test Set")

    ens_prob = ensemble.predict(X_test_seg).flatten()
    ens_pred = (ens_prob > 0.5).astype(int)

    metrics = evaluate(y_test_seg, ens_pred, ens_prob, label="Ensemble")

    print("\n" + "="*55)
    print("  TRAINING COMPLETE")
    print(f"  Final Accuracy    : {metrics['accuracy']*100:.2f}%")
    print(f"  Final Sensitivity : {metrics['sensitivity']*100:.2f}%")
    print(f"  Final Specificity : {metrics['specificity']*100:.2f}%")
    print(f"  Final AUC         : {metrics['auc']:.4f}")
    print("="*55)

    return ensemble, metrics


if __name__ == "__main__":
    train()