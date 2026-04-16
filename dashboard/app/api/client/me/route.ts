import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { RESTAURANT_CONFIG } from "@/lib/restaurant-config"

// GET /api/client/me — returns restaurant config for the currently logged-in client
export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get("host_client_session")
  if (!session?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const config = RESTAURANT_CONFIG[session.value]
  if (!config) {
    return NextResponse.json({ error: "Unknown account" }, { status: 404 })
  }

  return NextResponse.json({ account: session.value, ...config })
}
