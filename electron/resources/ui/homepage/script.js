window.addEventListener("DOMContentLoaded", () => {
  const subtitleEl = document.querySelector("[data-startup-subtitle]");
  const hintEl = document.querySelector("[data-startup-hint]");
  const progressEl = document.querySelector("[data-startup-progress]");
  const meterEl = document.querySelector("[data-startup-meter]");

  let visualProgress = 0.24;
  let targetProgress = 0.62;

  function applyProgress(value) {
    const clampedValue = Math.max(0.18, Math.min(value, 1));
    if (progressEl) {
      progressEl.style.setProperty("--progress", String(clampedValue));
      progressEl.style.transform = `scaleX(${clampedValue})`;
    }
    if (meterEl) {
      meterEl.setAttribute("aria-valuenow", String(Math.round(clampedValue * 100)));
    }
  }

  function updateStateCopy() {
    if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
    if (hintEl) hintEl.textContent = "Opening your workspace";
  }

  function animateProgress() {
    visualProgress += (targetProgress - visualProgress) * 0.08;
    applyProgress(visualProgress);
    window.requestAnimationFrame(animateProgress);
  }

  updateStateCopy();
  applyProgress(visualProgress);
  animateProgress();

  window.setInterval(() => {
    if (targetProgress < 0.88) {
      targetProgress = Math.min(0.88, targetProgress + 0.025);
    }
  }, 1200);

  window.addEventListener("beforeunload", () => {
    targetProgress = 1;
    applyProgress(1);
  });
});
