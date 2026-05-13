import { NextResponse } from "next/server"

// GET /api/client/app-auth-error
// Returned when an app-auth token is missing, expired, or already used.
// The Android app's WebView detects this URL and triggers a re-auth flow.
export async function GET() {
  return NextResponse.json(
    { error: "auth_token_expired", message: "Token expired. The app will log you in again automatically." },
    { status: 401 }
  )
}
