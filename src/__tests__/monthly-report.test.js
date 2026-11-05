import {describe, expect, it} from 'vitest';
import {buildMonthlyReport, monthLabel, shortMonthLabel, yearsWithData} from '../app/monthly-report.js';

const pay = (amount, rent_month, paid_on) => ({amount, rent_month, paid_on});
const spend = (amount, expense_date, category) => ({amount, expense_date, category});

describe('buildMonthlyReport', () => {
  const payments = [
    pay(100000, '2025-03-01'),
    pay(20000, '2025-04-01'),
    pay(100000, '2025-04-15'),
    pay(5000, '2024-12-01')
  ];
  const expenses = [
    spend(30000, '2025-03-10', 'Utilities'),
    spend(150000, '2025-04-05', 'Repairs'),
    spend(900, '2024-12-09', 'Other')
  ];
  const report = buildMonthlyReport({payments, expenses, year: '2025'});

  it('groups rent and expenses by month, newest first', () => {
    expect(report.months.map((m) => m.month)).toEqual(['2025-04', '2025-03']);
  });

  it("works out each month's net profit (a loss is negative)", () => {
    expect(report.months[0]).toEqual({month: '2025-04', income: 120000, expenses: 150000, profit: -30000});
    expect(report.months[1]).toEqual({month: '2025-03', income: 100000, expenses: 30000, profit: 70000});
  });

  it('totals the year and ignores other years', () => {
    expect(report.totals).toEqual({income: 220000, expenses: 180000, profit: 40000});
  });

  it('breaks expenses down by category with their share, biggest first', () => {
    expect(report.categories).toEqual([
      {category: 'Repairs', amount: 150000, percent: 83.3},
      {category: 'Utilities', amount: 30000, percent: 16.7}
    ]);
  });

  it('counts rent in its rent month, falling back to the day it was paid', () => {
    const r = buildMonthlyReport({
      payments: [pay(1000, '2025-06-01', '2025-07-02'), pay(500, undefined, '2025-07-03')],
      expenses: [],
      year: '2025'
    });
    expect(r.months.map((m) => [m.month, m.income])).toEqual([
      ['2025-07', 500],
      ['2025-06', 1000]
    ]);
  });

  it('files an expense with no category under Other', () => {
    const r = buildMonthlyReport({payments: [], expenses: [spend(10, '2025-01-01', undefined)], year: '2025'});
    expect(r.categories).toEqual([{category: 'Other', amount: 10, percent: 100}]);
  });

  it('skips months with nothing in them and returns zeros for an empty year', () => {
    const r = buildMonthlyReport({payments, expenses, year: '2030'});
    expect(r).toEqual({months: [], totals: {income: 0, expenses: 0, profit: 0}, categories: []});
  });

  it('adds up exactly with cents', () => {
    const r = buildMonthlyReport({
      payments: [pay(100.1, '2025-01-01')],
      expenses: [spend(0.2, '2025-01-02', 'Other')],
      year: '2025'
    });
    expect(r.months[0].profit).toBe(99.9);
  });
});

describe('yearsWithData', () => {
  it('lists years with data newest first and always includes the fallback year', () => {
    const years = yearsWithData({
      payments: [pay(1, '2024-05-01')],
      expenses: [spend(1, '2026-01-01', 'Other')],
      fallbackYear: 2025
    });
    expect(years).toEqual(['2026', '2025', '2024']);
  });
});

describe('monthLabel', () => {
  it('writes the month in words', () => {
    expect(monthLabel('2026-11')).toMatch(/November 2026/);
  });
});

describe('shortMonthLabel', () => {
  it('writes the short month for compact tables', () => {
    expect(shortMonthLabel('2026-11')).toMatch(/Nov 2026/);
  });
});
