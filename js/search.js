const search      = document.getElementById("searchBar");
const suggestions = document.getElementById("searchSuggestions");

const allLinks = window.groups.flatMap(g =>
  g.links.map(([name, url, , , options]) => ({ name, url, options }))
);

let selectedIndex = -1;
let currentItems  = [];


// ======================
// NAVIGATION
// ======================

function navigate(url, shiftHeld = false) {
  if (shiftHeld) window.open(url, "_blank");
  else window.location.href = url;
}


// ======================
// BUILD SUGGESTIONS
// ======================

async function buildSuggestions(q) {
  suggestions.innerHTML = "";
  selectedIndex = -1;
  currentItems  = [];

  if (!q) return;

  // --- Math result (first slot if detected) ---
  if (window.looksLikeMath?.(q)) {
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

  // --- Link matches ---
  const matches = allLinks
    .filter(l => l.name.toLowerCase().includes(q))
    .slice(0, 5);

  matches.forEach(m => {
    let title = "Open " + m.name;
    if (shortcutMap[m.name[0]?.toUpperCase()])      title += ` (Ctrl+${m.name[0].toUpperCase()})`;
    if (shiftShortcutMap[m.name[0]?.toUpperCase()]) title += ` (Shift+Ctrl+${m.name[0].toUpperCase()})`;

    currentItems.push({
      label:  title,
      action: (shiftHeld = false) => openLink(m.url, m.options)
    });
  });

  // --- Google fallback ---
  currentItems.push({
    label:  `Search Google for "${q}"`,
    action: (shiftHeld = false) => navigate(`https://www.google.com/search?q=${encodeURIComponent(q)}`, shiftHeld)
  });

  // Render non-math items (math item already appended above)
  currentItems.slice(currentItems[0]?.isMath ? 1 : 0).forEach(item => {
    const div = document.createElement("div");
    div.className   = "suggestion";
    div.textContent = item.label;
    div.onclick     = (e) => item.action(e.shiftKey);
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