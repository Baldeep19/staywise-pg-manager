/**
 * Phone-friendly tables. On narrow screens CSS (src/styles/overrides.css) turns each table row into a card and
 * prints each cell's column name before its value. That needs every cell to know its column name, so this
 * module copies the header text onto the cells (as `data-label`) whenever a table appears or changes —
 * no page has to change its own markup.
 */

/**
 * Give every body cell a `data-label` taken from its column header.
 * Rows that span columns (empty-state messages) and header-less columns (action buttons) get no label text.
 * @param {ParentNode} [root]
 */
export function labelTables(root = document) {
  root.querySelectorAll('table.table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, i) => {
        if (cell.colSpan > 1) return cell.removeAttribute('data-label'); // "No residents found" style rows
        const label = headers[i] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      });
    });
  });
}

/** Keep every table labelled as pages re-render. Called once from main.js. */
export function initResponsiveTables() {
  labelTables();
  // childList only: setting attributes does not re-trigger the observer, so there is no loop.
  new MutationObserver(() => labelTables()).observe(document.body, {childList: true, subtree: true});
}
