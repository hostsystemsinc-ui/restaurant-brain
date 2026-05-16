// Generates assets/icon.png — run with: node generate-icon.js
// Requires: npm install @resvg/resvg-js --save-dev

const { Resvg } = require("@resvg/resvg-js")
const fs   = require("fs")
const path = require("path")

const SIZE     = 1024
const FONT_PATH = path.join(__dirname, "assets", "fonts", "ArialBlack.ttf")

// textLength="520" locks the rendered width to exactly 520 px — guaranteed to
// fit inside any circular launcher crop (safe zone ≈ 683 px at 1024 px icon).
const svg = `<svg xmlns="http://www.w3.org/2000/svg"
  width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#000000"/>
  <text
    x="${SIZE / 2}"
    y="${SIZE / 2}"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="Arial Black"
    font-weight="900"
    font-size="130"
    textLength="520"
    lengthAdjust="spacingAndGlyphs"
    fill="#ffffff"
  >HOST</text>
</svg>`

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: SIZE },
  font:  {
    fontFiles:           [FONT_PATH],
    loadSystemFonts:     false,
    defaultFontFamily:   "Arial Black",
  },
})
const png = resvg.render().asPng()
const out = path.join(__dirname, "assets", "icon.png")
fs.writeFileSync(out, png)
console.log(`✅  Icon written → ${out}  (${SIZE}×${SIZE} px)`)
