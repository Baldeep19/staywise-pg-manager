/**
 * Shared UI helpers: toasts, modals, page navigation and small formatting helpers.
 */
import {renderBillResidents, renderElectricity} from './electricity.js';
import {renderSettings} from './settings.js';
import {goMessages, renderMessages} from './messages.js';
import {refreshOptions, renderRent} from './rent.js';
import {renderReports} from './reports.js';
import {renderResidents, resetResidentForm} from './residents.js';
import {renderRooms} from './rooms.js';
import {clearFormErrors} from './field-errors.js';
import {renderIcons} from './icons.js';

export const pages = {
  dashboard: ['Overview', 'Your building at a glance'],
  residents: ['Residents', 'Keep resident details, room assignments, and rent status up to date.'],
  rooms: ['Flats', 'Floors, flats, beds and availability.'],
  expenses: ['Expenses & profitability', 'Track building spending and partner profit allocation'],
  rent: ['Rent & payments', 'Track monthly rent, payments received, and outstanding balances.'],
  electricity: ['Electricity bills', 'Calculate and review electricity charges for each resident.'],
  messages: ['Messages', 'Prepare WhatsApp reminders and keep a record of communication.'],
  reports: ['Reports', 'Review occupancy, collections, expenses, and dues.'],
  settings: ['Settings', 'Manage your buildings, partners and account.']
};

let toastTimer;
/**
 * Short message at the bottom of the screen. Pass {action, onAction} to add a button (e.g. Undo).
 * One shared timer: a new toast replaces the old one instead of being hidden early by the old one's timeout.
 * @returns {() => void} hides the toast
 */
export function toast(s, {action, onAction, ms = 2600} = {}) {
  const t = document.getElementById('toast');
  const hide = () => {
    clearTimeout(toastTimer);
    t.classList.remove('show');
  };
  clearTimeout(toastTimer);
  t.textContent = s;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = action;
    b.onclick = () => {
      hide();
      onAction?.();
    };
    t.append(' ', b);
  }
  t.classList.add('show');
  toastTimer = setTimeout(hide, ms);
  return hide;
}

let pendingUndo = null;
/**
 * Delete with Undo instead of a confirm() box: the item disappears at once, the real delete runs after `ms`
 * unless Undo is pressed. Nothing reaches the server during the wait, so Undo only has to put the local state back.
 * A failed delete also puts it back. Starting a second delete, hiding the tab or leaving the page runs the first
 * one straight away (worst case on a closed tab: the delete is dropped and the item is still there — the safe side).
 * @param {{message: string, hide: () => void, restore: () => void, commit: () => Promise<void>, ms?: number}} job
 */
export function undoable({message, hide, restore, commit, ms = 5000}) {
  flushUndo();
  hide();
  const job = {settled: false};
  const settle = () => {
    if (job.settled) return false;
    job.settled = true;
    clearTimeout(job.timer);
    if (pendingUndo === job) pendingUndo = null;
    return true;
  };
  job.run = async () => {
    if (!settle()) return;
    try {
      await commit();
    } catch (err) {
      restore();
      toast('Could not delete: ' + (err?.message || err));
    }
  };
  job.timer = setTimeout(job.run, ms);
  pendingUndo = job;
  toast(message, {
    action: 'Undo',
    ms,
    onAction: () => {
      if (!settle()) return;
      restore();
      toast('Restored');
    }
  });
  return job;
}

/** Copy of `list` with `item` back at `index` (no-op if a row with its id is already there). */
export function putBack(list, item, index) {
  if (list.some((x) => String(x.id) === String(item.id))) return list;
  const next = [...list];
  next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, item);
  return next;
}

/** Run a waiting delete now (if any). */
export const flushUndo = () => pendingUndo?.run();

export function applyDateDefaults(form) {
  const now = new Date(),
    today =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0'),
    month = today.slice(0, 7);
  form?.querySelectorAll('input[type="date"],input[type="month"]').forEach((input) => {
    if (!input.value) input.value = input.type === 'month' ? month : today;
  });
}

export function openModal(id) {
  if (id === 'residentModal' && !document.getElementById('residentForm').dataset.editResidentId) resetResidentForm();
  if (id === 'rentModal' || id === 'messageModal') refreshOptions();
  const form = document.querySelector('#' + id + ' form');
  applyDateDefaults(form);
  clearFormErrors(form); // errors from a previous attempt
  if (id === 'electricityModal') renderBillResidents();
  delete document.querySelector('#' + id + ' .modal')?.dataset.dirty; // a fresh open starts untouched
  document.getElementById(id).classList.add('show');
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  delete document.querySelector('#' + id + ' .modal')?.dataset.dirty;
  if (id === 'residentModal') resetResidentForm();
}

