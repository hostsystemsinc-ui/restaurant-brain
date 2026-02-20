import os
from fastapi import FastAPI
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

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
    res = supabase.table("wait_quotes") \
        .select("predicted_wait") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if res.data:
        return {"predicted_wait": res.data[0]["predicted_wait"]}

    return {"predicted_wait": None}

# -----------------------------
# Seat next party
# -----------------------------
@app.post("/seat-next")
def seat_next():
    result = supabase.rpc(
        "seat_next_party",
        {"p_restaurant_id": RESTAURANT_ID}
    ).execute()

    return result.data

# -----------------------------
# Clear table
# -----------------------------
@app.post("/clear-table/{table_id}")
def clear_table(table_id: str):
    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()

    return result.data
