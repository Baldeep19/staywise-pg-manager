/**
 * Guided product tour: walks a new user through each area of the app, opening the page it describes
 * and highlighting its menu item. Pure UI — persistence ("has this user seen it?") lives in the caller.
 */
import {goPage} from './ui.js';

const nav = (page) => `.nav button[data-page="${page}"]`;

/** One entry per step. `page` is opened first; `target` is highlighted (omit it for a centred card). */
export const TOUR_STEPS = [
  {
    title: 'Welcome to Staywise 👋',
    body: 'This 1-minute tour shows what you can do in each part of the app. You can skip it any time and replay it later from Settings → About.'
  },
  {
    target: '#propertySelect',
    title: 'Your buildings',
    body: 'Switch between buildings here. Managing more than one building? Add another from Settings → Create new building.'
  },
  {
    page: 'dashboard',
    target: nav('dashboard'),
    title: 'Overview',
    body: 'Your day at a glance: residents, occupancy, rent collected this month, pending dues and deposits.'
  },
  {
    page: 'residents',
    target: nav('residents'),
    title: 'Residents',
    body: 'Add residents, assign them to a flat, record rent and deposit, and send rent reminders on WhatsApp.'
  },
  {
    page: 'rooms',
    target: nav('rooms'),
    title: 'Flats',
    body: 'See which rooms are occupied, who lives where, and keep each flat’s Wi-Fi details in one place.'
  },
  {
    page: 'rent',
    target: nav('rent'),
    title: 'Rent & payments',
    body: 'Record payments as they arrive and see every resident’s balance for the month.'
  },
  {
    page: 'electricity',
    target: nav('electricity'),
    title: 'Electricity bills',
    body: 'Enter meter readings and let Staywise split the bill between residents, then track who has paid.'
  },
  {
    page: 'messages',
    target: nav('messages'),
    title: 'Messages',
    body: 'Draft ready-made WhatsApp reminders for rent and electricity dues.'
  },
  {
    page: 'reports',
    target: nav('reports'),
    title: 'Reports',
    body: 'Monthly rent and electricity collection, outstanding dues and meter readings, flat by flat.'
  },
  {
    page: 'expenses',
    target: '[data-page="expenses"]',
    title: 'Expenses & profit',
    body: 'Log what you spend and who paid. Add co-owners with “Manage partner” and see each partner’s profit share.'
  },
  {
    page: 'settings',
    target: nav('settings'),
    title: 'Settings',
    body: 'Edit building details, create more buildings, find install instructions for your phone or computer, and log out.'
  },
  {
    title: 'You’re all set 🎉',
    body: 'Start by adding your first resident from the Residents page. Replay this tour any time from Settings → About.'
  }
];

let active = null;

/** True while a tour is on screen. */
export const isTourActive = () => active !== null;

const isVisible = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** Open the page for a step (the Expenses page is installed by its own module, so it is reached by clicking). */
function openPage(page) {
  if (!page) return;
  if (page === 'expenses') document.querySelector('[data-page="expenses"]')?.click();
  else goPage(page);
}

/**
 * Start the tour.
 * @param {{onDone?: (result: {skipped: boolean}) => void}} [options] onDone fires when the tour ends, however it ends.
 */
export function startTour({onDone} = {}) {
  active?.finish(true, false); // never stack two tours
  let index = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'tour-backdrop';
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'tourTitle');
  card.setAttribute('aria-describedby', 'tourBody');
  document.body.append(backdrop, spot, card);

  function position(el) {
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
    if (!isVisible(el)) {
      spot.style.display = 'none';
      backdrop.classList.add('dim');
      card.style.left = `${Math.max(margin, (vw - cw) / 2)}px`;
      card.style.top = `${Math.max(margin, (vh - ch) / 2)}px`;
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    backdrop.classList.remove('dim');
    Object.assign(spot.style, {
      display: 'block',
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`
    });
    // Prefer the right of the target, then below it, then centred.
    if (r.right + 16 + cw <= vw - margin) {
      card.style.left = `${r.right + 16}px`;
      card.style.top = `${clamp(r.top, margin, vh - ch - margin)}px`;
    } else if (r.bottom + 12 + ch <= vh - margin) {
      card.style.left = `${clamp(r.left, margin, vw - cw - margin)}px`;
      card.style.top = `${r.bottom + 12}px`;
    } else {
      card.style.left = `${Math.max(margin, (vw - cw) / 2)}px`;
      card.style.top = `${Math.max(margin, (vh - ch) / 2)}px`;
    }
  }

  function show() {
    const step = TOUR_STEPS[index];
    openPage(step.page);
    const el = step.target ? document.querySelector(step.target) : null;
    el?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    const last = index === TOUR_STEPS.length - 1;
    card.innerHTML = `
      <div class="tour-progress">Step ${index + 1} of ${TOUR_STEPS.length}</div>
      <h3 id="tourTitle">${step.title}</h3>
      <p id="tourBody">${step.body}</p>
      <div class="tour-actions">
        ${last ? '' : '<button type="button" class="tour-skip">Skip tour</button>'}
        <span class="tour-spacer"></span>
        ${index > 0 ? '<button type="button" class="secondary tour-back">Back</button>' : ''}
        <button type="button" class="primary tour-next">${last ? 'Finish' : 'Next'}</button>
      </div>`;
    card.querySelector('.tour-skip')?.addEventListener('click', () => finish(true));
    card.querySelector('.tour-back')?.addEventListener('click', back);
    card.querySelector('.tour-next').addEventListener('click', next);
    position(el);
    card.querySelector('.tour-next').focus();
  }

  function next() {
    if (index >= TOUR_STEPS.length - 1) return finish(false);
    index += 1;
    show();
  }
  function back() {
    if (index === 0) return;
    index -= 1;
    show();
  }
  function finish(skipped, callDone = true) {
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    backdrop.remove();
    spot.remove();
    card.remove();
    active = null;
    if (callDone) {
      goPage('dashboard'); // leave the user on the Overview
      onDone?.({skipped});
    }
  }
  function onKey(e) {
    if (e.key === 'Escape') finish(true);
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  }
  function onResize() {
    const step = TOUR_STEPS[index];
    position(step.target ? document.querySelector(step.target) : null);
  }

  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  active = {finish};
  show();
  return {next, back, finish: () => finish(true)};
}
