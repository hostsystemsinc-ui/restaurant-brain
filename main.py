from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os

# ---------- CONFIG ----------

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# ---------- CORS (VERY IMPORTANT) ----------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- HEALTH ----------

@app.get("/")
def health():
    return {"status": "restaurant brain running"}

# ---------- GET TABLES ----------

@app.get("/tables")
def get_tables():
    result = supabase.table("tables").select("*").execute()
    return result.data

# ---------- SEAT NEXT ----------

@app.post("/seat-next")
def seat_next():
    result = supabase.rpc("seat_next_party").execute()
    return result.data

# ---------- CLEAR TABLE ----------

@app.post("/clear-table/{table_id}")
def clear_table(table_id: str):
    result = supabase.rpc(
        "clear_table",
        {"p_table": table_id}
    ).execute()

    return {"ok": True, "data": result.data}
