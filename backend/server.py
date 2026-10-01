import os
import json
import logging
from datetime import datetime, timezone, date, timedelta
from functools import lru_cache

import httpx
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

app = FastAPI()
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger("roomie")
logging.basicConfig(level=logging.INFO)


@lru_cache(maxsize=1)
def jwks_client() -> PyJWKClient:
    return PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing bearer token")
    token = creds.credentials
    try:
        key = jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
            options={"require": ["exp", "sub", "aud"]},
        )
        return {"claims": claims, "token": token}
    except jwt.PyJWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(401, "Invalid or expired token")


async def supa_get(token: str, path: str):
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY},
        )
    if res.status_code >= 400:
        logger.error("supabase GET %s -> %s %s", path, res.status_code, res.text[:200])
        return []
    return res.json()


async def supa_post(token: str, path: str, payload: dict):
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json=payload,
        )
    return res.status_code < 400


class SuggestRequest(BaseModel):
    prompt: str
    max_spend: float | None = None


def expiry_days(expiry: str | None) -> int | None:
    if not expiry:
        return None
    try:
        target = date.fromisoformat(expiry)
    except ValueError:
        return None
    return (target - datetime.now(timezone.utc).date()).days


def normalize_meal(raw: dict) -> dict | None:
    try:
        missing = []
        for m in raw.get("missing_ingredients", []) or []:
            if isinstance(m, str):
                missing.append({"name": m, "estimated_price": None})
            elif isinstance(m, dict) and m.get("name"):
                missing.append({
                    "name": str(m["name"]),
                    "estimated_price": m.get("estimated_price"),
                    "quantity": m.get("quantity"),
                    "unit": m.get("unit"),
                })
        instructions = raw.get("instructions", []) or []
        if isinstance(instructions, str):
            instructions = [instructions]
        return {
            "name": str(raw["name"]),
            "category": str(raw.get("category", "Meal")),
            "prep_time_minutes": int(raw.get("prep_time_minutes", 30)),
            "difficulty": str(raw.get("difficulty", "Easy")),
            "servings": int(raw.get("servings", 2)),
            "available_ingredients": [str(a) for a in raw.get("available_ingredients", []) or []],
            "missing_ingredients": missing,
            "estimated_additional_cost": float(raw.get("estimated_additional_cost", 0) or 0),
            "reason": str(raw.get("reason", "")),
            "instructions": [str(s) for s in instructions],
            "uses": raw.get("uses") or [],
        }
    except Exception as e:
        logger.warning("dropping malformed meal: %s", e)
        return None


@app.get("/api/")
async def root():
    return {"message": "Roomie API"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


AI_FAIL_MSG = "I couldn't generate meal ideas right now. Your inventory is safe. Try again in a moment."


async def build_context(token: str, user_id: str, max_spend: float | None):
    memberships = await supa_get(token, f"household_members?select=household_id&user_id=eq.{user_id}&limit=1")
    if not memberships:
        raise HTTPException(400, "You are not part of a household yet")
    hid = memberships[0]["household_id"]
    inventory, members, prefs, wallet, history = await gather_context(token, hid, user_id)
    balance = sum(float(t.get("amount", 0)) for t in wallet)
    inv_ctx = sorted(
        [
            {
                "name": i["name"],
                "quantity": float(i.get("quantity", 0)),
                "unit": i.get("unit", "pcs"),
                "expiry_days": expiry_days(i.get("expiry_date")),
            }
            for i in inventory
            if float(i.get("quantity", 0)) > 0
        ],
        key=lambda x: x["expiry_days"] if x["expiry_days"] is not None else 9999,
    )
    return hid, {
        "household_size": max(len(members), 1),
        "inventory": inv_ctx,
        "available_budget": round(balance, 2),
        "dietary_preferences": {
            "diet_type": (prefs or {}).get("diet_type", "none"),
            "allergies": (prefs or {}).get("allergies", []),
            "disliked_foods": (prefs or {}).get("disliked_foods", []),
        },
        "max_additional_spend": max_spend,
        "recent_meals": [m.get("name") for h in history for m in (h.get("meals") or [])][:8],
    }


async def ask_gemini(session_id: str, system: str, text: str) -> str:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
            "gemini", "gemini-3-flash-preview"
        )
        return await chat.send_message(UserMessage(text=text))
    except Exception as e:
        logger.error("AI call failed: %s", e)
        raise HTTPException(503, AI_FAIL_MSG)


