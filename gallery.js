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
    if (debugSection.innerHTML.length > 3000) {
      debugSection.innerHTML = debugSection.innerHTML.substring(0, 3000);
    }
  }
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
  logDebug("Counts: " + images + " images, " + videos + " videos");
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
  
  if (imageViewer) imageViewer.style.display = "none";
  
  // Check if we have a playable video URL
  var isPlayable = url && (
    url.indexOf(".mp4") !== -1 || 
    url.indexOf("/v/") !== -1 ||
    url.indexOf("video") !== -1
  );
  
  if (isPlayable) {
    if (viewerPlaceholder) viewerPlaceholder.style.display = "none";
    if (player) {
      player.style.display = "block";
      player.src = url;
      player.load();
      player.play().catch(function(e) {
        logDebug("Play error: " + e.message);
      });
    }
  } else {
    // Show link to Instagram
    if (player) player.style.display = "none";
    if (viewerPlaceholder) {
      viewerPlaceholder.style.display = "flex";
      var linkUrl = postUrl || url || "#";
      viewerPlaceholder.innerHTML = '<div style="text-align:center;padding:30px;">' +
        '<p style="margin-bottom:15px;">Video not captured directly</p>' +
        '<a href="' + linkUrl + '" target="_blank" style="color:#E1306C;">Open on Instagram →</a></div>';
    }
  }
  
  currentItem = item;
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
  logDebug("Loading data from storage...");
  
  chrome.storage.local.get(['igExporterData', 'imageUrls', 'videoUrls'], function(result) {
    logDebug("Storage result: " + JSON.stringify(Object.keys(result)));
    
    // Try rich data first
    if (result.igExporterData) {
      allMedia.images = result.igExporterData.images || [];
      allMedia.videos = result.igExporterData.videos || [];
      logDebug("Loaded rich data: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
    } else {
      // Fallback to legacy
      allMedia.images = (result.imageUrls || []).map(function(url) {
        return { type: 'image', url: url, thumbnail: url };
      });
      allMedia.videos = (result.videoUrls || []).map(function(url) {
        return { type: 'video', url: url };
      });
      logDebug("Loaded legacy data: " + allMedia.images.length + " images, " + allMedia.videos.length + " videos");
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
  }
});

document.getElementById("download-all")?.addEventListener("click", function() {
  var items = getCurrentItems();
  if (items.length === 0) { setStatus("No items"); return; }
  
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
});

document.getElementById("clear")?.addEventListener("click", function() {
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
