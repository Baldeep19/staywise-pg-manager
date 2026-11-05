import {openPartnerManager} from './app/partners.js';
import {formatMoney as money} from './app/money.js';
import {buildMonthlyReport, monthLabel, shortMonthLabel, yearsWithData} from './app/monthly-report.js';
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

/** Signed amount for the explanation: "+ ₹X" when the partner owes, "− ₹X" when they are owed. */
function signed(n) {
  if (Math.abs(n) < 0.005) return '<span class="amt">₹0</span>';
  return n > 0 ? `<span class="amt owe">+ ${money(n)}</span>` : `<span class="amt owed">− ${money(-n)}</span>`;
}

/** Collapsible, line-by-line explanation of each partner's settlement using this month's real numbers. */
function renderBreakdown(result, collectorId, open) {
  const people = result.rows
    .map((r) => {
      const share = r.sharePercent;
      const others = 100 - share;
      const othersSpent = result.totalExpenses - r.paid;
      const {rentHeld, othersShare, paidCover} = r.breakdown;
      const lines = [];
      if (rentHeld > 0.005)
        lines.push(
          `<div class="settle-line"><div>Holds rent that belongs to the other partners<small>Collected ${money(r.collected)}; own ${share}% of the ${money(result.income)} rent is ${money((result.income * share) / 100)}</small></div>${signed(rentHeld)}</div>`
        );
      else if (rentHeld < -0.005)
        lines.push(
          `<div class="settle-line"><div>Rent collected by someone else that is theirs<small>${share}% of the ${money(result.income)} rent = ${money((result.income * share) / 100)}, held by ${esc(nameOf(collectorId))}</small></div>${signed(rentHeld)}</div>`
        );
      if (Math.abs(othersShare) > 0.005)
        lines.push(
          `<div class="settle-line"><div>${share}% of the expenses the other partners paid<small>Others paid ${money(othersSpent)}; ${share}% of that is ${money(othersShare)}</small></div>${signed(othersShare)}</div>`
        );
      if (Math.abs(paidCover) > 0.005)
        lines.push(
          `<div class="settle-line"><div>The other partners’ ${others}% of the expenses ${esc(r.name)} paid<small>${esc(r.name)} paid ${money(r.paid)}; ${others}% of that is ${money(-paidCover)}</small></div>${signed(paidCover)}</div>`
        );
      return `<div class="settle-person"><div class="settle-head"><b>${esc(r.name)}</b><span>${settlementCell(r.balance)}</span></div>
        ${lines.join('') || '<div class="settle-line"><div class="sub">Nothing to settle for this month.</div></div>'}
        <div class="settle-line net"><div>Net</div><span>${settlementCell(r.balance)}</span></div></div>`;
    })
    .join('');
  return `<details class="settle-explain"${open ? ' open' : ''}><summary>How is this calculated?</summary>
    <p class="settle-note">Rent and expenses are shared by ownership %. Each line shows what one partner owes the others:
      <b style="color:#b42318">+</b> means they owe money, <b style="color:#17684f">−</b> means they are owed money.
      Every partner’s lines add up to their net, and the nets add up to zero (what one pays, another receives).</p>
    ${people}</details>`;
}

/** Month-by-month table and expense categories for one year, with a View button per month. */
function renderMonthlyReport(year) {
  const payments = window.pgRentPayments || [];
  const expenses = window.pgExpenses || [];
  const years = yearsWithData({payments, expenses, fallbackYear: year});
  const report = buildMonthlyReport({payments, expenses, year});
  const profitColor = (n) => (n >= 0 ? '#17684f' : '#b42318');
  const rows = report.months
    .map(
      (
        m
      ) => `<tr><td><button class="link" data-view-month="${esc(m.month)}" title="View ${esc(monthLabel(m.month))}"><b>${esc(shortMonthLabel(m.month))}</b></button></td>
        <td>${money(m.income)}</td><td>${money(m.expenses)}</td>
        <td><b style="color:${profitColor(m.profit)}">${money(m.profit)}</b></td></tr>`
    )
    .join('');
  const total = report.months.length
    ? `<tr><td><b>Total ${esc(year)}</b></td><td><b>${money(report.totals.income)}</b></td><td><b>${money(report.totals.expenses)}</b></td>
        <td><b style="color:${profitColor(report.totals.profit)}">${money(report.totals.profit)}</b></td></tr>`
    : '';
  const categories = report.categories
    .map((c) => `<tr><td>${esc(c.category)}</td><td>${money(c.amount)}</td><td>${c.percent}%</td></tr>`)
    .join('');
  return `<section class="report-block" id="monthlyReport">
    <div class="report-blockhead" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><h3>Month-by-month report</h3><p>Rent collected, expenses and net profit for every month. Tap a month to see its details.</p></div>
      <label>Year <select id="reportYear">${years.map((y) => `<option${y === year ? ' selected' : ''}>${esc(y)}</option>`).join('')}</select></label>
    </div>
    <div class="report-table"><table class="table compact"><thead><tr><th>Month</th><th>Rent</th><th>Expenses</th><th>Net profit</th></tr></thead>
      <tbody>${rows ? rows + total : `<tr><td colspan="4" class="sub">No rent or expenses recorded in ${esc(year)}.</td></tr>`}</tbody></table></div>
    <div class="report-blockhead" style="margin-top:6px"><h3>Expenses by category, ${esc(year)}</h3></div>
    <div class="report-table"><table class="table compact"><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead>
      <tbody>${categories || '<tr><td colspan="3" class="sub">No expenses recorded.</td></tr>'}</tbody></table></div>
  </section>`;
}

