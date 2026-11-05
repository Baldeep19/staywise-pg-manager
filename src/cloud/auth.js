/**
 * Sign-in / account-creation form behaviour (and the fallback when Supabase is not configured).
 */
import {supabase} from './client.js';
import {authForm, errorBox, gate} from './elements.js';
import {sayError} from './session.js';

/** Wire the sign-in / register form. Called after the initial session check. */
export function initAuthForm() {
  let registerMode = false;
  const ownerNameField = document.getElementById('ownerNameField'),
    authSubmit = document.getElementById('authSubmit'),
    signupButton = document.getElementById('signupButton');
  const propertyFields = document.getElementById('signupPropertyFields'),
    showPropertyButton = document.getElementById('showSignupPropertyFields'),
    signupFlats = document.getElementById('signupFlats');
  function addSignupFlatRow(unit = {}) {
    const row = document.createElement('div');
    row.className = 'formgrid signup-flat';
    row.style.cssText = 'border:1px solid var(--line);padding:9px;border-radius:9px;align-items:end';
    row.innerHTML = `<div class="field"><label>Flat name *</label><input name="signup_flat_number" required placeholder="Flat 101" value="${String(unit.flat_number || '').replaceAll('"', '&quot;')}"></div><div class="field"><label>Floor *</label><input name="signup_floor_name" required placeholder="Ground" value="${String(unit.floor_name || '').replaceAll('"', '&quot;')}"></div><div class="field"><label>Rooms *</label><input name="signup_rooms" required type="number" min="1" value="${unit.room_count || 1}"></div><button type="button" class="secondary remove-signup-flat">Remove</button>`;
    row.querySelector('button').onclick = () => {
      if (signupFlats.children.length > 1) row.remove();
    };
    signupFlats.append(row);
  }
  showPropertyButton.onclick = () => {
    propertyFields.style.display = 'block';
    showPropertyButton.style.display = 'none';
    signupFlats.querySelectorAll('input').forEach((i) => (i.required = true));
    if (!signupFlats.children.length) addSignupFlatRow();
  };
  document.getElementById('addSignupFlat').onclick = () => addSignupFlatRow();
  /** Switch the card between "Owner sign in" and "Create owner account". */
  function setRegisterMode(on) {
    registerMode = on;
    ownerNameField.style.display = registerMode ? 'flex' : 'none';
    propertyFields.style.display = 'none';
    showPropertyButton.style.display = registerMode ? 'inline-flex' : 'none';
    authForm.elements.ownerName.required = registerMode;
    authForm.elements.signupPropertyName.required = false;
    authSubmit.textContent = registerMode ? 'Register' : 'Sign in';
    signupButton.textContent = registerMode ? 'Back to sign in' : 'Create account';
    errorBox.textContent = '';
    document.querySelector('#authForm h2').textContent = registerMode ? 'Create owner account' : 'Owner sign in';
    document.querySelector('#authForm p').textContent = registerMode
      ? 'Add your name and account details. Building setup is optional and can be added later.'
      : 'Sign in to access your PG records securely.';
  }
  signupButton.addEventListener('click', () => setRegisterMode(!registerMode));
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(authForm);
    errorBox.style.color = '#b44';
    if (registerMode) {
      if (!String(d.get('ownerName') || '').trim()) return sayError('Enter your name to create the owner account.');
      const hasProperty = String(d.get('signupPropertyName') || '').trim().length > 0;
      const signupUnits = hasProperty
        ? [...signupFlats.querySelectorAll('.signup-flat')].map((r) => ({
            flat_number: r.querySelector('[name=signup_flat_number]').value.trim(),
            floor_name: r.querySelector('[name=signup_floor_name]').value.trim(),
            room_count: Number(r.querySelector('[name=signup_rooms]').value)
          }))
        : [];
      if (
        hasProperty &&
        (signupUnits.some((x) => !x.flat_number || !x.floor_name || x.room_count < 1) ||
          new Set(signupUnits.map((x) => x.flat_number.toLowerCase())).size !== signupUnits.length)
      )
        return sayError('Complete unique flat details or leave building setup blank.');
      errorBox.textContent = 'Creating account…';
      try {
        const {data, error} = await supabase.auth.signUp({
          email: d.get('email'),
          password: d.get('password'),
          options: {
            data: {
              full_name: String(d.get('ownerName')).trim(),
              pending_property: {
                name: String(d.get('signupPropertyName')).trim(),
                address: String(d.get('signupPropertyAddress') || '').trim(),
                flats: signupUnits
              }
            },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) sayError(error);
        else if (data.session) {
          errorBox.style.color = 'var(--green)';
          errorBox.textContent = 'Account created. Signing you in…';
          location.reload();
        } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // With email confirmation on, Supabase hides "already registered" by returning a user with no identities.
          sayError('An account with this email already exists. Sign in instead, or reset your password.');
        } else {
          // Confirmation required: take the user back to the sign-in screen with the email filled in.
          const email = String(d.get('email'));
          setRegisterMode(false);
          authForm.reset();
          authForm.elements.email.value = email;
          errorBox.style.color = 'var(--green)';
          errorBox.textContent = `Account created. We sent a confirmation link to ${email}. Please confirm your email, then sign in here.`;
        }
      } catch (err) {
        sayError(err);
      }
    } else {
      errorBox.textContent = 'Signing in…';
      try {
        const {error} = await supabase.auth.signInWithPassword({email: d.get('email'), password: d.get('password')});
        if (error) sayError(error);
        else location.reload();
      } catch (err) {
        sayError(err);
      }
    }
  });
}

/** Shown when VITE_SUPABASE_* is missing: explain why sign-in is unavailable. */
export function initAuthUnavailable() {
  gate.style.display = 'grid';
  document.getElementById('signupButton').addEventListener('click', () => {
    errorBox.style.color = '#b44';
    errorBox.textContent = 'Account creation is unavailable because Supabase is not configured in this app deployment.';
  });
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.style.color = '#b44';
    errorBox.textContent = 'Sign-in is unavailable because Supabase is not configured in this app deployment.';
  });
}

/**
 * Make the "Log out" buttons work. Clears every cached Staywise value first so the next person who signs in
 * on this browser never sees the previous account's data.
 */
export function initLogout() {
  window.logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign-out failed', e);
    }
    Object.keys(localStorage)
      .filter((key) => key.startsWith('staywise_'))
      .forEach((key) => localStorage.removeItem(key));
    location.reload();
  };
  document.getElementById('logoutButton').onclick = () => window.logout();
}
