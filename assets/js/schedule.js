// Local recurring events and reminder polling helpers.
//
// Events store a single anchor row: `date`, an optional `repeat` (daily,
// weekdays, weekly, monthly or yearly) and an optional inclusive `until`.
// Everything else (month grid, agenda, notifications) expands that row here so
// the renderer and the reminder timer agree on which occurrence is due.

const DAY_MS = 86400000;
const MONTHLY_LAST_DAY = 'last-day';

const pad2 = (value) => String(value).padStart(2, '0');

export function toIsoDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function dayNumber(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? ''));
  if (!match) return null;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
}

function isoFromDayNumber(number) {
  const date = new Date(number * DAY_MS);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function addDaysIso(isoDate, amount) {
  const number = dayNumber(toIsoDate(isoDate));
  if (number === null) return '';
  return isoFromDayNumber(number + Number(amount || 0));
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function normalizeRepeat(repeat) {
  const value = String(repeat ?? '').trim().toLowerCase();
  if (value === 'weekday') return 'weekdays';
  if (value === 'none' || value === 'never' || value === 'no') return '';
  return value;
}

function anchorLastDay(anchor) {
  // Remember that the series started on the last day of its month, so a
  // monthly repeat keeps landing on month-end instead of silently skipping
  // short months.
  const [year, month] = anchor.split('-').map(Number);
  return Number(anchor.slice(8, 10)) === daysInMonth(year, month - 1) ? MONTHLY_LAST_DAY : '';
}

export function eventOccursOn(event, isoDate) {
  const anchor = toIsoDate(event?.date);
  const target = toIsoDate(isoDate);
  if (!anchor || !target) return false;
  const anchorNumber = dayNumber(anchor);
  const targetNumber = dayNumber(target);
  if (anchorNumber === null || targetNumber === null || targetNumber < anchorNumber) return false;

  const until = toIsoDate(event?.until);
  const untilNumber = until ? dayNumber(until) : null;
  if (untilNumber !== null && targetNumber > untilNumber) return false;

  const repeat = normalizeRepeat(event?.repeat);
  if (!repeat) return targetNumber === anchorNumber;

  const diff = targetNumber - anchorNumber;
  if (repeat === 'daily') return true;
  if (repeat === 'weekdays') {
    const weekday = new Date(targetNumber * DAY_MS).getUTCDay();
    return weekday >= 1 && weekday <= 5;
  }
  if (repeat === 'weekly') return diff % 7 === 0;
  if (repeat === 'monthly') {
    const targetYear = Number(target.slice(0, 4));
    const targetMonth = Number(target.slice(5, 7)) - 1;
    const targetDay = Number(target.slice(8, 10));
    const anchorDay = Number(anchor.slice(8, 10));
    const targetLastDay = daysInMonth(targetYear, targetMonth);
    if (anchorLastDay(anchor)) return targetDay === targetLastDay;
    if (targetDay === anchorDay) return true;
    // A 31st anchor still gets a monthly occurrence in 30-day months.
    return anchorDay > targetLastDay && targetDay === targetLastDay;
  }
  if (repeat === 'yearly') return target.slice(5) === anchor.slice(5);
  return targetNumber === anchorNumber;
}

// Expand a single event into the occurrence dates inside an inclusive range.
export function eventOccurrences(event, startDate, endDate) {
  const anchor = toIsoDate(event?.date);
  const start = toIsoDate(startDate);
  const end = toIsoDate(endDate);
  if (!anchor || !start || !end) return [];
  const until = toIsoDate(event?.until);
  const untilNumber = until ? dayNumber(until) : null;
  let from = Math.max(dayNumber(anchor), dayNumber(start));
  let to = Math.min(dayNumber(end), untilNumber ?? Infinity);
  if (from > to) return [];
  // A bad range should not lock a UI render in an effectively endless loop.
  if (to - from > 3700) to = from + 3700;
  const dates = [];
  for (let day = from; day <= to; day += 1) {
    const date = isoFromDayNumber(day);
    if (eventOccursOn(event, date)) dates.push(date);
  }
  return dates;
}

// Flatten many events into occurrence rows. The anchor fields are preserved and
// `date` is the occurrence date, so callers can render an expanded series with
// the same shape they already use for one-off events.
export function occurrences(events, startDate, endDate) {
  const rows = [];
  for (const event of events ?? []) {
    if (!event || event.deletedAt) continue;
    for (const date of eventOccurrences(event, startDate, endDate)) {
      rows.push({ ...event, date, occurrenceDate: date, seriesId: event.seriesId || event.id });
    }
  }
  return rows.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`) || String(a.id).localeCompare(String(b.id)));
}

// A compatibility name for callers that describe the operation as expansion.
export const expandOccurrences = occurrences;
export const occursOn = eventOccursOn;

function reminderTimestamp(occurrence) {
  const raw = occurrence?.remind;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const offset = Number(raw);
  if (!Number.isFinite(offset)) return null;
  const time = /^(\d{2}):(\d{2})$/.exec(String(occurrence?.time ?? '').trim()) ? String(occurrence.time).trim() : '09:00';
  const [hours, minutes] = time.split(':').map(Number);
  const date = toIsoDate(occurrence?.date);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime() - offset * 60000;
}

export function reminderAt(event, date) {
  const timestamp = reminderTimestamp({ ...event, date });
  return timestamp === null ? null : new Date(timestamp);
}

// Return the reminders whose notify moment falls in [from, to]. Occurrences
// with no reminder or no time are skipped, and the caller can pass a Set of
// keys to avoid notifying the same occurrence twice.
export function dueReminders(events, from = new Date(), to = new Date(Date.now() + 3600000), options = {}) {
  const fromTime = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const toTime = to instanceof Date ? to.getTime() : new Date(to).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) return [];
  const sent = options.sent instanceof Set ? options.sent : new Set(Array.isArray(options.sent) ? options.sent : []);
  const scanStart = addDaysIso(toIsoDate(new Date(fromTime)), -1);
  const scanEnd = addDaysIso(toIsoDate(new Date(toTime)), 2);
  return occurrences(events, scanStart, scanEnd)
    .map((occurrence) => {
      const timestamp = reminderTimestamp(occurrence);
      return timestamp === null ? null : {
        ...occurrence,
        remindAt: new Date(timestamp),
        reminderKey: `${occurrence.id}:${occurrence.date}:${occurrence.remind}`,
      };
    })
    .filter((occurrence) => occurrence && occurrence.remindAt.getTime() >= fromTime && occurrence.remindAt.getTime() <= toTime && !sent.has(occurrence.reminderKey))
    .sort((a, b) => a.remindAt - b.remindAt || String(a.id).localeCompare(String(b.id)));
}

export function notificationText(event) {
  const time = String(event?.time ?? '').trim();
  const when = [toIsoDate(event?.date), time].filter(Boolean).join(' · ');
  const note = String(event?.note ?? '').trim();
  return [when, note].filter(Boolean).join('\n');
}
