/**
 * Residents page: list, search, add/edit form and rent reminders.
 */
import {state} from './store.js';
import {renderRent, rentBalanceForResident} from './rent.js';
import {persist} from './store.js';
import {closeModal, emptyState, esc, initials, openModal, statusPill, toast} from './ui.js';
import {renderIcons} from './icons.js';

export function resetResidentForm() {
  const f = document.getElementById('residentForm');
  f.reset();
  delete f.dataset.editResidentId;
  delete f.dataset.cloudResidentId;
  document.getElementById('residentModalTitle').textContent = 'Add a resident';
  document.getElementById('residentSubmitButton').textContent = 'Add resident';
}

export function draftResidentRentReminder(id) {
  const r = state.residents.find((x) => String(x.id) === String(id));
  if (!r) return toast('Resident record not found');
  const balance = rentBalanceForResident(r);
  if (balance <= 0) return toast('This resident has no rent balance due');
  const now = new Date(),
    dueDate = new Date(now.getFullYear(), now.getMonth(), 2),
    monthLabel = now.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}),
    dueLabel = dueDate.toLocaleDateString('en-IN', {day: 'numeric', month: 'long'});
  document.getElementById('messageTitle').textContent = 'Rent reminder · ' + r.name;
  document.getElementById('messageText').value =
    'Hello ' +
    r.name +
    ', this is a friendly reminder that ₹' +
    balance.toLocaleString('en-IN', {maximumFractionDigits: 2}) +
    ' rent for ' +
    monthLabel +
    ' was due on ' +
    dueLabel +
    '. If you have already paid, kindly ignore this message. Thank you — ' +
    (window.pgPropertyName || 'your building');
  openModal('messageModal');
}

export function renderResidents() {
  const query = (document.getElementById('searchInput')?.value || '').toLowerCase(),
    rows = state.residents.filter((r) => (r.name + r.room + r.phone).toLowerCase().includes(query));
  if (!rows.length) {
    document.getElementById('pageContent').innerHTML = state.residents.length
      ? emptyState({
          icon: 'search',
          title: 'No residents found' + (query ? ' for ' + esc(query) : ''),
          text: 'Try another name, flat or phone number.',
          action: {
            label: 'Clear search',
            onclick: "document.getElementById('searchInput').value='';renderResidents()"
          }
        })
      : emptyState({
          icon: 'user-plus',
          title: 'No residents yet',
          text: 'Add your first resident to start tracking rent.',
          action: {label: '＋ Add resident', onclick: "openModal('residentModal')", primary: true}
        });
    renderIcons();
    return;
  }
  const body = rows
    .map((r) => {
      const reminder =
        r.id && rentBalanceForResident(r) > 0
          ? '<button class="secondary rowbtn" onclick="draftResidentRentReminder(\'' +
            r.id +
            '\')">Rent reminder</button>'
          : ''; // nothing to remind about
      return (
        '<tr><td><div class="residentcell"><div class="miniava">' +
        initials(r.name) +
        '</div><div><b>' +
        esc(r.name) +
        '</b><div class="tiny">+91 ' +
        esc(r.phone) +
        ' · Deposit ₹' +
        Number(r.deposit || 0).toLocaleString('en-IN') +
        '</div></div></div></td><td>' +
        esc(r.room) +
        '</td><td>' +
        esc(r.sharing_type === 'single' ? 'Single' : r.sharing_type === 'double' ? 'Double' : '—') +
        '</td><td>₹' +
        Number(r.rent).toLocaleString('en-IN') +
        '</td><td>' +
        statusPill(r.status) +
        '</td><td>' +
        esc(r.movein || '—') +
        '</td><td>' +
        // One "Actions" cell (reminder, edit, remove) so the buttons sit on a single line on phones
        (r.id
          ? reminder +
            ' <button class="secondary rowbtn" onclick="editResident(\'' +
            r.id +
            '\')">Edit</button> <button class="secondary rowbtn" style="color:#b44;border-color:#eed2d0" onclick="removeResident(\'' +
            r.id +
            '\')">Remove</button>'
          : '') +
        '</td></tr>'
      );
    })
    .join('');
  document.getElementById('pageContent').innerHTML =
    '<table class="table"><thead><tr><th>Resident</th><th>Flat</th><th>Sharing</th><th>Rent</th><th>Status</th><th>Move-in</th><th>Actions</th></tr></thead><tbody>' +
    body +
    '</tbody></table>';
}

export function editResident(id) {
  const r = state.residents.find((x) => String(x.id) === String(id));
  if (!r) return;
  const f = document.getElementById('residentForm');
  f.reset();
  f.dataset.editResidentId = r.id;
  f.elements.name.value = r.name || '';
  f.elements.phone.value = r.phone || '';
  f.elements.room.value = r.room || '';
  f.elements.sharing_type.value = r.sharing_type || '';
  f.elements.rent.value = r.rent || 0;
  f.elements.deposit.value = r.deposit || 0;
  f.elements.movein.value = r.movein || '';
  f.elements.address.value = r.address || '';
  f.elements.emergency.value = r.emergency || '';
  document.getElementById('residentModalTitle').textContent = 'Edit resident';
  document.getElementById('residentSubmitButton').textContent = 'Save changes';
  openModal('residentModal');
}

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initResidents() {
  document.getElementById('residentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target,
      d = Object.fromEntries(new FormData(form)),
      editId = form.dataset.editResidentId,
      existing = editId ? state.residents.find((r) => String(r.id) === String(editId)) : null;
    if (editId && existing) {
      Object.assign(existing, {
        name: d.name,
        phone: d.phone.replace(/\D/g, '').slice(-10),
        room: d.room,
        sharing_type: d.sharing_type,
        rent: Number(d.rent),
        deposit: Number(d.deposit || 0),
        movein: d.movein || '',
        address: d.address || '',
        emergency: d.emergency || '',
        meter_side: d.meter_side || existing.meter_side || ''
      });
      state.activities.unshift(
        `<div class="activity"><div class="acticon">♙</div><div class="actbody"><b>Resident details updated</b><small>${esc(d.name)} · Room ${esc(d.room)} · Just now</small></div></div>`
      );
    } else {
      state.residents.unshift({
        id: form.dataset.cloudResidentId || undefined,
        name: d.name,
        phone: d.phone.replace(/\D/g, '').slice(-10),
        room: d.room,
        sharing_type: d.sharing_type,
        rent: +d.rent,
        deposit: Number(d.deposit || 0),
        status: 'Not tracked',
        movein: d.movein || new Date().toISOString().slice(0, 10),
        address: d.address || '',
        emergency: d.emergency || '',
        meter_side: d.meter_side || ''
      });
      state.activities.unshift(
        `<div class="activity"><div class="acticon">♙</div><div class="actbody"><b>New resident added</b><small>${esc(d.name)} · Room ${esc(d.room)} · Just now</small></div></div>`
      );
    }
    document.getElementById('residentCount').textContent = state.residents.length;
    window.refreshDashboard?.();
    document.getElementById('activityList').innerHTML =
      state.activities.join('') + document.getElementById('activityList').innerHTML;
    persist();
    closeModal('residentModal');
    toast(editId ? 'Resident details updated.' : 'Resident added successfully.');
    if (
      !document.getElementById('genericPage').classList.contains('hidden') &&
      document.getElementById('crumbPage').textContent === 'Residents'
    )
      renderResidents();
  });
  document.getElementById('searchInput').addEventListener('input', () => {
    if (document.getElementById('crumbPage').textContent === 'Rent & payments') renderRent();
  });
}
