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
svgPart('cb-to92', { w: 26, h: 40, pins: [{ name: 'C', x: 3.4, y: 40 }, { name: 'B', x: 13, y: 40 }, { name: 'E', x: 22.6, y: 40 }], props: ['label'],
  draw: el => `${leg(3.4, 20, 40)}${leg(13, 20, 40)}${leg(22.6, 20, 40)}<path d="M1 21 V8 a12 8 0 0 1 24 0 V21 Z" fill="#26282c"/>${txt(13, 15, el.getAttribute('label') || 'BC547', 5.2)}
    ${txt(3.4, 48, 'C', 5, '#6b7385')}${txt(13, 48, 'B', 5, '#6b7385')}${txt(22.6, 48, 'E', 5, '#6b7385')}` });
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
const BOARD_LOOK = { pico: { color: '#1d8a3e', label: 'Raspberry Pi Pico', chip: 'RP2040', rowGap: 7, usb: 'top' }, esp8266: { color: '#1b1c20', label: 'NodeMCU ESP8266', chip: 'ESP-12E', rowGap: 9, usb: 'bottom' }, bluepill: { color: '#1e40af', label: 'STM32 Blue Pill', chip: 'STM32F103', rowGap: 6, usb: 'top' } };
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
