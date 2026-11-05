/**
 * Rent & payments page and the "record rent" modal.
 */
import {state} from './store.js';
import {persist} from './store.js';
import {closeModal, emptyState, esc, openModal, statusPill, toast} from './ui.js';
import {renderIcons} from './icons.js';

export function rentBalanceForResident(r) {
  const now = new Date(),
    month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'),
    paid = (window.pgRentPayments || [])
      .filter(
        (p) => String(p.resident_id) === String(r.id) && String(p.rent_month || p.paid_on || '').slice(0, 7) === month
      )
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return Math.max(0, Number(r.rent || 0) - paid);
}

/** Filter chips on the Rent page. "Due" includes part-paid rent: money is still owed. */
export const RENT_FILTERS = [
  ['all', 'All', () => true],
  ['overdue', 'Overdue', (r) => r.status === 'Overdue'],
  ['due', 'Due', (r) => ['Due', 'Due soon', 'Part paid'].includes(r.status)],
  ['paid', 'Paid', (r) => r.status === 'Paid']
];
// Most urgent first; anything unknown goes after the due ones and before paid.
const URGENCY = {Overdue: 0, 'Part paid': 1, Due: 2, 'Due soon': 3, Paid: 5};
const urgency = (r) => URGENCY[r.status] ?? 4;
let rentFilter = 'all';

export function setRentFilter(key) {
  rentFilter = RENT_FILTERS.some(([k]) => k === key) ? key : 'all';
  renderRent();
}

function rentRow(r) {
  const balance = rentBalanceForResident(r),
    reminder =
      r.id && balance > 0
        ? '<button class="secondary rowbtn" onclick="draftResidentRentReminder(\'' +
          r.id +
          '\')">WhatsApp reminder</button>'
        : '<span class="rent-reminder-placeholder">—</span>';
  return (
    '<tr><td><b>' +
    esc(r.name) +
    '</b><div class="tiny">+91 ' +
    esc(r.phone) +
    ' · Deposit ₹' +
    Number(r.deposit || 0).toLocaleString('en-IN') +
    '</div></td><td>' +
    esc(r.room) +
    '</td><td>₹' +
    Number(r.rent).toLocaleString('en-IN') +
    '</td><td>' +
    statusPill(r.status) +
    '</td><td><button class="primary rowbtn" onclick="openForResident(\'' +
    esc(r.name) +
    '\')">Record payment</button> ' +
    reminder +
    '</td></tr>'
  );
}

export function renderRent() {
  // The search box is shared with the Residents page; filter the same way (name, room, phone).
  // Chips count what the search leaves, so search + chip work together ("overdue in flat A-101").
  const content = document.getElementById('pageContent');
  const query = (document.getElementById('searchInput')?.value || '').trim().toLowerCase(),
    found = state.residents.filter((r) => (r.name + ' ' + r.room + ' ' + r.phone).toLowerCase().includes(query)),
    test = RENT_FILTERS.find(([k]) => k === rentFilter)[2],
    rows = found
      .map((r, i) => [r, i])
      .filter(([r]) => test(r))
      .sort((a, b) => urgency(a[0]) - urgency(b[0]) || a[1] - b[1]) // stable: keep the list order within a status
      .map(([r]) => r);
  const chips =
    '<div class="chips" role="group" aria-label="Show residents by rent status">' +
    RENT_FILTERS.map(
      ([key, label, fn]) =>
        `<button type="button" class="chip${key === rentFilter ? ' active' : ''}" data-rent-filter="${key}" aria-pressed="${key === rentFilter}">${label} <span class="chip-count">${found.filter(fn).length}</span></button>`
    ).join('') +
    '</div>';
  let list;
  if (rows.length)
    list =
      '<table class="table"><thead><tr><th>Resident</th><th>Room</th><th>Rent due</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      rows.map(rentRow).join('') +
      '</tbody></table>';
  else if (!found.length)
    list = emptyState({
      icon: 'search',
      title: 'No residents found' + (query ? ' for ' + esc(query) : ''),
      text: 'Try another name, room or phone number.',
      action: {label: 'Clear search'}
    });
  else
    list = emptyState({
      icon: 'circle-check',
      title:
        rentFilter === 'overdue'
          ? 'Nobody is overdue'
          : rentFilter === 'due'
            ? 'Nothing is due right now'
            : 'No payments yet this month',
      text: 'Residents with another status are under All.',
      action: {label: 'Show all'}
    });
  content.innerHTML = chips + list;
  // One clear action per empty state
  const action = content.querySelector('.empty-state .secondary');
  if (action)
    action.onclick = () => {
      if (!found.length) {
        document.getElementById('searchInput').value = '';
        renderRent();
      } else setRentFilter('all');
    };
  content
    .querySelectorAll('[data-rent-filter]')
    .forEach((b) => (b.onclick = () => setRentFilter(b.dataset.rentFilter)));
  renderIcons();
}

export function refreshOptions() {
  let html =
    '<option value="">Choose resident</option>' +
    state.residents.map((r) => `<option>${esc(r.name)}</option>`).join('');
  document.querySelectorAll('.residentOptions').forEach((x) => (x.innerHTML = html));
}

export function openForResident(n) {
  openModal('rentModal');
  document.querySelector('#rentForm [name=resident]').value = n;
  document.querySelector('#rentModal h2').textContent = 'Record rent payment · ' + n;
}

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initRent() {
  document.getElementById('rentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let d = Object.fromEntries(new FormData(e.target));
    let r = state.residents.find((x) => x.name === d.resident);
    if (r) r.status = window.rentStatusAfterPayment || 'Paid';
    window.rentStatusAfterPayment = null;
    state.payments.unshift({
      resident: d.resident,
      amount: Number(d.amount),
      date: d.date || new Date().toISOString().slice(0, 10),
      method: d.method,
      note: d.note
    });
    state.activities.unshift(
      `<div class="activity"><div class="acticon">₹</div><div class="actbody"><b>${esc(d.resident)}</b> paid rent<small>${esc(r?.room || '')} · ${esc(d.method)} · Just now</small></div><div class="amount">+₹${Number(d.amount).toLocaleString('en-IN')}</div></div>`
    );
    document.getElementById('activityList').innerHTML =
      state.activities.join('') + document.getElementById('activityList').innerHTML;
    closeModal('rentModal');
    persist();
    e.target.reset();
    toast('Payment recorded');
    if (document.getElementById('crumbPage').textContent === 'Rent & payments') renderRent();
  });
}
