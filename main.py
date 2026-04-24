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

def _rebuild_occupants_for_restaurant(rid: str) -> int:
    """Reconstruct in-memory occupants for a single restaurant from DB + seating_events.
    Returns the number of occupant entries that were seeded. Safe to call repeatedly —
    it NEVER overwrites a live in-memory entry, so any fresh seats written since the
    reconstruction began are preserved.

    Used by:
      - _seed_table_occupants() at server startup (background thread).
      - /tables/occupants as a self-heal when memory is empty but DB says tables
        are occupied (e.g., the startup seed thread hasn't finished yet, or a
        process restart during an active service).
    """
    from datetime import timedelta
    try:
        now = datetime.now(timezone.utc)
        bd_start = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if now.hour < 3:
            bd_start -= timedelta(days=1)

        occ_tables = (
            supabase.table("tables")
            .select("id, table_number")
            .eq("restaurant_id", rid)
            .eq("status", "occupied")
            .execute().data or []
        )
        if not occ_tables:
            return 0

        # Build table_number -> list of ids (handles duplicate rows) and keep one canonical
        # id per number (the row most recently referenced by events wins later).
        tnum_to_ids: dict = {}
        id_to_tnum: dict = {}
        for t in occ_tables:
            tnum = t.get("table_number")
            if tnum is None:
                continue
            tnum_to_ids.setdefault(tnum, []).append(t["id"])
            id_to_tnum[t["id"]] = tnum

        # Fetch ALL seating events for this restaurant today (not just for occupied tables)
        # because a guest who was moved from table A to table B has TWO events; if we only
        # fetch events whose table_id is currently occupied, we might miss the newer one
        # and resurrect the older location. The per-entry newest-event loop below guarantees
        # we always pick the latest table for each entry.
        events = (
            supabase.table("seating_events")
            .select("table_id, queue_entry_id, created_at")
            .eq("restaurant_id", rid)
            .eq("action", "seated")
            .gte("created_at", bd_start.isoformat())
            .order("created_at", desc=True)
            .execute().data or []
        )

        # Entry-id-last-seen: for each queue_entry_id, pick the NEWEST seating event.
        # This is the key invariant that prevents ghost resurrection: even if an older
        # seating event still points at table A, if a newer one points at table B, the
        # entry is considered seated at B and A is left empty.
        latest_tid_for_entry: dict = {}
        for ev in events:
            eid = ev.get("queue_entry_id")
            tid = ev.get("table_id")
            if not eid or not tid:
                continue
            if eid not in latest_tid_for_entry:
                latest_tid_for_entry[eid] = tid

        # Keep only entries whose latest table is currently marked occupied in DB — a guest
        # whose final event points at a now-available table was cleared out since the event,
        # and shouldn't resurrect.
        filtered: dict = {eid: tid for eid, tid in latest_tid_for_entry.items() if tid in id_to_tnum}

        # A single entry_id maps to exactly one table_number (the newest event's table).
        # If the SAME table_number has multiple occupants fighting for it across entries,
        # keep the newest (first in our descending-ordered walk).
        tnum_claimed: dict = {}  # tnum -> entry_id
        entry_tnum: dict = {}    # entry_id -> tnum (final placement)
        for eid, tid in filtered.items():
            tnum = id_to_tnum.get(tid)
            if tnum is None:
                continue
            if tnum in tnum_claimed:
                continue  # another entry already claimed this table via a newer event
            tnum_claimed[tnum] = eid
            entry_tnum[eid] = tnum

        remaining_tnums = set(id_to_tnum.values()) - set(entry_tnum.values())

        entries = []
        if entry_tnum:
            entries = (
                supabase.table("queue_entries")
                .select("id, name, party_size")
                .in_("id", list(entry_tnum.keys()))
                .execute().data or []
            )

        seeded = 0
        with _occupants_lock:
            for e in entries:
                tnum = entry_tnum.get(e["id"])
                if tnum is None:
                    continue
                key = f"{rid}:{tnum}"
                if key not in _table_occupants:
                    _table_occupants[key] = {
                        "name":       e.get("name") or "Guest",
                        "party_size": e.get("party_size", 2),
                        "entry_id":   e["id"],
                    }
                    seeded += 1
            # Placeholder for any orphaned "occupied" tables (no seating event today)
            for tnum in remaining_tnums:
                key = f"{rid}:{tnum}"
                if key not in _table_occupants:
                    _table_occupants[key] = {
                        "name":       "Guest",
                        "party_size": 2,
                        "entry_id":   None,
                    }
                    seeded += 1
        return seeded
    except Exception as e:
        print(f"[rebuild_occupants] rid={rid} error: {e}")
        return 0

def _seed_table_occupants():
    """Restore real guest names in _table_occupants from seating_events after a server restart.
    Without this, tables show 'Guest' after every Railway deployment (any git push auto-deploys)."""
    try:
        all_rids = [r for r in [RESTAURANT_ID] + [r["id"] for r in WALNUT_RESTAURANTS] + [DEMO_RESTAURANT_ID] if r]
        for rid in all_rids:
            seeded = _rebuild_occupants_for_restaurant(rid)
            if seeded:
                print(f"[startup] Seeded {seeded} occupant name(s) for restaurant {rid}")
    except Exception as e:
        print(f"[startup] _seed_table_occupants outer error: {e}")

