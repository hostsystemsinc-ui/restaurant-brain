import os
from fastapi import FastAPI
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

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
