const search      = document.getElementById("searchBar");
const suggestions = document.getElementById("searchSuggestions");


let selectedIndex = -1;
let currentItems  = [];


// ======================
// NAVIGATION
// ======================

function navigate(url, shiftHeld = false) {
  if (shiftHeld) window.open(url, "_blank");
  else window.location.href = url;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ======================
// BUILD SUGGESTIONS
// ======================

async function buildSuggestions(q) {
  suggestions.innerHTML = "";
  selectedIndex = -1;
  currentItems  = [];

  if (!q) return;

  const cfg = window.getSearchConfig ? window.getSearchConfig() : {
    engine: "google",
    customEngineUrl: "https://www.google.com/search?q=%s",
    mathEval: true,
    maxLinkSuggestions: 5,
    enableApps: true
  };

  // --- Math result (first slot if detected) ---
  if (cfg.mathEval !== false && window.looksLikeMath?.(q)) {
    const math = await window.getMathResult(q);
    if (math) {
      const mathItem = {
        label:     math.display,
        isMath:    true,
        copyValue: math.result,
        action:    () => {
          navigator.clipboard?.writeText(math.result);
          showToast("Copied to clipboard", false);
        }
      };
      currentItems.push(mathItem);

      const div = document.createElement("div");
      div.className   = "suggestion suggestion-math";
      div.textContent = math.display;
      div.title       = "Click to copy";
      div.onclick     = () => mathItem.action();
      suggestions.appendChild(div);
    }
  }

  // --- Link & App matches (Combined limit, Links first, then Apps) ---
  let savedGroups;
  try {
    savedGroups = JSON.parse(localStorage.getItem("linksConfig"));
  } catch (e) {
    savedGroups = null;
  }
  const activeGroups = savedGroups || window.groups;

  const allLinks = (activeGroups || []).flatMap(g =>
    (g.links || []).map(([name, url, , , options]) => ({ name, url, options }))
  );

  const maxTotal = typeof cfg.maxLinkSuggestions === "number" ? cfg.maxLinkSuggestions : 5;

  // Filter matching links
  const matchingLinks = allLinks.filter(l => l.name.toLowerCase().includes(q));

  // Filter matching apps
  let matchingApps = [];
  if (cfg.enableApps !== false) {
    const localApps = window.LOCAL_APPS || (typeof LOCAL_APPS !== "undefined" ? LOCAL_APPS : []);
    if (Array.isArray(localApps) && localApps.length > 0) {
      matchingApps = localApps.filter(a => a.name && a.name.toLowerCase().includes(q));
      // Prioritize apps that start with the query, then sort alphabetically
      matchingApps.sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });
    }
  }

  // Allocate slots: Links first, then Apps up to combined maxTotal limit.
  // When both links and apps match, ensure at least one app can be shown if slots > 1.
  let linkLimit = maxTotal;
  if (matchingApps.length > 0 && maxTotal > 1) {
    linkLimit = Math.min(matchingLinks.length, maxTotal - 1);
  }
  const selectedLinks = matchingLinks.slice(0, linkLimit);
  const remainingAppSlots = Math.max(0, maxTotal - selectedLinks.length);
  const selectedApps = matchingApps.slice(0, remainingAppSlots);

  const sMap = window.shortcutMap || (typeof shortcutMap !== "undefined" ? shortcutMap : {});
  const ssMap = window.shiftShortcutMap || (typeof shiftShortcutMap !== "undefined" ? shiftShortcutMap : {});
  const doOpenLink = window.openLink || (typeof openLink !== "undefined" ? openLink : (url, opts) => { window.location.href = url; });

  // Add Link suggestions
  selectedLinks.forEach(m => {
    let title = "Open " + m.name;
    const firstLetter = m.name[0]?.toUpperCase();
    if (firstLetter && sMap[firstLetter])   title += ` (Ctrl+${firstLetter})`;
    if (firstLetter && ssMap[firstLetter]) title += ` (Shift+Ctrl+${firstLetter})`;

    currentItems.push({
      label:  title,
      isLink: true,
      action: (shiftHeld = false) => doOpenLink(m.url, m.options)
    });
  });

  // Add App suggestions
  selectedApps.forEach(app => {
    currentItems.push({
      label:   `Launch ${app.name}`,
      appName: app.name,
      isApp:   true,
      action:  () => {
        if (typeof doOpenLink === "function") {
          doOpenLink(null, { app: app.name });
        } else {
          window.location.href = `phome://?app=${encodeURIComponent(app.name)}`;
        }
        search.value = "";
        suggestions.innerHTML = "";
        search.blur();
      }
    });
  });

  // --- Search engine fallback ---
  const engines = window.SEARCH_ENGINES || {
    google:     { name: "Google",     url: "https://www.google.com/search?q=%s" },
    duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
    perplexity: { name: "Perplexity", url: "https://www.perplexity.ai/search?q=%s" },
    brave:      { name: "Brave",      url: "https://search.brave.com/search?q=%s" },
    claude:     { name: "Claude",     url: "https://claude.ai/new?q=%s" },
    kagi:       { name: "Kagi",       url: "https://kagi.com/search?q=%s" },
  };

  let engineLabel = "Google";
  let engineUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  if (engines[cfg.engine]) {
    engineLabel = engines[cfg.engine].name;
    engineUrl = engines[cfg.engine].url.replace(/%s/g, encodeURIComponent(q));
  } else if (cfg.engine === "custom" && cfg.customEngineUrl) {
    engineLabel = "Web";
    if (cfg.customEngineUrl.includes("%s")) {
      engineUrl = cfg.customEngineUrl.replace(/%s/g, encodeURIComponent(q));
    } else {
      engineUrl = cfg.customEngineUrl + encodeURIComponent(q);
    }
  }

  currentItems.push({
    label:  `Search ${engineLabel} for "${q}"`,
    action: (shiftHeld = false) => navigate(engineUrl, shiftHeld)
  });

  // Render non-math items (math item already appended above)
  currentItems.slice(currentItems[0]?.isMath ? 1 : 0).forEach(item => {
    const div = document.createElement("div");
    div.className = "suggestion" + (item.isApp ? " suggestion-app" : "");
    if (item.isApp) {
      div.innerHTML = `
        <span class="suggestion-text">
          <img src="assets/app_2.png" onerror="this.onerror=null;this.src='assets/app.png';" class="suggestion-app-icon" alt="" />
          <span>Launch ${escapeHtml(item.appName)}</span>
        </span>
      `;
    } else {
      div.textContent = item.label;
    }
    div.onclick = (e) => item.action(e.shiftKey);
    suggestions.appendChild(div);
  });
}


