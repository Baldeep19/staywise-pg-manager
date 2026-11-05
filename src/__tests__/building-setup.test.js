// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Scenario data, swapped per test. The mock reads these when the app starts up.
let user;
let rows;
vi.mock('@supabase/supabase-js', () => {
  const query = (table) => {
    const q = {then: (res) => res({data: rows[table] ?? [], error: null})};
    for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'single'])
      q[m] = () => q;
    return q;
  };
  const channel = {on: () => channel, subscribe: () => channel};
  return {
    createClient: () => ({
      auth: {getSession: async () => ({data: {session: {user}}, error: null})},
      from: query,
      rpc: async () => ({data: [], error: null}),
      channel: () => channel,
      removeChannel: () => {}
    })
  };
});

const $ = (id) => document.getElementById(id);
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const BUILDING = {id: 'p1', owner_id: 'u1', name: 'Sunrise PG', address: '12 Lake Rd', setup_complete: true};
const FLAT = {id: 'f1', flat_number: 'A-101', floor_name: 'Ground', room_count: 3, wifi_ssid: 'sunrise', active: true};
const seenTour = {tour_completed: true}; // keep the tour out of the way

/** Load the page fresh, run the app start-up for the current scenario, and open Settings. */
async function boot() {
  vi.resetModules();
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  await import('../cloud/index.js');
}
const openSettings = () => {
  window.goPage('settings');
  return $('pageCta');
};

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
});
afterEach(() => vi.unstubAllEnvs());

describe('user with no building and no details from sign-up', () => {
  beforeEach(async () => {
    user = {id: 'u1', email: 'new@example.com', user_metadata: {full_name: 'New Owner', ...seenTour}};
    rows = {properties: [], flats: []};
    await boot();
  });

  it('is not interrupted by the building setup screen', () => {
    expect($('ownerSetupGate').style.display).toBe('none');
    expect($('authGate').style.display).toBe('none');
    expect($('noBuildingBanner').hidden).toBe(false); // gentle pointer instead
  });

  it('can add a building later from Settings (empty form, Cancel closes it)', () => {
    const cta = openSettings();
    expect(cta.textContent).toBe('＋ Add building details');
    expect(cta.disabled).toBe(false);
    cta.click();
    expect($('ownerSetupGate').style.display).toBe('block');
    expect($('ownerSetupForm').elements.propertyName.value).toBe('');
    expect($('skipPropertySetup').textContent).toBe('Cancel');
    $('skipPropertySetup').click();
    expect($('ownerSetupGate').style.display).toBe('none');
    expect(localStorage.getItem('staywise_skip_setup')).toBeNull(); // cancelling is not "skipping setup"
  });
});

describe('user who gave building details at sign-up', () => {
  it('sees the setup form first, pre-filled with what they entered', async () => {
    user = {
      id: 'u1',
      email: 'new@example.com',
      user_metadata: {
        full_name: 'New Owner',
        ...seenTour,
        pending_property: {
          name: 'Greenwood',
          address: 'MG Road',
          flats: [{flat_number: 'F1', floor_name: 'First', room_count: 2}]
        }
      }
    };
    rows = {properties: [], flats: []};
    await boot();
    expect($('ownerSetupGate').style.display).toBe('block');
    expect($('ownerSetupForm').elements.propertyName.value).toBe('Greenwood');
    expect($('skipPropertySetup').textContent).toBe('Skip for now');
    expect($('ownerSetupGate').classList.contains('setup-popup')).toBe(false); // first run stays full screen
    expect($('setupClose').hidden).toBe(true); // it offers "Skip for now" instead of ×
    $('skipPropertySetup').click(); // they can still skip and add it later
    expect($('ownerSetupGate').style.display).toBe('none');
    expect($('noBuildingBanner').hidden).toBe(false);
  });
});

describe('user who owns a building', () => {
  beforeEach(async () => {
    user = {id: 'u1', email: 'o@example.com', user_metadata: {full_name: 'Owner One', ...seenTour}};
    rows = {properties: [BUILDING], flats: [FLAT]};
    await boot();
  });

  it('can edit it, and the form is pre-filled with the existing details', () => {
    const cta = openSettings();
    expect(cta.textContent).toBe('Edit building details');
    expect(cta.disabled).toBe(false);
    cta.click();
    const form = $('ownerSetupForm').elements;
    expect(form.propertyName.value).toBe('Sunrise PG');
    expect(form.propertyAddress.value).toBe('12 Lake Rd');
    const flat = document.querySelector('.setup-flat');
    expect(flat.querySelector('[name=flat_number]').value).toBe('A-101');
    expect(flat.querySelector('[name=room_count]').value).toBe('3');
    expect(flat.querySelector('[name=wifi_ssid]').value).toBe('sunrise');
    expect($('skipPropertySetup').textContent).toBe('Cancel');
    expect($('noBuildingBanner').hidden).toBe(true);
  });

  it('opens edit as a dismissable popup (backdrop click or Esc), not a full page', () => {
    openSettings().click();
    expect($('ownerSetupGate').classList.contains('setup-popup')).toBe(true);
    $('ownerSetupForm').dispatchEvent(new MouseEvent('click', {bubbles: true})); // click inside the form: stays open
    expect($('ownerSetupGate').style.display).toBe('block');
    $('ownerSetupGate').click(); // click on the dimmed backdrop
    expect($('ownerSetupGate').style.display).toBe('none');
    openSettings().click();
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect($('ownerSetupGate').style.display).toBe('none');
  });

  it('keeps the popup open on an outside click once something was typed', () => {
    openSettings().click();
    const name = $('ownerSetupForm').elements.propertyName;
    name.value = 'Sunrise PG 2';
    name.dispatchEvent(new Event('input', {bubbles: true}));
    $('ownerSetupGate').click();
    expect($('ownerSetupGate').style.display).toBe('block');
    $('setupClose').click();
    expect($('ownerSetupGate').style.display).toBe('none');
    openSettings().click(); // reopening starts clean again
    $('ownerSetupGate').click();
    expect($('ownerSetupGate').style.display).toBe('none');
  });

  it('closes the popup with its ×', () => {
    openSettings().click();
    expect($('setupClose').hidden).toBe(false);
    $('setupClose').click();
    expect($('ownerSetupGate').style.display).toBe('none');
  });

  it('opens "Create new building" as a popup too', () => {
    window.createNewBuilding();
    expect($('ownerSetupGate').classList.contains('setup-popup')).toBe(true);
    expect($('ownerSetupGate').style.display).toBe('block');
  });

  it('does not use the "skip setup" shortcut when cancelling an edit', () => {
    openSettings().click();
    $('skipPropertySetup').click();
    expect($('ownerSetupGate').style.display).toBe('none');
    expect(localStorage.getItem('staywise_skip_setup')).toBeNull();
  });
});

describe("user viewing someone else's building (partner)", () => {
  it('cannot edit building details', async () => {
    user = {id: 'u2', email: 'p@example.com', user_metadata: {full_name: 'Partner', ...seenTour}};
    rows = {properties: [BUILDING], flats: [FLAT]}; // owned by u1, shared with u2
    await boot();
    const cta = openSettings();
    expect(cta.textContent).toBe('Edit building details');
    expect(cta.disabled).toBe(true);
    expect(cta.title).toMatch(/only the building owner/i);
  });

  it('re-enables the shared button on other pages', async () => {
    window.goPage('rent');
    expect($('pageCta').disabled).toBe(false);
  });
});
