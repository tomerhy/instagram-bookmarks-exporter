#!/bin/bash
# Generate PNG icons from SVG files
# Requires: ImageMagick (brew install imagemagick) or rsvg-convert (brew install librsvg)

ICON_DIR="assets/icons"

echo "Generating PNG icons from SVG..."

# Check if rsvg-convert is available (better quality)
if command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert..."
    for size in 16 32 48 128; do
        rsvg-convert -w $size -h $size "$ICON_DIR/icon-$size.svg" -o "$ICON_DIR/icon-$size.png"
        echo "Created icon-$size.png"
    done
# Fall back to ImageMagick
elif command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    for size in 16 32 48 128; do
        convert -background none -resize ${size}x${size} "$ICON_DIR/icon-$size.svg" "$ICON_DIR/icon-$size.png"
        echo "Created icon-$size.png"
    done
else
    echo "Error: Neither rsvg-convert nor ImageMagick found."
    echo "Install with: brew install librsvg"
    echo "Or: brew install imagemagick"
    exit 1
fi

echo "Done! PNG icons generated in $ICON_DIR"
