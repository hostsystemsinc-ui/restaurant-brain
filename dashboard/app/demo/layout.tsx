import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "HOST Station",
  description: "HOST restaurant waitlist station",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HOST Station" },
  icons: {
    apple: "/icon-192.png",
    icon:  "/icon-32.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0C0907",
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
