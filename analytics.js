/**
 * Google Analytics 4 - Measurement Protocol
 * Works with Chrome Extension Manifest V3 (no external scripts needed)
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
 * Track page view
 */
function trackPageView(pageName, pageTitle) {
  sendEvent('page_view', {
    page_title: pageTitle || pageName,
    page_location: pageName
  });
}

/**
 * Track button click
 */
function trackButtonClick(buttonName, category) {
  sendEvent('button_click', {
    button_name: buttonName,
    category: category || 'general'
  });
}

/**
 * Track feature usage
 */
function trackFeature(featureName, params = {}) {
  sendEvent('feature_usage', {
    feature_name: featureName,
    ...params
  });
}

/**
 * Track media capture stats
 */
function trackCaptureStats(images, videos) {
  sendEvent('capture_stats', {
    images_count: images,
    videos_count: videos,
    total_count: images + videos
  });
}

/**
 * Track download action
 */
function trackDownload(type, mediaType, count) {
  sendEvent('download', {
    download_type: type,
    media_type: mediaType,
    item_count: count
  });
}

/**
 * Track error
 */
function trackError(errorType, errorMessage) {
  sendEvent('error', {
    error_type: errorType,
    error_message: errorMessage
  });
}

// Export for use in other scripts
window.Analytics = {
  trackPageView,
  trackButtonClick,
  trackFeature,
  trackCaptureStats,
  trackDownload,
  trackError
};
