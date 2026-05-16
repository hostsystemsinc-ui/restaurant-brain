# HOST Station — Android App

React Native (Expo) app for restaurant clients on Samsung tablets.
Distributed as a direct APK — not on the Play Store.

## What it does
- Opens to the HOST logo + login screen
- Client enters their username and password (same credentials the owner sets for them)
- Loads the HOST station in a full-screen, kiosk-style WebView
- Screen stays on permanently
- Back button stays within the station — can't exit accidentally
- **Never logs out** — credentials are stored securely on-device and re-used automatically on every launch

---

## Setup (one time)

### Prerequisites
- Node 18+ (`node -v`)
- An Expo account (free) at https://expo.dev
- EAS CLI: `npm install -g eas-cli`

### Install dependencies
```bash
cd host-app
npm install
```

### Log into Expo
```bash
eas login
```

### Configure the project (one time)
```bash
eas build:configure
```
When prompted, select **Android**.

---

## Build the APK

```bash
npm run build:apk
```

This runs `eas build --platform android --profile preview` which:
1. Uploads the code to Expo's build servers (no Android Studio needed)
2. Builds a release APK
3. Gives you a download URL when done (~10-15 minutes)

Download the APK and send it directly to your client (email, Google Drive, AirDrop, etc.).

---

## Install on Samsung tablet

1. Send the APK file to the tablet (email, Google Drive, etc.)
2. On the tablet: open the APK file
3. Tap **Install** — Android will warn "unknown source", that's normal, tap **Install anyway**
4. Open **HOST Station** from the home screen
5. Client enters their username and password → they're in, permanently

---

## Adding a new client

1. Add their account to `dashboard/app/api/client/app-token/route.ts` and `dashboard/app/api/client/auth/route.ts`
   (same username and `CLIENT_PASS_XXX` env var pattern already used)
2. Set the env var on Railway
3. Send the same APK to the new client — no rebuild needed

---

## Updating the app

After any code changes:
```bash
npm run build:apk
```
Download the new APK and send it to your clients. They install it over the existing version.

---

## Credentials stored on device

- Username and password are stored in Android's **Encrypted SharedPreferences** via `expo-secure-store`
- They never appear in any URL — only POSTed over HTTPS during login
- The session token (60-second one-time token) is URL-safe but expires before anyone could use it
