import {describe, expect, it} from 'vitest';
import {formatMoney} from '../app/money.js';
import {computeSettlement, rentCollectorId} from '../app/settlement.js';

const P1 = {user_id: 'p1', display_name: 'Partner 1', email: 'one@example.com'}; // the building owner
const P2 = {user_id: 'p2', display_name: 'Partner 2', email: 'two@example.com'};
const spend = (amount, by) => ({amount, paid_by_user_id: by});

/** The real example: partner 1 collects ₹2,04,000 and pays the landlord, maid and wifi; partner 2 pays utilities. */
const example = (overrides = {}) =>
  computeSettlement({
    income: 204000,
    expenses: [
      spend(128000, 'p1'),
      spend(6000, 'p1'),
      spend(2991, 'p1'),
      spend(1400, 'p2'),
      spend(716, 'p2'),
      spend(360, 'p2')
    ],
    people: [P1, P2],
    members: [{user_id: 'p2', ownership_percent: 50}], // partner 1 (owner) holds the remaining 50%
    ownerId: 'p1',
    collectorId: 'p1',
    ...overrides
  });

describe('profit sharing and settlement — worked example', () => {
  it('computes profit from rent collected minus all expenses', () => {
    const r = example();
    expect(r.totalExpenses).toBe(139467); // 136,991 + 2,476
    expect(r.profit).toBe(64533);
  });

  it('gives each partner half of the profit', () => {
    const [one, two] = example().rows;
    expect(one.sharePercent).toBe(50); // owner = the remainder after partner 2's 50%
    expect(one.profitShare).toBe(32266.5);
    expect(two.profitShare).toBe(32266.5);
  });

  it('shows what each partner collected and paid', () => {
    const [one, two] = example().rows;
    expect([one.collected, one.paid]).toEqual([204000, 136991]);
    expect([two.collected, two.paid]).toEqual([0, 2476]);
  });

  it('settles with partner 1 paying partner 2 ₹34,742.50', () => {
    const r = example();
    expect(r.rows.map((x) => x.balance)).toEqual([34742.5, -34742.5]);
    expect(r.transfers).toEqual([expect.objectContaining({from: 'Partner 1', to: 'Partner 2', amount: 34742.5})]);
  });

  it('leaves each partner holding exactly their profit share after the transfer', () => {
    const [one, two] = example().rows;
    const holdingOne = one.collected - one.paid - 34742.5;
    const holdingTwo = two.collected - two.paid + 34742.5;
    expect(holdingOne).toBe(32266.5);
    expect(holdingTwo).toBe(32266.5);
  });
});

describe('settlement breakdown (the "how is this calculated" lines)', () => {
  it("explains partner 1's settlement in three parts", () => {
    const [one] = example().rows;
    expect(one.breakdown).toEqual({
      rentHeld: 102000, // collected 2,04,000, own half is 1,02,000
      othersShare: 1238, // half of the 2,476 partner 2 paid
      paidCover: -68495.5 // partner 2's half of the 1,36,991 partner 1 paid
    });
  });

  it("explains partner 2's settlement in three parts", () => {
    const two = example().rows[1];
    expect(two.breakdown).toEqual({rentHeld: -102000, othersShare: 68495.5, paidCover: -1238});
  });

  it('always adds up to the net balance, to the cent', () => {
    const scenarios = [
      example(),
      example({members: [{user_id: 'p2', ownership_percent: 35}]}),
      example({collectorId: 'p2'}),
      example({income: 100.01, expenses: [spend(33.33, 'p2'), spend(0.07, 'p1')]}),
      example({people: [P1]}) // a removed partner
    ];
    for (const r of scenarios)
      for (const row of r.rows) {
        const {rentHeld, othersShare, paidCover} = row.breakdown;
        expect(Math.round((rentHeld + othersShare + paidCover) * 100)).toBe(Math.round(row.balance * 100));
      }
  });
});

