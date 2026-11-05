// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, describe, expect, it} from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));
const errorFor = (el) => document.getElementById(el.dataset.errorId)?.textContent;

let fe;
beforeAll(async () => {
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  window.scrollTo = () => {};
  await import('../main.js');
  fe = await import('../app/field-errors.js');
});

describe('messages under the fields instead of the browser bubble', () => {
  it('marks every missing required field of the resident form and focuses the first', async () => {
    window.openModal('residentModal');
    const form = $('residentForm');
    form.requestSubmit(); // runs the browser checks; nothing is filled in
    await tick();
    const {name, phone} = form.elements;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(errorFor(name)).toBe('Full name is required'); // label text without the "*"
    expect(errorFor(phone)).toBe('Phone number is required');
    expect(name.getAttribute('aria-describedby')).toBe(name.dataset.errorId); // read out by screen readers
    expect(name.closest('.field').querySelector('.field-error')).not.toBeNull(); // shown under the field
    expect(document.activeElement).toBe(name);
  });

  it('clears a field’s message as soon as it is changed', () => {
    const {name, phone} = $('residentForm').elements;
    name.value = 'Aditi';
    name.dispatchEvent(new Event('input', {bubbles: true}));
    expect(name.hasAttribute('aria-invalid')).toBe(false);
    expect(name.hasAttribute('aria-describedby')).toBe(false);
    expect($('residentForm').querySelectorAll('.field-error').length).toBeGreaterThan(0); // others stay
    expect(phone.getAttribute('aria-invalid')).toBe('true');
  });

  it('starts clean the next time the popup opens', () => {
    window.closeModal('residentModal');
    window.openModal('residentModal');
    expect($('residentForm').querySelector('.field-error, [aria-invalid]')).toBeNull();
    window.closeModal('residentModal');
  });

  it('says an amount must be more than 0 on the rent form', async () => {
    window.openModal('rentModal');
    const amount = $('rentForm').elements.amount;
    amount.value = '0';
    $('rentForm').requestSubmit();
    await tick();
    expect(errorFor(amount)).toBe('Must be more than 0');
    window.closeModal('rentModal');
  });

  it('also works for forms built in JS (expenses, partners, …)', async () => {
    const box = document.createElement('div');
    box.className = 'overlay show';
    box.innerHTML = `<form class="modal"><div class="modalhead"><h2>Add expense</h2></div>
      <div class="field"><label>Description</label><input name="description" required></div>
      <div class="formactions"><button class="primary">Save</button></div></form>`;
    document.body.appendChild(box);
    await tick();
    const form = box.querySelector('form');
    form.requestSubmit();
    await tick();
    expect(errorFor(form.elements.description)).toBe('Description is required');
    box.remove();
  });
});

describe('messageFor', () => {
  const input = (attrs, value) => {
    const el = document.createElement('input');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.value = value;
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = '<label>Share *</label>';
    field.appendChild(el);
    return el;
  };
  it.each([
    [{type: 'number', min: '0', max: '100'}, '120', 'Must be 100 or less'],
    [{type: 'number', min: '1'}, '0', 'Must be 1 or more'],
    [{type: 'number', step: '0.01'}, '1.234', 'Use at most 2 decimal places'],
    [{type: 'email'}, 'nope', 'Enter a valid email address']
  ])('%o with %s', (attrs, value, expected) => {
    expect(fe.messageFor(input(attrs, value))).toBe(expected);
  });
  it('asks to choose for an empty required select', () => {
    const sel = document.createElement('select');
    sel.required = true;
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = '<label>Flat *</label>';
    field.appendChild(sel);
    expect(fe.messageFor(sel)).toBe('Choose flat');
  });
});

describe('formError: a problem with the whole form', () => {
  it('shows the message above the popup buttons, as an alert, and clears on the next edit', () => {
    window.openModal('rentModal');
    const form = $('rentForm');
    fe.formError(form, 'Payment was not recorded: network down');
    const box = form.querySelector('.form-error');
    expect(box.getAttribute('role')).toBe('alert');
    expect(box.nextElementSibling.classList.contains('modal-foot')).toBe(true);
    fe.formError(form, 'second'); // replaces, does not stack
    expect(form.querySelectorAll('.form-error').length).toBe(1);
    form.elements.note.dispatchEvent(new Event('input', {bubbles: true}));
    expect(form.querySelector('.form-error')).toBeNull();
    window.closeModal('rentModal');
  });
});
