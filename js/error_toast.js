// ======================
// ERROR TOAST SYSTEM
// ======================

const toastContainer = document.getElementById("errorToastContainer");

function showErrorToast(message) {
  const toast = document.createElement("div");
  toast.className = "error-toast collapsed";
  toast.textContent = message;

  let expanded = false;

  toast.onclick = () => {
    expanded = !expanded;
    toast.classList.toggle("expanded", expanded);
    toast.classList.toggle("collapsed", !expanded);
  };

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 10000);
}


// ======================
// GLOBAL ERROR HOOKS
// ======================

// JS errors
window.onerror = function (msg, src, line, col, err) {
  showErrorToast(`${msg} (${line}:${col})`);
};

// Promise errors
window.onunhandledrejection = function (e) {
  showErrorToast(`Promise error: ${e.reason}`);
};