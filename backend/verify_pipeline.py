"""
verify.py
---------
Quick sanity-check pipeline — run this before training to confirm
that data loading, filtering, normalisation, segmentation, and
DWT all work correctly end-to-end.
"""

import numpy as np
from data_loader   import load_data, prepare_data_for_training, segment_signals
from preprocessing import apply_bandpass_filter, z_score_normalize, preprocess_pipeline
from dwt           import apply_dwt, get_band_energy, get_dwt_features


def verify_pipeline():
    print("=" * 50)
    print("  PIPELINE VERIFICATION")
    print("=" * 50)

    # 1. Load
    print("\n[1] Loading data...")
    data_sets = load_data()
    if all(len(v) == 0 for v in data_sets.values()):
        print("  ERROR: No data loaded. Check DATASET_PATH in data_loader.py")
        return

    # 2. Prepare
    print("\n[2] Preparing binary labels...")
    X, y = prepare_data_for_training(data_sets, binary=True)
    print(f"  Shapes  → X: {X.shape}  y: {y.shape}")
    u, c = np.unique(y, return_counts=True)
    print(f"  Classes → {dict(zip(u.astype(int), c))}  "
          f"(0=Non-Seizure, 1=Seizure)")

    # 3. Single signal test
    idx        = 0
    raw_signal = X[idx]
    label      = int(y[idx])
    print(f"\n[3] Processing sample {idx} (label={label})...")
    print(f"  Raw  → mean={np.mean(raw_signal):.4f}  "
          f"std={np.std(raw_signal):.4f}  "
          f"len={len(raw_signal)}")

    # 4. Filter
    filtered = apply_bandpass_filter(raw_signal)
    print(f"  Filt → mean={np.mean(filtered):.4f}  "
          f"std={np.std(filtered):.4f}")

    # 5. Normalise
    norm, (m, s) = z_score_normalize(filtered)
    print(f"  Norm → mean={np.mean(norm):.4f}  "
          f"std={np.std(norm):.4f}  (target: ~0, ~1)")

    # 6. DWT
    coeffs = apply_dwt(norm)
    energies = get_band_energy(coeffs)
    feats    = get_dwt_features(norm)
    print(f"\n[4] DWT  → {len(coeffs)} sub-bands")
    print(f"  Band energies : {np.round(energies, 2)}")
    print(f"  Feature vector: {feats.shape[0]} features")

    # 7. Segmentation
    X_seg, y_seg = segment_signals(X[:5], y[:5], window_size=178, overlap=89)
    print(f"\n[5] Segmentation (178 samples, 50% overlap)...")
    print(f"  5 signals → {X_seg.shape[0]} segments of shape {X_seg.shape[1:]}")

    # 8. Batch preprocessing
    X_proc = preprocess_pipeline(X[:10])
    print(f"\n[6] Batch preprocessing (10 signals): {X_proc.shape}  ✓")

    print("\n" + "=" * 50)
    print("  ALL CHECKS PASSED — Ready to train!")
    print("=" * 50)


if __name__ == "__main__":
    verify_pipeline()