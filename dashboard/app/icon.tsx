import { ImageResponse } from "next/og"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: "0.12em",
            lineHeight: 1,
            fontFamily: "Arial Black, sans-serif",
          }}
        >
          HOST
        </span>
      </div>
    ),
    { ...size }
  )
}
