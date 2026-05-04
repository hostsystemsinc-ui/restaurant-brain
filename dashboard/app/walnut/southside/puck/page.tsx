// NFC puck entry point — The Southside Walnut Cafe
// Program NFC pucks with: https://hostplatform.net/walnut/southside/puck
//
// Immediately redirects to the join page with src=nfc so the backend records
// that this guest arrived via NFC tap rather than QR code scan.
// The guest experience is identical — they land on the same join page.

import { redirect } from "next/navigation"

export default function SouthsidePuckPage() {
  redirect("/walnut/southside/join?src=nfc")
}
