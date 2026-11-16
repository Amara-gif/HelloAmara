// The only toast and dialog implementation. Pages call these helpers.
let toastRegion = null;
let modalCount = 0;

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function ensureToastRegion() {
  if (toastRegion && toastRegion.isConnected) return toastRegion;
  toastRegion = el('div', 'toast-region');
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  document.body.append(toastRegion);
  return toastRegion;
}

export function toast(message, { tone = 'info', duration = 4000 } = {}) {
  const region = ensureToastRegion();
  const node = el('div', tone === 'success' ? 'toast toast-success' : tone === 'danger' ? 'toast toast-danger' : 'toast');
  const text = el('span', 'toast-message');
  text.textContent = message;

  const close = el('button', 'btn btn-ghost btn-icon toast-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  const glyph = el('span');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '\u00d7';
  close.append(glyph);

  const remove = () => {
    clearTimeout(timer);
    node.remove();
  };
  close.addEventListener('click', remove);
  node.append(text, close);
  region.append(node);

  const timer = setTimeout(remove, duration);
  return remove;
}

function trapTab(event, modal) {
  const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function openModal({
  title = 'Dialog',
  message = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
} = {}) {
  const lastFocus = document.activeElement;
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');
  const titleId = `ui-modal-title-${++modalCount}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', titleId);

  const head = el('div', 'modal-head');
  const heading = el('h2');
  heading.id = titleId;
  heading.textContent = title;
  head.append(heading);

  const body = el('div', 'modal-body');
  const paragraph = el('p');
  paragraph.textContent = message;
  body.append(paragraph);

  const actions = el('div', 'modal-actions');
  const cancel = el('button', 'btn btn-ghost');
  cancel.type = 'button';
  cancel.textContent = cancelLabel;
  const confirm = el('button', tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary');
  confirm.type = 'button';
  confirm.textContent = confirmLabel;
  actions.append(cancel, confirm);

  modal.append(head, body, actions);
  backdrop.append(modal);

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapTab(event, modal);
    }
  };

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    if (onConfirm) onConfirm();
    close();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.append(backdrop);
  confirm.focus();
  return { close };
}
