// @vitest-environment jsdom
import {beforeAll, describe, expect, it, vi} from 'vitest';

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
let nextId = 0;
const expense = (amount, by, description) => ({
  id: 'e' + ++nextId,
  expense_date: today,
  category: 'Other',
  description,
  amount,
  paid_by_user_id: by
});
const $ = (sel) => document.querySelector(sel);

beforeAll(async () => {
  document.body.innerHTML = '<div id="pageContent"></div><div id="toast"></div>';
  window.scrollTo = () => {}; // jsdom does not implement scrolling
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

describe('"How is this calculated?" section', () => {
  const details = () => $('.settle-explain');
  const person = (name) => [...document.querySelectorAll('.settle-person')].find((p) => p.textContent.includes(name));

  it('is collapsed by default and can be opened', () => {
    expect(details()).not.toBeNull();
    expect(details().open).toBe(false);
    expect(details().querySelector('summary').textContent).toBe('How is this calculated?');
  });

  it("shows partner 1's three lines and net with the real numbers", () => {
    const text = person('Partner 1').textContent;
    expect(text).toContain('Holds rent that belongs to the other partners');
    expect(text).toContain('+ ₹1,02,000'); // rent held beyond their half
    expect(text).toContain('+ ₹1,238'); // their half of partner 2's 2,476
    expect(text).toContain('− ₹68,495.50'); // partner 2's half of partner 1's 1,36,991
    expect(text).toContain('Pays ₹34,742.50');
  });

  it("shows partner 2's lines: half of partner 1's expenses is theirs to bear, half of their own is covered", () => {
    const text = person('Partner 2').textContent;
    expect(text).toContain('− ₹1,02,000'); // their half of the rent held by partner 1
    expect(text).toContain('+ ₹68,495.50');
    expect(text).toContain('− ₹1,238'); // partner 1's half of the 2,476 partner 2 paid
    expect(text).toContain('Receives ₹34,742.50');
  });

  it('stays open after the page redraws (e.g. after an edit)', async () => {
    details().open = true;
    const {renderExpensesPage} = await import('../expenses-ui.js');
    renderExpensesPage();
    expect(details().open).toBe(true);
    details().open = false;
  });
});

describe('month-by-month report', () => {
  const thisYear = month.slice(0, 4);
  const section = () => $('#monthlyReport');
  const rowFor = (text) => [...section().querySelectorAll('tbody tr')].find((r) => r.textContent.includes(text));

  async function redraw() {
    const {renderExpensesPage} = await import('../expenses-ui.js');
    renderExpensesPage();
  }

  beforeAll(async () => {
    // Two earlier months in 2025: March is profitable, April is a loss.
    window.pgRentPayments.push(
      {resident_id: 'r1', amount: 100000, rent_month: '2025-03-01'},
      {resident_id: 'r1', amount: 120000, rent_month: '2025-04-01'}
    );
    window.pgExpenses.push(
      {
        id: 'x1',
        expense_date: '2025-03-10',
        category: 'Utilities',
        description: 'Old bill',
        amount: 30000,
        paid_by_user_id: 'p1'
      },
      {
        id: 'x2',
        expense_date: '2025-04-05',
        category: 'Repairs',
        description: 'Big repair',
        amount: 150000,
        paid_by_user_id: 'p1'
      }
    );
    await redraw(); // show the added months
  });

  it('defaults to the current year and totals it', () => {
    expect($('#reportYear').value).toBe(thisYear);
    const total = rowFor('Total ' + thisYear);
    expect(total.textContent).toContain('₹2,04,000'); // this year only has the current month's rent
    expect(total.textContent).toContain('₹1,39,467');
    expect(total.textContent).toContain('₹64,533');
  });

  it('offers every year that has data', () => {
    expect([...$('#reportYear').options].map((o) => o.value)).toEqual([thisYear, '2025']);
  });

  it('shows each month of the chosen year, with a loss shown as negative', async () => {
    $('#reportYear').value = '2025';
    $('#reportYear').dispatchEvent(new Event('change'));
    expect($('#reportYear').value).toBe('2025'); // the choice survives the redraw
    const april = rowFor('Apr 2025');
    expect(april.textContent).toContain('₹1,20,000');
    expect(april.textContent).toContain('₹1,50,000');
    expect(april.textContent).toContain('-₹30,000');
    expect(rowFor('Mar 2025').textContent).toContain('₹70,000');
    const total = rowFor('Total 2025');
    expect(total.textContent).toContain('₹2,20,000');
    expect(total.textContent).toContain('₹1,80,000');
    expect(total.textContent).toContain('₹40,000');
  });

  it('lists expenses by category for that year', () => {
    const text = section().textContent;
    expect(text).toContain('Expenses by category, 2025');
    expect(rowFor('Repairs').textContent).toContain('83.3%');
    expect(rowFor('Utilities').textContent).toContain('16.7%');
  });

  it("jumps to a month's full details with View", () => {
    rowFor('Apr 2025').querySelector('[data-view-month]').click();
    expect($('#expenseMonth').value).toBe('2025-04');
    expect($('.report-metrics').textContent).toContain('-₹30,000'); // that month's net profit
    expect($('#reportYear').value).toBe('2025');
  });

  it('shows a friendly message for a year with nothing in it', async () => {
    const opt = document.createElement('option');
    opt.textContent = '2031';
    $('#reportYear').append(opt);
    $('#reportYear').value = '2031';
    $('#reportYear').dispatchEvent(new Event('change'));
    expect(section().textContent).toContain('No rent or expenses recorded in 2031');
  });

  it('goes back to the current month for the tests that follow', async () => {
    $('#reportYear').value = thisYear;
    $('#expenseMonth').value = month;
    await redraw();
    expect($('#expenseMonth').value).toBe(month);
    expect(rowFor('Total ' + thisYear)).toBeTruthy();
  });
});

describe('editing and deleting expenses', () => {
  const rowFor = (text) => [...document.querySelectorAll('#pageContent tr')].find((r) => r.textContent.includes(text));
  const lastDialog = () => [...document.querySelectorAll('.overlay.show')].at(-1);

  beforeAll(() => {
    // Stand-ins for the cloud calls: they change the loaded data the same way the real ones do.
    window.updatePropertyExpense = vi.fn(async (id, d) => {
      window.pgExpenses = window.pgExpenses.map((x) =>
        x.id === id ? {...x, description: d.description, amount: Number(d.amount), paid_by_user_id: d.paidByUserId} : x
      );
    });
    window.deletePropertyExpense = vi.fn(async (id) => {
      window.pgExpenses = window.pgExpenses.filter((x) => x.id !== id);
    });
  });

  it('opens the form pre-filled with the existing values', () => {
    rowFor('Wifi bill').querySelector('[data-edit-expense]').click();
    const form = lastDialog().querySelector('form').elements;
    expect(lastDialog().querySelector('h2').textContent).toBe('Edit expense');
    expect(form.description.value).toBe('Wifi bill');
    expect(form.amount.value).toBe('2991');
    expect(form.date.value).toBe(today);
    expect(form.paidByUserId.value).toBe('p1'); // the payer is kept, not reset to the first person
    expect(lastDialog().textContent).toContain('Save changes');
  });

  it('saves the change and recalculates profit', async () => {
    const form = lastDialog().querySelector('form');
    form.elements.amount.value = '3500';
    form.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}));
    await vi.waitFor(() => expect(window.updatePropertyExpense).toHaveBeenCalled());
    const [id, values] = window.updatePropertyExpense.mock.calls[0];
    expect(id).toBe('e3');
    expect(values).toMatchObject({description: 'Wifi bill', amount: '3500', paidByUserId: 'p1'});
    await vi.waitFor(() => expect(rowFor('Wifi bill').textContent).toContain('₹3,500'));
    expect($('#pageContent').textContent).toContain('₹64,024'); // 64,533 − 509 more spent
    expect(document.querySelector('.overlay.show')).toBeNull(); // dialog closed
  });

  it('does nothing when you cancel the delete confirmation', () => {
    vi.stubGlobal('confirm', () => false);
    rowFor('Plumber items').querySelector('[data-delete-expense]').click();
    expect(window.deletePropertyExpense).not.toHaveBeenCalled();
    expect(rowFor('Plumber items')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('deletes after confirming and recalculates profit', async () => {
    const asked = vi.fn(() => true);
    vi.stubGlobal('confirm', asked);
    rowFor('Plumber items').querySelector('[data-delete-expense]').click();
    expect(asked.mock.calls[0][0]).toContain('Plumber items'); // says which expense
    await vi.waitFor(() => expect(window.deletePropertyExpense).toHaveBeenCalledWith('e6'));
    await vi.waitFor(() => expect(rowFor('Plumber items')).toBeUndefined());
    expect($('#pageContent').textContent).toContain('₹64,384'); // 64,024 + the 360 that is no longer spent
    vi.unstubAllGlobals();
  });

  it('adding a new expense still works and defaults the payer to the person adding it', () => {
    window.pgCurrentUserId = 'p2';
    $('#addExpenseButton').click();
    expect(lastDialog().querySelector('h2').textContent).toBe('Add expense');
    expect(lastDialog().querySelector('form').elements.paidByUserId.value).toBe('p2');
    lastDialog().querySelector('.close').click();
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
