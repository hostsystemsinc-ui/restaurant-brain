import os
import re
import json as _json
import uuid as _uuid
import threading
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from supabase import create_client
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, timezone

# ── Environment ─────────────────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get("SUPABASE_URL")
SUPABASE_KEY  = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID      = os.environ.get("RESTAURANT_ID")
DEMO_RESTAURANT_ID = "dec0cafe-0000-4000-8000-000000000001"
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TWILIO_SID    = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM   = os.environ.get("TWILIO_FROM_NUMBER", "")
TEXTBELT_KEY  = os.environ.get("TEXTBELT_KEY", "textbelt")  # fallback SMS (textbelt.com; "textbelt" = 1 free/day)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# In-memory: tracks the ISO timestamp when a host last set quoted_wait for each entry.
# Used by the guest page to detect a timer reset even when the new value equals the old one.
# Cleared on server restart (acceptable — guests resume with best-effort timing).
_wait_set_at: dict = {}

# In-memory: tracks which guest is at which table (keyed by "rid:table_number").
# Populated by seat-to-table, cleared by table clear.
_table_occupants: dict = {}   # { "rid:table_number": { "name": str, "party_size": int, "entry_id": str } }
_occupants_lock   = threading.Lock()   # Protects concurrent read/write of _table_occupants

# ── Demo submissions (persisted in memory + Supabase) ────────────────────────
_demo_submissions: list = []
_submissions_lock = threading.Lock()   # Protects concurrent access to _demo_submissions

def _load_demo_subs():
    global _demo_submissions
    try:
        res = supabase.table("demo_submissions").select("*").order("receivedAt", desc=True).execute()
        if res.data:
            _demo_submissions = res.data
            return
    except Exception:
        pass

def _save_demo_sub_to_db(sub: dict):
    try:
        supabase.table("demo_submissions").insert(sub).execute()
    except Exception:
        pass

# Load existing submissions in the background so startup is never blocked
threading.Thread(target=_load_demo_subs, daemon=True).start()

def _seed_wait_set_at():
    """Repopulate _wait_set_at from DB on startup so remaining_wait stays accurate after restarts."""
    try:
        res = supabase.table("queue_entries") \
            .select("id, quoted_wait_set_at") \
            .in_("status", ["waiting", "ready"]) \
            .not_.is_("quoted_wait_set_at", "null") \
            .execute()
        for row in (res.data or []):
            if row.get("quoted_wait_set_at"):
                _wait_set_at[row["id"]] = row["quoted_wait_set_at"]
        if res.data:
            print(f"[startup] Seeded _wait_set_at for {len(res.data)} active queue entries")
    except Exception as e:
        print(f"[startup] _seed_wait_set_at failed (column may not exist yet): {e}")

threading.Thread(target=_seed_wait_set_at, daemon=True).start()

def _ensure_demo_tables():
    """Guarantee the demo restaurant + its 16 tables exist in the DB.
    Idempotent — inserts only the table numbers that are missing.
    Also clears stale in-memory occupant state for the demo restaurant."""
    try:
        rid = DEMO_RESTAURANT_ID
        # Ensure demo restaurant row exists
        if not supabase.table("restaurants").select("id").eq("id", rid).execute().data:
            supabase.table("restaurants").insert({
                "id": rid, "name": "Demo Restaurant", "slug": "demo"
            }).execute()
        # Find which table numbers already exist
        existing = supabase.table("tables").select("table_number").eq("restaurant_id", rid).execute().data or []
        existing_nums = {row["table_number"] for row in existing}
        capacities = [2,2,2,4,4,4,6,6,6,4,4,4,1,1,1,1]
        missing = [
            {"restaurant_id": rid, "table_number": i+1, "capacity": c, "status": "available"}
            for i, c in enumerate(capacities)
            if (i+1) not in existing_nums
        ]
        if missing:
            supabase.table("tables").insert(missing).execute()
            print(f"[startup] Inserted {len(missing)} missing demo tables: {[m['table_number'] for m in missing]}")
        # Clear stale in-memory occupants for demo restaurant on every startup
        prefix = f"{rid}:"
        stale_keys = [k for k in list(_table_occupants.keys()) if k.startswith(prefix)]
        for k in stale_keys:
            del _table_occupants[k]
        if stale_keys:
            print(f"[startup] Cleared {len(stale_keys)} stale demo occupant(s): {stale_keys}")
    except Exception as e:
        print(f"[startup] _ensure_demo_tables failed: {e}")

threading.Thread(target=_ensure_demo_tables, daemon=True).start()

WALNUT_RESTAURANTS = [
    {
        "id":   "0001cafe-0001-4000-8000-000000000001",
        "name": "The Original Walnut Cafe",
        "slug": "walnut-original",
    },
    {
        "id":   "0002cafe-0001-4000-8000-000000000002",
        "name": "The Southside Walnut Cafe",
        "slug": "walnut-southside",
    },
]

def _ensure_walnut_restaurants():
    """Guarantee both Walnut Cafe restaurants + their 16 tables exist in the DB.
    Idempotent — only inserts rows that are missing."""
    # Same layout as demo: 16 tables matching the HOST floor plan
    capacities = [2, 2, 2, 4, 4, 4, 6, 6, 6, 4, 4, 4, 1, 1, 1, 1]
    for rest in WALNUT_RESTAURANTS:
        rid = rest["id"]
        try:
            if not supabase.table("restaurants").select("id").eq("id", rid).execute().data:
                supabase.table("restaurants").insert({
                    "id": rid, "name": rest["name"], "slug": rest["slug"]
                }).execute()
                print(f"[startup] Created restaurant: {rest['name']}")
            existing = supabase.table("tables").select("table_number").eq("restaurant_id", rid).execute().data or []
            existing_nums = {row["table_number"] for row in existing}
            missing = [
                {"restaurant_id": rid, "table_number": i + 1, "capacity": c, "status": "available"}
                for i, c in enumerate(capacities)
                if (i + 1) not in existing_nums
            ]
            if missing:
                supabase.table("tables").insert(missing).execute()
                print(f"[startup] Inserted {len(missing)} tables for {rest['name']}: {[m['table_number'] for m in missing]}")
        except Exception as e:
            print(f"[startup] _ensure_walnut_restaurants failed for {rest['name']}: {e}")

threading.Thread(target=_ensure_walnut_restaurants, daemon=True).start()

app = FastAPI(title="Restaurant Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hostplatform.net", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Owner-Secret"],
)

# ── Pydantic models ──────────────────────────────────────────────────────────

