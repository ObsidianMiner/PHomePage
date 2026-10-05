const dock = document.getElementById("dock-inner");

const excludedKeys = ["W", "D", "T", "N", "O", "S", "F", "G", "C", "A", "V", "X", "Z"]; // Chrome reserved shortcuts
const shortcutMap = {}; // { key: action }
const shiftShortcutMap = {}; // { key: action for Shift+Ctrl }

function openLink(url, options = {}) {
  const params = new URLSearchParams();

  if (options.app) {
    params.set("app", options.app);
    if (options.args) params.set("args", options.args);

    window.location.href = `phome://${params.toString()}`;
    return;
  }

  if (options.browser || options.profile) {
    params.set("url", url);

    if (options.browser) params.set("browser", options.browser);
    if (options.profile) params.set("profile", options.profile);

    window.location.href = `phome://${params.toString()}`;
  } else {
    window.location.href = url;
  }
}


// hover color
function adjustColor(color) {
    // Convert hex to RGB
    let r = parseInt(color.substr(1,2),16);
    let g = parseInt(color.substr(3,2),16);
    let b = parseInt(color.substr(5,2),16);

    // Slightly desaturate: move toward gray by 20%
    r = Math.round(r + (30 - r) * 0.8);
    g = Math.round(g + (30 - g) * 0.8);
    b = Math.round(b + (30 - b) * 0.8);

    // Clamp
    r = Math.min(255, Math.max(0,r));
    g = Math.min(255, Math.max(0,g));
    b = Math.min(255, Math.max(0,b));
    
    return `rgb(${r},${g},${b})`;
}
const columns = [];
const NUM_COLUMNS = 9;

// init columns
for (let i = 0; i < NUM_COLUMNS; i++) {
  const col = document.createElement("div");
  col.className = "dock-column";
  dock.appendChild(col);
  columns.push({
    el: col,
    height: 0
  });
}

function buildDock()
{
  // Try loading saved links
  let savedGroups;
  try {
    savedGroups = JSON.parse(localStorage.getItem("linksConfig"));
  } catch(e) {
    savedGroups = null;
    console.warn("Could not load saved groups.");
  }

  const activeGroups = savedGroups || window.groups;
  window.activeGroups = activeGroups;

  // then use activeGroups instead of groups
  const sortedGroups = [...activeGroups].sort((a, b) => b.links.length - a.links.length);

  sortedGroups.forEach(group => {
    if (group.name === "Not On Dock") return;
    const groupEl = document.createElement("div");
    groupEl.className = "group";

    const title = document.createElement("h3");
    title.textContent = group.name;
    groupEl.appendChild(title);

    group.links.forEach(link => {
      const name = link[0];
      const url = link[1];
      const third = link[2];
      const options = link[4] || {};
      const opts = options;

      const a = document.createElement("a");
      a.className = "link";
      a.href = opts.app ? "#" : url;

      let favicon = "assets/app.png";

      if (!opts.app && url) {
        try {
          const domain = new URL(url).hostname;
          favicon = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
        } catch {}
      }

      let keyBind = null;
      let shiftKeyBind = null;
      let color = null;

      if (third) {
        if (/^[a-zA-Z]$/.test(third)) keyBind = third.toUpperCase();
        else color = third;
      }

      if (!keyBind) {
        const firstLetter = name[0].toUpperCase();
        if (!excludedKeys.includes(firstLetter)) {
          if (!shortcutMap[firstLetter]) {
            keyBind = firstLetter;
            shortcutMap[keyBind] = () => openLink(opts.app ? null : url, opts);
          } else if (!shiftShortcutMap[firstLetter]) {
            shiftKeyBind = firstLetter;
            shiftShortcutMap[shiftKeyBind] = () => openLink(url, opts);
          }
        }
      } else {
        shiftShortcutMap[shiftKeyBind] = () => openLink(opts.app ? null : url, opts);
      }

      a.innerHTML = `
        <img src="${favicon}">
        <span>${name}</span>
        ${keyBind || shiftKeyBind ? `<img src="assets/Shortcut.png" class="shortcut-icon">` : ""}
      `;

      a.onclick = (e) => {
        e.preventDefault();

        if (opts.app) {
          openLink(null, opts);
        } else {
          openLink(url, opts);
        }
      };

      if (color) {
        const hoverColor = adjustColor(color);
        a.style.setProperty('--hover-color', hoverColor);

        a.addEventListener("mouseover", () => {
          a.style.border = `1px solid ${color}`;
        });
        a.addEventListener("mouseout", () => {
          a.style.border = "none";
        });
      }

      groupEl.appendChild(a);
    });

    //place into shortest column
    let shortest = columns[0];
    for (const col of columns) {
      if (col.height < shortest.height) shortest = col;
    }

    shortest.el.appendChild(groupEl);
    shortest.height += group.links.length + 1; // +1 for title
  });

  document.addEventListener("keydown", e => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      const key = e.key.toUpperCase();
      if (shortcutMap[key]) {
        e.preventDefault();
        shortcutMap[key]();
      }
    }
  });
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      const key = e.key.toUpperCase();
      if (shiftShortcutMap[key]) {
        e.preventDefault();
        shiftShortcutMap[key]();
      }
    }
  });
  window.openLink = openLink;
  window.shortcutMap = shortcutMap;
  window.shiftShortcutMap = shiftShortcutMap;
  window.buildDock = buildDock;
}

try {
  buildDock();
} catch (e) {
  console.error(e);
  showErrorToast?.("Dock failed to load: " + e.message);
}