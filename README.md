# Instagram Saved Media Exporter

A Chrome extension to extract and export images and videos from your Instagram saved posts.

## Features

- **Image & Video Capture**: Automatically captures both images and videos from Instagram
- **Media Gallery**: Beautiful gallery with Instagram-themed UI to browse captured media
- **Filter Options**: Filter by images only, videos only, or all media
- **Auto-Scroll**: Automatically scrolls through your saved posts to load more content
- **Bulk Download**: Download all media or individual files
- **Export/Import**: Export URLs to a text file or import from existing files
- **Real-time Updates**: Gallery updates in real-time as new media is captured

## Installation

### From Source (Development)

1. **Generate Icons** (required first time):
   - Open `create-icons.html` in your browser
   - Click "Download All Icons"
   - Save the PNG files to `assets/icons/` folder

2. **Load the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this folder

### From Chrome Web Store

Coming soon!

## Usage

1. **Open Instagram**: Navigate to `instagram.com`
2. **Go to Saved Posts**: Click your profile → Saved
3. **Start Scrolling**: Click the extension icon and use "Scroll Saved" to automatically load posts
4. **Open Gallery**: Click "Open Gallery" to view all captured media
5. **Download**: Click individual items to download, or use "Download All"

## File Structure

```
instagram-bookmarks-exporter/
├── manifest.json        # Extension configuration
├── background.js        # Service worker for message handling
├── content.js           # Content script injected into Instagram
├── popup.html/js        # Extension popup UI
├── gallery.html/js      # Media gallery page
├── assets/icons/        # Extension icons (16, 32, 48, 128px PNGs)
├── privacy-policy.html  # Privacy policy
├── build.sh             # Build script for distribution
└── create-icons.html    # Icon generator tool
```

## Permissions

- **storage**: Store captured media URLs locally
- **tabs**: Detect Instagram tabs
- **scripting**: Inject content scripts
- **Host permissions**: Access Instagram pages

## Privacy

This extension:
- Does NOT collect personal data
- Does NOT send data to external servers
- All data is stored locally in your browser
- See `privacy-policy.html` for full details

## Development

### Build for Distribution

```bash
chmod +x build.sh
./build.sh
```

This creates `instagram-saved-media-exporter.zip` ready for Chrome Web Store submission.

## License

MIT License

## Support

If you find this extension helpful, consider [supporting on Patreon](https://www.patreon.com/join/THYProduction).
