// ======================
// STATE
// ======================

const settingsBtn    = document.getElementById("settingsBtn");
const settingsWindow = document.getElementById("settingsWindow");

const gallerySettingsEl = document.querySelector("#gallerySettings .tab-inner-container");
const linkEditorEl      = document.querySelector("#linkEditor .tab-inner-container");
const backupsContainer  = document.getElementById("backupsContainer");
const syncContainer     = document.getElementById("syncContainer");

let galleryConfig = JSON.parse(localStorage.getItem("galleryConfig") || "{}");
let linksConfig   = structuredClone(
  JSON.parse(localStorage.getItem("linksConfig") || JSON.stringify(groups))
);

let openCategories  = {};
let hasUnsavedEdits = false;

const MAX_BACKUPS = 10;


// ======================
// STORAGE HELPERS
// ======================

function saveGalleryConfig() {
  localStorage.setItem("galleryConfig", JSON.stringify(galleryConfig));
}

function saveLinksConfig() {
  localStorage.setItem("linksConfig", JSON.stringify(linksConfig));
}

function normalizeUrl(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("phome://")) return trimmed;
  return "https://" + trimmed;
}


// ======================
// BACKUPS
// ======================

function saveBackup() {
  const backups = JSON.parse(localStorage.getItem("backups") || "[]");

  backups.unshift({
    timestamp: Date.now(),
    links: structuredClone(linksConfig),
    notes: localStorage.getItem("notes") || ""
  });

  // keep only the most recent MAX_BACKUPS
  if (backups.length > MAX_BACKUPS) backups.length = MAX_BACKUPS;

  localStorage.setItem("backups", JSON.stringify(backups));
}

