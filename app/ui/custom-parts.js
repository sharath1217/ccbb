// Our own SVG parts (battery, multimeter). Expose pinInfo like the Wokwi elements so wiring works the same.
class CbBattery extends HTMLElement {
  constructor() { super(); this.volts = 9; }
  connectedCallback() { this.render(); }
  render() {
    this.innerHTML = `<svg width="78" height="120" viewBox="0 0 78 120">
      <defs><linearGradient id="bg9" x1="0" x2="1"><stop offset="0" stop-color="#2b2f36"/><stop offset=".5" stop-color="#4a505a"/><stop offset="1" stop-color="#23262c"/></linearGradient>
      <linearGradient id="cu" x1="0" x2="1"><stop offset="0" stop-color="#b9772a"/><stop offset=".5" stop-color="#f0b45a"/><stop offset="1" stop-color="#a8641d"/></linearGradient></defs>
      <rect x="6" y="18" width="66" height="98" rx="6" fill="url(#bg9)"/>
      <rect x="6" y="18" width="66" height="34" rx="6" fill="url(#cu)"/><rect x="6" y="40" width="66" height="12" fill="url(#cu)"/>
      <text x="39" y="84" fill="#fff" font-family="Arial" font-weight="700" font-size="22" text-anchor="middle">${this.volts}V</text>
      <text x="39" y="102" fill="#aab" font-family="Arial" font-size="9" text-anchor="middle">ALKALINE</text>
      <rect x="16" y="6" width="14" height="13" rx="2" fill="#c9ccd2" stroke="#8a8f99"/><polygon points="50,6 62,6 64,12 62,19 50,19 48,12" fill="#c9ccd2" stroke="#8a8f99"/>
      <text x="23" y="34" font-family="Arial" font-weight="700" font-size="14" text-anchor="middle" fill="#7a1d1d">+</text><text x="56" y="34" font-family="Arial" font-weight="700" font-size="14" text-anchor="middle" fill="#222">−</text></svg>`;
  }
  get pinInfo() { return [{ name: '+', x: 23, y: 6 }, { name: '-', x: 56, y: 6 }]; }
}
class CbMultimeter extends HTMLElement {
  constructor() { super(); this._reading = '0.000 V'; this._mode = 'V'; }
  connectedCallback() { this.render(); }
  set reading(v) { this._reading = v; const t = this.querySelector('.rd'); if (t) t.textContent = v; }
  set mode(m) { this._mode = m; this.render(); }
  render() {
    const modes = [['V', 'V⎓', -55], ['A', 'A', 0], ['Ω', 'Ω', 55]];
    this.innerHTML = `<svg width="132" height="200" viewBox="0 0 132 200">
      <rect x="2" y="2" width="128" height="196" rx="16" fill="#f2b705"/><rect x="10" y="10" width="112" height="180" rx="10" fill="#2a2e35"/>
      <rect x="18" y="20" width="96" height="40" rx="5" fill="#b9c8a6"/>
      <text class="rd" x="108" y="50" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="18" fill="#141">${this._reading}</text>
      <circle cx="66" cy="112" r="30" fill="#1c1f24" stroke="#444" stroke-width="2"/>
      ${modes.map(([m, l, a]) => { const r = a * Math.PI / 180, x = 66 + Math.sin(r) * 42, y = 112 - Math.cos(r) * 38;
        return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="${m === this._mode ? '#ffd23f' : '#cfd3da'}">${l}</text>`; }).join('')}
      <rect x="61" y="86" width="10" height="34" rx="4" fill="#111" transform="rotate(${({ V: -55, A: 0, 'Ω': 55 })[this._mode]} 66 112)"/>
      <rect x="64" y="86" width="4" height="10" rx="2" fill="#ff4d4d" transform="rotate(${({ V: -55, A: 0, 'Ω': 55 })[this._mode]} 66 112)"/>
      <circle cx="44" cy="172" r="8" fill="#111" stroke="#555"/><circle cx="88" cy="172" r="8" fill="#7f1d1d" stroke="#555"/>
      <text x="44" y="158" text-anchor="middle" font-family="Arial" font-size="9" fill="#cfd3da">COM</text><text x="88" y="158" text-anchor="middle" font-family="Arial" font-size="9" fill="#cfd3da">VΩA</text></svg>`;
  }
  get pinInfo() { return [{ name: 'COM', x: 44, y: 172 }, { name: 'V', x: 88, y: 172 }]; }
}
customElements.define('cb-battery', CbBattery);
customElements.define('cb-multimeter', CbMultimeter);

// ---------------- Breadboard (half size, 30 columns) ----------------
// Hole pitch 9.6 px = 2.54 mm at 96 dpi, matching the Wokwi part graphics so legs line up with holes.
export const BB = { P: 9.6, X0: 16, cols: 30, rows: { TN: 12, TP: 21.6, A: 44, B: 53.6, C: 63.2, D: 72.8, E: 82.4, F: 111.2, G: 120.8, H: 130.4, I: 140, J: 149.6, BP: 172.8, BN: 182.4 }, W: 16 * 2 + 29 * 9.6, H: 196 };
export function bbHoles() {
  const out = [];
  for (const [r, y] of Object.entries(BB.rows)) for (let c = 1; c <= BB.cols; c++) out.push({ name: r + c, x: BB.X0 + (c - 1) * BB.P, y });
  return out;
}
const HOLES = bbHoles();
class CbBreadboard extends HTMLElement {
  connectedCallback() {
    const P = BB.P, R = BB.rows;
    const hole = h => `<rect x="${h.x - 1.6}" y="${h.y - 1.6}" width="3.2" height="3.2" rx=".6" fill="#3b3f46"/>`;
    const line = (y, c) => `<line x1="${BB.X0 - 4}" x2="${BB.W - BB.X0 + 4}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="1.2"/>`;
    const nums = [1, 5, 10, 15, 20, 25, 30].map(c => `<text x="${BB.X0 + (c - 1) * P}" y="${R.A - 7}" text-anchor="middle">${c}</text><text x="${BB.X0 + (c - 1) * P}" y="${R.J + 12}" text-anchor="middle">${c}</text>`).join('');
    const letters = 'ABCDEFGHIJ'.split('').map(l => `<text x="7" y="${R[l] + 2.5}" text-anchor="middle">${l.toLowerCase()}</text><text x="${BB.W - 7}" y="${R[l] + 2.5}" text-anchor="middle">${l.toLowerCase()}</text>`).join('');
    this.innerHTML = `<svg width="${BB.W}" height="${BB.H}" viewBox="0 0 ${BB.W} ${BB.H}">
      <rect x=".5" y=".5" width="${BB.W - 1}" height="${BB.H - 1}" rx="5" fill="#f4f2ec" stroke="#d8d3c6"/>
      <rect x="4" y="${(R.E + R.F) / 2 - 4}" width="${BB.W - 8}" height="8" rx="2" fill="#e6e2d8"/>
      ${line(R.TN - 6, '#2563eb')}${line(R.TP + 6, '#dc2626')}${line(R.BP - 6, '#dc2626')}${line(R.BN + 6, '#2563eb')}
      <g font-family="Arial" font-size="6" fill="#9a958a">${nums}${letters}
      <text x="7" y="${R.TN + 2.5}" text-anchor="middle" fill="#2563eb" font-size="8">−</text><text x="7" y="${R.TP + 2.5}" text-anchor="middle" fill="#dc2626" font-size="8">+</text>
      <text x="7" y="${R.BP + 2.5}" text-anchor="middle" fill="#dc2626" font-size="8">+</text><text x="7" y="${R.BN + 2.5}" text-anchor="middle" fill="#2563eb" font-size="8">−</text></g>
      ${HOLES.map(hole).join('')}</svg>`;
  }
  get pinInfo() { return HOLES; }
}
customElements.define('cb-breadboard', CbBreadboard);

