/**
 * Inline form errors, the same for every form in the app (static and JS-built):
 *  - the browser's own bubble ("Please fill in this field") is replaced by a message under the field, which stays
 *    visible on phones, is linked to the field for screen readers (aria-invalid + aria-describedby) and clears as
 *    soon as the field is changed
 *  - the first bad field gets focus
 *  - formError() shows a problem that belongs to the whole form (e.g. the server refused the save) above its buttons
 * The browser still does the checking (required, min, type="email", …); this only changes how problems are shown.
 */

const labelOf = (el) => {
  const field = el.closest('.field');
  const text = (field?.querySelector('label, span')?.textContent || el.getAttribute('aria-label') || '').trim();
  return text.replace(/\s*\*$/, '');
};

/** Plain-language message for a field that failed the browser's checks. */
export function messageFor(el) {
  const v = el.validity;
  const label = labelOf(el);
  if (v.customError) return el.validationMessage;
  if (v.valueMissing)
    return el.tagName === 'SELECT'
      ? `Choose ${label ? label.toLowerCase() : 'an option'}`
      : `${label || 'This field'} is required`;
  if (v.badInput) return 'Enter a number';
  if (v.rangeUnderflow)
    return Number(el.min) > 0 && Number(el.min) < 1 ? 'Must be more than 0' : `Must be ${el.min} or more`;
  if (v.rangeOverflow) return `Must be ${el.max} or less`;
  if (v.stepMismatch) return el.step === '0.01' ? 'Use at most 2 decimal places' : 'Enter a whole number';
  if (v.typeMismatch) return el.type === 'email' ? 'Enter a valid email address' : el.validationMessage;
  if (v.tooShort) return `Use at least ${el.minLength} characters`;
  return el.validationMessage;
}

let seq = 0;
/** Show `message` under `el` (replacing any earlier one). */
export function showFieldError(el, message) {
  clearFieldError(el);
  const box = el.closest('.field') || el.parentElement;
  const note = document.createElement('small');
  note.className = 'field-error';
  note.id = 'field-error-' + ++seq;
  note.textContent = message;
  box.appendChild(note);
  el.setAttribute('aria-invalid', 'true');
  el.dataset.errorId = note.id;
  el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
}

export function clearFieldError(el) {
  const id = el.dataset?.errorId;
  if (!id) return;
  document.getElementById(id)?.remove();
  el.removeAttribute('aria-invalid');
  const rest = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
  if (rest.length) el.setAttribute('aria-describedby', rest.join(' '));
  else el.removeAttribute('aria-describedby');
  delete el.dataset.errorId;
}

/** Message for the whole form, shown above its buttons; pass '' to clear it. */
export function formError(form, message) {
  let box = form.querySelector('.form-error');
  if (!message) return box?.remove();
  if (!box) {
    box = document.createElement('p');
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    const foot = form.querySelector('.modal-foot, .formactions');
    if (foot) foot.before(box);
    else form.appendChild(box);
  }
  box.textContent = message;
}

/** Remove every inline error in a form (on open / reset). */
export function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('[data-error-id]').forEach(clearFieldError);
  formError(form, '');
}

const focusPending = new WeakSet();
function onInvalid(e) {
  const el = e.target;
  if (!el.form && !el.closest?.('form')) return;
  e.preventDefault(); // no browser bubble
  showFieldError(el, messageFor(el));
  // The browser fires one "invalid" per bad field; focus the first one once they have all been marked.
  const form = el.form || el.closest('form');
  if (focusPending.has(form)) return;
  focusPending.add(form);
  queueMicrotask(() => {
    focusPending.delete(form);
    form.querySelector('[aria-invalid="true"]')?.focus();
  });
}

const onEdit = (e) => {
  if (e.target.dataset?.errorId) clearFieldError(e.target);
  const form = e.target.form;
  if (form) formError(form, ''); // a changed form gets a fresh try
};

export function initFieldErrors() {
  document.addEventListener('invalid', onInvalid, true); // "invalid" does not bubble, so listen while capturing
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
  document.addEventListener('reset', (e) => clearFormErrors(e.target), true);
}
