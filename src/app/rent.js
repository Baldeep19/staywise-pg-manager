/**
 * Rent & payments page and the "record rent" modal.
 */
import {state} from './store.js';
import {persist} from './store.js';
import {closeModal, esc, openModal, toast} from './ui.js';

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

export function renderRent() {
  const body = state.residents
    .map((r) => {
      const balance = rentBalanceForResident(r),
        reminder =
          r.id && balance > 0
            ? '<button class="link" onclick="draftResidentRentReminder(\'' + r.id + '\')">WhatsApp reminder</button>'
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
        '</td><td><span class="pill ' +
        (r.status === 'Overdue' ? 'late' : ['Due', 'Due soon'].includes(r.status) ? 'soon' : '') +
        '" style="' +
        (r.status === 'Paid' ? 'color:#357551;background:#edf7ef' : '') +
        '">' +
        esc(r.status) +
        '</span></td><td><button class="link" onclick="openForResident(\'' +
        esc(r.name) +
        '\')">Record payment</button> ' +
        reminder +
        '</td></tr>'
      );
    })
    .join('');
  document.getElementById('pageContent').innerHTML =
    '<table class="table"><thead><tr><th>Resident</th><th>Room</th><th>Rent due</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
    body +
    '</tbody></table>';
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