// ---------------- Our own parts (legs on a 9.6 px = 2.54 mm grid so they seat in the breadboard) ----------------
import { BOARD_PINS } from '../engine/boards.js';
const PT = 9.6;
function svgPart(tag, { w, h, pins, draw, props = [] }) {
  customElements.define(tag, class extends HTMLElement {
    static get observedAttributes() { return props; }
    attributeChangedCallback() { this.render(); }
    connectedCallback() { this.render(); }
    render() { this.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">${draw.call(this, this)}</svg>`; }
    get pinInfo() { return typeof pins === 'function' ? pins.call(this, this) : pins; }
  });
}
const leg = (x, y1, y2) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#a9adb5" stroke-width="1.6" stroke-linecap="round"/>`;
const txt = (x, y, t, s = 6, c = '#e9ecf1', a = 'middle', wgt = 700) => `<text x="${x}" y="${y}" font-family="Arial" font-size="${s}" font-weight="${wgt}" fill="${c}" text-anchor="${a}">${t}</text>`;

// Ceramic capacitor: 2 legs, 1 pitch apart
svgPart('cb-capacitor', { w: 20, h: 30, pins: [{ name: '1', x: 5.2, y: 30 }, { name: '2', x: 14.8, y: 30 }], props: ['label'],
  draw: el => `${leg(5.2, 14, 30)}${leg(14.8, 14, 30)}<ellipse cx="10" cy="9" rx="9" ry="8" fill="#e3a42b" stroke="#b97c12"/>${txt(10, 11, el.getAttribute('label') || '104', 5.5, '#5a3a06')}` });
// Electrolytic capacitor: stripe marks the − leg
svgPart('cb-ecap', { w: 22, h: 44, pins: [{ name: '+', x: 6.2, y: 44 }, { name: '-', x: 15.8, y: 44 }], props: ['label'],
  draw: el => `${leg(6.2, 30, 44)}${leg(15.8, 30, 44)}<rect x="1" y="1" width="20" height="30" rx="4" fill="#1f3c88"/><rect x="14" y="1" width="6" height="30" fill="#c7d2fe"/>
    ${txt(17, 12, '−', 7, '#1f3c88')}${txt(17, 20, '−', 7, '#1f3c88')}<ellipse cx="11" cy="2" rx="10" ry="2" fill="#9aa3b5"/>${txt(7.5, 22, el.getAttribute('label') || '100µ', 5, '#fff')}` });
// Diode (axial, 4 pitches)
svgPart('cb-diode', { w: 38.4, h: 12, pins: [{ name: 'A', x: 0, y: 6 }, { name: 'K', x: 38.4, y: 6 }], props: ['kind'],
  draw: el => `<line x1="0" y1="6" x2="38.4" y2="6" stroke="#a9adb5" stroke-width="1.6"/><rect x="10" y="2" width="18.4" height="8" rx="2" fill="${el.getAttribute('kind') === 'schottky' ? '#2a2a2e' : '#222'}"/><rect x="24" y="2" width="2.6" height="8" fill="#d6d9de"/>` });
// TO-92 transistor (BC547/BC557): pins C B E left→right, flat face toward you
svgPart('cb-to92', { w: 26, h: 40, pins: function () { const n = (this.getAttribute('pinnames') || 'C,B,E').split(','); return n.map((name, i) => ({ name, x: 3.4 + i * 9.6, y: 40 })); }, props: ['label', 'pinnames'],
  draw: el => `${leg(3.4, 20, 40)}${leg(13, 20, 40)}${leg(22.6, 20, 40)}<path d="M1 21 V8 a12 8 0 0 1 24 0 V21 Z" fill="#26282c"/>${txt(13, 15, el.getAttribute('label') || 'BC547', 5.2)}
    ${(el.getAttribute('pinnames') || 'C,B,E').split(',').map((n, i) => txt(3.4 + i * 9.6, 48, n, 4.2, '#6b7385')).join('')}` });
// TO-220 (MOSFET G D S, 7805 IN GND OUT)
svgPart('cb-to220', { w: 30, h: 66, pins: function () { const n = (this.getAttribute('pins') || 'G,D,S').split(','); return n.map((name, i) => ({ name, x: 5.4 + i * PT, y: 66 })); }, props: ['label', 'pins'],
  draw: el => { const n = (el.getAttribute('pins') || 'G,D,S').split(',');
    return `<rect x="1" y="0" width="28" height="16" rx="1.5" fill="#c9ccd2"/><circle cx="15" cy="7" r="3.4" fill="#f4f2ec"/><rect x="0" y="15" width="30" height="27" rx="1.5" fill="#222428"/>
    ${txt(15, 27, el.getAttribute('label') || 'IRLZ44N', 5.5)}${n.map((p, i) => leg(5.4 + i * PT, 42, 66) + txt(5.4 + i * PT, 74, p, 4.5, '#6b7385')).join('')}`; } });
// DIP chip: pins 1..n/2 along the bottom (left→right), n/2+1..n along the top (right→left). Straddles the breadboard channel.
svgPart('cb-dip', { w: 0, h: 0, pins: function () { const n = +(this.getAttribute('n') || 8), half = n / 2, out = [];
    for (let i = 0; i < half; i++) out.push({ name: String(i + 1), x: 4.8 + i * PT, y: 28.8 });
    for (let i = 0; i < half; i++) out.push({ name: String(n - i), x: 4.8 + i * PT, y: 0 });
    return out; }, props: ['n', 'label'],
  draw: () => '' });
customElements.get('cb-dip').prototype.render = function () {
  const n = +(this.getAttribute('n') || 8), half = n / 2, w = half * PT;
  this.innerHTML = `<svg width="${w}" height="28.8" viewBox="0 0 ${w} 28.8" style="overflow:visible">
    ${Array.from({ length: half }, (_, i) => `<rect x="${3.4 + i * PT}" y="22" width="2.8" height="6.8" fill="#c9ccd2"/><rect x="${3.4 + i * PT}" y="0" width="2.8" height="6.8" fill="#c9ccd2"/>`).join('')}
    <rect x="0" y="5" width="${w}" height="18.8" rx="1.6" fill="#1c1d21"/><path d="M0 11 a3.4 3.4 0 0 1 0 6.8" fill="#3a3c42"/><circle cx="5" cy="19" r="1.2" fill="#3a3c42"/>
    ${txt(w / 2 + 2, 16.5, this.getAttribute('label') || '', 6, '#d9dce2')}</svg>`;
};
// DC motor
svgPart('cb-motor', { w: 60, h: 56, pins: [{ name: '1', x: 22, y: 56 }, { name: '2', x: 38, y: 56 }], props: ['rpm'],
  draw: el => { const rpm = +(el.getAttribute('rpm') || 0), spin = Math.abs(rpm) > 1 ? `<animateTransform attributeName="transform" type="rotate" from="0 30 22" to="${rpm > 0 ? 360 : -360} 30 22" dur="${Math.max(0.08, 600 / Math.abs(rpm))}s" repeatCount="indefinite"/>` : '';
    return `${leg(22, 40, 56)}${leg(38, 40, 56)}<rect x="8" y="6" width="44" height="34" rx="6" fill="#c9ccd2" stroke="#8a8f99"/><rect x="8" y="30" width="44" height="10" fill="#e7b416"/>
    <g>${spin}<circle cx="30" cy="22" r="10" fill="#fff" stroke="#8a8f99"/><rect x="29" y="12" width="2" height="20" fill="#dc2626"/></g>${txt(30, 38, 'DC', 6, '#5a4a06')}`; } });
// Bench power supply
svgPart('cb-psu', { w: 120, h: 86, pins: [{ name: '+', x: 84, y: 86 }, { name: '-', x: 104, y: 86 }], props: ['volts', 'amps', 'cc'],
  draw: el => `<rect x="0" y="0" width="120" height="78" rx="8" fill="#e8e4d8" stroke="#b9b3a3"/><rect x="8" y="10" width="68" height="26" rx="3" fill="#121a14"/>
    ${txt(72, 29, (+(el.getAttribute('volts') || 0)).toFixed(2) + ' V', 13, '#4ade80', 'end', 700)}<rect x="8" y="40" width="68" height="18" rx="3" fill="#121a14"/>${txt(72, 53, (+(el.getAttribute('amps') || 0)).toFixed(3) + ' A', 10, '#facc15', 'end')}
    ${el.getAttribute('cc') === '1' ? txt(14, 70, 'CC', 8, '#dc2626', 'start') : txt(14, 70, 'CV', 8, '#15803d', 'start')}<circle cx="94" cy="26" r="11" fill="#2b2f36"/><rect x="93" y="15" width="2" height="9" fill="#fff"/>
    <circle cx="84" cy="66" r="6" fill="#dc2626"/><circle cx="104" cy="66" r="6" fill="#1f2937"/>${leg(84, 72, 86)}${leg(104, 72, 86)}` });
// L298N motor driver module
svgPart('cb-l298n', { w: 120, h: 110, pins: [['OUT1', 4, 30], ['OUT2', 4, 60], ['12V', 30, 110], ['GND', 45, 110], ['5V', 60, 110], ['ENA', 80, 110], ['IN1', 92, 110], ['IN2', 104, 110]].map(([name, x, y]) => ({ name, x, y })),
  draw: () => `<rect x="4" y="0" width="112" height="104" rx="4" fill="#b91c1c"/><rect x="40" y="6" width="44" height="40" rx="2" fill="#111"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${42 + i * 6}" y="2" width="3" height="10" fill="#9aa0a8"/>`).join('')}
    ${txt(62, 32, 'L298N', 8)}<rect x="0" y="22" width="14" height="46" rx="2" fill="#2563eb"/>${txt(30, 96, '12V GND 5V', 6, '#fff', 'middle')}${txt(92, 96, 'ENA IN1 IN2', 6, '#fff')}
    ${[30, 45, 60, 80, 92, 104].map(x => `<rect x="${x - 3}" y="98" width="6" height="8" fill="#1d4ed8"/>`).join('')}` });
// Generic dual-row development boards (Pico, NodeMCU, Blue Pill)
const BOARD_LOOK = { leonardo: { color: '#0e7490', label: 'Arduino Leonardo', chip: 'ATmega32U4', rowGap: 8, usb: 'top' }, promini: { color: '#0e6ba8', label: 'Pro Mini 5V', chip: '328P', rowGap: 6, usb: 'none' }, esp32c3: { color: '#1b1c20', label: 'ESP32-C3 Super Mini', chip: 'C3', rowGap: 6, usb: 'top' }, esp32s3: { color: '#1b1c20', label: 'ESP32-S3 DevKitC', chip: 'ESP32-S3', rowGap: 9, usb: 'bottom' }, picow: { color: '#1d8a3e', label: 'Raspberry Pi Pico W', chip: 'RP2040', rowGap: 7, usb: 'top' }, pico: { color: '#1d8a3e', label: 'Raspberry Pi Pico', chip: 'RP2040', rowGap: 7, usb: 'top' }, esp8266: { color: '#1b1c20', label: 'NodeMCU ESP8266', chip: 'ESP-12E', rowGap: 9, usb: 'bottom' }, bluepill: { color: '#1e40af', label: 'STM32 Blue Pill', chip: 'STM32F103', rowGap: 6, usb: 'top' } };
for (const [kind, look] of Object.entries(BOARD_LOOK)) {
  const L = BOARD_PINS[kind].left, Rt = BOARD_PINS[kind].right, rows = Math.max(L.length, Rt.length), W = (look.rowGap + 1) * PT + 40, H = rows * PT + 44;
  const pins = [...L.map((name, i) => ({ name, x: 20, y: 26 + i * PT })), ...Rt.map((name, i) => ({ name, x: 20 + look.rowGap * PT, y: 26 + i * PT }))];
  svgPart('cb-' + kind, { w: W, h: H, pins, props: ['led'],
    draw: el => `<rect x="${12}" y="0" width="${look.rowGap * PT + 16}" height="${H}" rx="4" fill="${look.color}"/>
      <rect x="${20 + look.rowGap * PT / 2 - 12}" y="${look.usb === 'top' ? -6 : H - 10}" width="24" height="16" rx="2" fill="#c9ccd2"/>
      <rect x="${20 + look.rowGap * PT / 2 - 18}" y="${H / 2 - 22}" width="36" height="36" rx="2" fill="#16171a"/>${txt(20 + look.rowGap * PT / 2, H / 2 - 2, look.chip, 5.5)}
      ${txt(20 + look.rowGap * PT / 2, H - 16, look.label, 5.5, '#e5e7eb')}
      <rect x="${20 + look.rowGap * PT / 2 - 3}" y="${H / 2 + 20}" width="6" height="4" rx="1" fill="${el.getAttribute('led') === '1' ? '#4ade80' : '#14532d'}" ${el.getAttribute('led') === '1' ? 'style="filter:drop-shadow(0 0 3px #4ade80)"' : ''}/>
      ${pins.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.6" fill="#d4a843"/><circle cx="${p.x}" cy="${p.y}" r="1.1" fill="#3a2a06"/>`).join('')}
      ${L.map((n, i) => txt(26, 28 + i * PT, n, 4.2, '#fff', 'start', 600)).join('')}${Rt.map((n, i) => txt(14 + look.rowGap * PT, 28 + i * PT, n, 4.2, '#fff', 'end', 600)).join('')}` });
}

// Oscilloscope: 2 channels, 10 × 8 grid. el.view = { ch1: [[t, v]], ch2: [[t, v]], tdiv, vdiv, now, meas }
customElements.define('cb-scope', class extends HTMLElement {
  connectedCallback() { this.render(); }
  set view(v) { this._v = v; this.render(); }
  get pinInfo() { return [{ name: 'CH1', x: 60, y: 208 }, { name: 'CH2', x: 120, y: 208 }, { name: 'GND', x: 200, y: 208 }]; }
  render() {
    const v = this._v || { ch1: [], ch2: [], tdiv: 0.1, vdiv: 1, now: 0, meas: {} }, X0 = 14, Y0 = 14, W = 220, H = 160;
    const span = v.tdiv * 10, t0 = v.now - span;
    const path = (pts, col) => { if (!pts?.length) return '';
      const d = pts.filter(([t]) => t >= t0 - v.tdiv).map(([t, y], i) => `${i ? 'L' : 'M'}${(X0 + (t - t0) / span * W).toFixed(1)},${(Y0 + H / 2 - y / v.vdiv * (H / 8)).toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>`; };
    const grid = Array.from({ length: 11 }, (_, i) => `<line x1="${X0 + i * W / 10}" y1="${Y0}" x2="${X0 + i * W / 10}" y2="${Y0 + H}" stroke="#1f3a2c" stroke-width="${i === 5 ? 1 : .6}"/>`).join('')
      + Array.from({ length: 9 }, (_, i) => `<line x1="${X0}" y1="${Y0 + i * H / 8}" x2="${X0 + W}" y2="${Y0 + i * H / 8}" stroke="#1f3a2c" stroke-width="${i === 4 ? 1 : .6}"/>`).join('');
    const m = v.meas || {}, f = x => x === undefined ? '—' : x;
    this.innerHTML = `<svg width="300" height="214" viewBox="0 0 300 214">
      <rect x="0" y="0" width="300" height="200" rx="10" fill="#d9d4c7" stroke="#a8a091"/><rect x="${X0 - 4}" y="${Y0 - 4}" width="${W + 8}" height="${H + 8}" rx="4" fill="#07130d"/>${grid}
      <clipPath id="scr"><rect x="${X0}" y="${Y0}" width="${W}" height="${H}"/></clipPath><g clip-path="url(#scr)">${path(v.ch1, '#facc15')}${path(v.ch2, '#38bdf8')}</g>
      <g font-family="ui-monospace,monospace" font-size="8.5" fill="#1c2230"><text x="242" y="24">CH1</text><text x="242" y="34" fill="#a16207">${f(m.ch1)}</text>
      <text x="242" y="54">CH2</text><text x="242" y="64" fill="#0369a1">${f(m.ch2)}</text><text x="242" y="90">${v.vdiv} V/div</text><text x="242" y="102">${v.tdiv >= 1 ? v.tdiv + ' s' : v.tdiv * 1000 + ' ms'}/div</text>
      <text x="242" y="128">${f(m.f1)}</text><text x="242" y="140">${f(m.d1)}</text></g>
      <circle cx="60" cy="196" r="6" fill="#facc15" stroke="#7c5e10"/><circle cx="120" cy="196" r="6" fill="#38bdf8" stroke="#0c4a6e"/><circle cx="200" cy="196" r="6" fill="#1f2937"/>
      <g font-family="Arial" font-size="7" font-weight="700" fill="#3b3a36"><text x="72" y="199">CH1</text><text x="132" y="199">CH2</text><text x="212" y="199">GND</text></g>
      <line x1="60" y1="202" x2="60" y2="208" stroke="#7c5e10" stroke-width="2"/><line x1="120" y1="202" x2="120" y2="208" stroke="#0c4a6e" stroke-width="2"/><line x1="200" y1="202" x2="200" y2="208" stroke="#111" stroke-width="2"/></svg>`;
  }
});


// Generic sensor / breakout module: coloured PCB with a header row along the bottom
svgPart('cb-module', { w: 0, h: 0, props: ['label', 'pins', 'color'],
  pins: function () { const n = (this.getAttribute('pins') || 'VCC,GND,OUT').split(','); const w = Math.max(60, n.length * 9.6 + 20); return n.map((name, i) => ({ name, x: (w - (n.length - 1) * 9.6) / 2 + i * 9.6, y: 58 })); }, draw: () => '' });
customElements.get('cb-module').prototype.render = function () {
  const n = (this.getAttribute('pins') || 'VCC,GND,OUT').split(','), w = Math.max(60, n.length * 9.6 + 20), c = this.getAttribute('color') || '#1e40af', x0 = (w - (n.length - 1) * 9.6) / 2;
  this.innerHTML = `<svg width="${w}" height="58" viewBox="0 0 ${w} 58" style="overflow:visible"><rect x="0" y="0" width="${w}" height="44" rx="4" fill="${c}"/><circle cx="7" cy="7" r="3" fill="#f4f2ec"/><circle cx="${w - 7}" cy="7" r="3" fill="#f4f2ec"/>
    <rect x="${w / 2 - 12}" y="6" width="24" height="14" rx="2" fill="#16171a"/>${txt(w / 2, 31, this.getAttribute('label') || '', 6.4, '#fff')}
    ${n.map((p, i) => `<rect x="${x0 + i * 9.6 - 3}" y="40" width="6" height="8" fill="#16171a"/>${leg(x0 + i * 9.6, 46, 58)}${txt(x0 + i * 9.6, 38.5, p, 3.6, '#e5e7eb', 'middle', 600)}`).join('')}</svg>`;
};
svgPart('cb-reed', { w: 48, h: 14, pins: [{ name: '1', x: 0, y: 7 }, { name: '2', x: 48, y: 7 }], draw: () => `<line x1="0" y1="7" x2="48" y2="7" stroke="#a9adb5" stroke-width="1.4"/><rect x="10" y="2.5" width="28" height="9" rx="4.5" fill="#d9f2ff" stroke="#9cc7de" opacity=".9"/><line x1="12" y1="7" x2="25" y2="6" stroke="#8a6d1d" stroke-width="1.2"/><line x1="23" y1="8" x2="36" y2="7" stroke="#8a6d1d" stroke-width="1.2"/>` });
// zener: diode graphic with a bent band
const _d = customElements.get('cb-diode').prototype.render;
customElements.get('cb-diode').prototype.render = function () { _d.call(this); if (this.getAttribute('kind') === 'zener') this.querySelector('svg').insertAdjacentHTML('beforeend', `<rect x="10" y="2" width="18.4" height="8" rx="2" fill="#c2410c"/><rect x="24" y="2" width="2.6" height="8" fill="#111"/>`); };

// Real-world tools
const TOOL_ART = {
  lighter: el => { const m = el.getAttribute('mode') || 'off';
    return `<rect x="14" y="26" width="22" height="44" rx="5" fill="#dc2626"/><rect x="14" y="26" width="22" height="9" rx="2" fill="#b91c1c"/><rect x="15" y="14" width="20" height="13" rx="2" fill="#c9ccd2"/><circle cx="29" cy="20" r="4" fill="#8a8f99"/>
      ${m === 'lit' ? '<path d="M25 13 C17 2 26 -6 25 -14 C33 -6 35 4 25 13 Z" fill="#f59e0b"><animate attributeName="d" dur="0.25s" repeatCount="indefinite" values="M25 13 C17 2 26 -6 25 -14 C33 -6 35 4 25 13 Z;M25 13 C18 3 24 -5 27 -13 C32 -5 34 5 25 13 Z;M25 13 C17 2 26 -6 25 -14 C33 -6 35 4 25 13 Z"/></path><path d="M25 12 C21 5 25 0 25 -5 C29 1 29 7 25 12 Z" fill="#fde68a"/>' : ''}
      ${m === 'gas' ? '<g fill="#a5b4fc" opacity=".6"><circle cx="22" cy="6" r="3"><animate attributeName="cy" from="10" to="-12" dur="1s" repeatCount="indefinite"/></circle><circle cx="29" cy="2" r="2.4"><animate attributeName="cy" from="10" to="-14" dur="1.3s" repeatCount="indefinite"/></circle></g>' : ''}`; },
  fan: el => `<rect x="21" y="44" width="8" height="22" fill="#9aa0a8"/><rect x="10" y="64" width="30" height="6" rx="2" fill="#6b7280"/><circle cx="25" cy="26" r="22" fill="#e0f2fe" stroke="#64748b" stroke-width="2"/>
    <g>${el.getAttribute('on') === '1' ? '<animateTransform attributeName="transform" type="rotate" from="0 25 26" to="360 25 26" dur="0.4s" repeatCount="indefinite"/>' : ''}${[0, 120, 240].map(a => `<ellipse cx="25" cy="14" rx="6" ry="11" fill="#38bdf8" transform="rotate(${a} 25 26)"/>`).join('')}<circle cx="25" cy="26" r="4" fill="#334155"/></g>`,
  gascan: el => `<rect x="12" y="20" width="26" height="50" rx="6" fill="#ea580c"/><rect x="18" y="10" width="14" height="11" rx="2" fill="#9aa0a8"/><rect x="30" y="6" width="10" height="5" fill="#6b7280"/>${txt(25, 50, 'LPG', 8, '#fff')}
    ${el.getAttribute('on') === '1' ? '<g fill="#c7d2fe" opacity=".7"><circle cx="46" cy="8" r="4"><animate attributeName="cx" from="42" to="70" dur="0.8s" repeatCount="indefinite"/></circle><circle cx="50" cy="4" r="3"><animate attributeName="cx" from="42" to="66" dur="1.1s" repeatCount="indefinite"/></circle></g>' : ''}`,
  incense: el => `<rect x="10" y="62" width="30" height="8" rx="3" fill="#78350f"/><line x1="25" y1="62" x2="25" y2="20" stroke="#92400e" stroke-width="2.4"/><circle cx="25" cy="20" r="2" fill="${el.getAttribute('on') === '1' ? '#f97316' : '#57534e'}"/>
    ${el.getAttribute('on') === '1' ? '<path d="M25 18 C20 10 30 4 24 -6 C20 -12 28 -18 25 -24" fill="none" stroke="#9ca3af" stroke-width="2" opacity=".7"><animate attributeName="opacity" values=".8;.3;.8" dur="2s" repeatCount="indefinite"/></path>' : ''}`,
  torch: el => `${el.getAttribute('on') === '1' ? '<path d="M38 12 L90 -8 L90 52 L38 32 Z" fill="#fde68a" opacity=".55"/>' : ''}<rect x="4" y="14" width="30" height="16" rx="4" fill="#1f2937"/><rect x="32" y="10" width="8" height="24" rx="2" fill="#9ca3af"/><rect x="14" y="18" width="6" height="8" rx="1" fill="#ef4444"/>`,
  hand: () => `<path d="M14 70 L14 36 C14 30 22 30 22 36 L22 12 C22 6 30 6 30 12 L30 32 L30 8 C30 2 38 2 38 8 L38 34 L38 14 C38 8 46 8 46 14 L46 48 C46 62 38 70 28 70 Z" fill="#f2c094" stroke="#c48a5a" stroke-width="1.6"/><path d="M14 46 C8 40 2 44 6 50 L14 60" fill="#f2c094" stroke="#c48a5a" stroke-width="1.6"/>`,
  ice: () => `<rect x="8" y="22" width="36" height="36" rx="7" fill="#bae6fd" stroke="#7dd3fc" stroke-width="2" opacity=".9"/><path d="M14 30 L24 26" stroke="#fff" stroke-width="3" stroke-linecap="round"/>${txt(26, 48, '0 °C', 7, '#0369a1')}`,
  water: () => `<path d="M10 16 L42 16 L38 70 L14 70 Z" fill="#e0f2fe" stroke="#94a3b8" stroke-width="1.6"/><path d="M12.5 34 L39.5 34 L38 70 L14 70 Z" fill="#38bdf8" opacity=".8"/><circle cx="26" cy="6" r="3" fill="#38bdf8"/>`,
  speaker: el => `<rect x="6" y="14" width="34" height="52" rx="5" fill="#1f2937"/><circle cx="23" cy="48" r="11" fill="#374151" stroke="#111"/><circle cx="23" cy="48" r="4" fill="#6b7280"/><circle cx="23" cy="26" r="5" fill="#374151"/>
    ${el.getAttribute('on') === '1' ? '<g fill="none" stroke="#f59e0b" stroke-width="2.4"><path d="M44 36 q8 12 0 24"><animate attributeName="opacity" values="1;.2;1" dur=".6s" repeatCount="indefinite"/></path><path d="M50 30 q13 18 0 36"><animate attributeName="opacity" values=".2;1;.2" dur=".6s" repeatCount="indefinite"/></path></g>' : ''}`,
  magnet: () => `<path d="M8 10 L8 44 A18 18 0 0 0 44 44 L44 10 L32 10 L32 44 A6 6 0 0 1 20 44 L20 10 Z" fill="#dc2626"/><rect x="8" y="10" width="12" height="12" fill="#e5e7eb"/><rect x="32" y="10" width="12" height="12" fill="#e5e7eb"/>${txt(14, 34, 'N', 8, '#fff')}${txt(38, 34, 'S', 8, '#fff')}`,
  rfidcard: () => `<rect x="2" y="16" width="56" height="36" rx="5" fill="#f8fafc" stroke="#94a3b8"/><rect x="8" y="24" width="12" height="9" rx="2" fill="#d4a843"/><path d="M34 26 q6 8 0 16 M40 22 q10 12 0 24" fill="none" stroke="#64748b" stroke-width="1.6"/>${txt(30, 49, 'RFID', 6, '#334155')}`,
};
svgPart('cb-tool', { w: 60, h: 74, pins: [], props: ['kind', 'on', 'mode'],
  draw: el => `<g>${(TOOL_ART[el.getAttribute('kind')] || (() => ''))(el)}</g>` });
