var grid = document.getElementById("grid");
var player = document.getElementById("player");
var imageViewer = document.getElementById("image-viewer");
var viewerPlaceholder = document.getElementById("viewer-placeholder");
var copyBtn = document.getElementById("copy");
var clearBtn = document.getElementById("clear");
var exportBtn = document.getElementById("export");
var importBtn = document.getElementById("import");
var donateBtn = document.getElementById("donate");
var downloadAllBtn = document.getElementById("download-all");
var downloadCurrentBtn = document.getElementById("download-current");
var statusEl = document.getElementById("status");
var progressBar = document.getElementById("progress-bar");
var fileInput = document.getElementById("file-input");
var versionEl = document.getElementById("version");
var tabs = document.querySelectorAll(".tab");
var imageCountEl = document.getElementById("image-count");
var videoCountEl = document.getElementById("video-count");
var paginationEl = document.getElementById("pagination");
var slideshowControls = document.getElementById("slideshow-controls");
var stopSlideshowBtn = document.getElementById("stop-slideshow");
var fullscreenBtn = document.getElementById("fullscreen-btn");
var fullscreenOverlay = document.getElementById("fullscreen-overlay");
var fullscreenImage = document.getElementById("fullscreen-image");
var fullscreenClose = document.getElementById("fullscreen-close");
var fullscreenPrev = document.getElementById("fullscreen-prev");
var fullscreenNext = document.getElementById("fullscreen-next");
var fullscreenCounter = document.getElementById("fullscreen-counter");
var fsSlide3 = document.getElementById("fs-slide-3");
var fsSlide5 = document.getElementById("fs-slide-5");
var fsSlideStop = document.getElementById("fs-slide-stop");
var debugSection = document.getElementById("debug-section");
var toggleDebug = document.getElementById("toggle-debug");

var ITEMS_PER_PAGE = 100;

var currentTab = "images";
var currentPage = 1;
// Now stores arrays of media objects: { url, thumbnail, postUrl, username, caption, ... }
var allMedia = { images: [], videos: [] };
var currentViewItem = null;  // Current selected media object
var currentViewType = null;
var selectedCard = null;
var slideshowInterval = null;
var slideshowIndex = 0;
var fullscreenIndex = 0;
var fsSlideInterval = null;

// Debug toggle
toggleDebug.onclick = function() {
  debugSection.classList.toggle("visible");
  toggleDebug.textContent = debugSection.classList.contains("visible") ? "Hide Debug" : "Show Debug";
};

function logDebug(msg) {
  debugSection.innerHTML = msg + "<br>" + debugSection.innerHTML;
  if (debugSection.innerHTML.length > 5000) {
    debugSection.innerHTML = debugSection.innerHTML.substring(0, 5000);
  }
}

// Helper to get URL from item (handles both string URLs and objects)
function getItemUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.imageUrl || item.videoUrl || item.postUrl || null;
}

// Helper to get the actual media URL (not post URL) - for playback
function getMediaUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.url || item.imageUrl || item.videoUrl || null;
}

// Helper to get thumbnail from item
function getItemThumbnail(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.thumbnail || item.url || item.imageUrl || null;
}

// Helper to get post URL from item
function getItemPostUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return null;
  return item.postUrl || null;
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    var parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch (e) {
    return url.split("?")[0];
  }
}

function deduplicateItems(items) {
  var seen = {};
  var result = [];
  for (var i = 0; i < items.length; i++) {
    var url = getItemUrl(items[i]);
    if (!url) continue;
    var key = normalizeUrl(url);
    if (!seen[key]) {
      seen[key] = true;
      result.push(items[i]);
    }
  }
  return result;
}