describe('settlement rules', () => {
  it('balances always add up to zero', () => {
    const r = example({members: [{user_id: 'p2', ownership_percent: 35}]});
    expect(Math.round(r.rows.reduce((n, x) => n + x.balance, 0) * 100)).toBe(0);
  });

  it('uses the ownership percentages (60/40)', () => {
    const r = example({members: [{user_id: 'p2', ownership_percent: 40}]});
    expect(r.rows[0].profitShare).toBe(38719.8); // 60% of 64,533
    expect(r.rows[1].profitShare).toBe(25813.2);
  });

  it('treats an expense with no "paid by" as paid out of the collected rent', () => {
    const r = computeSettlement({
      income: 1000,
      expenses: [spend(200, null)],
      people: [P1, P2],
      members: [{user_id: 'p2', ownership_percent: 50}],
      ownerId: 'p1',
      collectorId: 'p1'
    });
    expect(r.rows[0].paid).toBe(200);
    expect(r.rows[1].balance).toBe(-400); // partner 2 is owed their 50% of the 800 profit
  });

  it('makes the owner the collector when none is chosen', () => {
    expect(rentCollectorId({owner_id: 'p1', rent_collector_user_id: null})).toBe('p1');
    expect(rentCollectorId({owner_id: 'p1', rent_collector_user_id: 'p2'})).toBe('p2');
    const r = example({collectorId: undefined});
    expect(r.rows[0].collected).toBe(204000);
  });

  it('works when the OTHER partner collects the rent', () => {
    const r = example({collectorId: 'p2'});
    // partner 2 would hold 204,000 − 2,476 = 201,524 while partner 1 is out of pocket 136,991.
    // Each should end with 32,266.50, so partner 2 pays partner 1: 201,524 − 32,266.50 = 169,257.50
    expect(r.transfers).toEqual([expect.objectContaining({from: 'Partner 2', to: 'Partner 1', amount: 169257.5})]);
  });

  it('settles three partners with the fewest transfers', () => {
    const P3 = {user_id: 'p3', display_name: 'Partner 3', email: 'three@example.com'};
    const r = computeSettlement({
      income: 90000,
      expenses: [spend(30000, 'p2')],
      people: [P1, P2, P3],
      members: [
        {user_id: 'p2', ownership_percent: 30},
        {user_id: 'p3', ownership_percent: 30}
      ],
      ownerId: 'p1',
      collectorId: 'p1'
    });
    // profit = 90,000 − 30,000 = 60,000 → shares: p1 40% (the remainder) = 24,000, p2 30% = 18,000, p3 30% = 18,000
    // balances: p1 = 90,000 − 0 − 24,000 = +66,000 (owes); p2 = 0 − 30,000 − 18,000 = −48,000; p3 = −18,000
    expect(r.rows.map((x) => x.balance)).toEqual([66000, -48000, -18000]);
    expect(r.transfers.map((t) => [t.from, t.to, t.amount])).toEqual([
      ['Partner 1', 'Partner 2', 48000],
      ['Partner 1', 'Partner 3', 18000]
    ]);
  });

  it('keeps the books balanced when a payer is no longer listed', () => {
    const r = example({people: [P1]}); // partner 2 was removed after paying expenses
    const former = r.rows.find((x) => x.name === 'Former partner');
    expect(former.paid).toBe(2476);
    expect(Math.round(r.rows.reduce((n, x) => n + x.balance, 0) * 100)).toBe(0);
  });

  it('warns when ownership does not add up to 100%', () => {
    expect(example({members: [{user_id: 'p2', ownership_percent: 130}]}).sharesTotal).toBe(130);
    expect(example().sharesTotal).toBe(100);
  });

  it('reports nothing to settle when there is no money at all', () => {
    const r = computeSettlement({
      income: 0,
      expenses: [],
      people: [P1, P2],
      members: [],
      ownerId: 'p1',
      collectorId: 'p1'
    });
    expect(r.transfers).toEqual([]);
    expect(r.rows.every((x) => x.balance === 0)).toBe(true);
  });
});

describe('formatMoney', () => {
  it.each([
    [204000, '₹2,04,000'],
    [34742.5, '₹34,742.50'],
    [0, '₹0'],
    [716.2, '₹716.20']
  ])('%s -> %s', (n, text) => expect(formatMoney(n)).toBe(text));
});
