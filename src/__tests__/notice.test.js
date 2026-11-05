// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  addMonths,
  daysBetween,
  fillNoticeFields,
  initNoticeFields,
  noticeBadge,
  noticeInfo,
  noticePayload,
  renderNoticeCard,
  residentsOnNotice,
  todayIso
} from '../app/notice.js';

const TODAY = '2026-11-05';
/** Date `days` after TODAY. */
const add = (days) => new Date(Date.UTC(2026, 10, 5 + days)).toISOString().slice(0, 10);
/** A resident leaving in `left` days who gave notice `given` days ago (default: exactly one month before leaving). */
const onNotice = (id, left, given, extra = {}) => ({
  id,
  name: 'Resident ' + id,
  room: 'Flat 1',
  notice_on: given === undefined ? addMonths(add(left), -1) : add(-given),
  vacate_on: add(left),
  ...extra
});

describe('date helpers', () => {
  it('adds a month and clamps to the last day of shorter months', () => {
    expect(addMonths('2026-11-05', 1)).toBe('2026-12-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // leap year
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('counts whole days either way', () => {
    expect(daysBetween('2026-11-05', '2026-12-05')).toBe(30);
    expect(daysBetween('2026-11-05', '2026-11-03')).toBe(-2);
  });

  it("uses the device's local date, not UTC", () => {
    // 1 am on 5 Nov local time is still 4 Nov in UTC for India; the local day must win.
    expect(todayIso(new Date(2026, 10, 5, 1, 0))).toBe('2026-11-05');
  });
});

describe('noticeInfo colours by days left', () => {
  const level = (left) => noticeInfo(onNotice('x', left), TODAY).level;

  it('is null when the resident is not on notice', () => {
    expect(noticeInfo({id: 'a'}, TODAY)).toBeNull();
    expect(noticeInfo({notice_on: TODAY, vacate_on: ''}, TODAY)).toBeNull();
  });

  it('goes yellow -> orange -> red at 14 and 7 days', () => {
    expect(level(40)).toBe('yellow');
    expect(level(15)).toBe('yellow');
    expect(level(14)).toBe('orange');
    expect(level(8)).toBe('orange');
    expect(level(7)).toBe('red');
    expect(level(0)).toBe('red');
    expect(level(-3)).toBe('red');
  });

  it('labels the days left in plain words', () => {
    const label = (left) => noticeInfo(onNotice('x', left), TODAY).label;
    expect(label(12)).toBe('12 days left');
    expect(label(1)).toBe('Leaves tomorrow');
    expect(label(0)).toBe('Leaves today');
    expect(label(-1)).toBe('Was due out 1 day ago');
    expect(label(-3)).toBe('Was due out 3 days ago');
  });

  it('accepts notice given more than a month early, and flags short notice', () => {
    const early = noticeInfo({notice_on: '2026-10-01', vacate_on: '2026-12-15'}, TODAY);
    expect(early).toMatchObject({noticeDays: 75, shortBy: 0, daysLeft: 40, level: 'yellow'});
    const short = noticeInfo({notice_on: '2026-11-01', vacate_on: '2026-11-21'}, TODAY);
    expect(short).toMatchObject({noticeDays: 20, shortBy: 10, daysLeft: 16, level: 'yellow'});
    const exact = noticeInfo({notice_on: '2026-11-01', vacate_on: '2026-12-01'}, TODAY);
    expect(exact.shortBy).toBe(0);
  });
});

describe('residentsOnNotice', () => {
  it('keeps active residents with both dates, soonest first', () => {
    const rows = residentsOnNotice(
      [
        onNotice('later', 20),
        {id: 'staying', name: 'Staying'},
        onNotice('gone', 2, undefined, {active: false}),
        onNotice('soon', 3),
        onNotice('passed', -1)
      ],
      TODAY
    );
    expect(rows.map((r) => r.resident.id)).toEqual(['passed', 'soon', 'later']);
  });
});

describe('Overview "On notice" card', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="noticeCard" class="hidden"><div id="noticeSummary"></div><div id="noticeList"></div></div>';
  });
  const items = () => [...document.querySelectorAll('.notice-item')];

  it('stays hidden when nobody is on notice', () => {
    renderNoticeCard([{id: 'a', name: 'A'}], TODAY);
    expect(document.getElementById('noticeCard').classList.contains('hidden')).toBe(true);
  });

  it('lists residents with their colour, dates and days left', () => {
    renderNoticeCard([onNotice('a', 20), onNotice('b', 10), onNotice('c', 5)], TODAY);
    expect(document.getElementById('noticeCard').classList.contains('hidden')).toBe(false);
    expect(items().map((el) => el.className)).toEqual([
      'notice-item notice-red',
      'notice-item notice-orange',
      'notice-item notice-yellow'
    ]);
    expect(document.getElementById('noticeSummary').textContent).toBe('3 residents moving out · next: 5 days left');
    const first = items()[0];
    expect(first.querySelector('.notice-chip').textContent).toBe('5 days left');
    expect(first.textContent).toContain('Flat 1');
    expect(first.textContent).toContain('Leaves 10 Nov');
    expect(first.querySelector('.notice-open').getAttribute('onclick')).toBe("editResident('c')");
  });

  it('flags short notice and offers "Mark moved out" once the day has come', () => {
    renderNoticeCard([onNotice('late', -2, 10), onNotice('ok', 9)], TODAY);
    const [late, ok] = items();
    expect(late.querySelector('.notice-short').textContent).toBe('Short notice: 23 days under 1 month');
    expect(late.querySelector('button.rowbtn').getAttribute('onclick')).toBe("removeResident('late')");
    expect(ok.querySelector('.notice-short')).toBeNull();
    expect(ok.querySelector('button.rowbtn')).toBeNull();
    expect(document.getElementById('noticeSummary').textContent).toContain('one date has passed');
  });

  it('escapes resident names', () => {
    renderNoticeCard([onNotice('a', 5, undefined, {name: '<img src=x>'})], TODAY);
    expect(document.querySelector('.notice-item img')).toBeNull();
  });
});

