// Initialize media storage
var mediaUrls = {
  images: new Set(),
  videos: new Set()
};

// Load existing URLs from storage on startup
chrome.storage.local.get({ imageUrls: [], videoUrls: [] }, function(data) {
  if (data.imageUrls) {
    data.imageUrls.forEach(function(url) { mediaUrls.images.add(url); });
  }
  if (data.videoUrls) {
    data.videoUrls.forEach(function(url) { mediaUrls.videos.add(url); });
  }
  console.log("[BG] Loaded", mediaUrls.images.size, "images,", mediaUrls.videos.size, "videos");
});

// Clear storage on extension install/reload
chrome.runtime.onInstalled.addListener(function() {
  console.log("[BG] Extension installed/reloaded - clearing storage");
  mediaUrls.images.clear();
  mediaUrls.videos.clear();
  chrome.storage.local.set({ imageUrls: [], videoUrls: [] });
});

function saveToStorage() {
  var imgArr = Array.from(mediaUrls.images);
  var vidArr = Array.from(mediaUrls.videos);
  chrome.storage.local.set({
    imageUrls: imgArr,
    videoUrls: vidArr
  });
  console.log("[BG] Saved:", imgArr.length, "images,", vidArr.length, "videos");
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  console.log("[BG] Received message:", msg.type);
  
  if (msg.type === "IMAGE_URL") {
    if (!mediaUrls.images.has(msg.url)) {
      mediaUrls.images.add(msg.url);
      saveToStorage();
      console.log("[BG] Added image, total:", mediaUrls.images.size);
    }
  }

  if (msg.type === "VIDEO_URL") {
    if (!mediaUrls.videos.has(msg.url)) {
      mediaUrls.videos.add(msg.url);
      saveToStorage();
      console.log("[BG] Added video, total:", mediaUrls.videos.size);
    }
  }

  if (msg.type === "GET_URLS") {
    sendResponse({
      images: Array.from(mediaUrls.images),
      videos: Array.from(mediaUrls.videos)
    });
    return true;
  }

  if (msg.type === "CLEAR_URLS") {
    mediaUrls.images.clear();
    mediaUrls.videos.clear();
    chrome.storage.local.set({ imageUrls: [], videoUrls: [] });
    console.log("[BG] Cleared all URLs");
  }
});

console.log("[BG] Background script loaded");
