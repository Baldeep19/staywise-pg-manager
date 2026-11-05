/** Format an amount as Indian rupees: whole numbers without decimals, otherwise exactly two (₹34,742.50). */
export function formatMoney(n) {
  const value = Number(n || 0);
  const decimals = Number.isInteger(value) ? 0 : 2;
  return '₹' + value.toLocaleString('en-IN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}
