// ======================
// SYNC
// Loaded early — handles auto pull on load and periodic auto push.
// UI lives in settings.js (buildSyncTab), which calls syncPush/syncPull
// directly since they share window scope.
// ======================

const RESPONSE_PORT = 19420;

// Fallback defaults — overridden by syncConfig values set in settings UI
const DEFAULT_PUSH_INTERVAL_MINS = 5;
const DEFAULT_PULL_INTERVAL_HRS = 2;

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

window.getSyncConfig = function () {
  return JSON.parse(localStorage.getItem("syncConfig") || "{}");
};

window.saveSyncConfig = function (cfg) {
  localStorage.setItem("syncConfig", JSON.stringify(cfg));
};

function isSyncConfigured() {
  const { workerUrl, secret, username } = window.getSyncConfig();
  return !!(workerUrl && secret && username);
}

function isAutoSyncEnabled() {
  return isSyncConfigured() && window.getSyncConfig().autoSync !== false;
}


// ======================
// PHOME REQUEST
// Triggers a phome:// protocol call and polls localhost for the response.
// ======================

window.phomeRequest = async function (params, timeoutMs = 15000) {
  const res_crypt_key = await GenerateEncryptionKeyString();
  params["res_crypt_key"] = encodeURIComponent(res_crypt_key);

  const query = new URLSearchParams(params).toString();
  window.location.href = `phome://${query}`;


  // Send the request
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    async function poll() {
      if (Date.now() > deadline) {
        reject(new Error("Connection timed out. home_helper is likely not running or not setup to the right directory."
        ));
        return;
      }
      fetch(`http://127.0.0.1:${RESPONSE_PORT}`, { cache: "no-store" })
        .then(async r => {
          try
          {
            const key = await KeyTextToKey(res_crypt_key);
            const responseText = await r.text();
            const decrypted = await TryDecryptWithKey(key, responseText);
            return JSON.parse(decrypted);
          }
          catch (err){
            console.error(err);
            throw err;
          }
        })
        .then(resolve)
        .catch(() => setTimeout(poll, 300));
    }
    setTimeout(poll, 400);
  });
};


// ======================
// PUSH / PULL
// syncPush always reads from localStorage so multi-tab usage
// picks up the most recently saved data from any tab.
// ======================

window.remoteRequest = async function (path, method, body = "", tempUsername = null, timeoutMs = 7000) {

  const { workerUrl, secret, username } = window.getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  const url = `${workerUrl.replace(/\/$/, "")}/${path}`;
  const API_KEY = GetAPIKey();

  // Send the request
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const controller = new AbortController();
  try {

    const response = await fetch(url, {
      method,
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "X-Secret": API_KEY,
        "Username": tempUsername || username,
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: method === "GET" ? undefined : body
    });

    const responseText = response.text();

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${responseText || response.statusText}`);
    }
    return responseText;
  }
  catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Connection timed out to ${url}`);
    }
    throw err;
  }
  finally {
    clearTimeout(timeout)
  }
};


window.syncPush = async function () {
  const { workerUrl, secret, username } = window.getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  // Read from localStorage, not in-memory linksConfig, so we always
  // push the latest committed data even if another tab saved more recently.
  const links = localStorage.getItem("linksConfig")
    || JSON.stringify(window.linksConfig || window.groups);
  const notes = localStorage.getItem("notes") || "";

  const encryptionKey = await GetEncryptionKey();

  await window.remoteRequest("notes", "PUT", await TryEncryptWithKey(encryptionKey, notes));

  await window.remoteRequest("links", "PUT", await TryEncryptWithKey(encryptionKey, links));

  localStorage.setItem("lastPushed", Date.now().toString());
};

