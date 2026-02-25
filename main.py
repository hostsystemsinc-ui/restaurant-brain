import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# ── Environment ─────────────────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get("SUPABASE_URL")
SUPABASE_KEY  = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TWILIO_SID    = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM   = os.environ.get("TWILIO_FROM_NUMBER", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Restaurant Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ──────────────────────────────────────────────────────────

class JoinQueueRequest(BaseModel):
    name:       Optional[str] = None
    party_size: int
    phone:      Optional[str] = None
    preference: Optional[str] = "asap"  # asap | 15min | 30min | HH:MM
    source:     Optional[str] = "nfc"   # nfc | host | phone | web

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

def _send_sms(to_phone: str, body: str) -> bool:
    """Send an SMS via Twilio. Returns True if sent, False otherwise."""
    if not (TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM):
        return False
    normalized = _e164(to_phone)
    if not normalized:
        return False
    try:
        from twilio.rest import Client
        Client(TWILIO_SID, TWILIO_TOKEN).messages.create(
            body=body,
            from_=TWILIO_FROM,
            to=normalized,
        )
        return True
    except Exception:
        return False

def _active_queue() -> list:
    return (
        supabase.table("queue_entries")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .in_("status", ["waiting", "ready"])
        .order("created_at")
        .execute()
        .data
    )

def _wait_estimate(parties_ahead: int, party_size: int = 2) -> int:
    try:
        tables    = supabase.table("tables").select("status, capacity").eq("restaurant_id", RESTAURANT_ID).execute().data
        available = [t for t in tables if t["status"] == "available"]
        if parties_ahead == 0 and available:
            return 0
        seats_avail = sum(t["capacity"] for t in available)
        if seats_avail >= party_size * max(1, parties_ahead):
            return max(5, parties_ahead * 10)
        return max(15, parties_ahead * 20)
    except Exception:
        return max(5, parties_ahead * 20)

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

@app.get("/restaurant")
def get_restaurant():
    res = supabase.table("restaurants").select("*").eq("id", RESTAURANT_ID).execute()
    if res.data:
        return res.data[0]
    return {"id": RESTAURANT_ID, "name": "Restaurant"}

# ── Tables ───────────────────────────────────────────────────────────────────

@app.get("/tables")
def get_tables():
    return (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .order("table_number")
        .execute()
        .data
    )

@app.post("/tables/{table_id}/clear")
def clear_table(table_id: str):
    supabase.table("tables").update({"status": "available", "updated_at": _now()}).eq("id", table_id).execute()
    return {"status": "cleared"}

@app.post("/clear-table/{table_id}")  # legacy
def clear_table_legacy(table_id: str):
    return clear_table(table_id)

# ── Queue ────────────────────────────────────────────────────────────────────

@app.get("/queue")
def get_queue():
    entries = _active_queue()
    for i, e in enumerate(entries):
        e["position"]      = i + 1
        e["wait_estimate"] = _wait_estimate(i, e.get("party_size", 2))
    return entries

@app.get("/waitlist")  # legacy
def get_waitlist_legacy():
    return get_queue()

@app.post("/queue/join")
def join_queue(req: JoinQueueRequest):
    try:
        queue    = _active_queue()
        ahead    = len(queue)
        wait_est = _wait_estimate(ahead, req.party_size)
        entry    = supabase.table("queue_entries").insert({
            "restaurant_id": RESTAURANT_ID,
            "name":          req.name or "Guest",
            "party_size":    req.party_size,
            "phone":         req.phone,
            "source":        req.source or "nfc",
            "status":        "waiting",
            "quoted_wait":   wait_est,
            "arrival_time":  _now(),
            "notes":         req.preference or "asap",
        }).execute()
        try:
            supabase.table("wait_quotes").insert({
                "restaurant_id": RESTAURANT_ID,
                "party_size":    req.party_size,
                "quoted_minutes": wait_est,
                "model_version": "v1-rule",
            }).execute()
        except Exception:
            pass
        return {"status": "joined", "entry": entry.data[0], "wait_estimate": wait_est, "position": ahead + 1}
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
        all_ids  = [e["id"] for e in _active_queue()]
        position = (all_ids.index(entry_id) + 1) if entry_id in all_ids else 1
        entry["position"]      = position
        entry["parties_ahead"] = position - 1
        entry["wait_estimate"] = _wait_estimate(position - 1, entry.get("party_size", 2))
    return entry

@app.post("/queue/{entry_id}/seat")
def seat_entry(entry_id: str):
    party_res = supabase.table("queue_entries").select("*").eq("id", entry_id).execute()
    if not party_res.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    party = party_res.data[0]

    table_res = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
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
        try:
            supabase.table("seating_events").insert({
                "restaurant_id": RESTAURANT_ID, "table_id": table["id"],
                "queue_entry_id": entry_id, "action": "seated",
            }).execute()
        except Exception:
            pass

    return {"status": "seated", "table": table}

@app.post("/queue/{entry_id}/notify")
def notify_ready(entry_id: str):
    # 1. Mark as ready in DB
    supabase.table("queue_entries").update({"status": "ready"}).eq("id", entry_id).execute()

    # 2. Send SMS if the guest provided a phone number
    sms_sent = False
    try:
        entry_res = supabase.table("queue_entries").select("phone, name").eq("id", entry_id).execute()
        if entry_res.data and entry_res.data[0].get("phone"):
            phone = entry_res.data[0]["phone"]
            rest_res = supabase.table("restaurants").select("name").eq("id", RESTAURANT_ID).execute()
            rest_name = rest_res.data[0]["name"] if rest_res.data else "the restaurant"
            sms_sent = _send_sms(
                to_phone=phone,
                body=f"Your table at {rest_name} is ready! Please see the host.",
            )
    except Exception:
        pass  # Never let SMS failure block the notify response

    return {"status": "notified", "sms_sent": sms_sent}

@app.post("/queue/{entry_id}/remove")
def remove_entry(entry_id: str):
    supabase.table("queue_entries").update({"status": "removed"}).eq("id", entry_id).execute()
    return {"status": "removed"}

@app.post("/seat-next")  # legacy
def seat_next():
    res = supabase.table("queue_entries").select("*").eq("restaurant_id", RESTAURANT_ID).eq("status", "waiting").order("created_at").limit(1).execute()
    if not res.data:
        return {"status": "no_parties_waiting"}
    return seat_entry(res.data[0]["id"])

# ── Insights ─────────────────────────────────────────────────────────────────

@app.get("/insights")
def get_insights():
    try:
        tables = supabase.table("tables").select("*").eq("restaurant_id", RESTAURANT_ID).execute().data
        queue  = _active_queue()

        available   = sum(1 for t in tables if t["status"] == "available")
        occupied    = len(tables) - available
        waiting     = len([q for q in queue if q["status"] == "waiting"])

        return {
            "tables_total":         len(tables),
            "tables_available":     available,
            "tables_occupied":      occupied,
            "parties_waiting":      waiting,
            "parties_ready":        len(queue) - waiting,
            "avg_wait_estimate":    _wait_estimate(waiting),
            "capacity_utilization": round(occupied / len(tables) * 100) if tables else 0,
            "ai_insights":          _ai_insights(tables, queue),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Event ingestion ───────────────────────────────────────────────────────────

@app.post("/events/camera")
def log_camera(req: CameraEventRequest):
    supabase.table("camera_events").insert({"restaurant_id": RESTAURANT_ID, "zone": req.zone, "people_count": req.people_count}).execute()
    return {"status": "logged"}

@app.post("/events/delivery")
def log_delivery(req: DeliveryEventRequest):
    supabase.table("delivery_events").insert({"restaurant_id": RESTAURANT_ID, "provider": req.provider, "active_orders": req.active_orders}).execute()
    return {"status": "logged"}

@app.post("/events/throughput")
def log_throughput(req: ThroughputEventRequest):
    supabase.table("throughput_events").insert({"restaurant_id": RESTAURANT_ID, "metric": req.metric, "value": req.value, "metadata": req.metadata}).execute()
    return {"status": "logged"}

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
