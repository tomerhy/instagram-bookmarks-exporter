/**
 * Google Analytics 4 - Measurement Protocol
 * Focused on: Page Views, Button Clicks, Feature Usage
 */

const GA_MEASUREMENT_ID = 'G-PX8PH6ZQE';
const GA_API_SECRET = 'XsR9YFyZQY2_gJdKY939Lw';

// Generate or retrieve client ID
function getClientId() {
  let clientId = localStorage.getItem('ga_client_id');
  if (!clientId) {
    clientId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('ga_client_id', clientId);
  }
  return clientId;
}

// Send event to GA4 via Measurement Protocol
async function sendEvent(eventName, params = {}) {
  try {
    const payload = {
      client_id: getClientId(),
      events: [{
        name: eventName,
        params: {
          engagement_time_msec: 100,
          session_id: sessionStorage.getItem('ga_session_id') || Date.now().toString(),
          ...params
        }
      }]
    };
    
    // Store session ID
    if (!sessionStorage.getItem('ga_session_id')) {
      sessionStorage.setItem('ga_session_id', Date.now().toString());
    }

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    
    console.log('[Analytics] Sent:', eventName, params);
    return response.ok;
  } catch (error) {
    console.log('[Analytics] Error:', error.message);
    return false;
  }
}

/**
 * PAGE VIEWS - Track when user opens popup or gallery
 * @param {string} pageName - 'popup' or 'gallery'
 * @param {string} pageTitle - Human readable title
 */
function trackPageView(pageName, pageTitle) {
  sendEvent('page_view', {
    page_title: pageTitle || pageName,
    page_location: pageName
  });
}

/**
 * BUTTON CLICKS - Track all user interactions
 * @param {string} buttonName - Unique button identifier
 * @param {string} location - 'popup' or 'gallery'
 * 
 * Button names:
 * Popup: start_capture, stop_capture, clear, open_gallery
 * Gallery: tab_images, tab_videos, download_single, copy_urls, export_urls, 
 *          clear_all, refresh, import, fullscreen, slideshow
 */
function trackButtonClick(buttonName, location) {
  sendEvent('button_click', {
    button_name: buttonName,
    location: location || 'unknown'
  });
}

/**
 * FEATURE USAGE - Track when features are used with context
 * @param {string} featureName - Feature identifier
 * @param {object} params - Additional context data
 * 
 * Features:
 * - capture_started: When user starts capture (with current counts)
 * - capture_completed: When capture finishes (with final counts)
 * - data_cleared: When user clears data
 * - urls_copied: When user copies URLs (with count)
 * - urls_exported: When user exports URLs (with count)
 * - media_downloaded: When user downloads media (with type, count)
 * - slideshow_used: When user uses slideshow feature
 * - fullscreen_used: When user opens fullscreen view
 */
function trackFeature(featureName, params = {}) {
  sendEvent('feature_usage', {
    feature_name: featureName,
    ...params
  });
}

/**
 * DOWNLOAD - Track media downloads
 * @param {string} type - 'single' or 'batch'
 * @param {string} mediaType - 'image' or 'video'
 * @param {number} count - Number of items
 */
function trackDownload(type, mediaType, count) {
  sendEvent('download', {
    download_type: type,
    media_type: mediaType,
    item_count: count
  });
}

// Export for use in other scripts
window.Analytics = {
  trackPageView,
  trackButtonClick,
  trackFeature,
  trackDownload
};