class JoinQueueRequest(BaseModel):
    name:          Optional[str] = None
    party_size:    int = Field(ge=1, le=20)
    phone:         Optional[str] = None
    notes:         Optional[str] = None
    preference:    Optional[str] = "asap"  # asap | 15min | 30min | HH:MM
    source:        Optional[str] = "nfc"   # nfc | host | phone | web
    restaurant_id: Optional[str] = None    # override env RESTAURANT_ID
    quoted_wait:   Optional[int] = None    # host-set wait time (minutes)

class CameraEventRequest(BaseModel):
    zone:         str
    people_count: int

class DeliveryEventRequest(BaseModel):
    provider:     str
    active_orders: int

class ThroughputEventRequest(BaseModel):
    metric:   str
    value:    float
    metadata: Optional[dict] = None

class ReservationRequest(BaseModel):
    guest_name:    str
    party_size:    int           = Field(ge=1, le=20, default=2)
    date:          str           # YYYY-MM-DD
    time:          str           # HH:MM (24-hour)
    phone:         Optional[str] = None
    email:         Optional[str] = None
    notes:         Optional[str] = None
    source:        Optional[str] = "host"
    restaurant_id: Optional[str] = None   # override env RESTAURANT_ID

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("date must be YYYY-MM-DD")
        return v

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("time must be HH:MM")
        return v

class QueueUpdateRequest(BaseModel):
    quoted_wait: Optional[int]  = Field(None, ge=1, le=180)
    party_size:  Optional[int]  = Field(None, ge=1, le=20)
    phone:       Optional[str]  = None
    notes:       Optional[str]  = None
    paused:      Optional[bool] = None

class SettingsRequest(BaseModel):
    opentable_ical_url: Optional[str] = None

class SyncIcalRequest(BaseModel):
    url: str

# ── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat()

