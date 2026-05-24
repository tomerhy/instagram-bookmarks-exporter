#!/bin/bash
# Build script for Instagram Saved Media Exporter

set -e

DIST_DIR="dist"
ZIP_NAME="instagram-saved-media-exporter.zip"

# Clean previous build
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy extension files
cp manifest.json "$DIST_DIR/"
cp tokens.css "$DIST_DIR/"
cp background.js "$DIST_DIR/"
cp content.js "$DIST_DIR/"
cp content-styles.css "$DIST_DIR/"
cp injector.js "$DIST_DIR/"
cp autoplay.js "$DIST_DIR/"
cp analytics.js "$DIST_DIR/"
cp popup.html "$DIST_DIR/"
cp popup.js "$DIST_DIR/"
cp gallery.html "$DIST_DIR/"
cp gallery.js "$DIST_DIR/"

# Bundled third-party libraries — currently just JSZip for the per-album
# download feature. ~95KB pre-gzip; CWS zips it again so download cost
# is much lower.
cp -r lib "$DIST_DIR/"

# Copy only the runtime assets the extension actually uses (icons).
# assets/screenshots/ holds Chrome Web Store marketing PNGs (~8MB) that
# would otherwise bloat the user's downloaded package for no benefit.
mkdir -p "$DIST_DIR/assets"
cp -r assets/icons "$DIST_DIR/assets/"

# Strip macOS metadata that may have snuck in from Finder.
find "$DIST_DIR" -name '.DS_Store' -delete

# Copy optional files if they exist
[ -f privacy-policy.html ] && cp privacy-policy.html "$DIST_DIR/"

# Create zip — exclude any .DS_Store stragglers.
cd "$DIST_DIR"
zip -r "../$ZIP_NAME" ./* -x '*.DS_Store'
cd ..

echo "Build complete: $ZIP_NAME"
echo "Files in dist/:"
ls -la "$DIST_DIR"
