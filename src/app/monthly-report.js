/**
 * Month-by-month profit & expense report: pure calculation, no DOM.
 * Months and years are plain "YYYY-MM" / "YYYY" strings, matching how the rest of the app buckets rent and expenses.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "2026-11" for a rent payment (its rent month, else the day it was paid) or an expense (its date). */
const monthOfPayment = (p) => String(p.rent_month || p.paid_on || '').slice(0, 7);
const monthOfExpense = (e) => String(e.expense_date || '').slice(0, 7);

/** "November 2026" */
export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'});
}

/** "Nov 2026": the short form used in compact tables. */
export function shortMonthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {month: 'short', year: 'numeric'});
}

/** Years that have any rent or expenses, newest first (always includes `fallbackYear`). */
export function yearsWithData({payments, expenses, fallbackYear}) {
  const years = new Set([String(fallbackYear)]);
  for (const month of [...payments.map(monthOfPayment), ...expenses.map(monthOfExpense)]) {
    if (/^\d{4}-\d{2}$/.test(month)) years.add(month.slice(0, 4));
  }
  return [...years].sort().reverse();
}

/**
 * @param {object} input
 * @param {{amount: number|string, rent_month?: string, paid_on?: string}[]} input.payments Rent received.
 * @param {{amount: number|string, expense_date?: string, category?: string}[]} input.expenses
 * @param {string} input.year Four-digit year to report on.
 * @returns {{months: {month: string, income: number, expenses: number, profit: number}[],
 *            totals: {income: number, expenses: number, profit: number},
 *            categories: {category: string, amount: number, percent: number}[]}}
 *   months: only months that have data, newest first.
 */
export function buildMonthlyReport({payments, expenses, year}) {
  const byMonth = new Map();
  const bucket = (month) => {
    if (!byMonth.has(month)) byMonth.set(month, {month, income: 0, expenses: 0});
    return byMonth.get(month);
  };
  for (const p of payments) {
    const month = monthOfPayment(p);
    if (month.startsWith(year + '-')) bucket(month).income += Number(p.amount || 0);
  }
  const byCategory = new Map();
  for (const e of expenses) {
    const month = monthOfExpense(e);
    if (!month.startsWith(year + '-')) continue;
    bucket(month).expenses += Number(e.amount || 0);
    const category = e.category || 'Other';
    byCategory.set(category, (byCategory.get(category) || 0) + Number(e.amount || 0));
  }

  const months = [...byMonth.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((m) => ({
      month: m.month,
      income: round2(m.income),
      expenses: round2(m.expenses),
      profit: round2(m.income - m.expenses)
    }));
  const income = round2(months.reduce((n, m) => n + m.income, 0));
  const totalExpenses = round2(months.reduce((n, m) => n + m.expenses, 0));
  const categories = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      percent: totalExpenses ? Math.round((amount / totalExpenses) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  return {months, totals: {income, expenses: totalExpenses, profit: round2(income - totalExpenses)}, categories};
}
