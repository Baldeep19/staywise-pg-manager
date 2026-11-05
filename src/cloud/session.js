/**
 * Mutable cloud session state (signed-in user, active property, flats, live-refresh handles).
 */
import {errorBox} from './elements.js';

export const session = {
  currentUser: undefined,
  property: undefined,
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
