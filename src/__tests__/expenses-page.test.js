// @vitest-environment jsdom
import {beforeAll, describe, expect, it, vi} from 'vitest';

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const expense = (amount, by, description) => ({
  expense_date: today,
  category: 'Other',
  description,
  amount,
  paid_by_user_id: by
});
const $ = (sel) => document.querySelector(sel);

beforeAll(async () => {
  document.body.innerHTML = '<div id="pageContent"></div><div id="toast"></div>';
  // The real example: partner 1 (owner) collects the rent and pays landlord/maid/wifi; partner 2 pays utilities.
  window.pgCurrentPropertyId = 'b1';
  window.pgProperties = [{id: 'b1', owner_id: 'p1', rent_collector_user_id: null}];
  window.pgPropertyPeople = [
    {user_id: 'p1', display_name: 'Partner 1', email: 'one@example.com'},
    {user_id: 'p2', display_name: 'Partner 2', email: 'two@example.com'}
  ];
  window.pgPropertyMembers = [{user_id: 'p2', ownership_percent: 50}];
  window.pgRentPayments = [{resident_id: 'r1', amount: 204000, paid_on: today, rent_month: today}];
  window.pgExpenses = [
    expense(128000, 'p1', 'Rent to landlord'),
    expense(6000, 'p1', 'Maid salary'),
    expense(2991, 'p1', 'Wifi bill'),
    expense(1400, 'p2', 'Drainage'),
    expense(716, 'p2', 'Housekeeping stuff'),
    expense(360, 'p2', 'Plumber items')
  ];
  const {renderExpensesPage} = await import('../expenses-ui.js');
  renderExpensesPage();
});

describe('Expenses & profit page', () => {
  it('shows rent collected, expenses and net profit', () => {
    const text = $('#pageContent').textContent;
    expect(text).toContain('₹2,04,000');
    expect(text).toContain('₹1,39,467');
    expect(text).toContain('₹64,533');
  });

  it('shows each partner what they collected, paid, keep and settle', () => {
    const rows = [
      ...document.querySelectorAll('.report-block:nth-of-type(1) tbody tr, #pageContent section:first-of-type tbody tr')
    ];
    const one = rows.find((r) => r.textContent.includes('Partner 1'));
    const two = rows.find((r) => r.textContent.includes('Partner 2'));
    expect(one.textContent).toContain('Collects rent');
    expect(one.textContent).toContain('₹2,04,000'); // collected
    expect(one.textContent).toContain('₹1,36,991'); // paid
    expect(one.textContent).toContain('₹32,266.50'); // profit share
    expect(one.textContent).toContain('Pays ₹34,742.50');
    expect(two.textContent).toContain('₹2,476');
    expect(two.textContent).toContain('Receives ₹34,742.50');
  });

  it('spells out who pays whom', () => {
    expect($('#pageContent').textContent).toContain('Partner 1 pays Partner 2 ₹34,742.50');
  });

  it('shows the person who paid each expense by name', () => {
    const wifi = [...document.querySelectorAll('#pageContent tr')].find((r) => r.textContent.includes('Wifi bill'));
    expect(wifi.textContent).toContain('Partner 1');
  });
});

describe('Manage partners: who collects the rent', () => {
  it('lets you choose the collector and re-calculates the settlement', async () => {
    window.setRentCollector = vi.fn(async (id) => {
      window.pgProperties[0].rent_collector_user_id = id;
    });
    $('#managePartnerButton').click();
    const select = $('.overlay.show select.collector');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Partner 1', 'Partner 2']);
    expect(select.value).toBe('p1'); // defaults to the building owner

    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(window.setRentCollector).toHaveBeenCalledWith('p2'));
    await vi.waitFor(() => expect($('#pageContent').textContent).toContain('Rent is collected by Partner 2'));
    expect($('#pageContent').textContent).toContain('Partner 2 pays Partner 1');
  });

  it('shows the owner their share as the remainder after the partners', () => {
    const modalText = $('.overlay.show').textContent;
    expect(modalText).toContain('50%');
    expect(modalText).toMatch(/owner — the remainder/);
    expect(month).toBeTruthy();
  });
});