def _e164(phone: str) -> Optional[str]:
    """Normalize a phone number to E.164 format, assuming US (+1) if no country code."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) > 7:
        return f"+{digits}"
    return None

def _send_sms(to_phone: str, body: str) -> tuple[bool, str]:
    """Send an SMS via Textbelt (primary) then Twilio (fallback).
    Textbelt avoids the US A2P 10DLC carrier block that affects unregistered long-code numbers.
    Set TEXTBELT_KEY in Railway env vars with a paid key from textbelt.com for reliable delivery.
    """
    normalized = _e164(to_phone)
    if not normalized:
        return False, f"Invalid phone number: {to_phone!r}"

    errors: list[str] = []

    # ── Textbelt (primary — avoids A2P 10DLC carrier blocks) ─────────────────
    if TEXTBELT_KEY:
        try:
            import urllib.request, urllib.parse, json as _json
            payload = urllib.parse.urlencode({
                "phone": normalized,
                "message": body,
                "key": TEXTBELT_KEY,
            }).encode()
            req = urllib.request.Request("https://textbelt.com/text", data=payload, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = _json.loads(resp.read())
            print(f"[Textbelt] result={result}")
            if result.get("success"):
                return True, ""
            tb_err = result.get("error", "unknown")
            errors.append(f"Textbelt: {tb_err}")
            print(f"[Textbelt] failed: {tb_err}")
        except Exception as e:
            errors.append(f"Textbelt: {e}")
            print(f"[Textbelt] exception: {e}")

    # ── Twilio (fallback — blocked by US carriers without A2P 10DLC) ──────────
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM:
        try:
            from twilio.rest import Client
            import time
            client = Client(TWILIO_SID, TWILIO_TOKEN)
            msg = client.messages.create(body=body, from_=TWILIO_FROM, to=normalized)
            print(f"[Twilio] queued sid={msg.sid} status={msg.status}")
            # Wait for carrier feedback — A2P 10DLC errors (30034) surface within ~5s
            time.sleep(5)
            msg = client.messages(msg.sid).fetch()
            print(f"[Twilio] status={msg.status} error_code={msg.error_code} msg={msg.error_message!r}")
            if msg.status not in ("failed", "undelivered") and not msg.error_code:
                return True, ""
            tw_err = msg.error_message or f"status={msg.status} code={msg.error_code}"
            errors.append(f"Twilio: {tw_err}")
            print(f"[Twilio] delivery failed: {tw_err}")
        except Exception as e:
            errors.append(f"Twilio: {e}")
            print(f"[Twilio] exception: {e}")
    else:
        errors.append("Twilio: not configured")

    return False, " | ".join(errors) if errors else "No SMS provider configured"

def _rid(req_id: Optional[str] = None) -> str:
    """Return req_id if provided, otherwise fall back to the env RESTAURANT_ID."""
    return req_id or RESTAURANT_ID

def _active_queue(rid: Optional[str] = None) -> list:
    return (
        supabase.table("queue_entries")
        .select("*")
        .eq("restaurant_id", _rid(rid))
        .in_("status", ["waiting", "ready"])
        .order("created_at")
        .execute()
        .data
    )

def _wait_estimate_with(parties_ahead: int, party_size: int, tables: list) -> int:
    try:
        available   = [t for t in tables if t["status"] == "available"]
        if parties_ahead == 0 and available:
            return 0
        seats_avail = sum(t["capacity"] for t in available)
        if seats_avail >= party_size * max(1, parties_ahead):
            return max(5, parties_ahead * 10)
        return max(15, parties_ahead * 20)
    except Exception:
        return max(5, parties_ahead * 20)

def _wait_estimate(parties_ahead: int, party_size: int = 2, rid: Optional[str] = None) -> int:
    tables = supabase.table("tables").select("status,capacity").eq("restaurant_id", _rid(rid)).execute().data
    return _wait_estimate_with(parties_ahead, party_size, tables)

def _set_quoted_wait(entry_id: str, minutes: int, now: str) -> None:
    """
    Write quoted_wait (and quoted_wait_set_at if the column exists) to the DB.
    Falls back to writing only quoted_wait when the migration hasn't run yet,
    so the app never crashes due to a missing column.
    """
    try:
        supabase.table("queue_entries").update({
            "quoted_wait": minutes,
            "quoted_wait_set_at": now,
        }).eq("id", entry_id).execute()
    except Exception:
        # Column doesn't exist yet — write without it (migration pending)
        supabase.table("queue_entries").update({
            "quoted_wait": minutes,
        }).eq("id", entry_id).execute()

def _remaining_wait(entry: dict) -> int:
    """
    Return quoted_wait minus elapsed time since it was set, clamped to 0.
    Falls back to position-based estimate if no quoted_wait has been set.

    The set-time is read from:
      1. entry["quoted_wait_set_at"]  — DB column (survives server restarts)
      2. _wait_set_at[entry_id]        — in-memory fallback (lost on restart)
    If neither is available the raw quoted_wait is returned unchanged (safe default).
    """
    qw = entry.get("quoted_wait")
    if qw is None:
        return entry.get("wait_estimate") or 0

    # Prefer DB-persisted timestamp so accuracy survives server restarts
    set_at_str = entry.get("quoted_wait_set_at") or _wait_set_at.get(entry.get("id"))
    if set_at_str:
        try:
            set_dt = datetime.fromisoformat(set_at_str.replace("Z", ""))
            elapsed_minutes = (datetime.utcnow() - set_dt).total_seconds() / 60
            return max(0, int(qw - elapsed_minutes))
        except Exception:
            pass

    # Fallback: no timestamp available — return raw quoted_wait
    return qw

def _ai_insights(tables: list, queue: list) -> Optional[str]:
    if not ANTHROPIC_KEY:
        return None
    try:
        import anthropic
        client    = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        available = sum(1 for t in tables if t["status"] == "available")
        occupied  = len(tables) - available
        waiting   = len([q for q in queue if q["status"] == "waiting"])
        avg_size  = round(sum(q["party_size"] for q in queue) / len(queue), 1) if queue else 0
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    f"Restaurant host assistant. Snapshot:\n"
                    f"- Tables: {available}/{len(tables)} available, {occupied} occupied\n"
                    f"- Queue: {waiting} waiting, avg party {avg_size}\n"
                    f"- Est. wait: {_wait_estimate(waiting)} min\n\n"
                    "Give 2 short actionable insights for the host. "
                    "Each on its own line, max 20 words each. No bullets or numbers."
                )
            }]
        )
        return msg.content[0].text.strip()
    except Exception:
        return None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/twilio")
def debug_twilio():
    """Check Twilio config and attempt a real send to diagnose issues."""
    sid_set   = bool(TWILIO_SID)
    token_set = bool(TWILIO_TOKEN)
    from_set  = bool(TWILIO_FROM)
    if not (sid_set and token_set and from_set):
        return {"configured": False, "sid_set": sid_set, "token_set": token_set, "from_set": from_set}
    try:
        from twilio.rest import Client
        Client(TWILIO_SID, TWILIO_TOKEN).api.accounts(TWILIO_SID).fetch()
        return {"configured": True, "from_number": TWILIO_FROM, "auth_ok": True}
    except Exception as e:
        return {"configured": True, "auth_ok": False, "error": str(e)}

@app.post("/debug/twilio/verify-start")
def twilio_verify_start(phone: str = "+18312470552", secret: Optional[str] = None):
    if not secret or secret != os.environ.get("OWNER_PASS", ""):
        raise HTTPException(status_code=403, detail="Forbidden")
    """Initiate Twilio verification for a phone (required on trial accounts).
    Twilio will call the number; answer and enter the validation_code shown here."""
    if not (TWILIO_SID and TWILIO_TOKEN):
        return {"ok": False, "error": "Twilio not configured"}
    phone_e164 = _e164(phone)
    if not phone_e164:
        return {"ok": False, "error": "Invalid phone number"}
    try:
        from twilio.rest import Client
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        validation = client.validation_requests.create(
            phone_number=phone_e164,
            friendly_name="HOST Demo",
        )
        return {
            "ok": True,
            "phone": phone_e164,
            "validation_code": validation.validation_code,
            "instructions": f"Answer the call to {phone_e164} and enter: {validation.validation_code}",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/debug/twilio/test-sms")
def test_sms(phone: str = "+18312470552", secret: Optional[str] = None):
    """Attempt to send a real test SMS and return the result or exact error."""
    if not secret or secret != os.environ.get("OWNER_PASS", ""):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not (TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM):
        return {"ok": False, "error": "Twilio not fully configured", "sid_set": bool(TWILIO_SID), "token_set": bool(TWILIO_TOKEN), "from_set": bool(TWILIO_FROM)}
    phone_e164 = _e164(phone)
    if not phone_e164:
        return {"ok": False, "error": f"Could not normalize phone: {phone}"}
    try:
        from twilio.rest import Client
        msg = Client(TWILIO_SID, TWILIO_TOKEN).messages.create(
            body="HOST test: Your table is ready! Head to the host now.",
            from_=TWILIO_FROM,
            to=phone_e164,
        )
        return {"ok": True, "sid": msg.sid, "status": msg.status, "to": phone_e164, "from": TWILIO_FROM}
    except Exception as e:
        return {"ok": False, "error": str(e), "to": phone_e164, "from": TWILIO_FROM}

@app.get("/sms/quota")
def sms_quota():
    """Return remaining Textbelt quota for the configured key."""
    key_set = bool(TEXTBELT_KEY and TEXTBELT_KEY != "textbelt")
    if not key_set:
        return {"quota_remaining": None, "key_configured": False}
    try:
        import urllib.request, json as _json
        url = f"https://textbelt.com/quota/{urllib.parse.quote(TEXTBELT_KEY)}"
        with urllib.request.urlopen(url, timeout=6) as resp:
            data = _json.loads(resp.read())
        return {"quota_remaining": data.get("quotaRemaining"), "key_configured": True, "success": data.get("success")}
    except Exception as e:
        return {"quota_remaining": None, "key_configured": True, "error": str(e)}

@app.post("/debug/sms/test")
def test_sms_full(phone: str = "+18312470552", secret: Optional[str] = None):
    """Test the full _send_sms pipeline (Textbelt → Twilio) and return the result."""
    if not secret or secret != os.environ.get("OWNER_PASS", ""):
        raise HTTPException(status_code=403, detail="Forbidden")
    phone_e164 = _e164(phone)
    if not phone_e164:
        return {"ok": False, "error": f"Could not normalize phone: {phone}"}
    ok, err = _send_sms(phone_e164, "HOST test: Your table is ready! Head to the host stand.")
    return {"ok": ok, "error": err, "to": phone_e164, "textbelt_key_set": bool(TEXTBELT_KEY and TEXTBELT_KEY != "textbelt")}

@app.get("/restaurant")
def get_restaurant(restaurant_id: Optional[str] = None):
    rid = _rid(restaurant_id)
    res = supabase.table("restaurants").select("*").eq("id", rid).execute()
    if res.data:
        return res.data[0]
    return {"id": rid, "name": "Restaurant"}

# ── Tables ───────────────────────────────────────────────────────────────────

@app.get("/tables")
def get_tables(restaurant_id: Optional[str] = None):
    return (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", _rid(restaurant_id))
        .order("table_number")
        .execute()
        .data
    )

class OccupyRequest(BaseModel):
    name:       Optional[str] = None
    party_size: Optional[int] = None
    entry_id:   Optional[str] = None

@app.post("/tables/{table_id}/occupy")
def occupy_table(table_id: str, body: Optional[OccupyRequest] = None):
    supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("id", table_id).execute()
    # Update in-memory occupant tracking so cross-view sync reflects the new occupant
    tbl_res = supabase.table("tables").select("table_number, restaurant_id").eq("id", table_id).execute()
    if tbl_res.data:
        t = tbl_res.data[0]
        rid = t.get("restaurant_id") or RESTAURANT_ID
        tnum = t.get("table_number")
        if tnum is not None:
            with _occupants_lock:
                _table_occupants[f"{rid}:{tnum}"] = {
                    "name": (body.name if body and body.name else None) or "Guest",
                    "party_size": (body.party_size if body and body.party_size else None) or 2,
                    "entry_id": (body.entry_id if body else None),
                }
    return {"status": "occupied"}

@app.post("/tables/{table_id}/clear")
def clear_table(table_id: str):
    supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("id", table_id).execute()
    # Remove occupant tracking
    tbl_res = supabase.table("tables").select("table_number, restaurant_id").eq("id", table_id).execute()
    if tbl_res.data:
        t = tbl_res.data[0]
        rid = t.get("restaurant_id") or RESTAURANT_ID
        with _occupants_lock:
            _table_occupants.pop(f"{rid}:{t['table_number']}", None)
    return {"status": "cleared"}

@app.post("/clear-table/{table_id}")  # legacy
def clear_table_legacy(table_id: str):
    return clear_table(table_id)

@app.get("/tables/occupants")
def get_table_occupants(restaurant_id: Optional[str] = None):
    """Return table→guest mapping, merging in-memory dict with DB state so restarts don't clear it."""
    rid = _rid(restaurant_id)
    prefix = f"{rid}:"
    # Start from in-memory (has name/party_size already set)
    with _occupants_lock:
        result: dict = {k.split(":", 1)[1]: v for k, v in _table_occupants.items() if k.startswith(prefix)}
    # Fill any gaps from DB: find tables with status="occupied" not already in result
    try:
        occ_tables = supabase.table("tables").select("table_number").eq("restaurant_id", rid).eq("status", "occupied").execute().data or []
        for t in occ_tables:
            tnum = str(t["table_number"])
            if tnum not in result:
                result[tnum] = {"name": "Guest", "party_size": 2, "entry_id": None}
                with _occupants_lock:
                    _table_occupants[f"{rid}:{t['table_number']}"] = result[tnum]
    except Exception:
        pass
    return result

