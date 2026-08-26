#!/usr/bin/env python3
"""Generate abstract placeholder tiles for the screenshot harness.

Solid grounds with simple geometric overlays in the product's neutral palette.
No people, no faces, no photographs, nothing sourced from anywhere. Deliberately
abstract so a viewer cannot mistake a tile for a real saved post.
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")

# Neutral palette only — no pink, magenta, purple, orange or yellow anywhere.
GROUNDS = [
    (16, 32, 40), (22, 42, 46), (14, 26, 36), (26, 46, 50),
    (18, 36, 44), (12, 24, 30), (24, 40, 44), (20, 34, 38),
    (15, 30, 34), (28, 48, 52), (17, 28, 38), (23, 44, 48),
]
ACCENTS = [(15, 139, 141), (37, 168, 160), (94, 190, 178), (58, 122, 130)]


def tile(i, w, h):
    img = Image.new("RGB", (w, h), GROUNDS[i % len(GROUNDS)])
    d = ImageDraw.Draw(img, "RGBA")
    acc = ACCENTS[i % len(ACCENTS)]
    kind = i % 4
    if kind == 0:                                    # concentric rings
        for r in range(int(min(w, h) * 0.45), 0, -max(8, min(w, h) // 14)):
            d.ellipse((w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r),
                      outline=acc + (150,), width=max(2, min(w, h) // 90))
    elif kind == 1:                                  # diagonal bands
        step = max(24, w // 9)
        for x in range(-h, w + h, step):
            d.polygon([(x, 0), (x + step // 2, 0),
                       (x + step // 2 - h, h), (x - h, h)], fill=acc + (60,))
    elif kind == 2:                                  # dot grid
        step = max(28, w // 10)
        for y in range(step // 2, h, step):
            for x in range(step // 2, w, step):
                r = max(3, int(step * 0.16 * (0.5 + 0.5 * math.sin(x * y))))
                d.ellipse((x - r, y - r, x + r, y + r), fill=acc + (170,))
    else:                                            # offset squares
        step = max(40, w // 6)
        for n, y in enumerate(range(0, h, step)):
            for x in range(-step + (n % 2) * step // 2, w + step, step * 2):
                d.rounded_rectangle((x, y, x + step, y + step),
                                    radius=step // 6, fill=acc + (70,))
    d.rectangle((0, 0, w - 1, h - 1), outline=(255, 255, 255, 26), width=2)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for i in range(12):
        p = os.path.join(OUT, "tile-%02d.jpg" % i)
        tile(i, 720, 720).save(p, "JPEG", quality=88)
        print("wrote", os.path.relpath(p, os.getcwd()))
    for i in range(3):
        p = os.path.join(OUT, "wide-%02d.jpg" % i)
        tile(i + 5, 900, 600).save(p, "JPEG", quality=88)
        print("wrote", os.path.relpath(p, os.getcwd()))


if __name__ == "__main__":
    main()
