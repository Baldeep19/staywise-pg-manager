// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

/** What the next auth.signUp() call resolves with. */
let signUpResult;
const signUp = vi.fn(async () => signUpResult);

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {getSession: async () => ({data: {session: null}, error: null}), signUp: (...a) => signUp(...a)},
    from: () => ({select: () => ({limit: async () => ({data: [], error: null})})}),
    channel: () => ({on: () => ({subscribe: () => ({})})})
  })
}));

const $ = (id) => document.getElementById(id);

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../cloud/index.js');
});

/** Open the register form and submit it with the given email. */
async function register(email) {
  if ($('authSubmit').textContent !== 'Register') $('signupButton').click();
  const f = $('authForm').elements;
  f.ownerName.value = 'New Owner';
  f.email.value = email;
  f.password.value = 'secret123';
  $('authForm').dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
  await vi.waitFor(() => expect(signUp).toHaveBeenCalled());
}

describe('creating an account', () => {
  beforeEach(() => signUp.mockClear());

  it('returns to the sign-in screen with a "confirm your email" message', async () => {
    signUpResult = {data: {user: {identities: [{id: 'x'}]}, session: null}, error: null};
    await register('new@example.com');
    await vi.waitFor(() => expect($('authSubmit').textContent).toBe('Sign in'));
    expect(document.querySelector('#authForm h2').textContent).toBe('Owner sign in');
    expect($('authError').textContent).toMatch(/confirm your email/i);
    expect($('authError').textContent).toContain('new@example.com');
    expect($('authForm').elements.email.value).toBe('new@example.com'); // ready to sign in after confirming
    expect($('authForm').elements.password.value).toBe('');
    expect($('ownerNameField').style.display).toBe('none');
  });

  it('says so when the email is already registered, and stays on the register form', async () => {
    signUpResult = {data: {user: {identities: []}, session: null}, error: null};
    await register('taken@example.com');
    await vi.waitFor(() => expect($('authError').textContent).toMatch(/already exists/i));
    expect($('authSubmit').textContent).toBe('Register');
  });
});
