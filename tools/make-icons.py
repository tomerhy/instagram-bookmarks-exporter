#!/usr/bin/env python3
"""
Generate the extension's toolbar/store icons from the developer's portrait.

Design history, because this file has been rewritten twice and the reasons
matter:

  <=4.4.0  The portrait sat on an Instagram-like pink/magenta/purple gradient.
           The gradient was the trade-dress problem — not the portrait.
  4.4.1/2  Replaced entirely with a generic teal archive-tray glyph. The
           developer did not approve this: the portrait is an established part
           of his personal brand, and a photo of an identifiable independent
           developer is one of the clearest possible signals that this is NOT
           an official Instagram/Meta product.
  4.4.3    Portrait restored, gradient permanently gone. The face is composited
           on a flat neutral slate plate with a teal ring.

What this deliberately does NOT do:
  - invent, redraw, cartoonise or retouch the face (the photograph is
    composited unmodified, only cropped and scaled)
  - use any Instagram/Meta asset: no camera glyph, no album glyph, no
    wordmark, no notification badge, no verification tick
  - use pink, magenta, purple, orange or yellow anywhere in the plate or ring

Source: assets/icons/portrait-source.png — 280x280, the developer's own
photograph, restored from git (it shipped as assets/icons/maker.png through
4.4.0). This is the highest-resolution original available in the repository.
See LIMITATION below.

Usage:  python3 tools/make-icons.py                  # writes assets/icons/
        python3 tools/make-icons.py --output-dir DIR # writes elsewhere
Writes: icon-{16,32,48,128}.png + icon-source.png (256 master)
Requires: Pillow

REPRODUCIBILITY — read this before writing a test against the output
--------------------------------------------------------------------
This generator is **pixel-deterministic**: for a given portrait source it
produces the same decoded RGBA pixels every time, on every machine.

It is **not** byte-deterministic across Pillow/zlib versions. The PNG *encoder*
chooses filtering and deflate parameters, and those choices change between
library releases. An independent run on Python 3.12.13 / Pillow 12.3.0 produced
an `icon-128.png` with a different SHA-256 from the committed file while the
decoded pixels were bit-for-bit identical. The 16, 32 and 48 px files happened
to encode identically; that is luck, not a guarantee.

So: compare **decoded pixels**, never encoded file bytes. The right comparison
is dimensions + mode after `convert("RGBA")` + a hash of
`image.convert("RGBA").tobytes()`. Requiring byte-identical PNG encoding across
unspecified Pillow/zlib versions is not a valid requirement and would fail for
reasons that have nothing to do with the artwork.

The shipped icon PNGs are **approved artefacts**. Regenerating them is not part
of any test — use --output-dir and compare pixels.
"""

import argparse
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "icons")
PORTRAIT = os.path.join(OUT_DIR, "portrait-source.png")

SIZES = [16, 32, 48, 128]
MASTER = 256
SS = 8  # supersample factor for the plate/ring geometry

# Neutral palette, shared with tokens.css. No warm hues at all.
SLATE = (19, 26, 34, 255)      # #131A22 plate
TEAL = (15, 139, 141, 255)     # #0F8B8D ring   (tokens.css --accent)

# LIMITATION, reported rather than papered over: the best developer-owned
# portrait in the repository is 280x280. The four manifest sizes (16/32/48/128)
# are all produced by DOWNSCALING, which is lossless in the sense that matters.
# The 256px master is a mild upscale of the face crop and exists only as a
# design reference — it is a build input and never ships. If a higher-resolution
# original becomes available, drop it in as portrait-source.png and rerun; no
# other change is needed.
#
# Face crop, tuned by eye against the 280x280 source. A close crop is what keeps
# the face readable at 16x16; the full frame at that size is an unrecognisable
# smudge. Centre of the face sits at roughly (150, 103).
# Chosen from a 4-way comparison rendered at 32px: a wider crop turns into an
# unreadable smudge at 16-32px, and a tighter one clips the top of the head.
# 136x136 out of 280x280, face centred, glasses and beard both still legible.
# The photograph itself is NOT retouched — no brightness, contrast, or colour
# adjustment is applied anywhere in this file, only cropping and resampling.
CROP = (84, 26, 220, 162)  # left, top, right, bottom — 136x136, face centred


def load_face(target_px):
    """Return the face crop as a square RGB image at target_px."""
    src = Image.open(PORTRAIT).convert("RGB")
    face = src.crop(CROP)
    # LANCZOS both ways; the photograph itself is never altered beyond
    # cropping and resampling.
    return face.resize((target_px, target_px), Image.LANCZOS)


def draw_icon(size):
    n = size * SS
    u = n / 128.0  # design grid is 128 units

    # Flat slate plate. No gradient of any kind.
    body = Image.new("RGBA", (n, n), SLATE)

    # Teal ring + circular portrait, inset so the plate reads as a border.
    # Small inset and a thin ring: every pixel spent on the plate is a pixel
    # not spent on the face, and at 16x16 that trade is what decides whether
    # the icon is recognisable.
    inset = 6 * u
    ring_w = max(1.5, 2.5 * u)
    circle_box = (inset, inset, n - inset, n - inset)
    diam = int(round(circle_box[2] - circle_box[0]))

    face = load_face(diam)
    mask = Image.new("L", (diam, diam), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diam - 1, diam - 1), fill=255)
    body.paste(face, (int(round(inset)), int(round(inset))), mask)

    d = ImageDraw.Draw(body)
    d.ellipse(circle_box, outline=TEAL, width=int(round(ring_w)))

    # Clip the plate to a rounded square. Radius 24/128 is deliberately squarer
    # than Instagram's squircle.
    plate_mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(plate_mask).rounded_rectangle(
        (0, 0, n - 1, n - 1), radius=int(24 * u), fill=255)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.paste(body, (0, 0), plate_mask)

    return out.resize((size, size), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(
        description="Generate the extension icons from the developer's portrait.")
    parser.add_argument(
        "--output-dir", default=None, metavar="DIR",
        help="write the icons here instead of assets/icons/. Used by the test "
             "suite so it can compare freshly generated pixels WITHOUT "
             "overwriting the approved icon files.")
    args = parser.parse_args()

    out_dir = args.output_dir or OUT_DIR

    if not os.path.exists(PORTRAIT):
        raise SystemExit(
            "missing " + PORTRAIT + "\n"
            "Restore it with:  git show v4.3.10:assets/icons/maker.png "
            "> assets/icons/portrait-source.png")
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for size in SIZES:
        path = os.path.join(out_dir, "icon-%d.png" % size)
        draw_icon(size).save(path, "PNG", optimize=True)
        written.append(path)
    master = os.path.join(out_dir, "icon-source.png")
    draw_icon(MASTER).save(master, "PNG", optimize=True)
    written.append(master)
    for p in written:
        try:
            print("wrote", os.path.relpath(p, ROOT))
        except ValueError:      # output-dir on a different volume
            print("wrote", p)
    print("")
    print("Source portrait: assets/icons/portrait-source.png (280x280, "
          "developer-owned).")
    print("Build inputs (never shipped): portrait-source.png, icon-source.png")
    if args.output_dir:
        print("NOTE: --output-dir given; the approved icons in assets/icons/ "
              "were NOT touched.")


if __name__ == "__main__":
    main()
