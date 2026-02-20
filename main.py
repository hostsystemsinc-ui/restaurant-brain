import os
from typing import Any, Dict, Optional, List

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from supabase import create_client


# ----------------------------
# Config / Env
# ----------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
DEFAULT_RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

if not SUPABASE_URL or not SUPABASE_KEY:
    # We still create the app, but every endpoint will return a clear error
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ----------------------------
# App
# ----------------------------
app = FastAPI(title="restaurant-brain", version="1.0.0")

# CORS (prototype: allow all)
# This fixes localhost -> Railway + OPTIONS preflight issues.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# Models
# ----------------------------
class SeatNextBody(BaseModel):
    restaurant_id: Optional[str] = None  # uuid as string


class ClearTableBody(BaseModel):
    table_id: str                  # uuid as string
    restaurant_id: Optional[str] = None


# ----------------------------
# Helpers
# ----------------------------
def require_supabase():
    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail="Server misconfigured: SUPABASE_URL or SUPABASE_KEY not set on Railway.",
        )


def resolve_restaurant_id(provided: Optional[str]) -> str:
    rid = provided or DEFAULT_RESTAURANT_ID
    if not rid:
        raise HTTPException(
            status_code=400,
            detail="restaurant_id is required (provide in body/query or set RESTAURANT_ID env var).",
        )
    return rid


def ok(data: Any) -> JSONResponse:
    return JSONResponse(status_code=200, content=data)


def fail(status: int, msg: str, extra: Optional[Dict[str, Any]] = None) -> JSONResponse:
    payload: Dict[str, Any] = {"error": msg}
    if extra:
        payload.update(extra)
    return JSONResponse(status_code=status, content=payload)


# ----------------------------
# Global error handler (clean JSON)
# ----------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception):
    # If it's already an HTTPException, FastAPI will handle it.
    # This is for everything else (so Railway doesn’t just "500 Internal Server Error" with no clue)
    return fail(
        500,
        "Internal Server Error",
        {"detail": str(exc)},
    )


# ----------------------------
# Routes
# ----------------------------
@app.get("/")
def root():
    return ok({"status": "restaurant brain alive"})


@app.get("/health")
def health():
    # Quick health endpoint (useful for Railway checks)
    return ok(
        {
            "ok": True,
            "has_supabase": supabase is not None,
            "has_default_restaurant_id": bool(DEFAULT_RESTAURANT_ID),
        }
    )


@app.get("/wait")
def get_latest_wait(
    restaurant_id: Optional[str] = Query(default=None, description="Restaurant UUID"),
):
    """
    Returns latest predicted wait from wait_quotes.
    If you later want per-restaurant filtering, we can add it if your schema has restaurant_id on wait_quotes.
    """
    require_supabase()

    # If your wait_quotes table has restaurant_id, uncomment this filter:
    # rid = resolve_restaurant_id(restaurant_id)
    # query = supabase.table("wait_quotes").select("predicted_wait,created_at").eq("restaurant_id", rid)

    query = (
        supabase.table("wait_quotes")
        .select("predicted_wait,created_at")
        .order("created_at", desc=True)
        .limit(1)
    )

    res = query.execute()

    if not res.data:
        return ok({"predicted_wait": None})

    row = res.data[0]
    return ok({"predicted_wait": row.get("predicted_wait"), "created_at": row.get("created_at")})


@app.get("/tables")
def list_tables(
    restaurant_id: Optional[str] = Query(default=None, description="Restaurant UUID"),
):
    """
    Returns all tables for a restaurant, ordered by table_number (numeric if stored as text).
    """
    require_supabase()
    rid = resolve_restaurant_id(restaurant_id)

    # Pull tables
    res = (
        supabase.table("tables")
        .select("id,restaurant_id,table_number,capacity,status,created_at,updated_at")
        .eq("restaurant_id", rid)
        .execute()
    )

    tables: List[Dict[str, Any]] = res.data or []

    # Sort in Python to handle table_number stored as text ("1","2","10")
    def table_sort_key(t: Dict[str, Any]):
        raw = t.get("table_number")
        try:
            return int(raw)
        except Exception:
            return str(raw)

    tables.sort(key=table_sort_key)
    return ok({"restaurant_id": rid, "tables": tables})


@app.post("/seat-next")
def seat_next_party(body: Optional[SeatNextBody] = None, restaurant_id: Optional[str] = Query(default=None)):
    """
    Seats the next party using your Supabase RPC: seat_next_party(p_restaurant uuid)
    Accepts restaurant_id from:
      - JSON body: {"restaurant_id":"..."}
      - query param: ?restaurant_id=...
      - env var RESTAURANT_ID
    """
    require_supabase()

    rid = resolve_restaurant_id((body.restaurant_id if body else None) or restaurant_id)

    # Call RPC
    rpc = supabase.rpc("seat_next_party", {"p_restaurant": rid}).execute()

    # supabase-py returns .data; for your function you were returning something like:
    # {"status":"seated","table":"1","party":"Test Guest"}
    return ok(rpc.data if rpc.data is not None else {"status": "ok"})


@app.post("/clear-table/{table_id}")
def clear_table_path(table_id: str, restaurant_id: Optional[str] = Query(default=None)):
    """
    Clears a specific table UUID using your Supabase RPC: clear_table(p_table uuid)
    This matches the frontend pattern: POST /clear-table/<uuid>
    """
    require_supabase()

    # restaurant_id not strictly required to clear a table, but we keep it for future audit/logging
    _ = restaurant_id or DEFAULT_RESTAURANT_ID

    rpc = supabase.rpc("clear_table", {"p_table": table_id}).execute()
    return ok(rpc.data if rpc.data is not None else {"status": "cleared", "table_id": table_id})


@app.post("/clear-table")
def clear_table_body(body: ClearTableBody):
    """
    Body-based alternative:
      POST /clear-table
      {"table_id":"..."}
    """
    require_supabase()
    rpc = supabase.rpc("clear_table", {"p_table": body.table_id}).execute()
    return ok(rpc.data if rpc.data is not None else {"status": "cleared", "table_id": body.table_id})
