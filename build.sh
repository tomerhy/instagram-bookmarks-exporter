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
cp background.js "$DIST_DIR/"
cp content.js "$DIST_DIR/"
cp popup.html "$DIST_DIR/"
cp popup.js "$DIST_DIR/"
cp gallery.html "$DIST_DIR/"
cp gallery.js "$DIST_DIR/"
cp -r assets "$DIST_DIR/"

# Copy optional files if they exist
[ -f privacy-policy.html ] && cp privacy-policy.html "$DIST_DIR/"

# Create zip
cd "$DIST_DIR"
zip -r "../$ZIP_NAME" ./*
cd ..

echo "Build complete: $ZIP_NAME"
echo "Files in dist/:"
ls -la "$DIST_DIR"
