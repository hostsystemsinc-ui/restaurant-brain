"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DemoRoot() {
  const router = useRouter()
  useEffect(() => {
    fetch("/api/client/auth")
      .then(r => r.ok ? router.replace("/demo/station") : router.replace("/login/client"))
      .catch(() => router.replace("/login/client"))
  }, [router])
  return null
}
