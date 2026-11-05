// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {displayNameFor, initialsFor, showOwnerIdentity} from '../cloud/identity.js';

// A brand-new account: signed in, but no building yet, so the setup screen is shown first.
const user = {
  id: 'u9',
  email: 'baldeep.singh@example.com',
  user_metadata: {full_name: 'Baldeep Singh', tour_completed: true}
};
vi.mock('@supabase/supabase-js', () => {
  const query = () => {
    const q = {then: (res) => res({data: [], error: null})};
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q;
    return q;
  };
  return {
    createClient: () => ({
      auth: {getSession: async () => ({data: {session: {user}}, error: null})},
      from: query,
      channel: () => ({on: () => ({subscribe: () => ({})})})
    })
  };
});

const $ = (id) => document.getElementById(id);

describe('display name', () => {
  it('prefers the name given at sign-up, then the email prefix, then "Owner"', () => {
    expect(displayNameFor({email: 'a@b.com', user_metadata: {full_name: 'Asha Rao'}})).toBe('Asha Rao');
    expect(displayNameFor({email: 'asha@b.com', user_metadata: {}})).toBe('asha');
    expect(displayNameFor({})).toBe('Owner');
  });
  it('builds initials from the first two words', () => {
    expect(initialsFor('Baldeep Singh')).toBe('BS');
    expect(initialsFor('asha')).toBe('A');
    expect(initialsFor('')).toBe('?');
  });
  it.each([
    [9, 'Good morning'],
    [14, 'Good afternoon'],
    [20, 'Good evening']
  ])('greets by time of day (hour %i)', (hour, text) => {
    document.body.innerHTML = '<span id="greetingText"></span><span id="ownerGreeting"></span>';
    showOwnerIdentity(user, new Date(2026, 0, 5, hour));
    expect($('greetingText').textContent).toBe(text);
    expect($('ownerGreeting').textContent).toBe('Baldeep Singh');
  });
  it.each([
    [9, 'sun'],
    [14, 'cloud-sun'],
    [20, 'moon']
  ])('shows a line icon, not an emoji, for the time of day (hour %i)', (hour, icon) => {
    document.body.innerHTML =
      '<span id="greetingText"></span><span id="ownerGreeting"></span><span id="greetingIcon"></span>';
    showOwnerIdentity(user, new Date(2026, 0, 5, hour));
    const box = $('greetingIcon');
    expect(box.dataset.icon).toBe(icon);
    expect(box.querySelector('svg')).not.toBeNull(); // rendered by Lucide
    expect(box.textContent.trim()).toBe(''); // no emoji text
  });
});

describe('new account that gave no building details', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
    window.scrollTo = () => {};
    await import('../main.js');
    await import('../cloud/index.js');
  });

  it('goes straight to the app showing their name, not the placeholder "Owner"', () => {
    expect($('ownerSetupGate').style.display).toBe('none'); // no building details were given, so no setup screen
    expect($('ownerGreeting').textContent).toBe('Baldeep Singh');
    expect($('ownerProfileName').textContent).toBe('Baldeep Singh');
    expect($('ownerAvatar').textContent).toBe('BS');
    expect($('ownerAvatarTop').textContent).toBe('BS');
  });

  it('lets them add a building later from Settings', () => {
    expect(typeof window.editPropertySetup).toBe('function');
  });
});
