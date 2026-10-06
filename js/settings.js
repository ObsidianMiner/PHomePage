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

let openGalleryFolders = {};
try {
  openGalleryFolders = JSON.parse(localStorage.getItem("openGalleryFolders") || "{}");
} catch (_) {
  openGalleryFolders = {};
}

function saveOpenGalleryFolders() {
  try {
    localStorage.setItem("openGalleryFolders", JSON.stringify(openGalleryFolders));
  } catch (_) {}
}

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
  gallerySettingsEl.innerHTML = "";

  const headerRow = createDiv("gallery-tab-header");
  const title = document.createElement("h2");
  title.textContent = "Gallery";
  headerRow.appendChild(title);

  const actions = createDiv("gallery-tab-actions");

  const refreshBtn = document.createElement("button");
  refreshBtn.id = "refreshGalleryBtn";
  refreshBtn.className = "gallery-action-btn";
  refreshBtn.title = "Rebuild and refresh gallery list from disk via Home Helper";
  refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span>Refresh</span>';

  refreshBtn.onclick = async () => {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    const icon = refreshBtn.querySelector("i");
    const label = refreshBtn.querySelector("span");
    if (icon) icon.classList.add("fa-spin");
    if (label) label.textContent = "Refreshing...";

    try {
      if (typeof window.phomeRequest !== "function") {
        throw new Error("phomeRequest is not available. Please ensure sync.js is loaded.");
      }

      const result = await window.phomeRequest({ action: "refresh_gallery" }, 7000);

      if (result && result.ok) {
        if (result.structure) {
          window.GALLERY_STRUCTURE = result.structure;
          if (typeof GALLERY_STRUCTURE !== "undefined") {
            try { GALLERY_STRUCTURE = result.structure; } catch (_) {}
          }
        }
        buildGallerySettings();
        const total = result.total_images ?? 0;
        const catCount = (result.categories || []).length;
        window.showToast?.(`Gallery refreshed: ${total} images across ${catCount} categories.`);
      } else {
        const errMsg = result?.error || "Failed to rebuild gallery.";
        window.showErrorToast?.(errMsg);
      }
    } catch (err) {
      console.warn("Gallery refresh failed:", err);
      if (typeof window.showHelperSetupModal === "function") {
        window.showHelperSetupModal("Gallery Refresh", err.message);
      } else {
        window.showErrorToast?.("Home Helper connection failed: " + err.message);
      }
    } finally {
      const activeBtn = document.getElementById("refreshGalleryBtn");
      if (activeBtn) {
        activeBtn.disabled = false;
        const curIcon = activeBtn.querySelector("i");
        const curLabel = activeBtn.querySelector("span");
        if (curIcon) curIcon.classList.remove("fa-spin");
        if (curLabel) curLabel.textContent = "Refresh";
      }
    }
  };

  actions.appendChild(refreshBtn);
  headerRow.appendChild(actions);
  gallerySettingsEl.appendChild(headerRow);

  const structure = (typeof GALLERY_STRUCTURE !== "undefined" ? GALLERY_STRUCTURE : window.GALLERY_STRUCTURE) || {};
  const entries = Object.entries(structure);

  if (entries.length === 0) {
    const emptyMsg = createDiv();
    emptyMsg.style.padding = "20px";
    emptyMsg.style.color = "#888";
    emptyMsg.textContent = "No gallery images found. Ensure photos are placed in the gallery folder and click Refresh.";
    gallerySettingsEl.appendChild(emptyMsg);
    return;
  }

  entries.forEach(([folder, images]) => {
    const folderDiv       = createDiv("folder");
    const isOpen          = openGalleryFolders[folder] ?? false;
    const header          = createFolderHeader(folder, images.length, folderDiv, isOpen);
    const imagesContainer = createImagesContainer(folder, images);
    const arrow           = header.querySelector(".folder-arrow");
    let isLoaded          = false;

    if (!(window.galleryConfig[folder]?.enabled ?? true)) {
      folderDiv.classList.add("folder-disabled");
    }

    if (isOpen) {
      imagesContainer.style.display = "grid";
      isLoaded = true;
      imagesContainer.querySelectorAll("img[data-src]").forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      });
    }

    header.onclick = (e) => {
      if (e.target.tagName === "INPUT") return;
      const isCurrentlyOpen = imagesContainer.style.display === "grid";

      if (isCurrentlyOpen) {
        imagesContainer.style.display = "none";
        arrow.textContent = "▼ ";
        openGalleryFolders[folder] = false;
        saveOpenGalleryFolders();
      } else {
        imagesContainer.style.display = "grid";
        arrow.textContent = "▲ ";
        openGalleryFolders[folder] = true;
        saveOpenGalleryFolders();

        // Lazy load images on first expand
        if (!isLoaded) {
          isLoaded = true;
          imagesContainer.querySelectorAll("img[data-src]").forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          });
        }
      }
    };

    folderDiv.appendChild(header);
    folderDiv.appendChild(imagesContainer);
    gallerySettingsEl.appendChild(folderDiv);
  });
}

