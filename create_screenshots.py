#!/usr/bin/env python3
"""
Generate Chrome Web Store screenshots (1280x800)
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Screenshot dimensions for Chrome Web Store
WIDTH = 1280
HEIGHT = 800

# Colors
BG_DARK = (26, 26, 46)  # #1a1a2e
BG_GRADIENT_END = (22, 33, 62)  # #16213e
PINK = (225, 48, 108)  # #E1306C
PURPLE = (131, 58, 180)  # #833ab4
WHITE = (255, 255, 255)
GRAY = (100, 100, 100)
GREEN = (64, 196, 99)  # #40c463

def create_gradient_bg(width, height):
    """Create a dark gradient background"""
    img = Image.new('RGB', (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    for y in range(height):
        r = int(BG_DARK[0] + (BG_GRADIENT_END[0] - BG_DARK[0]) * y / height)
        g = int(BG_DARK[1] + (BG_GRADIENT_END[1] - BG_DARK[1]) * y / height)
        b = int(BG_DARK[2] + (BG_GRADIENT_END[2] - BG_DARK[2]) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return img

def draw_rounded_rect(draw, coords, radius, fill):
    """Draw a rounded rectangle"""
    x1, y1, x2, y2 = coords
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + 2*radius, y1 + 2*radius], fill=fill)
    draw.ellipse([x2 - 2*radius, y1, x2, y1 + 2*radius], fill=fill)
    draw.ellipse([x1, y2 - 2*radius, x1 + 2*radius, y2], fill=fill)
    draw.ellipse([x2 - 2*radius, y2 - 2*radius, x2, y2], fill=fill)

def get_font(size):
    """Get a font, falling back to default if needed"""
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except:
        try:
            return ImageFont.truetype("/System/Library/Fonts/SFNSText.ttf", size)
        except:
            return ImageFont.load_default()

def create_screenshot_1():
    """Screenshot 1: Extension popup with stats"""
    img = create_gradient_bg(WIDTH, HEIGHT)
    draw = ImageDraw.Draw(img)
    
    # Title at top
    font_large = get_font(48)
    font_med = get_font(28)
    font_small = get_font(20)
    
    title = "Export Your Instagram Saved Posts"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 60), title, fill=WHITE, font=font_large)
    
    subtitle = "Capture images, videos, and carousels with one click"
    bbox = draw.textbbox((0, 0), subtitle, font=font_med)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 130), subtitle, fill=GRAY, font=font_med)
    
    # Draw popup mockup in center
    popup_w, popup_h = 320, 380
    popup_x = (WIDTH - popup_w) // 2
    popup_y = 200
    
    # Popup background
    draw_rounded_rect(draw, (popup_x, popup_y, popup_x + popup_w, popup_y + popup_h), 16, (30, 30, 50))
    
    # Popup header
    draw.text((popup_x + 60, popup_y + 25), "IG Exporter", fill=WHITE, font=font_med)
    draw_rounded_rect(draw, (popup_x + 220, popup_y + 25, popup_x + 280, popup_y + 50), 8, (225, 48, 108, 50))
    draw.text((popup_x + 232, popup_y + 28), "v4.1.0", fill=PINK, font=font_small)
    
    # Stats boxes
    box_y = popup_y + 80
    # Images box
    draw_rounded_rect(draw, (popup_x + 20, box_y, popup_x + 150, box_y + 90), 12, (40, 40, 60))
    draw.text((popup_x + 60, box_y + 15), "127", fill=GREEN, font=font_large)
    draw.text((popup_x + 55, box_y + 60), "Images", fill=GRAY, font=font_small)
    
    # Videos box  
    draw_rounded_rect(draw, (popup_x + 170, box_y, popup_x + 300, box_y + 90), 12, (40, 40, 60))
    draw.text((popup_x + 220, box_y + 15), "43", fill=PINK, font=font_large)
    draw.text((popup_x + 210, box_y + 60), "Videos", fill=GRAY, font=font_small)
    
    # Buttons
    btn_y = popup_y + 200
    # Capture button (gradient pink)
    draw_rounded_rect(draw, (popup_x + 20, btn_y, popup_x + 150, btn_y + 50), 10, PINK)
    draw.text((popup_x + 35, btn_y + 12), "🎠 Capture", fill=WHITE, font=font_small)
    
    # Gallery button
    draw_rounded_rect(draw, (popup_x + 170, btn_y, popup_x + 300, btn_y + 50), 10, PURPLE)
    draw.text((popup_x + 195, btn_y + 12), "🖼 Gallery", fill=WHITE, font=font_small)
    
    # Clear button
    draw_rounded_rect(draw, (popup_x + 20, btn_y + 70, popup_x + 300, btn_y + 120), 10, (80, 40, 40))
    draw.text((popup_x + 125, btn_y + 82), "🗑 Clear", fill=WHITE, font=font_small)
    
    # Bottom tagline
    tagline = "Free • Private • No data sent to servers"
    bbox = draw.textbbox((0, 0), tagline, font=font_small)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, HEIGHT - 60), tagline, fill=GRAY, font=font_small)
    
    return img

def create_screenshot_2():
    """Screenshot 2: Gallery view with images"""
    img = create_gradient_bg(WIDTH, HEIGHT)
    draw = ImageDraw.Draw(img)
    
    font_large = get_font(48)
    font_med = get_font(28)
    font_small = get_font(20)
    
    # Title
    title = "Beautiful Gallery View"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 40), title, fill=WHITE, font=font_large)
    
    subtitle = "Browse, preview, and download your saved media"
    bbox = draw.textbbox((0, 0), subtitle, font=font_med)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 100), subtitle, fill=GRAY, font=font_med)
    
    # Gallery grid mockup
    grid_start_x = 100
    grid_start_y = 180
    cell_size = 180
    gap = 15
    
    colors = [
        (64, 196, 99), (225, 48, 108), (131, 58, 180), (64, 93, 230),
        (253, 29, 29), (245, 166, 35), (64, 196, 99), (225, 48, 108),
        (131, 58, 180), (64, 93, 230), (253, 29, 29), (245, 166, 35)
    ]
    
    idx = 0
    for row in range(3):
        for col in range(6):
            x = grid_start_x + col * (cell_size + gap)
            y = grid_start_y + row * (cell_size + gap)
            
            if x + cell_size > WIDTH - 50:
                continue
                
            # Draw image placeholder
            color = colors[idx % len(colors)]
            draw_rounded_rect(draw, (x, y, x + cell_size, y + cell_size), 12, color)
            
            # Add some variety - video icon on some
            if idx % 4 == 0:
                draw.text((x + 70, y + 70), "▶", fill=WHITE, font=font_large)
            
            idx += 1
    
    # Bottom stats bar
    bar_y = HEIGHT - 80
    draw_rounded_rect(draw, (100, bar_y, WIDTH - 100, bar_y + 50), 12, (40, 40, 60))
    draw.text((150, bar_y + 12), "📸 127 Images", fill=GREEN, font=font_small)
    draw.text((350, bar_y + 12), "🎬 43 Videos", fill=PINK, font=font_small)
    draw.text((550, bar_y + 12), "📥 Click to Download", fill=WHITE, font=font_small)
    
    return img

def create_screenshot_3():
    """Screenshot 3: How it works - 3 steps"""
    img = create_gradient_bg(WIDTH, HEIGHT)
    draw = ImageDraw.Draw(img)
    
    font_large = get_font(48)
    font_med = get_font(32)
    font_small = get_font(22)
    
    # Title
    title = "How It Works"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 60), title, fill=WHITE, font=font_large)
    
    # Three steps
    steps = [
        ("1", "Go to Saved Posts", "Navigate to your Instagram\nsaved posts page"),
        ("2", "Click Capture", "The extension automatically\nscans all your posts"),
        ("3", "Download", "Open Gallery to view\nand download media")
    ]
    
    step_width = 350
    start_x = (WIDTH - (step_width * 3 + 60)) // 2
    step_y = 200
    
    for i, (num, title_text, desc) in enumerate(steps):
        x = start_x + i * (step_width + 30)
        
        # Step circle
        circle_x = x + step_width // 2
        circle_r = 50
        draw.ellipse([circle_x - circle_r, step_y, circle_x + circle_r, step_y + circle_r * 2], fill=PINK)
        draw.text((circle_x - 15, step_y + 25), num, fill=WHITE, font=font_large)
        
        # Title
        bbox = draw.textbbox((0, 0), title_text, font=font_med)
        tw = bbox[2] - bbox[0]
        draw.text((x + (step_width - tw) // 2, step_y + 130), title_text, fill=WHITE, font=font_med)
        
        # Description
        lines = desc.split('\n')
        for j, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font_small)
            tw = bbox[2] - bbox[0]
            draw.text((x + (step_width - tw) // 2, step_y + 180 + j * 30), line, fill=GRAY, font=font_small)
    
    # Features at bottom
    features = "✓ Captures carousels & reels  •  ✓ 100% private  •  ✓ Free forever"
    bbox = draw.textbbox((0, 0), features, font=font_small)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, HEIGHT - 100), features, fill=GREEN, font=font_small)
    
    return img

def create_screenshot_4():
    """Screenshot 4: Features highlight"""
    img = create_gradient_bg(WIDTH, HEIGHT)
    draw = ImageDraw.Draw(img)
    
    font_large = get_font(48)
    font_med = get_font(28)
    font_small = get_font(22)
    
    # Title
    title = "Powerful Features"
    bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, 50), title, fill=WHITE, font=font_large)
    
    # Feature cards
    features = [
        ("🎠", "Carousels", "Captures all slides"),
        ("🎬", "Videos", "Download reels & clips"),
        ("🔒", "Private", "No data leaves browser"),
        ("⚡", "Fast", "Scan hundreds in minutes"),
        ("🔄", "Smart", "Skips duplicates"),
        ("🖼️", "Gallery", "Beautiful preview")
    ]
    
    card_w = 350
    card_h = 120
    gap_x = 40
    gap_y = 30
    start_x = (WIDTH - (card_w * 2 + gap_x)) // 2
    start_y = 150
    
    for i, (icon, title_text, desc) in enumerate(features):
        row = i // 2
        col = i % 2
        
        x = start_x + col * (card_w + gap_x)
        y = start_y + row * (card_h + gap_y)
        
        # Card background
        draw_rounded_rect(draw, (x, y, x + card_w, y + card_h), 16, (40, 40, 65))
        
        # Icon circle
        draw.ellipse([x + 20, y + 25, x + 80, y + 85], fill=PINK)
        draw.text((x + 35, y + 38), icon, fill=WHITE, font=font_med)
        
        # Text
        draw.text((x + 100, y + 30), title_text, fill=WHITE, font=font_med)
        draw.text((x + 100, y + 70), desc, fill=GRAY, font=font_small)
    
    # Bottom CTA
    cta = "Install now - It's FREE!"
    bbox = draw.textbbox((0, 0), cta, font=font_med)
    text_width = bbox[2] - bbox[0]
    draw.text(((WIDTH - text_width) // 2, HEIGHT - 80), cta, fill=PINK, font=font_med)
    
    return img

def main():
    output_dir = "assets/screenshots"
    os.makedirs(output_dir, exist_ok=True)
    
    screenshots = [
        ("screenshot-1-popup.png", create_screenshot_1),
        ("screenshot-2-gallery.png", create_screenshot_2),
        ("screenshot-3-howto.png", create_screenshot_3),
        ("screenshot-4-features.png", create_screenshot_4),
    ]
    
    for filename, create_func in screenshots:
        print(f"Creating {filename}...")
        img = create_func()
        img.save(os.path.join(output_dir, filename), "PNG", quality=95)
        print(f"  Saved to {output_dir}/{filename}")
    
    print("\nDone! Screenshots created in assets/screenshots/")
    print("Chrome Web Store requires 1280x800 or 640x400 screenshots")

if __name__ == "__main__":
    main()
