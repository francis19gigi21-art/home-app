"""
Roomie backend API tests.
Covers: health/root endpoints, JWT auth validation, Kitchen AI suggest-meals endpoint.
Note: Most CRUD happens client-side via Supabase; backend only hosts AI endpoints.
"""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", os.environ.get("EXPO_PUBLIC_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "https://chodcbmrjkruaigrevfj.supabase.co")
SUPABASE_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_hYq7luO7ghaN8Ff1-IyYTA_YuaV6RCD")

assert BASE_URL, "BASE_URL could not be determined"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def john_token(api_client):
    """Get Supabase JWT for John."""
    r = api_client.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_KEY},
        json={"email": "john@roomie.app", "password": "RoomieDemo123"},
        timeout=20,
    )
    assert r.status_code == 200, f"Supabase login failed: {r.text[:200]}"
    return r.json()["access_token"]


class TestHealth:
    """Health check tests (run first)"""

    def test_health_ok(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_root_message(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


class TestAuthGuards:
    """Auth enforcement on AI endpoint"""

    def test_suggest_meals_no_token_rejected(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ai/suggest-meals", json={"prompt": "dinner"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_suggest_meals_bad_token_rejected(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/ai/suggest-meals",
            headers={"Authorization": "Bearer invalid.token.here"},
            json={"prompt": "dinner"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_suggest_meals_missing_prompt_validation(self, api_client, john_token):
        r = api_client.post(
            f"{BASE_URL}/api/ai/suggest-meals",
            headers={"Authorization": f"Bearer {john_token}"},
            json={},
            timeout=15,
        )
        assert r.status_code == 422


class TestSuggestMeals:
    """Kitchen AI meal suggestion tests (LLM-backed, slower)"""

    def test_suggest_meals_success_structure(self, api_client, john_token):
        r = api_client.post(
            f"{BASE_URL}/api/ai/suggest-meals",
            headers={"Authorization": f"Bearer {john_token}"},
            json={"prompt": "What can we cook tonight?"},
            timeout=90,
        )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        data = r.json()
        assert "meals" in data and isinstance(data["meals"], list) and len(data["meals"]) >= 1
        meal = data["meals"][0]
        for field in ("name", "prep_time_minutes", "difficulty", "servings", "available_ingredients", "missing_ingredients", "reason"):
            assert field in meal, f"missing field {field}"
        assert isinstance(meal["prep_time_minutes"], int)
        assert isinstance(meal["missing_ingredients"], list)

    def test_suggest_meals_max_spend_zero(self, api_client, john_token):
        """No-spend mode should ideally return meals with no missing ingredients (or empty)."""
        r = api_client.post(
            f"{BASE_URL}/api/ai/suggest-meals",
            headers={"Authorization": f"Bearer {john_token}"},
            json={"prompt": "Suggest meals using only what we already have.", "max_spend": 0},
            timeout=90,
        )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        meals = r.json().get("meals", [])
        for m in meals:
            assert m["estimated_additional_cost"] == 0, f"meal {m['name']} exceeds 0 max spend"
