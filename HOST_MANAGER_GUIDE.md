# HOST — Manager Quick Reference
### The Walnut Cafe · Walnut Original & Walnut Southside

---

## WHAT IS HOST?

HOST is the digital waitlist and floor management system used by your hosts. It runs on an iPad at the host stand. This guide covers everything a manager needs to know: how the system works, what each button does, and what to do when something goes wrong.

---

## OPENING THE APP

**URL:** `https://hostplatform.net/station`
*(bookmark this on the iPad — it works in any browser)*

Log in with your restaurant's credentials. The app opens to the **Host Station**, which has two panels:

- **Left panel** — the live waitlist (guests waiting)
- **Right panel** — the floor map (tables)

There is also a **History tab** at the top of the left panel to see who was seated or removed today.

---

## THE WAITLIST PANEL

### Adding a Guest
Tap **+ Add Guest** (top of the waitlist).

Fill in:
| Field | Required? | Notes |
|---|---|---|
| Name | Yes | Last name or full name |
| Party size | Yes | Number of people |
| Phone number | No | For SMS notifications |
| Notes | No | Allergies, birthday, etc. |
| Quoted wait | No | Minutes until table ready |

Tap **Add to Waitlist**. The guest appears at the bottom of the queue.

---

### The Guest Card

Each waiting guest shows as a card. From left to right:
- **Name & party size**
- **Wait timer** — counts up from when the quoted wait was set. Turns red when overdue.
- **Action buttons** (across the bottom of the card):

| Button | What it does |
|---|---|
| **SEAT** | Marks the guest as seated. Auto-picks the smallest available table that fits them. |
| **NOTIFY** | Sends the guest an SMS "your table is ready" and highlights their card in green. Use this when the table is being bussed — the guest gets a heads-up before you formally seat them. |
| **+5 MIN** | Adds 5 minutes to their quoted wait. Use this when service is running behind. |
| **EDIT** | Change name, party size, phone, notes, or quoted wait time. |
| **REMOVE** | Removes the guest from the list (they left, no-show, etc.). Appears in History. |

---

### Quoting a Wait Time

When you add a guest, you can type in a quoted wait (e.g., "20" for 20 minutes).

- The timer bar on their card will count down.
- If the timer hits zero and they're not seated, the bar turns red.
- Use **+5 MIN** to extend without opening the full edit screen.
- If you need to change it more than 5 minutes, tap **EDIT**.

---

## THE FLOOR MAP PANEL

The right side shows your tables. Colors mean:

| Color | Status |
|---|---|
| 🟢 Green | Table is available |
| 🔴 Red | Table is occupied (shows guest name + party size) |

### Seating a Guest at a Specific Table

**Drag and drop:** Press and hold a guest card, then drag it onto a table. Release to seat them at that table.

**OR** tap the **SEAT** button on the card — the system will auto-pick the best available table.

**OR** tap directly on a green table — a picker appears to choose which guest to seat there.

### Moving a Guest to a Different Table

Drag their name from the occupied table and drop it onto a green table. The old table clears automatically.

### Clearing a Table (Guest Has Left)

Tap a red table. Tap **Clear Table**. The table turns green immediately.

---

## SMS NOTIFICATIONS

HOST can text guests at two moments:

1. **When added** — if a phone number and quoted wait are entered, the guest gets a text confirming their place in the waitlist.
2. **When you tap NOTIFY** — the guest gets a text saying their table is ready.

SMS works automatically. No extra steps needed.

> **Note:** SMS requires that the guest's phone number was entered. If no number was entered, the buttons still work — the guest just won't get a text.

---

## THE HISTORY TAB

Tap **History** at the top of the left panel.

Shows every guest who was **Seated** or **Removed** today (resets at 3am each night).

To restore a guest to the waitlist (e.g., you seated them by mistake):
- Find them in History
- Tap **Restore to Waitlist**
- They reappear in the queue — you'll need to re-quote their wait time

---

## THE ADMIN DASHBOARD

**URL:** `https://hostplatform.net/walnut/dashboard`

Managers can view both locations from one screen:
- Live queue length at each restaurant
- Tables available vs. occupied
- Average wait time
- Today's covers (how many guests seated so far)

This page is read-only — it's for monitoring, not for seating guests.

---

## COMMON SITUATIONS

### "A guest left but the table is still red"
Tap the red table → tap **Clear Table**.

### "I quoted the wrong wait time"
Tap **EDIT** on the guest's card → change the quoted wait → save.  
Or tap **+5 MIN** repeatedly if they just need a small extension.

### "I seated the wrong guest / seated someone by mistake"
Go to the **History tab** → find the guest → tap **Restore to Waitlist**. They'll reappear in the queue. Then seat the correct guest.

### "A guest's timer is red (overdue) but they're still waiting"
Their quoted wait has passed. Either:
- Tap **+5 MIN** to buy more time while a table turns
- Tap **EDIT** to set a new time
- Notify and seat them as soon as a table opens

### "I added a guest with the wrong name/size"
Tap **EDIT** on their card → fix it → save.

### "I accidentally removed a guest (they didn't actually leave)"
Go to **History tab** → tap **Restore to Waitlist** next to their name. They reappear in the queue with no timer — re-quote their wait.

### "The app isn't loading / showing a spinning wheel"
Check the iPad's WiFi connection. The app needs internet to sync with the server. If the connection drops, it will automatically reconnect and catch up when WiFi returns.

### "The floor map shows a table as red but no one is there"
Tap the table → tap **Clear Table**. This can happen if a guest was seated directly in the system without updating the floor map.

---

## TIPS FOR BUSY SERVICE

- **Quote every guest a wait time** when you add them — it sets the right expectation and the SMS system only activates when a time is set.
- **Use NOTIFY before SEAT** — send the SMS when the table is being bussed, then formally seat once the table is clean. Guests arrive ready to sit down.
- **Use +5 MIN freely** — it's faster than EDIT and keeps timers accurate.
- **Drag to specific tables** when you know where you want to put a party. Auto-seat is fine for flexibility.
- **Check History at the end of each shift** to get a count of covers.

---

## WHAT RESETS EACH NIGHT

At **3am**, the business day resets:
- History clears (yesterday's is gone)
- Wait timers reset

Everything else (tables, occupant names) carries over until explicitly cleared.

---

## QUICK REFERENCE CARD

```
ADD GUEST:        + Add Guest button (top left)
SEAT GUEST:       SEAT button or drag card to table
NOTIFY GUEST:     NOTIFY button → sends "table ready" SMS
EXTEND WAIT:      +5 MIN button (adds 5 minutes)
EDIT GUEST:       EDIT button → change any field
REMOVE GUEST:     REMOVE button → gone from queue, stays in History
CLEAR TABLE:      Tap red table → Clear Table
RESTORE GUEST:    History tab → Restore to Waitlist
MOVE TABLE:       Drag guest name from one table to another
ADMIN VIEW:       hostplatform.net/walnut/dashboard
HOST STATION:     hostplatform.net/station
```

---

*Questions or issues: contact your HOST administrator.*
