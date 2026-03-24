import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            fontFamily: "sans-serif",
          }}
        >
          H
        </span>
      </div>
    ),
    { ...size }
  )
}
