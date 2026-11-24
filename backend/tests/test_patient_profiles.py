import os
import sys
import unittest
from unittest.mock import Mock, patch

from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from patient_profiles import create_patient_blueprint


class PatientProfileRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(
            create_patient_blueprint(lambda: ("https://project.supabase.co", "public-key"))
        )
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_patient_routes_reject_requests_without_bearer_token(self):
        with patch("patient_profiles.requests.get") as auth_request:
            current = self.client.get("/api/patient/current")
            saved = self.client.post("/api/patient/save", json={"name": "Test"})

        self.assertEqual(current.status_code, 401)
        self.assertEqual(saved.status_code, 401)
        auth_request.assert_not_called()

    @patch("patient_profiles.requests.request")
    @patch("patient_profiles.requests.get")
    def test_profile_read_is_scoped_to_verified_user(self, auth_request, table_request):
        auth_request.return_value = Mock(status_code=200, json=Mock(return_value={"id": "user-a"}))
        profile = {"name": "Test", "allergies": "None"}
        table_request.return_value = Mock(ok=True, json=Mock(return_value=[{"profile": profile}]))

        response = self.client.get(
            "/api/patient/current", headers={"Authorization": "Bearer valid-user-token"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["patient"], profile)
        request_args = table_request.call_args
        self.assertEqual(request_args.kwargs["params"]["user_id"], "eq.user-a")
        self.assertEqual(
            request_args.kwargs["headers"]["Authorization"], "Bearer valid-user-token"
        )

    @patch("patient_profiles.requests.request")
    @patch("patient_profiles.requests.get")
    def test_profile_write_uses_verified_user_not_client_user_id(self, auth_request, table_request):
        auth_request.return_value = Mock(status_code=200, json=Mock(return_value={"id": "user-a"}))
        table_request.return_value = Mock(ok=True, json=Mock(return_value=[]))

        response = self.client.post(
            "/api/patient/save",
            headers={"Authorization": "Bearer valid-user-token"},
            json={"name": "Test", "user_id": "user-b"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(table_request.call_args.kwargs["json"]["user_id"], "user-a")
        self.assertEqual(table_request.call_args.kwargs["params"]["user_id"], "eq.user-a")

    @patch("patient_profiles.requests.request")
    @patch("patient_profiles.requests.get")
    def test_patient_fields_are_length_limited(self, auth_request, table_request):
        auth_request.return_value = Mock(status_code=200, json=Mock(return_value={"id": "user-a"}))

        response = self.client.post(
            "/api/patient/save",
            headers={"Authorization": "Bearer valid-user-token"},
            json={"name": "x" * 201},
        )

        self.assertEqual(response.status_code, 400)
        table_request.assert_not_called()


if __name__ == "__main__":
    unittest.main()
