#!/usr/bin/env python3
"""
Generates all Android mipmap launcher icons as PNG files.
Deletes any existing .webp counterparts so Android picks up the PNG.

Run: python3 generate-icon.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(BASE, "assets", "fonts", "ArialBlack.ttf")
RES  = os.path.join(BASE, "android", "app", "src", "main", "res")

# (density-folder, launcher-px, adaptive-foreground-px)
SIZES = [
    ("mipmap-mdpi",     48,  108),
    ("mipmap-hdpi",     72,  162),
    ("mipmap-xhdpi",    96,  216),
    ("mipmap-xxhdpi",  144,  324),
    ("mipmap-xxxhdpi", 192,  432),
]

def fit_font(target_px):
    lo, hi = 1, 800
    for _ in range(30):
        mid  = (lo + hi) // 2
        font = ImageFont.truetype(FONT, mid)
        bbox = font.getbbox("HOST")
        if (bbox[2] - bbox[0]) < target_px:
            lo = mid
        else:
            hi = mid
    return ImageFont.truetype(FONT, lo)

def draw_host(img, font, fill=(255, 255, 255)):
    draw = ImageDraw.Draw(img)
    bbox = font.getbbox("HOST")
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (img.width  - w) // 2 - bbox[0]
    y = (img.height - h) // 2 - bbox[1]
    draw.text((x, y), "HOST", fill=fill, font=font)

# Solid black launcher icon — no alpha channel so Android renders it correctly
def make_launcher(size):
    target = int(size * 0.58)
    font   = fit_font(target)
    img    = Image.new("RGB", (size, size), (0, 0, 0))
    draw_host(img, font)
    return img

# Adaptive foreground — MUST be RGBA with transparent background
# Text at 48% of safe zone guarantees it fits any circular/square mask
def make_foreground(size):
    safe   = int(size * 72 / 108)   # Android safe zone = 72/108 of foreground
    target = int(safe * 0.78)
    font   = fit_font(target)
    img    = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_host(img, font, fill=(255, 255, 255, 255))
    return img

# Main 1024-px asset
def make_main():
    font = fit_font(490)
    img  = Image.new("RGB", (1024, 1024), (0, 0, 0))
    draw_host(img, font)
    return img

# Write main asset
make_main().save(os.path.join(BASE, "assets", "icon.png"))
print("✅  assets/icon.png  (1024×1024)")

for folder, launcher_px, fg_px in SIZES:
    d = os.path.join(RES, folder)
    os.makedirs(d, exist_ok=True)

    # Remove old .webp files so Android doesn't pick them up instead of the PNG
    for name in ("ic_launcher", "ic_launcher_round", "ic_launcher_foreground"):
        webp = os.path.join(d, f"{name}.webp")
        if os.path.exists(webp):
            os.remove(webp)

    launcher = make_launcher(launcher_px)
    launcher.save(os.path.join(d, "ic_launcher.png"),       "PNG")
    launcher.save(os.path.join(d, "ic_launcher_round.png"), "PNG")

    fg = make_foreground(fg_px)
    fg.save(os.path.join(d, "ic_launcher_foreground.png"),  "PNG")

    safe = int(fg_px * 72 / 108)
    print(f"✅  {folder}: launcher={launcher_px}px  foreground={fg_px}px  safe-zone={safe}px")

print("\nAll icons written. Run: npx expo run:android")
