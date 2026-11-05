// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import {emptyState, statusPill} from '../app/ui.js';
import {renderResidents} from '../app/residents.js';
import {renderElectricity} from '../app/electricity.js';
import {state} from '../app/store.js';

const content = () => document.getElementById('pageContent');

beforeEach(() => {
  document.body.innerHTML = '<input id="searchInput"><div id="pageContent"></div>';
});

describe('shared empty state', () => {
  it('has an icon, a title, one hint and one action', () => {
    content().innerHTML = emptyState({
      icon: 'zap',
      title: 'Nothing',
      text: 'Hint',
      action: {label: 'Go', primary: true}
    });
    const box = content().querySelector('.empty-state');
    expect(box.querySelector('[data-lucide="zap"]')).not.toBeNull();
    expect(box.querySelector('h3').textContent).toBe('Nothing');
    expect(box.querySelectorAll('button')).toHaveLength(1);
    expect(box.querySelector('button').className).toBe('primary');
    expect(box.getAttribute('style')).toBeNull(); // styling lives in CSS, not inline
  });

  it('Residents with nobody yet offers "Add resident" (not "Clear search")', () => {
    state.residents = [];
    renderResidents();
    expect(content().textContent).toContain('No residents yet');
    expect(content().querySelector('.empty-state button.primary').textContent).toContain('Add resident');
    expect(content().querySelector('.empty-state svg')).not.toBeNull(); // icon rendered
  });

  it('Residents with no match offers "Clear search"', () => {
    state.residents = [{id: 'r1', name: 'Asha', room: 'A-101', phone: '9', rent: 1, status: 'Paid'}];
    document.getElementById('searchInput').value = 'zzz';
    renderResidents();
    expect(content().textContent).toContain('No residents found for zzz');
    expect(content().querySelector('.empty-state button').textContent).toBe('Clear search');
  });

  it('Electricity with no bills offers to create them', () => {
    state.bills = [];
    renderElectricity();
    expect(content().querySelector('.empty-state button.primary').textContent).toContain('Create electricity bills');
  });
});

describe('status pills', () => {
  it.each([
    ['Overdue', 'late'],
    ['Due', 'soon'],
    ['Part paid', 'soon'],
    ['Paid', 'paid'],
    ['Waived', 'waived']
  ])('%s -> .%s, coloured by CSS instead of inline styles', (status, cls) => {
    content().innerHTML = statusPill(status);
    const pill = content().querySelector('.pill');
    expect(pill.classList.contains(cls)).toBe(true);
    expect(pill.hasAttribute('style')).toBe(false);
  });
});
