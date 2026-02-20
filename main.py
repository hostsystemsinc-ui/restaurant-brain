import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

# Environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

# Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# ✅ CORS (single middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://restaurant-brain-production.up.railway.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root
@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

# Health check
@app.get("/health")
def health():
    return {"status": "ok"}

# Get tables
@app.get("/tables")
def get_tables():
    res = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .execute()
    )
    return res.data

# Seat next party (RPC)
@app.post("/seat-next")
def seat_next():
    result = supabase.rpc(
        "seat_next_party",
        {"p_restaurant": RESTAURANT_ID}
    ).execute()
    return result.data

# Clear table (RPC)
@app.post("/clear-table/{table_id}")
def clear_table(table_id: str):
    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()
    return result.data

# Manual seat party (fallback endpoint for testing)
@app.post("/seat-party")
def seat_party(table_id: str, party_name: str):
    try:
        supabase.table("tables").update({
            "status": "occupied"
        }).eq("id", table_id).execute()

        return {"status": "seated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/join-waitlist")
def join_waitlist(name: str, party_size: int):
    try:
        supabase.table("waitlist_entries").insert({
            "restaurant_id": RESTAURANT_ID,
            "name": name,
            "party_size": party_size,
            "status": "waiting"
        }).execute()

        return {"status": "joined"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
