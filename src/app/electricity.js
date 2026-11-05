/**
 * Electricity bills page: meter readings, split calculation and bill form.
 */
import {state} from './store.js';
import {persist} from './store.js';
import {closeModal, esc, openModal, renderPage, toast} from './ui.js';

export function renderElectricity() {
  document.getElementById('pageContent').innerHTML = state.bills.length
    ? `<table class="table"><thead><tr><th>Resident</th><th>Flat</th><th>Received</th><th>Amount</th><th>Due date</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody>${state.bills.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.flat)}</td><td>${esc(b.month)}</td><td>₹${Number(b.amount).toLocaleString('en-IN')}</td><td>${esc(b.due)}</td><td><span class="pill">${esc(b.status)}</span></td><td>${['Paid', 'Waived'].includes(b.status) ? '—' : `<button class="link" onclick="openElectricityPayment('${b.id}')">Record payment</button>`}</td><td><button class="link" onclick="shareBill('${b.id}')">WhatsApp</button></td></tr>`).join('')}</tbody></table>`
    : `<div style="padding:25px;text-align:center"><div style="font-size:30px">ϟ</div><h3 style="font:700 14px Manrope">No electricity bills created yet</h3><p class="sub">Select flats and enter individual shares.</p><button class="primary" onclick="openModal('electricityModal')">＋ Create electricity bills</button></div>`;
}

export function shareBill(id) {
  let b = state.bills.find((x) => String(x.id) === String(id));
  if (!b) return;
  document.getElementById('messageTitle').textContent = 'Electricity bill · ' + b.name;
  document.getElementById('messageText').value =
    `Hello ${b.name}, your electricity bill for ${b.month} is ₹${Number(b.amount).toLocaleString('en-IN')}, due ${new Date(b.due + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}. — ${window.pgPropertyName || 'your property'}`;
  openModal('messageModal');
}

export function meterReadingsForFlat(flat, month) {
  const rows = window.pgElectricityReadings || [],
    same = rows.find((r) => r.flat === flat && String(r.billing_month || '').slice(0, 7) === month);
  if (same) return {row: same, sameCycle: true};
  const prior = rows
    .filter((r) => r.flat === flat && String(r.billing_month || '').slice(0, 7) < month)
    .sort((a, b) => String(b.billing_month).localeCompare(String(a.billing_month)))[0];
  return {row: prior || null, sameCycle: false};
}

export function meterValueFor(flat, month, room, kind) {
  const entry = meterReadingsForFlat(flat, month);
  if (!entry.row) return '';
  if (entry.sameCycle) return entry.row[kind + '_room' + room + '_reading'] ?? '';
  return entry.row['current_room' + room + '_reading'] ?? '';
}

export function meterNumberInput(label, name, value, flatIndex, room, kind) {
  const previous = kind === 'previous';
  return (
    '<label class="field" style="margin:0"><span>' +
    label +
    '</span><input type="number" min="0" step="0.01" inputmode="decimal" name="' +
    name +
    '" value="' +
    esc(value) +
    '" ' +
    (previous ? 'class="meter-previous" data-flat-index="' + flatIndex + '" data-room="' + room + '"' : '') +
    ' oninput="updateMeterUnits(' +
    flatIndex +
    ')" placeholder="' +
    (previous ? 'Enter last bill reading' : 'Enter current reading') +
    '"></label>'
  );
}

export function ensureElectricityMessagePreview() {
  const form = document.getElementById('electricityForm');
  if (!form || document.getElementById('electricityMessagePreview')) return;
  const actions = form.querySelector('.formactions');
  const wrap = document.createElement('div');
  wrap.className = 'field full';
  wrap.innerHTML =
    '<label>WhatsApp message preview</label><textarea id="electricityMessagePreview" rows="7" readonly aria-readonly="true" style="border:1px solid #dfe8e2;border-radius:9px;padding:11px;font-size:12px;line-height:1.6;resize:vertical;background:#f8faf8;color:var(--ink)"></textarea><span class="hint">This preview updates from the selected residents and amounts. You can review it again before opening WhatsApp.</span>';
  actions.before(wrap);
}

export function updateElectricityMessagePreview() {
  ensureElectricityMessagePreview();
  const form = document.getElementById('electricityForm'),
    preview = document.getElementById('electricityMessagePreview');
  if (!form || !preview) return;
  const flat = form.elements.selectedFlat?.value || '',
    due = form.elements.due?.value || '',
    lines = [];
  state.residents.forEach((r, i) => {
    const check = form.elements['include_' + i],
      amount = form.elements['amount_' + i];
    if (r.room === flat && check?.checked && amount?.value) {
      lines.push(
        '@⁨' +
          r.name +
          ' ' +
          (window.pgPropertyName || '') +
          ' ' +
          (r.room || '') +
          '⁩ ' +
          Number(amount.value).toLocaleString('en-IN', {useGrouping: false, maximumFractionDigits: 2})
      );
    }
  });
  const dueLabel = due
    ? new Date(due + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'long'})
    : 'your due date';
  preview.value = [
    'Electricity bill',
    ...lines,
    form.elements.commonNote?.value?.trim() || 'This includes common electricity bill',
    form.elements.note?.value?.trim() || '',
    form.elements.gpay?.value?.trim() ? 'GPay: ' + form.elements.gpay.value.trim() : '',
    'Due date: ' + dueLabel
  ]
    .filter(Boolean)
    .join('\\n');
}

export function markElectricityManual(input) {
  input.dataset.manual = '1';
  calculateElectricitySplit();
}

export function markElectricityAmount(input) {
  input.dataset.manual = '1';
  updateElectricityMessagePreview();
}

export function selectedFlatIndex() {
  const value = document.querySelector('#electricityForm [name=selectedFlat]')?.value || '';
  return (window.pgFlats || []).findIndex((f) => f.flat_number === value);
}

export function renderBillResidents() {
  const form = document.getElementById('electricityForm'),
    select = form.elements.selectedFlat,
    flatList = window.pgFlats || [],
    month = form.elements.month.value || new Date().toISOString().slice(0, 7),
    panel = document.getElementById('billResidents');
  if (!select.options.length || select.options.length === 1)
    select.innerHTML =
      '<option value="">Choose a flat</option>' +
      flatList.map((f) => '<option value="' + esc(f.flat_number) + '">' + esc(f.flat_number) + '</option>').join('');
  const flatIndex = selectedFlatIndex();
  if (flatIndex < 0) {
    panel.innerHTML = '<span class="hint">Choose a flat to enter its readings and calculate resident shares.</span>';
    return;
  }
  const flatRecord = flatList[flatIndex],
    flat = flatRecord.flat_number,
    people = state.residents.filter((r) => r.room === flat),
    entry = meterReadingsForFlat(flat, month),
    previousHint = entry.row
      ? entry.sameCycle
        ? 'Saved readings for this cycle.'
        : 'Previous readings copied from ' +
          new Date(entry.row.billing_month + 'T00:00:00').toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric'
          }) +
          '.'
      : 'No previous cycle saved for this flat. Enter both previous readings.',
    activeFlatChanged = form.dataset.activeFlat !== flat;
  if (activeFlatChanged) {
    form.dataset.activeFlat = flat;
    const main = form.elements.mainBillAmount,
      common = form.elements.commonMeterTotal;
    main.value = entry.sameCycle && Number(entry.row.main_bill_amount) > 0 ? Number(entry.row.main_bill_amount) : '';
    common.value = entry.sameCycle ? Number(entry.row.common_meter_total || 0) : '0';
    delete main.dataset.manual;
    delete common.dataset.manual;
  }
  panel.innerHTML =
    '<input type="checkbox" name="flat_' +
    flatIndex +
    '" checked hidden><div class="sub" style="margin:0 0 8px">' +
    previousHint +
    ' Active flats in this property: ' +
    flatList.length +
    '.</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><div style="border:1px solid var(--line);border-radius:9px;padding:9px"><b style="font-size:11px">Room 1 · Left meter</b>' +
    meterNumberInput(
      'Previous bill reading',
      'prev_room1_' + flatIndex,
      meterValueFor(flat, month, 1, 'previous'),
      flatIndex,
      1,
      'previous'
    ) +
    meterNumberInput(
      'Current reading',
      'current_room1_' + flatIndex,
      meterValueFor(flat, month, 1, 'current'),
      flatIndex,
      1,
      'current'
    ) +
    '<div class="tiny">Units used: <b id="meter-units-room1-' +
    flatIndex +
    '">Enter readings</b></div></div><div style="border:1px solid var(--line);border-radius:9px;padding:9px"><b style="font-size:11px">Room 2 · Right meter</b>' +
    meterNumberInput(
      'Previous bill reading',
      'prev_room2_' + flatIndex,
      meterValueFor(flat, month, 2, 'previous'),
      flatIndex,
      2,
      'previous'
    ) +
    meterNumberInput(
      'Current reading',
      'current_room2_' + flatIndex,
      meterValueFor(flat, month, 2, 'current'),
      flatIndex,
      2,
      'current'
    ) +
    '<div class="tiny">Units used: <b id="meter-units-room2-' +
    flatIndex +
    '">Enter readings</b></div></div></div><div id="electricityAllocationSummary" class="hint" style="margin:8px 0"></div><div style="display:grid;gap:7px">' +
    (people.length
      ? people
          .map((r) => {
            const ri = state.residents.indexOf(r),
              side = r.meter_side || '';
            return (
              '<div style="display:grid;grid-template-columns:auto minmax(90px,1fr) minmax(110px,140px) minmax(100px,120px);align-items:center;gap:7px;background:#f8faf8;border-radius:8px;padding:8px"><input type="checkbox" class="tenant-check" data-flat="' +
              flatIndex +
              '" name="include_' +
              ri +
              '" value="' +
              esc(r.name) +
              '" checked onchange="calculateElectricitySplit()" style="accent-color:var(--green)"><span style="font-size:11px">' +
              esc(r.name) +
              '</span><select name="meter_side_' +
              ri +
              '" aria-label="Meter room for ' +
              esc(r.name) +
              '" onchange="calculateElectricitySplit()" style="border:1px solid #dfe8e2;border-radius:7px;padding:7px;font-size:11px"><option value="">Choose meter</option><option value="left" ' +
              (side === 'left' ? 'selected' : '') +
              '>Room 1 · Left</option><option value="right" ' +
              (side === 'right' ? 'selected' : '') +
              '>Room 2 · Right</option></select><label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)">₹ <input type="number" min="0" step="0.01" name="amount_' +
              ri +
              '" value="" placeholder="Calculated" style="width:100%;border:1px solid #dfe8e2;border-radius:7px;padding:7px;font-size:11px" oninput="markElectricityAmount(this)"></label></div>'
            );
          })
          .join('')
      : '<span class="tiny">No residents are assigned to this flat.</span>') +
    '</div>';
  updateMeterUnits(flatIndex);
}

export function refreshMeterPreviousReadings() {
  const form = document.getElementById('electricityForm');
  form.dataset.activeFlat = '';
  renderBillResidents();
}

export function updateMeterUnits(i) {
  [1, 2].forEach((room) => {
    const previous = document.querySelector('[name="prev_room' + room + '_' + i + '"]'),
      current = document.querySelector('[name="current_room' + room + '_' + i + '"]'),
      label = document.getElementById('meter-units-room' + room + '-' + i);
    if (!previous || !current || !label) return;
    const p = previous.value,
      c = current.value;
    if (p === '' || c === '') {
      label.textContent = 'Enter readings';
      return;
    }
    const units = Number(c) - Number(p);
    label.textContent = units < 0 ? 'Check readings' : units.toLocaleString('en-IN', {maximumFractionDigits: 2});
  });
  calculateElectricitySplit();
}

export function calculateElectricitySplit() {
  const form = document.getElementById('electricityForm'),
    flatIndex = selectedFlatIndex();
  if (flatIndex < 0) return;
  const flat = (window.pgFlats || [])[flatIndex]?.flat_number,
    people = state.residents
      .map((r, i) => ({
        r,
        i,
        check: form.elements['include_' + i],
        side: form.elements['meter_side_' + i],
        amount: form.elements['amount_' + i]
      }))
      .filter((x) => x.check && x.side && x.amount && x.r.room === flat && x.check.checked),
    unit1 =
      Number(form.elements['current_room1_' + flatIndex]?.value) -
      Number(form.elements['prev_room1_' + flatIndex]?.value),
    unit2 =
      Number(form.elements['current_room2_' + flatIndex]?.value) -
      Number(form.elements['prev_room2_' + flatIndex]?.value),
    totalUnits = Math.max(0, unit1) + Math.max(0, unit2),
    main = Number(form.elements.mainBillAmount.value) || 0,
    commonTotal = Number(form.elements.commonMeterTotal.value) || 0,
    flatCount = (window.pgFlats || []).length,
    flatCommon = flatCount ? commonTotal / flatCount : 0,
    summary = document.getElementById('electricityAllocationSummary');
  if (!summary) return;
  const residentsBySide = {
      left: people.filter((x) => x.side.value === 'left'),
      right: people.filter((x) => x.side.value === 'right')
    },
    validSides = people.every((x) => x.side.value === 'left' || x.side.value === 'right');
  summary.textContent =
    'Room 1 · Left: ' +
    (Number.isFinite(unit1) ? Math.max(0, unit1).toLocaleString('en-IN', {maximumFractionDigits: 2}) : '—') +
    ' units (' +
    (totalUnits ? Math.round((Math.max(0, unit1) / totalUnits) * 100) : 0) +
    '%) · Room 2 · Right: ' +
    (Number.isFinite(unit2) ? Math.max(0, unit2).toLocaleString('en-IN', {maximumFractionDigits: 2}) : '—') +
    ' units (' +
    (totalUnits ? Math.round((Math.max(0, unit2) / totalUnits) * 100) : 0) +
    '%) · Common share for ' +
    flat +
    ': ₹' +
    flatCommon.toFixed(2) +
    ' (' +
    flatCount +
    ' active flats)';
  if (!validSides || !people.length || totalUnits <= 0) {
    people.forEach((x) => {
      if (x.amount.dataset.manual !== '1') x.amount.value = '';
    });
    return;
  }
  const roomMain = {
    left: (main * Math.max(0, unit1)) / totalUnits,
    right: (main * Math.max(0, unit2)) / totalUnits
  };
  people.forEach((x) => {
    if (x.amount.dataset.manual === '1') return;
    const room = x.side.value === 'left' ? 'left' : 'right',
      group = residentsBySide[room],
      base = roomMain[room] / group.length + flatCommon / people.length;
    x.amount.value = (Math.round(base * 100) / 100).toFixed(2);
  });
  if (totalUnits === 0 && main > 0) summary.textContent += ' · Enter meter readings to calculate the main bill share.';
}

/** Attach DOM event listeners for this feature. Called once from main.js. */
export function initElectricity() {
  ensureElectricityMessagePreview();
  document.addEventListener('input', (e) => {
    if (e.target.closest('#electricityForm')) setTimeout(updateElectricityMessagePreview, 0);
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('#electricityForm')) updateElectricityMessagePreview();
  });
  document.addEventListener('input', (e) => {
    if (e.target.matches('.meter-previous')) e.target.dataset.manual = '1';
  });
  document.getElementById('electricityForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target,
      fd = new FormData(form),
      d = Object.fromEntries(fd),
      selected = [];
    state.residents.forEach((resident, i) => {
      if (resident.room === d.selectedFlat && fd.has('include_' + i)) {
        const amount = Number(fd.get('amount_' + i));
        if (Number.isFinite(amount) && amount >= 0) selected.push({resident, amount, side: fd.get('meter_side_' + i)});
      }
    });
    if (!selected.length) {
      toast('Select residents for this flat');
      return;
    }
    const month = d.month
      ? new Date(d.month + '-02').toLocaleDateString('en-IN', {month: 'long', year: 'numeric'})
      : 'this month';
    window.pendingElectricBills =
      window.cloudElectricBills ||
      selected.map((x) => ({
        id: Date.now() + Math.random(),
        name: x.resident.name,
        phone: x.resident.phone,
        flat: x.resident.room,
        amount: x.amount,
        due: d.due,
        month,
        status: 'Due'
      }));
    window.cloudElectricBills = null;
    state.bills.unshift(...window.pendingElectricBills);
    persist();
    closeModal('electricityModal');
    form.reset();
    form.dataset.activeFlat = '';
    document.getElementById('messageTitle').textContent = 'Review electricity group message';
    const groupLines = selected.map(
        (x) =>
          '@⁨' +
          x.resident.name +
          ' ' +
          (window.pgPropertyName || '') +
          ' ' +
          (x.resident.room || '') +
          '⁩ ' +
          Number(x.amount).toLocaleString('en-IN', {useGrouping: false, maximumFractionDigits: 2})
      ),
      dueLabel = new Date(d.due + 'T00:00:00').toLocaleDateString('en-IN', {day: 'numeric', month: 'long'});
    document.getElementById('messageText').value = [
      'Electricity bill',
      ...groupLines,
      d.commonNote?.trim() || '',
      d.note?.trim() || '',
      d.gpay?.trim() ? 'GPay: ' + d.gpay.trim() : '',
      'Due date: ' + dueLabel
    ]
      .filter(Boolean)
      .join('\n');
    openModal('messageModal');
    if (document.getElementById('crumbPage').textContent === 'Electricity bills') renderPage('electricity');
    toast('Bills saved; choose the flat group in WhatsApp');
  });
}
