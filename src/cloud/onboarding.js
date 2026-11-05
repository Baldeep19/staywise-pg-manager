/**
 * First-run onboarding: show the product tour once per account.
 * "Seen it" is stored in the Supabase user metadata (not localStorage) so it survives logging out and
 * follows the user to a new device.
 */
import {startTour} from '../app/tour.js';
import {supabase} from './client.js';

/** Start the tour for users who have never completed or skipped it. */
export function startTourIfFirstTime(user) {
  if (user?.user_metadata?.tour_completed) return;
  // Wait a beat so the dashboard has finished laying out before we measure highlight positions.
  setTimeout(() => {
    startTour({
      onDone: () => {
        supabase.auth
          .updateUser({data: {tour_completed: true}})
          .catch((e) => console.error('Could not save tour state', e));
      }
    });
  }, 400);
}
