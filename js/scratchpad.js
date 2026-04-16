const pad = document.getElementById("scratchpad");

pad.value = localStorage.getItem("notes") || "";

pad.addEventListener("input", () => {
  localStorage.setItem("notes", pad.value);
});

pad.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();

    const start = pad.selectionStart;
    const end = pad.selectionEnd;

    pad.value =
      pad.value.substring(0, start) +
      "    " +
      pad.value.substring(end);

    pad.selectionStart = pad.selectionEnd = start + 4;
  }
});