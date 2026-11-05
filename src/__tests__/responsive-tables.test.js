// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {initResponsiveTables, labelTables} from '../app/responsive-tables.js';

const TABLE = `<table class="table"><thead><tr><th>Resident</th><th>Rent</th><th>Status</th><th></th></tr></thead>
  <tbody>
    <tr><td>Asha</td><td>₹5,000</td><td>Paid</td><td><button>Edit</button></td></tr>
    <tr><td colspan="4">No more residents</td></tr>
  </tbody></table>`;

describe('labelTables', () => {
  it('copies each column header onto the cells below it', () => {
    document.body.innerHTML = TABLE;
    labelTables();
    const cells = [...document.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((c) => c.dataset.label)).toEqual(['Resident', 'Rent', 'Status', '']);
  });

  it('gives "Action" columns no label so the buttons use the full card width', () => {
    document.body.innerHTML = TABLE.replace('<th></th>', '<th>Action</th>');
    labelTables();
    expect(document.querySelector('tbody tr:first-child td:last-child').dataset.label).toBe('');
  });

  it('leaves spanning empty-state rows unlabelled', () => {
    document.body.innerHTML = TABLE;
    labelTables();
    expect(document.querySelector('td[colspan]').hasAttribute('data-label')).toBe(false);
  });

  it('labels tables that are rendered later (page changes)', async () => {
    document.body.innerHTML = '<div id="pageContent"></div>';
    initResponsiveTables();
    document.getElementById('pageContent').innerHTML = TABLE; // what a page render does
    await Promise.resolve(); // MutationObserver callbacks run as a microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('td').dataset.label).toBe('Resident');
    expect(document.querySelectorAll('td')[1].dataset.label).toBe('Rent');
  });
});
