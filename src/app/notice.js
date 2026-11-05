/**
 * Notice period: residents who have said they are leaving.
 *  - notice_on  = day the resident gave notice, vacate_on = day they will move out (both 'YYYY-MM-DD')
 *  - the house rule is one month's notice, so the form fills vacate_on in as notice_on + 1 month; owners can move it
 *    later when a resident tells them early (the colour always follows the days left, not the notice length)
 *  - colour by days left: yellow (more than 2 weeks), orange (8–14 days), red (a week or less, or the date has passed)
 */
import {esc} from './ui.js';

export const NOTICE_MONTHS = 1;
export const NOTICE_RED_DAYS = 7;
export const NOTICE_ORANGE_DAYS = 14;

const DAY = 86400000;
const parts = (iso) => String(iso).slice(0, 10).split('-').map(Number);
const utc = (iso) => {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
};
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Today in the device's own time zone (toISOString() would give yesterday in India before 5:30 am). */
export function todayIso(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join(
    '-'
  );
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / DAY);

/** Same day `n` months later, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date, n) {
  const [y, m, d] = parts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m - 1 + n, Math.min(d, lastDay)));
}

/** "5 Dec" — short, no year (notice periods are weeks, not years). */
export const shortDate = (date) =>
  new Date(utc(date)).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', timeZone: 'UTC'});

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

/**
 * Notice details for one resident, or null when they are not on notice.
 * level: 'red' | 'orange' | 'yellow'. shortBy: days less than the one-month rule (0 when the rule was met).
 */
export function noticeInfo(resident, today = todayIso()) {
  const {notice_on: noticeOn, vacate_on: vacateOn} = resident || {};
  if (!noticeOn || !vacateOn) return null;
  const daysLeft = daysBetween(today, vacateOn),
    noticeDays = daysBetween(noticeOn, vacateOn),
    shortBy = Math.max(0, daysBetween(vacateOn, addMonths(noticeOn, NOTICE_MONTHS))),
    level = daysLeft <= NOTICE_RED_DAYS ? 'red' : daysLeft <= NOTICE_ORANGE_DAYS ? 'orange' : 'yellow',
    label =
      daysLeft < 0
        ? 'Was due out ' + plural(-daysLeft, 'day') + ' ago'
        : daysLeft === 0
          ? 'Leaves today'
          : daysLeft === 1
            ? 'Leaves tomorrow'
            : plural(daysLeft, 'day') + ' left';
  return {noticeOn, vacateOn, daysLeft, noticeDays, shortBy, level, label};
}

/** Residents on notice, the soonest to leave first. */
export function residentsOnNotice(list, today = todayIso()) {
  return (list || [])
    .filter((r) => r.active !== false)
    .map((r) => ({resident: r, notice: noticeInfo(r, today)}))
    .filter((x) => x.notice)
    .sort((a, b) => a.notice.daysLeft - b.notice.daysLeft);
}

/** Small coloured pill for the Residents list ("12 days left"). */
export function noticeBadge(resident, today = todayIso()) {
  const n = noticeInfo(resident, today);
  return n
    ? `<span class="notice-chip notice-${n.level}" title="Gave notice on ${shortDate(n.noticeOn)}; moving out ${shortDate(n.vacateOn)}">${esc(n.label)}</span>`
    : '';
}

/** Rows for the Overview "On notice" card. */
export function noticeListHtml(rows) {
  return rows
    .map(({resident: r, notice: n}) => {
      const id = esc(String(r.id)),
        details = [
          r.room ? esc(r.room) : '',
          'Gave notice ' + shortDate(n.noticeOn),
          'Leaves ' + shortDate(n.vacateOn),
          plural(n.noticeDays, 'day') + "' notice"
        ].filter(Boolean),
        short = n.shortBy
          ? `<small class="notice-short">Short notice: ${plural(n.shortBy, 'day')} under ${plural(NOTICE_MONTHS, 'month')}</small>`
          : '',
        // Once the day has come the next step is moving them out (with Undo), so offer it right here.
        moveOut =
          n.daysLeft <= 0
            ? `<button type="button" class="secondary rowbtn" onclick="removeResident('${id}')">Mark moved out</button>`
            : '';
      return (
        `<div class="notice-item notice-${n.level}">` +
        `<button type="button" class="notice-open" onclick="editResident('${id}')" aria-label="Edit ${esc(r.name)}, ${esc(n.label)}">` +
        `<b>${esc(r.name)}</b><small>${details.join(' · ')}</small>${short}</button>` +
        `<span class="notice-chip notice-${n.level}">${esc(n.label)}</span>${moveOut}</div>`
      );
    })
    .join('');
}

