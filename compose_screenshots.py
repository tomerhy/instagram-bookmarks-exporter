#!/usr/bin/env python3
"""
Compose Chrome Web Store screenshots (1280x800) by framing real captures of
the running extension on the brand-aurora background.

Workflow:
  1. Capture the popup and gallery from Chrome (instructions in README).
  2. Drop the raw PNGs into assets/screenshots/raw/:
       - popup.png    (the toolbar popup — any reasonable size)
       - gallery.png  (the gallery tab — any reasonable size)
  3. Run:  python3 compose_screenshots.py
  4. Composed frames land in assets/screenshots/screenshot-*-*.png

Each frame is 1280x800, dark aurora background, hero headline + tagline
above, the real capture centered below with a soft drop-shadow.

This script is the v4.3.9+ replacement for create_screenshots.py (which
drew flat mockups via PIL and is now archived).
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
import sys

# ---------------------------------------------------------------------------
# Constants — Chrome Web Store screenshot spec
# ---------------------------------------------------------------------------
WIDTH = 1280
HEIGHT = 800

# Brand palette (matches gallery.html / popup.html :root tokens)
BG_BASE        = (10, 10, 20)       # --ig-bg
AURORA_PINK    = (225, 48, 108)     # --ig-pink
AURORA_VIOLET  = (88, 81, 219)      # --ig-violet
TEXT_PRIMARY   = (246, 247, 251)    # --text-primary
TEXT_MUTED     = (168, 168, 184)    # --text-muted

# Headlines & taglines per frame. shadow_radius is tuned per-aspect: the
# popup is portrait and small in the canvas so a bigger shadow gives it
# presence; the landscape gallery wants a tight shadow so the content
# itself can take more of the canvas width.
FRAMES = [
    {
        "raw":     "popup.png",
        "out":     "screenshot-1-popup.png",
        "title":   "Export Instagram Saved Posts",
        "tagline": "Capture images, videos, and carousels with one click.",
        "max_capture_w": 480,
        "max_capture_h": 580,
        "shadow_radius": 36,
    },
    {
        "raw":     "gallery.png",
        "out":     "screenshot-2-gallery.png",
        "title":   "Beautiful Gallery",
        "tagline": "Search by @owner, #tag, or caption. Preview every slide.",
        "max_capture_w": 1140,
        "max_capture_h": 620,
        "shadow_radius": 22,
    },
    {
        "raw":     "videos.png",
        "out":     "screenshot-3-videos.png",
        "title":   "Videos & Reels",
        "tagline": "Inline playback with owner, caption, and date for every clip.",
        "max_capture_w": 1140,
        "max_capture_h": 620,
        "shadow_radius": 22,
    },
]


# ---------------------------------------------------------------------------
# Background — dark base with two large blurred radial blobs (the same
# atmosphere we ship in gallery.html / popup.html).
# ---------------------------------------------------------------------------
def make_aurora_bg(w, h):
    img = Image.new("RGB", (w, h), BG_BASE)

    def blob(center, radius, color, opacity):
        """Paint a radial gradient circle onto img at low opacity."""
        cx, cy = center
        # Render into a generously oversized buffer, then blur and composite
        size = radius * 3
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        # Concentric circles fading out
        steps = 30
        for i in range(steps, 0, -1):
            r = int(radius * i / steps)
            alpha = int(opacity * (1 - (i / steps) ** 2) * 255)
            ld.ellipse(
                (size // 2 - r, size // 2 - r, size // 2 + r, size // 2 + r),
                fill=color + (alpha,),
            )
        layer = layer.filter(ImageFilter.GaussianBlur(radius=80))
        img.paste(layer, (cx - size // 2, cy - size // 2), layer)

    # Top-left pink blob
    blob((-50, -50), 380, AURORA_PINK, 0.30)
    # Bottom-right violet blob
    blob((w + 50, h + 50), 420, AURORA_VIOLET, 0.28)
    # Mid-right pink tint (subtle, like the popup's secondary blob)
    blob((w - 150, h // 2 + 60), 220, AURORA_PINK, 0.10)
    return img


# ---------------------------------------------------------------------------
# Fonts — fall back gracefully across macOS / Linux / generic systems
# ---------------------------------------------------------------------------
def get_font(size, weight="regular"):
    candidates_bold = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    paths = candidates_bold if weight == "bold" else candidates
    for p in paths:
        if os.path.exists(p):
            try:
                # Helvetica.ttc supports faces; index 1 ≈ Bold on macOS.
                if weight == "bold" and p.endswith(".ttc"):
                    return ImageFont.truetype(p, size, index=1)
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_centered_text(draw, text, y, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((WIDTH - w) // 2, y), text, fill=fill, font=font)


# ---------------------------------------------------------------------------
# Drop shadow under the screenshot
# ---------------------------------------------------------------------------
def add_drop_shadow(img, radius=40, offset=(0, 20), opacity=0.55):
    """Return a new image with `img` and a soft drop shadow underneath."""
    w, h = img.size
    pad = radius * 2
    shadow = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow_solid = Image.new("RGBA", (w, h), (0, 0, 0, int(255 * opacity)))
    shadow.paste(shadow_solid, (pad + offset[0], pad + offset[1]))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=radius))
    composite = shadow
    composite.alpha_composite(img.convert("RGBA"), (pad, pad))
    return composite


# ---------------------------------------------------------------------------
# Round corners on the screenshot so it looks like a window, not a flat rect
# ---------------------------------------------------------------------------
def round_corners(img, radius=16):
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, *img.size), radius=radius, fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def fit_within(img, max_w, max_h):
    """Scale `img` proportionally so it fits inside max_w x max_h."""
    w, h = img.size
    scale = min(max_w / w, max_h / h, 1.0)  # never upscale
    if scale < 1.0:
        return img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


# ---------------------------------------------------------------------------
# Compose one frame
# ---------------------------------------------------------------------------
def compose_frame(raw_path, title, tagline, max_w, max_h, shadow_radius):
    if not os.path.exists(raw_path):
        return None

    capture = Image.open(raw_path).convert("RGBA")
    # Scale capture proportionally to fit the configured box.
    capture = fit_within(capture, max_w, max_h)
    capture = round_corners(capture, radius=18)
    capture = add_drop_shadow(capture, radius=shadow_radius,
                              offset=(0, shadow_radius // 2), opacity=0.50)

    bg = make_aurora_bg(WIDTH, HEIGHT).convert("RGBA")
    draw = ImageDraw.Draw(bg)

    title_font   = get_font(50, "bold")
    tagline_font = get_font(22, "regular")
    foot_font    = get_font(15, "regular")

    # Headline area: tighter than before so landscape captures get more room
    draw_centered_text(draw, title,   46,  title_font,   TEXT_PRIMARY)
    draw_centered_text(draw, tagline, 110, tagline_font, TEXT_MUTED)

    foot_y = HEIGHT - 38
    foot_text = "v" + read_manifest_version() + "  •  Free  •  Private"
    draw_centered_text(draw, foot_text, foot_y, foot_font, TEXT_MUTED)

    # Capture area: between headline (ends ~y=150) and footer (~y=HEIGHT-38).
    cap_w, cap_h = capture.size
    cap_x = (WIDTH - cap_w) // 2
    area_top = 150
    area_bot = foot_y - 8
    cap_y = area_top + (area_bot - area_top - cap_h) // 2
    bg.alpha_composite(capture, (cap_x, cap_y))

    return bg.convert("RGB")


# ---------------------------------------------------------------------------
# Pull the version from manifest.json so taglines stay in sync automatically
# ---------------------------------------------------------------------------
def read_manifest_version():
    try:
        import json
        with open(os.path.join(os.path.dirname(__file__) or ".", "manifest.json")) as f:
            return json.load(f).get("version", "?")
    except Exception:
        return "?"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    raw_dir = os.path.join(here, "assets", "screenshots", "raw")
    out_dir = os.path.join(here, "assets", "screenshots")
    os.makedirs(out_dir, exist_ok=True)

    missing = []
    for spec in FRAMES:
        raw_path = os.path.join(raw_dir, spec["raw"])
        if not os.path.exists(raw_path):
            missing.append(spec["raw"])

    if missing:
        print("Missing raw captures in assets/screenshots/raw/:")
        for m in missing:
            print("  -", m)
        print()
        print("Capture them from Chrome (see the README in that folder),")
        print("save with those exact filenames, then rerun this script.")
        sys.exit(1)

    for spec in FRAMES:
        raw_path = os.path.join(raw_dir, spec["raw"])
        out_path = os.path.join(out_dir, spec["out"])
        print(f"Composing {spec['out']} from {spec['raw']}...")
        img = compose_frame(
            raw_path, spec["title"], spec["tagline"],
            spec.get("max_capture_w", WIDTH - 160),
            spec.get("max_capture_h", 600),
            spec.get("shadow_radius", 30),
        )
        img.save(out_path, "PNG", optimize=True)
        print(f"  → {out_path}  ({img.size[0]}x{img.size[1]})")

    print("\nDone. Chrome Web Store requires 1280x800 or 640x400 screenshots.")


if __name__ == "__main__":
    main()
