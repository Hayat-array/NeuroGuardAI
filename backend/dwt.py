
"""
dwt.py
------
Discrete Wavelet Transform utilities for EEG feature extraction.
"""

import numpy as np
import pywt


def apply_dwt(signal, wavelet='db4', level=5):
    """
    Applies Discrete Wavelet Transform to decompose EEG into sub-bands.

    At 173.61 Hz, level-5 db4 maps to:
        cA5 → Delta  (0–2.7 Hz)
        cD5 → Theta  (2.7–5.4 Hz)
        cD4 → Alpha  (5.4–10.9 Hz)
        cD3 → Beta   (10.9–21.7 Hz)
        cD2 → Gamma  (21.7–43.4 Hz)
        cD1 → High   (43.4–86.8 Hz)

    Args:
        signal  : 1D np.array EEG signal
        wavelet : wavelet family (default 'db4')
        level   : decomposition level (default 5)

    Returns:
        list: [cA5, cD5, cD4, cD3, cD2, cD1]
    """
    coeffs = pywt.wavedec(signal, wavelet, level=level)
    return coeffs


def reconstruct_signal(coeffs, wavelet='db4'):
    """Reconstruct signal from DWT coefficients."""
    return pywt.waverec(coeffs, wavelet)


def get_band_energy(coeffs):
    """
    Energy of each wavelet sub-band (used as ML features).

    Returns:
        np.array of shape (n_bands,)
    """
    return np.array([np.sum(np.square(c)) for c in coeffs])


def get_dwt_features(signal, wavelet='db4', level=5):
    """
    Extracts statistical features from each DWT sub-band.
    Features per band: mean, std, energy, max, min  → 5 × (level+1) total.

    Returns:
        np.array of shape (5 * (level+1),)
    """
    coeffs = apply_dwt(signal, wavelet, level)
    features = []
    for c in coeffs:
        features.extend([
            np.mean(c),
            np.std(c),
            np.sum(np.square(c)),   # energy
            np.max(np.abs(c)),
            np.min(np.abs(c)),
        ])
    return np.array(features)