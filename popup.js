var autoScrollBtn = document.getElementById("auto-scroll");
var openGalleryBtn = document.getElementById("open-gallery");
var donateBtn = document.getElementById("donate");
var copyBtn = document.getElementById("copy");
var clearBtn = document.getElementById("clear");
var mediaCount = document.getElementById("media-count");
var statusEl = document.getElementById("status");
var versionEl = document.getElementById("version");

var isScrolling = false;

function setStatus(message) {
  statusEl.textContent = message || "";
}

function withActiveTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs && tabs[0];
    if (tab && tab.id) {
      cb(tab);
    }
  });
}

function updateScrollButton(running) {
  isScrolling = running;
  if (running) {
    autoScrollBtn.textContent = "Stop Auto Scroll";
    autoScrollBtn.classList.add("running");
  } else {
    autoScrollBtn.textContent = "Start Auto Scroll";
    autoScrollBtn.classList.remove("running");
  }
}

function setVersion() {
  var manifest = chrome.runtime.getManifest();
  versionEl.textContent = "v" + manifest.version;
}

function ensureContentScript(tabId, cb) {
  chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT" }, function() {
    if (!chrome.runtime.lastError) {
      cb(true);
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    }, function() {
      cb(!chrome.runtime.lastError);
    });
  });
}

function updateMediaCount() {
  chrome.storage.local.get({ imageUrls: [], videoUrls: [] }, function(data) {
    var images = Array.isArray(data.imageUrls) ? data.imageUrls.length : 0;
    var videos = Array.isArray(data.videoUrls) ? data.videoUrls.length : 0;
    mediaCount.textContent = "Images: " + images + " | Videos: " + videos;
  });
}

function syncAutoScrollStatus() {
  withActiveTab(function(tab) {
    ensureContentScript(tab.id, function(ok) {
      if (!ok) return;
      chrome.tabs.sendMessage(tab.id, { type: "GET_AUTO_SCROLL_STATUS" }, function(res) {
        if (chrome.runtime.lastError) return;
        updateScrollButton(res && res.running);
      });
    });
  });
}

function toggleScroll() {
  setStatus("");
  withActiveTab(function(tab) {
    if (!tab.url || tab.url.indexOf("instagram.com") === -1) {
      setStatus("Open Instagram first.");
      return;
    }
    
    ensureContentScript(tab.id, function(ok) {
      if (!ok) {
        setStatus("Cannot connect. Reload page.");
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, { type: "GET_AUTO_SCROLL_STATUS" }, function(res) {
        if (chrome.runtime.lastError) {
          setStatus("Cannot connect. Reload page.");
          return;
        }
        
        var running = res && res.running;
        
        if (running) {
          chrome.tabs.sendMessage(tab.id, { type: "STOP_AUTO_SCROLL" });
          updateScrollButton(false);
        } else {
          chrome.tabs.sendMessage(tab.id, { type: "START_AUTO_SCROLL" });
          updateScrollButton(true);
        }
      });
    });
  });
}

autoScrollBtn.onclick = toggleScroll;

openGalleryBtn.onclick = function() {
  chrome.tabs.create({ url: chrome.runtime.getURL("gallery.html") });
};

donateBtn.onclick = function() {
  chrome.tabs.create({ url: "https://www.patreon.com/join/THYProduction" });
};

copyBtn.onclick = function() {
  chrome.storage.local.get({ imageUrls: [], videoUrls: [] }, function(data) {
    var all = (data.imageUrls || []).concat(data.videoUrls || []);
    navigator.clipboard.writeText(all.join("\n")).then(function() {
      setStatus("Copied!");
    });
  });
};

clearBtn.onclick = function() {
  chrome.runtime.sendMessage({ type: "CLEAR_URLS" });
  mediaCount.textContent = "Images: 0 | Videos: 0";
  setStatus("Cleared!");
};

syncAutoScrollStatus();
updateMediaCount();
setInterval(updateMediaCount, 2000);
setVersion();
