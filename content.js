(function() {
  if (window.__instagramSavedExporterInjected) return;
  window.__instagramSavedExporterInjected = true;

  console.log("[IG] v3.1 Content script loaded on:", location.href);

  var captured = {};
  var stats = { images: 0, videos: 0 };

  function send(type, url) {
    if (!url || typeof url !== "string" || url.length < 30) return;
    if (url.indexOf("blob:") === 0) return;
    if (url.indexOf("data:") === 0) return;
    if (url.indexOf("static.cdninstagram.com") !== -1) return;
    
    // Skip very small images (profile pics, icons)
    if (url.indexOf("/s150x150/") !== -1) return;
    if (url.indexOf("/s44x44/") !== -1) return;
    if (url.indexOf("/s64x64/") !== -1) return;
    if (url.indexOf("/s88x88/") !== -1) return;
    if (url.indexOf("/s100x100/") !== -1) return;
    if (url.indexOf("/s132x132/") !== -1) return;
    if (url.indexOf("/s320x320/") !== -1) return;
    
    // Skip profile pics pattern
    if (url.indexOf("t51.2885-19") !== -1) return;
    
    var key = url.split("?")[0];
    if (captured[key]) return;
    captured[key] = true;
    
    if (type === "IMAGE_URL") stats.images++;
    if (type === "VIDEO_URL") stats.videos++;
    
    console.log("[IG] CAPTURED " + type + " #" + (type === "IMAGE_URL" ? stats.images : stats.videos) + ":", url.substring(0, 100));
    
    try {
      chrome.runtime.sendMessage({ type: type, url: url });
    } catch (e) {
      console.log("[IG] Send error:", e.message);
    }
  }

  function isMediaUrl(url) {
    if (!url) return false;
    // Instagram CDN patterns
    if (url.indexOf("instagram") !== -1) return true;
    if (url.indexOf("cdninstagram") !== -1) return true;
    if (url.indexOf("fbcdn") !== -1) return true;
    if (url.indexOf("scontent") !== -1) return true;
    return false;
  }

  function isVideoUrl(url) {
    if (!url) return false;
    if (url.indexOf(".mp4") !== -1) return true;
    if (url.indexOf("video") !== -1 && isMediaUrl(url)) return true;
    return false;
  }

  function scanDOM() {
    // Scan all images
    var imgs = document.querySelectorAll("img");
    console.log("[IG] Scanning", imgs.length, "images");
    
    imgs.forEach(function(img) {
      var src = img.src || "";
      var srcset = img.srcset || "";
      
      // Try srcset first for best quality
      if (srcset && isMediaUrl(srcset)) {
        var parts = srcset.split(",");
        var bestUrl = "";
        var bestW = 0;
        parts.forEach(function(part) {
          var match = part.trim().match(/^(\S+)\s+(\d+)w$/);
          if (match) {
            var w = parseInt(match[2]);
            if (w > bestW) {
              bestW = w;
              bestUrl = match[1];
            }
          }
        });
        if (bestUrl) {
          send("IMAGE_URL", bestUrl);
        }
      }
      
      // Also try src
      if (src && isMediaUrl(src)) {
        send("IMAGE_URL", src);
      }
    });

    // Scan all videos
    var videos = document.querySelectorAll("video");
    console.log("[IG] Scanning", videos.length, "videos");
    
    videos.forEach(function(video) {
      var src = video.src || "";
      if (src && isMediaUrl(src)) {
        send("VIDEO_URL", src);
      }
      
      // Check poster for thumbnail
      var poster = video.poster || "";
      if (poster && isMediaUrl(poster)) {
        // Don't save poster as image if this is a video
      }
      
      // Check source elements
      var sources = video.querySelectorAll("source");
      sources.forEach(function(source) {
        var s = source.src || "";
        if (s && isMediaUrl(s)) {
          send("VIDEO_URL", s);
        }
      });
    });
    
    console.log("[IG] Scan complete. Total:", stats.images, "images,", stats.videos, "videos");
  }

  // Process JSON from API
  function processJson(obj, depth) {
    if (!obj || typeof obj !== "object" || depth > 20) return;
    depth = depth || 0;
    
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
        processJson(obj[i], depth + 1);
      }
      return;
    }
    
    var mediaType = obj.media_type;
    var isVideo = mediaType === 2 || obj.is_video === true;
    
    // Video
    if (isVideo || obj.video_versions || obj.video_url) {
      var videoUrl = null;
      if (obj.video_versions && obj.video_versions.length > 0) {
        var best = obj.video_versions[0];
        for (var i = 1; i < obj.video_versions.length; i++) {
          var v = obj.video_versions[i];
          if ((v.width || 0) * (v.height || 0) > (best.width || 0) * (best.height || 0)) {
            best = v;
          }
        }
        videoUrl = best.url;
      }
      if (!videoUrl && obj.video_url) {
        videoUrl = obj.video_url;
      }
      if (videoUrl) {
        send("VIDEO_URL", videoUrl);
      }
    }
    
    // Image (only if not video)
    if (!isVideo && (obj.image_versions2 || obj.display_url)) {
      var imageUrl = null;
      if (obj.image_versions2 && obj.image_versions2.candidates && obj.image_versions2.candidates.length > 0) {
        var best = obj.image_versions2.candidates[0];
        for (var i = 1; i < obj.image_versions2.candidates.length; i++) {
          var c = obj.image_versions2.candidates[i];
          if ((c.width || 0) > (best.width || 0)) {
            best = c;
          }
        }
        imageUrl = best.url;
      }
      if (!imageUrl && obj.display_url) {
        imageUrl = obj.display_url;
      }
      if (imageUrl) {
        send("IMAGE_URL", imageUrl);
      }
    }
    
    // Carousel
    if (obj.carousel_media) {
      for (var i = 0; i < obj.carousel_media.length; i++) {
        processJson(obj.carousel_media[i], depth + 1);
      }
    }
    if (obj.edge_sidecar_to_children && obj.edge_sidecar_to_children.edges) {
      for (var i = 0; i < obj.edge_sidecar_to_children.edges.length; i++) {
        var e = obj.edge_sidecar_to_children.edges[i];
        if (e && e.node) processJson(e.node, depth + 1);
      }
    }
    
    // Recurse into wrappers
    if (obj.items) {
      for (var i = 0; i < obj.items.length; i++) {
        processJson(obj.items[i], depth + 1);
      }
    }
    if (obj.edges) {
      for (var i = 0; i < obj.edges.length; i++) {
        if (obj.edges[i] && obj.edges[i].node) {
          processJson(obj.edges[i].node, depth + 1);
        }
      }
    }
    if (obj.data) processJson(obj.data, depth + 1);
    if (obj.graphql) processJson(obj.graphql, depth + 1);
    if (obj.shortcode_media) processJson(obj.shortcode_media, depth + 1);
    if (obj.xdt_shortcode_media) processJson(obj.xdt_shortcode_media, depth + 1);
    
    for (var key in obj) {
      if (key.indexOf("edge_") === 0 && obj[key] && obj[key].edges) {
        processJson(obj[key], depth + 1);
      }
    }
  }

  function processResponse(text, url) {
    try {
      var json = JSON.parse(text);
      console.log("[IG] Processing API:", url.substring(0, 80));
      processJson(json, 0);
    } catch (e) {}
  }

  function isApiUrl(url) {
    if (!url) return false;
    return url.indexOf("/api/v1/") !== -1 ||
           url.indexOf("/graphql") !== -1 ||
           url.indexOf("i.instagram.com") !== -1;
  }

  // Intercept fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    
    return origFetch.apply(this, arguments).then(function(res) {
      if (res && res.ok && isApiUrl(url)) {
        console.log("[IG] Intercepted fetch:", url.substring(0, 80));
        res.clone().text().then(function(t) { processResponse(t, url); }).catch(function(){});
      }
      return res;
    });
  };

  // Intercept XHR
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(m, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    if (isApiUrl(xhr._url)) {
      console.log("[IG] Intercepted XHR:", (xhr._url || "").substring(0, 80));
      xhr.addEventListener("load", function() {
        try { processResponse(xhr.responseText, xhr._url); } catch(e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // Watch for DOM changes
  var scanTimeout = null;
  var observer = new MutationObserver(function() {
    // Debounce scans
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(function() {
      scanDOM();
      extractPageData();
    }, 500);
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Watch for URL changes (clicking on posts)
  var lastUrl = location.href;
  setInterval(function() {
    if (location.href !== lastUrl) {
      console.log("[IG] URL changed to:", location.href);
      lastUrl = location.href;
      setTimeout(function() {
        scanDOM();
        extractPageData();
      }, 1500);
    }
  }, 500);

  // Extract data from page scripts
  function extractPageData() {
    console.log("[IG] Extracting embedded page data...");
    
    // Look for JSON in script tags
    var scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(function(script, idx) {
      try {
        var text = script.textContent || "";
        var data = JSON.parse(text);
        console.log("[IG] Found JSON script #" + idx);
        processJson(data, 0);
        
        // Also search the raw text for video patterns
        searchTextForVideos(text, "json#" + idx);
      } catch(e) {}
    });
    
    // Scan all inline scripts
    var allScripts = document.querySelectorAll('script:not([src])');
    allScripts.forEach(function(script, idx) {
      var text = script.textContent || "";
      if (text.length > 100) {
        searchTextForVideos(text, "script#" + idx);
      }
    });
  }
  
  function searchTextForVideos(text, source) {
    // Pattern 1: Direct .mp4 URLs
    var mp4Pattern = /https?:\\?\/\\?\/[^"'\s\\]+\.mp4[^"'\s\\]*/g;
    var mp4Matches = text.match(mp4Pattern);
    if (mp4Matches) {
      mp4Matches.forEach(function(url) {
        url = decodeUrl(url);
        if (isMediaUrl(url)) {
          console.log("[IG] Found .mp4 in " + source + ":", url.substring(0, 60));
          send("VIDEO_URL", url);
        }
      });
    }
    
    // Pattern 2: "video_url":"..."
    var vuPattern = /"video_url"\s*:\s*"([^"]+)"/g;
    var match;
    while ((match = vuPattern.exec(text)) !== null) {
      var url = decodeUrl(match[1]);
      if (url && url.length > 30) {
        console.log("[IG] Found video_url in " + source + ":", url.substring(0, 60));
        send("VIDEO_URL", url);
      }
    }
    
    // Pattern 3: video_versions array with url
    var vvPattern = /"url"\s*:\s*"(https?:[^"]+)"/g;
    while ((match = vvPattern.exec(text)) !== null) {
      var url = decodeUrl(match[1]);
      if (url && (url.indexOf(".mp4") !== -1 || url.indexOf("/video") !== -1)) {
        console.log("[IG] Found video version URL in " + source + ":", url.substring(0, 60));
        send("VIDEO_URL", url);
      }
    }
  }
  
  function decodeUrl(url) {
    if (!url) return "";
    return url
      .replace(/\\u002F/g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\/g, "");
  }

  // Initial scan
  setTimeout(function() {
    console.log("[IG] Running initial scan...");
    scanDOM();
    extractPageData();
  }, 2000);

  // Periodic scan
  setInterval(function() {
    scanDOM();
  }, 5000);
  
  // Also extract page data periodically (less frequently)
  setInterval(function() {
    extractPageData();
  }, 10000);

  // Auto scroll
  var scrolling = false;
  var scrollTimer = null;

  function toast(msg) {
    var t = document.getElementById("ig-exp-toast");
    if (t) t.remove();
    t = document.createElement("div");
    t.id = "ig-exp-toast";
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:linear-gradient(135deg,#833ab4,#E1306C);color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,0.4);";
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 4000);
  }

  function startScroll() {
    if (scrolling) return;
    scrolling = true;
    toast("Scrolling... capturing media");
    
    var lastH = 0, stable = 0;
    scrollTimer = setInterval(function() {
      if (!scrolling) return;
      window.scrollTo(0, document.body.scrollHeight);
      scanDOM();
      
      if (document.body.scrollHeight === lastH) {
        stable++;
        if (stable >= 8) {
          stopScroll();
          toast("Done! " + stats.images + " images, " + stats.videos + " videos");
        }
      } else {
        stable = 0;
        lastH = document.body.scrollHeight;
      }
    }, 1500);
  }

  function stopScroll() {
    scrolling = false;
    if (scrollTimer) {
      clearInterval(scrollTimer);
      scrollTimer = null;
    }
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.type === "PING_CONTENT") sendResponse({ ok: true });
    if (msg.type === "START_AUTO_SCROLL") startScroll();
    if (msg.type === "STOP_AUTO_SCROLL") stopScroll();
    if (msg.type === "GET_AUTO_SCROLL_STATUS") sendResponse({ running: scrolling });
    if (msg.type === "GET_POST_COUNT") sendResponse({ count: document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length });
  });

  console.log("[IG] v3.1 Ready and watching");
})();