threading.Thread(target=_seed_table_occupants, daemon=True).start()

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

def _dedup_tables(rows: list) -> list:
    """Deduplicate table rows by table_number, keeping the MOST RECENTLY UPDATED row.

    Duplicate rows can accumulate when _ensure_* startup functions race on first deploy.
    Previously this kept the first occurrence, but Supabase doesn't guarantee stable row
    ordering — so the "first" row could flip between calls, causing a table to appear
    occupied on one refresh and available on the next. Always keeping the latest
    updated_at row makes this deterministic and ensures that a seat/clear action
    (which updates exactly one row) is always the row that wins the dedup."""
    best: dict = {}  # table_number -> row
    for t in (rows or []):
        n = t.get("table_number")
        if n is None:
            continue
        prev = best.get(n)
        if prev is None:
            best[n] = t
            continue
        # Compare updated_at timestamps as strings — ISO-8601 sorts correctly lexically.
        prev_ts = prev.get("updated_at") or ""
        this_ts = t.get("updated_at") or ""
        if this_ts > prev_ts:
            best[n] = t
    # Sort by table_number numerically (values may be str or int in the DB)
    try:
        return sorted(best.values(), key=lambda t: int(t.get("table_number") or 0))
    except Exception:
        return list(best.values())

def _cleanup_duplicate_tables():
    """One-shot: delete duplicate rows per (restaurant_id, table_number), keeping only
    the most recently updated one. Runs on startup. Without this, duplicate rows keep
    accumulating and _dedup_tables has to paper over them on every request — and any
    endpoint that reads by row-id (seat-to-table, clear-table) can still hit the stale
    row and silently mis-update."""
    try:
        all_rids = [r for r in [RESTAURANT_ID] + [r["id"] for r in WALNUT_RESTAURANTS] + [DEMO_RESTAURANT_ID] if r]
        for rid in all_rids:
            try:
                rows = supabase.table("tables").select("*").eq("restaurant_id", rid).execute().data or []
                # Group by table_number
                by_num: dict = {}
                for t in rows:
                    by_num.setdefault(t.get("table_number"), []).append(t)
                stale_ids: list = []
                for num, group in by_num.items():
                    if len(group) <= 1:
                        continue
                    # Pick keeper: latest updated_at; on tie, pick any stable one (first)
                    group.sort(key=lambda t: t.get("updated_at") or "", reverse=True)
                    keeper = group[0]
                    for t in group[1:]:
                        if t.get("id") and t["id"] != keeper.get("id"):
                            stale_ids.append(t["id"])
                if stale_ids:
                    # Delete in batches
                    for i in range(0, len(stale_ids), 50):
                        batch = stale_ids[i:i+50]
                        try:
                            supabase.table("tables").delete().in_("id", batch).execute()
                        except Exception as e:
                            print(f"[cleanup_duplicate_tables] batch delete failed rid={rid}: {e}")
                    print(f"[startup] Deleted {len(stale_ids)} duplicate table row(s) for rid={rid}")
            except Exception as e:
                print(f"[cleanup_duplicate_tables] rid={rid} error: {e}")
    except Exception as e:
        print(f"[cleanup_duplicate_tables] outer error: {e}")

threading.Thread(target=_cleanup_duplicate_tables, daemon=True).start()

@app.get("/tables")
def get_tables(restaurant_id: Optional[str] = None):
    rows = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", _rid(restaurant_id))
        .order("table_number")
        .execute()
        .data
    )
    return _dedup_tables(rows)

class OccupyRequest(BaseModel):
    name:       Optional[str] = None
    party_size: Optional[int] = None
    entry_id:   Optional[str] = None

