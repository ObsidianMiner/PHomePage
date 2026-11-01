// ======================
// SHARED STATE
// Loaded early — consumed by sync.js, dock.js, search.js, and settings.js
// ======================

// linksConfig is the authoritative in-memory link list.
// Settings mutates it directly; sync reads it on push.
window.getLinksConfig = function() {
  try {
    const saved = localStorage.getItem("linksConfig");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn("Could not load saved linksConfig:", e);
  }
  return window.groups;
};

window.linksConfig = structuredClone(window.getLinksConfig());

// Set to true whenever the user edits links without saving.
// Checked by the unload auto-push to decide whether a push is needed.
window.hasUnsavedEdits = false;

// Tracks whether a push has occurred this session.
// Set to true after any successful push.
window.hasPushedThisSession = false;


// ======================
// SHARED HELPERS
// ======================

window.saveLinksConfig = function() {
  localStorage.setItem("linksConfig", JSON.stringify(window.linksConfig));
  localStorage.setItem("lastSaved", Date.now().toString());
};


// ======================
// GALLERY CONFIG
// Lives here so gallery.js can call getEnabledImages() before settings.js loads.
// ======================

window.galleryConfig = JSON.parse(localStorage.getItem("galleryConfig") || "{}");

window.saveGalleryConfig = function() {
  localStorage.setItem("galleryConfig", JSON.stringify(window.galleryConfig));
};

window.getEnabledImages = function() {
  const result = [];
  Object.entries(GALLERY_STRUCTURE).forEach(([folder, images]) => {
    if (!(window.galleryConfig[folder]?.enabled ?? true)) return;
    images.forEach(img => {
      if (window.galleryConfig[folder]?.images?.[img] ?? true) result.push(img);
    });
  });
  return result;
};

window.normalizeUrl = function(url) {
  if (!url) return url;
  const t = url.trim();
  if (!t || t.startsWith("http://") || t.startsWith("https://") || t.startsWith("phome://")) return t;
  return "https://" + t;
};


// ======================
// SEARCH CONFIG
// ======================

window.SEARCH_ENGINES = {
  google:     { name: "Google",     url: "https://www.google.com/search?q=%s" },
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
  perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/search?q=%s" },
  brave:      { name: "Brave",      url: "https://search.brave.com/search?q=%s" },
  claude:     { name: "Claude",     url: "https://claude.ai/new?q=%s" },
  kagi:       { name: "Kagi",       url: "https://kagi.com/search?q=%s" },
};

const DEFAULT_SEARCH_CONFIG = {
  engine: "google",
  customEngineUrl: "https://www.google.com/search?q=%s",
  mathEval: true,
  maxLinkSuggestions: 5,
  enableApps: true
};

window.getSearchConfig = function() {
  try {
    const saved = localStorage.getItem("searchConfig");
    if (saved) {
      return { ...DEFAULT_SEARCH_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn("Could not load searchConfig:", e);
  }
  return { ...DEFAULT_SEARCH_CONFIG };
};

window.saveSearchConfig = function(cfg) {
  try {
    localStorage.setItem("searchConfig", JSON.stringify(cfg));
  } catch (e) {
    console.warn("Could not save searchConfig:", e);
  }
};