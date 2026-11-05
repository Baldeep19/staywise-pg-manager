// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import {renderRent} from '../app/rent.js';
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
    expect(document.querySelector('#pageContent button').textContent).toBe('Clear search');
  });
});
