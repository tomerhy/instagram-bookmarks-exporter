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
var allMedia = { images: [], videos: [] };
var currentViewUrl = null;
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

function normalizeUrl(url) {
  try {
    var parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch (e) {
    return url.split("?")[0];
  }
}

function deduplicateUrls(urls) {
  var seen = {};
  var result = [];
  for (var i = 0; i < urls.length; i++) {
    var key = normalizeUrl(urls[i]);
    if (!seen[key]) {
      seen[key] = true;
      result.push(urls[i]);
    }
  }
  return result;
}

function showVideo(url) {
  viewerPlaceholder.style.display = "none";
  imageViewer.style.display = "none";
  player.style.display = "block";
  fullscreenBtn.style.display = "none";
  
  logDebug("Playing video: " + url.substring(0, 80) + "...");
  
  player.src = url;
  player.load();
  
  player.onloadeddata = function() {
    logDebug("Video loaded successfully");
    player.play().catch(function(e) {
      logDebug("Play error: " + e.message);
    });
  };
  
  player.onerror = function() {
    logDebug("Video error - trying to open in new tab");
    setStatus("Video can't play here. Click to open in new tab.");
  };
  
  player.onclick = function() {
    window.open(url, "_blank");
  };
  
  currentViewUrl = url;
  currentViewType = "video";
}

function showImage(url) {
  viewerPlaceholder.style.display = "none";
  player.style.display = "none";
  player.pause();
  imageViewer.style.display = "block";
  fullscreenBtn.style.display = "flex";
  imageViewer.src = url;
  currentViewUrl = url;
  currentViewType = "image";
}

function hideViewer() {
  viewerPlaceholder.style.display = "flex";
  player.style.display = "none";
  imageViewer.style.display = "none";
  fullscreenBtn.style.display = "none";
  player.pause();
  player.src = "";
  imageViewer.src = "";
  currentViewUrl = null;
  currentViewType = null;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setProgress(value) {
  progressBar.style.width = Math.max(0, Math.min(100, value)) + "%";
}

function getFilename(url, type) {
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
  var images = deduplicateUrls(allMedia.images);
  var videos = deduplicateUrls(allMedia.videos);
  imageCountEl.textContent = images.length;
  videoCountEl.textContent = videos.length;
  
  // Log first video URL for debugging
  if (videos.length > 0) {
    logDebug("First video URL: " + videos[0].substring(0, 100));
  }
}

function getCurrentUrls() {
  if (currentTab === "images") {
    return deduplicateUrls(allMedia.images);
  } else {
    return deduplicateUrls(allMedia.videos);
  }
}

function getTotalPages() {
  var urls = getCurrentUrls();
  return Math.ceil(urls.length / ITEMS_PER_PAGE);
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
  
  var allUrls = getCurrentUrls();
  var totalPages = getTotalPages();
  
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (currentTab === "images") {
    slideshowControls.classList.add("visible");
  } else {
    slideshowControls.classList.remove("visible");
  }

  if (allUrls.length === 0) {
    var empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No " + currentTab + " captured yet</h3><p>Scroll through Instagram to capture media.</p>";
    grid.appendChild(empty);
    hideViewer();
    renderPagination();
    return;
  }

  var startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  var endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allUrls.length);
  var pageUrls = allUrls.slice(startIndex, endIndex);

  pageUrls.forEach(function(url, index) {
    var globalIndex = startIndex + index;
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-index", globalIndex);

    var thumb;
    if (currentTab === "videos") {
      // For videos, try to show a poster or first frame
      thumb = document.createElement("video");
      thumb.className = "thumb";
      thumb.src = url;
      thumb.muted = true;
      thumb.preload = "metadata";
      thumb.playsInline = true;
      thumb.addEventListener("loadedmetadata", function() {
        try { this.currentTime = 1; } catch(e) {}
      });
      
      // Add video badge
      var badge = document.createElement("div");
      badge.className = "video-badge";
      badge.textContent = "▶ Video";
      card.appendChild(badge);
    } else {
      thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.src = url;
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
      downloadFile(url, getFilename(url, currentTab === "videos" ? "video" : "image"));
      setStatus("Download started!");
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
        showVideo(url);
      } else {
        showImage(url);
      }
    };

    grid.appendChild(card);

    if (index === 0 && !currentViewUrl) {
      card.click();
    }
  });

  renderPagination();
}

