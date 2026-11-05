// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach, beforeAll, describe, expect, it} from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0)); // MutationObserver callbacks run after the current task
const key = (k, opts = {}) => {
  const e = new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true, ...opts});
  document.dispatchEvent(e);
  return e;
};

let focusablesIn;
beforeAll(async () => {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  ({focusablesIn} = await import('../app/dialog-focus.js'));
});

afterEach(async () => {
  document.querySelectorAll('.overlay.show').forEach((o) => (o.id ? o.classList.remove('show') : o.remove()));
  delete window.matchMedia;
  await tick();
});

/** A popup built in JS the way rooms/partners/expenses build theirs. */
function jsPopup() {
  const box = document.createElement('div');
  box.className = 'overlay show';
  box.innerHTML = `<div class="modal"><div class="modalhead"><h3>Flat details</h3></div>
    <label class="field"><span>Name</span><input name="a"></label>
    <label class="field"><span>Hidden</span><input name="b" class="hidden"></label>
    <div class="formactions"><button type="button" class="secondary">Cancel</button><button class="primary">Save</button></div></div>`;
  document.body.appendChild(box);
  return box;
}

describe('focus moves into a popup and back out', () => {
  it('focuses the first field of a static popup, and returns focus to the opener on close', async () => {
    const opener = $('pageCta');
    opener.focus();
    window.openModal('rentModal');
    await tick();
    expect($('rentModal').contains(document.activeElement)).toBe(true);
    expect(document.activeElement.name).toBe('resident'); // first field, not the × button
    window.closeModal('rentModal');
    await tick();
    expect(document.activeElement).toBe(opener);
  });

  it('works for popups built in JS (appended, then removed)', async () => {
    const opener = $('pageCta');
    opener.focus();
    const box = jsPopup();
    await tick();
    expect(document.activeElement.name).toBe('a');
    box.remove();
    await tick();
    expect(document.activeElement).toBe(opener);
  });

  it('on touch screens focuses the card instead of a field (no keyboard pop-up)', async () => {
    window.matchMedia = (q) => ({matches: q === '(pointer: coarse)'});
    jsPopup();
    await tick();
    const card = document.querySelector('.overlay.show .modal');
    expect(document.activeElement).toBe(card);
    expect(card.getAttribute('tabindex')).toBe('-1'); // focusable by script, not part of the Tab order
  });
});

describe('Tab stays inside the popup', () => {
  it('wraps from the last control to the first and back', async () => {
    const box = jsPopup();
    await tick();
    const items = focusablesIn(box);
    expect(items.map((el) => el.name || el.textContent)).toEqual(['×', 'a', 'Cancel', 'Save']); // hidden field skipped
    items.at(-1).focus();
    expect(key('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    expect(key('Tab', {shiftKey: true}).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items.at(-1));
  });

  it('pulls focus back in if it is on the page behind', async () => {
    const box = jsPopup();
    await tick();
    $('pageCta').focus();
    key('Tab');
    expect(box.contains(document.activeElement)).toBe(true);
  });

  it('leaves Tab alone in the middle of the popup and when no popup is open', async () => {
    const box = jsPopup();
    await tick();
    focusablesIn(box)[1].focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    box.remove();
    await tick();
    expect(key('Tab').defaultPrevented).toBe(false);
  });
});

describe('Esc closes the topmost popup', () => {
  it('closes a JS popup through its ×', async () => {
    const box = jsPopup();
    await tick();
    key('Escape');
    expect(box.isConnected).toBe(false);
  });

  it('presses the × of a static popup (so its own close logic runs)', async () => {
    window.openModal('rentModal');
    await tick();
    let clicked = false;
    // jsdom cannot run the inline onclick="closeModal(...)" against app globals, so swap in a spy
    $('rentModal').querySelector('.modalhead .close').onclick = () => (clicked = true);
    key('Escape');
    expect(clicked).toBe(true);
  });

  it('only closes the top one when two are open', async () => {
    window.openModal('rentModal');
    const box = jsPopup();
    await tick();
    let rentClosed = false;
    $('rentModal').querySelector('.close').onclick = () => (rentClosed = true);
    key('Escape');
    expect(box.isConnected).toBe(false);
    expect(rentClosed).toBe(false);
  });
});

describe('screen-reader and phone keyboard hints', () => {
  it('marks every popup card as a modal dialog named by its heading', () => {
    for (const id of ['residentModal', 'rentModal', 'electricityModal', 'electricityPaymentModal', 'messageModal']) {
      const card = $(id).querySelector('.modal');
      expect(card.getAttribute('role')).toBe('dialog');
      expect(card.getAttribute('aria-modal')).toBe('true');
      const title = document.getElementById(card.getAttribute('aria-labelledby'));
      expect(title?.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('shows the number pad for money fields and the phone pad for phone fields', () => {
    const resident = $('residentForm').elements;
    expect(resident.phone.getAttribute('inputmode')).toBe('tel');
    expect(resident.phone.getAttribute('autocomplete')).toBe('off'); // a resident's number, not the owner's
    expect(resident.rent.getAttribute('inputmode')).toBe('numeric');
    expect(resident.deposit.getAttribute('inputmode')).toBe('numeric');
    expect($('rentForm').elements.amount.getAttribute('inputmode')).toBe('decimal');
  });
});
