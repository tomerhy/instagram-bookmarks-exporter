#!/usr/bin/env python3
"""
Convert X extension icons from blue to Instagram pink/red colors.
"""

from PIL import Image
import os

# Paths
X_ICONS_DIR = "../x-bookmarks-exporter/assets/icons"
OUTPUT_DIR = "assets/icons"

# Instagram colors
# Main pink: #E1306C (225, 48, 108)
# Gradient: #833ab4 (purple) -> #fd1d1d (red) -> #fcb045 (orange)

def convert_blue_to_instagram(img):
    """Convert blue pixels to Instagram pink/red."""
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Skip transparent pixels
            if a < 10:
                continue
            
            # Detect blue-ish pixels (the background circle)
            is_blue = b > 80 and (b > r or b > g)
            
            if is_blue:
                # Calculate intensity based on blue value
                intensity = b / 255.0
                
                # Map to Instagram pink (#E1306C) with some gradient variation
                # Darker blues become more purple, lighter blues become more red/orange
                new_r = int(min(255, 180 + intensity * 75))  # 180-255
                new_g = int(min(255, 30 + intensity * 40))   # 30-70
                new_b = int(min(255, 80 + intensity * 50))   # 80-130
                
                pixels[x, y] = (new_r, new_g, new_b, a)
    
    return img


def main():
    sizes = [16, 32, 48, 128]
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for size in sizes:
        input_path = os.path.join(X_ICONS_DIR, f"icon-{size}.png")
        output_path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
        
        if not os.path.exists(input_path):
            print(f"Warning: {input_path} not found, skipping...")
            continue
        
        print(f"Converting icon-{size}.png...")
        
        # Load and convert
        img = Image.open(input_path)
        converted = convert_blue_to_instagram(img)
        
        # Save
        converted.save(output_path, "PNG")
        print(f"  Saved to {output_path}")
    
    print("\nDone! Icons converted to Instagram colors.")


if __name__ == "__main__":
    main()
