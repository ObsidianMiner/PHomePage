// ======================
// SETTINGS UI
// Loaded lazily on first gear click.
// Depends on: state.js (linksConfig, hasUnsavedEdits, saveLinksConfig, normalizeUrl)
//             sync.js  (syncPush, syncPull, getSyncConfig, saveSyncConfig)
// ======================

const settingsWindow = document.getElementById("settingsWindow");

const gallerySettingsEl = document.querySelector("#gallerySettings .tab-inner-container");
const linkEditorEl      = document.querySelector("#linkEditor .tab-inner-container");
const backupsContainer  = document.getElementById("backupsContainer");
const syncContainer     = document.getElementById("syncContainer");

let openCategories = {};

const MAX_BACKUPS = 10;


// ======================
// STORAGE HELPERS
// ======================

function saveBackup() {
  const backups = JSON.parse(localStorage.getItem("backups") || "[]");
  backups.unshift({
    timestamp: Date.now(),
    links: structuredClone(window.linksConfig),
    notes: localStorage.getItem("notes") || ""
  });
  if (backups.length > MAX_BACKUPS) backups.length = MAX_BACKUPS;
  localStorage.setItem("backups", JSON.stringify(backups));
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
  toggle.checked = window.galleryConfig[folder]?.enabled ?? true;
  toggle.onchange = () => {
    window.galleryConfig[folder] = window.galleryConfig[folder] || {};
    window.galleryConfig[folder].enabled = toggle.checked;
    window.saveGalleryConfig();
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
    const row    = createDiv("settings-item");
    const toggle = document.createElement("input");
    toggle.type    = "checkbox";
    toggle.checked = window.galleryConfig[folder]?.images?.[img] ?? true;
    toggle.onchange = () => {
      window.galleryConfig[folder] = window.galleryConfig[folder] || {};
      window.galleryConfig[folder].images = window.galleryConfig[folder].images || {};
      window.galleryConfig[folder].images[img] = toggle.checked;
      window.saveGalleryConfig();
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
// LINK EDITOR
// ======================

function buildLinkEditor() {
  linkEditorEl.innerHTML = "<h2>Links</h2>";

  if (!window.linksConfig) {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("linksConfig"));
    } catch(e) {
      saved = null;
    }
    window.linksConfig = structuredClone(saved || window.groups);
  }

  window.linksConfig.forEach((category, catIdx) => {
    const categoryDiv = createDiv("category-foldout");
    const header      = createCategoryHeader(category.name, catIdx);
    const content     = createCategoryContent(category, catIdx);
    const arrow       = header.querySelector(".category-arrow");

    header.onclick = (e) => {
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
    window.linksConfig.splice(catIdx, 1);
    window.hasUnsavedEdits = true;
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
    window.linksConfig[fromIdx].links.splice(fromLinkIdx, 1);
    window.linksConfig[catIdx].links.unshift(draggedLink);

    if (!window.hasUnsavedEdits) window.saveLinksConfig();
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
    window.linksConfig[fromIdx].links.splice(fromLinkIdx, 1);
    window.linksConfig[catIdx].links.push(draggedLink);

    if (!window.hasUnsavedEdits) window.saveLinksConfig();
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
  el.addEventListener("mouseenter", () => { el.style.background = hoverColor; el.style.border = `1px solid ${color}`; });
  el.addEventListener("mouseleave", () => { el.style.background = ""; el.style.border = ""; });
}

function createLinkRow(link, linkIndex, categoryIndex, parentContent) {
  const [name, url, color, , options = {}] = link;
  const row = createDiv("link-row settings-item");

  const dragHandle = createDiv("drag-handle");
  const dragIcon   = document.createElement("img");
  dragIcon.src = "assets/dragable.png";
  dragHandle.appendChild(dragIcon);

  const nameCell = createEditableCell(name);
  nameCell.oninput = () => { link[0] = nameCell.textContent.trim(); window.hasUnsavedEdits = true; };

  const urlCell = createEditableCell(url);
  urlCell.oninput = () => { link[1] = urlCell.textContent.trim(); window.hasUnsavedEdits = true; };
  urlCell.onblur  = () => {
    const normalized = window.normalizeUrl(urlCell.textContent.trim());
    if (normalized !== urlCell.textContent.trim()) {
      urlCell.textContent = normalized;
      link[1] = normalized;
      window.hasUnsavedEdits = true;
    }
  };

  const colorCell  = document.createElement("div");
  colorCell.className = "color-cell";
  const colorInput = document.createElement("input");
  colorInput.type  = "color";
  colorInput.value = color || "#000000";
  colorInput.oninput = () => { link[2] = colorInput.value; applyTint(row, colorInput.value); window.hasUnsavedEdits = true; };
  colorCell.appendChild(colorInput);

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
    window.hasUnsavedEdits = true;
  };

  const actions = createDiv();
  actions.appendChild(createButton("✕", () => {
    window.linksConfig[categoryIndex].links.splice(linkIndex, 1);
    window.hasUnsavedEdits = true;
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
    e.stopPropagation();

    const { categoryIndex: fromIdx, linkIndex: fromLinkIdx, link: draggedLink } = JSON.parse(e.dataTransfer.getData("text/plain"));
    window.linksConfig[fromIdx].links.splice(fromLinkIdx, 1);

    const adjustedIdx = (fromIdx === categoryIndex && fromLinkIdx < linkIndex)
      ? linkIndex - 1 : linkIndex;
    window.linksConfig[categoryIndex].links.splice(adjustedIdx, 0, draggedLink);

    if (!window.hasUnsavedEdits) window.saveLinksConfig();
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
    category.links.push([nameInput.value, window.normalizeUrl(urlInput.value)]);
    window.hasUnsavedEdits = true;
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
    window.linksConfig.push({ name: input.value, links: [] });
    window.hasUnsavedEdits = true;
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
    window.hasUnsavedEdits = false;
    window.hasPushedThisSession = false; // ensure next unload triggers push
    window.saveLinksConfig();
    location.reload();
  };

  document.getElementById("revertLinksBtn").onclick = () => {
    if (!confirm("Revert all links to the defaults in data.js? This cannot be undone.")) return;
    localStorage.removeItem("linksConfig");
    location.reload();
  };
}


// ======================
// BACKUPS TAB
// ======================

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
    btns.style.cssText = "display:flex; gap:6px;";

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
// SYNC TAB
// ======================

function buildSyncTab() {
  syncContainer.innerHTML = "<h2>Sync</h2>";
  const cfg = window.getSyncConfig();

  const make = (tag, text, style) => {
    const el = document.createElement(tag);
    if (text)  el.textContent = text;
    if (style) el.style.cssText = style;
    return el;
  };

  const urlLabel    = make("p", "Worker URL", "margin: 8px 0 2px");
  const urlInput    = createInput("https://phome-sync.yourname.workers.dev");
  urlInput.value    = cfg.workerUrl || "";
  urlInput.style.width = "400px";

  const secretLabel    = make("p", "Secret", "margin: 8px 0 2px");
  const secretInput    = createInput("your-secret-value");
  secretInput.type     = "password";
  secretInput.value    = cfg.secret || "";
  secretInput.style.width = "400px";

  // Auto sync toggle
  const autoSyncRow = createDiv();
  autoSyncRow.style.cssText = "display:flex; align-items:center; gap:8px; margin-top:12px;";
  const autoSyncToggle = document.createElement("input");
  autoSyncToggle.type    = "checkbox";
  autoSyncToggle.checked = cfg.autoSync !== false;
  const autoSyncLabel = document.createElement("label");
  autoSyncLabel.textContent = "Enable auto sync";
  autoSyncRow.appendChild(autoSyncToggle);
  autoSyncRow.appendChild(autoSyncLabel);

  // Interval config
  const intervalRow = createDiv();
  intervalRow.style.cssText = "display:flex; align-items:center; gap:16px; margin-top:10px; flex-wrap:wrap;";

  const pushIntervalLabel = document.createElement("label");
  pushIntervalLabel.textContent = "Auto push every";
  pushIntervalLabel.style.cssText = "display:flex; align-items:center; gap:6px;";
  const pushIntervalInput = createInput("5", "50px");
  pushIntervalInput.type  = "number";
  pushIntervalInput.min   = "1";
  pushIntervalInput.value = cfg.pushIntervalMins ?? 5;
  const pushIntervalUnit  = document.createTextNode(" min");
  pushIntervalLabel.appendChild(pushIntervalInput);
  pushIntervalLabel.appendChild(pushIntervalUnit);

  const pullIntervalLabel = document.createElement("label");
  pullIntervalLabel.textContent = "Auto pull every";
  pullIntervalLabel.style.cssText = "display:flex; align-items:center; gap:6px;";
  const pullIntervalInput = createInput("2", "50px");
  pullIntervalInput.type  = "number";
  pullIntervalInput.min   = "1";
  pullIntervalInput.value = cfg.pullIntervalHrs ?? 2;
  const pullIntervalUnit  = document.createTextNode(" hr");
  pullIntervalLabel.appendChild(pullIntervalInput);
  pullIntervalLabel.appendChild(pullIntervalUnit);

  intervalRow.appendChild(pushIntervalLabel);
  intervalRow.appendChild(pullIntervalLabel);

  const statusEl = make("p", "Not synced yet.", "color:var(--muted); font-size:12px; margin-top:10px;");

  const lastPushed = parseInt(localStorage.getItem("lastPushed") || "0", 10);
  const lastPulled = parseInt(localStorage.getItem("lastPulled") || "0", 10);
  if (lastPushed) statusEl.textContent = `Last pushed: ${new Date(lastPushed).toLocaleString()}`;
  if (lastPulled) statusEl.textContent += `  |  Last pulled: ${new Date(lastPulled).toLocaleString()}`;

  const saveConfigBtn = createButton("Save Config", () => {
    window.saveSyncConfig({
      workerUrl:        urlInput.value.trim(),
      secret:           secretInput.value.trim(),
      autoSync:         autoSyncToggle.checked,
      pushIntervalMins: parseFloat(pushIntervalInput.value) || 5,
      pullIntervalHrs:  parseFloat(pullIntervalInput.value) || 2,
    });
    statusEl.textContent = "Config saved.";
  });

  const btnRow = createDiv();
  btnRow.style.cssText = "display:flex; gap:8px; margin-top:16px;";

  btnRow.appendChild(createButton("⬆ Push to Cloud", async () => {
    statusEl.textContent = "Pushing...";
    try {
      await window.syncPush();
      statusEl.textContent = `Pushed at ${new Date().toLocaleTimeString()}`;
    } catch(e) {
      statusEl.textContent = "Push failed: " + e.message;
    }
  }));

  btnRow.appendChild(createButton("⬇ Pull from Cloud", async () => {
    if (!confirm("Pull will overwrite your local links and notes. Continue?")) return;
    statusEl.textContent = "Pulling...";
    try {
      await window.syncPull();
      statusEl.textContent = `Pulled at ${new Date().toLocaleTimeString()} — reload to see link changes.`;
    } catch(e) {
      statusEl.textContent = "Pull failed: " + e.message;
    }
  }));

  syncContainer.appendChild(urlLabel);
  syncContainer.appendChild(urlInput);
  syncContainer.appendChild(secretLabel);
  syncContainer.appendChild(secretInput);
  syncContainer.appendChild(autoSyncRow);
  syncContainer.appendChild(intervalRow);
  syncContainer.appendChild(saveConfigBtn);
  syncContainer.appendChild(btnRow);
  syncContainer.appendChild(statusEl);
}


// ======================
// INIT (called once lazily from index.html)
// ======================

function initSettings() {
  settingsWindow.classList.remove("hidden");
  initTabs();
  initSaveButtons();
  buildGallerySettings();
  buildLinkEditor();
}