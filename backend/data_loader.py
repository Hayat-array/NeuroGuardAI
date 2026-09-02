
"""
data_loader.py
--------------
Loads the Bonn EEG dataset from subdirectories S, F, N, O, Z.
Each subfolder contains 100 .txt files (e.g. S001.txt ... S100.txt).
"""

import os
# pyrefly: ignore [missing-import]
import numpy as np

# DATASET_PATH = r"c:/Epilipsy project/Dataset_of_Eplipsy"
DATASET_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "Dataset_of_Eplipsy")
)
print("DATASET_PATH =", DATASET_PATH)


def load_data(data_path=DATASET_PATH):
    """
    Loads the Bonn EEG dataset from subdirectories named S, F, N, O, Z.

    Returns:
        dict: Keys 'S','F','N','O','Z' → numpy arrays (100, 4097)
    """
    data_sets = {'S': [], 'F': [], 'N': [], 'O': [], 'Z': []}

    for key in data_sets.keys():
        folder_path = os.path.join(data_path, key)

        if not os.path.isdir(folder_path):
            print(f"[WARNING] Folder '{folder_path}' not found. Skipping '{key}'.")
            continue

        all_files = sorted(os.listdir(folder_path))

        for filename in all_files:
            if filename.lower().endswith('.txt'):
                file_path = os.path.join(folder_path, filename)
                try:
                    signal = np.loadtxt(file_path)
                    data_sets[key].append(signal)
                except Exception as e:
                    print(f"[ERROR] Loading {filename}: {e}")

        data_sets[key] = np.array(data_sets[key])
        print(f"[INFO] Loaded set '{key}': {data_sets[key].shape}")

    return data_sets


def prepare_data_for_training(data_sets, binary=True):
    """
    Prepares data for training.

    Binary mode  : S=1 (Seizure), F/N/O/Z=0 (Non-Seizure)
    Multiclass   : Z=0, O=1, N=2, F=3, S=4

    Returns:
        X : np.array  (total_samples, signal_length)
        y : np.array  (total_samples,)
    """
    X, y = [], []
    label_map = {'Z': 0, 'O': 1, 'N': 2, 'F': 3, 'S': 4}

    for key, signals in data_sets.items():
        if len(signals) == 0:
            continue
        X.append(signals)
        label = (1 if key == 'S' else 0) if binary else label_map[key]
        y.append(np.full(len(signals), label))

    X = np.concatenate(X, axis=0)
    y = np.concatenate(y, axis=0)

    print(f"[INFO] Total samples: {X.shape[0]} | Signal length: {X.shape[1]}")
    unique, counts = np.unique(y, return_counts=True)
    print(f"[INFO] Class distribution: {dict(zip(unique.astype(int), counts))}")

    return X, y


def segment_signals(X, y=None, window_size=178, overlap=0):
    """
    Segments signals into fixed-length windows.
    178 samples = exactly 1 second at 173.61 Hz (matches paper Study 5/6).

    Args:
        X           : 2D array (n_signals, signal_length) or 1D single signal
        y           : 1D label array (n_signals,)  — optional
        window_size : int, samples per window (default 178)
        overlap     : int, samples to overlap between windows (default 0)

    Returns:
        np.array of segments, and optionally np.array of labels
    """
    new_X, new_y = [], []

    # Handle single 1D signal
    if isinstance(X, np.ndarray) and X.ndim == 1:
        X = X[np.newaxis, :]
        if y is not None:
            y = np.array([y])

    step = max(1, window_size - overlap)

    for i in range(len(X)):
        signal = X[i]
        label  = y[i] if y is not None else None
        start  = 0
        while start + window_size <= len(signal):
            new_X.append(signal[start:start + window_size])
            if label is not None:
                new_y.append(label)
            start += step

    if y is None:
        return np.array(new_X)
    return np.array(new_X), np.array(new_y)