# ── Queue ────────────────────────────────────────────────────────────────────

@app.get("/queue")
def get_queue(restaurant_id: Optional[str] = None):
    rid     = _rid(restaurant_id)
    entries = _active_queue(rid)
    tables  = supabase.table("tables").select("status,capacity").eq("restaurant_id", rid).execute().data
    for i, e in enumerate(entries):
        e["position"]       = i + 1
        e["wait_estimate"]  = _wait_estimate_with(i, e.get("party_size", 2), tables)
        e["remaining_wait"] = _remaining_wait(e)
        e["wait_set_at"]    = _wait_set_at.get(e["id"])
    return entries

@app.get("/state")
def get_state(restaurant_id: Optional[str] = None):
    rid     = _rid(restaurant_id)
    tables  = supabase.table("tables").select("*").eq("restaurant_id", rid).execute().data
    entries = _active_queue(rid)
    for i, e in enumerate(entries):
        e["position"]       = i + 1
        e["wait_estimate"]  = _wait_estimate_with(i, e.get("party_size", 2), tables)
        e["remaining_wait"] = _remaining_wait(e)
        e["wait_set_at"]    = _wait_set_at.get(e["id"])
    available = sum(1 for t in tables if t["status"] == "available")
    avg_wait  = _wait_estimate_with(len(entries), 2, tables)
    return {"queue": entries, "tables": tables, "avg_wait": avg_wait, "tables_available": available}

@app.get("/waitlist")  # legacy
def get_waitlist_legacy():
    return get_queue()

def _send_join_sms(phone: str, rest_name: str, entry_id: str) -> None:
    short_id = entry_id[:8]
    print(f"[SMS] Sending join SMS to {phone!r} for entry {entry_id}")
    ok, err = _send_sms(
        to_phone=phone,
        body=f"Welcome to {rest_name}! You've been added to the waitlist. Your wait code is {short_id}. We'll text you when your table is ready. Reply STOP to opt out.",
    )
    print(f"[SMS] Join SMS result: ok={ok} err={err!r}")
    if not ok:
        print(f"[SMS] Join SMS failed: {err}")

@app.post("/queue/join")
def join_queue(req: JoinQueueRequest, background_tasks: BackgroundTasks):
    try:
        rid      = _rid(req.restaurant_id)
        tables   = supabase.table("tables").select("status,capacity").eq("restaurant_id", rid).execute().data
        queue    = _active_queue(rid)
        ahead    = len(queue)
        wait_est = _wait_estimate_with(ahead, req.party_size, tables)
        join_time = _now()
        base_insert = {
            "restaurant_id": rid,
            "name":          req.name or "Guest",
            "party_size":    req.party_size,
            "phone":         req.phone,
            "source":        req.source or "nfc",
            "status":        "waiting",
            "quoted_wait":   req.quoted_wait,  # host may supply on join (e.g. analog); null = unquoted
            "arrival_time":  join_time,
            "notes":         req.notes or None,
        }
        # Include quoted_wait_set_at only when a wait is being set (column may not exist pre-migration)
        if req.quoted_wait is not None:
            base_insert["quoted_wait_set_at"] = join_time
        try:
            entry = supabase.table("queue_entries").insert(base_insert).execute()
        except Exception:
            # quoted_wait_set_at column missing — retry without it
            base_insert.pop("quoted_wait_set_at", None)
            entry = supabase.table("queue_entries").insert(base_insert).execute()
        try:
            supabase.table("wait_quotes").insert({
                "restaurant_id": rid,
                "party_size":    req.party_size,
                "quoted_minutes": wait_est,
                "model_version": "v1-rule",
            }).execute()
        except Exception:
            pass
        new_entry = entry.data[0]
        if req.quoted_wait is not None:
            _wait_set_at[new_entry["id"]] = _now()
        # Fire link SMS synchronously for host/analog guests so we KNOW if it worked.
        sms_sent = False
        sms_error = ""
        if req.quoted_wait is not None and req.phone and req.source in ("host", "analog"):
            rest_res  = supabase.table("restaurants").select("name").eq("id", rid).execute()
            rest_name = rest_res.data[0]["name"] if rest_res.data else "the restaurant"
            short_id  = new_entry["id"][:8]
            print(f"[SMS] join_queue: firing SMS to {req.phone!r} entry={new_entry['id']}")
            sms_sent, sms_error = _send_sms(
                to_phone=req.phone,
                body=f"Welcome to {rest_name}! You've been added to the waitlist. Your wait code is {short_id}. We'll text you when your table is ready. Reply STOP to opt out.",
            )
            print(f"[SMS] join_queue result: sent={sms_sent} err={sms_error!r}")
        return {"status": "joined", "entry": new_entry, "wait_estimate": wait_est, "position": ahead + 1, "sms_sent": sms_sent, "sms_error": sms_error}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/join-waitlist")  # legacy
