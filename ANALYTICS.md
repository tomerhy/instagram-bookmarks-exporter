# Analytics Events Documentation

This document lists all Google Analytics 4 events tracked by the Instagram Saved Media Exporter extension.

## Page Views

| Event | Location | When |
|-------|----------|------|
| `page_view` (popup) | Popup | When user opens the extension popup |
| `page_view` (gallery) | Gallery | When user opens the gallery page |

## Button Clicks

| Button Name | Location | Description |
|-------------|----------|-------------|
| `start_capture` | popup | User starts capture |
| `stop_capture` | popup | User stops capture |
| `clear` | popup | User clears data from popup |
| `open_gallery` | popup | User opens gallery |
| `tab_images` / `tab_videos` | gallery | User switches tabs |
| `copy_urls` | gallery | User copies URLs |
| `export_urls` | gallery | User exports URLs |
| `clear_all` | gallery | User clears data from gallery |
| `refresh` | gallery | User refreshes data |
| `import` | gallery | User clicks import |
| `donate` | gallery | User clicks donate |
| `fullscreen` | gallery | User opens fullscreen |
| `slideshow_start` | gallery | User starts slideshow |

## Feature Usage

| Feature Name | Context Data |
|--------------|--------------|
| `capture_started` | images_before, videos_before |
| `data_cleared` | source, images_cleared, videos_cleared |
| `copy_urls` | count, type (images/videos) |
| `export_urls` | count, type |
| `urls_imported` | count, type |
| `fullscreen_opened` | type |
| `slideshow_started` | interval_seconds |

## Downloads

| Type | Media Type | Count |
|------|------------|-------|
| `single` | image/video | 1 |

---

## Implementation Details

All events are sent via Google Analytics 4 Measurement Protocol, which works with Chrome Extension Manifest V3 without requiring external scripts.

### Event Structure

```javascript
{
  client_id: "unique_client_id",
  events: [{
    name: "event_name",
    params: {
      engagement_time_msec: 100,
      session_id: "session_id",
      // ... additional params
    }
  }]
}
```

### Files

- `analytics.js` - Core analytics functions
- `popup.js` - Popup tracking implementation
- `gallery.js` - Gallery tracking implementation
