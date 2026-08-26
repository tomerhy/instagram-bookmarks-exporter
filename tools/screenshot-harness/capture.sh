#!/usr/bin/env bash
# Capture the Chrome Web Store screenshots from the harness, headless.
#
#   python3 tools/screenshot-harness/serve.py &     # must be running
#   ./tools/screenshot-harness/capture.sh
#
# Writes 1280x800 PNGs to assets/store-screenshots/. Uses the locally installed
# Chrome so what is captured is what Chrome renders, not an approximation.
set -euo pipefail

PORT="${PORT:-8777}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="assets/store-screenshots"
PROFILE="$(mktemp -d)"

[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 1; }
curl -sf "http://127.0.0.1:$PORT/gallery.html" >/dev/null \
  || { echo "harness not serving on port $PORT — start serve.py first" >&2; exit 1; }

mkdir -p "$OUT"

# popup.js polls stats every 2s. A repeating timer means Chrome's
# --virtual-time-budget never drains and the process never exits, even though
# the PNG has already been written. So: give it a wall-clock bound and judge
# success by whether the file appeared, not by the exit status.
shot() {           # shot <out-name> <url-path> [width] [height]
  local name="$1" path="$2" w="${3:-1280}" h="${4:-800}"
  rm -f "$OUT/$name"
  timeout 30 "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --no-first-run --no-default-browser-check --disable-extensions \
    --force-device-scale-factor=1 --user-data-dir="$PROFILE/$name" \
    --virtual-time-budget=6000 \
    --window-size="${w},${h}" \
    --screenshot="$OUT/$name" \
    "http://127.0.0.1:$PORT$path" >/dev/null 2>&1 || true
  if [ -s "$OUT/$name" ]; then
    echo "  $OUT/$name  (${w}x${h})"
  else
    echo "  FAILED: $OUT/$name" >&2
    return 1
  fi
}

echo "capturing to $OUT/"
# The popup is 320px wide (popup.html sets width: 320px) and ~400px tall.
# Capture it at exactly that so the page is not left-aligned inside a bigger
# window with dead space beside and below it, then centre each frame on a
# 1280x800 ground — which is also what the Chrome Web Store requires of a
# listing screenshot. Heights measured from the rendered page: idle content ends
# at 385px, the consent overlay at 401px.
# Heights differ per state, and they are measured rather than guessed.
#   idle       content ends at 385px, so 410 leaves a small even margin.
#   disclosure the consent card needs ~401px. .about-overlay is
#              `position:absolute; inset:0` with `align-items:center`, so a card
#              taller than its flex container overflows in BOTH directions and
#              the top is what gets clipped — which is exactly what a 410px
#              canvas did to the "Before you start" heading. 440 still clips it;
#              455 is the smallest height that fits the whole card.
POPUP_W=320
shot "raw-01-popup-idle.png"           "/popup.html"                          "$POPUP_W" 410
shot "raw-02-first-run-disclosure.png" "/popup.html?consent=0&act=disclosure" "$POPUP_W" 455
for n in 01-popup-idle 02-first-run-disclosure; do
  python3 tools/screenshot-harness/frame-popup.py "$OUT/raw-$n.png" "$OUT/$n.png" \
    | sed 's/^/  /'
  rm -f "$OUT/raw-$n.png"
done
shot "03-library.png"             "/gallery.html"
shot "04-search.png"              "/gallery.html?act=search"
shot "05-album-expanded.png"      "/gallery.html?act=album"
shot "06-videos-and-export.png"   "/gallery.html?act=videos"

rm -rf "$PROFILE"
echo
echo "All six frames are 1280x800, the Chrome Web Store listing size."