/** Fill the Overview card (hidden when nobody is on notice). */
export function renderNoticeCard(list, today = todayIso()) {
  const card = document.getElementById('noticeCard');
  if (!card) return;
  const rows = residentsOnNotice(list, today);
  card.classList.toggle('hidden', !rows.length);
  if (!rows.length) return;
  const next = rows[0].notice;
  document.getElementById('noticeSummary').textContent =
    plural(rows.length, 'resident') +
    ' moving out · ' +
    (next.daysLeft < 0 ? 'one date has passed' : 'next: ' + next.label.toLowerCase());
  document.getElementById('noticeList').innerHTML = noticeListHtml(rows);
}

/**
 * Keep the two notice dates consistent in the resident form:
 * both or neither, and the move-out day not before the notice day (messages show under the fields).
 */
export function syncNoticeValidity(form) {
  const notice = form.elements.notice_on,
    vacate = form.elements.vacate_on;
  if (!notice || !vacate) return;
  notice.setCustomValidity(vacate.value && !notice.value ? 'Add the day the resident gave notice' : '');
  vacate.setCustomValidity(
    notice.value && !vacate.value
      ? 'Add the move-out day'
      : notice.value && vacate.value < notice.value
        ? 'Must be on or after the notice day'
        : ''
  );
  vacate.min = notice.value || '';
  const hint = form.querySelector('#noticeHint');
  if (hint) {
    const n = noticeInfo({notice_on: notice.value, vacate_on: vacate.value});
    hint.textContent =
      n && vacate.value >= notice.value
        ? plural(n.noticeDays, 'day') +
          "' notice" +
          (n.shortBy ? ' — ' + plural(n.shortBy, 'day') + ' short of ' + plural(NOTICE_MONTHS, 'month') : '')
        : `Move-out fills in as ${plural(NOTICE_MONTHS, 'month')} after the notice day; change it if they told you earlier.`;
  }
}

/** Put a resident's notice dates into the form (or clear them) and open the section when they are set. */
export function fillNoticeFields(form, resident) {
  form.elements.notice_on.value = resident?.notice_on || '';
  form.elements.vacate_on.value = resident?.vacate_on || '';
  delete form.elements.vacate_on.dataset.auto;
  const box = form.querySelector('#noticeBox');
  if (box) box.open = Boolean(resident?.notice_on);
  syncNoticeValidity(form);
}

/** Wire the notice fields of the resident form. Called once from main.js. */
export function initNoticeFields(form) {
  const notice = form.elements.notice_on,
    vacate = form.elements.vacate_on;
  if (!notice || !vacate) return;
  const onNotice = () => {
    // Fill in (or keep updating) the move-out day until the owner picks one themselves.
    if (notice.value && (!vacate.value || vacate.dataset.auto === '1')) {
      vacate.value = addMonths(notice.value, NOTICE_MONTHS);
      vacate.dataset.auto = '1';
    }
    syncNoticeValidity(form);
  };
  const onVacate = () => {
    delete vacate.dataset.auto;
    syncNoticeValidity(form);
  };
  notice.addEventListener('input', onNotice);
  notice.addEventListener('change', onNotice);
  vacate.addEventListener('input', onVacate);
  vacate.addEventListener('change', onVacate);
  form.querySelector('#noticeClear')?.addEventListener('click', () => {
    fillNoticeFields(form, null);
    const card = form.closest('.modal');
    if (card) card.dataset.dirty = '1'; // an outside click must not throw this change away (see modal-layout.js)
    form.querySelector('#noticeBox')?.setAttribute('open', '');
  });
  // A form reset clears the values but not custom messages; re-check once the reset has happened. Only re-check:
  // editResident() fills the dates in straight after reset(), and clearing here would wipe them.
  form.addEventListener('reset', () => setTimeout(() => syncNoticeValidity(form)));
}

/** Notice fields from FormData, ready for the database (null = not on notice). */
export const noticePayload = (d) => ({
  notice_given_on: d.get('notice_on') || null,
  notice_vacate_on: d.get('notice_on') ? d.get('vacate_on') || null : null
});
