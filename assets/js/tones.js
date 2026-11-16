// The single tone vocabulary and the maps shared by every status-like badge.
// Views must not keep their own copy of these tables: the same word gets the
// same tone on the list, board, detail, Bugs and Projects screens.

export const TONES = Object.freeze([
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'band',
  'muted',
]);

const TONE_BY_STATUS = Object.freeze({
  Done: 'success',
  Verified: 'success',
  Closed: 'success',
  'In progress': 'accent',
  Fixed: 'accent',
  Waiting: 'warning',
  Reopened: 'warning',
  Triaged: 'warning',
  'Wont fix': 'muted',
  Rejected: 'danger',
  Duplicate: 'muted',
  Deferred: 'muted',
  New: 'band',
  Open: 'band',
  'To do': 'band',
  'To Do': 'band',
});

const TONE_BY_STORAGE = Object.freeze({
  Granted: 'success',
  Denied: 'warning',
  Unsupported: 'muted',
});

const TONE_BY_PRIORITY = Object.freeze({
  Highest: 'danger',
  High: 'danger',
  Medium: 'warning',
  Low: 'success',
  Lowest: 'muted',
});

// Severity keeps its existing prefix rule: S1 danger, S2 warning, S3 accent,
// S4 muted. Unknown or missing values are muted.
const SEVERITY_PREFIXES = Object.freeze([
  ['S1', 'danger'],
  ['S2', 'warning'],
  ['S3', 'accent'],
  ['S4', 'muted'],
]);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

export function statusTone(status) {
  return TONE_BY_STATUS[status] ?? 'muted';
}

export function storageTone(status) {
  return TONE_BY_STORAGE[status] ?? 'muted';
}

export function priorityTone(priority) {
  return TONE_BY_PRIORITY[priority] ?? 'muted';
}

export function severityTone(severity) {
  const value = String(severity ?? '');
  const match = SEVERITY_PREFIXES.find(([prefix]) => value.startsWith(prefix));
  return match ? match[1] : 'muted';
}

export function badge(label, tone = 'muted') {
  const safeTone = TONES.includes(tone) ? tone : 'muted';
  return `<span class="badge badge-${safeTone}">${escapeHtml(label)}</span>`;
}
