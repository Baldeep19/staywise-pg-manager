/**
 * Mutable cloud session state (signed-in user, active property, flats, live-refresh handles).
 */
import {errorBox} from './elements.js';

export const session = {
  currentUser: undefined,
  property: undefined,
  // All buildings the user can see (owned or shared as partner), and the one being edited in the setup form.
  properties: [],
  setup: {property: null, flats: [], createNew: false},
  flats: [],
  liveChannel: null,
  livePropertyId: null,
  liveRefreshTimer: 0,
  liveRefreshing: false,
  liveRefreshAgain: false
};

export const sayError = (e) => {
  errorBox.textContent = e?.message || String(e);
};