describe('Residents list chip', () => {
  it('shows days left in the matching colour, nothing when not on notice', () => {
    document.body.innerHTML = noticeBadge(onNotice('a', 10), TODAY);
    const chip = document.querySelector('.notice-chip');
    expect(chip.className).toBe('notice-chip notice-orange');
    expect(chip.textContent).toBe('10 days left');
    expect(noticeBadge({id: 'b'}, TODAY)).toBe('');
  });
});

describe('resident form notice fields', () => {
  let form;
  beforeAll(() => {
    // Real markup from index.html so the test breaks if the field names change.
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const markup = html.match(/<form id="residentForm">[\s\S]*?<\/form>/)[0];
    document.body.innerHTML = '<div class="modal">' + markup + '</div>';
    form = document.getElementById('residentForm');
    initNoticeFields(form);
  });
  beforeEach(() => fillNoticeFields(form, null));
  const notice = () => form.elements.notice_on,
    vacate = () => form.elements.vacate_on;
  const type = (el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', {bubbles: true}));
  };

  it('fills the move-out day as one month after notice, and follows notice changes', () => {
    type(notice(), '2026-11-05');
    expect(vacate().value).toBe('2026-12-05');
    type(notice(), '2026-11-10');
    expect(vacate().value).toBe('2026-12-10');
    expect(form.querySelector('#noticeHint').textContent).toBe("30 days' notice");
  });

  it('keeps a later move-out day the owner chose (notice given early)', () => {
    type(notice(), '2026-11-05');
    type(vacate(), '2027-01-15');
    type(notice(), '2026-11-06');
    expect(vacate().value).toBe('2027-01-15');
    expect(form.querySelector('#noticeHint').textContent).toBe("70 days' notice");
  });

  it('says when notice is short', () => {
    type(notice(), '2026-11-05');
    type(vacate(), '2026-11-25');
    expect(form.querySelector('#noticeHint').textContent).toBe("20 days' notice — 10 days short of 1 month");
    expect(vacate().validity.valid).toBe(true);
  });

  it('blocks a move-out day before the notice day, or one date without the other', () => {
    type(notice(), '2026-11-05');
    type(vacate(), '2026-11-01');
    expect(vacate().validationMessage).toBe('Must be on or after the notice day');
    type(notice(), '');
    expect(notice().validationMessage).toBe('Add the day the resident gave notice');
    type(vacate(), '');
    expect(notice().validity.valid).toBe(true);
    expect(vacate().validity.valid).toBe(true);
  });

  it('opens the section for a resident on notice, and "Withdraw notice" clears both dates', () => {
    fillNoticeFields(form, {notice_on: '2026-11-01', vacate_on: '2026-12-01'});
    expect(form.querySelector('#noticeBox').open).toBe(true);
    expect(vacate().value).toBe('2026-12-01');
    form.querySelector('#noticeClear').click();
    expect(notice().value).toBe('');
    expect(vacate().value).toBe('');
    expect(form.closest('.modal').dataset.dirty).toBe('1'); // outside click will not lose this
  });

  it('stays closed for a resident who is not leaving', () => {
    fillNoticeFields(form, {notice_on: '', vacate_on: ''});
    expect(form.querySelector('#noticeBox').open).toBe(false);
  });
});

describe('noticePayload', () => {
  const data = (o) => {
    const d = new FormData();
    Object.entries(o).forEach(([k, v]) => d.append(k, v));
    return d;
  };
  it('sends both dates or neither', () => {
    expect(noticePayload(data({notice_on: '2026-11-01', vacate_on: '2026-12-01'}))).toEqual({
      notice_given_on: '2026-11-01',
      notice_vacate_on: '2026-12-01'
    });
    expect(noticePayload(data({notice_on: '', vacate_on: '2026-12-01'}))).toEqual({
      notice_given_on: null,
      notice_vacate_on: null
    });
  });
});
