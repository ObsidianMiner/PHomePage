// ======================
// HOME HELPER SETUP MODAL
// Reusable popup explaining how to setup the Home Helper utility.
// Can be invoked by any feature: window.showHelperSetupModal(featureName, errorDetails)
// ======================

(function() {
  function getModal() {
    let modal = document.getElementById("helperSetupModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "helperSetupModal";
      modal.className = "helper-modal-overlay hidden";
      modal.innerHTML = `
        <div class="helper-modal-content">
          <div class="helper-modal-header">
            <div class="helper-modal-title-wrap">
              <i class="fa-solid fa-circle-info helper-modal-icon"></i>
              <h3 id="helperModalTitle">Home Helper Setup Required</h3>
            </div>
            <button class="helper-modal-close" id="helperModalCloseBtn" title="Close">&times;</button>
          </div>
          
          <div class="helper-modal-body">
            <div class="helper-modal-intro" id="helperModalIntro">
              This feature requires the <strong>Home Helper</strong> utility, but a connection could not be established.
            </div>

            <p class="helper-modal-desc">
              Home Helper is a lightweight Python companion for PHomePage. It provides desktop and system integrations:
            </p>
            <ul class="helper-modal-features">
              <li>Scanning and rebuilding the background gallery</li>
              <li>Opening links in specific browsers or Chrome profiles</li>
              <li>Launching local desktop applications</li>
              <li>Syncing links & notes to Cloudflare</li>
            </ul>

            <div class="helper-tab-content">
              <p>Installing it is very simple.</p>
              <p>Navigate to the PHomePage folder and run:</p>
              <div class="helper-code-block">python setup.py</div>
              <p style="font-size:12px; color:#9aa3b2; margin-top:8px;">
                This registers the <code>phome://</code> protocol to enable the website to run python files.
              </p>
            </div>
          </div>

          <div class="helper-modal-footer">
            <button class="helper-btn-primary" id="helperModalGotItBtn">Got It</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const close = () => modal.classList.add("hidden");
      modal.querySelector("#helperModalCloseBtn").onclick = close;
      modal.querySelector("#helperModalGotItBtn").onclick = close;
      modal.onclick = (e) => {
        if (e.target === modal) close();
      };

      // Escape key listener
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
          close();
        }
      });
    }
    return modal;
  }

  window.showHelperSetupModal = function(featureName, errorDetails) {
    const modal = getModal();
    const titleEl = modal.querySelector("#helperModalTitle");
    const introEl = modal.querySelector("#helperModalIntro");

    if (featureName) {
      titleEl.textContent = `Home Helper Required for ${featureName}`;
      introEl.innerHTML = `<strong>${featureName}</strong> requires the <strong>Home Helper</strong> utility, but no connection could be established.`;
    } else {
      titleEl.textContent = "Home Helper Setup Required";
      introEl.innerHTML = "This feature requires the <strong>Home Helper</strong> utility, but no connection could be established.";
    }

    if (errorDetails) {
      introEl.innerHTML += `<div style="margin-top:6px; font-size:12px; color:#ff8080;">Details: ${errorDetails}</div>`;
    }

    modal.classList.remove("hidden");
  };
})();
