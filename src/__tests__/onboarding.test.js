// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import pkg from '../../package.json';

/** The signed-in user has never seen the tour (no tour_completed flag). */
const updateUser = vi.fn(async () => ({error: null}));
const rows = {
  properties: [{id: 'p1', owner_id: 'u1', name: 'Sunrise PG', setup_complete: true}],
  flats: [{id: 'f1', flat_number: 'A-101', floor_name: 'Ground', room_count: 2, active: true}]
};
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
      auth: {
        getSession: async () => ({data: {session: {user: {id: 'u1', email: 'o@example.com'}}}, error: null}),
        updateUser: (...a) => updateUser(...a)
      },
      from: query,
      rpc: async () => ({data: [], error: null}),
      channel: () => channel,
      removeChannel: () => {}
    })
  };
});

const $ = (sel) => document.querySelector(sel);

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  await import('../cloud/index.js'); // loads the session; for this user the tour is scheduled
});

describe('first-time tour', () => {
  it('starts on its own for a user who has not seen it, and saves "seen" when finished', async () => {
    await vi.waitFor(() => expect($('.tour-card')).not.toBeNull(), {timeout: 2000});
    expect($('.tour-card h3').textContent).toContain('Welcome');
    expect($('.tour-progress').textContent).toMatch(/Step 1 of \d+/);
    expect(updateUser).not.toHaveBeenCalled();

    // Walk to the end: every step opens its page and has a title.
    const seen = [];
    for (let i = 0; i < 40 && $('.tour-card .tour-next').textContent !== 'Finish'; i++) {
      seen.push($('.tour-card h3').textContent);
      $('.tour-card .tour-next').click();
    }
    expect(seen).toEqual(expect.arrayContaining(['Residents', 'Rent & payments', 'Electricity bills', 'Settings']));
    $('.tour-card .tour-next').click(); // Finish
    expect($('.tour-card')).toBeNull();
    expect(updateUser).toHaveBeenCalledWith({data: {tour_completed: true}});
  });
});

describe('tour controls', () => {
  it('highlights the menu item for the step and moves the app to that page', () => {
    window.startTour();
    $('.tour-card .tour-next').click(); // building selector
    $('.tour-card .tour-next').click(); // Overview
    $('.tour-card .tour-next').click(); // Residents
    expect($('.tour-card h3').textContent).toBe('Residents');
    expect(document.getElementById('crumbPage').textContent).toBe('Residents');
    expect($('.tour-spot')).not.toBeNull();
    $('.tour-card .tour-skip').click();
  });

  it('supports Back and the keyboard (arrows, Escape) and reports skipping', () => {
    const onDone = vi.fn();
    // startTour is exposed for the Settings button; use the module directly to observe onDone
    return import('../app/tour.js').then(({startTour, isTourActive}) => {
      startTour({onDone});
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
      expect($('.tour-progress').textContent).toMatch(/Step 2 of/);
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
      expect($('.tour-progress').textContent).toMatch(/Step 1 of/);
      expect($('.tour-back')).toBeNull(); // nothing before step 1
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      expect(isTourActive()).toBe(false);
      expect(onDone).toHaveBeenCalledWith({skipped: true});
      expect($('.tour-card')).toBeNull();
    });
  });

  it('never stacks two tours', () => {
    window.startTour();
    window.startTour();
    expect(document.querySelectorAll('.tour-card')).toHaveLength(1);
    $('.tour-card .tour-skip').click();
  });
});

describe('Settings: install guide and About', () => {
  it('shows install instructions for each platform and the About section with the version', () => {
    window.goPage('settings');
    const text = document.getElementById('pageContent').textContent;
    for (const title of ['iPhone / iPad (Safari)', 'Android (Chrome)', 'Windows / Mac / Linux', 'Mac (Safari)'])
      expect(text).toContain(title);
    expect(text).toContain('Add to Home Screen');
    expect(text).toContain('About Staywise');
    expect(text).toContain(`Version ${pkg.version}`);
  });

  it('replays the tour from the About section', () => {
    window.goPage('settings');
    const button = [...document.querySelectorAll('#aboutSection button')].find((b) => /tour/i.test(b.textContent));
    expect(button.getAttribute('onclick')).toBe('startTour()'); // jsdom cannot run inline handlers, so call it directly
    window.startTour();
    expect($('.tour-card')).not.toBeNull();
    $('.tour-card .tour-skip').click();
  });

  it('offers one-click install once the browser fires beforeinstallprompt', async () => {
    const prompt = vi.fn();
    const event = new Event('beforeinstallprompt', {cancelable: true});
    event.prompt = prompt;
    event.userChoice = Promise.resolve({outcome: 'accepted'});
    const installButton = () =>
      [...document.querySelectorAll('#installSection button')].find((b) => b.textContent === 'Install Staywise');
    window.goPage('settings');
    expect(installButton()).toBeUndefined();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // we keep the prompt for our own button
    expect(installButton().getAttribute('onclick')).toBe('installApp()');
    await window.installApp();
    expect(prompt).toHaveBeenCalled();
    expect(installButton()).toBeUndefined(); // a prompt can only be used once
  });
});

describe('platform detection', () => {
  it.each([
    ['iPhone Safari', {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'}, 'ios'],
    [
      'iPad (desktop-class UA)',
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
        platform: 'MacIntel',
        maxTouchPoints: 5
      },
      'ios'
    ],
    ['Android Chrome', {userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36'}, 'android'],
    ['Windows Edge', {userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0'}, 'desktop'],
    [
      'Mac Chrome',
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36',
        platform: 'MacIntel',
        maxTouchPoints: 0
      },
      'desktop'
    ],
    [
      'Mac Safari',
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0
      },
      'mac-safari'
    ],
    ['Firefox desktop', {userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'}, 'other']
  ])('%s -> %s', async (_name, nav, expected) => {
    const {detectPlatform} = await import('../app/install.js');
    expect(detectPlatform(nav)).toBe(expected);
  });
});
