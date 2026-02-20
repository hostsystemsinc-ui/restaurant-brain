import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client

# -----------------------------
# Environment variables
# -----------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise Exception("Missing Supabase environment variables")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -----------------------------
# Request models
# -----------------------------
class SeatNextRequest(BaseModel):
    restaurant_id: str | None = None

class ClearTableRequest(BaseModel):
    table_id: str

# -----------------------------
# Health check
# -----------------------------
@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

# -----------------------------
# Get latest predicted wait
# -----------------------------
@app.get("/wait")
def get_wait():
    try:
        res = (
            supabase.table("wait_quotes")
            .select("predicted_wait")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if res.data:
            return {"predicted_wait": res.data[0]["predicted_wait"]}

        return {"predicted_wait": None}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Seat next party
# -----------------------------
@app.post("/seat-next")
from fastapi import Body

@app.post("/clear-table")
def clear_table_api(payload: dict = Body(...)):
    table_id = payload.get("table_id")

    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()

    return result.data
def seat_next(payload: SeatNextRequest):
    rid = payload.restaurant_id or RESTAURANT_ID

    if not rid:
        raise HTTPException(status_code=400, detail="Missing restaurant_id")

    try:
        result = supabase.rpc(
            "seat_next_party",
            {"p_restaurant_id": rid}
        ).execute()

        if getattr(result, "error", None):
            raise HTTPException(status_code=500, detail=str(result.error))

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Clear table
# -----------------------------
@app.post("/clear-table")
def clear_table(payload: ClearTableRequest):
    try:
        result = supabase.rpc(
            "clear_table",
            {"p_table": payload.table_id}
        ).execute()

        if getattr(result, "error", None):
            raise HTTPException(status_code=500, detail=str(result.error))

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/tables")
def get_tables():
    res = supabase.table("tables").select("*").execute()
    return res.data
from fastapi import Body

@app.post("/clear-table")
def clear_table_api(payload: dict = Body(...)):
    table_id = payload.get("table_id")

    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()

    return result.data
