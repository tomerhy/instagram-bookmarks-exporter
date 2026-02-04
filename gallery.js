/**
 * Instagram Media Gallery - Simplified & Reliable
 */

// DOM Elements
var grid = document.getElementById("grid");
var player = document.getElementById("player");
var imageViewer = document.getElementById("image-viewer");
var viewerPlaceholder = document.getElementById("viewer-placeholder");
var statusEl = document.getElementById("status");
var progressBar = document.getElementById("progress-bar");
var imageCountEl = document.getElementById("image-count");
var videoCountEl = document.getElementById("video-count");
var paginationEl = document.getElementById("pagination");
var versionEl = document.getElementById("version");
var debugSection = document.getElementById("debug-section");
var toggleDebug = document.getElementById("toggle-debug");

// State
var ITEMS_PER_PAGE = 50;
var currentTab = "images";
var currentPage = 1;
var allMedia = { images: [], videos: [] };
var currentItem = null;
var selectedCard = null;

// Debug
function logDebug(msg) {
  console.log('[Gallery]', msg);
  if (debugSection) {
    debugSection.innerHTML = msg + "<br>" + debugSection.innerHTML;
    if (debugSection.innerHTML.length > 5000) {
      debugSection.innerHTML = debugSection.innerHTML.substring(0, 5000);
    }
  }
}

// Check if URL is a playable video URL (CDN URL, not Instagram post URL)
function isPlayableVideoUrl(url) {
  if (!url) return false;
  // Must be CDN URL with video indicators
  return (url.includes('cdninstagram') || url.includes('fbcdn')) && 
         (url.includes('.mp4') || url.includes('/v/') || url.includes('video'));
}

if (toggleDebug) {
  toggleDebug.onclick = function() {
    debugSection.classList.toggle("visible");
    toggleDebug.textContent = debugSection.classList.contains("visible") ? "Hide Debug" : "Show Debug";
  };
}

// Helper functions
function getUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.thumbnail || item.postUrl || null;
}

function getThumbnail(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.thumbnail || item.url || null;
}

function getPostUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return null;
  return item.postUrl || null;
}

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}

function setProgress(val) {
  if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, val)) + "%";
}

// Get current items based on tab
function getCurrentItems() {
  var items = currentTab === "images" ? allMedia.images : allMedia.videos;
  // Deduplicate
  var seen = {};
  var result = [];
  for (var i = 0; i < items.length; i++) {
    var url = getUrl(items[i]);
    if (url && !seen[url]) {
      seen[url] = true;
      result.push(items[i]);
    }
  }
  return result;
}

// Update counts
function updateCounts() {
  var images = allMedia.images.length;
  var videos = allMedia.videos.length;
  if (imageCountEl) imageCountEl.textContent = images;
  if (videoCountEl) videoCountEl.textContent = videos;
  
  // Count how many videos have playable URLs
  var playableVideos = allMedia.videos.filter(function(v) {
    return isPlayableVideoUrl(getUrl(v));
  }).length;
  
  logDebug("Counts: " + images + " images, " + videos + " videos (" + playableVideos + " playable)");
  
  // Show first video details for debugging
  if (allMedia.videos.length > 0) {
    var v = allMedia.videos[0];
    logDebug("First video: url=" + (v.url ? v.url.substring(0, 50) : "null") + ", postUrl=" + (v.postUrl || "null"));
  }
}

// Show image in viewer
function showImage(item) {
  var url = getUrl(item);
  if (!url) return;
  
  if (player) { player.pause(); player.style.display = "none"; }
  if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
  if (imageViewer) {
    imageViewer.style.display = "block";
    imageViewer.src = url;
  }
  currentItem = item;
}

