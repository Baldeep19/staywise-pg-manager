/**
 * Light / dark theme.
 * Choice is 'system' (default: follow the phone/computer setting), 'light' or 'dark', remembered per device in
 * localStorage under "staywise-theme" — a dash, not "staywise_", so logging out (which clears staywise_* keys)
 * keeps it. The resolved theme is written to <html data-theme>, and CSS variables in styles/base.css do the rest.
 * index.html sets data-theme with a tiny inline script before the CSS loads, so there is no light flash on start.
 */
export const THEME_KEY = 'staywise-theme';
const CHOICES = ['system', 'light', 'dark'];
const META = {light: '#153b30', dark: '#0a120f'}; // phone status bar colour

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function themeChoice() {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function resolvedTheme(choice = themeChoice()) {
  if (choice !== 'system') return choice;
  return darkQuery()?.matches ? 'dark' : 'light';
}

/** Apply the current choice to the page and update every theme control. */
export function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme]);
  const next = theme === 'dark' ? 'light' : 'dark';
  // Top bar and login page both have a toggle
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.setAttribute('aria-label', `Switch to ${next} theme`);
    toggle.title = `Switch to ${next} theme`;
  });
  const choice = themeChoice();
  document.querySelectorAll('[data-theme-choice]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.themeChoice === choice));
    b.classList.toggle('active', b.dataset.themeChoice === choice);
  });
  document.dispatchEvent(new CustomEvent('themechange', {detail: {theme}}));
}

export function setTheme(choice) {
  if (!CHOICES.includes(choice)) choice = 'system';
  if (choice === 'system') localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, choice);
  applyTheme();
}

/** Top bar / login page button: flip what is on screen now (an explicit choice, so it stops following the device). */
export const toggleTheme = () => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');

/** Settings → Appearance: System / Light / Dark. */
export function renderThemeSection() {
  const choice = themeChoice();
  const option = (value, icon, label) =>
    `<button type="button" role="radio" class="seg-btn${choice === value ? ' active' : ''}" data-theme-choice="${value}" aria-checked="${choice === value}" onclick="setTheme('${value}')"><i data-lucide="${icon}"></i>${label}</button>`;
  return `<section class="report-block" id="appearanceSection">
        <div class="report-blockhead"><h3>Appearance</h3><p>“Device” follows your phone or computer setting.</p></div>
        <div class="seg" role="radiogroup" aria-label="Theme">${option('system', 'monitor', 'Device')}${option('light', 'sun', 'Light')}${option('dark', 'moon', 'Dark')}</div>
      </section>`;
}

export function initTheme() {
  applyTheme();
  // Following the device: react when it switches (e.g. automatic dark mode at sunset).
  darkQuery()?.addEventListener?.('change', () => themeChoice() === 'system' && applyTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => (toggle.onclick = toggleTheme));
}
