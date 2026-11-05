// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it, vi} from 'vitest';

// Rows returned per table by the fake Supabase client. Everything else is an empty result.
const TABLES = {
  properties: [{id: 'p1', owner_id: 'u1', name: 'Sunrise PG', setup_complete: true}],
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
const PEOPLE = [{user_id: 'u1', display_name: 'Owner One', email: 'owner@example.com'}];

/** Chainable query builder: every method returns itself and awaiting it yields the table rows. */
function query(table) {
  const q = {
    then: (resolveFn) => resolveFn({data: TABLES[table] ?? [], error: null, count: 0})
  };
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'upsert', 'single']) q[m] = () => q;
  return q;
}
const channel = {on: () => channel, subscribe: () => channel};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({data: {session: {user: {id: 'u1', email: 'owner@example.com'}}}, error: null})
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
});
