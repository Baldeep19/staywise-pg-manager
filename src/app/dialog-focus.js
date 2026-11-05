/**
 * Keyboard and screen-reader behaviour shared by every popup (static .overlay popups, popups built in JS, the
 * building-setup popup and the phone "More" sheet):
 *  - on open, focus moves into the popup (first field on desktop; the card itself on touch screens, so the phone
 *    keyboard does not jump up and hide half the form before the user has read it)
 *  - Tab / Shift+Tab stay inside the topmost popup
 *  - Esc closes the topmost .overlay popup through its ×, so each popup's own close logic still runs
 *  - on close, focus returns to the button that opened it
 * Popups open in several ways (class "show", appended to <body>, style.display), so instead of patching every opener
 * a MutationObserver compares the set of open popups before and after each DOM change.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const FIELD =
  'input:not([disabled]):not([type="hidden"]):not([readonly]),select:not([disabled]),textarea:not([disabled])';

/** Every element that can be a popup, in DOM order (later = on top). */
const candidates = () => document.querySelectorAll('.overlay, .sheet-overlay, #ownerSetupGate');

export function isOpen(el) {
  if (!el.isConnected) return false;
  if (el.id === 'ownerSetupGate') return el.style.display === 'block';
  if (el.classList.contains('sheet-overlay')) return true;
  return el.classList.contains('show');
}

/** The popup the user is looking at, or null. */
export function topDialog() {
  const open = [...candidates()].filter(isOpen);
  return open[open.length - 1] || null;
}

/** The card inside a popup (what gets focus on touch screens and holds role="dialog"). */
const cardOf = (dlg) => dlg.querySelector('.modal, .sheet, #ownerSetupForm') || dlg;

/** Hidden via [hidden] / .hidden / inline display:none? jsdom has no layout, so check the attributes ourselves. */
const shown = (el, root) => {
  for (let n = el; n && n !== root; n = n.parentElement)
    if (n.hidden || n.classList.contains('hidden') || n.style.display === 'none') return false;
  return true;
};

export const focusablesIn = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((el) => shown(el, root));

const touchScreen = () => window.matchMedia?.('(pointer: coarse)').matches;

function focusInto(dlg) {
  const card = cardOf(dlg);
  const field = touchScreen() ? null : [...card.querySelectorAll(FIELD)].find((el) => shown(el, card));
  const target = field || card;
  if (target === card && !card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1'); // focusable, not tabbable
  target.focus({preventScroll: true});
}

// popup element -> element that had focus before it opened
const returnTo = new WeakMap();
let openNow = new Set();

function sync() {
  const now = new Set([...candidates()].filter(isOpen));
  for (const dlg of now)
    if (!openNow.has(dlg)) {
      const prev = document.activeElement;
      if (prev && prev !== document.body && !dlg.contains(prev)) returnTo.set(dlg, prev);
      focusInto(dlg);
    }
  for (const dlg of openNow)
    if (!now.has(dlg)) {
      const prev = returnTo.get(dlg);
      returnTo.delete(dlg);
      // Only pull focus back if it was lost (still in the closed popup, or dropped to <body>); another popup that
      // just opened keeps its focus.
      const lost =
        !document.activeElement || document.activeElement === document.body || dlg.contains(document.activeElement);
      if (lost && prev?.isConnected) prev.focus({preventScroll: true});
    }
  openNow = now;
}

function onKeydown(e) {
  const dlg = topDialog();
  if (!dlg) return;
  if (e.key === 'Tab') {
    const items = focusablesIn(dlg);
    if (!items.length) return e.preventDefault();
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // Focus outside the popup (e.g. the card itself was focused, or a click landed behind it) -> pull it in.
    // At either end -> wrap round instead of escaping to the page behind.
    const target =
      !dlg.contains(active) || active === cardOf(dlg)
        ? e.shiftKey
          ? last
          : first
        : e.shiftKey && active === first
          ? last
          : !e.shiftKey && active === last
            ? first
            : null;
    if (target) {
      e.preventDefault();
      target.focus();
    }
  } else if (e.key === 'Escape' && dlg.classList.contains('overlay') && !e.defaultPrevented) {
    // The sheet and the setup popup handle Esc themselves; plain popups close through their × button.
    dlg.querySelector('.modalhead .close')?.click();
  }
}

export function initDialogFocus() {
  document.addEventListener('keydown', onKeydown);
  new MutationObserver(sync).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  sync();
}
