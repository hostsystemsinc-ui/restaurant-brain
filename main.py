import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

# Environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

# Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# ✅ CORS (ONLY ONCE — at top)
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

# Health check
@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

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

# Seat next party
@app.post("/seat-next")
def seat_next():
    result = supabase.rpc(
        "seat_next_party",
        {"p_restaurant": RESTAURANT_ID}
    ).execute()
    return result.data

# Clear table
@app.post("/clear-table/{table_id}")
def clear_table(table_id: str):
    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()
    return result.data
@app.get("/health")
def health():
    return {"status": "ok"}
    @app.post("/seat-party")
def seat_party(table_id: str, party_name: str):
    try:
        supabase.table("tables").update({
            "status": "occupied"
        }).eq("id", table_id).execute()

        return {"status": "seated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