function createFolderHeader(folder, count, folderDiv, isOpen = false) {
  const header = createDiv("folder-header");

  const arrow = document.createElement("span");
  arrow.className = "folder-arrow";
  arrow.textContent = isOpen ? "▲ " : "▼ ";

  const toggle = document.createElement("input");
  toggle.type      = "checkbox";
  toggle.className = "folder-toggle";
  toggle.checked   = window.galleryConfig[folder]?.enabled ?? true;
  toggle.title     = "Enable or disable this folder in the background rotation";
  toggle.onchange  = () => {
    window.galleryConfig[folder] = window.galleryConfig[folder] || {};
    window.galleryConfig[folder].enabled = toggle.checked;
    window.saveGalleryConfig();
    if (folderDiv) {
      folderDiv.classList.toggle("folder-disabled", !toggle.checked);
    }
  };
  toggle.onclick = (e) => e.stopPropagation();

  const label = document.createElement("span");
  label.className = "folder-label";
  label.textContent = folder;

  const countBadge = document.createElement("span");
  countBadge.className = "folder-count";
  countBadge.textContent = `(${count})`;

  header.appendChild(arrow);
  header.appendChild(toggle);
  header.appendChild(label);
  header.appendChild(countBadge);
  return header;
}

function createImagesContainer(folder, images) {
  const container = createDiv("gallery-images-grid");
  container.style.display = "none";

  if (!images || images.length === 0) {
    const emptyNotice = createDiv();
    emptyNotice.style.padding = "10px";
    emptyNotice.style.color = "#777";
    emptyNotice.style.fontSize = "12px";
    emptyNotice.textContent = "No images in this folder.";
    container.appendChild(emptyNotice);
    return container;
  }

  images.forEach(img => {
    const isEnabled = window.galleryConfig[folder]?.images?.[img] ?? true;
    const card = createDiv("gallery-card" + (isEnabled ? "" : " disabled"));

    const thumbWrap = createDiv("gallery-thumb-wrap");

    // Placeholder icon while image loads or if broken
    const placeholder = document.createElement("i");
    placeholder.className = "fa-regular fa-image gallery-thumb-placeholder";
    thumbWrap.appendChild(placeholder);

    // Thumbnail img - deferred src for lazy loading
    const imgEl = document.createElement("img");
    const fileName = img.split("/").pop();
    imgEl.className = "gallery-thumb";
    imgEl.dataset.src = img;
    imgEl.alt = fileName;
    imgEl.loading = "lazy";
    imgEl.onload = () => {
      placeholder.style.display = "none";
      imgEl.classList.add("loaded");
    };
    imgEl.onerror = () => {
      imgEl.style.display = "none";
    };
    thumbWrap.appendChild(imgEl);

    // Direct open link (top right overlay on hover)
    const openLink = document.createElement("a");
    openLink.className = "gallery-card-action gallery-thumb-open";
    openLink.href = img;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.title = "Open image in new tab";
    openLink.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
    openLink.onclick = (e) => e.stopPropagation();
    thumbWrap.appendChild(openLink);

    // Footer info row
    const info = createDiv("gallery-card-info");
    const toggle = document.createElement("input");
    toggle.type    = "checkbox";
    toggle.checked = isEnabled;
    toggle.title   = "Enable or disable this image";

    const label = document.createElement("span");
    label.className = "gallery-card-label";
    label.textContent = fileName;
    label.title = fileName;

    toggle.onchange = () => {
      window.galleryConfig[folder] = window.galleryConfig[folder] || {};
      window.galleryConfig[folder].images = window.galleryConfig[folder].images || {};
      window.galleryConfig[folder].images[img] = toggle.checked;
      window.saveGalleryConfig();
      card.classList.toggle("disabled", !toggle.checked);
    };

    // Clicking anywhere on card toggles checkbox
    card.onclick = (e) => {
      if (e.target === toggle) return;
      if (e.target.closest(".gallery-card-action")) return;
      toggle.checked = !toggle.checked;
      toggle.onchange();
    };

    info.appendChild(toggle);
    info.appendChild(label);

    card.appendChild(thumbWrap);
    card.appendChild(info);
    container.appendChild(card);
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
  const urlInput    = createInput("https://phome-sync.obpickleman.workers.dev");
  urlInput.value    = cfg.workerUrl || "https://phome-sync.obpickleman.workers.dev";
  urlInput.style.width = "400px";

  const usernameLabel    = make("p", "Username", "margin: 8px 0 2px");
  const usernameInput    = createInput("your-username");
  usernameInput.type     = "username";
  usernameInput.value    = cfg.username || "";
  usernameInput.style.width = "400px";

  const secretLabel    = make("p", "Secret", "margin: 8px 0 2px");
  const secretInput    = createInput("your-secret-value");
  secretInput.type     = "password";
  secretInput.value    = cfg.secret || "";
  secretInput.style.width = "400px";

  const secretCopyButton = createButton("Copy to clipboard", async () => {
    if(!secretInput.value)
    {
      showToast("No secret to copy.", false);
    }
    else
    {
      navigator.clipboard?.writeText(secretInput.value);
      showToast("Secret copied to clipboard. Paste this on another device with the same username to authenticate.", false);
    }
  });

  // Auto sync toggle
  const autoSyncRow = createDiv();
  autoSyncRow.style.cssText = "display:flex; align-items:center; gap:8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);";
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
      username:         usernameInput.value.trim(),
      autoSync:         autoSyncToggle.checked,
      pushIntervalMins: parseFloat(pushIntervalInput.value) || 5,
      pullIntervalHrs:  parseFloat(pullIntervalInput.value) || 2,
    });
    statusEl.textContent = "Config saved.";
  });
  saveConfigBtn.style.cssText = "margin-top:16px;";

  const btnRow = createDiv();
  btnRow.style.cssText = "display:flex; gap:8px; margin-top:16px;";

  btnRow.appendChild(createButton("⬆ Push to Cloud", async () => {
    statusEl.textContent = "Pushing...";
    try {
      await window.syncPush();
      statusEl.textContent = `Pushed at ${new Date().toLocaleTimeString()}`;
    } catch(e) {
      statusEl.textContent = "Push failed: " + e.message;
      if (e.message && (e.message.includes("home_helper") || e.message.includes("timed out"))) {
        window.showHelperSetupModal?.("Cloud Sync", e.message);
      }
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
      if (e.message && (e.message.includes("home_helper") || e.message.includes("timed out"))) {
        window.showHelperSetupModal?.("Cloud Sync", e.message);
      }
    }
  }));


  // Account registration
  const registerSection = createDiv('hidden');
  registerSection.style.cssText = `
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.08);
  `;

  const registerTitle = make(
    "div",
    "Create Sync Account",
    "font-weight:600; margin-bottom:6px;"
  );

  const registerDescription = make(
    "div",
    "Create a new account and automatically fill in its credentials. Warning: this does replace your current account if already setup.",
    "color:var(--muted); font-size:12px; margin-bottom:10px;"
  );
  btnRow.appendChild(createButton("New account", () => {registerSection.classList.toggle('hidden'); console.log("pressed");}));

  const registerUsernameInput = createInput("username");
  registerUsernameInput.type = "text";
  registerUsernameInput.autocomplete = "username";
  registerUsernameInput.value = usernameInput.value;
  registerUsernameInput.style.width = "400px";

  const registerBtn = createButton("Register Account", async () => {
    const username = registerUsernameInput.value.trim();

    if (!username) {
      window.showErrorToast?.("Please enter a username.");
      registerUsernameInput.focus();
      return;
    }

    registerBtn.disabled = true;
    const originalText = registerBtn.textContent;
    registerBtn.textContent = "Registering...";

    try {
      const result = await window.syncRegister(username);

      // Fill the existing Sync credentials fields.
      console.log(result);
      usernameInput.value = result.username;
      secretInput.value = result.secret;

      // Keep the registration field synchronized too.
      registerUsernameInput.value = result.username;

      statusEl.textContent = "Account registered successfully.";

      window.showToast?.("Sync account registered successfully.");
    } catch (e) {
      console.error("Account registration failed:", e);

      statusEl.textContent = "Registration failed: " + e.message;

      if (
        e.message &&
        (
          e.message.includes("home_helper") ||
          e.message.includes("timed out") ||
          e.message.includes("Connection")
        )
      ) {
        window.showHelperSetupModal?.(
          "Account Registration",
          e.message
        );
      } else {
        window.showErrorToast?.(
          "Registration failed: " + e.message
        );
      }
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = originalText;
    }
  });
  
  registerBtn.style.cssText = "margin-top:16px;";

  registerSection.appendChild(registerTitle);
  registerSection.appendChild(registerDescription);
  registerSection.appendChild(registerUsernameInput);
  registerSection.appendChild(document.createElement("br"));
  registerSection.appendChild(registerBtn);


  // If you want to setup your own service uncomment this.
  //syncContainer.appendChild(urlLabel);
  //syncContainer.appendChild(urlInput);
  syncContainer.appendChild(usernameLabel);
  syncContainer.appendChild(usernameInput);
  syncContainer.appendChild(secretLabel);
  syncContainer.appendChild(secretInput);
  syncContainer.append(secretCopyButton);
  syncContainer.appendChild(btnRow);
  syncContainer.appendChild(statusEl);

  syncContainer.appendChild(registerSection);
  syncContainer.appendChild(autoSyncRow);
  syncContainer.appendChild(intervalRow);
  syncContainer.appendChild(saveConfigBtn);
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