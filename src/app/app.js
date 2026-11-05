/**
 * Bootstrap wiring that does not belong to a single feature.
 */

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initApp() {
  document.querySelectorAll('input[type=date]').forEach((x) => (x.value = new Date().toISOString().slice(0, 10)));
  document.querySelector('input[type=month]').value = new Date().toISOString().slice(0, 7);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
