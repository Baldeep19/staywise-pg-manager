/** Format an amount as Indian rupees: whole numbers without decimals, otherwise exactly two (₹34,742.50, -₹30,000). */
export function formatMoney(n) {
  const value = Number(n || 0);
  const decimals = Number.isInteger(value) ? 0 : 2;
  const digits = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return (value < 0 ? '-₹' : '₹') + digits; // sign first, so a loss reads -₹30,000 rather than ₹-30,000
}
