#!/usr/bin/env python3
"""
Generate the extension's toolbar/store icons.

Design brief (4.4.1): the previous icons were a photo of the developer on a
pink-magenta gradient, and the committed generator drew a rounded-square
gradient with a camera lens and flash dot — i.e. Instagram's own mark. Both are
gone. This draws an archive tray with a download arrow, in a flat teal-on-slate
palette. No camera, no lens, no warm gradient, no wordmark.

Rendered at 8x and downsampled with LANCZOS so the 16px favicon stays legible.

Usage:  python3 tools/make-icons.py
Writes: assets/icons/icon-{16,32,48,128}.png + icon-source.png (512)
Requires: Pillow
"""

import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "assets", "icons")
SIZES = [16, 32, 48, 128]
SOURCE_SIZE = 512
SS = 8  # supersample factor

SLATE = (19, 26, 34, 255)      # #131A22 plate
TEAL = (15, 139, 141, 255)     # #0F8B8D accent  (tokens.css --accent)
TEAL_HI = (79, 209, 197, 255)  # #4FD1C5         (tokens.css --accent-text)
INK = (233, 240, 245, 255)     # near-white tray


def draw_icon(size):
    """Draw at size*SS on a flat canvas, then clip to the rounded plate and
    downsample. Clipping through a mask (rather than re-drawing corners) is
    what keeps the bottom corners round once the teal shelf is painted."""
    n = size * SS
    u = n / 128.0  # design grid is 128 units

    body = Image.new("RGBA", (n, n), SLATE)
    d = ImageDraw.Draw(body)

    # Teal shelf across the bottom — reads as a tray the arrow drops into.
    d.rectangle((0, 99 * u, n, n), fill=TEAL)

    # Download arrow: shaft + solid head.
    cx = 64 * u
    shaft_w = 15 * u
    d.rectangle((cx - shaft_w / 2, 24 * u, cx + shaft_w / 2, 58 * u), fill=INK)
    d.polygon([(cx - 29 * u, 54 * u), (cx + 29 * u, 54 * u), (cx, 86 * u)], fill=TEAL_HI)

    # Clip to a rounded square. Corner radius 24/128 is deliberately squarer
    # than the squircle used by the icon this replaces.
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, n - 1, n - 1),
                                          radius=int(24 * u), fill=255)
    plate = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    plate.paste(body, (0, 0), mask)

    return plate.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        draw_icon(size).save(path, "PNG", optimize=True)
        written.append(path)
    src = os.path.join(OUT_DIR, "icon-source.png")
    draw_icon(SOURCE_SIZE).save(src, "PNG", optimize=True)
    written.append(src)
    for p in written:
        print("wrote", os.path.relpath(p, os.path.dirname(OUT_DIR)))


if __name__ == "__main__":
    main()
