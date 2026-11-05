/**
 * "Install the app" support: captures the browser's install prompt, detects the device and renders
 * step-by-step instructions for each platform (the browsers differ, so a single button is not enough).
 */
import {esc, toast} from './ui.js';

/** Browser install prompt event, saved so a button can trigger it later (Chrome / Edge / Android only). */
let deferredPrompt = null;

/** Step-by-step guides. `id` matches the value returned by detectPlatform(). */
export const INSTALL_GUIDES = [
  {
    id: 'ios',
    title: 'iPhone / iPad (Safari)',
    note: 'Use Safari — other iOS browsers cannot add apps to the Home Screen.',
    steps: [
      'Open this site in Safari.',
      'Tap the Share button (square with an up arrow).',
      'Choose “Add to Home Screen”.',
      'Tap “Add”. Staywise now appears on your Home Screen.'
    ]
  },
  {
    id: 'android',
    title: 'Android (Chrome)',
    steps: [
      'Open this site in Chrome.',
      'Tap the ⋮ menu at the top right.',
      'Choose “Install app” (or “Add to Home screen”).',
      'Tap “Install”. Staywise is added to your app list.'
    ]
  },
  {
    id: 'desktop',
    title: 'Windows / Mac / Linux (Chrome or Edge)',
    steps: [
      'Open this site in Chrome or Edge.',
      'Click the install icon at the right end of the address bar — or open the ⋮ menu and choose “Install Staywise”.',
      'Click “Install”. Staywise opens in its own window and gets a desktop shortcut.'
    ]
  },
  {
    id: 'mac-safari',
    title: 'Mac (Safari)',
    steps: ['Open this site in Safari.', 'Choose File → Add to Dock.', 'Click “Add”. Staywise appears in your Dock.']
  }
];

/**
 * Work out which guide matches this device.
 * @param {{userAgent?: string, platform?: string, maxTouchPoints?: number}} [nav]
 * @returns {'ios'|'android'|'desktop'|'mac-safari'|'other'}
 */
export function detectPlatform(nav = navigator) {
  const ua = nav.userAgent || '';
  // iPadOS 13+ reports itself as a Mac, so touch support is the tell.
  if (/iphone|ipad|ipod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
  if (/Chrome|Chromium|Edg/.test(ua)) return 'desktop';
  return 'other';
}

/** True when the app is already running as an installed app (not in a browser tab). */
export function isInstalled() {
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

/** True when the browser has offered a one-click install. */
export const canPromptInstall = () => deferredPrompt !== null;

/** Show the browser's install dialog. Returns true if the user accepted. */
export async function promptInstall() {
  if (!deferredPrompt) {
    toast('Use the steps below to install on this device');
    return false;
  }
  const prompt = deferredPrompt;
  deferredPrompt = null; // an install prompt can only be used once
  prompt.prompt();
  const {outcome} = await prompt.userChoice;
  window.renderCurrentPage?.();
  refreshAuthInstall();
  return outcome === 'accepted';
}

/** The status line (installed / one-click button) and the per-platform guides, shared by Settings and the login screen. */
function renderInstallBody() {
  const mine = detectPlatform();
  const guides = [...INSTALL_GUIDES].sort((a, b) => (a.id === mine ? -1 : b.id === mine ? 1 : 0));
  const status = isInstalled()
    ? '<p class="install-status ok">✓ Staywise is installed on this device.</p>'
    : canPromptInstall()
      ? '<p class="install-status"><button type="button" class="primary" onclick="installApp()">Install Staywise</button></p>'
      : '';
  const cards = guides
    .map(
      (g) => `<details class="install-guide"${g.id === mine ? ' open' : ''}>
        <summary>${esc(g.title)}${g.id === mine ? ' <span class="badge-you">Your device</span>' : ''}</summary>
        ${g.note ? `<p class="sub">${esc(g.note)}</p>` : ''}
        <ol>${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </details>`
    )
    .join('');
  return status + cards;
}

/** HTML for the "Install app" card on the Settings page. */
export function renderInstallSection() {
  return `<section class="report-block" id="installSection">
    <div class="report-blockhead"><h3>Install the app</h3><p>Add Staywise to your phone or computer to open it like a regular app — faster to reach, full screen, no browser bar.</p></div>
    <div style="padding:6px 16px 16px">${renderInstallBody()}</div>
  </section>`;
}

/** Compact, collapsible install help for the login screen. Empty when the app is already installed. */
export function renderAuthInstall() {
  if (isInstalled()) return '';
  return `<details class="auth-install"><summary>📲 Install the app on your phone or computer</summary>${renderInstallBody()}</details>`;
}

/** Re-draw the login-screen install help (keeps it open if the user had opened it). */
export function refreshAuthInstall() {
  const host = document.getElementById('authInstall');
  if (!host) return;
  const wasOpen = host.querySelector('.auth-install')?.open === true;
  host.innerHTML = renderAuthInstall();
  const panel = host.querySelector('.auth-install'); // absent once the app is installed
  if (wasOpen && panel) panel.open = true;
}

/** Listen for the browser's install events. Called once from main.js. */
export function initInstall() {
  window.installApp = promptInstall;
  refreshAuthInstall();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep it for our own button instead of the browser's mini-infobar
    deferredPrompt = event;
    window.renderCurrentPage?.();
    refreshAuthInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('Staywise installed');
    window.renderCurrentPage?.();
    refreshAuthInstall();
  });
}
