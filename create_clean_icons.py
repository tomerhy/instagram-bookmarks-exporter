#!/usr/bin/env python3
"""
Remove the logo from bottom right corner and generate icon sizes.
"""

from PIL import Image, ImageDraw
import os

# Input image path
INPUT_IMAGE = "/Users/tomer.haryoffi/.cursor/projects/Users-tomer-haryoffi-Development-instagram-bookmarks-exporter/assets/image-95758f79-0efb-4feb-b82a-cd9b564ac583.png"
OUTPUT_DIR = "assets/icons"

def remove_watermark(img):
    """Remove the sparkle logo in the bottom right corner by painting over it with the background color."""
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size
    
    # The watermark is in the bottom-right corner
    # We'll sample the background pink color and paint over the watermark area
    
    # Get the background pink color from a safe area (top-left corner area)
    bg_color = pixels[50, 50]  # Should be the pink background
    
    # Define the area to clean (bottom-right corner where the sparkle is)
    # Looking at the image, the sparkle is roughly in the bottom 15% and right 15%
    clean_start_x = int(width * 0.82)
    clean_start_y = int(height * 0.82)
    
    draw = ImageDraw.Draw(img)
    
    # Paint over the watermark area with the background color
    for y in range(clean_start_y, height):
        for x in range(clean_start_x, width):
            r, g, b, a = pixels[x, y]
            # If pixel is not the background pink (i.e., it's part of the watermark)
            # Check if it's whitish or different from pink background
            if not (200 < r < 240 and 40 < g < 90 and 100 < b < 140):
                pixels[x, y] = bg_color
    
    return img


def create_icons(img):
    """Create all icon sizes from the source image."""
    sizes = [16, 32, 48, 128]
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for size in sizes:
        # Resize with high-quality resampling
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        
        output_path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
        resized.save(output_path, "PNG")
        print(f"Created {output_path} ({size}x{size})")


def main():
    print(f"Loading image: {INPUT_IMAGE}")
    img = Image.open(INPUT_IMAGE)
    print(f"Original size: {img.size}")
    
    print("\nRemoving watermark...")
    clean_img = remove_watermark(img)
    
    # Save a cleaned full-size version for reference
    clean_img.save(os.path.join(OUTPUT_DIR, "icon-source.png"), "PNG")
    print("Saved cleaned source image")
    
    print("\nGenerating icons...")
    create_icons(clean_img)
    
    print("\nDone!")


if __name__ == "__main__":
    main()
