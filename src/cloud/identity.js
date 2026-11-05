/**
 * Who is signed in: greeting, name, avatar initials and today's date.
 * Runs as soon as the session is known so every path shows the person's name — including a new account that
 * skips building setup, which previously saw the placeholder "Good morning, Owner".
 */
import {renderIcons} from '../app/icons.js';

/** Name to show for a user: the name given at sign-up, else the part of their email before the @. */
export function displayNameFor(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Owner';
}

/** Up to two capital letters from a name, e.g. "Baldeep Singh" -> "BS". */
export function initialsFor(name) {
  return (
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0].toUpperCase())
      .join('') || '?'
  );
}

/** Fill the greeting, profile name, avatars and date for the signed-in user. */
export function showOwnerIdentity(user, now = new Date()) {
  const name = displayNameFor(user);
  const hour = now.getHours();
  // Lucide icons instead of emoji: emoji look different on every phone and clash with the line icons elsewhere.
  const [greeting, icon] =
    hour < 12 ? ['Good morning', 'sun'] : hour < 17 ? ['Good afternoon', 'cloud-sun'] : ['Good evening', 'moon'];
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('greetingText', greeting);
  const iconBox = document.getElementById('greetingIcon');
  if (iconBox && iconBox.dataset.icon !== icon) {
    iconBox.dataset.icon = icon;
    iconBox.innerHTML = `<i data-lucide="${icon}"></i>`;
    renderIcons();
  }
  set('ownerGreeting', name);
  document.getElementById('ownerGreeting')?.classList.remove('is-loading');
  set('ownerProfileName', name);
  set('ownerAvatar', initialsFor(name));
  set('ownerAvatarTop', initialsFor(name));
  set('todayDate', now.toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}));
}