function buildBackupsTab() {
  backupsContainer.innerHTML = "<h2>Backups</h2>";

  const backups = JSON.parse(localStorage.getItem("backups") || "[]");

  if (!backups.length) {
    const empty = document.createElement("p");
    empty.textContent = "No backups yet. Backups are created each time you save links.";
    empty.style.color = "var(--muted)";
    backupsContainer.appendChild(empty);
    return;
  }

  backups.forEach((backup, i) => {
    const row = createDiv("settings-item");
    row.style.justifyContent = "space-between";

    const label = document.createElement("span");
    const date  = new Date(backup.timestamp);
    label.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} — ${backup.links.length} categories, ${backup.links.reduce((n, c) => n + c.links.length, 0)} links`;

    const btns = createDiv();
    btns.style.display = "flex";
    btns.style.gap = "6px";

    btns.appendChild(createButton("Restore Links", () => {
      if (!confirm("Restore links from this backup? Unsaved changes will be lost.")) return;
      localStorage.setItem("linksConfig", JSON.stringify(backup.links));
      location.reload();
    }));

    btns.appendChild(createButton("Restore Notes", () => {
      if (!confirm("Restore notes from this backup? Current notes will be overwritten.")) return;
      localStorage.setItem("notes", backup.notes);
      document.getElementById("scratchpad").value = backup.notes;
    }));

    btns.appendChild(createButton("✕", () => {
      const all = JSON.parse(localStorage.getItem("backups") || "[]");
      all.splice(i, 1);
      localStorage.setItem("backups", JSON.stringify(all));
      buildBackupsTab();
    }));

    row.appendChild(label);
    row.appendChild(btns);
    backupsContainer.appendChild(row);
  });
}


// ======================
// UI HELPERS
// ======================

function createDiv(className) {
  const el = document.createElement("div");
  if (className) el.className = className;
  return el;
}

function createInput(placeholder, width) {
  const input = document.createElement("input");
  input.placeholder = placeholder;
  if (width) input.style.width = width;
  return input;
}

function createButton(text, onClick) {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function createEditableCell(text) {
  const cell = document.createElement("div");
  cell.contentEditable = "true";
  cell.textContent = text || "";
  return cell;
}


// ======================
// SETTINGS WINDOW
// ======================

function initSettingsWindow() {
  settingsBtn.onclick = () => settingsWindow.classList.remove("hidden");

  settingsWindow.onclick = (e) => {
    if (e.target === settingsWindow) settingsWindow.classList.add("hidden");
  };
}


// ======================
// TABS
// ======================

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById(btn.dataset.tab).classList.remove("hidden");

      if (btn.dataset.tab === "backupsTab") buildBackupsTab();
      if (btn.dataset.tab === "syncTab")    buildSyncTab();
    };
  });
}


// ======================
// GALLERY SETTINGS
// ======================

function buildGallerySettings() {
  gallerySettingsEl.innerHTML = "<h2>Gallery</h2>";

  Object.entries(GALLERY_STRUCTURE).forEach(([folder, images]) => {
    const folderDiv       = createDiv("folder");
    const header          = createFolderHeader(folder);
    const imagesContainer = createImagesContainer(folder, images);
    const arrow           = header.querySelector("span");

    header.onclick = () => {
      const isOpen = imagesContainer.style.display === "block";
      imagesContainer.style.display = isOpen ? "none" : "block";
      arrow.textContent = isOpen ? "▼ " : "▲ ";
    };

    folderDiv.appendChild(header);
    folderDiv.appendChild(imagesContainer);
    gallerySettingsEl.appendChild(folderDiv);
  });
}

function createFolderHeader(folder) {
  const header = createDiv("folder-header");

  const arrow = document.createElement("span");
  arrow.textContent = "▼ ";

  const toggle = document.createElement("input");
  toggle.type    = "checkbox";
  toggle.checked = galleryConfig[folder]?.enabled ?? true;
  toggle.onchange = () => {
    galleryConfig[folder] = galleryConfig[folder] || {};
    galleryConfig[folder].enabled = toggle.checked;
    saveGalleryConfig();
  };

  const label = document.createElement("span");
  label.textContent = folder;

  header.appendChild(arrow);
  header.appendChild(toggle);
  header.appendChild(label);
  return header;
}

function createImagesContainer(folder, images) {
  const container = createDiv();
  container.style.display    = "none";
  container.style.marginLeft = "15px";

  images.forEach(img => {
    const row = createDiv("settings-item");

    const toggle = document.createElement("input");
    toggle.type    = "checkbox";
    toggle.checked = galleryConfig[folder]?.images?.[img] ?? true;
    toggle.onchange = () => {
      galleryConfig[folder] = galleryConfig[folder] || {};
      galleryConfig[folder].images = galleryConfig[folder].images || {};
      galleryConfig[folder].images[img] = toggle.checked;
      saveGalleryConfig();
    };

    const label = document.createElement("label");
    label.textContent = img.split("/").pop();

    row.appendChild(toggle);
    row.appendChild(label);
    container.appendChild(row);
  });

  return container;
}


// ======================
// GALLERY UTIL
// ======================

function getEnabledImages() {
  const result = [];

  Object.entries(GALLERY_STRUCTURE).forEach(([folder, images]) => {
    if (!(galleryConfig[folder]?.enabled ?? true)) return;

    images.forEach(img => {
      if (galleryConfig[folder]?.images?.[img] ?? true) result.push(img);
    });
  });

  return result;
}


// ======================
// LINK EDITOR
// ======================

function buildLinkEditor() {
  linkEditorEl.innerHTML = "<h2>Links</h2>";

  linksConfig.forEach((category, catIdx) => {
    const categoryDiv = createDiv("category-foldout");
    const header      = createCategoryHeader(category.name, catIdx);
    const content     = createCategoryContent(category, catIdx);
    const arrow       = header.querySelector(".category-arrow");

    header.onclick = (e) => {
      // don't toggle when clicking the delete button
      if (e.target.closest(".category-delete")) return;

      const isOpen = content.style.display === "block";
      content.style.display = isOpen ? "none" : "block";
      arrow.textContent = isOpen ? "▼ " : "▲ ";
      openCategories[category.name] = !isOpen;
    };

    categoryDiv.appendChild(header);
    categoryDiv.appendChild(content);
    linkEditorEl.appendChild(categoryDiv);
  });

  linkEditorEl.appendChild(createAddCategoryUI());
}

function createCategoryHeader(name, catIdx) {
  const header = createDiv("folder-header category-header");

  const arrow = document.createElement("span");
  arrow.className   = "category-arrow";
  arrow.textContent = openCategories[name] ? "▲ " : "▼ ";

  const label = document.createElement("span");
  label.textContent = name;
  label.style.flex  = "1";

  const deleteBtn = createButton("✕", () => {
    if (!confirm(`Delete category "${name}" and all its links?`)) return;
    linksConfig.splice(catIdx, 1);
    hasUnsavedEdits = true;
    buildLinkEditor();
  });
  deleteBtn.className = "category-delete";

  header.appendChild(arrow);
  header.appendChild(label);
  header.appendChild(deleteBtn);

  header.ondragover = (e) => e.preventDefault();
  header.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { categoryIndex: fromIdx, linkIndex: fromLinkIdx, link: draggedLink } = JSON.parse(e.dataTransfer.getData("text/plain"));
    linksConfig[fromIdx].links.splice(fromLinkIdx, 1);
    linksConfig[catIdx].links.unshift(draggedLink);

    if (!hasUnsavedEdits) saveLinksConfig();
    buildLinkEditor();
  };

  return header;
}

function createCategoryContent(category, catIdx) {
  const content = createDiv();
  content.style.display    = openCategories[category.name] ? "block" : "none";
  content.style.marginLeft = "15px";

  category.links.forEach((link, linkIdx) => {
    content.appendChild(createLinkRow(link, linkIdx, catIdx, content));
  });

  content.appendChild(createAddLinkUI(category));

  content.ondragover = (e) => e.preventDefault();
  content.ondrop = (e) => {
    e.preventDefault();

    const { categoryIndex: fromIdx, linkIndex: fromLinkIdx, link: draggedLink } = JSON.parse(e.dataTransfer.getData("text/plain"));
    linksConfig[fromIdx].links.splice(fromLinkIdx, 1);
    linksConfig[catIdx].links.push(draggedLink);

    if (!hasUnsavedEdits) saveLinksConfig();
    buildLinkEditor();
  };

  return content;
}


// ======================
// LINK ROW
// ======================

function applyTint(el, color) {
  if (!color || color === "#000000") return;

  const hoverColor = adjustColor(color);
  el.addEventListener("mouseenter", () => {
    el.style.background = hoverColor;
    el.style.border = `1px solid ${color}`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.background = "";
    el.style.border = "";
  });
}

function createLinkRow(link, linkIndex, categoryIndex, parentContent) {
  const [name, url, color, , options = {}] = link;

  const row = createDiv("link-row settings-item");

  // Drag handle
  const dragHandle = createDiv("drag-handle");
  const dragIcon   = document.createElement("img");
  dragIcon.src = "assets/dragable.png";
  dragHandle.appendChild(dragIcon);

  // Name
  const nameCell = createEditableCell(name);
  nameCell.oninput = () => { link[0] = nameCell.textContent.trim(); hasUnsavedEdits = true; };

  // URL — normalize on blur
  const urlCell = createEditableCell(url);
  urlCell.oninput = () => { link[1] = urlCell.textContent.trim(); hasUnsavedEdits = true; };
  urlCell.onblur  = () => {
    const normalized = normalizeUrl(urlCell.textContent.trim());
    if (normalized !== urlCell.textContent.trim()) {
      urlCell.textContent = normalized;
      link[1] = normalized;
      hasUnsavedEdits = true;
    }
  };

  // Color picker
  const colorCell  = document.createElement("div");
  colorCell.className = "color-cell";
  const colorInput = document.createElement("input");
  colorInput.type  = "color";
  colorInput.value = color || "#000000";
  colorInput.oninput = () => { link[2] = colorInput.value; applyTint(row, colorInput.value); hasUnsavedEdits = true; };
  colorCell.appendChild(colorInput);

  // Options (browser/profile or app)
  const settingsCell = createEditableCell(
    options.app
      ? `app: ${options.app}${options.args ? " | " + options.args : ""}`
      : `${options.browser || ""}${options.profile ? " | " + options.profile : ""}`
  );
  settingsCell.oninput = () => {
    const text = settingsCell.textContent.trim();
    link[4] = link[4] || {};
    const opts = link[4];
    delete opts.browser; delete opts.profile; delete opts.app; delete opts.args;

    if (text.startsWith("app:")) {
      const parts = text.replace("app:", "").split("|").map(s => s.trim());
      opts.app = parts[0];
      if (parts[1]) opts.args = parts[1];
    } else {
      const parts = text.split("|").map(s => s.trim());
      if (parts[0]) opts.browser = parts[0];
      if (parts[1]) opts.profile = parts[1];
    }
    hasUnsavedEdits = true;
  };

  // Delete
  const actions = createDiv();
  actions.appendChild(createButton("✕", () => {
    linksConfig[categoryIndex].links.splice(linkIndex, 1);
    hasUnsavedEdits = true;
    parentContent.removeChild(row);
  }));

  row.appendChild(dragHandle);
  row.appendChild(nameCell);
  row.appendChild(urlCell);
  row.appendChild(colorCell);
  row.appendChild(settingsCell);
  row.appendChild(actions);

  enableDragAndDrop(dragHandle, row, link, linkIndex, categoryIndex);
  applyTint(row, color);

  return row;
}


// ======================
// DRAG & DROP
// ======================

function enableDragAndDrop(handle, row, link, linkIndex, categoryIndex) {
  handle.draggable = true;

  handle.ondragstart = (e) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ categoryIndex, linkIndex, link }));
    e.dataTransfer.effectAllowed = "move";
  };

  row.ondragover = (e) => e.preventDefault();

  row.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent bubble to category content's ondrop

    const { categoryIndex: fromIdx, linkIndex: fromLinkIdx, link: draggedLink } = JSON.parse(e.dataTransfer.getData("text/plain"));

    // remove from source
    linksConfig[fromIdx].links.splice(fromLinkIdx, 1);

    // insert before this row's current position
    // linkIndex may have shifted if source and target are in same category and source was before target
    const adjustedIdx = (fromIdx === categoryIndex && fromLinkIdx < linkIndex)
      ? linkIndex - 1
      : linkIndex;
    linksConfig[categoryIndex].links.splice(adjustedIdx, 0, draggedLink);

    if (!hasUnsavedEdits) saveLinksConfig();
    buildLinkEditor();
  };
}


// ======================
// ADD UI
// ======================

function createAddLinkUI(category) {
  const container = createDiv();
  const nameInput = createInput("Name", "120px");
  const urlInput  = createInput("URL", "200px");

  container.appendChild(nameInput);
  container.appendChild(urlInput);
  container.appendChild(createButton("➕", () => {
    if (!nameInput.value || !urlInput.value) return;
    category.links.push([nameInput.value, normalizeUrl(urlInput.value)]);
    hasUnsavedEdits = true;
    buildLinkEditor();
  }));

  return container;
}

function createAddCategoryUI() {
  const container = createDiv();
  const input     = createInput("New category", "150px");

  container.appendChild(input);
  container.appendChild(createButton("Add Category", () => {
    if (!input.value) return;
    linksConfig.push({ name: input.value, links: [] });
    hasUnsavedEdits = true;
    buildLinkEditor();
  }));

  return container;
}


// ======================
// SAVE / REVERT
// ======================

function initSaveButtons() {
  document.getElementById("saveLinksBtn").onclick = () => {
    saveBackup();
    hasUnsavedEdits = false;
    saveLinksConfig();
    location.reload();
  };

  document.getElementById("revertLinksBtn").onclick = () => {
    if (!confirm("Revert all links to the defaults in data.js? This cannot be undone.")) return;
    localStorage.removeItem("linksConfig");
    location.reload();
  };
}


// ======================
// SYNC
// ======================

function getSyncConfig() {
  return JSON.parse(localStorage.getItem("syncConfig") || "{}");
}

function saveSyncConfig(cfg) {
  localStorage.setItem("syncConfig", JSON.stringify(cfg));
}

const RESPONSE_PORT = 19420;

// Trigger a phome:// action and poll localhost for the response.
function phomeRequest(params) {
  const query = new URLSearchParams(params).toString();
  window.location.href = `phome://${query}`;

  // Poll http://127.0.0.1:RESPONSE_PORT until Python's one-shot server responds.
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000; // 5s timeout
    const interval = 150; // poll every 150ms

    function poll() {
      if (Date.now() > deadline) {
        reject(new Error("Sync timed out — is home_helper running?"));
        return;
      }
      fetch(`http://127.0.0.1:${RESPONSE_PORT}`, { cache: "no-store" })
        .then(r => r.json())
        .then(resolve)
        .catch(() => setTimeout(poll, interval));
    }

    setTimeout(poll, 500); // give Python a moment to start the server
  });
}

