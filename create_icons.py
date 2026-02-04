#!/usr/bin/env python3
"""
Create extension icons with Instagram pink gradient background.
Replaces the blue background from the source image with pink gradient.
"""

from PIL import Image, ImageDraw
import os
import math

def create_gradient_background(size, color1, color2, corner_radius=None):
    """Create a gradient background from top-left to bottom-right."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Parse hex colors
    r1, g1, b1 = int(color1[1:3], 16), int(color1[3:5], 16), int(color1[5:7], 16)
    r2, g2, b2 = int(color2[1:3], 16), int(color2[3:5], 16), int(color2[5:7], 16)
    
    # Create gradient (diagonal from top-left to bottom-right)
    for y in range(size):
        for x in range(size):
            # Calculate gradient position (0 to 1) based on diagonal
            t = (x + y) / (2 * size)
            
            r = int(r1 + (r2 - r1) * t)
            g = int(g1 + (g2 - g1) * t)
            b = int(b1 + (b2 - b1) * t)
            
            img.putpixel((x, y), (r, g, b, 255))
    
    # Apply rounded corners if specified
    if corner_radius:
        # Create a mask for rounded corners
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([(0, 0), (size-1, size-1)], radius=corner_radius, fill=255)
        img.putalpha(mask)
    
    return img

def create_icon_with_photo(source_path, output_path, size, gradient_color1, gradient_color2):
    """Create an icon with the photo on a gradient background."""
    
    # Load source image
    source = Image.open(source_path).convert('RGBA')
    source_size = source.size[0]
    
    # Calculate corner radius (proportional to size)
    corner_radius = int(size * 0.15)
    
    # Create gradient background
    bg = create_gradient_background(size, gradient_color1, gradient_color2, corner_radius)
    
    # Create white circle
    circle_margin = int(size * 0.08)
    circle_size = size - (circle_margin * 2)
    
    circle = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    circle_draw = ImageDraw.Draw(circle)
    circle_draw.ellipse(
        [circle_margin, circle_margin, size - circle_margin, size - circle_margin],
        fill=(255, 255, 255, 255)
    )
    
    # Composite circle onto background
    result = Image.alpha_composite(bg, circle)
    
    # Now we need to extract just the photo part from the source
    # The source has: gradient bg + white circle + photo
    # We need to get the photo and place it in our new white circle
    
    # Create a circular mask for the photo area
    photo_margin = int(size * 0.12)
    photo_size = size - (photo_margin * 2)
    
    # Resize source to fit
    source_resized = source.resize((size, size), Image.Resampling.LANCZOS)
    
    # Create mask to extract just the inner photo (not the blue background)
    photo_mask = Image.new('L', (size, size), 0)
    photo_mask_draw = ImageDraw.Draw(photo_mask)
    # Make the mask slightly smaller than the white circle to avoid blue edges
    inner_margin = int(size * 0.10)
    photo_mask_draw.ellipse(
        [inner_margin, inner_margin, size - inner_margin, size - inner_margin],
        fill=255
    )
    
    # Apply mask to source
    source_masked = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    source_masked.paste(source_resized, (0, 0), photo_mask)
    
    # Composite photo onto result
    result = Image.alpha_composite(result, source_masked)
    
    # Save
    result.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

def main():
    # Instagram pink gradient colors from gallery.html
    GRADIENT_COLOR1 = "#E1306C"  # --ig-pink (lighter)
    GRADIENT_COLOR2 = "#c13584"  # --ig-pink-dark (darker)
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(script_dir, "assets", "icons", "icon-source.png")
    
    # Check if source exists, if not try the provided path
    if not os.path.exists(source_path):
        # Try the path from the user's reference
        alt_source = "/Users/tomer.haryoffi/.cursor/projects/Users-tomer-haryoffi-Development-instagram-bookmarks-exporter/assets/photo-source.png"
        if os.path.exists(alt_source):
            source_path = alt_source
        else:
            print(f"Error: Source image not found at {source_path}")
            return
    
    # Icon sizes for Chrome extension
    sizes = [16, 32, 48, 128]
    
    output_dir = os.path.join(script_dir, "assets", "icons")
    os.makedirs(output_dir, exist_ok=True)
    
    # Create icons
    for size in sizes:
        output_path = os.path.join(output_dir, f"icon-{size}.png")
        create_icon_with_photo(source_path, output_path, size, GRADIENT_COLOR1, GRADIENT_COLOR2)
    
    # Also create a high-res source
    source_output = os.path.join(output_dir, "icon-source.png")
    create_icon_with_photo(source_path, source_output, 512, GRADIENT_COLOR1, GRADIENT_COLOR2)
    
    print("\nAll icons created successfully!")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    main()