def join_waitlist_legacy(name: Optional[str] = None, party_size: int = 2, phone: Optional[str] = None):
    return join_queue(JoinQueueRequest(name=name, party_size=party_size, phone=phone, source="host"))

@app.get("/queue/{entry_id}")
def get_entry(entry_id: str):
    res = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = res.data[0]
    if entry["status"] in ("waiting", "ready"):
        # Use the entry's own restaurant_id so demo and real restaurants have correct positions
        entry_rid = entry.get("restaurant_id")
        all_ids  = [e["id"] for e in _active_queue(entry_rid)]
        position = (all_ids.index(entry_id) + 1) if entry_id in all_ids else 1
        tables = supabase.table("tables").select("status,capacity").eq("restaurant_id", entry_rid).execute().data
        entry["position"]       = position
        entry["parties_ahead"]  = position - 1
        entry["wait_estimate"]  = _wait_estimate_with(position - 1, entry.get("party_size", 2), tables)
        entry["remaining_wait"] = _remaining_wait(entry)
        entry["wait_set_at"]    = _wait_set_at.get(entry_id)
    return entry

@app.post("/queue/{entry_id}/seat")
def seat_entry(entry_id: str):
    party_res = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not party_res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    party = party_res.data[0]
    if party.get("status") not in ("waiting", "ready"):
        raise HTTPException(status_code=409, detail=f"Entry is already {party.get('status', 'unknown')}")
    # Use the entry's own restaurant_id so demo and real restaurants are kept separate
    entry_rid = party.get("restaurant_id") or RESTAURANT_ID

    table_res = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", entry_rid)
        .eq("status", "available")
        .gte("capacity", party["party_size"])
        .order("capacity")
        .limit(1)
        .execute()
    )
    table = table_res.data[0] if table_res.data else None

    supabase.table("queue_entries").update({"status": "seated"}).eq("id", entry_id).execute()

    if table:
        supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("id", table["id"]).execute()
        # Track occupant in memory for cross-view sync (same as seat-to-table)
        tnum = table.get("table_number")
        if tnum is not None:
            with _occupants_lock:
                _table_occupants[f"{entry_rid}:{tnum}"] = {
                    "name": party.get("name") or "Guest",
                    "party_size": party.get("party_size", 2),
                    "entry_id": entry_id,
                }
        try:
            supabase.table("seating_events").insert({
                "restaurant_id": entry_rid, "table_id": table["id"],
                "queue_entry_id": entry_id, "action": "seated",
            }).execute()
        except Exception:
            pass

    return {"status": "seated", "table": table}

@app.post("/queue/{entry_id}/seat-to-table/{table_id}")
def seat_to_table(entry_id: str, table_id: str):
    """Seat a queue entry and mark a specific table as occupied (used by floor-map drag-and-drop)."""
    entry_res = supabase.table("queue_entries").select("name, party_size, restaurant_id").eq("id", entry_id).execute()
    supabase.table("queue_entries").update({"status": "seated"}).eq("id", entry_id).execute()
    supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("id", table_id).execute()
    # Track occupant in memory for cross-view sync
    if entry_res.data:
        e = entry_res.data[0]
        rid = e.get("restaurant_id") or RESTAURANT_ID
        tbl_res = supabase.table("tables").select("table_number").eq("id", table_id).execute()
        if tbl_res.data:
            tnum = tbl_res.data[0]["table_number"]
            with _occupants_lock:
                _table_occupants[f"{rid}:{tnum}"] = {"name": e.get("name") or "Guest", "party_size": e.get("party_size", 2), "entry_id": entry_id}
    try:
        rid_for_event = (entry_res.data[0].get("restaurant_id") if entry_res.data else None) or RESTAURANT_ID
        supabase.table("seating_events").insert({
            "restaurant_id": rid_for_event, "table_id": table_id,
            "queue_entry_id": entry_id, "action": "seated",
        }).execute()
    except Exception:
        pass
    return {"status": "seated", "table_id": table_id}

def _send_notify_sms(phone: str, rest_name: str, entry_id: str) -> None:
    # wait_url included once Textbelt URL sending is approved; currently omitted to ensure delivery
    ok, err = _send_sms(
        to_phone=phone,
        body=f"Your table at {rest_name} is ready! Please head to the host stand. Reply STOP to opt out.",
    )
    print(f"[notify] sms_sent={ok} sms_error={err!r}")


@app.post("/queue/{entry_id}/notify")
def notify_ready(entry_id: str, background_tasks: BackgroundTasks):
    # 1. Mark as ready in DB
    supabase.table("queue_entries").update({"status": "ready"}).eq("id", entry_id).execute()

    # 2. Queue SMS in background if the guest provided a phone number
    sms_queued = False
    try:
        entry_res = supabase.table("queue_entries").select("phone, name, restaurant_id").eq("id", entry_id).execute()
        phone = entry_res.data[0].get("phone") if entry_res.data else None
        print(f"[notify] entry={entry_id} phone={phone!r}")
        if phone:
            rid_used  = entry_res.data[0].get("restaurant_id") or RESTAURANT_ID
            rest_res  = supabase.table("restaurants").select("name").eq("id", rid_used).execute()
            rest_name = rest_res.data[0]["name"] if rest_res.data else "the restaurant"
            background_tasks.add_task(_send_notify_sms, phone, rest_name, entry_id)
            sms_queued = True
        else:
            print(f"[notify] no phone on entry {entry_id}")
    except Exception as e:
        print(f"[notify] exception: {e}")

    return {"status": "notified", "sms_queued": sms_queued, "sms_sent": sms_queued}