export function goPage(p) {
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === p));
  // Phone tab bar: pages kept in the "More" sheet light up the More tab instead
  document
    .getElementById('navMore')
    ?.classList.toggle('active', Boolean(document.querySelector(`.nav button[data-page="${p}"][data-more]`)));
  document.getElementById('crumbPage').textContent = pages[p][0];
  document.getElementById('dashboardPage').classList.toggle('hidden', p !== 'dashboard');
  document.getElementById('genericPage').classList.toggle('hidden', p === 'dashboard');
  if (p !== 'dashboard') {
    document.getElementById('pageTitle').textContent = pages[p][0];
    document.getElementById('pageDesc').textContent = pages[p][1];
    document.getElementById('tableTitle').textContent = pages[p][0];
    document.getElementById('searchInput').classList.toggle('hidden', !['residents', 'rent'].includes(p));
    const cta = document.getElementById('pageCta');
    cta.classList.remove('hidden');
    cta.disabled = false; // the button is shared by every page; undo a previous page's disabled state
    cta.removeAttribute('title');
    if (p === 'reports' || p === 'expenses') {
      cta.classList.add('hidden'); // these pages have their own action buttons
    } else if (p === 'residents') {
      cta.textContent = '＋ Add resident';
      cta.onclick = () => openModal('residentModal');
    } else if (p === 'rent') {
      cta.textContent = '＋ Record payment';
      cta.onclick = () => openModal('rentModal');
    } else if (p === 'electricity') {
      cta.textContent = '＋ Create bills';
      cta.onclick = () => openModal('electricityModal');
    } else if (p === 'settings') {
      // Edit is available only to the building's owner; users with no building get "Add" instead.
      const access = window.buildingAccess;
      cta.textContent = access === 'none' ? '＋ Add building details' : 'Edit building details';
      cta.disabled = access === 'partner' || !window.editPropertySetup;
      if (access === 'partner') cta.title = 'Only the building owner can edit building details';
      cta.onclick = () => window.editPropertySetup?.();
    } else {
      cta.textContent =
        p === 'messages' ? '＋ Draft reminder' : p === 'settings' ? 'Edit building details' : '＋ Add new';
      cta.onclick = () =>
        p === 'messages'
          ? goMessages()
          : p === 'settings'
            ? window.editPropertySetup
              ? window.editPropertySetup()
              : toast('Sign in to edit building details')
            : toast(pages[p][0] + ' setup is ready for the next build step');
    }
    renderPage(p);
  }
  document.querySelector('.main')?.scrollTo?.({top: 0, behavior: 'smooth'}); // .main is the scroller, not the window
}

export function renderPage(p) {
  if (p === 'residents') renderResidents();
  else if (p === 'rent') renderRent();
  else if (p === 'rooms') renderRooms();
  else if (p === 'electricity') renderElectricity();
  else if (p === 'reports') renderReports();
  else if (p === 'messages') renderMessages();
  else if (p === 'settings') renderSettings();
  else if (p === 'expenses') window.renderExpensesPage?.();
  else {
    document.getElementById('pageContent').innerHTML = emptyState({
      icon: 'inbox',
      title: `${pages[p][0]} workspace`,
      text: `Your ${pages[p][0].toLowerCase()} tools will live here.`
    });
    renderIcons();
  }
}

window.renderCurrentPage = () => {
  const page = Object.keys(pages).find((key) => pages[key][0] === document.getElementById('crumbPage').textContent);
  if (page && page !== 'dashboard') renderPage(page);
};

/**
 * Shared empty state: icon, title, one hint, one action.
 * `action.onclick` is an inline handler string (legacy pages); leave it out and bind the button yourself.
 * @param {{icon: string, title: string, text: string, action?: {label: string, onclick?: string, primary?: boolean}}} o
 */
export function emptyState({icon, title, text, action}) {
  const button = action
    ? `<button type="button" class="${action.primary ? 'primary' : 'secondary'}"${action.onclick ? ` onclick="${action.onclick}"` : ''}>${action.label}</button>`
    : '';
  return `<div class="empty-state"><i data-lucide="${icon}"></i><h3>${title}</h3><p class="sub">${text}</p>${button}</div>`;
}

/** Coloured status pill used on the Residents, Rent and Reports pages (colours live in CSS, so themes can change them). */
export function pillClass(status) {
  if (status === 'Overdue') return 'late';
  if (['Due', 'Due soon', 'Part paid'].includes(status)) return 'soon';
  if (status === 'Paid') return 'paid';
  if (status === 'Waived') return 'waived';
  return '';
}
export const statusPill = (status) => `<span class="pill ${pillClass(status)}">${esc(status)}</span>`;

export function initials(n) {
  return n
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
  );
}

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initUi() {
  // Backdrop clicks are handled for every popup in app/modal-layout.js (closes only when nothing was typed).
  document.querySelectorAll('.nav button').forEach((b) => (b.onclick = () => goPage(b.dataset.page)));
  // A delete waiting for its Undo window should not be lost when the user leaves or switches app.
  window.addEventListener('pagehide', flushUndo);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushUndo());
}
