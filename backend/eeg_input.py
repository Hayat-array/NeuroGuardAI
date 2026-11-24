import csv
import io
import math
import re


MAX_EEG_SAMPLES = 1_000_000
DELIMITERS = (",", ";")


def parse_eeg_samples(content):
    """Extract finite numeric samples from delimited or whitespace-separated text."""
    if not isinstance(content, str) or not content.strip():
        raise ValueError("No EEG values were provided.")

    delimiter = max(DELIMITERS, key=content.count)
    if content.count(delimiter):
        rows = csv.reader(io.StringIO(content), delimiter=delimiter, skipinitialspace=True, strict=True)
    else:
        rows = (re.split(r"\s+", line.strip()) for line in content.splitlines() if line.strip())

    samples = []
    try:
        for row in rows:
            for cell in row:
                cell = cell.strip().lstrip("\ufeff")
                if not cell:
                    continue
                try:
                    value = float(cell)
                except ValueError:
                    continue
                if not math.isfinite(value):
                    raise ValueError("EEG samples must be finite numeric values.")
                samples.append(value)
                if len(samples) > MAX_EEG_SAMPLES:
                    raise ValueError(f"The file exceeds the {MAX_EEG_SAMPLES:,}-sample limit.")
    except csv.Error as exc:
        raise ValueError("The input is not valid delimited text.") from exc

    if not samples:
        raise ValueError("No numeric EEG samples were found in the input.")

    return samples
