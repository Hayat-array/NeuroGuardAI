import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from security import get_security_settings


class SecuritySettingsTests(unittest.TestCase):
    def test_production_requires_secret_key(self):
        with self.assertRaisesRegex(RuntimeError, "SECRET_KEY must be set"):
            get_security_settings({"FLASK_ENV": "production"})

    def test_development_uses_random_secret_when_missing(self):
        settings = get_security_settings({"FLASK_ENV": "development"})
        self.assertIsInstance(settings["secret_key"], bytes)
        self.assertGreaterEqual(len(settings["secret_key"]), 32)
        self.assertFalse(settings["production"])

    def test_provided_secret_is_used(self):
        settings = get_security_settings({"SECRET_KEY": "configured-secret", "FLASK_ENV": "production"})
        self.assertEqual(settings["secret_key"], "configured-secret")
        self.assertTrue(settings["production"])

    def test_cors_is_an_explicit_normalized_origin_list(self):
        settings = get_security_settings({
            "FRONTEND_URL": "https://app.example.com/",
            "CORS_ALLOWED_ORIGINS": " https://app.example.com/,https://admin.example.com ",
        })
        self.assertEqual(
            settings["allowed_origins"],
            ["https://admin.example.com", "https://app.example.com"],
        )


if __name__ == "__main__":
    unittest.main()
