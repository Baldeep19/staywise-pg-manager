// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it, vi} from 'vitest';

// Rows returned per table by the fake Supabase client. Everything else is an empty result.
const TABLES = {
  properties: [
    {id: 'p1', owner_id: 'u1', name: 'Sunrise PG', setup_complete: true},
    {id: 'p2', owner_id: 'u1', name: 'Lakeview PG', address: 'Lake Rd', setup_complete: true}
  ],
  property_expenses: [
    {
      id: 'e1',
      property_id: 'p1',
      expense_date: '2026-11-01',
      category: 'Repairs',
      description: 'Plumber',
      amount: 360,
      paid_by_user_id: 'u2'
    }
  ],
  property_members: [
    {property_id: 'p1', user_id: 'u2', ownership_percent: 30, display_name: 'Partner Two', email: 'two@example.com'}
  ],
  flats: [{id: 'f1', flat_number: 'A-101', floor_name: 'Ground', room_count: 2, active: true}],
  residents: [
    {
      id: 'r1',
      full_name: 'Asha',
      phone: '999',
      active: true,
      monthly_rent: 5000,
      deposit_amount: 10000,
      flats: {flat_number: 'A-101'}
    }
  ]
};
const PEOPLE = [
  {user_id: 'u1', display_name: 'Owner One', email: 'owner@example.com'},
  {user_id: 'u2', display_name: 'Partner Two', email: 'two@example.com'}
];
/** Every write the app sent: {table, ops: [[method, ...args], ...]}. */
const calls = [];
const signOut = vi.fn(async () => ({error: null}));

/** Chainable query builder: every method returns itself and awaiting it yields the table rows. */
function query(table) {
  const ops = [];
  const q = {
    then: (resolveFn) => {
      if (ops.some(([m]) => ['insert', 'update', 'upsert', 'delete'].includes(m))) calls.push({table, ops});
      const rows = TABLES[table] ?? [];
      if (!ops.some(([m]) => m === 'single')) return resolveFn({data: rows, error: null, count: 0});
      // .single() resolves one object: the first row merged with whatever the write sent
      const payload = ops.find(([m]) => ['insert', 'update', 'upsert'].includes(m))?.[1] ?? {};
      return resolveFn({data: {...rows[0], ...payload}, error: null});
    }
  };
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'upsert', 'delete', 'single'])
    q[m] = (...args) => (ops.push([m, ...args]), q);
  return q;
}
const channel = {on: () => channel, subscribe: () => channel};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: {session: {user: {id: 'u1', email: 'owner@example.com', user_metadata: {tour_completed: true}}}},
        error: null
      }),
      signOut: (...args) => signOut(...args)
    },
    from: (table) => query(table),
    rpc: async (name) => ({data: name === 'property_people' ? PEOPLE : [], error: null}),
    channel: () => channel,
    removeChannel: () => {}
  })
}));

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
  window.scrollTo = () => {};
  await import('../main.js'); // feature modules (provide window.applyCloudState, flatOccupancyInfo, ...)
  await import('../cloud/index.js'); // top-level await: restores the session and loads the property
});

describe('cloud session loading', () => {
  it('loads the property and flats into the app', () => {
    expect(window.pgPropertyName).toBe('Sunrise PG');
    expect(window.pgFlats.map((f) => f.flat_number)).toEqual(['A-101']);
    expect(document.getElementById('propertyNameHeading').textContent).toBe('Sunrise PG');
  });

  it('hides the sign-in gate once a session exists', () => {
    expect(document.getElementById('authGate').style.display).toBe('none');
  });

  it('renders dashboard summary cards from the loaded residents', () => {
    expect(document.getElementById('residentCount').textContent).toBe('1');
    expect(document.getElementById('occupancyValue').textContent).toBe('1 / 1');
  });

  it('loads partners and exposes the save helpers used by the Expenses page', () => {
    expect(window.pgPropertyPeople).toEqual(PEOPLE);
    expect(typeof window.savePropertyExpense).toBe('function');
    expect(typeof window.savePropertyMember).toBe('function');
  });

  it('keeps shared state in sync with the cloud rows', async () => {
    const {state} = await import('../app/store.js');
    expect(state.residents.map((r) => r.name)).toEqual(['Asha']);
  });

  it('lists every building in the header selector, with the current one selected', () => {
    const select = document.getElementById('propertySelect');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Sunrise PG', 'Lakeview PG']);
    expect(select.value).toBe('p1');
  });
});

