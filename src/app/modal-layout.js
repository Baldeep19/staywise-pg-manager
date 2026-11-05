import {initDialogFocus} from './dialog-focus.js';

/**
 * Give every popup the same three-part layout: fixed header, scrolling body, fixed footer.
 *
 * Popups are written as  .modal > .modalhead + content + .formactions  (sometimes with the content and buttons inside a
 * <form>). CSS alone cannot make "only the middle" scroll without a wrapper around that middle, so this wraps it in
 * .modal-body. Popups built later in JS (expenses, partners, flat details, …) are picked up by a MutationObserver.
 * Moving the nodes keeps their event listeners and form membership, so existing code is unaffected.
 */
export function layoutModal(modal) {
  if (modal.classList.contains('modal-layout')) return;
  const head = modal.querySelector(':scope > .modalhead');
  const rest = [...modal.children].filter((c) => c !== head);
  // .modal > .modalhead + <form> (all fields and buttons inside the form): lay out inside the form,
  // so the footer buttons stay in the form and still submit it.
  const host = rest.length === 1 && rest[0].tagName === 'FORM' ? rest[0] : modal;
  const foot = host.lastElementChild?.classList.contains('formactions') ? host.lastElementChild : null;
  const middle = [...host.children].filter((c) => c !== head && c !== foot);
  const body = document.createElement('div');
  body.className = 'modal-body';
  if (middle.length) host.insertBefore(body, middle[0]);
  else host.insertBefore(body, foot);
  body.append(...middle);
  if (foot) foot.classList.add('modal-foot');
  ensureCloseButton(modal, head);
  labelDialog(modal, head);
  if (host !== modal) host.classList.add('modal-host');
  modal.classList.add('modal-layout');
}

/** Screen readers announce the card as a dialog named by its heading. */
let headingSeq = 0;
function labelDialog(modal, head) {
  if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const heading = head?.querySelector('h1,h2,h3,h4');
  if (!heading || modal.hasAttribute('aria-labelledby') || modal.hasAttribute('aria-label')) return;
  if (!heading.id) heading.id = 'dlg-title-' + ++headingSeq;
  modal.setAttribute('aria-labelledby', heading.id);
}

/** Every popup gets a × in its header. Existing ones just get an accessible name. */
function ensureCloseButton(modal, head) {
  if (!head) return;
  let close = head.querySelector('.close');
  if (!close) {
    close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.textContent = '×';
    close.onclick = () => {
      const overlay = modal.closest('.overlay');
      if (!overlay) return;
      if (overlay.id)
        overlay.classList.remove('show'); // static popup in index.html: hide it
      else overlay.remove(); // popup built in JS: discard it
    };
    head.appendChild(close);
  }
  if (!close.getAttribute('aria-label')) close.setAttribute('aria-label', 'Close');
}

/**
 * Outside-click rule, the same for every popup:
 *  - nothing typed yet  -> a click on the dimmed backdrop closes it
 *  - something typed    -> the backdrop click is ignored (a stray tap on a phone must not throw away a half-filled
 *                          form); the card gives a small nudge so the user sees it was deliberate
 *  - × and Esc always close
 * "Typed" means an input/change event; values the app fills in by setting .value fire no event, so they do not count.
 */
export const isDirty = (el) => el?.dataset.dirty === '1';
export const clearDirty = (el) => el && delete el.dataset.dirty;

function nudge(card) {
  card.classList.remove('nudge');
  void card.offsetWidth; // restart the animation if it is already running
  card.classList.add('nudge');
}

/** Backdrop click on `backdrop` (whose card is `card`): close via `close()` unless the user has typed in it. */
export function closeOnBackdrop(backdrop, card, close) {
  if (isDirty(card)) return nudge(card);
  close();
}

function onBackdropClick(e) {
  const overlay = e.target;
  if (!overlay.classList?.contains('overlay')) return; // clicks inside the card, or not on a popup at all
  const card = overlay.querySelector('.modal');
  if (!card) return;
  closeOnBackdrop(overlay, card, () => {
    if (overlay.id)
      overlay.classList.remove('show'); // static popup in index.html: hide it
    else overlay.remove(); // popup built in JS: discard it
  });
}

const markDirty = (e) => {
  const card = e.target.closest?.('.modal');
  if (card) card.dataset.dirty = '1';
};

export function initModalLayout() {
  document.addEventListener('input', markDirty, true);
  document.addEventListener('change', markDirty, true);
  document.addEventListener('click', onBackdropClick);
  document.querySelectorAll('.modal').forEach(layoutModal);
  new MutationObserver((mutations) => {
    for (const m of mutations)
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('.modal')) layoutModal(n);
        n.querySelectorAll('.modal').forEach(layoutModal);
      }
  }).observe(document.body, {childList: true, subtree: true});
  // Focus in / Tab trap / Esc / focus back (app/dialog-focus.js). Started after the layout observer on purpose:
  // observers run in creation order, and layoutModal moves fields into .modal-body, which would drop a focus set earlier.
  initDialogFocus();
}
