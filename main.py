import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# ✅ Allow your frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://restaurant-brain-production.up.railway.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "restaurant brain alive"}

@app.get("/tables")
def get_tables():
    res = (
        supabase.table("tables")
        .select("*")
        .eq("restaurant_id", RESTAURANT_ID)
        .execute()
    )
    return res.data

@app.post("/seat-next")
def seat_next():
    result = supabase.rpc(
        "seat_next_party",
        {"p_restaurant": RESTAURANT_ID}
    ).execute()
    return result.data

@app.post("/clear-table/{table_id}")
def clear_table(table_id: str):
    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()
    return result.data
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://restaurant-brain-production.up.railway.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