function showVideo(item) {
  var mediaUrl = getMediaUrl(item);  // Direct video URL (may be null)
  var postUrl = getItemPostUrl(item);  // Instagram post URL (fallback)
  var displayUrl = mediaUrl || postUrl;
  
  if (!displayUrl) {
    logDebug("No URL available for video");
    return;
  }
  
  viewerPlaceholder.style.display = "none";
  imageViewer.style.display = "none";
  fullscreenBtn.style.display = "none";
  
  logDebug("Playing video: " + displayUrl.substring(0, 80) + "...");
  
  // Check if we have a direct video file URL
  var isVideoFile = mediaUrl && (
    mediaUrl.indexOf(".mp4") !== -1 || 
    mediaUrl.indexOf("/v/") !== -1 ||
    (mediaUrl.indexOf("video") !== -1 && 
    (mediaUrl.indexOf("fbcdn") !== -1 || mediaUrl.indexOf("cdninstagram") !== -1)));
  
  if (!isVideoFile) {
    // No direct video URL - show link to Instagram
    player.style.display = "none";
    viewerPlaceholder.style.display = "flex";
    viewerPlaceholder.innerHTML = '<div style="text-align:center;padding:40px;"><p style="margin-bottom:20px;">Direct video URL not captured</p><a href="' + (postUrl || displayUrl) + '" target="_blank" style="color:#E1306C;text-decoration:underline;">Open on Instagram →</a></div>';
    setStatus("Click link to view on Instagram");
  } else {
    // Try to play the video
    player.style.display = "block";
    player.src = mediaUrl;
    player.load();
    
    player.onloadeddata = function() {
      logDebug("Video loaded successfully");
      player.play().catch(function(e) {
        logDebug("Play error: " + e.message);
      });
    };
    
    player.onerror = function() {
      logDebug("Video error - showing fallback");
      setStatus("Video can't play here. Click to open.");
      player.style.display = "none";
      viewerPlaceholder.style.display = "flex";
      viewerPlaceholder.innerHTML = '<div style="text-align:center;padding:40px;"><p style="margin-bottom:20px;">Video failed to load</p><a href="' + (postUrl || mediaUrl) + '" target="_blank" style="color:#E1306C;text-decoration:underline;">Open in new tab →</a></div>';
    };
    
    player.onclick = function() {
      window.open(mediaUrl, "_blank");
    };
  }
  
  currentViewItem = item;
  currentViewType = "video";
}

function showImage(item) {
  var url = getItemUrl(item);
  if (!url) return;
  
  viewerPlaceholder.style.display = "none";
  player.style.display = "none";
  player.pause();
  imageViewer.style.display = "block";
  fullscreenBtn.style.display = "flex";
  imageViewer.src = url;
  currentViewItem = item;
  currentViewType = "image";
}