export function renderExpensesPage() {
  const month = document.getElementById('expenseMonth')?.value || new Date().toISOString().slice(0, 7);
  const expenses = (window.pgExpenses || []).filter((x) => String(x.expense_date || '').slice(0, 7) === month);
  const income = (window.pgRentPayments || [])
    .filter((x) => String(x.rent_month || x.paid_on || '').slice(0, 7) === month)
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  const explainOpen = document.querySelector('.settle-explain')?.open === true; // keep it open after edits
  const reportYear = document.getElementById('reportYear')?.value || month.slice(0, 4);
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
        <td>${esc(x.paid_to || '—')}</td><td>${esc(nameOf(x.paid_by_user_id || collectorId))}</td><td>${money(x.amount)}</td>
        <td><button class="link" data-edit-expense="${esc(x.id)}">Edit</button> <button class="secondary" style="color:#b44;border-color:#eed2d0" data-delete-expense="${esc(x.id)}">Delete</button></td></tr>`
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
      <div style="padding:4px 18px 16px"><b>Who pays whom</b>${transfers}${shareWarning}${renderBreakdown(result, collectorId, explainOpen)}</div>
    </section>
    ${renderMonthlyReport(reportYear)}
    <section class="report-block"><div class="report-blockhead"><h3>Expenses</h3></div>
      <div class="report-table"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th>Paid by</th><th>Amount</th><th>Actions</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="7" class="sub">No expenses recorded for this month.</td></tr>'}</tbody></table></div>
    </section></div>`;
  document.getElementById('expenseMonth').onchange = renderExpensesPage;
  document.getElementById('addExpenseButton').onclick = () => openExpenseForm();
  document.getElementById('reportYear').onchange = renderExpensesPage;
  document.querySelectorAll('[data-view-month]').forEach((b) => {
    b.onclick = () => {
      document.getElementById('expenseMonth').value = b.dataset.viewMonth; // jump to that month's full details
      renderExpensesPage();
      window.scrollTo?.({top: 0, behavior: 'smooth'});
    };
  });
  document.querySelectorAll('[data-edit-expense]').forEach((b) => {
    b.onclick = () => openExpenseForm(expenses.find((x) => x.id === b.dataset.editExpense));
  });
  document.querySelectorAll('[data-delete-expense]').forEach((b) => {
    b.onclick = () => deleteExpense(expenses.find((x) => x.id === b.dataset.deleteExpense));
  });
  document.getElementById('managePartnerButton').onclick = () => openPartnerManager(renderExpensesPage);
}
const CATEGORIES = ['Utilities', 'Rent/lease', 'Repairs', 'Supplies', 'Salary', 'Other'];

/** Ask, then delete an expense and redraw (profit and settlement update from what is left). */
async function deleteExpense(expense) {
  if (!expense) return;
  if (!confirm(`Delete "${expense.description}" (${money(expense.amount)})? This cannot be undone.`)) return;
  try {
    await window.deletePropertyExpense(expense.id);
    toast('Expense deleted');
    renderExpensesPage();
  } catch (err) {
    toast('Could not delete expense: ' + err.message);
  }
}

/**
 * Add-expense dialog; pass an existing expense to edit it (the form opens pre-filled).
 * @param {object|null} [expense]
 */
function openExpenseForm(expense = null) {
  const editing = Boolean(expense);
  const box = document.createElement('div');
  box.className = 'overlay show';
  const people = window.pgPropertyPeople || [];
  // New expenses default to the person adding them; existing ones keep their payer (blank = the rent collector).
  const selectedPayer = editing
    ? expense.paid_by_user_id || rentCollectorId(currentBuilding())
    : window.pgCurrentUserId;
  const payerOptions = people
    .map(
      (x) =>
        `<option value="${esc(x.user_id)}"${x.user_id === selectedPayer ? ' selected' : ''}>${esc(x.display_name || x.email || x.user_id)}</option>`
    )
    .join('');
  const categories =
    CATEGORIES.includes(expense?.category) || !expense?.category ? CATEGORIES : [...CATEGORIES, expense.category];
  const categoryOptions = categories
    .map((c) => `<option${c === (expense?.category || 'Utilities') ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  box.innerHTML = `<form class="modal">
    <div class="modalhead"><div><h2>${editing ? 'Edit expense' : 'Add expense'}</h2><p>${editing ? 'Change the details; profit and settlement update automatically.' : 'Record a building expense and who paid it.'}</p></div><button type="button" class="close">×</button></div>
    <div class="formgrid">
      <div class="field"><label>Date</label><input name="date" type="date" required value="${esc(expense?.expense_date || new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>Category</label><select name="category">${categoryOptions}</select></div>
      <div class="field full"><label>Description</label><input name="description" required placeholder="e.g. Plumbing repair" value="${esc(expense?.description || '')}"></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" required value="${expense ? Number(expense.amount) : ''}"></div>
      <div class="field"><label>Paid to</label><input name="paidTo" placeholder="Vendor or partner" value="${esc(expense?.paid_to || '')}"></div>
      <div class="field full"><label>Paid by</label><select name="paidByUserId">${payerOptions}</select></div>
    </div>
    <div class="formactions"><button type="button" class="secondary close" style="min-width:78px;white-space:nowrap">Cancel</button><button class="primary">${editing ? 'Save changes' : 'Save expense'}</button></div>
  </form>`;
  box.querySelectorAll('.close').forEach((x) => (x.onclick = () => box.remove()));
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      if (editing) await window.updatePropertyExpense(expense.id, d);
      else await window.savePropertyExpense(d);
      box.remove();
      toast(editing ? 'Expense updated' : 'Expense saved');
      renderExpensesPage();
    } catch (err) {
      toast('Could not save expense: ' + err.message);
    }
  };
  document.body.appendChild(box);
}
// Routed like every other page (see pages/renderPage in app/ui.js); exposed on window to avoid an import cycle.
window.renderExpensesPage = renderExpensesPage;
