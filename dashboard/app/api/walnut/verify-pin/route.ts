import { NextResponse } from "next/server"
import { getAdminPin } from "@/lib/walnut-settings"

const COOKIE_NAME = "walnut_admin_pin_ok"
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   60 * 60 * 4, // 4 hours
}

/**
 * POST /api/walnut/verify-pin — verifies 4-digit admin PIN.
 * Body: { pin: string }
 * On success: sets walnut_admin_pin_ok httpOnly cookie (4h), returns {ok:true}
 * On failure: returns {ok:false}, 401
 */
export async function POST(req: Request) {
  try {
    const { pin } = await req.json()
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ ok: false, error: "Missing PIN" }, { status: 400 })
    }

    const expected = getAdminPin()
    if (pin !== expected) {
      await new Promise(r => setTimeout(r, 400)) // timing-safe delay
      return NextResponse.json({ ok: false, error: "Incorrect PIN" }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, "1", COOKIE_OPTS)
    return res
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
  }
}
