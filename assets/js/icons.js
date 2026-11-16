// Inline SVG icons keep the page free of external requests and icon fonts.
const paths = {
  home: '<path d="M3.5 10.6 12 3.8l8.5 6.8"/><path d="M5.8 9.4V19a1.4 1.4 0 0 0 1.4 1.4h9.6A1.4 1.4 0 0 0 18.2 19V9.4"/><path d="M9.7 20.4v-5.6h4.6v5.6"/>',
  tasks:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="m7.4 9.3 1.4 1.4 2.4-2.4"/><path d="m7.4 15.3 1.4 1.4 2.4-2.4"/><path d="M14.2 9.8h3.4M14.2 15.8h3.4"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3.2v3.6M16 3.2v3.6M3.5 10h17"/><path d="M8 13.6h2M14 13.6h2M8 17.2h2"/>',
  bug: '<path d="M8.2 8.2a3.8 3.8 0 0 1 7.6 0v4.4a3.8 3.8 0 0 1-7.6 0Z"/><path d="m9.4 8.6-1.8-1.8M14.6 8.6l1.8-1.8M8.2 10.8H4.6M8.2 14.2H5M15.8 10.8h3.6M15.8 14.2H19M12 8v8.4"/>',
  events: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3.1 2"/>',
  data: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><path d="M12 7.7h.01"/>',
  shield:
    '<path d="M12 3.4 5 6.3v5.4c0 4.1 2.9 7.5 7 9.3 4.1-1.8 7-5.2 7-9.3V6.3Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  device:
    '<rect x="3" y="4.6" width="18" height="12" rx="2"/><path d="M9 20.4h6M12 16.6v3.8"/>',
  download: '<path d="M12 3.8v10"/><path d="m7.4 9.4 4.6 4.6 4.6-4.6"/><path d="M4.5 19.6h15"/>',
  user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M5.2 20c.8-3.3 3.5-5.2 6.8-5.2s6 1.9 6.8 5.2"/>',
  package:
    '<path d="m12 3.2 8 4.4v8.8l-8 4.4-8-4.4V7.6Z"/><path d="m4 7.6 8 4.4 8-4.4M12 12v8.8"/>',
  layers: '<path d="m12 3.2 8.5 4.6L12 12.4 3.5 7.8Z"/><path d="m3.5 12.4 8.5 4.6 8.5-4.6"/><path d="m3.5 16.6 8.5 4.6 8.5-4.6"/>',
  check: '<path d="m4.8 12.4 4.7 4.7 9.7-10.4"/>',
  arrow: '<path d="M5 12h13.4"/><path d="m13.2 6.4 5.6 5.6-5.6 5.6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  inbox: '<path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4"/><path d="M5.6 5.5h12.8l2.1 8v4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-4Z"/>',
  page: '<path d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1-1.5Z"/><path d="M14 3.5v4h4M8.5 12h7M8.5 15.5h5"/>',
  folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.7-3 2.9-4.8 5.5-4.8s4.8 1.8 5.5 4.8"/><path d="M15.5 6.2a3.1 3.1 0 0 1 0 5.8M17 14.9c2 .4 3.3 2 3.8 4.6"/>',
  tools: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-3-3Z"/><path d="m13 15 4 4"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>',
  spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M18.5 15.5 19 17l1.5.5-1.5.5-.5 1.5-.5-1.5L16 17l1.5-.5Z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.1-3.3-8.5S9.8 5.8 12 3.5Z"/>',
  camera: '<path d="M3.5 8.5h3.2L8.3 6h7.4l1.6 2.5h3.2v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z"/><circle cx="12" cy="13.2" r="3.2"/>',
  route: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h6.5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2-.8 2-1.9 0-1.5-1.2-1.8-1.2-3 0-1 .8-1.8 1.8-1.8h1.5A4.4 4.4 0 0 0 20.5 9c0-3.2-3.8-5.5-8.5-5.5Z"/><circle cx="7.6" cy="10" r="1"/><circle cx="10.5" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  chart: '<path d="M4 19.5V4.5M4 19.5h16"/><path d="M7.5 15.5V12M11.5 15.5V8M15.5 15.5v-4.5M19 15.5V6"/>',
};

export function icon(name, size = 20) {
  const body = paths[name];
  if (!body) return '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