@app.post("/queue/{entry_id}/remove")
def remove_entry(entry_id: str):
    supabase.table("queue_entries").update({"status": "removed"}).eq("id", entry_id).execute()
    return {"status": "removed"}

@app.post("/queue/{entry_id}/restore")
def restore_entry(entry_id: str):
    """Restore a removed or incorrectly-seated entry back to waiting."""
    res = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    supabase.table("queue_entries").update({"status": "waiting"}).eq("id", entry_id).execute()
    updated = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    entry = updated.data[0] if updated.data else res.data[0]
    return {"status": "restored", "entry": entry}

@app.get("/queue/history/debug")
def debug_history(restaurant_id: Optional[str] = None):
    """Temporary debug endpoint to surface the actual Supabase error."""
    rid = _rid(restaurant_id)
    try:
        res = supabase.table("queue_entries").select("id,status").eq("restaurant_id", rid).limit(5).execute()
        return {"ok": True, "rid": rid, "count": len(res.data or []), "sample": (res.data or [])[:3]}
    except Exception as e:
        return {"ok": False, "rid": rid, "error": str(e), "type": type(e).__name__}

@app.get("/queue/history")
def get_queue_history(restaurant_id: Optional[str] = None, date: Optional[str] = None):
    """Returns seated and removed entries for the given restaurant.
    Fetches all entries and filters in Python to avoid PostgREST operator issues."""
    rid = _rid(restaurant_id)
    try:
        res = (
            supabase.table("queue_entries")
            .select("*")
            .eq("restaurant_id", rid)
            .execute()
        )
        data = res.data or []
        return [e for e in data if e.get("status") in ("seated", "removed")]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/queue/{entry_id}/wait")
def update_wait(entry_id: str, minutes: int):
    """Update the quoted wait time. Fires link SMS for host-added guests on first quote."""
    if minutes < 1 or minutes > 180:
        raise HTTPException(status_code=400, detail="Wait time must be between 1 and 180 minutes")
    res = supabase.table("queue_entries").select("id, quoted_wait, phone, source, restaurant_id").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = res.data[0]
    was_unquoted = entry.get("quoted_wait") is None
    now = _now()
    _wait_set_at[entry_id] = now
    _set_quoted_wait(entry_id, minutes, now)
    # Fire link SMS synchronously for host-added guests receiving their first quote
    sms_sent = False
    sms_error = ""
    phone  = entry.get("phone") or ""
    source = entry.get("source") or ""
    if was_unquoted and source in ("host", "analog") and phone:
        rid_used = entry.get("restaurant_id") or RESTAURANT_ID
        rest_res = supabase.table("restaurants").select("name").eq("id", rid_used).execute()
        rest_name = rest_res.data[0]["name"] if rest_res.data else "the restaurant"
        short_id  = entry_id[:8]
        print(f"[SMS] update_wait: firing SMS to {phone!r} entry={entry_id}")
        sms_sent, sms_error = _send_sms(
            to_phone=phone,
            body=f"Welcome to {rest_name}! You've been added to the waitlist. Your wait code is {short_id}. We'll text you when your table is ready. Reply STOP to opt out.",
        )
        print(f"[SMS] update_wait result: sent={sms_sent} err={sms_error!r}")
    return {"status": "updated", "quoted_wait": minutes, "wait_set_at": now, "sms_sent": sms_sent, "sms_error": sms_error}

@app.patch("/queue/{entry_id}")
def update_entry(entry_id: str, req: QueueUpdateRequest):
    """Update editable fields on a queue entry (party size, phone, quoted wait)."""
    res = supabase.table("queue_entries").select("id").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    update: dict = {}
    qw_now: Optional[str] = None
    if req.quoted_wait is not None:
        qw_now = _now()
        _wait_set_at[entry_id] = qw_now
        # quoted_wait + quoted_wait_set_at handled below via _set_quoted_wait
    if req.party_size is not None:
        update["party_size"] = req.party_size
    if req.phone is not None:
        update["phone"] = req.phone or None
    if req.notes is not None:
        update["notes"] = req.notes or None
    if req.paused is not None:
        update["paused"] = req.paused
    if not update and req.quoted_wait is None:
        return {"status": "nothing_to_update"}
    if update:
        supabase.table("queue_entries").update(update).eq("id", entry_id).execute()
    if req.quoted_wait is not None and qw_now:
        _set_quoted_wait(entry_id, req.quoted_wait, qw_now)
    return {"status": "updated"}

@app.post("/seat-next")  # legacy
def seat_next():
    res = supabase.table("queue_entries").select("*").eq("restaurant_id", RESTAURANT_ID).eq("status", "waiting").order("created_at").limit(1).execute()
    if not res.data:
        return {"status": "no_parties_waiting"}
    return seat_entry(res.data[0]["id"])

# ── Insights ─────────────────────────────────────────────────────────────────