// Fullscreen functionality
function updateFsCounter() {
  var urls = getCurrentUrls();
  fullscreenCounter.textContent = (fullscreenIndex + 1) + " / " + urls.length;
}

function openFullscreen() {
  if (currentViewType !== "image" || !currentViewUrl) return;
  
  var urls = getCurrentUrls();
  fullscreenIndex = slideshowIndex;
  fullscreenImage.src = urls[fullscreenIndex];
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
  var urls = getCurrentUrls();
  fullscreenIndex--;
  if (fullscreenIndex < 0) fullscreenIndex = urls.length - 1;
  fullscreenImage.src = urls[fullscreenIndex];
  updateFsCounter();
}

function fullscreenNextFn() {
  var urls = getCurrentUrls();
  fullscreenIndex++;
  if (fullscreenIndex >= urls.length) fullscreenIndex = 0;
  fullscreenImage.src = urls[fullscreenIndex];
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
  
  var urls = getCurrentUrls();
  if (urls.length === 0) return;
  
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
    if (slideshowIndex >= urls.length) slideshowIndex = 0;
    
    var targetPage = Math.floor(slideshowIndex / ITEMS_PER_PAGE) + 1;
    if (targetPage !== currentPage) {
      currentPage = targetPage;
      renderGrid();
    }
    
    showImage(urls[slideshowIndex]);
    
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

function loadUrls() {
  chrome.storage.local.get({ imageUrls: [], videoUrls: [] }, function(data) {
    allMedia.images = data.imageUrls || [];
    allMedia.videos = data.videoUrls || [];
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
    currentViewUrl = null;
    stopSlideshow();
    hideViewer();
    renderGrid();
    scrollToTop();
  };
});

downloadCurrentBtn.onclick = function() {
  if (!currentViewUrl) { setStatus("Select an item first."); return; }
  downloadFile(currentViewUrl, getFilename(currentViewUrl, currentViewType));
  setStatus("Download started!");
};

downloadAllBtn.onclick = function() {
  var urls = getCurrentUrls();
  if (urls.length === 0) { setStatus("No media."); return; }
  setStatus("Downloading " + urls.length + " files...");
  var i = 0;
  var next = function() {
    if (i >= urls.length) { setStatus("Complete!"); setProgress(100); return; }
    downloadFile(urls[i], getFilename(urls[i], currentTab === "videos" ? "video" : "image"));
    i++;
    setProgress((i / urls.length) * 100);
    setTimeout(next, 500);
  };
  next();
};

copyBtn.onclick = function() {
  navigator.clipboard.writeText(getCurrentUrls().join("\n")).then(function() { setStatus("Copied!"); });
};

exportBtn.onclick = function() {
  var blob = new Blob([getCurrentUrls().join("\n")], { type: "text/plain" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "instagram-" + currentTab + ".txt";
  link.click();
  setStatus("Exported!");
};

importBtn.onclick = function() { fileInput.click(); };

fileInput.onchange = function() {
  var file = fileInput.files && fileInput.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    var urls = String(reader.result).split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (currentTab === "images") {
      allMedia.images = urls;
      chrome.storage.local.set({ imageUrls: urls });
    } else {
      allMedia.videos = urls;
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
  if (currentTab === "images") {
    allMedia.images = [];
    chrome.storage.local.set({ imageUrls: [] });
  } else {
    allMedia.videos = [];
    chrome.storage.local.set({ videoUrls: [] });
  }
  currentPage = 1;
  updateCounts();
  renderGrid();
  setStatus("Cleared");
};

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") return;
  if (changes.imageUrls) allMedia.images = changes.imageUrls.newValue || [];
  if (changes.videoUrls) allMedia.videos = changes.videoUrls.newValue || [];
  updateCounts();
  if (!slideshowInterval) renderGrid();
});

loadUrls();
setVersion();
