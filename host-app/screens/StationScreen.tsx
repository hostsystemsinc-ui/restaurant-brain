import React, { useRef, useEffect, useState } from "react"
import { StyleSheet, View, BackHandler, Platform, TouchableOpacity, Text } from "react-native"
import { WebView, WebViewMessageEvent } from "react-native-webview"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import * as NavigationBar from "expo-navigation-bar"
import { StatusBar } from "expo-status-bar"

const BASE_URL = "https://hostplatform.net"

interface Props {
  authHtml:     string
  onAuthFailed: () => void
  onSignOut:    () => void
}

export function StationScreen({ authHtml, onAuthFailed, onSignOut }: Props) {
  const webviewRef          = useRef<WebView>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    activateKeepAwakeAsync("station").catch(() => {})
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden").catch(() => {})
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {})
    }
    return () => { deactivateKeepAwake("station") }
  }, [])

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (confirming) { setConfirming(false); return true }
      webviewRef.current?.goBack()
      return true
    })
    return () => sub.remove()
  }, [confirming])

  const prevHtml = useRef(authHtml)
  useEffect(() => {
    if (authHtml !== prevHtml.current) {
      prevHtml.current = authHtml
      webviewRef.current?.reload()
    }
  }, [authHtml])

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string }
      if (msg.type === "AUTH_FAILED") onAuthFailed()
    } catch {}
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" hidden />

      <WebView
        ref={webviewRef}
        source={{ html: authHtml, baseUrl: BASE_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        bounces={false}
        overScrollMode="never"
        allowsBackForwardNavigationGestures={false}
        contentInsetAdjustmentBehavior="never"
      />

      {/* Sign out button — bottom-right corner, low-profile */}
      {!confirming && (
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => setConfirming(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      )}

      {/* Confirmation overlay */}
      {confirming && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Sign out?</Text>
            <Text style={styles.confirmSub}>You'll need to log in again to use HOST.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirming(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={onSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  webview:   { flex: 1 },

  signOutBtn: {
    position:          "absolute",
    bottom:            14,
    left:              16,
    paddingVertical:   8,
    paddingHorizontal: 16,
    borderRadius:      10,
    backgroundColor:   "rgba(30,30,30,0.72)",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.18)",
  },
  signOutText: {
    fontSize:      13,
    fontWeight:    "600",
    color:         "#fff",
    letterSpacing: 0.3,
  },

  confirmOverlay: {
    position:        "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent:  "center",
    alignItems:      "center",
  },
  confirmBox: {
    width:           320,
    backgroundColor: "#fff",
    borderRadius:    18,
    padding:         28,
    alignItems:      "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.18,
    shadowRadius:    24,
    elevation:       12,
  },
  confirmTitle: {
    fontSize:   20,
    fontWeight: "700",
    color:      "#111827",
    marginBottom: 8,
  },
  confirmSub: {
    fontSize:     13,
    color:        "#6B7280",
    textAlign:    "center",
    marginBottom: 26,
    lineHeight:   19,
  },
  confirmButtons: {
    flexDirection: "row",
    gap:           12,
    width:         "100%",
  },
  cancelBtn: {
    flex:            1,
    height:          46,
    borderRadius:    11,
    backgroundColor: "#F3F4F6",
    justifyContent:  "center",
    alignItems:      "center",
  },
  cancelText: {
    fontSize:   14,
    fontWeight: "600",
    color:      "#374151",
  },
  confirmBtn: {
    flex:            1,
    height:          46,
    borderRadius:    11,
    backgroundColor: "#111827",
    justifyContent:  "center",
    alignItems:      "center",
  },
  confirmText: {
    fontSize:   14,
    fontWeight: "700",
    color:      "#fff",
  },
})
