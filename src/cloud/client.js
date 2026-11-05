/**
 * Supabase client with a global "busy" overlay that tracks in-flight requests.
 */
import {createClient} from '@supabase/supabase-js';
import {errorBox} from './elements.js';

const {VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key} = import.meta.env;
if (!url || !key) {
  errorBox.textContent =
    'Supabase connection is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the hosting project settings, then redeploy.';
  errorBox.style.color = '#b44';
}
export const busyOverlay = document.getElementById('appBusy'),
  busyText = document.getElementById('appBusyText'),
  nativeFetch = window.fetch.bind(window);
let busyRequests = 0,
  busyTimer = 0,
  busyHideTimer = 0,
  busyShownAt = 0,
  busyLabelOverride = '';
async function trackedFetch(input, init = {}) {
  const method = String(init.method || input?.method || 'GET').toUpperCase(),
    isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isMutation) {
    busyRequests++;
    clearTimeout(busyHideTimer);
    if (busyRequests === 1)
      busyTimer = setTimeout(() => {
        busyText.textContent =
          busyLabelOverride ||
          (method === 'DELETE'
            ? 'Removing…'
            : method === 'PATCH' || method === 'PUT'
              ? 'Updating…'
              : 'Saving changes…');
        busyShownAt = Date.now();
        busyOverlay.classList.add('show');
      }, 120);
  }
  try {
    return await nativeFetch(input, init);
  } finally {
    if (isMutation) {
      busyRequests = Math.max(0, busyRequests - 1);
      if (!busyRequests) {
        clearTimeout(busyTimer);
        const hide = () => {
          if (!busyRequests) {
            busyOverlay.classList.remove('show');
            busyShownAt = 0;
          }
        };
        const remaining = busyShownAt ? Math.max(0, 320 - (Date.now() - busyShownAt)) : 0;
        busyHideTimer = setTimeout(hide, remaining);
      }
    }
  }
}
export const supabase = url && key ? createClient(url, key, {global: {fetch: trackedFetch}}) : null;
