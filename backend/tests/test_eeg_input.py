import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from eeg_input import parse_eeg_samples


class ParseEegSamplesTests(unittest.TestCase):
    def test_csv_with_inconsistent_column_counts_is_flattened(self):
        content = "0.1\n0.2,0.3\n0.4,0.5,0.6\n"

        self.assertEqual(parse_eeg_samples(content), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6])

    def test_csv_headers_and_empty_cells_are_ignored(self):
        content = "sample,channel_a,channel_b\n1,0.25,\n2,0.5,0.75\n"

        self.assertEqual(parse_eeg_samples(content), [1.0, 0.25, 2.0, 0.5, 0.75])

    def test_semicolon_delimited_data_is_supported(self):
        self.assertEqual(parse_eeg_samples("0.1;0.2\n0.3\n"), [0.1, 0.2, 0.3])

    def test_whitespace_delimited_text_is_supported(self):
        self.assertEqual(parse_eeg_samples("0.1 0.2\n0.3\t0.4"), [0.1, 0.2, 0.3, 0.4])

    def test_non_finite_samples_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            parse_eeg_samples("0.1,nan,0.3")

    def test_files_without_numeric_samples_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "No numeric EEG samples"):
            parse_eeg_samples("time,channel\nstart,lead I\n")

    def test_malformed_quoted_csv_returns_a_readable_error(self):
        with self.assertRaisesRegex(ValueError, "valid delimited text"):
            parse_eeg_samples('"0.1,0.2\n')


if __name__ == "__main__":
    unittest.main()
