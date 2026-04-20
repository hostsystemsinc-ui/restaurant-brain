import { NextResponse } from "next/server"
import { cookies } from "next/headers"

/** GET /api/walnut/check-pin — returns {ok:true} if the admin PIN cookie is set */
export async function GET() {
  const cookieStore = await cookies()
  const pin = cookieStore.get("walnut_admin_pin_ok")
  return NextResponse.json({ ok: !!pin?.value })
}
