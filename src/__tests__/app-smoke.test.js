// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';

/** Handlers that index.html or generated markup call by name from inline `onclick` attributes. */
const INLINE_HANDLERS = [
  'calculateElectricitySplit',
  'closeModal',
  'draftRent',
  'draftResidentRentReminder',
  'goPage',
  'launchWhatsApp',
  'markElectricityAmount',
  'markElectricityManual',
  'openModal',
  'refreshMeterPreviousReadings',
  'renderBillResidents',
  'renderReports',
  'renderResidents',
  'shareBill'
];
const PAGES = ['dashboard', 'residents', 'rooms', 'rent', 'electricity', 'messages', 'reports', 'settings'];

beforeAll(async () => {
  // Load the real markup (without scripts) so every getElementById in the app finds its element.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
  window.scrollTo = () => {};
  window.pgFlats = [{flat_number: 'A-101', floor_name: 'Floor 1', wifi_ssid: 'net', wifi_password: 'pw'}];
  await import('../main.js');
});

describe('app bootstrap', () => {
  it.each(INLINE_HANDLERS)('exposes window.%s for inline handlers', (name) => {
    expect(typeof window[name]).toBe('function');
  });

  it.each(PAGES)('navigates to the %s page without throwing', (page) => {
    expect(() => window.goPage(page)).not.toThrow();
    expect(document.getElementById('crumbPage').textContent).not.toBe('');
  });

  it('shows and hides a modal', () => {
    window.openModal('rentModal');
    expect(document.getElementById('rentModal').classList.contains('show')).toBe(true);
    window.closeModal('rentModal');
    expect(document.getElementById('rentModal').classList.contains('show')).toBe(false);
  });

  it('renders flat details with the Wi-Fi values', () => {
    window.showFlatDetails('A-101');
    expect(document.getElementById('flatWifiName').value).toBe('net');
  });
});
