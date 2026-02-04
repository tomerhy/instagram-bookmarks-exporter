/**
 * Google Analytics 4 Helper for Chrome Extension
 * Replace GA_MEASUREMENT_ID with your actual GA4 Measurement ID (G-XXXXXXXXXX)
 */

const GA_MEASUREMENT_ID = 'G-PX8PH6ZQE';

// Initialize GA4
(function() {
  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { dataLayer.push(arguments); };
  
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    // Disable automatic page view (we'll send manually with more context)
    send_page_view: false,
    // Respect user privacy
    anonymize_ip: true
  });
})();

/**
 * Track page view
 * @param {string} pageName - Name of the page (e.g., 'gallery', 'popup')
 * @param {string} pageTitle - Title of the page
 */
function trackPageView(pageName, pageTitle) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'page_view', {
    page_title: pageTitle || pageName,
    page_location: pageName,
    page_path: '/' + pageName
  });
  
  console.log('[Analytics] Page view:', pageName);
}

/**
 * Track button click
 * @param {string} buttonName - Name/ID of the button
 * @param {string} category - Category (e.g., 'gallery', 'popup', 'panel')
 */
function trackButtonClick(buttonName, category) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'button_click', {
    event_category: category || 'general',
    event_label: buttonName,
    button_name: buttonName
  });
  
  console.log('[Analytics] Button click:', buttonName, 'in', category);
}

/**
 * Track feature usage
 * @param {string} featureName - Name of the feature
 * @param {object} params - Additional parameters
 */
function trackFeature(featureName, params = {}) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'feature_usage', {
    event_category: 'features',
    event_label: featureName,
    feature_name: featureName,
    ...params
  });
  
  console.log('[Analytics] Feature:', featureName, params);
}

/**
 * Track media capture stats
 * @param {number} images - Number of images
 * @param {number} videos - Number of videos
 */
function trackCaptureStats(images, videos) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'capture_stats', {
    event_category: 'capture',
    images_count: images,
    videos_count: videos,
    total_count: images + videos
  });
}

/**
 * Track download action
 * @param {string} type - 'single' or 'all'
 * @param {string} mediaType - 'image' or 'video'
 * @param {number} count - Number of items
 */
function trackDownload(type, mediaType, count) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'download', {
    event_category: 'downloads',
    download_type: type,
    media_type: mediaType,
    item_count: count
  });
  
  console.log('[Analytics] Download:', type, mediaType, count);
}

/**
 * Track error
 * @param {string} errorType - Type of error
 * @param {string} errorMessage - Error message
 */
function trackError(errorType, errorMessage) {
  if (typeof gtag === 'undefined') return;
  
  gtag('event', 'error', {
    event_category: 'errors',
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
