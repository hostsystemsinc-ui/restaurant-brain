import os
import time
from supabase import create_client

# Environment variables from Railway
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESTAURANT_ID = os.environ.get("RESTAURANT_ID")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def predict_wait(queue_size, ticket_time, delivery_load):
    # Simple model — we can upgrade later
    return int(queue_size * ticket_time * 0.4 + delivery_load * 3)

def recompute():
    try:
        print("Restaurant brain running...")

        # Demand events (walk-ins etc)
        demand = supabase.table("demand_events") \
            .select("count") \
            .eq("restaurant_id", RESTAURANT_ID) \
            .execute()

        # Kitchen throughput
        throughput = supabase.table("throughput_events") \
            .select("value") \
            .eq("restaurant_id", RESTAURANT_ID) \
            .execute()

        # Delivery load
        delivery = supabase.table("delivery_events") \
            .select("active_orders") \
            .eq("restaurant_id", RESTAURANT_ID) \
            .execute()

        # Current waiting guests
        queue = supabase.table("queue_entries") \
            .select("*") \
            .eq("status", "waiting") \
            .execute()

        queue_size = len(queue.data)

        ticket_time = throughput.data[-1]["value"] if throughput.data else 15
        delivery_load = delivery.data[-1]["active_orders"] if delivery.data else 0

        predicted_wait = predict_wait(queue_size, ticket_time, delivery_load)

        print(f"Updated prediction: {predicted_wait}")

        # Store prediction
        supabase.table("wait_quotes").insert({
            "restaurant_id": RESTAURANT_ID,
            "predicted_wait": predicted_wait,
            "model_version": "v1"
        }).execute()

    except Exception as e:
        print("Error:", e)

# Run forever
while True:
    recompute()
    time.sleep(30)