window.syncPull = async function () {
  const { workerUrl, secret, username } = window.getSyncConfig();
  if (!workerUrl || !secret) throw new Error("Sync not configured.");

  const encryptionKey = await GetEncryptionKey();

  const encryptedNotes = await window.remoteRequest("notes", "GET");
  const encryptedLinks = await window.remoteRequest("links", "GET");

  if (encryptedNotes) {
    const notes = await TryDecryptWithKey(encryptionKey, encryptedNotes);
    localStorage.setItem("notes", notes);
    const pad = document.getElementById("scratchpad");
    if (pad) pad.value = notes;
  }
  if (encryptedLinks) {
    const links = await TryDecryptWithKey(encryptionKey, encryptedLinks);

    // Parse for valid JSON before overwriting
    JSON.parse(links);

    localStorage.setItem("linksConfig", links);
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
  } catch (e) {
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
// Self-scheduling so interval changes in settings take effect immediately
// on the next tick without requiring a page reload.
// Only pushes if localStorage was saved more recently than last push.
// Reads from localStorage (not in-memory) for multi-tab safety.
// ======================

async function autoPushTick() {
  if (isAutoSyncEnabled()) {
    const lastSaved = parseInt(localStorage.getItem("lastSaved") || "0", 10);
    const lastPushed = parseInt(localStorage.getItem("lastPushed") || "0", 10);

    if (lastSaved > lastPushed) {
      try {
        await window.syncPush();
      } catch (e) {
        console.warn("Auto push failed:", e.message);
      }
    }
  }

  setTimeout(autoPushTick, getPushIntervalMs());
}

// Delay first tick so page load settles before any push attempt
setTimeout(autoPushTick, getPushIntervalMs());

// ======================
//    TEXT ENCRYPTION
// ======================
// A private key is used to encrypt data before sending it to the server so that the server never gets your unencrypted data.
// Your "secret" given by the website is "[APIKEY]|ENC:[Encryption Key]"
// Old versions don't have the encryption key so all functions are built into a 'try' architecture. They simply don't encrypt/decrypt if there is no key.

function GetAPIKey() {
  const { workerUrl, secret, username } = window.getSyncConfig();
  if (!secret || typeof secret !== 'string') return "";

  const key_end_char = secret.indexOf("|ENC:");

  if (key_end_char == -1) return secret;

  return secret.substring(0, key_end_char);
}
async function GetEncryptionKey() {
  const { workerUrl, secret, username } = window.getSyncConfig();
  if (typeof secret !== 'string' || !secret) return "";

  const key_start_char = secret.indexOf("|ENC:");

  if (key_start_char == -1) return "";

  const keyAsText = secret.substring(key_start_char + 5);
  return await KeyTextToKey(keyAsText)
}
async function KeyTextToKey(keyAsText) {
  const keyByteString = atob(keyAsText)
  const bytes = new Uint8Array(keyByteString.length)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = keyByteString.charCodeAt([i])
  }
  return await window.crypto.subtle.importKey("raw", bytes.buffer, "AES-GCM", true, ["encrypt", "decrypt"])
}
async function GenerateEncryptionKeyString() {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const keyAsText = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return keyAsText;
}
async function TryEncryptWithKey(key, to_encrypt) {
  if (!key) return to_encrypt

  const encoder = new TextEncoder();
  const encodedText = encoder.encode(to_encrypt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encodedText
  );
  const cipherTextBytes = new Uint8Array(encryptedBuffer);
  const combinedBytes = new Uint8Array(iv.length + cipherTextBytes.length);
  combinedBytes.set(iv, 0);
  combinedBytes.set(cipherTextBytes, iv.length);
  const ciphertextBase64 = btoa(String.fromCharCode(...combinedBytes));
  return ciphertextBase64;
}
async function TryDecryptWithKey(key, toDecryptText) {
  // If there is no encryption key assume that it was never encrypted, so data can still be retrieved
  if (!key) return toDecryptText

  const decoder = new TextDecoder();

  const binaryString = atob(toDecryptText)
  const combinedBytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < combinedBytes.length; i++) {
    combinedBytes[i] = binaryString.charCodeAt(i)
  }

  // The IV is of length 12
  const iv = combinedBytes.slice(0, 12);
  const cypherBytes = combinedBytes.slice(12);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    cypherBytes.buffer
  );
  const decryptedText = decoder.decode(decryptedBuffer);
  return decryptedText;
}


// ======================
// ACCOUNT REGISTRATION
// ======================

window.syncRegister = async function (username) {
  username = username.trim();

  if (!username) {
    throw new Error("Username is required.");
  }

  const cfg = window.getSyncConfig();
  const workerUrl =
    cfg.workerUrl ||
    "https://phome-sync.obpickleman.workers.dev";

  const result = JSON.parse(await window.remoteRequest("register", "POST", null, username));

  console.log(result);

  if (!result) {
    throw new Error(
      result?.error || "Unable to create sync account."
    );
  }

  if (!result.username || !result.secret) {
    throw new Error(
      "The server returned an invalid account response."
    );
  }

  encryptionKey = await GenerateEncryptionKeyString();
  const fullSecret = result.secret + "|ENC:" + encryptionKey;

  // Save the newly-created credentials immediately.
  window.saveSyncConfig({
    ...cfg,
    workerUrl,
    username: result.username,
    secret: fullSecret
  });

  return {
    username: result.username,
    secret: fullSecret
  };
};