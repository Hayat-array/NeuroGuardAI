"""
model.py
--------
Hybrid deep learning model:
    1D-CNN  →  Bidirectional LSTM  →  Multi-Head Attention  →  Dense

Plus an EnsembleModel wrapper that adds Random Forest and XGBoost on top
of the DL feature extractor for improved robustness.
"""

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Conv1D, MaxPooling1D, AveragePooling1D,
    BatchNormalization, Dense, Dropout,
    Bidirectional, LSTM, GRU,
    MultiHeadAttention, GlobalAveragePooling1D,
    LayerNormalization, Add
)
from tensorflow.keras.optimizers import Adam
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier


# ── Deep Learning Model ───────────────────────────────────────────────────────

def build_hybrid_model(input_shape, num_classes=2, use_gru=False):
    """
    Builds the CNN + Bi-LSTM/GRU + Multi-Head Attention hybrid model.

    Architecture (extends paper with Attention + BatchNorm):
        Conv1D(64)  → BN → MaxPool
        Conv1D(128) → BN → MaxPool
        Conv1D(256) → BN
        Bi-LSTM(128) → Dropout → Bi-LSTM(64) → Dropout
        MultiHeadAttention(4 heads) + Residual + LayerNorm
        GlobalAveragePooling
        Dense(128, relu) → Dropout → Dense(output)

    Args:
        input_shape : tuple (timesteps, channels), e.g. (178, 1)
        num_classes : 2 for binary, >2 for multiclass
        use_gru     : if True, replaces LSTM with GRU

    Returns:
        Compiled Keras Model
    """
    RNN = GRU if use_gru else LSTM
    inputs = Input(shape=input_shape)

    # ── CNN Block ────────────────────────────────────────────
    x = Conv1D(64,  kernel_size=3, activation='relu', padding='same')(inputs)
    x = BatchNormalization()(x)
    x = MaxPooling1D(pool_size=2)(x)

    x = Conv1D(128, kernel_size=3, activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    x = MaxPooling1D(pool_size=2)(x)

    x = Conv1D(256, kernel_size=3, activation='relu', padding='same')(x)
    x = BatchNormalization()(x)
    # shape: (timesteps/4, 256)

    # ── Bi-RNN Block ─────────────────────────────────────────
    x = Bidirectional(RNN(64, return_sequences=True))(x)
    x = Dropout(0.3)(x)
    x = Bidirectional(RNN(32,  return_sequences=True))(x)
    x = Dropout(0.3)(x)

    # ── Multi-Head Attention Block ────────────────────────────
    attn_out = MultiHeadAttention(num_heads=4, key_dim=32)(x, x)
    x = Add()([x, attn_out])          # residual connection
    x = LayerNormalization()(x)

    # ── Classification Head ───────────────────────────────────
    x = GlobalAveragePooling1D()(x)
    x = Dense(128, activation='relu', name='feature_dense')(x)
    x = Dropout(0.4)(x)

    if num_classes == 2:
        outputs = Dense(1, activation='sigmoid')(x)
        loss    = 'binary_crossentropy'
    else:
        outputs = Dense(num_classes, activation='softmax')(x)
        loss    = 'sparse_categorical_crossentropy'

    model = Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=Adam(learning_rate=1e-3),
        loss=loss,
        metrics=['accuracy']
    )
    return model


# ── Ensemble Wrapper ──────────────────────────────────────────────────────────

class EnsembleModel:
    """
    Three-model ensemble:
        DL  (weight 0.50) — CNN-BiLSTM-Attention
        RF  (weight 0.25) — Random Forest on DL features
        XGB (weight 0.25) — XGBoost on DL features

    The RF and XGB are trained on the 128-D feature vector from
    the 'feature_dense' layer of the pre-trained DL model.
    """

    def __init__(self, dl_model):
        self.dl_model = dl_model
        # Feature extractor: output of Dense(128) before final classification
        self.feature_extractor = Model(
            inputs  = dl_model.input,
            outputs = dl_model.get_layer('feature_dense').output
        )
        self.rf  = RandomForestClassifier(
            n_estimators=100,
            max_depth=None,
            n_jobs=-1,
            random_state=42
        )
        self.xgb = XGBClassifier(
            n_estimators=100,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            use_label_encoder=False,
            eval_metric='logloss',
            tree_method='hist',
            n_jobs=-1,
            random_state=42
        )

    def fit(self, X_train, y_train):
        """Train RF and XGB on DL-extracted features."""
        print("[Ensemble] Extracting DL features for ML training...")
        features = self.feature_extractor.predict(X_train, verbose=0)

        print("[Ensemble] Training Random Forest...")
        self.rf.fit(features, y_train)

        print("[Ensemble] Training XGBoost...")
        self.xgb.fit(features, y_train)
        print("[Ensemble] Training complete.")

    def predict(self, X):
        """Weighted-average ensemble prediction (probabilities)."""
        dl_prob  = self.dl_model.predict(X, verbose=0)                     # (N,1)
        features = self.feature_extractor.predict(X, verbose=0)
        rf_prob  = self.rf.predict_proba(features)[:, 1].reshape(-1, 1)    # (N,1)
        xgb_prob = self.xgb.predict_proba(features)[:, 1].reshape(-1, 1)   # (N,1)

        return (dl_prob * 0.50) + (rf_prob * 0.25) + (xgb_prob * 0.25)

    def predict_classes(self, X, threshold=0.5):
        """Returns binary class predictions."""
        prob = self.predict(X)
        return (prob > threshold).astype(int).flatten()
