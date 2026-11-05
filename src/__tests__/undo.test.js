// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {flushUndo, putBack, toast, undoable} from '../app/ui.js';

const toastEl = () => document.getElementById('toast');

beforeEach(() => {
  document.body.innerHTML = '<div id="toast"></div>';
  vi.useFakeTimers();
});
afterEach(async () => {
  await flushUndo();
  vi.useRealTimers();
});

/** A list with one item to delete, plus the callbacks undoable() needs. */
function setup(commit = vi.fn(async () => {})) {
  const list = {items: ['a', 'b', 'c']};
  const job = {
    message: 'Deleted b',
    hide: vi.fn(() => (list.items = list.items.filter((x) => x !== 'b'))),
    restore: vi.fn(() => (list.items = ['a', 'b', 'c'])),
    commit
  };
  return {list, job};
}

describe('undoable delete', () => {
  it('hides at once and deletes only after 5 seconds', async () => {
    const {list, job} = setup();
    undoable(job);
    expect(list.items).toEqual(['a', 'c']);
    expect(toastEl().textContent).toContain('Deleted b');
    await vi.advanceTimersByTimeAsync(4900);
    expect(job.commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(job.commit).toHaveBeenCalledOnce();
    expect(job.restore).not.toHaveBeenCalled();
  });

  it('Undo restores and the delete never runs', async () => {
    const {list, job} = setup();
    undoable(job);
    toastEl().querySelector('.toast-action').click();
    expect(list.items).toEqual(['a', 'b', 'c']);
    expect(toastEl().textContent).toBe('Restored');
    await vi.advanceTimersByTimeAsync(10000);
    expect(job.commit).not.toHaveBeenCalled();
  });

  it('a second delete runs the first one straight away', async () => {
    const first = setup().job;
    const second = setup().job;
    undoable(first);
    undoable(second);
    expect(first.commit).toHaveBeenCalledOnce();
    expect(second.commit).not.toHaveBeenCalled();
    toastEl().querySelector('.toast-action').click(); // Undo now belongs to the second one
    expect(second.restore).toHaveBeenCalledOnce();
    expect(first.restore).not.toHaveBeenCalled();
  });

  it('puts the item back and says so when the delete fails', async () => {
    const {list, job} = setup(vi.fn(async () => Promise.reject(new Error('offline'))));
    undoable(job);
    await flushUndo();
    expect(list.items).toEqual(['a', 'b', 'c']);
    expect(toastEl().textContent).toBe('Could not delete: offline');
  });

  it('runs the waiting delete when the page is hidden', async () => {
    const {job} = setup();
    await import('../app/ui.js').then((m) => m.initUi());
    undoable(job);
    Object.defineProperty(document, 'visibilityState', {value: 'hidden', configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
    expect(job.commit).toHaveBeenCalledOnce();
    delete document.visibilityState;
  });
});

describe('toast', () => {
  it('a new toast is not hidden early by the previous one', () => {
    toast('first');
    vi.advanceTimersByTime(2000);
    toast('second');
    vi.advanceTimersByTime(1000); // the first toast's timer would have fired here
    expect(toastEl().classList.contains('show')).toBe(true);
    expect(toastEl().textContent).toBe('second');
    vi.advanceTimersByTime(2000);
    expect(toastEl().classList.contains('show')).toBe(false);
  });
});

describe('putBack', () => {
  it('re-inserts at the old position and keeps other changes', () => {
    expect(putBack([{id: 1}, {id: 3}, {id: 4}], {id: 2}, 1)).toEqual([{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
  });
  it('does not duplicate a row that is already there', () => {
    const list = [{id: 1}, {id: 2}];
    expect(putBack(list, {id: '2'}, 0)).toBe(list);
  });
});
