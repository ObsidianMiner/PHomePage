// ======================
// SHARED STATE
// Loaded early — consumed by sync.js, dock.js, search.js, and settings.js
// ======================

// linksConfig is the authoritative in-memory link list.
// Settings mutates it directly; sync reads it on push.
window.linksConfig = structuredClone(
  JSON.parse(localStorage.getItem("linksConfig") || JSON.stringify(groups))
);

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