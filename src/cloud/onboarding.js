/**
 * First-run onboarding: show the product tour once per account, then never again.
 *
 * "Seen it" is remembered in two places so it can't be missed:
 *  - this browser (localStorage, keyed by user id): works instantly and even if the server save fails or the
 *    cached session still has old metadata. The key deliberately does NOT start with "staywise_", so logging
 *    out (which clears those) does not bring the tour back.
 *  - the Supabase user metadata: follows the user to a new device or browser.
 */
import {isTourActive, startTour} from '../app/tour.js';
import {supabase} from './client.js';

const localKey = (user) => `tour_completed:${user.id}`;

/** True if this user already finished or skipped the tour, here or on another device. */
export function hasSeenTour(user) {
  if (!user) return true; // nothing to show it to
  return Boolean(user.user_metadata?.tour_completed) || localStorage.getItem(localKey(user)) === '1';
}

/** Remember that the tour is done: instantly in this browser, and on the account for other devices. */
export function markTourSeen(user) {
  localStorage.setItem(localKey(user), '1');
  supabase.auth
    .updateUser({data: {tour_completed: true}})
    .then(({error}) => {
      // Supabase reports failures as a value, not a thrown error. This browser still won't repeat the tour.
      if (error) console.error('Could not save tour state to the account', error);
    })
    .catch((e) => console.error('Could not save tour state to the account', e));
}

/** Start the tour for users who have never completed or skipped it. */
export function startTourIfFirstTime(user) {
  if (hasSeenTour(user)) return;
  // Wait a beat so the dashboard has finished laying out before we measure highlight positions.
  setTimeout(() => {
    if (isTourActive() || hasSeenTour(user)) return;
    startTour({onDone: () => markTourSeen(user)});
  }, 400);
}
