import {toast} from './app/ui.js';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
// Resolve a user id to a partner/owner name (owners and partners are treated the same).
const nameOf = (id) => {
  const p = (window.pgPropertyPeople || []).find((x) => x.user_id === id);
  return p ? p.display_name || p.email : '—';
};
function renderExpensesPage() {
  const month = document.getElementById('expenseMonth')?.value || new Date().toISOString().slice(0, 7);
  const expenses = (window.pgExpenses || []).filter((x) => String(x.expense_date || '').slice(0, 7) === month);
  const income = (window.pgRentPayments || [])
    .filter((x) => String(x.rent_month || x.paid_on || '').slice(0, 7) === month)
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  const total = expenses.reduce((n, x) => n + Number(x.amount || 0), 0),
    profit = income - total;
  const shares = (window.pgPropertyMembers || []).map((x) => ({
    ...x,
    profit: (profit * Number(x.ownership_percent || 0)) / 100
  }));
  document.getElementById('pageContent').innerHTML =
    `<div style="padding:20px"><div class="pagehead"><div><h2>Expenses & profitability</h2><div class="sub">Track spending and allocate net profit using configured ownership shares.</div></div><div style="display:flex;gap:8px"><button class="secondary" id="managePartnerButton">Manage partner</button><button class="primary" id="addExpenseButton">＋ Add expense</button></div></div><div class="report-toolbar"><label>Month <input id="expenseMonth" type="month" value="${month}"></label></div><div class="report-metrics"><div class="report-metric"><span>Rent collected</span><strong>${money(income)}</strong></div><div class="report-metric"><span>Expenses</span><strong>${money(total)}</strong></div><div class="report-metric"><span>Net profit</span><strong style="color:${profit >= 0 ? '#17684f' : '#b42318'}">${money(profit)}</strong></div></div><section class="report-block"><div class="report-blockhead"><h3>Partner profit allocation</h3><p>Based on the ownership percentages configured for this property.</p></div><div class="report-table"><table class="table"><thead><tr><th>Partner</th><th>Ownership</th><th>Profit share</th></tr></thead><tbody>${shares.length ? shares.map((x) => `<tr><td>${x.display_name || x.email || x.user_id}</td><td>${Number(x.ownership_percent || 0)}%</td><td>${money(x.profit)}</td></tr>`).join('') : '<tr><td colspan="3" class="sub">No partner ownership shares configured yet.</td></tr>'}</tbody></table></div></section><section class="report-block"><div class="report-blockhead"><h3>Expenses</h3></div><div class="report-table"><table class="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th>Paid by</th><th>Amount</th></tr></thead><tbody>${expenses.length ? expenses.map((x) => `<tr><td>${x.expense_date || '—'}</td><td>${x.category || 'Other'}</td><td>${x.description}</td><td>${x.paid_to || '—'}</td><td>${nameOf(x.paid_by_user_id)}</td><td>${money(x.amount)}</td></tr>`).join('') : '<tr><td colspan="6" class="sub">No expenses recorded for this month.</td></tr>'}</tbody></table></div></section></div>`;
  document.getElementById('expenseMonth').onchange = renderExpensesPage;
  document.getElementById('addExpenseButton').onclick = () => openExpenseForm();
  document.getElementById('managePartnerButton').onclick = () => openPartnerForm();
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
function openPartnerForm() {
  const box = document.createElement('div');
  box.className = 'overlay show';
  box.innerHTML =
    '<form class="modal"><div class="modalhead"><div><h2>Allocate property to partner</h2><p>Partner must create an account first.</p></div><button type="button" class="close">×</button></div><div class="field"><label>Partner email address</label><input name="email" type="email" required placeholder="partner@example.com"></div><div class="field" style="margin-top:12px"><label>Ownership percentage</label><input name="ownershipPercent" type="number" min="0" max="100" step="0.01" required placeholder="50"></div><div class="formactions"><button class="primary">Save partner access</button></div></form>';
  box.querySelectorAll('.close').forEach((x) => (x.onclick = () => box.remove()));
  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try {
      await window.savePropertyMember(d);
      box.remove();
      toast('Partner access saved');
      renderExpensesPage();
    } catch (err) {
      toast('Could not save partner: ' + err.message);
    }
  };
  document.body.appendChild(box);
}
