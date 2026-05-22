# Raw screenshot captures → store frames

Drop **real screenshots of the running extension** here, then run
`python3 compose_screenshots.py` from the repo root. The compositor will
frame each one into a 1280×800 Chrome Web Store screenshot, on the
brand-aurora background with a hero headline and tagline.

## Files this folder expects

| Filename       | What to capture                                        |
|----------------|--------------------------------------------------------|
| `popup.png`    | The extension popup, open on any tab                   |
| `gallery.png`  | The gallery page (`chrome-extension://…/gallery.html`) |

Each capture can be any reasonable resolution — the compositor scales
proportionally to fit (max 560px tall). Higher DPI = sharper output.

## How to capture (macOS)

### 1. Popup screenshot

Open Chrome, load the extension if it isn't loaded
(`chrome://extensions/` → "Load unpacked" → repo root).

1. Click the extension's toolbar icon to open the popup.
2. To get a clean shot **without** the surrounding Chrome UI:
   - Right-click the popup → **Inspect** → opens DevTools attached to the popup.
   - In DevTools, dock to the side or undock, then in the popup itself
     drag the corner to resize to **320 × 540** (the natural popup size).
3. With the popup visible, press **⌘⇧4 then Space**, click the popup
   window → captures just that window (no Chrome chrome around it).
4. Move the resulting screenshot here and rename it to `popup.png`.

Pro tip: have a few captures with images/videos > 0 so the stat tiles
look populated. If you want the "+N new" delta to show, close the popup
and capture from a new tab.

### 2. Gallery screenshot

1. Open the gallery — toolbar icon → **🖼 Gallery** button, OR navigate
   directly to `chrome-extension://<id>/gallery.html`.
2. Make sure there's enough captured content to fill the grid (at least
   a couple of rows). If empty, capture from Instagram first.
3. Click an item so the viewer panel on the left has content.
4. Set the Chrome window to a comfortable size — **1440 × 900** is a
   sweet spot.
5. **⌘⇧4 then Space**, click the gallery tab area → captures the tab
   content (no Chrome chrome).
6. Move/rename to `gallery.png`.

## Compose

From the repo root:

```bash
python3 compose_screenshots.py
```

Output:

```
assets/screenshots/screenshot-1-popup.png    1280×800
assets/screenshots/screenshot-2-gallery.png  1280×800
```

Upload those to the Chrome Web Store listing.

## Replacing later

When the UI changes again, just recapture (overwriting these PNGs) and
re-run the compositor. The version in the footer pulls from
`manifest.json` automatically.

## Notes

- These raw PNGs are not committed (see `.gitignore` for this folder).
  Each contributor captures their own.
- If Pillow isn't installed: `pip install Pillow`.
- The legacy `create_screenshots.py` (PIL-drawn mockups, pre-v4.3.9
  design) is kept around for archival reference but is not how
  screenshots get made anymore.
