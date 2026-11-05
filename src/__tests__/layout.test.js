// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeAll(async () => {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  await import('../expenses-ui.js');
});

describe('popup layout: fixed header, scrolling middle, fixed footer', () => {
  const staticModals = ['residentModal', 'rentModal', 'electricityModal', 'electricityPaymentModal', 'messageModal'];

  it.each(staticModals)('%s has head, body and footer as separate parts', (id) => {
    const modal = $(id).querySelector('.modal');
    const host = modal.querySelector(':scope > .modal-host') || modal;
    expect(modal.querySelector(':scope > .modalhead')).not.toBeNull();
    const body = host.querySelector(':scope > .modal-body');
    const foot = host.querySelector(':scope > .modal-foot');
    expect(body).not.toBeNull();
    expect(foot).not.toBeNull();
    expect(body.contains(foot)).toBe(false); // buttons are outside the scrolling area
    expect(host.lastElementChild).toBe(foot);
  });

  it('keeps footer buttons inside their form, so Save still submits it', () => {
    const form = $('residentForm');
    expect(form.querySelector('.modal-foot button.primary')).not.toBeNull();
    expect(form.elements.length).toBeGreaterThan(3); // fields are still part of the form
  });

  it('lays out the building setup form the same way', () => {
    const form = $('ownerSetupForm');
    expect(form.querySelector(':scope > .modalhead')).not.toBeNull();
    expect(form.querySelector(':scope > .modal-body #setupFlats')).not.toBeNull();
    expect(form.lastElementChild.classList.contains('modal-foot')).toBe(true);
  });

  it('also lays out popups created later in JS', async () => {
    const box = document.createElement('div');
    box.className = 'overlay show';
    box.innerHTML =
      '<form class="modal"><div class="modalhead"><h2>X</h2></div><div class="field">a</div><div class="formactions"><button>Save</button></div></form>';
    document.body.appendChild(box);
    await tick();
    const modal = box.querySelector('.modal');
    expect(modal.children[1].className).toBe('modal-body');
    expect(modal.lastElementChild.classList.contains('modal-foot')).toBe(true);
    box.remove();
  });
});

describe('close buttons', () => {
  it('every popup in the page has a labelled × in its header', () => {
    const modals = [...document.querySelectorAll('.modal')];
    expect(modals.length).toBeGreaterThanOrEqual(6);
    for (const m of modals) expect(m.querySelector('.modalhead .close')?.getAttribute('aria-label')).toBe('Close');
  });

  it('adds a working × to popups built without one', async () => {
    const box = document.createElement('div');
    box.className = 'overlay show';
    box.innerHTML = '<div class="modal"><div class="modalhead"><h2>Info</h2></div><p>Hello</p></div>';
    document.body.appendChild(box);
    await tick();
    const close = box.querySelector('.modalhead .close');
    expect(close).not.toBeNull();
    close.click();
    expect(box.isConnected).toBe(false);
  });
});

describe('outside click', () => {
  const overlay = () => $('rentModal');
  const backdropClick = () => overlay().dispatchEvent(new MouseEvent('click', {bubbles: true}));

  it('closes an untouched popup', () => {
    window.openModal('rentModal');
    backdropClick();
    expect(overlay().classList.contains('show')).toBe(false);
  });

  it('keeps a popup with typed changes open and nudges it; × still closes', () => {
    window.openModal('rentModal');
    const field = overlay().querySelector('input');
    field.value = '500';
    field.dispatchEvent(new Event('input', {bubbles: true}));
    backdropClick();
    expect(overlay().classList.contains('show')).toBe(true);
    expect(overlay().querySelector('.modal').classList.contains('nudge')).toBe(true);
    // the × runs onclick="closeModal('rentModal')"; jsdom evaluates inline handlers outside the app's globals, so call it
    expect(overlay().querySelector('.close').getAttribute('onclick')).toBe("closeModal('rentModal')");
    window.closeModal('rentModal');
    expect(overlay().classList.contains('show')).toBe(false);
  });

  it('starts clean when reopened', () => {
    window.openModal('rentModal');
    backdropClick();
    expect(overlay().classList.contains('show')).toBe(false);
  });

  it('ignores clicks inside the card', () => {
    window.openModal('rentModal');
    overlay()
      .querySelector('.modal-body')
      .dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(overlay().classList.contains('show')).toBe(true);
    window.closeModal('rentModal');
  });

  it('applies to popups built in JS too', async () => {
    const box = document.createElement('div');
    box.className = 'overlay show';
    box.innerHTML = '<form class="modal"><div class="modalhead"><h2>X</h2></div><input name="a"></form>';
    document.body.appendChild(box);
    await tick();
    box.querySelector('input').dispatchEvent(new Event('input', {bubbles: true}));
    box.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(box.isConnected).toBe(true); // typed: stays
    box.querySelector('.close').click();
    expect(box.isConnected).toBe(false);
  });
});

describe('phone tab bar: 4 tabs + More', () => {
  it('marks only the secondary pages for the More sheet', () => {
    const more = [...document.querySelectorAll('.nav button[data-more]')].map((b) => b.dataset.page);
    const main = [...document.querySelectorAll('.nav button:not([data-more])')].map((b) => b.dataset.page);
    expect(main).toEqual(['dashboard', 'residents', 'rent', 'expenses']);
    expect(more).toEqual(['rooms', 'electricity', 'messages', 'reports', 'settings']);
  });

  it('opens a sheet listing those pages plus tour and log out, and navigates from it', () => {
    $('navMore').click();
    const sheet = $('moreSheet');
    expect(sheet).not.toBeNull();
    const labels = [...sheet.querySelectorAll('.sheet-grid button')].map((b) => b.textContent.trim());
    expect(labels).toEqual(['Flats', 'Electricity bills', 'Messages', 'Reports', 'Settings']);
    expect(sheet.querySelector('[data-act="logout"]')).not.toBeNull();
    sheet.querySelector('.sheet-grid button[data-i="4"]').click(); // Settings
    expect($('moreSheet')).toBeNull();
    expect($('crumbPage').textContent).toBe('Settings');
    expect($('navMore').classList.contains('active')).toBe(true); // Settings lives under More
  });

  it('has a × that closes the sheet', () => {
    $('navMore').click();
    $('moreSheet').querySelector('.sheet-close').click();
    expect($('moreSheet')).toBeNull();
  });

  it('closes on Escape', () => {
    $('navMore').click();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect($('moreSheet')).toBeNull();
  });
});

describe('Expenses & profit is a normal page', () => {
  it('opens from its nav button through goPage', () => {
    document.querySelector('.nav button[data-page="expenses"]').click();
    expect($('crumbPage').textContent).toBe('Expenses & profitability');
    expect($('pageCta').classList.contains('hidden')).toBe(true);
    expect($('pageContent').textContent).toContain('Expenses & profitability');
    expect($('navMore').classList.contains('active')).toBe(false);
  });

  it('exists once in the sidebar (no runtime duplicate)', () => {
    expect(document.querySelectorAll('[data-page="expenses"]').length).toBe(1);
  });
});

describe('icons', () => {
  it('replaces the icon placeholders with SVGs', () => {
    expect(document.querySelectorAll('i[data-lucide]').length).toBe(0);
    expect(document.querySelectorAll('.nav svg').length).toBeGreaterThanOrEqual(9);
  });
});
