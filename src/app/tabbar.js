/**
 * Phone bottom tab bar: four main tabs + "More".
 * The less-used pages (buttons marked data-more in the sidebar) open from a bottom sheet, together with the tour and
 * Log out — a long scrolling tab bar hid them off-screen and put Log out where it was easy to hit by accident.
 * On desktop the More button is hidden and the sidebar shows everything.
 */
import {esc} from './ui.js';

function closeSheet() {
  document.getElementById('moreSheet')?.remove();
  document.getElementById('navMore')?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', onKey);
}
const onKey = (e) => e.key === 'Escape' && closeSheet();

export function openMoreSheet() {
  if (document.getElementById('moreSheet')) return closeSheet(); // tapping More again closes it
  const items = [...document.querySelectorAll('.nav button[data-more]')];
  const name = document.getElementById('ownerProfileName')?.textContent || '';
  const sheet = document.createElement('div');
  sheet.id = 'moreSheet';
  sheet.className = 'sheet-overlay';
  sheet.innerHTML = `<div class="sheet" role="dialog" aria-label="More">
      <div class="sheet-grip"></div>
      <button type="button" class="close sheet-close" aria-label="Close">×</button>
      ${name ? `<div class="sheet-user"><span class="avatar">${esc(document.getElementById('ownerAvatar')?.textContent || '?')}</span><b>${esc(name)}</b></div>` : ''}
      <div class="sheet-grid">${items
        .map(
          (b, i) =>
            `<button type="button" data-i="${i}" class="${b.classList.contains('active') ? 'active' : ''}"><span class="ico">${b.querySelector('.ico').innerHTML}</span><span>${esc(b.querySelector('.label').textContent)}</span></button>`
        )
        .join('')}</div>
      <div class="sheet-actions">
        <button type="button" class="secondary" data-act="tour">Take a quick tour</button>
        <button type="button" class="secondary sheet-logout" data-act="logout">Log out</button>
      </div>
    </div>`;
  sheet.onclick = (e) => {
    if (e.target === sheet || e.target.closest('.sheet-close')) return closeSheet(); // dimmed area or ×
    const btn = e.target.closest('button');
    if (!btn) return;
    closeSheet();
    if (btn.dataset.i !== undefined)
      items[Number(btn.dataset.i)].click(); // same handler as the sidebar button
    else if (btn.dataset.act === 'tour') window.startTour?.();
    else if (btn.dataset.act === 'logout') document.getElementById('logoutButton')?.click();
  };
  document.body.appendChild(sheet);
  document.getElementById('navMore')?.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', onKey);
}

export function initTabbar() {
  const more = document.getElementById('navMore');
  if (more) more.onclick = openMoreSheet;
}