def extract_json(reply: str) -> dict | None:
    text = (reply or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


class PlanRequest(BaseModel):
    days: int
    start_date: str
    max_spend: float | None = None


MEAL_TYPES = ("breakfast", "lunch", "dinner")


@app.post("/api/ai/meal-plan")
async def meal_plan(req: PlanRequest, auth=Depends(current_user)):
    if req.days < 1 or req.days > 7:
        raise HTTPException(422, "Plan between 1 and 7 days")
    try:
        start = date.fromisoformat(req.start_date)
    except ValueError:
        raise HTTPException(422, "Invalid start date")
    token, user_id = auth["token"], auth["claims"]["sub"]
    hid, context = await build_context(token, user_id, req.max_spend)
    context["days_to_plan"] = req.days

    system = (
        "You are Kitchen AI, planning meals for a shared household. You receive JSON with real inventory "
        "(sorted by days until expiry), food budget, household size and dietary preferences. "
        "Plan breakfast, lunch and dinner for each day. Use ingredients that expire soonest in the EARLIEST days. "
        "Mostly use what is at home; keep total extra spend modest and within available_budget "
        "(and within max_additional_spend for the whole plan if set). Do not repeat a dish. "
        "Respect diet and allergies strictly. Keep reasons under 15 words. "
        "Reply with STRICT JSON only, no markdown: "
        '{"days": [{"day_index": int (0-based), "meals": [{"meal_type": "breakfast|lunch|dinner", "name": str, '
        '"prep_time_minutes": int, "available_ingredients": [str], '
        '"missing_ingredients": [{"name": str, "estimated_price": number}], '
        '"estimated_additional_cost": number, "reason": str}]}]}'
    )
    reply = await ask_gemini(
        f"plan-{hid}-{user_id}", system,
        f"Plan {req.days} day(s).\n\nContext:\n{json.dumps(context, default=str)}",
    )
    data = extract_json(reply) or {}
    plan = []
    for day in data.get("days") or []:
        if not isinstance(day, dict):
            continue
        try:
            idx = int(day.get("day_index", 0))
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= req.days:
            continue
        meal_date = (start + timedelta(days=idx)).isoformat()
        for meal in day.get("meals") or []:
            if not isinstance(meal, dict) or not meal.get("name"):
                continue
            mtype = str(meal.get("meal_type", "")).lower()
            if mtype not in MEAL_TYPES:
                continue
            normalized = normalize_meal({**meal, "category": mtype.title()})
            if normalized:
                plan.append({"meal_date": meal_date, "meal_type": mtype, "meal_name": normalized["name"], "recipe_data": normalized})
    if not plan:
        raise HTTPException(503, AI_FAIL_MSG)
    return {"plan": plan}


@app.post("/api/ai/suggest-meals")
async def suggest_meals(req: SuggestRequest, auth=Depends(current_user)):
    token = auth["token"]
    user_id = auth["claims"]["sub"]
    hid, context = await build_context(token, user_id, req.max_spend)

    system = (
        "You are Kitchen AI for a shared household app. You receive JSON context with the household's "
        "real inventory (with days until expiry), food budget and dietary preferences. "
        "Suggest 3 meals that mostly use what is already at home. Prioritise ingredients that expire "
        "soonest to reduce food waste, and say so in the reason. Respect dietary preferences and allergies "
        "strictly. Never invent ingredients as 'available' that are not in the inventory. "
        "Estimated additional cost must be the sum of realistic prices (in INR) of the missing ingredients only. "
        "If max_additional_spend is set, every suggestion must stay within it. "
        "If max_additional_spend is 0, only suggest meals with no missing ingredients. "
        "Reply with STRICT JSON only, no markdown, no commentary, exactly this shape: "
        '{"meals": [{"name": str, "category": str, "prep_time_minutes": int, "difficulty": "Easy|Medium|Hard", '
        '"servings": int, "available_ingredients": [str], '
        '"missing_ingredients": [{"name": str, "estimated_price": number, "quantity": number, "unit": str}], '
        '"estimated_additional_cost": number, "reason": str, "instructions": [str], '
        '"uses": [{"name": str, "quantity": number, "unit": str}]}]}. '
        "'uses' lists the inventory items and approximate quantities the recipe consumes."
    )

    reply = await ask_gemini(
        f"meals-{hid}-{user_id}", system,
        f"Request: {req.prompt}\n\nContext:\n{json.dumps(context, default=str)}",
    )

    meals = parse_meals(reply)
    if not meals:
        raise HTTPException(
            503,
            "I couldn't generate meal ideas right now. Your inventory is safe. Try again in a moment.",
        )

    await supa_post(token, "ai_meal_history", {
        "household_id": hid,
        "requested_by": user_id,
        "prompt": req.prompt,
        "meals": [{"name": m["name"]} for m in meals],
    })

    return {"meals": meals}


async def gather_context(token: str, hid: str, user_id: str):
    import asyncio

    inventory, members, prefs, wallet, history = await asyncio.gather(
        supa_get(token, f"inventory_items?select=name,quantity,unit,expiry_date&household_id=eq.{hid}"),
        supa_get(token, f"household_members?select=user_id&household_id=eq.{hid}"),
        supa_get(token, f"user_preferences?select=diet_type,allergies,disliked_foods&user_id=eq.{user_id}"),
        supa_get(token, f"wallet_transactions?select=amount&household_id=eq.{hid}"),
        supa_get(token, f"ai_meal_history?select=meals&household_id=eq.{hid}&order=created_at.desc&limit=5"),
    )
    return inventory, members, (prefs[0] if prefs else {}), wallet, history


def parse_meals(reply: str) -> list[dict]:
    text = (reply or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return []
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    raw_meals = data.get("meals")
    if not isinstance(raw_meals, list):
        return []
    meals = []
    for raw in raw_meals:
        if isinstance(raw, dict) and raw.get("name"):
            m = normalize_meal(raw)
            if m:
                meals.append(m)
    return meals[:4]


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
