/**
 * Dashboard summary cards, occupancy list and dues widget.
 */
import {renderNoticeCard} from '../app/notice.js';
import {session} from './session.js';

/** Install window.refreshDashboard (summary + dues) and render it once. */
export function installDashboard() {
  window.refreshDashboard = () => {
    const rs = JSON.parse(localStorage.getItem('staywise_residents') || '[]'),
      date = new Date(),
      month = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'),
      dueDate = month + '-02',
      today =
        date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0'),
      reportResidents = window.pgReportResidents || rs,
      eligible = reportResidents.filter(
        (r) => r.active !== false && (!r.movein || r.movein <= dueDate) && (!r.moveout || r.moveout >= dueDate)
      ),
      paidBy = {};
    (window.pgRentPayments || [])
      .filter((p) => String(p.rent_month || p.paid_on || '').slice(0, 7) === month)
      .forEach((p) => (paidBy[p.resident_id] = (paidBy[p.resident_id] || 0) + Number(p.amount)));
    const rentCollected = eligible.reduce((n, r) => n + (paidBy[r.id] || 0), 0),
      pendingDues = eligible.reduce((n, r) => n + Math.max(0, Number(r.rent || 0) - (paidBy[r.id] || 0)), 0),
      fullyPaid = eligible.filter((r) => (paidBy[r.id] || 0) >= Number(r.rent || 0)).length,
      pendingCount = eligible.filter((r) => (paidBy[r.id] || 0) < Number(r.rent || 0)).length,
      depositTotal = rs.reduce((n, r) => n + Number(r.deposit || 0), 0),
      depositResidents = rs.filter((r) => Number(r.deposit || 0) > 0).length,
      money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2}),
      monthLabel = date.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
    document.getElementById('residentCount').textContent = rs.length;
    document.getElementById('residentSummary').textContent = rs.length
      ? 'Across ' + session.flats.length + ' flats'
      : 'No residents added yet';
    const occupied = new Set(
      session.flats.filter((f) => window.flatOccupancyInfo(f, rs).used > 0).map((f) => f.flat_number)
    ).size;
    document.getElementById('occupancyValue').textContent = occupied + ' / ' + session.flats.length;
    document.getElementById('flatSummary').textContent =
      session.flats.length + ' flats · ' + session.flats.reduce((n, f) => n + Number(f.room_count || 0), 0) + ' rooms';
    document.getElementById('rentCollectedValue').textContent = money(rentCollected);
    document.getElementById('rentCollectedSummary').textContent = monthLabel + ' · ' + fullyPaid + ' paid in full';
    document.getElementById('pendingDuesValue').textContent = money(pendingDues);
    document.getElementById('pendingDuesSummary').textContent = pendingCount
      ? pendingCount + ' resident' + (pendingCount === 1 ? '' : 's') + ' unpaid or part paid'
      : 'No pending rent';
    document.getElementById('depositTotalValue').textContent = money(depositTotal);
    document.getElementById('depositTotalSummary').textContent = depositResidents
      ? depositResidents + ' tenant deposit' + (depositResidents === 1 ? '' : 's') + ' recorded'
      : 'No deposits recorded yet';
    document.getElementById('occupancyList').innerHTML =
      session.flats
        .map((f) => {
          const o = window.flatOccupancyInfo(f, rs),
            used = Number.isInteger(o.used) ? o.used : o.used.toFixed(1);
          return (
            '<div class="floor"><div class="floorlabel">' +
            window.esc(f.floor_name) +
            '</div><div class="roomrow"><button type="button" class="room room-select ' +
            o.state +
            '" data-flat="' +
            window.esc(f.flat_number) +
            '" aria-label="Open residents in ' +
            window.esc(f.flat_number) +
            '"><b>' +
            window.esc(f.flat_number) +
            '</b><small>' +
            o.count +
            ' resident' +
            (o.count === 1 ? '' : 's') +
            ' · ' +
            used +
            ' / ' +
            o.capacity +
            ' rooms occupied</small></button></div></div>'
          );
        })
        .join('') || '<div class="sub">No flats set up yet.</div>';
  };
  const renderDashboardDues = () => {
    const list = document.getElementById('dueList');
    if (!list) return;
    const month = new Date().toISOString().slice(0, 7),
      payments = window.pgRentPayments || [],
      dueRows = (window.pgReportResidents || [])
        .filter((r) => r.active !== false)
        .map((r) => {
          const paid = payments
              .filter(
                (p) =>
                  String(p.resident_id) === String(r.id) &&
                  String(p.rent_month || p.paid_on || '').slice(0, 7) === month
              )
              .reduce((n, p) => n + Number(p.amount || 0), 0),
            balance = Math.max(0, Number(r.rent || 0) - paid);
          return {...r, balance};
        })
        .filter((r) => r.balance > 0);
    const electricity = (window.pgElectricityBills || [])
      .filter(
        (b) => String(b.billing_month || '').slice(0, 7) === month && b.status !== 'Paid' && b.status !== 'Waived'
      )
      .map((b) => ({
        name: b.name,
        room: b.flat,
        balance: Math.max(0, Number(b.amount || 0) - Number(b.paid_amount || 0)),
        type: 'Electricity'
      }))
      .filter((b) => b.balance > 0);
    const rows = [
      ...dueRows.map((r) => ({name: r.name, room: r.room, balance: r.balance, type: 'Rent'})),
      ...electricity
    ];
    list.innerHTML = rows.length
      ? rows
          .slice(0, 8)
          .map(
            (r) =>
              '<div class="due-item"><div><b>' +
              window.esc(r.name) +
              '</b><small>' +
              window.esc(r.type) +
              ' · ' +
              window.esc(r.room || '') +
              '</small></div><strong>₹' +
              Number(r.balance).toLocaleString('en-IN', {maximumFractionDigits: 2}) +
              '</strong></div>'
          )
          .join('')
      : '<div class="sub" style="padding:12px 0">No rent or electricity dues recorded.</div>';
  };
  const previousRefreshDashboard = window.refreshDashboard;
  window.refreshDashboard = () => {
    previousRefreshDashboard();
    renderDashboardDues();
    renderNoticeCard(JSON.parse(localStorage.getItem('staywise_residents') || '[]'));
  };
  window.refreshDashboard();
}
