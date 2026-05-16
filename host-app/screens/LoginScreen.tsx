import React, { useState, useRef } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform,
} from "react-native"
import { StatusBar } from "expo-status-bar"

const GREEN = "#22C55E"

interface Props {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const passRef = useRef<TextInput>(null)

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password.")
      return
    }
    setError("")
    setLoading(true)
    try {
      await onLogin(username.trim(), password.trim())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Incorrect username or password."
      setError(msg === "Invalid credentials" ? "Incorrect username or password." : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" hidden />

      <View style={styles.inner}>

        {/* Logo */}
        <Text style={styles.brand}>HOST</Text>
        <View style={styles.taglineRow}>
          <Text style={styles.taglineNormal}>THE SMARTER </Text>
          <Text style={styles.taglineItalic}>WAITLIST</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={t => { setUsername(t); setError("") }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder="Username"
            placeholderTextColor="rgba(255,255,255,0.30)"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
            editable={!loading}
          />

          <TextInput
            ref={passRef}
            style={[styles.input, { marginTop: 14 }]}
            value={password}
            onChangeText={t => { setPassword(t); setError("") }}
            secureTextEntry
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.30)"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!loading}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonBusy]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.buttonLabel}>LOG IN</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => Linking.openURL("mailto:demo@hostplatform.net")}
            activeOpacity={0.6}
          >
            <Text style={styles.helpText}>Need help? Contact us</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  inner: {
    width: 400,
    maxWidth: "90%",
    alignItems: "center",
  },

  brand: {
    fontFamily: "ArialBlack",
    fontSize: 82,
    color: "#fff",
    letterSpacing: 10,
  },

  taglineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
    marginBottom: 48,
  },
  taglineNormal: {
    fontSize: 17,
    fontWeight: "400",
    color: "#fff",
    letterSpacing: 3,
  },
  taglineItalic: {
    fontSize: 17,
    fontWeight: "700",
    fontStyle: "italic",
    color: "#fff",
    letterSpacing: 1,
  },

  form: {
    width: "100%",
  },

  input: {
    width: "100%",
    height: 52,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "rgba(34,197,94,0.07)",
  },

  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: "#F87171",
    textAlign: "center",
  },

  button: {
    marginTop: 22,
    width: "100%",
    height: 54,
    backgroundColor: GREEN,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonBusy: { opacity: 0.65 },

  buttonLabel: {
    color: "#000",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2.5,
  },

  helpBtn: {
    marginTop: 28,
    alignSelf: "center",
    padding: 8,
  },
  helpText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.32)",
    letterSpacing: 0.4,
  },
})
