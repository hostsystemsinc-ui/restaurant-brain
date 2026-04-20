import { NextResponse } from "next/server"
import { getAdminPin } from "@/lib/walnut-settings"

const COOKIE_NAME = "walnut_admin_pin_ok"

/**
 * POST /api/walnut/verify-pin — verifies 4-digit admin PIN.
 * Body: { pin: string }
 * On success: sets walnut_admin_pin_ok as a SESSION cookie (no maxAge —
 *   clears when the browser closes so PIN is always required on new sessions).
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
    // Session cookie — no maxAge means it clears when the browser closes.
    // This ensures the PIN is always required when opening a new browser session.
    res.cookies.set(COOKIE_NAME, "1", {
      httpOnly: true,
      sameSite: "lax",
      path:     "/",
      // intentionally no maxAge so it's a session cookie
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
  }
}
