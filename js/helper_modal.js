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

            <div class="helper-modal-tabs">
              <button class="helper-tab-btn active" data-tab="win">Windows Setup</button>
              <button class="helper-tab-btn" data-tab="linux">Linux Setup</button>
              <button class="helper-tab-btn" data-tab="manual">Manual CLI</button>
            </div>

            <div class="helper-tab-content" id="helperTabWin">
              <ol>
                <li>Ensure <strong>Python</strong> is installed on your computer.</li>
                <li>In your file explorer, navigate to the <code>setup/</code> folder in PHomePage:
                  <div class="helper-code-block">setup/home_helper.reg</div>
                </li>
                <li>Double-click <strong>home_helper.reg</strong> and confirm the Windows Registry prompt to register the <code>phome://</code> protocol handler.</li>
                <li><em>(Note)</em> If Python is not in the default WindowsApps path, open <code>home_helper.reg</code> in Notepad and ensure the path to <code>pythonw.exe</code> and <code>home_helper.pyw</code> matches your system.</li>
                <li>When your browser shows a popup asking to open <strong>PHome Protocol</strong>, check <strong>"Always allow"</strong> and click <strong>Open</strong>.</li>
              </ol>
            </div>

            <div class="helper-tab-content hidden" id="helperTabLinux">
              <ol>
                <li>Ensure <strong>Python 3</strong> is installed.</li>
                <li>Copy the desktop entry to your applications folder:
                  <div class="helper-code-block">cp setup/home_helper.desktop ~/.local/share/applications/home_helper.desktop</div>
                </li>
                <li>Verify the path inside <code>~/.local/share/applications/home_helper.desktop</code> points to your <code>home_helper.pyw</code> script.</li>
                <li>Register the scheme handler:
                  <div class="helper-code-block">xdg-mime default home_helper.desktop x-scheme-handler/phome</div>
                </li>
              </ol>
            </div>

            <div class="helper-tab-content hidden" id="helperTabManual">
              <p>You can also manually rebuild the gallery anytime directly from your terminal:</p>
              <div class="helper-code-block">python py/generate_gallery.py</div>
              <p style="font-size:12px; color:#9aa3b2; margin-top:8px;">
                This scans the <code>gallery/</code> folder and updates <code>js/galleryphotos.local.js</code> directly.
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

      // Tab switcher
      modal.querySelectorAll(".helper-tab-btn").forEach(btn => {
        btn.onclick = () => {
          modal.querySelectorAll(".helper-tab-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const tab = btn.dataset.tab;
          modal.querySelector("#helperTabWin").classList.toggle("hidden", tab !== "win");
          modal.querySelector("#helperTabLinux").classList.toggle("hidden", tab !== "linux");
          modal.querySelector("#helperTabManual").classList.toggle("hidden", tab !== "manual");
        };
      });

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
