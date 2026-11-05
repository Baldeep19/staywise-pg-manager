/**
 * Cloud entry point: sets up handlers, restores the session, then wires the forms.
 */
import {initAuthForm, initAuthUnavailable} from './auth.js';
import {busyOverlay, busyText, supabase} from './client.js';
import {initElectricityCloudForms} from './electricity-form.js';
import {gate} from './elements.js';
import {initLiveRefresh} from './live.js';
import {initSession} from './loader.js';
import {initRentCloudForm} from './rent-form.js';
import {initResidentCloudForm} from './resident-form.js';
import {sayError} from './session.js';
import {initOwnerSetup} from './setup.js';

initOwnerSetup();

if (supabase) {
  gate.style.display = 'none';
  busyText.textContent = 'Loading your PG…';
  busyOverlay.classList.add('show');
  try {
    const {
      data: {session},
      error
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) await initSession(session.user);
    else gate.style.display = 'grid';
  } catch (e) {
    gate.style.display = 'grid';
    sayError(e);
  } finally {
    busyOverlay.classList.remove('show');
  }
  initAuthForm();
  initElectricityCloudForms();
  initRentCloudForm();
  initResidentCloudForm();
  initLiveRefresh();
} else {
  initAuthUnavailable();
}