// ======================
// INPUT
// ======================

search.addEventListener("input", () => {
  buildSuggestions(search.value.toLowerCase());
});


// ======================
// KEYBOARD
// ======================

search.addEventListener("keydown", e => {
  const items = suggestions.querySelectorAll(".suggestion");

  if (e.key === "ArrowDown") {
    selectedIndex = (selectedIndex + 1) % items.length;
    updateSelection(items);
    e.preventDefault();
    return;
  }

  if (e.key === "ArrowUp") {
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    updateSelection(items);
    e.preventDefault();
    return;
  }

  if (e.key === "Enter") {
    const shift = e.shiftKey;

    if (selectedIndex >= 0 && currentItems[selectedIndex]) {
      currentItems[selectedIndex].action(shift);
    } else {
      // Default: skip math result (index 0 if present), run first actionable item
      const first = currentItems.find(i => !i.isMath);
      if (first) first.action(shift);
    }
  }
});


// ======================
// HIGHLIGHT
// ======================

function updateSelection(items) {
  items.forEach(el => el.classList.remove("active"));
  if (items[selectedIndex]) items[selectedIndex].classList.add("active");
}


// ======================
// FOCUS / BLUR
// ======================

search.addEventListener("focus", () => {
  if (search.value) buildSuggestions(search.value.toLowerCase());
});

search.addEventListener("blur", () => {
  setTimeout(() => { suggestions.innerHTML = ""; }, 100);
});


// ======================
// AUTO FOCUS ON LOAD
// ======================

window.addEventListener("load", () => { search.focus(); });


// ======================
// "/" TO FOCUS
// ======================

document.addEventListener("keydown", e => {
  if (e.key !== "/") return;

  const tag      = document.activeElement?.tagName;
  const isTyping = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;

  if (e.shiftKey) { e.preventDefault(); search.focus(); return; }
  if (isTyping) return;

  e.preventDefault();
  search.focus();
});