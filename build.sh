#!/bin/bash
# Build script for Saved Posts Library & Export
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
ZIP_NAME="saved-posts-library-export-${VERSION}.zip"

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
# library-sanitize.js is the single authoritative sanitiser for stored records.
# Loaded into the isolated content-script world AND the gallery page.
cp library-sanitize.js "$DIST_DIR/"
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
# Deliberately NOT a `cp -r assets/icons` — that would also drag in the build
# inputs: icon-source.png (the design master) and portrait-source.png (the
# developer's original photograph). Those are sources, not runtime assets, and
# shipping a 280x280 portrait the extension never displays would be dead
# weight. assets/screenshots/ holds store marketing PNGs and never ships.
mkdir -p "$DIST_DIR/assets/icons"
for size in 16 32 48 128; do
  cp "assets/icons/icon-${size}.png" "$DIST_DIR/assets/icons/"
done

# Strip macOS metadata that may have snuck in from Finder.
find "$DIST_DIR" -name '.DS_Store' -delete

# --- Package -----------------------------------------------------------------
# Reproducible output, and the reason this is not simply `zip -r ./*`:
#
#   `zip -r` walks directories in FILESYSTEM order. LC_ALL=C sorts the shell
#   glob, which fixes only the TOP-LEVEL argument order — the recursive descent
#   into assets/icons/ and lib/ still emits entries in whatever order the
#   filesystem hands back. Two machines (or two directories on one machine)
#   therefore produce byte-different archives from identical files. That is
#   exactly what an independent reviewer hit: identical extracted contents,
#   different ZIP hash.
#
# So: build an explicitly sorted list of FILES and pass it to zip with -@.
# Directory entries are omitted; unzip recreates directories from the paths,
# and omitting them removes another order-dependent source of bytes.
#
# Timestamps are normalised and -X drops platform extra-fields, so the only
# remaining variable — entry order — is now fully determined by the sort.
find "$DIST_DIR" -exec touch -t 202601010000 {} +

cd "$DIST_DIR"
# -type f: files only, no directory entries.
# LC_ALL=C sort: byte-wise ordering, independent of the builder's locale.
find . -type f ! -name '.DS_Store' | sed 's|^\./||' | LC_ALL=C sort > "$OLDPWD/.zip-manifest"
LC_ALL=C zip -X -q -@ "../$ZIP_NAME" < "$OLDPWD/.zip-manifest"
cd ..
rm -f .zip-manifest

echo "Build complete: $ZIP_NAME"
echo "SHA-256: $(shasum -a 256 "$ZIP_NAME" | awk '{print $1}')"
echo "Entry order (must be byte-sorted, no directory entries):"
unzip -Z1 "$ZIP_NAME"
