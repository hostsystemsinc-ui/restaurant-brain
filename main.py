import os
import time
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def predict_wait(queue_size, ticket_time, delivery_load):
    return int(queue_size * ticket_time * 0.4 + delivery_load * 3)

def recompute():

    demand = supabase.table("demand_events") \
        .select("count") \
        .eq("restaurant_id", RESTAURANT_ID) \
        .execute()

    throughput = supabase.table("throughput_events") \
        .select("value") \
        .eq("restaurant_id", RESTAURANT_ID) \
        .execute()

    delivery = supabase.table("delivery_events") \
        .select("active_orders") \
        .eq("restaurant_id", RESTAURANT_ID) \
        .execute()

    queue_size = sum(d["count"] for d in demand.data) if demand.data else 0
    ticket_time = throughput.data[-1]["value"] if throughput.data else 15
    delivery_load = delivery.data[-1]["active_orders"] if delivery.data else 0

    prediction = predict_wait(queue_size, ticket_time, delivery_load)

    supabase.table("ai_predictions").insert({
        "restaurant_id": RESTAURANT_ID,
        "predicted_wait": prediction,
        "confidence": 0.8,
        "model_version": "v1"
    }).execute()

    print("Updated prediction:", prediction)

print("Restaurant brain running...")

while True:
    recompute()
    time.sleep(15)
