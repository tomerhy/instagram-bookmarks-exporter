#!/usr/bin/env python3
"""
Generate the extension's toolbar/store icons from the developer's portrait.

Design history, because this file has been rewritten three times and the
reasons matter:

  <=4.4.0  The portrait sat on an Instagram-like pink/magenta/purple gradient.
           The gradient was the trade-dress problem — not the portrait.
  4.4.1/2  Replaced entirely with a generic teal archive-tray glyph. The
           developer did not approve this: the portrait is an established part
           of his personal brand, and a photo of an identifiable independent
           developer is one of the clearest possible signals that this is NOT
           an official Instagram/Meta product.
  4.4.3    Portrait restored, gradient permanently gone. The face was
           composited into a CIRCLE on a flat slate plate, using a tight
           136x136 crop centred on the face.
  current  The circle is gone and so is the tight crop. The developer asked for
           an aspect-fit portrait that does not cut his face. A circular mask
           inscribed in a square necessarily clips the corners, and because the
           head sits above and left of centre it clipped hair and shoulder. So:
           the portrait is now ASPECT-FIT (contain) into a rounded square, with
           a rounded-rectangle teal border in place of the ring.

What this deliberately does NOT do:
  - crop, clip or mask any part of the face, head, hair or glasses
  - invent, redraw, cartoonise or retouch the face (the photograph is
    composited unmodified, only cropped to trim empty background, and scaled)
  - use any Instagram/Meta asset: no camera glyph, no album glyph, no
    wordmark, no notification badge, no verification tick
  - use pink, magenta, purple, orange or yellow anywhere in the plate or border

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
library releases. An independent run on a different Pillow produced an
`icon-128.png` with a different SHA-256 from the committed file while the
decoded pixels were bit-for-bit identical.

So: compare **decoded pixels**, never encoded file bytes. The right comparison
is dimensions + mode after `convert("RGBA")` + a hash of
`image.convert("RGBA").tobytes()`. Requiring byte-identical PNG encoding across
unspecified Pillow/zlib versions is not a valid requirement and would fail for
reasons that have nothing to do with the artwork.
"""

import argparse
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "icons")
PORTRAIT = os.path.join(OUT_DIR, "portrait-source.png")

SIZES = [16, 32, 48, 128]
MASTER = 256
SS = 8  # supersample factor for the plate/border geometry

# Neutral palette, shared with tokens.css. No warm hues at all.
SLATE = (19, 26, 34, 255)      # #131A22 plate
TEAL = (15, 139, 141, 255)     # #0F8B8D border  (tokens.css --accent)

# LIMITATION, reported rather than papered over: the best developer-owned
# portrait in the repository is 280x280. The four manifest sizes (16/32/48/128)
# are all produced by DOWNSCALING, which is lossless in the sense that matters.
# The 256px master is a mild upscale and exists only as a design reference — it
# is a build input and never ships. If a higher-resolution original becomes
# available, drop it in as portrait-source.png and rerun; no other change is
# needed.
#
# FRAMING. This trims empty background ONLY — the wall column on the left and
# the lower chest. The whole head is inside the box with margin on every side:
# hair, glasses, beard and shoulders are all fully contained, and no part of the
# face is cut. Measured against the 280x280 source, where the head spans roughly
# x 95..215 and y 22..175.
#
# Why not the full 280x280 frame: aspect-fitting the entire photo leaves the
# face at about a third of the icon height, which at 16x16 in the toolbar is an
# unreadable smudge. Trimming dead background roughly doubles the face without
# touching it. This was the developer's choice between the two, made against
# rendered previews at actual size.
CROP = (55, 5, 265, 215)  # left, top, right, bottom — 210x210

# Border inset. Small, because every pixel spent on the plate is a pixel not
# spent on the face, and at 16x16 that trade decides whether the icon reads.
PAD_UNITS = 4.0
PLATE_RADIUS_UNITS = 24.0   # deliberately squarer than Instagram's squircle
BORDER_UNITS = 2.5


def aspect_fit(img, box_w, box_h):
    """Contain: the whole image stays visible, aspect ratio preserved.

    Nothing is cropped here — any cropping this generator does happens once,
    via CROP, before this point.
    """
    sw, sh = img.size
    scale = min(box_w / sw, box_h / sh)
    return img.resize((max(1, round(sw * scale)), max(1, round(sh * scale))),
                      Image.LANCZOS)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def load_portrait():
    """The photograph, trimmed of empty background. Never otherwise altered —
    no brightness, contrast or colour adjustment is applied anywhere here."""
    return Image.open(PORTRAIT).convert("RGB").crop(CROP)


def draw_icon(size):
    n = size * SS
    u = n / 128.0  # design grid is 128 units

    plate_radius = int(PLATE_RADIUS_UNITS * u)
    pad = PAD_UNITS * u
    border_w = int(round(max(1.5, BORDER_UNITS * u)))

    # Flat slate plate. No gradient of any kind.
    body = Image.new("RGBA", (n, n), SLATE)

    box = int(round(n - 2 * pad))
    photo = aspect_fit(load_portrait(), box, box)
    photo_radius = max(1, int(plate_radius - pad * 0.6))
    px = int(round((n - photo.width) / 2))
    py = int(round((n - photo.height) / 2))
    body.paste(photo, (px, py), rounded_mask(photo.size, photo_radius))

    ImageDraw.Draw(body).rounded_rectangle(
        (px, py, px + photo.width - 1, py + photo.height - 1),
        radius=photo_radius, outline=TEAL, width=border_w)

    # Clip the plate to a rounded square.
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.paste(body, (0, 0), rounded_mask((n, n), plate_radius))

    return out.resize((size, size), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(
        description="Generate the extension icons from the developer's portrait.")
    parser.add_argument(
        "--output-dir", default=None, metavar="DIR",
        help="write the icons here instead of assets/icons/. Used by the test "
             "suite so it can compare freshly generated pixels WITHOUT "
             "overwriting the committed icon files.")
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
    print("Framing: aspect-fit, empty background trimmed via CROP. No part of "
          "the face is cut.")
    print("Build inputs (never shipped): portrait-source.png, icon-source.png")
    if args.output_dir:
        print("NOTE: --output-dir given; assets/icons/ was NOT touched.")


if __name__ == "__main__":
    main()
