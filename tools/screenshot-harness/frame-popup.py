#!/usr/bin/env python3
"""Centre a tight popup capture on a Chrome Web Store sized canvas.

The toolbar popup is 320px wide (popup.html sets `width: 320px`) and about
400px tall. Capturing it in a larger browser window leaves the page
left-aligned with dead space to the right and below, which is what the first
attempt at these screenshots did. Chrome Web Store listing images also have to
be 1280x800 or 640x400, so a 320x410 PNG is not a usable listing asset either.

So: capture the popup tight, then centre it here on a 1280x800 ground.

The ground is the product's own neutral palette — slate with a faint teal
wash. No pink, magenta, purple, orange or yellow, no gradient resembling
Instagram's, no headline text. The predecessor of this script framed captures on
AURORA_PINK/AURORA_VIOLET (Instagram's own brand stops) under the headline
"Export Instagram Saved Posts"; it was deleted for that reason and nothing here
reproduces it.

Usage: python3 tools/screenshot-harness/frame-popup.py IN.png OUT.png
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H = 1280, 800
SLATE_TOP = (16, 22, 29)
SLATE_BOTTOM = (11, 15, 20)
TEAL = (15, 139, 141)


def ground():
    """Vertical slate gradient with one soft teal glow behind the device."""
    grad = Image.new("RGB", (1, H))
    gp = grad.load()
    for y in range(H):
        t = y / (H - 1)
        gp[0, y] = tuple(int(SLATE_TOP[i] + (SLATE_BOTTOM[i] - SLATE_TOP[i]) * t)
                         for i in range(3))
    bg = grad.resize((W, H))

    glow = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        (W // 2 - 330, H // 2 - 260, W // 2 + 330, H // 2 + 260),
        fill=(TEAL[0] // 5, TEAL[1] // 5, TEAL[2] // 5))
    glow = glow.filter(ImageFilter.GaussianBlur(120))

    return ImageChops.add(bg, glow)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.size[0] - 1, img.size[1] - 1), radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def main():
    src = Image.open(sys.argv[1]).convert("RGB")
    scale = min(2.0, (H * 0.80) / src.height)          # readable, never blurry
    dev = src.resize((round(src.width * scale), round(src.height * scale)),
                     Image.LANCZOS)
    dev = rounded(dev, 18)

    canvas = ground().convert("RGBA")
    x = (W - dev.width) // 2
    y = (H - dev.height) // 2

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x + 6, y + 14, x + dev.width + 6, y + dev.height + 14),
        radius=18, fill=(0, 0, 0, 150))
    canvas = Image.alpha_composite(canvas,
                                   shadow.filter(ImageFilter.GaussianBlur(26)))

    ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        (x - 1, y - 1, x + dev.width, y + dev.height),
        radius=19, outline=TEAL + (110,), width=2)
    canvas = Image.alpha_composite(canvas, ring)
    canvas.paste(dev, (x, y), dev)

    canvas.convert("RGB").save(sys.argv[2], "PNG", optimize=True)
    print("wrote %s  %dx%d  (device %dx%d centred)"
          % (sys.argv[2], W, H, dev.width, dev.height))


if __name__ == "__main__":
    main()
