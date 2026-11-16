import './setup.js';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderView } from '../assets/js/views.js';
import { eventOccursOn, eventOccurrences, occurrences, dueReminders, notificationText } from '../assets/js/schedule.js';
import { start, getState, createEvent, deleteEvent } from '../assets/js/data.js';
import { closeAccountDb, getOne } from '../assets/js/db.js';
import { buildDemoData } from '../assets/js/demo-data.js';
import { tempAccountId, deleteAccountDb } from './helpers.js';

const route = { id: 'calendar', path: '/calendar', title: 'Calendar' };
let accountId;

afterEach(async () => {
  if (accountId) await deleteAccountDb(accountId);
  accountId = null;
});

const event = (overrides = {}) => ({
  id: 'e1', seriesId: 'e1', date: '2035-02-05', time: '10:00', title: 'Weekly standup',
  kind: 'Meeting', repeat: 'weekly', until: '', remind: '15', projectId: '', ...overrides,
});

function dayCell(html, date) {
  return html.match(new RegExp(`data-calendar-date="${date}"[\\s\\S]*?</div>`))?.[0] ?? '';
}

test('daily, weekdays, weekly and monthly repeats expand and honour until', () => {
  const daily = event({ repeat: 'daily', date: '2035-02-10', until: '2035-02-12' });
  assert.deepEqual(eventOccurrences(daily, '2035-02-01', '2035-02-28'), ['2035-02-10', '2035-02-11', '2035-02-12']);

  const weekdays = event({ repeat: 'weekdays', date: '2035-02-05', until: '2035-02-07' });
  assert.deepEqual(eventOccurrences(weekdays, '2035-02-01', '2035-02-28'), ['2035-02-05', '2035-02-06', '2035-02-07']);

  const weekly = event({ repeat: 'weekly', date: '2035-02-01', until: '2035-02-15' });
  assert.deepEqual(eventOccurrences(weekly, '2035-02-01', '2035-02-28'), ['2035-02-01', '2035-02-08', '2035-02-15']);

  const monthly = event({ repeat: 'monthly', date: '2035-01-15', until: '2035-04-15' });
  assert.deepEqual(eventOccurrences(monthly, '2035-01-01', '2035-05-31'), ['2035-01-15', '2035-02-15', '2035-03-15', '2035-04-15']);
  assert.equal(eventOccursOn(monthly, '2035-02-16'), false);
});

test('the visible month grid renders repeat occurrences on multiple days', () => {
  const state = {
    events: [
      event({ id: 'w', title: 'Weekly standup', repeat: 'weekly', date: '2035-02-01', until: '2035-02-15' }),
      event({ id: 'd', title: 'Daily focus', repeat: 'daily', date: '2035-02-10', until: '2035-02-12' }),
      event({ id: 'm', title: 'Month close', repeat: 'monthly', date: '2035-01-15', until: '2035-04-15' }),
    ],
    tasks: [], bugs: [], projects: [],
  };
  const html = renderView(route, new URLSearchParams('m=2035-02'), state);

  assert.match(dayCell(html, '2035-02-01'), /Weekly standup/);
  assert.match(dayCell(html, '2035-02-08'), /Weekly standup/);
  assert.match(dayCell(html, '2035-02-15'), /Weekly standup/);
  assert.match(dayCell(html, '2035-02-10'), /Daily focus/);
  assert.match(dayCell(html, '2035-02-12'), /Daily focus/);
  assert.match(dayCell(html, '2035-02-15'), /Month close/);
  assert.doesNotMatch(dayCell(html, '2035-02-22'), /Weekly standup/);
  assert.doesNotMatch(dayCell(html, '2035-02-13'), /Daily focus/);
});

test('next-seven agenda and the home agenda expand occurrences', () => {
  const now = new Date();
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = iso(now);
  const state = {
    events: [event({ id: 'r', title: 'Daily check-in', repeat: 'daily', date: today, until: '' })],
    tasks: [], bugs: [], projects: [],
  };
  const html = renderView(route, new URLSearchParams(''), state);
  const agenda = html.split('Next seven days')[1] ?? '';
  assert.match(agenda, /Daily check-in/);
  assert.ok((agenda.match(/Daily check-in/g) ?? []).length >= 2, 'the next-seven agenda shows more than the anchor day');

  const demo = buildDemoData();
  const homeState = { ...demo.stores, aiCalls: demo.stores.ai_calls, ...demo.meta, ...state };
  const home = renderView({ id: 'home', path: '/', title: 'Home' }, new URLSearchParams(''), homeState);
  assert.match(home, /Daily check-in/);
});

test('due reminders are found for the next hour and deduplicated', () => {
  const reminder = event({ id: 'rem', title: 'Supplier call', date: '2035-02-10', time: '10:00', repeat: '', remind: '15' });
  const from = new Date(2035, 1, 10, 9, 44);
  const to = new Date(2035, 1, 10, 10, 0);
  const due = dueReminders([reminder], from, to);
  assert.equal(due.length, 1);
  assert.equal(due[0].reminderKey, 'rem:2035-02-10:15');
  assert.equal(due[0].remindAt.toISOString(), new Date(2035, 1, 10, 9, 45).toISOString());
  assert.match(notificationText(due[0]), /2035-02-10 · 10:00/);
  assert.equal(dueReminders([reminder], from, to, { sent: new Set([due[0].reminderKey]) }).length, 0);
  assert.equal(dueReminders([reminder], from, new Date(2035, 1, 10, 9, 44, 59)).length, 0);
});

test('deleting any occurrence soft-deletes the whole series id', async () => {
  accountId = tempAccountId('calendar-repeats');
  await start({ id: accountId, name: 'Repeats', test: false });
  const first = await createEvent({ title: 'Series A', date: '2035-02-01', repeat: 'weekly', seriesId: 'series-a' });
  const second = await createEvent({ title: 'Series A later', date: '2035-02-08', repeat: 'weekly', seriesId: 'series-a' });
  const other = await createEvent({ title: 'Other event', date: '2035-02-09' });
  assert.equal(first.seriesId, 'series-a');

  await deleteEvent('series-a');
  assert.ok(!getState().events.some((row) => row.seriesId === 'series-a'));
  assert.ok(getState().events.some((row) => row.id === other.id));

  const storedFirst = await getOne('events', first.id);
  const storedSecond = await getOne('events', second.id);
  assert.ok(storedFirst.deletedAt);
  assert.ok(storedSecond.deletedAt);
  assert.equal(storedFirst.title, 'Series A');
  closeAccountDb();
});