// Show video in viewer
function showVideo(item) {
  var url = getUrl(item);
  var postUrl = getPostUrl(item);
  var thumb = getThumbnail(item);
  
  logDebug("Video item: url=" + (url ? url.substring(0, 60) + "..." : "null") + ", postUrl=" + (postUrl || "null"));
  
  if (imageViewer) imageViewer.style.display = "none";
  if (player) { player.pause(); player.src = ""; }
  
  // Check if we have a playable CDN video URL
  var playable = isPlayableVideoUrl(url);
  
  if (playable) {
    logDebug("Attempting to play video...");
    if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
    if (player) {
      player.style.display = "block";
      player.src = url;
      player.load();
      player.play().catch(function(e) {
        logDebug("Play error: " + e.message);
        // Show fallback on error
        showVideoFallback(postUrl || url, thumb);
      });
    }
  } else {
    // No direct video URL - show thumbnail with link
    showVideoFallback(postUrl || url, thumb);
  }
  
  currentItem = item;
}

function showVideoFallback(linkUrl, thumbnailUrl) {
  if (player) player.style.display = "none";
  if (viewerPlaceholder) {
    viewerPlaceholder.style.display = "flex";
    var thumbHtml = thumbnailUrl ? 
      '<img src="' + thumbnailUrl + '" style="max-width:200px;max-height:200px;border-radius:8px;margin-bottom:15px;">' : 
      '<div style="font-size:60px;margin-bottom:15px;">🎬</div>';
    
    viewerPlaceholder.innerHTML = '<div style="text-align:center;padding:20px;">' +
      thumbHtml +
      '<p style="margin-bottom:15px;color:#aaa;">Direct video URL not available</p>' +
      (linkUrl ? '<a href="' + linkUrl + '" target="_blank" class="btn-link">▶ Open on Instagram</a>' : '') +
      '</div>';
  }
}

// Render grid
function renderGrid() {
  if (!grid) return;
  grid.innerHTML = "";
  
  var items = getCurrentItems();
  var totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  
  if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
  
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No ' + currentTab + ' captured yet</h3>' +
      '<p>Go to Instagram, scroll through saved posts, then come back.</p></div>';
    if (viewerPlaceholder) {
      viewerPlaceholder.style.display = "flex";
      viewerPlaceholder.innerHTML = "Select an item to preview";
    }
    renderPagination(0);
    return;
  }
  
  var start = (currentPage - 1) * ITEMS_PER_PAGE;
  var end = Math.min(start + ITEMS_PER_PAGE, items.length);
  var pageItems = items.slice(start, end);
  
  pageItems.forEach(function(item, idx) {
    var globalIdx = start + idx;
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", globalIdx);
    
    var thumbUrl = getThumbnail(item) || getUrl(item);
    
    if (currentTab === "videos") {
      // Video thumbnail
      if (thumbUrl && thumbUrl.indexOf(".mp4") === -1) {
        var img = document.createElement("img");
        img.className = "thumb";
        img.src = thumbUrl;
        img.loading = "lazy";
        img.onerror = function() {
          this.outerHTML = '<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#222;"><span style="font-size:40px;">▶</span></div>';
        };
        card.appendChild(img);
      } else {
        var placeholder = document.createElement("div");
        placeholder.className = "thumb";
        placeholder.style.cssText = "display:flex;align-items:center;justify-content:center;background:#222;";
        placeholder.innerHTML = '<span style="font-size:40px;">▶</span>';
        card.appendChild(placeholder);
      }
      
      var badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = "▶ Video";
      card.appendChild(badge);
    } else {
      // Image thumbnail
      var img = document.createElement("img");
      img.className = "thumb";
      img.src = thumbUrl;
      img.loading = "lazy";
      img.onerror = function() {
        this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
      };
      card.appendChild(img);
    }
    
    card.onclick = function() {
      if (selectedCard) selectedCard.classList.remove("selected");
      card.classList.add("selected");
      selectedCard = card;
      
      if (currentTab === "videos") {
        showVideo(item);
      } else {
        showImage(item);
      }
    };
    
    grid.appendChild(card);
    
    // Auto-select first item
    if (idx === 0 && !currentItem) {
      card.click();
    }
  });
  
  renderPagination(totalPages);
}

