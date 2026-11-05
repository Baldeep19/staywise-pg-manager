/**
 * Partner settlement: who owes whom after rent is collected by one partner and expenses are paid by several.
 *
 * Idea: after all expenses, what is left (the profit) is split by ownership %. Each partner should end up
 * holding exactly their share. Compare that with what they hold now:
 *
 *   holding now = rent they collected − expenses they paid
 *   balance     = holding now − profit share        (positive: owes money, negative: is owed money)
 *
 * Balances always add up to zero, so the debts can be settled with a few transfers.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const CENT = 0.005; // anything smaller is rounding noise

/** The building currently open in the app (from the cloud loader), or undefined. */
export const currentBuilding = () => (window.pgProperties || []).find((p) => p.id === window.pgCurrentPropertyId);

/** Who receives the rent: the chosen collector, otherwise the building owner. */
export const rentCollectorId = (building = currentBuilding()) =>
  building?.rent_collector_user_id || building?.owner_id || null;

/**
 * @param {object} input
 * @param {number} input.income Rent collected in the period.
 * @param {{amount: number|string, paid_by_user_id?: string|null}[]} input.expenses Expenses in the period.
 * @param {{user_id: string, display_name?: string, email?: string}[]} input.people Owner and partners.
 * @param {{user_id: string, ownership_percent?: number|string}[]} input.members Partner rows (hold the shares).
 * @param {string|null} input.ownerId The building owner, who holds whatever share the partners do not.
 * @param {string|null} input.collectorId Who holds the collected rent (defaults to the owner).
 */
export function computeSettlement({income, expenses, people, members, ownerId, collectorId}) {
  const collector = collectorId || ownerId;
  const shareOf = new Map(members.map((m) => [m.user_id, Number(m.ownership_percent || 0)]));
  const partnerTotal = [...shareOf.values()].reduce((n, v) => n + v, 0);

  // Expenses with no "paid by" are treated as paid out of the collected rent, i.e. by the collector.
  const paidBy = {};
  for (const e of expenses) {
    const payer = e.paid_by_user_id || collector;
    paidBy[payer] = (paidBy[payer] || 0) + Number(e.amount || 0);
  }
  const totalExpenses = round2(Object.values(paidBy).reduce((n, v) => n + v, 0));
  const profit = round2(Number(income || 0) - totalExpenses);

  // Include anyone who touched money even if they are no longer listed (e.g. a removed partner),
  // otherwise the balances would not add up to zero.
  const known = new Set(people.map((p) => p.user_id));
  const extras = [collector, ...Object.keys(paidBy)]
    .filter((id, i, all) => id && !known.has(id) && all.indexOf(id) === i)
    .map((id) => ({user_id: id, display_name: 'Former partner', email: ''}));

  const rows = [...people, ...extras].map((p) => {
    const sharePercent = shareOf.has(p.user_id)
      ? shareOf.get(p.user_id)
      : p.user_id === ownerId
        ? Math.max(0, 100 - partnerTotal)
        : 0;
    const collected = p.user_id === collector ? Number(income || 0) : 0;
    const paid = paidBy[p.user_id] || 0;
    const profitShare = round2((profit * sharePercent) / 100);
    const balance = round2(collected - paid - profitShare);
    // Same balance, explained in three parts (positive = owes, negative = is owed):
    //  rentHeld    rent this person holds beyond their own share of the rent
    //  othersShare their share of the expenses paid by the other partners
    //  paidCover   the other partners' share of the expenses this person paid (computed as the remainder so the
    //              three lines always add up to the balance to the cent)
    const share = sharePercent / 100;
    const rentHeld = round2(collected - share * Number(income || 0));
    const othersShare = round2(share * (totalExpenses - paid));
    const paidCover = round2(balance - rentHeld - othersShare);
    return {
      ...p,
      name: p.display_name || p.email || p.user_id,
      sharePercent,
      collected: round2(collected),
      paid: round2(paid),
      profitShare,
      balance,
      breakdown: {rentHeld, othersShare, paidCover}
    };
  });

  // Match people who owe with people who are owed, largest first, to keep the number of transfers small.
  const owes = rows
    .filter((r) => r.balance > CENT)
    .map((r) => ({...r, left: r.balance}))
    .sort((a, b) => b.left - a.left);
  const owed = rows
    .filter((r) => r.balance < -CENT)
    .map((r) => ({...r, left: -r.balance}))
    .sort((a, b) => b.left - a.left);
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < owes.length && j < owed.length) {
    const amount = round2(Math.min(owes[i].left, owed[j].left));
    if (amount > CENT)
      transfers.push({from: owes[i].name, to: owed[j].name, fromId: owes[i].user_id, toId: owed[j].user_id, amount});
    owes[i].left = round2(owes[i].left - amount);
    owed[j].left = round2(owed[j].left - amount);
    if (owes[i].left <= CENT) i += 1;
    if (owed[j].left <= CENT) j += 1;
  }

  const sharesTotal = round2(rows.reduce((n, r) => n + r.sharePercent, 0));
  return {income: round2(Number(income || 0)), totalExpenses, profit, rows, transfers, sharesTotal};
}