@app.post("/tables/{table_id}/occupy")
def occupy_table(table_id: str, body: Optional[OccupyRequest] = None):
    """Mark a table occupied and (optionally) bind a queue entry to it.

    Hardened to match the demo's seat flow:
      - Claims ALL sibling rows for (rid, table_number) via _claim_table_for_occupying,
        so legacy duplicate rows can't leave one sibling still "available" and
        produce a ghost second-seat.
      - Enforces the single-table-per-entry_id invariant: if body.entry_id is already
        in _table_occupants at a DIFFERENT table, that key is evicted AND the other
        table's DB row is released to 'available'. Without this, a move that loses
        its /clear partner leaves the guest occupying BOTH tables — exactly the
        "guest moved tables on refresh" bug reported at launch.
      - Always writes a seating_event keyed to the NEW (table_id, entry_id) so that
        _rebuild_occupants_for_restaurant's entry-id-last-seen logic can recover
        the correct location after a Railway restart.
    """
    # Resolve target row's (rid, tnum) before claiming.
    tbl_res = supabase.table("tables").select("id, table_number, restaurant_id").eq("id", table_id).execute()
    if not tbl_res.data:
        raise HTTPException(status_code=404, detail="Table not found")
    t = tbl_res.data[0]
    rid = t.get("restaurant_id") or RESTAURANT_ID
    tnum = t.get("table_number")

    name = (body.name if body and body.name else None) or "Guest"
    party_size = (body.party_size if body and body.party_size else None) or 2
    entry_id = body.entry_id if body else None

    # Sibling-safe: mark EVERY row with this (rid, table_number) as occupied, regardless
    # of its prior status. We intentionally don't gate on status="available" here because
    # this endpoint is also used for moves — the target may already read as "occupied" in
    # a stale duplicate row, but we still want the canonical row to reflect the new occupant.
    if rid is not None and tnum is not None:
        supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", tnum).execute()
    else:
        supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("id", table_id).execute()

    # Enforce single-table-per-entry_id invariant before writing the new key.
    if entry_id and rid is not None and tnum is not None:
        with _occupants_lock:
            prefix = f"{rid}:"
            stale_keys = [
                k for k, v in _table_occupants.items()
                if k.startswith(prefix)
                and k != f"{rid}:{tnum}"
                and v.get("entry_id") == entry_id
            ]
            for k in stale_keys:
                del _table_occupants[k]
        # Release the DB rows for those stale tables so the floor map goes green.
        for k in stale_keys:
            try:
                stale_tnum = int(k.split(":", 1)[1])
                supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", stale_tnum).execute()
            except Exception as e:
                print(f"[occupy] stale release failed key={k}: {e}")

    if tnum is not None:
        with _occupants_lock:
            _table_occupants[f"{rid}:{tnum}"] = {
                "name": name,
                "party_size": party_size,
                "entry_id": entry_id,
            }

    # Persist a seating_event for the NEW table so restart recovery picks this location
    # as the entry's latest seating (entry-id-last-seen semantics).
    if entry_id:
        try:
            supabase.table("seating_events").insert({
                "restaurant_id": rid,
                "table_id":      table_id,
                "queue_entry_id": entry_id,
                "action":        "seated",
            }).execute()
        except Exception as e:
            print(f"[occupy] seating_event insert failed: {e}")

    return {"status": "occupied"}

@app.post("/tables/{table_id}/clear")
def clear_table(table_id: str):
    # Look up the table's (restaurant_id, table_number) first so we can:
    #   1) Clear in-memory occupants keyed by table_number
    #   2) Mark EVERY row with the same (rid, table_number) as available — duplicate-row
    #      safe, mirrors _claim_table_for_occupying which claims all siblings together.
    tbl_res = supabase.table("tables").select("table_number, restaurant_id").eq("id", table_id).execute()
    key: Optional[str] = None
    rid: Optional[str] = None
    tnum = None
    removed_entry: Optional[dict] = None
    if tbl_res.data:
        t = tbl_res.data[0]
        rid = t.get("restaurant_id") or RESTAURANT_ID
        tnum = t.get("table_number")
        if tnum is not None:
            key = f"{rid}:{tnum}"
            with _occupants_lock:
                removed_entry = _table_occupants.pop(key, None)
    try:
        if rid is not None and tnum is not None:
            # Clear ALL sibling rows so a stale duplicate can't be read back as "occupied".
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", tnum).execute()
        else:
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("id", table_id).execute()
    except Exception as e:
        # DB write failed — restore in-memory so we don't silently leak state and tell client to retry
        if key and removed_entry is not None:
            with _occupants_lock:
                _table_occupants[key] = removed_entry
        raise HTTPException(status_code=500, detail=f"clear_table failed: {e}")
    return {"status": "cleared"}

@app.post("/clear-table/{table_id}")  # legacy
def clear_table_legacy(table_id: str):
    return clear_table(table_id)


class MoveOccupantRequest(BaseModel):
    from_table_id: str
    to_table_id:   str


