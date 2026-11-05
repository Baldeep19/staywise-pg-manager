import {openPartnerManager} from './app/partners.js';
import {formatMoney as money} from './app/money.js';
import {computeSettlement, currentBuilding, rentCollectorId} from './app/settlement.js';
import {esc, toast} from './app/ui.js';

// Resolve a user id to a partner/owner name (owners and partners are treated the same).
const nameOf = (id) => {
  const p = (window.pgPropertyPeople || []).find((x) => x.user_id === id);
  return p ? p.display_name || p.email : '—';
};

/** "Pays ₹X" / "Receives ₹X" / "Settled" for one partner's balance. */
function settlementCell(balance) {
  if (balance > 0.005) return `<b style="color:#b42318">Pays ${money(balance)}</b>`;
  if (balance < -0.005) return `<b style="color:#17684f">Receives ${money(-balance)}</b>`;
  return '<span class="sub">Settled</span>';
}

export function renderExpensesPage() {
  const month = document.getElementById('expenseMonth')?.value || new Date().toISOString().slice(0, 7);
  const expenses = (window.pgExpenses || []).filter((x) => String(x.expense_date || '').slice(0, 7) === month);
  const income = (window.pgRentPayments || [])
    .filter((x) => String(x.rent_month || x.paid_on || '').slice(0, 7) === month)
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  const building = currentBuilding();
  const collectorId = rentCollectorId(building);
  const result = computeSettlement({
    income,
    expenses,
    people: window.pgPropertyPeople || [],
    members: window.pgPropertyMembers || [],
    ownerId: building?.owner_id || null,
    collectorId
  });

  const shareRows = result.rows
    .map(
      (r) => `<tr>
        <td><b>${esc(r.name)}</b>${r.user_id === collectorId ? ' <span class="badge-you">Collects rent</span>' : ''}</td>
        <td>${r.sharePercent}%</td>
        <td>${money(r.collected)}</td>
        <td>${money(r.paid)}</td>
        <td>${money(r.profitShare)}</td>
        <td>${settlementCell(r.balance)}</td>
      </tr>`
    )
    .join('');
  const transfers = result.transfers.length
    ? `<ul style="margin:6px 0 0;padding-left:20px;line-height:1.8">${result.transfers
        .map((t) => `<li><b>${esc(t.from)}</b> pays <b>${esc(t.to)}</b> <b>${money(t.amount)}</b></li>`)
        .join('')}</ul>`
    : '<p class="sub" style="margin:6px 0 0">Everyone is settled for this month.</p>';
  const shareWarning =
    result.sharesTotal !== 100
      ? `<p class="hint" style="color:#b42318">Ownership shares add up to ${result.sharesTotal}%, not 100%. Adjust them in Manage partner.</p>`
      : '';
  const expenseRows = expenses
    .map(
      (
        x
      ) => `<tr><td>${esc(x.expense_date || '—')}</td><td>${esc(x.category || 'Other')}</td><td>${esc(x.description)}</td>
        <td>${esc(x.paid_to || '—')}</td><td>${esc(nameOf(x.paid_by_user_id || collectorId))}</td><td>${money(x.amount)}</td></tr>`
    )
    .join('');

  document.getElementById('pageContent').innerHTML = `<div style="padding:20px">
    <div class="pagehead"><div><h2>Expenses & profitability</h2><div class="sub">Track spending, split net profit by ownership, and see who owes whom.</div></div>
      <div style="display:flex;gap:8px"><button class="secondary" id="managePartnerButton">Manage partner</button><button class="primary" id="addExpenseButton">＋ Add expense</button></div></div>
    <div class="report-toolbar"><label>Month <input id="expenseMonth" type="month" value="${esc(month)}"></label></div>
    <div class="report-metrics">
      <div class="report-metric"><span>Rent collected</span><strong>${money(result.income)}</strong></div>
      <div class="report-metric"><span>Expenses</span><strong>${money(result.totalExpenses)}</strong></div>
      <div class="report-metric"><span>Net profit</span><strong style="color:${result.profit >= 0 ? '#17684f' : '#b42318'}">${money(result.profit)}</strong></div>
    </div>
    <section class="report-block">
      <div class="report-blockhead"><h3>Profit sharing & settlement</h3>
        <p>Each partner keeps their ownership share of the profit. “Pays” and “Receives” settle the difference between what each person holds (rent collected minus expenses paid) and their share. Rent is collected by <b>${esc(nameOf(collectorId))}</b> — change this in Manage partner.</p></div>
      <div class="report-table"><table class="table"><thead><tr><th>Partner</th><th>Ownership</th><th>Rent collected</th><th>Expenses paid</th><th>Profit share</th><th>Settlement</th></tr></thead>
        <tbody>${shareRows || '<tr><td colspan="6" class="sub">No partners found for this building.</td></tr>'}</tbody></table></div>
      <div style="padding:4px 18px 16px"><b>Who pays whom</b>${transfers}${shareWarning}</div>
    </section>
    <section class="report-block"><div class="report-blockhead"><h3>Expenses</h3></div>
      <div class="report-table"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th>Paid by</th><th>Amount</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="6" class="sub">No expenses recorded for this month.</td></tr>'}</tbody></table></div>
    </section></div>`;
  document.getElementById('expenseMonth').onchange = renderExpensesPage;
  document.getElementById('addExpenseButton').onclick = () => openExpenseForm();
  document.getElementById('managePartnerButton').onclick = () => openPartnerManager(renderExpensesPage);
}
function openExpenseForm() {
  const box = document.createElement('div');
  box.className = 'overlay show';
  const payers = (window.pgPropertyPeople || []).map((x) => ({
    id: x.user_id,
    label: x.display_name || x.email || x.user_id
  }));
  box.innerHTML = `<form class="modal"><div class="modalhead"><div><h2>Add expense</h2><p>Record a property expense and who paid it.</p></div><button type="button" class="close">×</button></div><div class="formgrid"><div class="field"><label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label>Category</label><select name="category"><option>Utilities</option><option>Rent/lease</option><option>Repairs</option><option>Supplies</option><option>Salary</option><option>Other</option></select></div><div class="field full"><label>Description</label><input name="description" required placeholder="e.g. Plumbing repair"></div><div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Paid to</label><input name="paidTo" placeholder="Vendor or partner"></div><div class="field full"><label>Paid by</label><select name="paidByUserId">${payers.map((x) => `<option value="${x.id}">${x.label}</option>`).join('')}</select></div></div><div class="formactions"><button type="button" class="secondary close" style="min-width:78px;white-space:nowrap">Cancel</button><button class="primary">Save expense</button></div></form>`;
  box.querySelectorAll('.close').forEach((x) => (x.onclick = () => box.remove()));
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await window.savePropertyExpense(d);
      box.remove();
      toast('Expense saved');
      renderExpensesPage();
    } catch (err) {
      toast('Could not save expense: ' + err.message);
    }
  };
  document.body.appendChild(box);
}
function installExpensesPage() {
  if (!window.goPage || document.querySelector('[data-page="expenses"]')) return;
  const nav = document.querySelector('.sidebottom .nav');
  if (!nav) return;
  const b = document.createElement('button');
  b.dataset.page = 'expenses';
  b.innerHTML = '<span class="ico">₹</span><span class="label">Expenses & profit</span>';
  nav.appendChild(b);
  b.onclick = () => {
    document.querySelectorAll('.nav button').forEach((x) => x.classList.toggle('active', x === b));
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('genericPage').classList.remove('hidden');
    document.getElementById('crumbPage').textContent = 'Expenses & profitability';
    document.getElementById('pageTitle').textContent = 'Expenses & profitability';
    document.getElementById('pageDesc').textContent = 'Track property spending and partner profit allocation';
    document.getElementById('pageCta').classList.add('hidden');
    renderExpensesPage();
  };
}
setTimeout(installExpensesPage, 0);
