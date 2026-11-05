// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const html = read('index.html');
const $ = (id) => document.getElementById(id);

/** Fake prefers-color-scheme with a switchable value and change listeners. */
const device = {dark: false, listeners: []};
window.matchMedia = (q) => ({
  get matches() {
    return q === '(prefers-color-scheme: dark)' ? device.dark : false;
  },
  addEventListener: (_, fn) => device.listeners.push(fn)
});
const deviceSwitch = (dark) => {
  device.dark = dark;
  device.listeners.forEach((fn) => fn());
};

let theme;
beforeAll(async () => {
  document.head.innerHTML = '<meta name="theme-color" content="#153b30">'; // the harness only loads <body>
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  theme = await import('../app/theme.js');
});
beforeEach(() => {
  localStorage.clear();
  device.dark = false;
  theme.applyTheme();
});

const current = () => document.documentElement.dataset.theme;

describe('theme choice', () => {
  it('follows the device by default', () => {
    expect(theme.themeChoice()).toBe('system');
    expect(current()).toBe('light');
    deviceSwitch(true);
    expect(current()).toBe('dark'); // reacts live, e.g. automatic dark mode at sunset
  });

  it('an explicit choice wins over the device and is remembered', () => {
    theme.setTheme('light');
    deviceSwitch(true);
    expect(current()).toBe('light');
    expect(localStorage.getItem('staywise-theme')).toBe('light');
    theme.setTheme('system');
    expect(localStorage.getItem('staywise-theme')).toBeNull();
    expect(current()).toBe('dark');
  });

  it('ignores junk in storage', () => {
    localStorage.setItem('staywise-theme', 'purple');
    expect(theme.themeChoice()).toBe('system');
  });

  it('survives logout, which only clears staywise_* keys', () => {
    expect(theme.THEME_KEY.startsWith('staywise_')).toBe(false);
  });

  it('updates the phone status bar colour', () => {
    theme.setTheme('dark');
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#0a120f');
  });
});

describe('top bar toggle', () => {
  it('flips the theme and says what it will do next', () => {
    const btn = $('themeToggle');
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark theme');
    btn.click();
    expect(current()).toBe('dark');
    expect(localStorage.getItem('staywise-theme')).toBe('dark');
    expect(btn.getAttribute('aria-label')).toBe('Switch to light theme');
    btn.click();
    expect(current()).toBe('light');
  });
});

describe('login page toggle', () => {
  it('is on the sign-in screen and stays in step with the top bar one', () => {
    const login = $('authThemeToggle');
    expect($('authGate').contains(login)).toBe(true);
    login.click();
    expect(current()).toBe('dark');
    expect(login.getAttribute('aria-label')).toBe('Switch to light theme');
    expect($('themeToggle').getAttribute('aria-label')).toBe('Switch to light theme');
  });
});

describe('Settings → Appearance', () => {
  it('offers Device / Light / Dark with the current one checked', () => {
    theme.setTheme('dark');
    window.goPage('settings');
    const options = [...document.querySelectorAll('#appearanceSection [data-theme-choice]')];
    expect(options.map((b) => b.textContent.trim())).toEqual(['Device', 'Light', 'Dark']);
    expect(options.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    window.setTheme('system'); // what the inline onclick calls
    expect(options.map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });
});

describe('no white flash and complete dark palette', () => {
  it('sets data-theme in <head> before the stylesheet loads', () => {
    const head = html.match(/<head>([\s\S]*)<\/head>/)[1];
    const script = head.indexOf("localStorage.getItem('staywise-theme')");
    expect(script).toBeGreaterThan(-1);
    const firstStyle = head.search(/<link[^>]+stylesheet|<script type="module"/);
    if (firstStyle > -1) expect(script).toBeLessThan(firstStyle);
  });

  it('dark theme overrides every surface, text, line and status colour', () => {
    const css = read('src/styles/base.css');
    const block = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
    const names = (text) => new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const dark = names(block("[data-theme='dark'] {"));
    // Kept the same on purpose: accents that work on both backgrounds, and text placed on those accents.
    const shared = new Set(['--lime', '--orange', '--white', '--on-lime']);
    const missing = [...names(block(':root {'))].filter((n) => !shared.has(n) && !dark.has(n));
    expect(missing).toEqual([]);
  });

  it('component styles use theme tokens, not hard-coded light backgrounds', () => {
    for (const f of ['base.css', 'modals.css', 'overrides.css', 'onboarding.css']) {
      const css = read('src/styles/' + f).replace(/:root \{[^}]*\}/, '');
      expect(css, f).not.toMatch(/background(-color)?:\s*(#fff\b|#ffffff\b|white\b)/i);
    }
  });

  it('no rule pairs theme-switching text with a fixed background (light-on-light in dark mode)', () => {
    // The owner avatar had color: var(--warn-ink) on background: #f5c99c; in dark mode the ink turned light peach.
    const bad = [];
    for (const f of ['base.css', 'modals.css', 'overrides.css', 'onboarding.css', 'notice.css', 'landing.css']) {
      const css = read('src/styles/' + f).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/:root|data-theme/.test(sel)) continue;
        const color = body.match(/(?:^|;|\s)color:\s*([^;]+)/)?.[1] || '',
          bg = body.match(/background(?:-color)?:\s*([^;]+)/)?.[1] || '';
        if (color.includes('var(') && /^#[0-9a-f]{3,8}$/i.test(bg.trim())) bad.push(f + ' ' + sel.trim());
      }
    }
    expect(bad).toEqual([]);
  });
});