@app.post("/tables/move-occupant")
def move_occupant(body: MoveOccupantRequest):
    """Atomically move a seated guest from one table to another in ONE server call.

    Replaces the legacy two-call client flow (/occupy target + /clear source) which
    could partial-fail and leave the guest occupying BOTH tables — producing the
    "guest moved tables on refresh" bug. This endpoint does the whole transaction
    server-side:
      1. Look up both (rid, tnum) pairs and the occupant at the source.
      2. Sibling-safe claim the target, sibling-safe release the source.
      3. Atomically swap _table_occupants keys under the lock.
      4. Insert a seating_event at the NEW table so restart recovery is correct.

    If the source has no in-memory occupant OR the target is already occupied by a
    different entry_id, the whole operation is aborted with 409 so the client can
    re-refresh and retry — we never want half-complete state on the floor."""
    from_id = body.from_table_id
    to_id   = body.to_table_id
    if from_id == to_id:
        raise HTTPException(status_code=400, detail="from_table_id and to_table_id must differ")

    # Resolve both rows.
    rows = supabase.table("tables").select("id, table_number, restaurant_id").in_("id", [from_id, to_id]).execute().data or []
    by_id = {r["id"]: r for r in rows}
    if from_id not in by_id or to_id not in by_id:
        raise HTTPException(status_code=404, detail="One or both tables not found")

    src = by_id[from_id]
    dst = by_id[to_id]
    if src.get("restaurant_id") != dst.get("restaurant_id"):
        raise HTTPException(status_code=400, detail="Cannot move across restaurants")
    rid = src.get("restaurant_id") or RESTAURANT_ID
    src_tnum = src.get("table_number")
    dst_tnum = dst.get("table_number")
    if src_tnum is None or dst_tnum is None:
        raise HTTPException(status_code=500, detail="Table missing table_number")

    src_key = f"{rid}:{src_tnum}"
    dst_key = f"{rid}:{dst_tnum}"

    # Read source occupant + check target doesn't hold a different entry_id.
    with _occupants_lock:
        src_occ = _table_occupants.get(src_key)
        dst_occ = _table_occupants.get(dst_key)
    if not src_occ:
        raise HTTPException(status_code=409, detail="Source table has no occupant to move")
    # Allow move-over-empty and move-over-same-entry (idempotent retry); refuse move-over-other.
    if dst_occ and dst_occ.get("entry_id") and src_occ.get("entry_id") and dst_occ.get("entry_id") != src_occ.get("entry_id"):
        raise HTTPException(status_code=409, detail="Target table occupied by a different guest")

    # Claim target (sibling-safe). If target is currently "available" we transition it
    # to "occupied"; if it's already "occupied" we still mark all siblings occupied to
    # keep them consistent. Using an unconditional update (no status gate) is safe here
    # because the occupant swap below is the source of truth for who is at the table.
    supabase.table("tables").update({"status": "occupied", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", dst_tnum).execute()

    # Release source (sibling-safe).
    supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", src_tnum).execute()

    # Swap under the lock so no reader sees the guest at both keys simultaneously.
    with _occupants_lock:
        _table_occupants.pop(src_key, None)
        _table_occupants[dst_key] = src_occ
        # Also evict any OTHER key still bound to this entry_id (defense-in-depth).
        eid = src_occ.get("entry_id")
        if eid:
            prefix = f"{rid}:"
            for k in [k for k, v in _table_occupants.items() if k.startswith(prefix) and k != dst_key and v.get("entry_id") == eid]:
                _table_occupants.pop(k, None)

    # Record the new seating so restart recovery knows the latest location for this entry.
    eid = src_occ.get("entry_id")
    if eid:
        try:
            supabase.table("seating_events").insert({
                "restaurant_id":  rid,
                "table_id":       to_id,
                "queue_entry_id": eid,
                "action":         "seated",
            }).execute()
        except Exception as e:
            print(f"[move-occupant] seating_event insert failed: {e}")

    return {"status": "moved", "from_table_id": from_id, "to_table_id": to_id, "occupant": src_occ}

@app.get("/tables/occupants")
def get_table_occupants(restaurant_id: Optional[str] = None):
    """Return table→guest mapping, self-healing across restarts.

    Primary source: in-memory _table_occupants (fast, authoritative for live mutations).
    Fallback: if memory is empty for this restaurant but DB has occupied tables, rebuild
    from seating_events inline before responding. This guarantees table occupancy
    survives every client refresh AND every server restart — there is no window where
    occupancy "disappears" because the startup seed thread hasn't run yet.

    We DO NOT fall back to DB table.status for tables that have been explicitly cleared
    in memory — once a clear lands, the in-memory pop is authoritative."""
    rid = _rid(restaurant_id)
    prefix = f"{rid}:"

    def _snapshot() -> dict:
        """Build {table_number_str: occupant} while enforcing the single-table-per-entry_id
        invariant. If the in-memory dict has accidentally gotten the same entry_id on two
        tables (shouldn't happen given /occupy and move-occupant's defenses, but this is
        the last line of defense before the client sees it), the stale duplicate keys are
        evicted in-place so the next call is clean.
        """
        with _occupants_lock:
            # Collect items for this restaurant
            items = [(k, v) for k, v in _table_occupants.items() if k.startswith(prefix)]
            # Detect entry_id duplicates and evict all but the first seen. Order of dict
            # iteration follows insertion order, so the OLDEST entry is kept — but the
            # invariant is enforced mainly by /occupy at write time, so this is a safety
            # net, not the canonical path. Log so we can detect if something upstream is
            # writing duplicates.
            seen_eids: dict = {}
            dupe_keys: list = []
            for k, v in items:
                eid = v.get("entry_id")
                if not eid:
                    continue
                if eid in seen_eids:
                    dupe_keys.append(k)
                else:
                    seen_eids[eid] = k
            for k in dupe_keys:
                print(f"[tables/occupants] evicting duplicate entry_id at key={k}")
                _table_occupants.pop(k, None)
            # Re-read post-eviction to build the response
            return {k.split(":", 1)[1]: v for k, v in _table_occupants.items() if k.startswith(prefix)}

    result = _snapshot()

    # Self-heal: if nothing in memory for this restaurant, try to rebuild from DB.
    # This covers the window right after a Railway deploy when the startup seed
    # thread hasn't populated this restaurant yet. Rebuild never overwrites a
    # live in-memory entry, so concurrent seats are safe.
    if not result:
        try:
            seeded = _rebuild_occupants_for_restaurant(rid)
            if seeded:
                print(f"[tables/occupants] self-healed {seeded} occupant(s) for rid={rid}")
                result = _snapshot()
        except Exception as e:
            print(f"[tables/occupants] self-heal failed for rid={rid}: {e}")

    return result


@app.post("/admin/clear-day")
def admin_clear_day(restaurant_id: Optional[str] = None):
    """Soft-reset a single restaurant to "empty floor + empty queue" without waiting for
    the 3am business-day rollover. Managers tap this from the Walnut admin dashboard.

    What it does:
      - Marks all waiting/ready entries as 'removed' so they drop from the live queue.
      - Marks all currently-seated entries as 'removed' (they've already been served;
        this just clears them from the history "still here" view).
      - Sets every table's DB status back to 'available'.
      - Wipes _table_occupants for this restaurant → floor map goes green.
      - Wipes _wait_set_at for entries in this restaurant → no stale timers.

    What it does NOT do:
      - Delete rows. History / analytics stay intact. If a manager taps "Clear" early,
        the history tab still shows who was seated today. Only the 3am rollover + the
        owner's /owner/analytics/clear hard-delete remove rows.
    """
    rid = _rid(restaurant_id)
    counts = {"queue_entries_updated": 0, "tables_reset": 0, "occupants_dropped": 0}

    # 1. Drop all active queue entries (waiting/ready/seated) to 'removed'. "Seated" entries
    # are included because they represent guests currently at tables; after a clear those
    # tables should be free AND the entries shouldn't re-appear in anything that filters
    # on seated status.
    try:
        upd = (
            supabase.table("queue_entries")
            .update({"status": "removed"})
            .eq("restaurant_id", rid)
            .in_("status", ["waiting", "ready", "seated"])
            .execute()
        )
        counts["queue_entries_updated"] = len(upd.data or [])
    except Exception as e:
        print(f"[admin/clear-day] queue update failed for {rid}: {e}")

    # 2. Mark every table as available. Not conditional — we want every table free
    # regardless of its current state.
    try:
        tbl_upd = (
            supabase.table("tables")
            .update({"status": "available", "updated_at": _now()})
            .eq("restaurant_id", rid)
            .execute()
        )
        counts["tables_reset"] = len(tbl_upd.data or [])
    except Exception as e:
        print(f"[admin/clear-day] tables reset failed for {rid}: {e}")

    # 3. Clear in-memory state for this restaurant.
    prefix = f"{rid}:"
    with _occupants_lock:
        keys_to_drop = [k for k in list(_table_occupants.keys()) if k.startswith(prefix)]
        for k in keys_to_drop:
            del _table_occupants[k]
        counts["occupants_dropped"] = len(keys_to_drop)

    # _wait_set_at is keyed by entry_id (not rid), so we'd need an entry lookup to clear it
    # precisely. But since every entry we just touched is now 'removed' and the queue
    # endpoint filters to waiting/ready, those timer entries are dereferenced and harmless.

    print(f"[admin/clear-day] restaurant={rid} counts={counts}")
    return {"status": "cleared", "restaurant_id": rid, **counts}


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
    tables  = _dedup_tables(supabase.table("tables").select("*").eq("restaurant_id", rid).execute().data)
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

@app.get("/queue/history")
def get_queue_history(restaurant_id: Optional[str] = None, date: Optional[str] = None):
    """Returns seated/removed entries for today's business day only (3am cutoff).
    Registered BEFORE /queue/{entry_id} so 'history' isn't captured as a UUID param.
    Server-side date filter + 200-row cap prevents Supabase's 1000-row limit being hit
    as volume grows, and cuts per-poll bandwidth by ~95%."""
    from datetime import timedelta
    rid = _rid(restaurant_id)
    now = datetime.now(timezone.utc)
    # Business day starts at 3am. Before 3am means the day started yesterday.
    bd_start = now.replace(hour=3, minute=0, second=0, microsecond=0)
    if now.hour < 3:
        bd_start -= timedelta(days=1)
    try:
        res = (
            supabase.table("queue_entries")
            .select("id,name,party_size,status,arrival_time,quoted_wait,phone,notes,restaurant_id")
            .eq("restaurant_id", rid)
            .in_("status", ["seated", "removed"])
            .gte("arrival_time", bd_start.isoformat())
            .order("arrival_time", desc=True)
            .limit(200)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

def _claim_entry_for_seating(entry_id: str) -> dict:
    """Atomically transition a queue entry from waiting/ready → seated.
    Returns the entry row if we won the race. Raises 404 if entry doesn't exist, 409 if it's
    already in a terminal state (seated/removed) — which means another request beat us.

    This replaces the previous read-then-write pattern (SELECT status, then UPDATE) which
    had a classic check-then-act race window: two rapid /seat calls for the same entry
    could both read status='waiting', both proceed, and both pick/occupy different tables,
    leaving a single guest visibly sat at two tables (user report, 2026-04-22). The
    conditional WHERE status IN ('waiting','ready') guarantees only one call wins.
    """
    upd = (
        supabase.table("queue_entries")
        .update({"status": "seated"})
        .eq("id", entry_id)
        .in_("status", ["waiting", "ready"])
        .execute()
    )
    if upd.data:
        return upd.data[0]
    # No row updated — either entry missing or already seated/removed. Differentiate.
    existing = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    raise HTTPException(status_code=409, detail=f"Entry is already {existing.data[0].get('status', 'unknown')}")


def _claim_table_for_occupying(table_id: str) -> Optional[dict]:
    """Atomically transition a table from available → occupied. Returns the table row if
    we won the race. Returns None if the table was already occupied (caller decides how to
    handle: either release the entry-claim for retry, or pick another table).

    Duplicate-row safe: if legacy duplicate rows exist for the same (restaurant_id,
    table_number), claim ALL of them. Otherwise a second request could claim the sibling
    row and we'd silently double-book the physical table — which is exactly the "guest
    at two tables" bug the user hit. After the one-time _cleanup_duplicate_tables pass
    this is a no-op beyond the single-row claim, but the defense-in-depth makes the race
    harmless even mid-cleanup."""
    # Look up target row to get its (restaurant_id, table_number).
    target = supabase.table("tables").select("id, table_number, restaurant_id").eq("id", table_id).execute().data
    if not target:
        return None
    t = target[0]
    rid = t.get("restaurant_id")
    tnum = t.get("table_number")
    if rid is None or tnum is None:
        # Missing metadata — fall back to the plain id-based claim
        upd = (
            supabase.table("tables")
            .update({"status": "occupied", "updated_at": _now()})
            .eq("id", table_id)
            .eq("status", "available")
            .execute()
        )
        return upd.data[0] if upd.data else None

    # Claim every sibling row for this (rid, tnum) that is currently available.
    upd = (
        supabase.table("tables")
        .update({"status": "occupied", "updated_at": _now()})
        .eq("restaurant_id", rid)
        .eq("table_number", tnum)
        .eq("status", "available")
        .execute()
    )
    if not upd.data:
        return None
    # Prefer the row whose id matches the caller's target so the response id is stable.
    for row in upd.data:
        if row.get("id") == table_id:
            return row
    return upd.data[0]


def _record_seating(rid: str, entry_id: str, table_id: str, tnum: int,
                    name: str, party_size: int) -> None:
    """Update in-memory occupants + persist a seating_events row.
    Factored so both seat endpoints and the walkin-at-table endpoint do this identically."""
    with _occupants_lock:
        _table_occupants[f"{rid}:{tnum}"] = {
            "name": name or "Guest", "party_size": party_size or 2, "entry_id": entry_id,
        }
    try:
        supabase.table("seating_events").insert({
            "restaurant_id": rid, "table_id": table_id,
            "queue_entry_id": entry_id, "action": "seated",
        }).execute()
    except Exception as e:
        print(f"[seating_events] insert failed: {e}")


def _release_entry_claim(entry_id: str, back_to: str = "waiting") -> None:
    """Revert a queue entry's status back to waiting when a follow-up step fails (e.g., the
    target table was already occupied). Without this, the entry would be stuck in 'seated'
    state with no actual table assignment."""
    try:
        supabase.table("queue_entries").update({"status": back_to}).eq("id", entry_id).execute()
    except Exception as e:
        print(f"[release_entry_claim] failed: {e}")


@app.post("/queue/{entry_id}/seat")
def seat_entry(entry_id: str):
    """Auto-pick smallest available table and seat the entry. Both the entry status and
    the target table are claimed atomically, so concurrent /seat calls for the same entry
    can never each successfully occupy different tables."""
    party = _claim_entry_for_seating(entry_id)
    entry_rid = party.get("restaurant_id") or RESTAURANT_ID

    # Find candidate tables (smallest→largest), then race-safely try to occupy one.
    # If another request grabs our first pick, move to the next candidate.
    candidates = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", entry_rid)
        .eq("status", "available")
        .gte("capacity", party["party_size"])
        .order("capacity")
        .limit(6)
        .execute()
        .data or []
    )

    table = None
    for cand in candidates:
        # Also skip candidates already held in-memory but not yet reflected in DB
        tnum = cand.get("table_number")
        if tnum is not None:
            with _occupants_lock:
                if f"{entry_rid}:{tnum}" in _table_occupants:
                    continue
        claimed = _claim_table_for_occupying(cand["id"])
        if claimed:
            table = claimed
            break

    if table:
        tnum = table.get("table_number")
        if tnum is not None:
            _record_seating(entry_rid, entry_id, table["id"], tnum,
                            party.get("name") or "Guest", party.get("party_size", 2))
        return {"status": "seated", "table": table}

    # No table could be claimed — entry stays "seated" per the existing contract
    # (caller treats this as "seated without a specific table yet"). Previous behavior.
    return {"status": "seated", "table": None}


@app.post("/queue/{entry_id}/seat-to-table/{table_id}")
def seat_to_table(entry_id: str, table_id: str):
    """Seat an entry at a specific table (floor-map drag-and-drop + walk-in modal).
    Atomically claims both the entry (status='seated') AND the target table (status='occupied').
    If the table is already occupied, the entry-claim is released so it can be re-seated."""
    party = _claim_entry_for_seating(entry_id)
    rid = party.get("restaurant_id") or RESTAURANT_ID

    claimed_table = _claim_table_for_occupying(table_id)
    if not claimed_table:
        # Target table is no longer available — don't leave the entry stuck in 'seated'.
        # If the entry was 'ready' when we claimed it, we also don't know which prior
        # status to revert to, so default to 'waiting' and let the client re-seat.
        _release_entry_claim(entry_id, back_to="waiting")
        raise HTTPException(status_code=409, detail="Table already occupied")

    tnum = claimed_table.get("table_number")
    if tnum is not None:
        _record_seating(rid, entry_id, table_id, tnum,
                        party.get("name") or "Guest", party.get("party_size", 2))
    return {"status": "seated", "table_id": table_id}


class WalkinAtTableRequest(BaseModel):
    name:          Optional[str] = None
    party_size:    int           = 2
    phone:         Optional[str] = None
    notes:         Optional[str] = None
    restaurant_id: Optional[str] = None


@app.post("/queue/walkin-at-table/{table_id}")
def walkin_at_table(table_id: str, body: WalkinAtTableRequest):
    """Atomically create a walk-in queue entry AND seat them at the given table in a single
    server transaction. This replaces the two-call client flow (/queue/join then
    /queue/{id}/seat-to-table/{table_id}) which could partial-fail and leave orphan entries.

    Claim ordering: create entry as 'seated' from the start, then claim the table. If the
    table is unavailable, mark the entry 'removed' so it doesn't pollute the queue."""
    rid = _rid(body.restaurant_id)

    # Claim the table first — fails fast if it's already occupied, no orphan entry created.
    claimed_table = _claim_table_for_occupying(table_id)
    if not claimed_table:
        raise HTTPException(status_code=409, detail="Table already occupied")

    tnum = claimed_table.get("table_number")
    name = (body.name or "").strip() or "Guest"
    party_size = max(1, int(body.party_size or 2))

    # Create the entry already in 'seated' state so no other tab can also try to seat it.
    try:
        ins = supabase.table("queue_entries").insert({
            "name":          name,
            "party_size":    party_size,
            "phone":         (body.phone or "").strip() or None,
            "notes":         (body.notes or "").strip() or None,
            "status":        "seated",
            "source":        "host",
            "restaurant_id": rid,
            "preference":    "asap",
        }).execute()
    except Exception as e:
        # Roll back the table claim — release all sibling rows so duplicates don't stay locked.
        if tnum is not None:
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", tnum).execute()
        else:
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("id", table_id).execute()
        raise HTTPException(status_code=500, detail=f"walkin insert failed: {e}")

    if not ins.data:
        if tnum is not None:
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("restaurant_id", rid).eq("table_number", tnum).execute()
        else:
            supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("id", table_id).execute()
        raise HTTPException(status_code=500, detail="walkin insert returned no data")

    entry = ins.data[0]
    entry_id = entry["id"]

    if tnum is not None:
        _record_seating(rid, entry_id, table_id, tnum, name, party_size)

    return {"status": "seated", "entry": entry, "table_id": table_id, "table_number": tnum}

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
    """Restore a removed or incorrectly-seated entry back to waiting.
    Clears the wait timer so the host re-quotes them fresh (avoids a frozen/overdue bar)."""
    res = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    supabase.table("queue_entries").update({
        "status": "waiting",
        "quoted_wait": None,
        "quoted_wait_set_at": None,
    }).eq("id", entry_id).execute()
    # Also clear the in-memory timer so remaining_wait returns None until re-quoted
    _wait_set_at.pop(entry_id, None)
    updated = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    entry = updated.data[0] if updated.data else res.data[0]
    return {"status": "restored", "entry": entry}


@app.patch("/queue/{entry_id}/wait")
def update_wait(entry_id: str, minutes: int):
    """Update the quoted wait time. Fires link SMS for host-added guests on first quote."""
    if minutes < 1 or minutes > 180:
        raise HTTPException(status_code=400, detail="Wait time must be between 1 and 180 minutes")
    res = supabase.table("queue_entries").select("id, quoted_wait, quoted_wait_set_at, phone, source, restaurant_id").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = res.data[0]
    was_unquoted = entry.get("quoted_wait") is None
    now = _now()
    if was_unquoted:
        # First time quoting — reset the timer origin to now
        _wait_set_at[entry_id] = now
        _set_quoted_wait(entry_id, minutes, now)
    else:
        # Re-quoting an already-quoted guest — keep the original wait_set_at so the
        # guest-side progress bar continues moving forward rather than resetting to 0.
        existing_set_at = _wait_set_at.get(entry_id) or entry.get("quoted_wait_set_at") or now
        _set_quoted_wait(entry_id, minutes, existing_set_at)
        # Do NOT update _wait_set_at — the original start time is the anchor
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
    actual_set_at = now if was_unquoted else existing_set_at
    return {"status": "updated", "quoted_wait": minutes, "wait_set_at": actual_set_at, "sms_sent": sms_sent, "sms_error": sms_error}

@app.patch("/queue/{entry_id}")
def update_entry(entry_id: str, req: QueueUpdateRequest):
    """Update editable fields on a queue entry (party size, phone, quoted wait)."""
    res = supabase.table("queue_entries").select("id, quoted_wait, quoted_wait_set_at").eq("id", entry_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    existing_entry = res.data[0]
    update: dict = {}
    qw_now: Optional[str] = None
    if req.quoted_wait is not None:
        was_unquoted = existing_entry.get("quoted_wait") is None
        if was_unquoted:
            # First quote — reset timer origin to now
            qw_now = _now()
            _wait_set_at[entry_id] = qw_now
        else:
            # Re-quote — keep original start time so progress bar keeps moving forward
            qw_now = _wait_set_at.get(entry_id) or existing_entry.get("quoted_wait_set_at") or _now()
            # Do NOT update _wait_set_at
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

# ── Owner Analytics ────────────────────────────────────────────────────────────

def _check_owner_secret(secret: Optional[str]) -> None:
    op = os.environ.get("OWNER_PASS", "")
    if not op or not secret or secret != op:
        raise HTTPException(status_code=403, detail="Forbidden")

def _owner_rids(restaurant_ids: Optional[str]) -> list:
    """Parse comma-separated restaurant_ids, or return all known restaurant IDs."""
    all_rids = (
        ([RESTAURANT_ID] if RESTAURANT_ID else [])
        + [r["id"] for r in WALNUT_RESTAURANTS]
        + [DEMO_RESTAURANT_ID]
    )
    if restaurant_ids:
        return [r.strip() for r in restaurant_ids.split(",") if r.strip()]
    return all_rids

@app.get("/owner/analytics")
def owner_analytics(restaurant_ids: Optional[str] = None, secret: Optional[str] = None):
    """Deep guest analytics — all queue_entries joined with first seating event per entry.
    Returns up to 5 000 rows ordered by arrival_time desc."""
    _check_owner_secret(secret)
    rids = _owner_rids(restaurant_ids)
    try:
        entries_res = (
            supabase.table("queue_entries")
            .select("id, name, party_size, phone, source, status, arrival_time, quoted_wait, notes, restaurant_id")
            .in_("restaurant_id", rids)
            .order("arrival_time", desc=True)
            .limit(5000)
            .execute()
        )
        entries = entries_res.data or []

        # Fetch seating events in 200-row chunks to stay under Supabase IN-clause limits
        entry_ids = [e["id"] for e in entries]
        seated_at_map: dict = {}
        for i in range(0, len(entry_ids), 200):
            chunk = entry_ids[i:i + 200]
            if not chunk:
                continue
            ev_res = (
                supabase.table("seating_events")
                .select("queue_entry_id, created_at")
                .in_("queue_entry_id", chunk)
                .eq("action", "seated")
                .order("created_at")
                .execute()
            )
            for ev in (ev_res.data or []):
                eid = ev.get("queue_entry_id")
                if eid and eid not in seated_at_map:
                    seated_at_map[eid] = ev["created_at"]

        result = []
        for e in entries:
            seated_at = seated_at_map.get(e["id"])
            actual_wait = None
            if seated_at and e.get("arrival_time"):
                try:
                    arr = datetime.fromisoformat(e["arrival_time"].replace("Z", ""))
                    sat = datetime.fromisoformat(seated_at.replace("Z", ""))
                    actual_wait = max(0, int((sat - arr).total_seconds() / 60))
                except Exception:
                    pass
            result.append({
                "id":            e["id"],
                "name":          e.get("name") or "Guest",
                "party_size":    e.get("party_size"),
                "phone":         e.get("phone"),
                "source":        e.get("source") or "nfc",
                "status":        e.get("status"),
                "arrival_time":  e.get("arrival_time"),
                "quoted_wait":   e.get("quoted_wait"),
                "seated_at":     seated_at,
                "actual_wait":   actual_wait,
                "notes":         e.get("notes"),
                "restaurant_id": e.get("restaurant_id"),
            })

        return {"entries": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/owner/analytics/clear")
def owner_analytics_clear(restaurant_ids: Optional[str] = None, secret: Optional[str] = None):
    """Hard-DELETE queue_entries and seating_events for specified restaurants.
    This permanently frees Supabase row storage. Export CSV before calling this."""
    _check_owner_secret(secret)
    rids = _owner_rids(restaurant_ids)
    freed = {"queue_entries": 0, "seating_events": 0}
    for rid in rids:
        # Delete seating_events first (may reference queue_entries)
        try:
            ev_res = supabase.table("seating_events").delete().eq("restaurant_id", rid).execute()
            freed["seating_events"] += len(ev_res.data or [])
        except Exception as ex:
            print(f"[owner/clear] seating_events delete failed for {rid}: {ex}")
        try:
            q_res = supabase.table("queue_entries").delete().eq("restaurant_id", rid).execute()
            freed["queue_entries"] += len(q_res.data or [])
        except Exception as ex:
            print(f"[owner/clear] queue_entries delete failed for {rid}: {ex}")
        # Clear in-memory occupant cache so the floor map reflects the empty state
        prefix = f"{rid}:"
        with _occupants_lock:
            for k in [k for k in list(_table_occupants.keys()) if k.startswith(prefix)]:
                del _table_occupants[k]
    # All entries gone — clear wait-timer cache too
    _wait_set_at.clear()
    print(f"[owner/clear] freed {freed} rows across {len(rids)} restaurants")
    return {"status": "cleared", "freed": freed, "restaurants": rids}


@app.get("/owner/capacity")
def owner_capacity(secret: Optional[str] = None):
    """Return Supabase row counts for storage capacity monitoring."""
    _check_owner_secret(secret)
    row_counts: dict = {}
    for tbl in ["queue_entries", "seating_events", "tables", "restaurants"]:
        try:
            res = supabase.table(tbl).select("id").limit(10000).execute()
            row_counts[tbl] = len(res.data or [])
        except Exception as ex:
            row_counts[tbl] = -1
            print(f"[owner/capacity] row count failed for {tbl}: {ex}")
    return {"supabase_rows": row_counts, "server_time": _now()}
