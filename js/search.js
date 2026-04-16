const search = document.getElementById("searchBar");
const suggestions = document.getElementById("searchSuggestions");

const allLinks = window.groups.flatMap(g =>
  g.links.map(([name, url, , , options]) => ({ name, url, options }))
);

let selectedIndex = -1;
let currentItems = [];

function navigate(url, shiftHeld = false) {
  
  console.log("Navigating to: " + url + " via search")
  if (shiftHeld) {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}

/* BUILD LIST */
function buildSuggestions(q) {
    suggestions.innerHTML = "";
    selectedIndex = -1;
    currentItems = [];

    if (!q) return;

    const matches = allLinks
        .filter(l => l.name.toLowerCase().includes(q))
        .slice(0, 5);

    currentItems = [];

    matches.forEach(m => {
        let title = "Open " + m.name;
        // attach shortcut if exists
        const key = Object.keys(shortcutMap).find(k => shortcutMap[k] === ((shiftHeld = false) => navigate(m.url, shiftHeld)));
        const shiftKey = Object.keys(shiftShortcutMap).find(k => shiftShortcutMap[k] === ((shiftHeld = false) => navigate(m.url, shiftHeld)));
        if (shortcutMap[m.name[0]?.toUpperCase()]) title += ` (Ctrl+${m.name[0].toUpperCase()})`;
        if (shiftShortcutMap[m.name[0]?.toUpperCase()]) title += ` (Shift+Ctrl+${m.name[0].toUpperCase()})`;

        currentItems.push({
            label: title,
            action: (shiftHeld = false) => openLink(m.url, m.options)
        });
    });

    currentItems.push({
        label: `Search Google for "${q}"`,
        action: (shiftHeld = false) => navigate(`https://www.google.com/search?q=${q}`, shiftHeld)
    });

    currentItems.forEach((item, i) => {
        const div = document.createElement("div");
        div.className = "suggestion";
        div.textContent = item.label;

        div.onclick = (e) => item.action(e.shiftKey);

        suggestions.appendChild(div);
    });
}

/* INPUT */
search.addEventListener("input", () => {
  buildSuggestions(search.value.toLowerCase());
});

/* KEYBOARD */
search.addEventListener("keydown", e => {
  const items = suggestions.querySelectorAll(".suggestion");

  if (e.key === "ArrowDown") {
    selectedIndex = (selectedIndex + 1) % items.length;
    updateSelection(items);
    e.preventDefault();
  }

  if (e.key === "ArrowUp") {
    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
    updateSelection(items);
    e.preventDefault();
  }

  if (e.key === "Enter") {
    const shift = e.shiftKey;

    if (selectedIndex >= 0 && currentItems[selectedIndex]) {
      currentItems[selectedIndex].action(shift);
    } else if (currentItems.length > 0) {
      currentItems[0].action(shift);
    }
  }
});

/* HIGHLIGHT */
function updateSelection(items) {
  items.forEach(el => el.classList.remove("active"));
  if (items[selectedIndex]) {
    items[selectedIndex].classList.add("active");
  }
}

/* FOCUS / BLUR */
search.addEventListener("focus", () => {
  if (search.value) {
    buildSuggestions(search.value.toLowerCase());
  }
});

search.addEventListener("blur", () => {
  setTimeout(() => {
    suggestions.innerHTML = ""; // allow click before closing
  }, 100);
});

/* AUTO FOCUS ON LOAD */
window.addEventListener("load", () => {
  search.focus();
});

/* "/" TO FOCUS */
document.addEventListener("keydown", e => {
  if (e.key !== "/") return;

  const tag = document.activeElement?.tagName;

  const isTyping =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    document.activeElement?.isContentEditable;

  // SHIFT overrides everything
  if (e.shiftKey) {
    e.preventDefault();
    search.focus();
    return;
  }

  // if typing somewhere else → ignore
  if (isTyping) return;

  e.preventDefault();
  search.focus();
});