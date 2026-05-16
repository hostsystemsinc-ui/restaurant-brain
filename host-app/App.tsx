import React, { useState, useEffect, useCallback } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import * as SecureStore from "expo-secure-store"
import { useFonts } from "expo-font"
import { StatusBar } from "expo-status-bar"
import { LoginScreen } from "./screens/LoginScreen"
import { StationScreen } from "./screens/StationScreen"

type Screen = "loading" | "login" | "station"

function buildAuthHtml(username: string, password: string): string {
  const creds = JSON.stringify({ username, password })
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; background: #fff; display: flex;
           align-items: center; justify-content: center;
           height: 100vh; font-family: sans-serif; }
    .dot { width: 8px; height: 8px; border-radius: 50%;
           background: #111; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }
  </style>
</head>
<body>
  <div class="dot"></div>
  <script>
    var creds = ${creds};
    fetch('https://hostplatform.net/api/client/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(creds)
    })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(d) {
      window.location.replace('https://hostplatform.net' + (d.redirect || '/station'));
    })
    .catch(function(err) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH_FAILED', err: String(err) }));
      }
    });
  </script>
</body>
</html>`
}

export default function App() {
  const [screen,   setScreen]   = useState<Screen>("loading")
  const [authHtml, setAuthHtml] = useState("")

  // Load Arial Black before rendering anything — font is guaranteed ready
  // by the time LoginScreen mounts.
  const [fontsLoaded] = useFonts({
    "ArialBlack": require("./assets/fonts/ArialBlack.ttf"),
  })

  useEffect(() => {
    if (!fontsLoaded) return   // wait for font before auto-login check
    ;(async () => {
      try {
        const u = await SecureStore.getItemAsync("host_u")
        const p = await SecureStore.getItemAsync("host_p")
        if (u && p) {
          setAuthHtml(buildAuthHtml(u, p))
          setScreen("station")
          return
        }
      } catch {
        await SecureStore.deleteItemAsync("host_u").catch(() => {})
        await SecureStore.deleteItemAsync("host_p").catch(() => {})
      }
      setScreen("login")
    })()
  }, [fontsLoaded])

  const handleLogin = useCallback(async (username: string, password: string) => {
    const res = await fetch("https://hostplatform.net/api/client/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error("Invalid credentials")
    await SecureStore.setItemAsync("host_u", username)
    await SecureStore.setItemAsync("host_p", password)
    setAuthHtml(buildAuthHtml(username, password))
    setScreen("station")
  }, [])

  const handleAuthFailed = useCallback(async () => {
    try {
      const u = await SecureStore.getItemAsync("host_u")
      const p = await SecureStore.getItemAsync("host_p")
      if (u && p) { setAuthHtml(buildAuthHtml(u, p)); return }
    } catch {}
    setScreen("login")
  }, [])

  const handleSignOut = useCallback(async () => {
    await SecureStore.deleteItemAsync("host_u").catch(() => {})
    await SecureStore.deleteItemAsync("host_p").catch(() => {})
    setAuthHtml("")
    setScreen("login")
  }, [])

  if (!fontsLoaded || screen === "loading") {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" hidden />
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    )
  }

  if (screen === "login") {
    return <LoginScreen onLogin={handleLogin} />
  }

  return <StationScreen authHtml={authHtml} onAuthFailed={handleAuthFailed} onSignOut={handleSignOut} />
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
})
