// ======================
// SYNC
// Loaded early — handles auto pull on load and periodic auto push.
// UI lives in settings.js (buildSyncTab), which calls syncPush/syncPull
// directly since they share window scope.
// ======================

const RESPONSE_PORT = 19420;

// Fallback defaults — overridden by syncConfig values set in settings UI
const DEFAULT_PUSH_INTERVAL_MINS = 5;
const DEFAULT_PULL_INTERVAL_HRS  = 2;

function getPushIntervalMs() {
  const mins = parseFloat(window.getSyncConfig().pushIntervalMins) || DEFAULT_PUSH_INTERVAL_MINS;
  return mins * 60 * 1000;
}

function getPullIntervalMs() {
  const hrs = parseFloat(window.getSyncConfig().pullIntervalHrs) || DEFAULT_PULL_INTERVAL_HRS;
  return hrs * 60 * 60 * 1000;
}


// ======================
// CONFIG HELPERS
// ======================

window.getSyncConfig = function() {
  return JSON.parse(localStorage.getItem("syncConfig") || "{}");
};

window.saveSyncConfig = function(cfg) {
  localStorage.setItem("syncConfig", JSON.stringify(cfg));
};

function isSyncConfigured() {
  const { workerUrl, secret } = window.getSyncConfig();
  return !!(workerUrl && secret);
}

function isAutoSyncEnabled() {
  return isSyncConfigured() && window.getSyncConfig().autoSync !== false;
}


// ======================
// PHOME REQUEST
// Triggers a phome:// protocol call and polls localhost for the response.
// ======================

window.phomeRequest = function(params) {
  const query = new URLSearchParams(params).toString();
  window.location.href = `phome://${query}`;

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;

    function poll() {
      if (Date.now() > deadline) {
        reject(new Error("Sync timed out — is home_helper running?"));
        return;
      }
      fetch(`http://127.0.0.1:${RESPONSE_PORT}`, { cache: "no-store" })
        .then(r => r.json())
        .then(resolve)
        .catch(() => setTimeout(poll, 300));
    }

    setTimeout(poll, 500);
  });
};


// ======================
// PUSH / PULL
// syncPush always reads from localStorage so multi-tab usage
// picks up the most recently saved data from any tab.
// ======================

window.syncPush = async function() {
  const { workerUrl, secret } = window.getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  // Read from localStorage, not in-memory linksConfig, so we always
  // push the latest committed data even if another tab saved more recently.
  const links = localStorage.getItem("linksConfig")
    || JSON.stringify(window.linksConfig);
  const notes = localStorage.getItem("notes") || "";

  const result = await window.phomeRequest({
    action:     "sync_push",
    worker_url: workerUrl,
    secret,
    links:      encodeURIComponent(links),
    notes:      encodeURIComponent(notes)
  });

  if (!result.ok) throw new Error(result.error || "Push failed.");

  localStorage.setItem("lastPushed", Date.now().toString());
};

window.syncPull = async function() {
  const { workerUrl, secret } = window.getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  const result = await window.phomeRequest({
    action:     "sync_pull",
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

  localStorage.setItem("lastPulled", Date.now().toString());
};


// ======================
// AUTO PULL ON LOAD
// Silent pull if configured, auto-sync on, and last pull > 2 hours ago.
// ======================

window.addEventListener("load", async () => {
  if (!isAutoSyncEnabled()) return;

  const lastPulled = parseInt(localStorage.getItem("lastPulled") || "0", 10);
  if (Date.now() - lastPulled < getPullIntervalMs()) return;

  try {
    await window.syncPull();
    if (!window.hasUnsavedEdits) location.reload();
  } catch(e) {
    console.warn("Auto pull failed:", e.message);
  }
});


// ======================
// PERIODIC AUTO PUSH
// Every 5 minutes, push if:
//   - auto sync is enabled
//   - localStorage was saved more recently than it was last pushed
// Reading from localStorage (not in-memory) ensures multi-tab safety:
// whichever tab saved most recently is what gets pushed.
// ======================

// ======================
// PERIODIC AUTO PUSH
// Self-scheduling so interval changes in settings take effect immediately
// on the next tick without requiring a page reload.
// Only pushes if localStorage was saved more recently than last push.
// Reads from localStorage (not in-memory) for multi-tab safety.
// ======================

async function autoPushTick() {
  if (isAutoSyncEnabled()) {
    const lastSaved  = parseInt(localStorage.getItem("lastSaved")  || "0", 10);
    const lastPushed = parseInt(localStorage.getItem("lastPushed") || "0", 10);

    if (lastSaved > lastPushed) {
      try {
        await window.syncPush();
      } catch(e) {
        console.warn("Auto push failed:", e.message);
      }
    }
  }

  setTimeout(autoPushTick, getPushIntervalMs());
}

// Delay first tick so page load settles before any push attempt
setTimeout(autoPushTick, getPushIntervalMs());