// Render pagination
function renderPagination(totalPages) {
  if (!paginationEl) return;
  paginationEl.innerHTML = "";
  
  if (totalPages <= 1) return;
  
  var prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "←";
  prev.disabled = currentPage === 1;
  prev.onclick = function() { if (currentPage > 1) { currentPage--; renderGrid(); } };
  paginationEl.appendChild(prev);
  
  for (var i = 1; i <= totalPages; i++) {
    if (i <= 3 || i > totalPages - 2 || Math.abs(i - currentPage) <= 1) {
      (function(page) {
        var btn = document.createElement("button");
        btn.className = "page-btn" + (page === currentPage ? " active" : "");
        btn.textContent = page;
        btn.onclick = function() { currentPage = page; renderGrid(); };
        paginationEl.appendChild(btn);
      })(i);
    } else if (i === 4 || i === totalPages - 2) {
      var dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 8px";
      paginationEl.appendChild(dots);
    }
  }
  
  var next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = "→";
  next.disabled = currentPage === totalPages;
  next.onclick = function() { if (currentPage < totalPages) { currentPage++; renderGrid(); } };
  paginationEl.appendChild(next);
}

// Load data from storage
function loadData() {
  logDebug("Loading fresh data from storage...");
  
  // Force fresh read from storage
  chrome.storage.local.get(null, function(result) {
    logDebug("Storage keys: " + Object.keys(result).join(", "));
    
    // Try rich data first
    if (result.igExporterData) {
      allMedia.images = result.igExporterData.images || [];
      allMedia.videos = result.igExporterData.videos || [];
      logDebug("Loaded: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
      
      // Show newest items first
      if (allMedia.images.length > 0) {
        logDebug("Newest image: " + (allMedia.images[allMedia.images.length - 1]?.url || "none").substring(0, 60));
      }
    } else if (result.imageUrls || result.videoUrls) {
      // Fallback to legacy
      allMedia.images = (result.imageUrls || []).map(function(url) {
        return { type: 'image', url: url, thumbnail: url };
      });
      allMedia.videos = (result.videoUrls || []).map(function(url) {
        return { type: 'video', url: url };
      });
      logDebug("Loaded legacy: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
    } else {
      logDebug("No data found in storage");
      allMedia.images = [];
      allMedia.videos = [];
    }
    
    updateCounts();
    renderGrid();
  });
}

// Tab switching
document.querySelectorAll(".tab").forEach(function(tab) {
  tab.onclick = function() {
    document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
    tab.classList.add("active");
    currentTab = tab.getAttribute("data-tab");
    currentPage = 1;
    currentItem = null;
    selectedCard = null;
    renderGrid();
    
    // Track tab switch
    if (window.Analytics) {
      Analytics.trackButtonClick('tab_' + currentTab, 'gallery');
    }
  };
});

// Button handlers
document.getElementById("download-current")?.addEventListener("click", function() {
  if (!currentItem) { setStatus("Select an item first"); return; }
  var url = getUrl(currentItem);
  if (url) {
    var a = document.createElement("a");
    a.href = url;
    a.download = "instagram_" + Date.now() + (currentTab === "videos" ? ".mp4" : ".jpg");
    a.click();
    setStatus("Download started");
    
    // Track download
    if (window.Analytics) {
      Analytics.trackDownload('single', currentTab === 'videos' ? 'video' : 'image', 1);
    }
  }
});

document.getElementById("download-all")?.addEventListener("click", function() {
  var items = getCurrentItems();
  if (items.length === 0) { setStatus("No items"); return; }
  
  // Track download all
  if (window.Analytics) {
    Analytics.trackDownload('all', currentTab === 'videos' ? 'video' : 'image', items.length);
  }
  
  setStatus("Downloading " + items.length + " files...");
  var i = 0;
  
  function next() {
    if (i >= items.length) { setStatus("Done!"); setProgress(100); return; }
    var url = getUrl(items[i]);
    if (url) {
      var a = document.createElement("a");
      a.href = url;
      a.download = "instagram_" + Date.now() + "_" + i + (currentTab === "videos" ? ".mp4" : ".jpg");
      a.click();
    }
    i++;
    setProgress((i / items.length) * 100);
    setTimeout(next, 300);
  }
  next();
});

document.getElementById("copy")?.addEventListener("click", function() {
  var urls = getCurrentItems().map(getUrl).filter(Boolean);
  navigator.clipboard.writeText(urls.join("\n")).then(function() {
    setStatus("Copied " + urls.length + " URLs");
    
    // Track copy
    if (window.Analytics) {
      Analytics.trackButtonClick('copy_urls', 'gallery');
      Analytics.trackFeature('copy_urls', { count: urls.length, type: currentTab });
    }
  });
});

document.getElementById("export")?.addEventListener("click", function() {
  var urls = getCurrentItems().map(getUrl).filter(Boolean);
  var blob = new Blob([urls.join("\n")], { type: "text/plain" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "instagram-" + currentTab + ".txt";
  a.click();
  setStatus("Exported " + urls.length + " URLs");
  
  // Track export
  if (window.Analytics) {
    Analytics.trackButtonClick('export_urls', 'gallery');
    Analytics.trackFeature('export_urls', { count: urls.length, type: currentTab });
  }
});

document.getElementById("clear")?.addEventListener("click", function() {
  // Track before clearing
  if (window.Analytics) {
    Analytics.trackButtonClick('clear_all', 'gallery');
    Analytics.trackFeature('clear_data', { 
      images_cleared: allMedia.images.length, 
      videos_cleared: allMedia.videos.length 
    });
  }
  
  allMedia.images = [];
  allMedia.videos = [];
  
  chrome.storage.local.set({
    igExporterData: { images: [], videos: [], carousels: [] },
    imageUrls: [],
    videoUrls: []
  }, function() {
    updateCounts();
    renderGrid();
    setStatus("Cleared all data");
    logDebug("Data cleared");
  });
});

document.getElementById("import")?.addEventListener("click", function() {
  document.getElementById("file-input")?.click();
});

document.getElementById("file-input")?.addEventListener("change", function() {
  var file = this.files[0];
  if (!file) return;
  
  var reader = new FileReader();
  reader.onload = function() {
    var urls = reader.result.split(/\r?\n/).filter(function(l) { return l.trim(); });
    var items = urls.map(function(url) {
      return { type: currentTab === 'images' ? 'image' : 'video', url: url, thumbnail: url };
    });
    
    if (currentTab === "images") {
      allMedia.images = items;
    } else {
      allMedia.videos = items;
    }
    
    chrome.storage.local.set({
      igExporterData: { images: allMedia.images, videos: allMedia.videos, carousels: [] }
    });
    
    updateCounts();
    renderGrid();
    setStatus("Imported " + urls.length + " items");
  };
  reader.readAsText(file);
});

document.getElementById("donate")?.addEventListener("click", function() {
  window.open("https://www.patreon.com/join/THYProduction", "_blank");
});

document.getElementById("refresh")?.addEventListener("click", function() {
  setStatus("Refreshing...");
  loadData();
  setStatus("Refreshed!");
  
  if (window.Analytics) {
    Analytics.trackButtonClick('refresh', 'gallery');
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  
  logDebug("Storage changed: " + Object.keys(changes).join(", "));
  
  if (changes.igExporterData && changes.igExporterData.newValue) {
    allMedia.images = changes.igExporterData.newValue.images || [];
    allMedia.videos = changes.igExporterData.newValue.videos || [];
    updateCounts();
    renderGrid();
  }
});

// Set version
if (versionEl) {
  try {
    versionEl.textContent = "v" + chrome.runtime.getManifest().version;
  } catch (e) {}
}

// Initialize
loadData();

// Reload data when tab becomes visible (user switches back to gallery)
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    logDebug("Tab visible - reloading data...");
    loadData();
  }
});

// Also reload when window gains focus
window.addEventListener('focus', function() {
  logDebug("Window focused - reloading data...");
  loadData();
});

// Track page view
if (window.Analytics) {
  Analytics.trackPageView('gallery', 'Instagram Media Gallery');
}
