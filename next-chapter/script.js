const status = document.getElementById("copy-status");
let statusTimeout;

function announce(message) {
  clearTimeout(statusTimeout);
  status.textContent = message;
  status.classList.add("visible");
  statusTimeout = setTimeout(() => status.classList.remove("visible"), 4500);
}

// Older browsers and denied clipboard permissions still allow manual copying.
function selectForCopy(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

document.querySelectorAll("button[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(value.textContent.trim());
      announce(`${button.getAttribute("aria-label").replace(/^Copy /, "")} copied.`);
    } catch {
      selectForCopy(value);
      announce("Select and hold the highlighted details to copy them.");
    }
  });
});
