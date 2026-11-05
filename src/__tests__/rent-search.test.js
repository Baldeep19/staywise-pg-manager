// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import {renderRent, setRentFilter} from '../app/rent.js';
import {state} from '../app/store.js';

const search = (value) => {
  document.getElementById('searchInput').value = value;
  renderRent();
};
const names = () => [...document.querySelectorAll('#pageContent tbody tr b')].map((b) => b.textContent);

beforeEach(() => {
  document.body.innerHTML = '<input id="searchInput"><div id="pageContent"></div>';
  window.pgRentPayments = [];
  state.residents = [
    {id: 'r1', name: 'Asha Rao', phone: '9123456780', room: 'A-101', rent: 5000, status: 'Overdue'},
    {id: 'r2', name: 'Ravi Kumar', phone: '9000000000', room: 'A-102', rent: 4000, status: 'Paid'}
  ];
  setRentFilter('all');
});

describe('rent page search', () => {
  it('lists everyone when the box is empty', () => {
    search('');
    expect(names()).toEqual(['Asha Rao', 'Ravi Kumar']);
  });

  it('filters by name, case-insensitively', () => {
    search('RAVI');
    expect(names()).toEqual(['Ravi Kumar']);
  });

  it('filters by room and by phone', () => {
    search('a-101');
    expect(names()).toEqual(['Asha Rao']);
    search('9000');
    expect(names()).toEqual(['Ravi Kumar']);
  });

  it('shows an empty state with a clear button when nothing matches', () => {
    search('zzz');
    expect(document.querySelector('#pageContent').textContent).toContain('No residents found for zzz');
    const clear = document.querySelector('#pageContent .empty-state button');
    expect(clear.textContent).toBe('Clear search');
    clear.click();
    expect(names()).toEqual(['Asha Rao', 'Ravi Kumar']);
  });
});

describe('rent page filter chips', () => {
  const chip = (key) => document.querySelector(`[data-rent-filter="${key}"]`);
  const counts = () =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-rent-filter]')].map((b) => [
        b.dataset.rentFilter,
        b.querySelector('.chip-count').textContent
      ])
    );

  beforeEach(() => {
    state.residents.push(
      {id: 'r3', name: 'Meera Iyer', phone: '9555500000', room: 'B-201', rent: 6000, status: 'Part paid'},
      {id: 'r4', name: 'Dev Shah', phone: '9666600000', room: 'B-202', rent: 6000, status: 'Due'},
      {id: 'r5', name: 'Kiran Das', phone: '9777700000', room: 'A-103', rent: 4500, status: 'Overdue'}
    );
  });

  it('puts overdue first, then part paid and due, then paid', () => {
    search('');
    expect(names()).toEqual(['Asha Rao', 'Kiran Das', 'Meera Iyer', 'Dev Shah', 'Ravi Kumar']);
  });

  it('shows a count on every chip and marks the selected one', () => {
    search('');
    expect(counts()).toEqual({all: '5', overdue: '2', due: '2', paid: '1'});
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
  });

  it('filters by status; "Due" includes part paid', () => {
    search('');
    chip('overdue').click();
    expect(names()).toEqual(['Asha Rao', 'Kiran Das']);
    expect(chip('overdue').getAttribute('aria-pressed')).toBe('true');
    chip('due').click();
    expect(names()).toEqual(['Meera Iyer', 'Dev Shah']);
    chip('paid').click();
    expect(names()).toEqual(['Ravi Kumar']);
  });

  it('works together with the search box (counts follow the search too)', () => {
    search('a-10'); // Asha (A-101), Ravi (A-102), Kiran (A-103)
    expect(counts()).toEqual({all: '3', overdue: '2', due: '0', paid: '1'});
    chip('overdue').click();
    expect(names()).toEqual(['Asha Rao', 'Kiran Das']);
    search('kiran'); // the chip stays selected while typing
    expect(names()).toEqual(['Kiran Das']);
  });

  it('shows an empty state with "Show all" when a chip has nobody', () => {
    search('a-10');
    chip('due').click();
    expect(names()).toEqual([]);
    expect(document.querySelector('.empty-state').textContent).toContain('Nothing is due right now');
    document.querySelector('.empty-state button').click();
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    expect(names()).toHaveLength(3);
  });
});
