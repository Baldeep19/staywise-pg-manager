// @vitest-environment jsdom
import {beforeAll, describe, expect, it} from 'vitest';
import {labelTables} from '../app/responsive-tables.js';
import {state} from '../app/store.js';

beforeAll(async () => {
  document.body.innerHTML = '<input id="searchInput"><div id="pageContent"></div>';
  // Ravi has paid this month's rent in full; Asha has paid nothing.
  const month = new Date().toISOString().slice(0, 7);
  window.pgRentPayments = [{resident_id: 'r2', amount: 4000, rent_month: month + '-01'}];
  state.residents = [
    {
      id: 'r1',
      name: 'Asha Rao',
      phone: '9123456780',
      room: 'A-101',
      rent: 5000,
      deposit: 8000,
      status: 'Overdue',
      movein: '2026-01-01'
    },
    {
      id: 'r2',
      name: 'Ravi Kumar',
      phone: '9000000000',
      room: 'A-102',
      rent: 4000,
      deposit: 0,
      status: 'Paid',
      movein: '2026-01-01'
    }
  ];
  const {renderResidents} = await import('../app/residents.js');
  renderResidents();
  labelTables();
});

describe('residents list actions', () => {
  const rows = () => [...document.querySelectorAll('#pageContent tbody tr')];
  const actionCell = (row) => row.lastElementChild;

  it('has a single Actions column (no separate "Rent reminder" column)', () => {
    const headers = [...document.querySelectorAll('#pageContent thead th')].map((th) => th.textContent);
    expect(headers).toEqual(['Resident', 'Flat', 'Sharing', 'Rent', 'Status', 'Move-in', 'Actions']);
  });

  it('puts rent reminder, edit and remove together in one cell, so they share a line on phones', () => {
    const buttons = [...actionCell(rows()[0]).querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Rent reminder', 'Edit', 'Remove']);
  });

  it('only offers a reminder when rent is outstanding', () => {
    const texts = [...actionCell(rows()[1]).querySelectorAll('button')].map((b) => b.textContent);
    expect(texts).toEqual(['Edit', 'Remove']); // fully paid: no reminder button, and no empty placeholder
  });

  it('gives the action cell no label, so it uses the full card width on phones', () => {
    expect(actionCell(rows()[0]).dataset.label).toBe('');
  });
});
