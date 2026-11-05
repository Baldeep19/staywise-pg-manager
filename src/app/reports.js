/**
 * Reports page (occupancy, collections, dues).
 */
import {state} from './store.js';
import {esc} from './ui.js';

export function renderReports() {
  const now = new Date(),
    defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'),
    month = document.getElementById('reportMonth')?.value || defaultMonth,
    [year, monthNum] = month.split('-').map(Number),
    dueDate = month + '-02',
    today =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0'),
    monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}),
    dueLabel = new Date(year, monthNum - 1, 2).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
  const people = (window.pgReportResidents || state.residents || []).filter(
      (r) => (!r.movein || r.movein <= dueDate) && (!r.moveout || r.moveout >= dueDate)
    ),
    payments = (window.pgRentPayments || []).filter(
      (p) => String(p.rent_month || p.paid_on || '').slice(0, 7) === month
    ),
    paidBy = {};
  payments.forEach((p) => (paidBy[p.resident_id] = (paidBy[p.resident_id] || 0) + Number(p.amount)));
  const rentRows = people.map((r) => {
      const paid = paidBy[r.id] || 0,
        due = Number(r.rent) || 0,
        balance = Math.max(0, due - paid),
        status = balance <= 0 ? 'Paid' : paid > 0 ? 'Part paid' : dueDate < today ? 'Overdue' : 'Due';
      return {...r, paid, due, balance, status};
    }),
    rentDue = rentRows.reduce((n, r) => n + r.due, 0),
    rentCollected = rentRows.reduce((n, r) => n + r.paid, 0),
    rentOutstanding = rentRows.reduce((n, r) => n + r.balance, 0),
    rentPaidCount = rentRows.filter((r) => r.status === 'Paid').length,
    rentOpenCount = rentRows.filter((r) => r.balance > 0).length;
  const electricity = (window.pgElectricityBills || state.bills || []).filter(
      (b) => String(b.billing_month || '').slice(0, 7) === month
    ),
    meterRows = (window.pgElectricityReadings || []).filter((m) => String(m.billing_month || '').slice(0, 7) === month),
    billRows = electricity.map((b) => {
      const amount = Number(b.amount) || 0,
        paid = Math.min(amount, Number(b.paid_amount) || 0),
        waived = b.status === 'Waived',
        balance = waived ? 0 : Math.max(0, amount - paid),
        status = waived ? 'Waived' : balance <= 0 ? 'Paid' : paid > 0 ? 'Part paid' : 'Due';
      return {...b, paid, balance, status, waived};
    }),
    billable = billRows.filter((b) => !b.waived),
    billTotal = billable.reduce((n, b) => n + b.amount, 0),
    billCollected = billable.reduce((n, b) => n + b.paid, 0),
    billOutstanding = billable.reduce((n, b) => n + b.balance, 0),
    billPaidCount = billable.filter((b) => b.status === 'Paid').length,
    billOpenCount = billable.filter((b) => b.balance > 0).length;
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2}),
    units = (n) => Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2}),
    rentStatus = (r) =>
      `<span class="pill ${r.status === 'Overdue' ? 'late' : r.status === 'Due' ? 'soon' : ''}" style="${r.status === 'Paid' ? 'color:#357551;background:#edf7ef' : ''}">${r.status}</span>`,
    billStatus = (b) =>
      `<span class="pill ${b.status === 'Due' ? 'soon' : ''}" style="${b.status === 'Paid' ? 'color:#357551;background:#edf7ef' : b.status === 'Waived' ? 'color:#75847e;background:#f1f3f1' : ''}">${b.status}</span>`;
  document.getElementById('pageContent').innerHTML =
    `<div class="report-toolbar"><label>Report month <input id="reportMonth" type="month" value="${esc(month)}" onchange="renderReports()"></label><span class="report-note">Rent is due on the 2nd of each month · ${esc(monthLabel)}</span></div><section class="report-block"><div class="report-blockhead"><h3>Rent collection</h3><p>Expected rent compared with recorded payments. Due date: ${esc(dueLabel)}.</p></div><div class="report-metrics"><div class="report-metric"><span>Expected rent</span><strong>${money(rentDue)}</strong><small>${rentRows.length} residents due</small></div><div class="report-metric"><span>Collected</span><strong>${money(rentCollected)}</strong><small>${rentPaidCount} paid in full</small></div><div class="report-metric"><span>Outstanding</span><strong>${money(rentOutstanding)}</strong><small>${rentOpenCount} unpaid or part paid</small></div><div class="report-metric"><span>Collection rate</span><strong>${rentDue ? Math.min(100, Math.round((rentCollected / rentDue) * 100)) + '%' : '—'}</strong><small>For ${esc(monthLabel)}</small></div></div><div class="report-table"><table class="table"><thead><tr><th>Resident</th><th>Flat</th><th>Due date</th><th>Rent</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rentRows.length ? rentRows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.room || '—')}</td><td>${esc(dueLabel)}</td><td>${money(r.due)}</td><td>${money(r.paid)}</td><td>${money(r.balance)}</td><td>${rentStatus(r)}</td></tr>`).join('') : '<tr><td colspan="7" class="sub">No residents were due for rent in this month.</td></tr>'}</tbody></table></div></section><section class="report-block"><div class="report-blockhead"><h3>Electricity collection</h3><p>Electricity bills received in ${esc(monthLabel)}. Bills arrive every two months, so months without a bill may have no records. Partial payments count toward collected; waived bills are excluded from totals.</p></div><div class="report-metrics"><div class="report-metric"><span>Total billed</span><strong>${money(billTotal)}</strong><small>${billable.length} active bills</small></div><div class="report-metric"><span>Collected</span><strong>${money(billCollected)}</strong><small>${billPaidCount} bills paid in full</small></div><div class="report-metric"><span>Outstanding</span><strong>${money(billOutstanding)}</strong><small>${billOpenCount} unpaid or part paid</small></div><div class="report-metric"><span>Collection rate</span><strong>${billTotal ? Math.min(100, Math.round((billCollected / billTotal) * 100)) + '%' : '—'}</strong><small>${billRows.filter((b) => b.waived).length} waived</small></div></div><div class="report-table"><table class="table"><thead><tr><th>Resident</th><th>Flat</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due date</th><th>Status</th></tr></thead><tbody>${billRows.length ? billRows.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.flat || '—')}</td><td>${money(b.amount)}</td><td>${money(b.paid)}</td><td>${money(b.balance)}</td><td>${esc(b.due || '—')}</td><td>${billStatus(b)}</td></tr>`).join('') : '<tr><td colspan="7" class="sub">No electricity bills were created for this month.</td></tr>'}</tbody></table></div></section><section class="report-block"><div class="report-blockhead"><h3>Meter readings by flat</h3><p>Room 1 · Left meter and Room 2 · Right meter readings and units used for ${esc(monthLabel)}.</p></div><div class="report-metrics"><div class="report-metric"><span>Total units consumed</span><strong>${units(meterRows.reduce((n, m) => n + Number(m.current_room1_reading - m.previous_room1_reading) + Number(m.current_room2_reading - m.previous_room2_reading), 0))}</strong><small>${meterRows.length} flats with readings</small></div></div><div class="report-table"><table class="table"><thead><tr><th>Flat</th><th>Reading date</th><th>Room 1 · Left previous</th><th>Room 1 · Left current</th><th>Left units</th><th>Room 2 · Right previous</th><th>Room 2 · Right current</th><th>Right units</th><th>Total units</th><th>Main bill</th><th>Common meter total</th></tr></thead><tbody>${
      meterRows.length
        ? meterRows
            .map((m) => {
              const left = Number(m.current_room1_reading) - Number(m.previous_room1_reading),
                right = Number(m.current_room2_reading) - Number(m.previous_room2_reading);
              return `<tr><td><b>${esc(m.flat || '—')}</b></td><td>${esc(m.reading_date || '—')}</td><td>${units(m.previous_room1_reading)}</td><td>${units(m.current_room1_reading)}</td><td>${units(left)}</td><td>${units(m.previous_room2_reading)}</td><td>${units(m.current_room2_reading)}</td><td>${units(right)}</td><td>${units(left + right)}</td><td>${money(m.main_bill_amount)}</td><td>${money(m.common_meter_total)}</td></tr>`;
            })
            .join('')
        : '<tr><td colspan="11" class="sub">No meter readings were saved for this bill cycle.</td></tr>'
    }</tbody></table></div></section>`;
}