@app.get("/insights")
def get_insights(restaurant_id: Optional[str] = None):
    try:
        rid    = _rid(restaurant_id)
        tables = supabase.table("tables").select("*").eq("restaurant_id", rid).execute().data
        queue  = _active_queue(rid)

        available   = sum(1 for t in tables if t["status"] == "available")
        occupied    = len(tables) - available
        waiting     = len([q for q in queue if q["status"] == "waiting"])

        return {
            "tables_total":         len(tables),
            "tables_available":     available,
            "tables_occupied":      occupied,
            "parties_waiting":      waiting,
            "parties_ready":        len(queue) - waiting,
            "avg_wait_estimate":    _wait_estimate(waiting, rid=rid),
            "capacity_utilization": round(occupied / len(tables) * 100) if tables else 0,
            "ai_insights":          _ai_insights(tables, queue),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Event ingestion ───────────────────────────────────────────────────────────

@app.post("/events/camera")
def log_camera(req: CameraEventRequest):
    try:
        supabase.table("camera_events").insert({"restaurant_id": RESTAURANT_ID, "zone": req.zone, "people_count": req.people_count}).execute()
        return {"status": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log camera event: {e}")

@app.post("/events/delivery")
def log_delivery(req: DeliveryEventRequest):
    try:
        supabase.table("delivery_events").insert({"restaurant_id": RESTAURANT_ID, "provider": req.provider, "active_orders": req.active_orders}).execute()
        return {"status": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log delivery event: {e}")

@app.post("/events/throughput")
def log_throughput(req: ThroughputEventRequest):
    try:
        supabase.table("throughput_events").insert({"restaurant_id": RESTAURANT_ID, "metric": req.metric, "value": req.value, "metadata": req.metadata}).execute()
        return {"status": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log throughput event: {e}")

# ── Required DB migration (run once in Supabase SQL editor) ──────────────────
#
#   ALTER TABLE queue_entries
#     ADD COLUMN IF NOT EXISTS quoted_wait_set_at timestamptz;
#
#   -- Backfill: set existing entries that have a quoted_wait but no set-time to
#   -- a timestamp far in the past so they immediately show 0 remaining.
#   UPDATE queue_entries
#     SET quoted_wait_set_at = '2000-01-01T00:00:00'
#     WHERE quoted_wait IS NOT NULL AND quoted_wait_set_at IS NULL;
#
# ── Reservations ─────────────────────────────────────────────────────────────
#
# Required Supabase tables (run once in the Supabase SQL editor):
#
#   CREATE TABLE IF NOT EXISTS reservations (
#     id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
#     restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
#     guest_name    text NOT NULL,
#     party_size    int  NOT NULL DEFAULT 2,
#     date          date NOT NULL,
#     time          time NOT NULL,
#     phone         text,
#     email         text,
#     notes         text,
#     status        text NOT NULL DEFAULT 'confirmed',
#     source        text NOT NULL DEFAULT 'host',
#     external_uid  text,
#     created_at    timestamptz DEFAULT now()
#   );
#   CREATE TABLE IF NOT EXISTS restaurant_settings (
#     id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
#     restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
#     opentable_ical_url text,
#     updated_at    timestamptz DEFAULT now()
#   );
#   CREATE INDEX IF NOT EXISTS reservations_restaurant_date ON reservations(restaurant_id, date);
#   CREATE INDEX IF NOT EXISTS reservations_external_uid    ON reservations(restaurant_id, external_uid);

@app.get("/reservations")
def get_reservations(date: Optional[str] = None, restaurant_id: Optional[str] = None):
    try:
        q = supabase.table("reservations").select("*").eq("restaurant_id", _rid(restaurant_id))
        if date:
            q = q.eq("date", date)
        return q.order("time").execute().data
    except Exception:
        return []

@app.post("/reservations")
def create_reservation(req: ReservationRequest):
    try:
        data = supabase.table("reservations").insert({
            "restaurant_id": _rid(req.restaurant_id),
            "guest_name":    req.guest_name,
            "party_size":    req.party_size,
            "date":          req.date,
            "time":          req.time,
            "phone":         req.phone,
            "email":         req.email,
            "notes":         req.notes,
            "source":        req.source or "host",
            "status":        "confirmed",
            "created_at":    _now(),
        }).execute()
        return {"status": "created", "reservation": data.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/reservations/{res_id}")
def update_reservation(res_id: str, req: ReservationRequest):
    try:
        data = supabase.table("reservations").update({
            "guest_name": req.guest_name,
            "party_size": req.party_size,
            "date":       req.date,
            "time":       req.time,
            "phone":      req.phone,
            "email":      req.email,
            "notes":      req.notes,
            "source":     req.source or "host",
        }).eq("id", res_id).execute()
        return {"status": "updated", "reservation": data.data[0] if data.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/reservations/{res_id}/status")
def update_reservation_status(res_id: str, status: str):
    try:
        supabase.table("reservations").update({"status": status}).eq("id", res_id).execute()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reservations/{res_id}")
def delete_reservation(res_id: str):
    try:
        supabase.table("reservations").delete().eq("id", res_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reservations.ics")
def export_ical():
    """Export all reservations as an iCal feed (subscribe from Apple/Google Calendar)."""
    try:
        from icalendar import Calendar, Event as ICalEvent
        import uuid as uuid_lib

        rows = (
            supabase.table("reservations")
            .select("*")
            .eq("restaurant_id", RESTAURANT_ID)
            .neq("status", "cancelled")
            .order("date").order("time")
            .execute()
            .data
        )

        cal = Calendar()
        cal.add("prodid", "-//HOST Restaurant//host.app//EN")
        cal.add("version", "2.0")
        cal.add("x-wr-calname", "HOST Reservations")
        cal.add("x-wr-timezone", "America/Denver")
        cal.add("calscale", "GREGORIAN")

        for r in rows:
            ev = ICalEvent()
            ev.add("uid", r.get("id", str(uuid_lib.uuid4())))
            ev.add("summary", f"{r['guest_name']} — {r['party_size']}p")
            try:
                from datetime import datetime as dt, timedelta
                start = dt.strptime(f"{r['date']} {r['time'][:5]}", "%Y-%m-%d %H:%M")
                end   = start + timedelta(hours=1, minutes=30)
                ev.add("dtstart", start)
                ev.add("dtend",   end)
            except Exception:
                continue
            desc_parts = [f"Party size: {r['party_size']}"]
            if r.get("phone"): desc_parts.append(f"Phone: {r['phone']}")
            if r.get("email"): desc_parts.append(f"Email: {r['email']}")
            if r.get("notes"): desc_parts.append(f"Notes: {r['notes']}")
            ev.add("description", "\n".join(desc_parts))
            ev.add("status", "CONFIRMED" if r.get("status") == "confirmed" else "TENTATIVE")
            cal.add_component(ev)

        return Response(
            content=cal.to_ical(),
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": "inline; filename=reservations.ics"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/settings")
def get_settings():
    try:
        res = supabase.table("restaurant_settings").select("*").eq("restaurant_id", RESTAURANT_ID).execute()
        return res.data[0] if res.data else {"restaurant_id": RESTAURANT_ID, "opentable_ical_url": None}
    except Exception:
        return {"restaurant_id": RESTAURANT_ID, "opentable_ical_url": None}

@app.put("/settings")
def update_settings(req: SettingsRequest):
    try:
        existing = supabase.table("restaurant_settings").select("id").eq("restaurant_id", RESTAURANT_ID).execute()
        if existing.data:
            supabase.table("restaurant_settings").update({
                "opentable_ical_url": req.opentable_ical_url,
                "updated_at": _now(),
            }).eq("restaurant_id", RESTAURANT_ID).execute()
        else:
            supabase.table("restaurant_settings").insert({
                "restaurant_id":     RESTAURANT_ID,
                "opentable_ical_url": req.opentable_ical_url,
            }).execute()
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/settings/sync-ical")
def sync_ical(req: SyncIcalRequest):
    """Fetch an iCal URL (e.g., from OpenTable) and upsert reservations into HOST."""
    try:
        import requests as http
        from icalendar import Calendar

        resp = http.get(req.url, timeout=15, headers={"User-Agent": "HOST-Restaurant/1.0"})
        if not resp.ok:
            raise HTTPException(status_code=400, detail=f"Could not fetch iCal URL (HTTP {resp.status_code})")

        cal      = Calendar.from_ical(resp.content)
        imported = 0

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            summary = str(component.get("summary", "Guest"))
            dtstart = component.get("dtstart")
            if not dtstart:
                continue

            start_dt = dtstart.dt
            if hasattr(start_dt, "hour"):
                date_str = start_dt.strftime("%Y-%m-%d")
                time_str = start_dt.strftime("%H:%M")
            else:
                date_str = start_dt.strftime("%Y-%m-%d")
                time_str = "19:00"  # default for all-day events

            uid         = str(component.get("uid", ""))
            description = str(component.get("description", ""))

            # ── Party size: try SUMMARY "(4)" first (OpenTable standard format),
            #    then fall back to DESCRIPTION text patterns.
            party_size = 2
            # 1) OpenTable SUMMARY format: "Smith, John (4)" or "John Smith (4 guests)"
            summary_size = re.search(r"\((\d+)(?:\s*(?:guest|cover|person|pax|p))?\)", summary, re.IGNORECASE)
            if summary_size:
                party_size = int(summary_size.group(1))
            else:
                # 2) DESCRIPTION patterns: "4 guests", "party of 4", "covers: 4", "party size: 4"
                desc_size = re.search(
                    r"(?:party(?:\s+of|\s+size[:\s]+)?|covers?[:\s]+|guests?[:\s]+|pax[:\s]+)(\d+)"
                    r"|(\d+)\s*(?:guest|cover|person|party|pax)",
                    description.lower()
                )
                if desc_size:
                    party_size = int(desc_size.group(1) or desc_size.group(2))

            # Clean guest name: strip trailing "(4)" or "(4 guests)" appended by OpenTable
            guest_name = re.sub(r"\s*\(\d+(?:\s*(?:guest|cover|person|pax|p))?\)\s*$", "", summary, flags=re.IGNORECASE).strip()
            if not guest_name:
                guest_name = summary  # fallback if regex ate the whole string

            # Upsert by external_uid so re-syncing is idempotent
            existing = (
                supabase.table("reservations")
                .select("id")
                .eq("restaurant_id", RESTAURANT_ID)
                .eq("external_uid", uid)
                .execute()
            )
            payload = {
                "guest_name": guest_name,
                "party_size": party_size,
                "date":       date_str,
                "time":       time_str,
                "notes":      description[:500] if description else None,
            }
            if existing.data:
                supabase.table("reservations").update(payload).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase.table("reservations").insert({
                    **payload,
                    "restaurant_id": RESTAURANT_ID,
                    "source":        "opentable",
                    "status":        "confirmed",
                    "external_uid":  uid,
                    "created_at":    _now(),
                }).execute()
            imported += 1

        return {"status": "synced", "imported": imported}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── One-time setup ────────────────────────────────────────────────────────────

@app.post("/setup")
def setup():
    """Seed restaurant + 8 tables + 1 NFC tag. Safe to call multiple times."""
    if not supabase.table("restaurants").select("id").eq("id", RESTAURANT_ID).execute().data:
        supabase.table("restaurants").insert({"id": RESTAURANT_ID, "name": "The Restaurant", "slug": "the-restaurant"}).execute()

    if not supabase.table("tables").select("id").eq("restaurant_id", RESTAURANT_ID).execute().data:
        supabase.table("tables").insert([
            {"restaurant_id": RESTAURANT_ID, "table_number": 1, "capacity": 2, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 2, "capacity": 2, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 3, "capacity": 4, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 4, "capacity": 4, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 5, "capacity": 4, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 6, "capacity": 6, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 7, "capacity": 6, "status": "available"},
            {"restaurant_id": RESTAURANT_ID, "table_number": 8, "capacity": 8, "status": "available"},
        ]).execute()

    if not supabase.table("nfc_tags").select("id").eq("restaurant_id", RESTAURANT_ID).execute().data:
        supabase.table("nfc_tags").insert({
            "restaurant_id": RESTAURANT_ID, "token": RESTAURANT_ID,
            "location_name": "Front Entrance", "active": True,
        }).execute()

    return {"status": "setup complete", "restaurant_id": RESTAURANT_ID}

@app.post("/setup-demo")
def setup_demo():
    """Seed the Demo Restaurant with 16 tables. Safe to call multiple times."""
    rid = DEMO_RESTAURANT_ID
    if not supabase.table("restaurants").select("id").eq("id", rid).execute().data:
        supabase.table("restaurants").insert({
            "id": rid, "name": "Demo Restaurant", "slug": "demo"
        }).execute()

    if not supabase.table("tables").select("id").eq("restaurant_id", rid).execute().data:
        supabase.table("tables").insert([
            {"restaurant_id": rid, "table_number": i+1, "capacity": c, "status": "available"}
            for i, c in enumerate([2,2,2,4,4,4,6,6,6,4,4,4,1,1,1,1])
        ]).execute()

    if not supabase.table("nfc_tags").select("id").eq("restaurant_id", rid).execute().data:
        supabase.table("nfc_tags").insert({
            "restaurant_id": rid, "token": rid,
            "location_name": "Front Entrance", "active": True,
        }).execute()

    return {"status": "demo setup complete", "restaurant_id": rid, "join_url": "https://hostplatform.net/demo/join"}


# ── Demo request submissions ─────────────────────────────────────────────────

@app.post("/demo-submissions")
async def create_demo_submission(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    name = str(body.get("name") or "").strip()
    restaurant = str(body.get("restaurant") or "").strip()
    email = str(body.get("email") or "").strip().lower()
    if not name or not restaurant or not email:
        raise HTTPException(status_code=400, detail="Missing required fields")
    sub = {
        "id":          str(_uuid.uuid4()),
        "name":        name,
        "restaurant":  restaurant,
        "email":       email,
        "phone":       str(body.get("phone") or "").strip(),
        "city":        str(body.get("city") or "").strip(),
        "type":        str(body.get("type") or "").strip(),
        "submittedAt": str(body.get("submittedAt") or _now()),
        "receivedAt":  _now(),
    }
    _demo_submissions.insert(0, sub)
    threading.Thread(target=_save_demo_sub_to_db, args=(sub,), daemon=True).start()
    print(f"[DEMO REQUEST] {_json.dumps(sub)}")
    return {"ok": True}

@app.get("/demo-submissions")
def get_demo_submissions(secret: Optional[str] = None):
    if not secret or secret != os.environ.get("OWNER_PASS", ""):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not _demo_submissions:
        _load_demo_subs()
    return _demo_submissions
