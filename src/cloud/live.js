/**
 * Realtime refresh: re-load cloud data when the property changes or the tab regains focus.
 */
import {supabase} from './client.js';
import {initSession} from './loader.js';
import {session} from './session.js';

export function queueLiveRefresh() {
  clearTimeout(session.liveRefreshTimer);
  session.liveRefreshTimer = setTimeout(async () => {
    if (session.liveRefreshing) {
      session.liveRefreshAgain = true;
      return;
    }
    session.liveRefreshing = true;
    try {
      if (session.currentUser) await initSession(session.currentUser);
    } catch (error) {
      console.error('Live data refresh failed', error);
    } finally {
      session.liveRefreshing = false;
      if (session.liveRefreshAgain) {
        session.liveRefreshAgain = false;
        queueLiveRefresh();
      }
    }
  }, 250);
}

export function subscribeToPropertyChanges() {
  if (!session.property || !supabase || (session.livePropertyId === session.property.id && session.liveChannel)) return;
  if (session.liveChannel) supabase.removeChannel(session.liveChannel);
  const channel = supabase.channel('pg-property-' + session.property.id);
  for (const table of [
    'residents',
    'flats',
    'rent_payments',
    'electricity_bills',
    'electricity_bill_payments',
    'electricity_meter_readings'
  ])
    channel.on(
      'postgres_changes',
      {event: '*', schema: 'public', table, filter: 'property_id=eq.' + session.property.id},
      queueLiveRefresh
    );
  session.liveChannel = channel;
  session.livePropertyId = session.property.id;
  channel.subscribe();
}

/** Attach window/document listeners that trigger a refresh. Called once from index.js. */
export function initLiveRefresh() {
  window.addEventListener('online', queueLiveRefresh);
  window.addEventListener('focus', queueLiveRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') queueLiveRefresh();
  });
}
