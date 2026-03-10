"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DemoRoot() {
  const router = useRouter()
  useEffect(() => {
    if (typeof window !== "undefined") {
      const authed = sessionStorage.getItem("host_demo_authed")
      if (!authed) {
        router.replace("/login")
      } else {
        router.replace("/demo/station")
      }
    }
  }, [router])
  return null
}
