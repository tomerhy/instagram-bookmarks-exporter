#!/bin/bash
# Build script for Saved Posts Backup & Export
#
# Produces a Chrome Web Store upload zip containing ONLY the files the
# extension needs at runtime. manifest.json sits at the zip root.
#
# Rule of thumb when editing: if you add a file to manifest.json or to a
# <script>/<link> tag in popup.html or gallery.html, add it here too.
# tests/build.test.js asserts that every referenced file made it in.

set -e

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
DIST_DIR="dist"
ZIP_NAME="saved-posts-backup-export-${VERSION}.zip"

# Clean previous build
rm -rf "$DIST_DIR"
rm -f "$ZIP_NAME"
mkdir -p "$DIST_DIR"

# --- Runtime files -----------------------------------------------------------
# manifest + service worker
cp manifest.json "$DIST_DIR/"
cp background.js "$DIST_DIR/"

# content scripts. url-allowlist.js is loaded into BOTH worlds (and by the
# gallery page) — it is the single source of truth for which URLs are allowed.
cp url-allowlist.js "$DIST_DIR/"
cp capture-hook.js "$DIST_DIR/"
cp content.js "$DIST_DIR/"

# extension pages
cp popup.html "$DIST_DIR/"
cp popup.js "$DIST_DIR/"
cp gallery.html "$DIST_DIR/"
cp gallery.js "$DIST_DIR/"
cp tokens.css "$DIST_DIR/"
cp legacy-cleanup.js "$DIST_DIR/"
cp privacy-policy.html "$DIST_DIR/"

# Bundled third-party libraries — currently just JSZip for the album/library
# download features. MIT/GPLv3 dual-licensed; see lib/ for the notice.
cp -r lib "$DIST_DIR/"

# Runtime assets only: the four icon sizes the manifest actually references.
# Deliberately NOT a `cp -r assets/icons` — that also drags in icon-source.png
# (the 512px master used by tools/make-icons.py) and anything else parked
# there. assets/screenshots/ holds store marketing PNGs and never ships.
mkdir -p "$DIST_DIR/assets/icons"
for size in 16 32 48 128; do
  cp "assets/icons/icon-${size}.png" "$DIST_DIR/assets/icons/"
done

# Strip macOS metadata that may have snuck in from Finder.
find "$DIST_DIR" -name '.DS_Store' -delete

# --- Package -----------------------------------------------------------------
# Reproducible output: a zip stores each entry's mtime, so two builds of
# identical bytes otherwise hash differently and the SHA-256 recorded in
# COMPLIANCE_EVIDENCE.md could not be reproduced by a reviewer. Normalising the
# timestamps (and -X, which drops platform extra-fields) makes the archive
# byte-identical for identical inputs. The epoch is arbitrary but fixed.
find "$DIST_DIR" -exec touch -t 202601010000 {} +

cd "$DIST_DIR"
# LC_ALL=C so the glob order — and therefore the entry order — does not depend
# on the builder's locale.
LC_ALL=C zip -r -X -q "../$ZIP_NAME" ./* -x '*.DS_Store'
cd ..

echo "Build complete: $ZIP_NAME"
echo "SHA-256: $(shasum -a 256 "$ZIP_NAME" | awk '{print $1}')"
echo "Files in zip:"
unzip -Z1 "$ZIP_NAME" | sort