async function syncPush() {
  const { workerUrl, secret } = getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  const links = encodeURIComponent(JSON.stringify(linksConfig));
  const notes = encodeURIComponent(localStorage.getItem("notes") || "");

  const result = await phomeRequest({
    action: "sync_push",
    worker_url: workerUrl,
    secret,
    links,
    notes
  });

  if (!result.ok) throw new Error(result.error || "Push failed.");
}

async function syncPull() {
  const { workerUrl, secret } = getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  const result = await phomeRequest({
    action: "sync_pull",
    worker_url: workerUrl,
    secret
  });

  if (!result.ok) throw new Error(result.error || "Pull failed.");

  if (result.links) {
    localStorage.setItem("linksConfig", result.links);
  }
  if (result.notes !== undefined) {
    localStorage.setItem("notes", result.notes);
    const pad = document.getElementById("scratchpad");
    if (pad) pad.value = result.notes;
  }
}

function buildSyncTab() {
  syncContainer.innerHTML = "<h2>Sync</h2>";

  const cfg = getSyncConfig();

  // Config fields
  const urlLabel = document.createElement("p");
  urlLabel.textContent = "Worker URL";
  urlLabel.style.margin = "8px 0 2px";

  const urlInput = createInput("https://phome-sync.yourname.workers.dev", "100%");
  urlInput.value = cfg.workerUrl || "";
  urlInput.style.width = "400px";

  const secretLabel = document.createElement("p");
  secretLabel.textContent = "Secret";
  secretLabel.style.margin = "8px 0 2px";

  const secretInput = createInput("your-secret-value", "100%");
  secretInput.type  = "password";
  secretInput.value = cfg.secret || "";
  secretInput.style.width = "400px";

  const saveConfigBtn = createButton("Save Config", () => {
    saveSyncConfig({ workerUrl: urlInput.value.trim(), secret: secretInput.value.trim() });
    statusEl.textContent = "Config saved.";
  });

  // Action buttons
  const btnRow = createDiv();
  btnRow.style.cssText = "display:flex; gap:8px; margin-top:16px;";

  const pushBtn = createButton("⬆ Push to Cloud", async () => {
    statusEl.textContent = "Pushing...";
    try {
      await syncPush();
      statusEl.textContent = `Pushed at ${new Date().toLocaleTimeString()}`;
    } catch(e) {
      statusEl.textContent = "Push failed: " + e.message;
    }
  });

  const pullBtn = createButton("⬇ Pull from Cloud", async () => {
    if (!confirm("Pull will overwrite your local links and notes. Continue?")) return;
    statusEl.textContent = "Pulling...";
    try {
      await syncPull();
      statusEl.textContent = `Pulled at ${new Date().toLocaleTimeString()} — reload to see link changes.`;
    } catch(e) {
      statusEl.textContent = "Pull failed: " + e.message;
    }
  });

  btnRow.appendChild(pushBtn);
  btnRow.appendChild(pullBtn);

  // Status line
  const statusEl = document.createElement("p");
  statusEl.style.cssText = "color: var(--muted); font-size: 12px; margin-top: 10px;";
  statusEl.textContent = "Not synced yet.";

  syncContainer.appendChild(urlLabel);
  syncContainer.appendChild(urlInput);
  syncContainer.appendChild(secretLabel);
  syncContainer.appendChild(secretInput);
  syncContainer.appendChild(saveConfigBtn);
  syncContainer.appendChild(btnRow);
  syncContainer.appendChild(statusEl);
}


// ======================
// INIT
// ======================

function init() {
  initSettingsWindow();
  initTabs();
  initSaveButtons();
  buildGallerySettings();
  buildLinkEditor();
}

init();