function hideViewer() {
  viewerPlaceholder.style.display = "flex";
  viewerPlaceholder.innerHTML = "Select an item to preview";
  player.style.display = "none";
  imageViewer.style.display = "none";
  fullscreenBtn.style.display = "none";
  player.pause();
  player.src = "";
  imageViewer.src = "";
  currentViewItem = null;
  currentViewType = null;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setProgress(value) {
  progressBar.style.width = Math.max(0, Math.min(100, value)) + "%";
}

function getFilename(item, type) {
  // Try to use filename from metadata
  if (item && typeof item === 'object' && item.filename) {
    var ext = type === "video" ? ".mp4" : ".jpg";
    return item.filename + ext;
  }
  var ext = type === "video" ? ".mp4" : ".jpg";
  var ts = Date.now();
  var r = Math.random().toString(36).substring(2, 8);
  return "instagram_" + ts + "_" + r + ext;
}

function downloadFile(url, filename) {
  var link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateCounts() {
  var images = deduplicateItems(allMedia.images);
  var videos = deduplicateItems(allMedia.videos);
  imageCountEl.textContent = images.length;
  videoCountEl.textContent = videos.length;
  
  // Log first video for debugging
  if (videos.length > 0) {
    var firstUrl = getItemUrl(videos[0]);
    logDebug("First video URL: " + (firstUrl ? firstUrl.substring(0, 100) : 'none'));
  }
}

function getCurrentItems() {
  if (currentTab === "images") {
    return deduplicateItems(allMedia.images);
  } else {
    return deduplicateItems(allMedia.videos);
  }
}

function getTotalPages() {
  var items = getCurrentItems();
  return Math.ceil(items.length / ITEMS_PER_PAGE);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPagination() {
  paginationEl.innerHTML = "";
  var totalPages = getTotalPages();
  
  if (totalPages <= 1) return;

  var prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.textContent = "←";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = function() {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
      scrollToTop();
    }
  };
  paginationEl.appendChild(prevBtn);

  var maxVisible = 5;
  var startPage = Math.max(1, currentPage - 2);
  var endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (var i = startPage; i <= endPage; i++) {
    (function(page) {
      var pageBtn = document.createElement("button");
      pageBtn.className = "page-btn" + (page === currentPage ? " active" : "");
      pageBtn.textContent = page;
      pageBtn.onclick = function() {
        currentPage = page;
        renderGrid();
        scrollToTop();
      };
      paginationEl.appendChild(pageBtn);
    })(i);
  }

  var nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.textContent = "→";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = function() {
    if (currentPage < totalPages) {
      currentPage++;
      renderGrid();
      scrollToTop();
    }
  };
  paginationEl.appendChild(nextBtn);

  var info = document.createElement("span");
  info.className = "page-info";
  info.textContent = currentPage + "/" + totalPages;
  paginationEl.appendChild(info);
}

function renderGrid() {
  grid.innerHTML = "";
  stopSlideshow();
  
  var allItems = getCurrentItems();
  var totalPages = getTotalPages();
  
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (currentTab === "images") {
    slideshowControls.classList.add("visible");
  } else {
    slideshowControls.classList.remove("visible");
  }

  if (allItems.length === 0) {
    var empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No " + currentTab + " captured yet</h3><p>Scroll through Instagram to capture media.</p>";
    grid.appendChild(empty);
    hideViewer();
    renderPagination();
    return;
  }

  var startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  var endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allItems.length);
  var pageItems = allItems.slice(startIndex, endIndex);

  pageItems.forEach(function(item, index) {
    var globalIndex = startIndex + index;
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", globalIndex);
    
    var url = getItemUrl(item);
    var thumbnailUrl = getItemThumbnail(item);

    var thumb;
    if (currentTab === "videos") {
      // For videos, prefer using the thumbnail image
      if (thumbnailUrl && thumbnailUrl !== url) {
        // Use thumbnail image for video
        thumb = document.createElement("img");
        thumb.className = "thumb";
        thumb.src = thumbnailUrl;
        thumb.loading = "lazy";
        thumb.onerror = function() {
          // Fallback to video element
          this.outerHTML = '<div class="thumb video-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1a1a2e;"><span style="font-size:40px;">▶</span><span style="font-size:10px;margin-top:8px;color:#888;">Video</span></div>';
        };
      } else {
        // Check if this is a playable video URL
        var isVideoFile = url && (url.indexOf(".mp4") !== -1 || 
                          url.indexOf("/v/") !== -1 ||
                          (url.indexOf("video") !== -1 && 
                           (url.indexOf("fbcdn") !== -1 || url.indexOf("cdninstagram") !== -1)));
        
        if (isVideoFile) {
          // Try to load video thumbnail
          thumb = document.createElement("video");
          thumb.className = "thumb";
          thumb.src = url;
          thumb.muted = true;
          thumb.preload = "metadata";
          thumb.playsInline = true;
          thumb.addEventListener("loadedmetadata", function() {
            try { this.currentTime = 1; } catch(e) {}
          });
          thumb.onerror = function() {
            this.outerHTML = '<div class="thumb video-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1a1a2e;"><span style="font-size:40px;">▶</span><span style="font-size:10px;margin-top:8px;color:#888;">Video</span></div>';
          };
        } else {
          // Show placeholder
          thumb = document.createElement("div");
          thumb.className = "thumb video-placeholder";
          thumb.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1a1a2e;"><span style="font-size:40px;">▶</span><span style="font-size:10px;margin-top:8px;color:#888;">Click to open</span></div>';
        }
      }
      
      // Add video badge
      var badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = "▶ Video";
      card.appendChild(badge);
    } else {
      // Image
      thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.src = url || thumbnailUrl;
      thumb.loading = "lazy";
      thumb.onerror = function() {
        this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
      };
    }
    card.appendChild(thumb);

    var overlay = document.createElement("div");
    overlay.className = "card-overlay";
    var dlBtn = document.createElement("button");
    dlBtn.className = "download-btn";
    dlBtn.innerHTML = "⬇";
    dlBtn.onclick = function(e) {
      e.stopPropagation();
      var dlUrl = getItemUrl(item);
      if (dlUrl) {
        downloadFile(dlUrl, getFilename(item, currentTab === "videos" ? "video" : "image"));
        setStatus("Download started!");
      }
    };
    overlay.appendChild(dlBtn);
    card.appendChild(overlay);

    card.onclick = function() {
      if (selectedCard) selectedCard.classList.remove("selected");
      card.classList.add("selected");
      selectedCard = card;
      slideshowIndex = globalIndex;
      fullscreenIndex = globalIndex;

      if (currentTab === "videos") {
        showVideo(item);
      } else {
        showImage(item);
      }
    };

    grid.appendChild(card);

    if (index === 0 && !currentViewItem) {
      card.click();
    }
  });

  renderPagination();
}

// Fullscreen functionality
function updateFsCounter() {
  var items = getCurrentItems();
  fullscreenCounter.textContent = (fullscreenIndex + 1) + " / " + items.length;
}

function openFullscreen() {
  if (currentViewType !== "image" || !currentViewItem) return;
  
  var items = getCurrentItems();
  fullscreenIndex = slideshowIndex;
  fullscreenImage.src = getItemUrl(items[fullscreenIndex]);
  fullscreenOverlay.classList.add("visible");
  document.body.style.overflow = "hidden";
  updateFsCounter();
}

function closeFullscreen() {
  fullscreenOverlay.classList.remove("visible");
  document.body.style.overflow = "";
  stopFsSlideshow();
}

function fullscreenPrevFn() {
  var items = getCurrentItems();
  fullscreenIndex--;
  if (fullscreenIndex < 0) fullscreenIndex = items.length - 1;
  fullscreenImage.src = getItemUrl(items[fullscreenIndex]);
  updateFsCounter();
}

function fullscreenNextFn() {
  var items = getCurrentItems();
  fullscreenIndex++;
  if (fullscreenIndex >= items.length) fullscreenIndex = 0;
  fullscreenImage.src = getItemUrl(items[fullscreenIndex]);
  updateFsCounter();
}

// Fullscreen slideshow
function startFsSlideshow(interval) {
  stopFsSlideshow();
  
  fsSlide3.classList.remove("active");
  fsSlide5.classList.remove("active");
  if (interval === 3000) fsSlide3.classList.add("active");
  if (interval === 5000) fsSlide5.classList.add("active");
  fsSlideStop.style.display = "inline-block";
  
  fsSlideInterval = setInterval(fullscreenNextFn, interval);
}

function stopFsSlideshow() {
  if (fsSlideInterval) {
    clearInterval(fsSlideInterval);
    fsSlideInterval = null;
  }
  fsSlide3.classList.remove("active");
  fsSlide5.classList.remove("active");
  fsSlideStop.style.display = "none";
}

fullscreenBtn.onclick = openFullscreen;
imageViewer.onclick = openFullscreen;
fullscreenClose.onclick = closeFullscreen;
fullscreenPrev.onclick = fullscreenPrevFn;
fullscreenNext.onclick = fullscreenNextFn;
fsSlide3.onclick = function() { startFsSlideshow(3000); };
fsSlide5.onclick = function() { startFsSlideshow(5000); };
fsSlideStop.onclick = stopFsSlideshow;

fullscreenOverlay.onclick = function(e) {
  if (e.target === fullscreenOverlay) closeFullscreen();
};

document.addEventListener("keydown", function(e) {
  if (!fullscreenOverlay.classList.contains("visible")) return;
  if (e.key === "Escape") closeFullscreen();
  else if (e.key === "ArrowLeft") fullscreenPrevFn();
  else if (e.key === "ArrowRight") fullscreenNextFn();
});

// Regular slideshow
function startSlideshow(interval) {
  stopSlideshow();
  
  var items = getCurrentItems();
  if (items.length === 0) return;
  
  var btns = slideshowControls.querySelectorAll(".slideshow-btn");
  btns.forEach(function(btn) {
    if (btn.getAttribute("data-interval") === String(interval)) {
      btn.classList.add("active");
    } else if (btn.id !== "stop-slideshow") {
      btn.classList.remove("active");
    }
  });
  
  stopSlideshowBtn.style.display = "inline-block";
  setStatus("Slideshow: " + (interval / 1000) + "s");
  
  slideshowInterval = setInterval(function() {
    slideshowIndex++;
    if (slideshowIndex >= items.length) slideshowIndex = 0;
    
    var targetPage = Math.floor(slideshowIndex / ITEMS_PER_PAGE) + 1;
    if (targetPage !== currentPage) {
      currentPage = targetPage;
      renderGrid();
    }
    
    showImage(items[slideshowIndex]);
    
    var cards = grid.querySelectorAll(".card");
    cards.forEach(function(card) {
      var idx = parseInt(card.getAttribute("data-index"));
      if (idx === slideshowIndex) {
        if (selectedCard) selectedCard.classList.remove("selected");
        card.classList.add("selected");
        selectedCard = card;
      }
    });
  }, interval);
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  var btns = slideshowControls.querySelectorAll(".slideshow-btn");
  btns.forEach(function(btn) { btn.classList.remove("active"); });
  stopSlideshowBtn.style.display = "none";
}

slideshowControls.querySelectorAll(".slideshow-btn[data-interval]").forEach(function(btn) {
  btn.onclick = function() {
    startSlideshow(parseInt(btn.getAttribute("data-interval")));
  };
});
stopSlideshowBtn.onclick = function() { stopSlideshow(); setStatus("Stopped"); };

// Convert legacy URL string to item object
function urlToItem(url, type) {
  return {
    type: type,
    url: url,
    thumbnail: type === 'video' ? null : url
  };
}

function loadUrls() {
  chrome.storage.local.get({ imageUrls: [], videoUrls: [], igExporterData: null }, function(data) {
    logDebug('Loading data from storage...');
    
    // Prefer rich data format (igExporterData)
    if (data.igExporterData) {
      var richImages = data.igExporterData.images || [];
      var richVideos = data.igExporterData.videos || [];
      
      logDebug('Rich data: ' + richImages.length + ' images, ' + richVideos.length + ' videos');
      
      // Use rich data if available
      if (richImages.length > 0 || richVideos.length > 0) {
        allMedia.images = richImages;
        allMedia.videos = richVideos;
        updateCounts();
        renderGrid();
        return;
      }
    }
    
    // Fallback to legacy URL arrays
    var legacyImages = data.imageUrls || [];
    var legacyVideos = data.videoUrls || [];
    
    logDebug('Legacy data: ' + legacyImages.length + ' images, ' + legacyVideos.length + ' videos');
    
    // Convert legacy URLs to item objects
    allMedia.images = legacyImages.map(function(url) {
      if (typeof url === 'string') {
        return urlToItem(url, 'image');
      }
      return url;
    });
    
    allMedia.videos = legacyVideos.map(function(url) {
      if (typeof url === 'string') {
        return urlToItem(url, 'video');
      }
      return url;
    });
    
    updateCounts();
    renderGrid();
  });
}

function setVersion() {
  var manifest = chrome.runtime.getManifest();
  versionEl.textContent = "v" + manifest.version;
}

tabs.forEach(function(tab) {
  tab.onclick = function() {
    tabs.forEach(function(t) { t.classList.remove("active"); });
    tab.classList.add("active");
    currentTab = tab.getAttribute("data-tab");
    currentPage = 1;
    selectedCard = null;
    currentViewItem = null;
    stopSlideshow();
    hideViewer();
    renderGrid();
    scrollToTop();
  };
});

downloadCurrentBtn.onclick = function() {
  if (!currentViewItem) { setStatus("Select an item first."); return; }
  var url = getMediaUrl(currentViewItem);
  if (url) {
    downloadFile(url, getFilename(currentViewItem, currentViewType));
    setStatus("Download started!");
  } else {
    // Fallback: open Instagram post
    var postUrl = getItemPostUrl(currentViewItem);
    if (postUrl) {
      window.open(postUrl, "_blank");
      setStatus("Opening Instagram...");
    } else {
      setStatus("No URL available");
    }
  }
};

downloadAllBtn.onclick = function() {
  var items = getCurrentItems();
  if (items.length === 0) { setStatus("No media."); return; }
  
  // Filter items that have downloadable URLs
  var downloadableItems = items.filter(function(item) {
    return getMediaUrl(item) !== null;
  });
  
  if (downloadableItems.length === 0) {
    setStatus("No downloadable URLs. Try scrolling Instagram to capture more.");
    return;
  }
  
  setStatus("Downloading " + downloadableItems.length + " files...");
  var i = 0;
  var next = function() {
    if (i >= downloadableItems.length) { setStatus("Complete!"); setProgress(100); return; }
    var url = getMediaUrl(downloadableItems[i]);
    if (url) {
      downloadFile(url, getFilename(downloadableItems[i], currentTab === "videos" ? "video" : "image"));
    }
    i++;
    setProgress((i / downloadableItems.length) * 100);
    setTimeout(next, 500);
  };
  next();
};

copyBtn.onclick = function() {
  var urls = getCurrentItems().map(function(item) {
    return getMediaUrl(item) || getItemPostUrl(item);
  }).filter(Boolean);
  navigator.clipboard.writeText(urls.join("\n")).then(function() { setStatus("Copied " + urls.length + " URLs!"); });
};

exportBtn.onclick = function() {
  var urls = getCurrentItems().map(function(item) {
    return getMediaUrl(item) || getItemPostUrl(item);
  }).filter(Boolean);
  var blob = new Blob([urls.join("\n")], { type: "text/plain" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "instagram-" + currentTab + ".txt";
  link.click();
  setStatus("Exported " + urls.length + " URLs!");
};

importBtn.onclick = function() { fileInput.click(); };

fileInput.onchange = function() {
  var file = fileInput.files && fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    var urls = String(reader.result).split(/\r?\n/).filter(function(l) { return l.trim(); });
    var items = urls.map(function(url) {
      return urlToItem(url, currentTab === 'images' ? 'image' : 'video');
    });
    
    if (currentTab === "images") {
      allMedia.images = items;
      chrome.storage.local.set({ imageUrls: urls });
    } else {
      allMedia.videos = items;
      chrome.storage.local.set({ videoUrls: urls });
    }
    currentPage = 1;
    updateCounts();
    renderGrid();
    setStatus("Imported " + urls.length);
  };
  reader.readAsText(file);
};

donateBtn.onclick = function() { window.open("https://www.patreon.com/join/THYProduction", "_blank"); };

clearBtn.onclick = function() {
  // Clear ALL data (both images and videos)
  allMedia.images = [];
  allMedia.videos = [];
  
  // Clear both legacy and new formats
  chrome.storage.local.set({ 
    imageUrls: [], 
    videoUrls: [], 
    igExporterData: { images: [], videos: [], carousels: [] } 
  });
  
  currentPage = 1;
  updateCounts();
  renderGrid();
  setStatus("Cleared all data");
};

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  
  // Handle rich data changes
  if (changes.igExporterData) {
    var newData = changes.igExporterData.newValue;
    if (newData) {
      allMedia.images = newData.images || [];
      allMedia.videos = newData.videos || [];
      updateCounts();
      if (!slideshowInterval) renderGrid();
      return;
    }
  }
  
  // Handle legacy URL changes
  if (changes.imageUrls) {
    var urls = changes.imageUrls.newValue || [];
    allMedia.images = urls.map(function(url) {
      return typeof url === 'string' ? urlToItem(url, 'image') : url;
    });
  }
  if (changes.videoUrls) {
    var urls = changes.videoUrls.newValue || [];
    allMedia.videos = urls.map(function(url) {
      return typeof url === 'string' ? urlToItem(url, 'video') : url;
    });
  }
  
  updateCounts();
  if (!slideshowInterval) renderGrid();
});

loadUrls();
setVersion();
