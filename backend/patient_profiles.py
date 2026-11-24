import time

import requests
from flask import Blueprint, current_app, jsonify, request


def create_patient_blueprint(supabase_configuration):
    blueprint = Blueprint("patient_profiles", __name__)

    def authenticated_user():
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return None
        access_token = authorization[7:].strip()
        supabase_url, api_key = supabase_configuration()
        if not access_token or not supabase_url or not api_key:
            return None
        try:
            response = requests.get(
                f"{supabase_url}/auth/v1/user",
                headers={"apikey": api_key, "Authorization": f"Bearer {access_token}"},
                timeout=8,
            )
            if response.status_code != 200:
                return None
            user = response.json()
            return user if isinstance(user, dict) and user.get("id") else None
        except (requests.RequestException, ValueError):
            return None

    def patient_table_request(user_id, method, **kwargs):
        supabase_url, api_key = supabase_configuration()
        return requests.request(
            method,
            f"{supabase_url}/rest/v1/patient_profiles",
            params={"user_id": f"eq.{user_id}", "select": "profile"},
            headers={
                "apikey": api_key,
                "Authorization": request.headers.get("Authorization", "").strip(),
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
            timeout=8,
            **kwargs,
        )

    @blueprint.get("/api/auth/config")
    def auth_config():
        supabase_url, api_key = supabase_configuration()
        if not supabase_url or not api_key:
            return jsonify({"error": "Authentication is not configured."}), 503
        return jsonify({"url": supabase_url, "key": api_key})

    @blueprint.get("/api/patient/current")
    def get_current_patient():
        user = authenticated_user()
        if not user:
            return jsonify({"ok": False, "error": "Authentication required."}), 401
        try:
            response = patient_table_request(user["id"], "GET")
            if not response.ok:
                current_app.logger.error("Supabase patient read failed: %s", response.status_code)
                return jsonify({"ok": False, "error": "Unable to load patient profile."}), 502
            rows = response.json()
            return jsonify({"ok": True, "patient": rows[0]["profile"] if rows else None})
        except requests.RequestException:
            return jsonify({"ok": False, "error": "Patient storage is unavailable."}), 503

    @blueprint.post("/api/patient/save")
    def save_patient():
        user = authenticated_user()
        if not user:
            return jsonify({"ok": False, "error": "Authentication required."}), 401

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"ok": False, "error": "A JSON profile is required."}), 400

        field_limits = {
            "name": 200, "patient_id": 64, "age": 3, "sex": 20, "dob": 10,
            "phone": 32, "email": 254, "blood_group": 8, "emergency_contact": 250,
            "allergies": 2000, "medications": 2000, "history_notes": 4000,
        }
        profile = {}
        for field, limit in field_limits.items():
            value = data.get(field, "")
            if value is None:
                value = ""
            if not isinstance(value, str):
                return jsonify({"ok": False, "error": f"Invalid {field} value."}), 400
            value = value.strip()
            if len(value) > limit:
                label = field.replace("_", " ").title()
                return jsonify({"ok": False, "error": f"{label} is too long."}), 400
            profile[field] = value

        if not profile["name"]:
            return jsonify({"ok": False, "error": "Patient name is required."}), 400
        profile["patient_id"] = profile["patient_id"] or f"PT-{time.strftime('%Y%m%d-%H%M%S')}"
        profile["updated_at"] = time.time()

        try:
            response = patient_table_request(
                user["id"], "POST", json={"user_id": user["id"], "profile": profile}
            )
            if not response.ok:
                current_app.logger.error("Supabase patient save failed: %s", response.status_code)
                return jsonify({"ok": False, "error": "Unable to save patient profile."}), 502
            return jsonify({"ok": True, "patient": profile})
        except requests.RequestException:
            return jsonify({"ok": False, "error": "Patient storage is unavailable."}), 503

    return blueprint