describe('multiple buildings (Settings)', () => {
  it('shows the buildings on the Settings page', () => {
    window.goPage('settings');
    const text = document.getElementById('pageContent').textContent;
    expect(text).toContain('Sunrise PG');
    expect(text).toContain('Lakeview PG');
    expect(text).toContain('Current building');
  });

  it('opens the setup form in "new building" mode without touching the active building', async () => {
    const {session} = await import('../cloud/session.js');
    window.createNewBuilding();
    expect(document.getElementById('ownerSetupGate').style.display).toBe('block');
    expect(document.querySelector('#ownerSetupForm h2').textContent).toBe('Add a new building');
    expect(document.getElementById('skipPropertySetup').textContent).toBe('Cancel');
    expect(document.getElementById('ownerSetupForm').elements.propertyName.value).toBe('');
    expect(session.setup.createNew).toBe(true);
    expect(session.property.id).toBe('p1');
    document.getElementById('skipPropertySetup').click(); // cancel
    expect(document.getElementById('ownerSetupGate').style.display).toBe('none');
    expect(session.property.id).toBe('p1');
  });

  it('remembers the chosen building and reloads when switching', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', {...window.location, reload, hash: ''});
    window.switchProperty('p2');
    expect(localStorage.getItem('staywise_property_id')).toBe('p2');
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('manage partners', () => {
  it('lists the owner and partners, then updates and removes a partner', async () => {
    const {openPartnerManager} = await import('../app/partners.js');
    const onChange = vi.fn();
    openPartnerManager(onChange);
    const modal = document.querySelector('.overlay.show .modal');
    expect(modal.textContent).toContain('Owner One');
    expect(modal.textContent).toContain('Partner Two');

    // Update: change the share from 30 to 40
    const row = modal.querySelector('tr[data-user="u2"]');
    row.querySelector('.share').value = '40';
    calls.length = 0;
    row.querySelector('.save').click();
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0].table).toBe('property_members');
    expect(calls[0].ops).toContainEqual(['update', {ownership_percent: 40}]);
    expect(calls[0].ops).toContainEqual(['eq', 'user_id', 'u2']);
    expect(onChange).toHaveBeenCalled();

    // Remove: confirmed
    vi.stubGlobal('confirm', () => true);
    calls.length = 0;
    document.querySelector('.overlay.show tr[data-user="u2"] .remove').click();
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0].ops.map((o) => o[0])).toContain('delete');
    expect(calls[0].ops).toContainEqual(['eq', 'user_id', 'u2']);
    vi.unstubAllGlobals();
  });
});

describe('edit and delete expenses', () => {
  it('updates an expense in place, without wiping its notes', async () => {
    calls.length = 0;
    await window.updatePropertyExpense('e1', {
      date: '2026-11-02',
      category: 'Repairs',
      description: 'Plumber visit',
      amount: '400',
      paidTo: 'Ram',
      paidByUserId: 'u2'
    });
    expect(calls[0].table).toBe('property_expenses');
    // no `notes` key: the form does not edit notes, so they must not be overwritten with null
    expect(calls[0].ops).toContainEqual([
      'update',
      {
        expense_date: '2026-11-02',
        category: 'Repairs',
        description: 'Plumber visit',
        amount: 400,
        paid_to: 'Ram',
        paid_by_user_id: 'u2'
      }
    ]);
    expect(calls[0].ops).toContainEqual(['eq', 'id', 'e1']);
    expect(calls[0].ops).toContainEqual(['eq', 'property_id', 'p1']);
    expect(window.pgExpenses.find((x) => x.id === 'e1').description).toBe('Plumber visit');
  });

  it('deletes an expense and removes it from the loaded list', async () => {
    calls.length = 0;
    await window.deletePropertyExpense('e1');
    expect(calls[0].table).toBe('property_expenses');
    expect(calls[0].ops.map((o) => o[0])).toContain('delete');
    expect(calls[0].ops).toContainEqual(['eq', 'id', 'e1']);
    expect(window.pgExpenses.some((x) => x.id === 'e1')).toBe(false);
  });
});

describe('rent collector', () => {
  it('saves the chosen collector on the building', async () => {
    calls.length = 0;
    await window.setRentCollector('u2');
    expect(calls[0].table).toBe('properties');
    expect(calls[0].ops).toContainEqual(['update', {rent_collector_user_id: 'u2'}]);
    expect(calls[0].ops).toContainEqual(['eq', 'id', 'p1']);
    expect(window.pgProperties.find((p) => p.id === 'p1').rent_collector_user_id).toBe('u2');
  });

  it('clears the setting (the owner collects) when no one is chosen', async () => {
    calls.length = 0;
    await window.setRentCollector('');
    expect(calls[0].ops).toContainEqual(['update', {rent_collector_user_id: null}]);
  });
});

describe('logout', () => {
  it('signs out and clears cached Staywise data', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', {...window.location, reload, hash: ''});
    localStorage.setItem('staywise_residents', '[1]');
    localStorage.setItem('other_app_key', 'keep');
    document.getElementById('logoutButton').click();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(signOut).toHaveBeenCalled();
    expect(localStorage.getItem('staywise_residents')).toBeNull();
    expect(localStorage.getItem('other_app_key')).toBe('keep');
    vi.unstubAllGlobals();
  });
});
