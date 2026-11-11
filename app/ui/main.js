import { simulate, fmt, PIN_LIST, isMcu } from '../engine/circuit.js';
import { BOARDS } from '../engine/boards.js';
import { createRunner } from '../engine/arduino.js';
import { CATALOG, BY_TYPE, PROJECTS } from './catalog.js';
import { INFO } from './info.js';

const $ = id => document.getElementById(id);
let Z = 1.25;
const S = { parts: [], wires: [], selected: null, pending: null, io: { pins: {} }, sim: null, runner: null, nextId: 1 };
const els = new Map(); // part id -> {host, el}

// ---------------- palette ----------------
(function buildPalette() {
  let html = '', group = '';
  for (const c of CATALOG) {
    if (c.group !== group) { group = c.group; html += `<h5>${group}</h5>`; }
    html += `<button class="pal" data-type="${c.type}" data-q="${(c.name + ' ' + c.desc + ' ' + c.group).toLowerCase()}" title="${c.desc}"><span class="th"><${c.tag} ${attrs(c)}></${c.tag}></span><span>${c.name}<small>${c.desc.split('·')[0]}</small></span></button>`;
  }
  $('palette').innerHTML = `<input id="palSearch" class="pal-search" placeholder="Search ${CATALOG.length} parts…">` + html;
  $('palSearch').oninput = e => { const q = e.target.value.toLowerCase().trim();
    for (const b of document.querySelectorAll('.pal')) b.hidden = q && !b.dataset.q.includes(q);
    for (const h of document.querySelectorAll('.palette h5')) { let n = h.nextElementSibling, any = false; while (n && n.tagName !== 'H5') { if (n.classList.contains('pal') && !n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; } };
  $('palette').onclick = e => { const b = e.target.closest('.pal'); if (b) { const sc = $('scroll');
    const n = S.parts.length; addPart(b.dataset.type, sc.scrollLeft + 60 + (n % 4) * 190, sc.scrollTop + 70 + (Math.floor(n / 4) % 3) * 230, null, true); } };
  $('projects').innerHTML += Object.entries(PROJECTS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
})();

// ---------------- parts ----------------
function attrs(c) { return Object.entries(c.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' '); }
function addPart(type, x, y, props, select) {
  const c = BY_TYPE[type]; const id = type + (S.nextId++);
  const p = { id, type, x: Math.round(x), y: Math.round(y), props: structuredClone(props || c.props) };
  S.parts.push(p); mountPart(p); if (select) selectThing({ part: id }); changed(); return p;
}
function mountPart(p) {
  const c = BY_TYPE[p.type], host = document.createElement('div');
  host.className = 'part'; host.dataset.id = p.id; host.style.left = p.x + 'px'; host.style.top = p.y + 'px';
  host.innerHTML = `<span class="tag">${c.name}${p.type === 'resistor' ? ' ' + fmt(p.props.ohms, 'Ω').replace('.00', '') : ''}</span><${c.tag} ${attrs(c)}></${c.tag}>`;
  $('parts').appendChild(host);
  const el = host.lastElementChild; els.set(p.id, { host, el });
  applyProps(p);
  // interactive parts
  if (p.type === 'pushbutton') {
    el.addEventListener('button-press', () => { p.props.pressed = true; changed(); });
    el.addEventListener('button-release', () => { p.props.pressed = false; changed(); });
  }
  if (p.type === 'switch') el.addEventListener('input', () => { p.props.on = !!el.value; changed(); });
  if (p.type === 'pot' || p.type === 'slidepot') el.addEventListener('input', () => { p.props.pos = (el.value - (el.min ?? 0)) / ((el.max ?? 100) - (el.min ?? 0)) * 100; changed(); refreshProps(); });
  if (p.type === 'keypad') {
    el.addEventListener('button-press', e => { const d = e.detail || {}; p.props.key = { row: (d.row ?? 0) + 1, col: (d.column ?? 0) + 1, label: d.key }; changed(); });
    el.addEventListener('button-release', () => { p.props.key = null; changed(); });
  }
  host.addEventListener('dblclick', () => showInfo(p.type));
  host.addEventListener('pointerdown', e => {
    const interactive = ['pushbutton', 'switch', 'pot', 'slidepot', 'keypad', 'joystick'].includes(p.type) && !e.target.classList.contains('tag');
    selectThing({ part: p.id });
    if (!interactive) startDrag(e, p);
  });
}
function applyProps(p) {
  const { el, host } = els.get(p.id);
  if (p.type === 'resistor') { el.value = String(p.props.ohms); host.querySelector('.tag').textContent = 'Resistor ' + fmt(p.props.ohms, 'Ω').replace('.00', ''); }
  if (p.type === 'led') el.color = p.props.color;
  if (p.type === 'switch') el.value = p.props.on ? 1 : 0;
  if (p.type === 'pot' || p.type === 'slidepot') el.value = (el.min ?? 0) + (p.props.pos / 100) * ((el.max ?? 100) - (el.min ?? 0));
  if (p.type === 'meter') el.mode = p.props.mode;
  if (p.type === 'battery') { el.volts = p.props.volts; el.render?.(); }
  if (p.type === 'psu') el.setAttribute('volts', p.props.volts);
  if (p.type === 'seg7') el.common = p.props.common;
  if (p.type === 'diode') el.setAttribute('kind', p.props.kind);
  if (p.type === 'capacitor') el.setAttribute('label', ({ 1e-9: '102', 1e-8: '103', 1e-7: '104', 1e-6: '105' })[p.props.farads] || '104');
  if (p.type === 'ecap') el.setAttribute('label', fmt(p.props.farads, 'F').replace(/\.00 /, '').replace(' ', '').replace('F', ''));
  if (p.type === 'joystick') { el.xValue = (p.props.x || 0) / 100; el.yValue = (p.props.y || 0) / 100; el.pressed = !!p.props.pressed; }
  if (p.type === 'pir') el.motion = !!p.props.motion;
  if (p.type === 'dipswitch') el.values = p.props.bits;
  if (isMcu(p.type)) el.ledPower = true;
  host.classList.toggle('burnt', !!p.props.burnt);
  el.style.transform = p.rot ? `rotate(${p.rot}deg)` : '';
}
const INSERTABLE = ['resistor', 'led', 'pushbutton', 'pot', 'buzzer', 'switch', 'capacitor', 'ecap', 'diode', 'npn', 'pnp', 'nmos', 'reg7805', 'lm358', 'ne555', 'hc00', 'hc08', 'hc32', 'hc86', 'hc04', 'rgb'];
function placeHost(p) { const h = els.get(p.id).host; h.style.left = p.x + 'px'; h.style.top = p.y + 'px'; }
const kids = bbId => S.parts.filter(q => S.wires.some(w => w.hidden && w.from.startsWith(q.id + ':') && w.to.startsWith(bbId + ':')));
function tryInsert(p) {
  S.wires = S.wires.filter(w => !(w.hidden && w.from.startsWith(p.id + ':')));
  if (!INSERTABLE.includes(p.type)) return false;
  const pins = (PIN_LIST[p.type] || []).map(n => [n, pinPos(p.id + ':' + n)]).filter(x => x[1]);
  let best = null;
  for (const bb of S.parts.filter(q => q.type === 'breadboard')) {
    const holes = els.get(bb.id).el.pinInfo, o = pinPos(bb.id + ':' + holes[0].name); if (!o) continue;
    const ox = o[0] - holes[0].x, oy = o[1] - holes[0].y;
    for (const [, [x, y]] of pins) for (const h of holes) { const dx = ox + h.x - x, dy = oy + h.y - y, d = Math.hypot(dx, dy);
      if (d < 6.5 && (!best || d < best.d)) best = { d, dx, dy, bb, ox, oy, holes }; }
  }
  if (!best) return false;
  p.x += best.dx; p.y += best.dy; placeHost(p);
  for (const n of PIN_LIST[p.type]) { const xy = pinPos(p.id + ':' + n); if (!xy) continue;
    const h = best.holes.find(h => Math.hypot(best.ox + h.x - xy[0], best.oy + h.y - xy[1]) < 4.5);
    if (h) S.wires.push({ from: p.id + ':' + n, to: best.bb.id + ':' + h.name, hidden: true }); }
  return true;
}
function startDrag(e, p) {
  const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y; let moved = false;
  const riders = p.type === 'breadboard' ? kids(p.id).map(q => [q, q.x, q.y]) : [];
  const mv = ev => { const dx = (ev.clientX - sx) / Z, dy = (ev.clientY - sy) / Z; if (!moved && Math.hypot(dx, dy) < 3) return; moved = true;
    p.x = Math.max(0, ox + dx); p.y = Math.max(30, oy + dy); placeHost(p);
    for (const [q, qx, qy] of riders) { q.x = qx + (p.x - ox); q.y = qy + (p.y - oy); placeHost(q); }
    drawWires(); drawPins(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    if (!moved) return;
    if (!tryInsert(p)) { const g = 4.8, nx = Math.round(p.x / g) * g, ny = Math.round(p.y / g) * g;
      for (const [q] of riders) { q.x += nx - p.x; q.y += ny - p.y; placeHost(q); }
      p.x = nx; p.y = ny; placeHost(p); }
    changed(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function rotatePart(p) {
  p.rot = ((p.rot || 0) + 90) % 360; applyProps(p);
  requestAnimationFrame(() => { if (S.wires.some(w => w.hidden && w.from.startsWith(p.id + ':'))) tryInsert(p); changed(); });
}
function removePart(id) {
  S.parts = S.parts.filter(p => p.id !== id); S.wires = S.wires.filter(w => !w.from.startsWith(id + ':') && !w.to.startsWith(id + ':'));
  els.get(id)?.host.remove(); els.delete(id); selectThing(null); changed();
}

// ---------------- geometry ----------------
function pinPos(key) {
  const [id, pin] = key.split(/:(.+)/); const r = els.get(id); if (!r) return null;
  const info = (r.el.pinInfo || []).find(q => q.name === pin); if (!info) return null;
  const w = $('world').getBoundingClientRect(), b = r.el.getBoundingClientRect();
  const rot = (S.parts.find(q => q.id === id)?.rot || 0), W0 = r.el.offsetWidth, H0 = r.el.offsetHeight;
  const sc = W0 ? (rot % 180 ? b.height : b.width) / Z / W0 : 1;
  if (!rot || !W0) return [(b.left - w.left) / Z + info.x * sc, (b.top - w.top) / Z + info.y * sc];
  const cx = ((b.left + b.right) / 2 - w.left) / Z, cy = ((b.top + b.bottom) / 2 - w.top) / Z, a = rot * Math.PI / 180;
  const lx = (info.x - W0 / 2) * sc, ly = (info.y - H0 / 2) * sc;
  return [cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a)];
}
const isGnd = k => /:(GND[.\d]*|AGND|-|COM|VSS|COM\.\d)$/.test(k), isPwr = k => /:(5V[.\d]*|3\.3V|3V3[.\d]*|\+|VCC|VIN|VBUS|V\+|12V|VDD)$/.test(k);
const PALETTE = ['#2f5bea', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777'];
const wireColor = (w, i) => isGnd(w.from) || isGnd(w.to) ? '#2b2f36' : isPwr(w.from) || isPwr(w.to) ? '#dc2626' : PALETTE[i % PALETTE.length];
// Neat routing: leave each pin straight out of its part's edge, then use right-angle turns.
function exitDir(key, xy) {
  const [id] = key.split(':'); const p = S.parts.find(q => q.id === id); if (!p || p.type === 'breadboard') return null;
  const r = els.get(id).el.getBoundingClientRect(), w = $('world').getBoundingClientRect();
  const top = (r.top - w.top) / Z, h = r.height / Z, left = (r.left - w.left) / Z, wd = r.width / Z;
  const fy = (xy[1] - top) / h, fx = (xy[0] - left) / wd;
  if (fy > 0.75) return [0, 1]; if (fy < 0.25) return [0, -1]; return fx < 0.5 ? [-1, 0] : [1, 0];
}
function rounded(pts) {
  pts = pts.filter((q, i) => i === 0 || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) > 0.5);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const r = Math.min(6, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
    const ux = Math.sign(x - px), uy = Math.sign(y - py), vx = Math.sign(nx - x), vy = Math.sign(ny - y);
    d += ` L${x - ux * r},${y - uy * r} Q${x},${y} ${x + vx * r},${y + vy * r}`;
  }
  const l = pts.at(-1); return d + ` L${l[0]},${l[1]}`;
}
function wirePath(a, b, lane = 0, ka = '', kb = '') {
  let da = exitDir(ka, a), db = exitDir(kb, b);
  if (!da && db) { [a, b, da, db] = [b, a, db, da]; }
  const L = 14 + lane;
  if (!da) { // hole to hole: one bend
    if (Math.abs(a[0] - b[0]) < 1 || Math.abs(a[1] - b[1]) < 1) return `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
    return rounded([a, [a[0], b[1]], b]); }
  const a1 = [a[0] + da[0] * L, a[1] + da[1] * L];
  const b1 = db ? [b[0] + db[0] * L, b[1] + db[1] * L] : b;
  if (db && da[1] !== 0 && db[1] !== 0) {             // both leave vertically: share one horizontal corridor
    const y = da[1] === db[1] ? (da[1] > 0 ? Math.max(a1[1], b1[1]) : Math.min(a1[1], b1[1])) : (a1[1] + b1[1]) / 2;
    return rounded([a, a1, [a1[0], y], [b1[0], y], b1, b]); }
  const mid = da[1] !== 0 ? [[b1[0], a1[1]]] : [[a1[0], b1[1]]];
  return rounded([a, a1, ...mid, b1, b]);
}
// ---------------- drawing ----------------
let flowOffset = 0;
function drawWires() {
  const svg = $('wires');
  let lane = 0;
  svg.innerHTML = S.wires.map((w, i) => { if (w.hidden) return ''; const a = pinPos(w.from), b = pinPos(w.to); if (!a || !b) return '';
    const d = wirePath(a, b, (lane++ % 5) * 4.8, w.from, w.to), sel = S.selected?.wire === i ? ' sel' : '';
    return `<path class="wire${sel}" data-i="${i}" d="${d}" stroke="${wireColor(w, i)}"/><path class="flow" data-f="${i}" d="${d}"/>`; }).join('')
    + (S.pending?.mouse ? (() => { const a = pinPos(S.pending.from); return a ? `<path class="ghost" d="M${a[0]},${a[1]} L${S.pending.mouse[0]},${S.pending.mouse[1]}"/>` : ''; })() : '');
}
let holesVisible = true;
function drawPins() {
  let h = '';
  for (const p of S.parts) for (const pin of PIN_LIST[p.type] || []) {
    if (isMcu(p.type) && /^(A5\.2|A4\.2|AREF|IOREF|RESET.*|RSV.*|SD\d|CMD|CLK|EN|RST|RUN|3V3_EN|ADC_VREF|VBAT)$/.test(pin)) continue;
    const k = p.id + ':' + pin, xy = pinPos(k); if (!xy) continue;
    const hole = p.type === 'breadboard';
    if (hole && !S.pending && !holesVisible) continue;
    h += `<circle class="pin${hole ? ' hole' : ''}${S.pending?.from === k ? ' armed' : ''}" data-k="${k}" cx="${xy[0]}" cy="${xy[1]}" r="${hole ? 3.6 : 4}"/>`;
  }
  $('pins').innerHTML = h;
}
$('pins').addEventListener('click', e => {
  const k = e.target.dataset?.k; if (!k) return; e.stopPropagation();
  if (!S.pending) { S.pending = { from: k }; drawPins(); return; }
  if (S.pending.from !== k && !S.wires.some(w => (w.from === k && w.to === S.pending.from) || (w.to === k && w.from === S.pending.from)))
    S.wires.push({ from: S.pending.from, to: k });
  S.pending = null; drawPins(); changed();
});
$('wires').addEventListener('click', e => { const i = e.target.dataset?.i; if (i !== undefined) selectThing({ wire: +i }); });
$('world').addEventListener('pointermove', e => {
  const w = $('world').getBoundingClientRect(), x = (e.clientX - w.left) / Z, y = (e.clientY - w.top) / Z;
  if (S.pending) { S.pending.mouse = [x, y]; drawWires(); }
  const k = e.target.dataset?.k, wi = e.target.dataset?.i, tip = $('tip');
  if (S.sim && (k || wi !== undefined)) {
    const key = k || S.wires[wi].from, v = S.sim.nodeVoltage(key), I = S.sim.pinCurrent[key] || 0;
    const b = $('board').getBoundingClientRect();
    tip.textContent = (k ? k.split(':')[1] + ' · ' : 'wire · ') + v.toFixed(2) + ' V' + (I > 1e-5 ? ' · ' + fmt(I, 'A') : '');
    tip.style.display = 'block'; tip.style.left = e.clientX - b.left + 14 + 'px'; tip.style.top = e.clientY - b.top + 14 + 'px';
  } else tip.style.display = 'none';
});
$('scroll').addEventListener('click', e => { if (e.target.id === 'scroll' || e.target.id === 'world' || e.target.id === 'wires') { if (!e.target.dataset?.i) selectThing(null); } });
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') { S.pending = null; drawWires(); drawPins(); closeModal(); }
  if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && S.selected?.part) rotatePart(S.parts.find(q => q.id === S.selected.part));
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (S.selected?.part) removePart(S.selected.part);
    else if (S.selected?.wire !== undefined) { S.wires.splice(S.selected.wire, 1); selectThing(null); changed(); }
  }
});

// ---------------- selection + properties ----------------
function selectThing(t) { S.selected = t; for (const [id, r] of els) r.host.classList.toggle('sel', t?.part === id); drawWires(); refreshProps(); }
function refreshProps() {
  const box = $('props'), t = S.selected;
  if (!t) { box.hidden = true; return; }
  box.hidden = false;
  if (t.wire !== undefined) { const w = S.wires[t.wire]; box.innerHTML = `<h4>Wire</h4><div class="mut">${w.from} → ${w.to}</div>
    <div class="kv"><span>Voltage</span><b>${S.sim ? S.sim.nodeVoltage(w.from).toFixed(2) + ' V' : '–'}</b></div><p><button class="btn" id="pDel">Delete wire</button></p>`;
    $('pDel').onclick = () => { S.wires.splice(t.wire, 1); selectThing(null); changed(); }; return; }
  const p = S.parts.find(q => q.id === t.part); if (!p) { box.hidden = true; return; }
  const c = BY_TYPE[p.type], r = S.sim?.parts[p.id] || {};
  let f = '';
  for (const k of c.controls || []) {
    const v = p.props[k.key];
    if (k.kind === 'range') f += `<label>${k.label} <span class="ctl"><input data-k="${k.key}" type="range" min="${k.min}" max="${k.max}" step="${k.step}" value="${v}"><b>${v}${k.unit ? ' ' + k.unit : ''}</b></span></label>`;
    if (k.kind === 'select') f += `<label>${k.label} <select data-k="${k.key}">${k.options.map(o => `<option value="${o}" ${o == v ? 'selected' : ''}>${typeof o === 'number' && k.key === 'ohms' ? fmt(o, 'Ω').replace('.00', '') : typeof o === 'number' && k.key === 'farads' ? fmt(o, 'F').replace('.00', '') : o}${k.key === 'volts' ? ' V' : ''}</option>`).join('')}</select></label>`;
    if (k.kind === 'toggle') f += `<label>${k.label} <button class="btn" data-t="${k.key}">${v ? k.on : k.off}</button></label>`;
  }
  if (p.type === 'led' && p.props.burnt) f += '<button class="btn" id="pFix">Replace burnt LED</button>';
  if (p.type === 'dipswitch') f += `<label>Switches <span>${p.props.bits.map((b, i) => `<button class="btn mini" data-bit="${i}">${i + 1}:${b ? 'ON' : 'off'}</button>`).join('')}</span></label>`;
  if (p.type === 'keypad') f += `<div class="mut">Click keys on the keypad. Pressing a key connects its row pin to its column pin.</div>`;
  if (p.type === 'pushbutton') f += `<div class="mut">Or click and hold the button on the board.</div>`;
  if (isMcu(p.type)) { const B = BOARDS[p.type]; f += `<div class="kv"><span>Logic level</span><b>${B.vcc} V</b><span>ADC</span><b>${B.adcBits}-bit (0–${2 ** B.adcBits - 1})</b><span>Built-in LED</span><b>${B.builtin}</b><span>I2C</span><b>SDA ${B.i2c.SDA} · SCL ${B.i2c.SCL}</b><span>Max per pin</span><b>${fmt(B.maxPin, 'A')}</b></div>`; }
  const LIVE = [['current', 'Current', x => fmt(Math.abs(x), 'A')], ['power', 'Power', x => fmt(x, 'W') + ' / 0.25 W'], ['brightness', 'Brightness', x => Math.round(x * 100) + ' %'], ['reading', 'Reading', x => x],
    ['voltage', 'Voltage', x => x.toFixed(2) + ' V'], ['vbe', 'V(BE)', x => x.toFixed(2) + ' V'], ['vce', 'V(CE)', x => x.toFixed(2) + ' V'], ['vgs', 'V(GS)', x => x.toFixed(2) + ' V'], ['vds', 'V(DS)', x => x.toFixed(2) + ' V'],
    ['rpm', 'Speed', x => x + ' rpm'], ['angle', 'Angle', x => x + '°'], ['output', 'Output', x => x], ['outputs', 'Outputs', x => x], ['mode', 'Mode', x => x], ['supply', 'Supply', x => x.toFixed(2) + ' V'], ['on', 'State', x => x ? 'ON' : 'off'], ['out1', 'OUT1', x => x.toFixed(2) + ' V'], ['out2', 'OUT2', x => x.toFixed(2) + ' V']];
  const live = LIVE.filter(([k]) => r[k] !== undefined && r[k] !== '').map(([k, l, fn]) => [l, fn(r[k])]);
  box.innerHTML = `<h4>${c.name}</h4><div class="mut">${c.desc}${c.price ? ` · ₹${c.price[0]}–${c.price[1]}` : ''}</div>${f}<div class="kv">${live.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><p class="row"><button class="btn" id="pInfo">ℹ Info</button><button class="btn" id="pRot" title="Rotate (R)">⟳ Rotate</button><button class="btn" id="pDel">Delete</button></p>`;
  $('pInfo').onclick = () => showInfo(p.type); $('pRot').onclick = () => rotatePart(p);
  for (const x of box.querySelectorAll('[data-k]')) x.oninput = x.onchange = e => { const k = (c.controls || []).find(q => q.key === x.dataset.k);
    p.props[x.dataset.k] = k.kind === 'select' && typeof k.options[0] !== 'number' ? x.value : +x.value; if (x.nextElementSibling) x.nextElementSibling.textContent = x.value + (k.unit ? ' ' + k.unit : ''); applyProps(p); changed(); };
  for (const x of box.querySelectorAll('[data-t]')) x.onclick = () => { p.props[x.dataset.t] = !p.props[x.dataset.t]; applyProps(p); changed(); refreshProps(); };
  for (const x of box.querySelectorAll('[data-bit]')) x.onclick = () => { p.props.bits[+x.dataset.bit] ^= 1; applyProps(p); changed(); refreshProps(); };
  if ($('pFix')) $('pFix').onclick = () => { p.props.burnt = false; applyProps(p); changed(); refreshProps(); };
  $('pDel').onclick = () => removePart(p.id);
}

// ---------------- simulation ----------------
let queued = false;
function changed() { updateBoardLabel(); save(); setTimeout(pushHistory, 0); if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; runSim(); drawWires(); drawPins(); }); } }
function markSeated() { for (const p of S.parts) els.get(p.id)?.host.classList.toggle('seated', S.wires.some(w => w.hidden && w.from.startsWith(p.id + ':'))); }
const DYN = ['capacitor', 'ecap', 'ne555', 'heartbeat'];
let simT = 0;
const isDynamic = () => S.parts.some(p => DYN.includes(p.type));
function runSim(dt = 0) {
  markSeated();
  if (isDynamic() && dt === 0) dt = 1e-4;           // capacitors always need a (small) time step
  S.sim = simulate(S.parts, S.wires, S.io, { dt, t: simT });
  let reburn = false;
  for (const p of S.parts) { const r = S.sim.parts[p.id] || {}, { el } = els.get(p.id);
    if (p.type === 'led') { if (r.burn && !p.props.burnt) { p.props.burnt = true; reburn = true; applyProps(p); }
      el.value = (r.brightness || 0) > 0.01; el.brightness = Math.min(1, 0.15 + (r.brightness || 0)); }
    if (p.type === 'buzzer') el.hasSignal = !!r.on;
    if (p.type === 'meter') el.reading = r.reading ?? '';
    if (p.type === 'rgb') { const [R, G, B] = r.rgb || [0, 0, 0]; el.ledRed = R; el.ledGreen = G; el.ledBlue = B; }
    if (p.type === 'seg7' || p.type === 'bargraph') el.values = r.values || [];
    if (p.type === 'motor') el.setAttribute('rpm', r.rpm || 0);
    if (p.type === 'servo') el.angle = p.state?.angle ?? 90;
    if (p.type === 'psu') { el.setAttribute('amps', Math.abs(S.sim.parts[p.id] ? (S.sim.pinCurrent[p.id + ':+'] || 0) : 0)); el.setAttribute('cc', p.state?.cc ? 1 : 0); el.setAttribute('volts', S.sim.voltAt(p.id, '+') - S.sim.voltAt(p.id, '-')); }
    if (isMcu(p.type)) { const B = BOARDS[p.type], v = S.io.mcu === p.id ? S.io.pins[B.builtin] : null, lit = !!(v && v.mode === 'OUTPUT' && (B.builtinActiveLow ? v.v < 1 : v.v > B.vcc / 2));
      el.led13 = lit; el.led1 = lit; if (el.tagName.startsWith('CB-')) el.setAttribute('led', lit ? 1 : 0); }
  }
  if (reburn) { const keep = S.sim.warnings; S.sim = simulate(S.parts, S.wires, S.io, { dt, t: simT }); S.sim.warnings = [...keep.filter(w => /burnt out!/.test(w.text)), ...S.sim.warnings.filter(w => !/burnt out\. Real/.test(w.text))]; }
  const w = S.sim.warnings;
  $('warns').innerHTML = `<h4>Circuit check</h4>` + (w.length ? w.map(x => `<div class="warn ${x.level}" data-p="${x.part}">${x.level === 'bad' ? '⛔' : '⚠️'} ${x.text}</div>`).join('') : `<div class="okmsg">✔ No problems found${S.parts.length ? '' : '. Add some parts to begin.'}</div>`);
  if (S.selected) refreshPropsLive();
}
let propsTimer = 0; function refreshPropsLive() { const now = performance.now(); if (now - propsTimer > 150 && !document.activeElement?.closest?.('#props')) { propsTimer = now; refreshProps(); } }
$('warns').addEventListener('click', e => { const p = e.target.closest('.warn')?.dataset.p; if (p) selectThing({ part: p }); });
let lastFrame = performance.now();
(function animate() {
  flowOffset -= 1;
  const now = performance.now(), frame = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (isDynamic() && S.ready) {                     // real-time transient simulation (capacitors, 555, pulse sensor)
    const steps = Math.min(40, Math.max(1, Math.ceil(frame / 0.001))), h = frame / steps;
    for (let i = 0; i < steps; i++) { simT += h; S.sim = simulate(S.parts, S.wires, S.io, { dt: h, t: simT }); sampleScopes(); }
    runSim(1e-6);
  } else if (S.ready) { simT += frame; sampleScopes(); }
  drawScopes();
  if (S.sim) for (const path of document.querySelectorAll('.flow')) {
    const w = S.wires[path.dataset.f]; if (!w) continue;
    const I = Math.max(S.sim.pinCurrent[w.from] || 0, S.sim.pinCurrent[w.to] || 0);
    if (I < 2e-4) { path.style.opacity = 0; continue; }
    path.style.opacity = Math.min(1, 0.35 + I * 40);
    path.style.strokeDashoffset = flowOffset * Math.min(3, 0.4 + Math.log10(I / 2e-4));
  }
  requestAnimationFrame(animate);
})();

// ---------------- oscilloscope ----------------
function sampleScopes() {
  if (!S.sim) return;
  for (const p of S.parts.filter(q => q.type === 'scope')) {
    const g = S.sim.voltAt(p.id, 'GND'), buf = (p.state.buf ??= { ch1: [], ch2: [] }), keep = (p.props.tdiv || 0.2) * 12;
    for (const ch of ['ch1', 'ch2']) { const pin = ch.toUpperCase(); buf[ch].push([simT, (pwmOn(p.id + ':' + pin)?.avg ?? S.sim.voltAt(p.id, pin)) - g]);
      while (buf[ch].length && buf[ch][0][0] < simT - keep) buf[ch].shift(); if (buf[ch].length > 4000) buf[ch].splice(0, buf[ch].length - 4000); }
  }
}
// Is this node driven by a PWM pin? Then the scope can show the real square wave (490 Hz like an Uno).
function pwmOn(key) { const m = S.parts.find(q => isMcu(q.type)); if (!m || S.io.mcu !== m.id) return null;
  for (const [pin, st] of Object.entries(S.io.pins)) if (st.duty > 0 && st.duty < 1 && S.sim.sameNode(key, m.id + ':' + pin)) return { duty: st.duty, vhigh: st.vhigh, avg: st.duty * st.vhigh, f: 490 };
  return null; }
let scopeFrame = 0;
function drawScopes() {
  if (++scopeFrame % 2) return;
  for (const p of S.parts.filter(q => q.type === 'scope')) {
    const buf = p.state.buf || { ch1: [], ch2: [] }, tdiv = p.props.tdiv || 0.2, span = tdiv * 10, meas = {}, view = { tdiv, vdiv: p.props.vdiv || 2, now: simT, meas };
    for (const ch of ['ch1', 'ch2']) {
      const pw = S.sim && pwmOn(p.id + ':' + ch.toUpperCase());
      if (pw && span <= 0.05) { const T = 1 / pw.f, pts = []; const t0 = simT - span - T; for (let t = Math.floor(t0 / T) * T; t < simT + T; t += T) pts.push([t, 0], [t, pw.vhigh], [t + T * pw.duty, pw.vhigh], [t + T * pw.duty, 0]);
        view[ch] = pts; meas[ch] = `max ${pw.vhigh.toFixed(2)}V`; if (ch === 'ch1') { meas.f1 = `f ${pw.f} Hz`; meas.d1 = `duty ${Math.round(pw.duty * 100)}%`; } continue; }
      const pts = buf[ch].filter(([t]) => t >= simT - span); view[ch] = pts;
      if (pts.length) { const vs = pts.map(x => x[1]), mx = Math.max(...vs), mn = Math.min(...vs); meas[ch] = `max ${mx.toFixed(2)}V`;
        if (ch === 'ch1' && mx - mn > 0.5) { const mid = (mx + mn) / 2; let up = [], hi = 0; for (let i = 1; i < pts.length; i++) { if (pts[i - 1][1] < mid && pts[i][1] >= mid) up.push(pts[i][0]); if (pts[i][1] >= mid) hi += pts[i][0] - pts[i - 1][0]; }
          if (up.length >= 2) meas.f1 = `f ${(1 / ((up.at(-1) - up[0]) / (up.length - 1))).toFixed(2)} Hz`; meas.d1 = `duty ${Math.round(hi / (pts.at(-1)[0] - pts[0][0]) * 100)}%`; } }
    }
    els.get(p.id).el.view = view;
  }
}

// ---------------- info window ----------------
function showInfo(type) {
  const c = BY_TYPE[type], d = INFO[type]; if (!d) return;
  const tabs = [['outside', '👀 Outside'], ['inside', '🔬 Inside'], ['how', '⚙️ How it works'], ['pins', '📍 Pins'], ['specs', '📋 Specs'], ['mistakes', '⚠️ Mistakes'], ['buy', '🛒 Buying']];
  const body = k => k === 'pins' || k === 'specs' ? `<table>${d[k].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : k === 'mistakes' ? `<ul>${d.mistakes.filter(Boolean).map(m => `<li>${m}</li>`).join('')}</ul>`
    : k === 'buy' ? `<p>${c.price ? `<b>Typical price in India: ₹${c.price[0]}–${c.price[1]}</b></p><p>` : ''}${d.buy || 'Widely available from electronics shops and online.'}</p>` : `<p>${d[k]}</p>`;
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-label="${c.name} information"><div class="mhd"><div><h3>${c.name}</h3><div class="mut">${c.desc}</div></div><button class="btn" id="mClose">✕</button></div>
    <div class="mgrid"><div class="mpic"><${c.tag} ${Object.entries(c.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ')}></${c.tag}></div>
    <div><div class="mtabs">${tabs.map(([k, l], i) => `<button class="mtab${i ? '' : ' on'}" data-tab="${k}">${l}</button>`).join('')}</div><div class="mbody" id="mBody">${body('outside')}</div>
    <p class="mut small">Typical datasheet values. Always check the datasheet of the exact part you buy.</p></div></div></div>`;
  $('modal').hidden = false; $('mClose').onclick = closeModal;
  for (const b of $('modal').querySelectorAll('.mtab')) b.onclick = () => { $('modal').querySelectorAll('.mtab').forEach(x => x.classList.toggle('on', x === b)); $('mBody').innerHTML = body(b.dataset.tab); };
}
function closeModal() { const m = $('modal'); if (m) { m.hidden = true; m.innerHTML = ''; } }

// ---------------- parts list & cost (the "before you buy" list) ----------------
function billOfMaterials() {
  const rows = new Map();
  for (const p of S.parts) { const c = BY_TYPE[p.type]; if (!c) continue;
    const variant = p.type === 'resistor' ? fmt(p.props.ohms, 'Ω').replace('.00', '') : p.type === 'led' ? p.props.color : p.type === 'ecap' || p.type === 'capacitor' ? fmt(p.props.farads, 'F').replace('.00', '') : p.type === 'battery' ? p.props.volts + ' V' : '';
    const key = c.name + '|' + variant, r = rows.get(key) || { name: c.name, variant, qty: 0, price: c.price || [0, 0], lab: c.group === 'Instruments' || p.type === 'psu' };
    r.qty++; rows.set(key, r); }
  const list = [...rows.values()].sort((a, b) => a.lab - b.lab || a.name.localeCompare(b.name));
  const parts = list.filter(r => !r.lab), lab = list.filter(r => r.lab);
  const sum = (rs, i) => rs.reduce((s, r) => s + r.qty * r.price[i], 0);
  const wireCount = S.wires.filter(w => !w.hidden).length;
  return { parts, lab, min: sum(parts, 0), max: sum(parts, 1), wires: wireCount, problems: (S.sim?.warnings || []).filter(w => w.level === 'bad').length };
}
function showBom() {
  const b = billOfMaterials();
  const tr = r => `<tr><td>${r.name}</td><td>${r.variant}</td><td class="num">${r.qty}</td><td class="num">₹${r.price[0] * r.qty}–${r.price[1] * r.qty}</td></tr>`;
  const text = ['ccbb parts list', ...b.parts.map(r => `${r.qty} × ${r.name}${r.variant ? ' (' + r.variant + ')' : ''}  ₹${r.price[0] * r.qty}–${r.price[1] * r.qty}`), b.wires ? `${b.wires} × jumper wire (pack of 40 ≈ ₹60–100)` : '', `Total ≈ ₹${b.min}–${b.max}`].filter(Boolean).join('\n');
  $('modal').innerHTML = `<div class="mbox" role="dialog" aria-label="Parts list"><div class="mhd"><div><h3>🧾 Parts list &amp; cost</h3><div class="mut">Everything you need to buy to build this circuit for real</div></div><button class="btn" id="mClose">✕</button></div>
    ${b.problems ? `<div class="warn bad">⛔ Fix ${b.problems} problem${b.problems > 1 ? 's' : ''} in the Circuit check before you buy: the circuit would damage parts as built.</div>` : b.parts.length ? '<div class="okmsg">✔ The simulator found no damaging mistakes in this circuit.</div>' : ''}
    <table class="bom"><tr><th>Part</th><th>Value</th><th class="num">Qty</th><th class="num">Price</th></tr>${b.parts.map(tr).join('') || '<tr><td colspan="4" class="mut">No parts yet.</td></tr>'}
    ${b.wires ? `<tr><td>Jumper wires</td><td>male–male</td><td class="num">${b.wires}</td><td class="num">pack ₹60–100</td></tr>` : ''}
    <tr class="tot"><td colspan="3">Estimated total</td><td class="num">₹${b.min}–${b.max}</td></tr></table>
    ${b.lab.length ? `<p class="mut">Lab equipment (not counted, usually available in your college lab): ${b.lab.map(r => r.name).join(', ')}.</p>` : ''}
    <p class="mut small">Prices are typical Indian retail ranges and change by shop and season.</p>
    <p class="row"><button class="btn" id="bomCopy">📋 Copy list</button><button class="btn" id="bomCsv">⬇ Download CSV</button></p></div>`;
  $('modal').hidden = false; $('mClose').onclick = closeModal;
  $('bomCopy').onclick = () => { navigator.clipboard?.writeText(text); $('bomCopy').textContent = '✔ Copied'; };
  $('bomCsv').onclick = () => { const csv = 'Part,Value,Qty,Min price,Max price\n' + b.parts.map(r => `"${r.name}","${r.variant}",${r.qty},${r.price[0] * r.qty},${r.price[1] * r.qty}`).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'parts-list.csv'; a.click(); };
}

// ---------------- undo / redo ----------------
const hist = { stack: [], i: -1, restoring: false };
const histSnap = () => JSON.stringify({ parts: S.parts.map(({ state, ...p }) => p), wires: S.wires });
function pushHistory() { if (hist.restoring || !S.ready) return; const s = histSnap(); if (hist.stack[hist.i] === s) return;
  hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(s); if (hist.stack.length > 100) hist.stack.shift(); hist.i = hist.stack.length - 1; updateUndoButtons(); }
function restore(i) { if (i < 0 || i >= hist.stack.length) return; hist.i = i; hist.restoring = true; const d = JSON.parse(hist.stack[i]);
  load({ ...d, code: $('src').value }, { keepHistory: true }); setTimeout(() => { hist.restoring = false; updateUndoButtons(); }, 400); }
const undo = () => restore(hist.i - 1), redo = () => restore(hist.i + 1);
function updateUndoButtons() { if ($('btnUndo')) { $('btnUndo').disabled = hist.i <= 0; $('btnRedo').disabled = hist.i >= hist.stack.length - 1; } }

// ---------------- microcontroller runner (all boards) ----------------
const mcuPart = () => S.parts.find(p => isMcu(p.type));
const board = () => { const m = mcuPart(); return m ? BOARDS[m.type] : null; };
const flameHeat = l => (l > 0 ? Math.min(120, 150 / l) : 0);
const sameNode = (a, b) => S.sim && S.sim.sameNode(a, b);
const powered = (p, vcc, gnd, min) => S.sim && S.sim.voltAt(p.id, vcc) - S.sim.voltAt(p.id, gnd) >= min;
const io = {
  pinMode(pin, mode) { S.io.pins[pin] = { mode, v: 0 }; runSim(); },
  digitalWrite(pin, v) { const B = board(), s = S.io.pins[pin] || { mode: 'INPUT' };
    if (s.mode !== 'OUTPUT') S.io.pins[pin] = { mode: v ? 'INPUT_PULLUP' : 'INPUT' };
    else S.io.pins[pin] = { mode: 'OUTPUT', v: v ? B.vcc : 0 }; runSim(); },
  analogWrite(pin, val) { const B = board(), pwm = B.pwm === 'all' || B.pwm.includes(pin);
    S.io.pins[pin] = pwm && val > 0 && val < 255 ? { mode: 'OUTPUT', v: B.vcc, vhigh: B.vcc, duty: val / 255 } : { mode: 'OUTPUT', v: (pwm ? val >= 255 : val >= 128) ? B.vcc : 0 };
    if (!pwm && !warnedPwm.has(pin)) { warnedPwm.add(pin); serial(`[sim] Pin ${pin} has no PWM (~). analogWrite acts like on/off. PWM pins: ${B.pwm.join(', ')}.\n`); } runSim(); },
  digitalRead(pin) { const m = mcuPart(); return m && S.sim ? (S.sim.voltAt(m.id, pin) > board().vcc / 2 ? 1 : 0) : 0; },
  analogRead(pin) { const m = mcuPart(), B = board(); if (!m || !S.sim) return 0;
    if (!B.analog.includes(pin) && !warnedPwm.has('adc' + pin)) { warnedPwm.add('adc' + pin); serial(`[sim] Pin ${pin} is not an analog input on the ${B.name}. Analog pins: ${B.analog.join(', ')}.\n`); }
    const max = 2 ** B.adcBits - 1; return Math.max(0, Math.min(max, Math.round(S.sim.voltAt(m.id, pin) / B.adcRef * max))); },
  pulseIn(pin) { const m = mcuPart(); const h = S.parts.find(p => p.type === 'hcsr04' && sameNode(p.id + ':ECHO', m.id + ':' + pin));
    if (!h || !powered(h, 'VCC', 'GND', 4.5)) return 0; const d = h.props.dist ?? 50; return d < 2 || d > 400 ? 0 : Math.round(d * 2 / 0.0343); },
  serial: t => serial(t), tone: pin => io.digitalWrite(pin, 1), noTone: pin => io.digitalWrite(pin, 0),
  lib: {
    dht(pin) { const m = mcuPart(); const d = S.parts.find(p => p.type === 'dht22' && sameNode(p.id + ':SDA', m.id + ':' + pin));
      if (!d || !powered(d, 'VCC', 'GND', 3.2)) return null; const t = (d.props.temp ?? 27) + flameHeat(d.props.lighter);
      return t > 80 ? null : { t: Math.round(t * 10) / 10, h: Math.max(0, Math.round((d.props.hum ?? 55) - (d.props.lighter ? 60 / d.props.lighter : 0))) }; },
    servo(pin, a) { const m = mcuPart(); for (const sv of S.parts.filter(p => p.type === 'servo' && sameNode(p.id + ':PWM', m.id + ':' + pin))) { sv.state.angle = a; els.get(sv.id).el.angle = a; } },
    lcd(addr, rows, bl) { const m = mcuPart(), B = board();
      for (const d of S.parts.filter(p => p.type === 'lcd' && sameNode(p.id + ':SDA', m.id + ':' + B.i2c.SDA) && sameNode(p.id + ':SCL', m.id + ':' + B.i2c.SCL))) {
        const el = els.get(d.id).el, ok = powered(d, 'VCC', 'GND', 4.5); el.text = ok ? rows.map(r => r.padEnd(16).slice(0, 16)).join('') : ''; el.backlight = ok && bl; } },
    oled(ops) { const m = mcuPart(), B = board();
      for (const d of S.parts.filter(p => p.type === 'oled' && sameNode(p.id + ':DATA', m.id + ':' + B.i2c.SDA) && sameNode(p.id + ':CLK', m.id + ':' + B.i2c.SCL))) drawOled(els.get(d.id).el, powered(d, 'VIN', 'GND', 3) ? ops : []); },
  },
};
function drawOled(el, ops) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 64); g.imageSmoothingEnabled = false;
  for (const o of ops) { g.fillStyle = g.strokeStyle = o.at(-1) === 0 && o[0] !== 'rect' && o[0] !== 'circle' ? '#000' : '#fff';
    if (o[0] === 'text') { g.fillStyle = o[5] ? '#fff' : '#000'; g.font = `${8 * o[3]}px monospace`; g.textBaseline = 'top'; g.fillText(o[4], o[1], o[2]); }
    if (o[0] === 'px') g.fillRect(o[1], o[2], 1, 1);
    if (o[0] === 'line') { g.beginPath(); g.moveTo(o[1] + .5, o[2] + .5); g.lineTo(o[3] + .5, o[4] + .5); g.stroke(); }
    if (o[0] === 'rect') { g.fillStyle = g.strokeStyle = o[5] ? '#fff' : '#000'; o[6] ? g.fillRect(o[1], o[2], o[3], o[4]) : g.strokeRect(o[1] + .5, o[2] + .5, o[3] - 1, o[4] - 1); }
    if (o[0] === 'circle') { g.fillStyle = g.strokeStyle = o[4] ? '#fff' : '#000'; g.beginPath(); g.arc(o[1], o[2], o[3], 0, 7); o[5] ? g.fill() : g.stroke(); } }
  const img = g.getImageData(0, 0, 128, 64); for (let i = 0; i < img.data.length; i += 4) { const on = img.data[i] > 100; img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 255 : 0; }
  el.imageData = img; el.redraw?.();
}
const warnedPwm = new Set();
let serialBuf = '';
function serial(t) { serialBuf = (serialBuf + t).slice(-6000); const s = $('serial'); s.textContent = serialBuf; s.scrollTop = 1e9; }
$('btnClear').onclick = () => { serialBuf = ''; $('serial').textContent = ''; };
function wrapIo(B) { // translate pin numbers used in code (e.g. 2, D4, GP25, PC13) to the board's pin names
  const P = v => B.pin(v); return { ...io, pinMode: (p, m) => io.pinMode(P(p), m), digitalWrite: (p, v) => io.digitalWrite(P(p), v), analogWrite: (p, v) => io.analogWrite(P(p), v),
    digitalRead: p => io.digitalRead(P(p)), analogRead: p => io.analogRead(P(p)), pulseIn: p => io.pulseIn(P(p)), tone: p => io.tone(P(p)), noTone: p => io.noTone(P(p)),
    lib: { ...io.lib, dht: p => io.lib.dht(P(p)), servo: (p, a) => io.lib.servo(P(p), a) } }; }
$('btnRun').onclick = async () => {
  stopCode(); $('err').hidden = true;
  const m = mcuPart(); if (!m) { showErr('Add a microcontroller (Arduino, ESP32, Pico…) first: your code runs on it.'); return; }
  const B = BOARDS[m.type];
  S.io = { mcu: m.id, pins: {} }; warnedPwm.clear(); serial('');
  const r = S.runner = createRunner(wrapIo(B), { board: B });
  try { r.compile($('src').value); } catch (e) { showErr('Code error: ' + e.message + '\nTip: check brackets { } and semicolons ;'); return; }
  setRunning(true);
  try { await r.run($('src').value); } catch (e) { showErr('Runtime error: ' + e.message); }
  if (S.runner === r) setRunning(false);
};
$('btnStop').onclick = () => stopCode();
function stopCode() { if (S.runner) { S.runner.stop(); S.runner = null; } S.io = { pins: {} }; setRunning(false); changed(); }
function setRunning(on) { $('btnRun').disabled = on; $('btnStop').disabled = !on; const p = $('simState'); p.textContent = on ? '● Running code' : '● Live'; p.classList.toggle('run', on); }
function showErr(t) { const e = $('err'); e.textContent = t; e.hidden = false; }
function updateBoardLabel() { const m = mcuPart(); $('boardSel').innerHTML = m ? `<option>Code runs on: ${BOARDS[m.type].name} (${BOARDS[m.type].chip})</option>` : '<option>Add a microcontroller to run code</option>'; }

// ---------------- code from circuit (rule-based helper) ----------------
$('btnAuto').onclick = () => {
  const m = mcuPart(); if (!m) { showErr('Add a microcontroller and wire some parts first.'); return; }
  const id = m.id, B = BOARDS[m.type], PWM = B.pwm === 'all' ? B.io : B.pwm;
  const sim = simulate(S.parts, S.wires, {}), node = k => sim.net.node(k);
  const codeName = pn => ({ esp32: pn.replace(/^D(\d+)$/, '$1').replace('VP', '36').replace('VN', '39'), pico: pn.replace('GP', ''), rp2040: pn.replace(/^D(\d+)$/, '$1') })[m.type] ?? pn;
  const unoPins = B.io.filter(pn => !/^(0|1|TX.*|RX.*)$/.test(pn));
  const pinAt0 = n => unoPins.find(pn => node(id + ':' + pn) === n), pinAt = n => { const x = pinAt0(n); return x && codeName(x); };
  const viaResistor = n => { for (const r of S.parts.filter(p => p.type === 'resistor')) { const a = node(r.id + ':1'), b = node(r.id + ':2');
    if (a === n && pinAt(b)) return pinAt(b); if (b === n && pinAt(a)) return pinAt(a); } return null; };
  const leds = S.parts.filter(p => p.type === 'led').map(p => pinAt(node(p.id + ':A')) || viaResistor(node(p.id + ':A'))).filter(Boolean);
  const btns = S.parts.filter(p => p.type === 'pushbutton').map(p => pinAt(node(p.id + ':1.l')) || pinAt(node(p.id + ':2.l'))).filter(Boolean);
  const pots = S.parts.filter(p => p.type === 'pot').map(p => pinAt(node(p.id + ':SIG'))).filter(Boolean);
  const buz = S.parts.filter(p => p.type === 'buzzer').map(p => pinAt(node(p.id + ':1')) || pinAt(node(p.id + ':2'))).filter(Boolean);
  if (!leds.length && !buz.length) { showErr('I could not find an LED or buzzer connected to a microcontroller pin. Wire one (through a resistor) and try again.'); return; }
  let c = `// Generated from your wiring: ${[...leds.map(p => 'LED on ' + p), ...btns.map(p => 'button on ' + p), ...pots.map(p => 'knob on ' + p), ...buz.map(p => 'buzzer on ' + p)].join(', ')}\n`;
  const outs = [...leds, ...buz];
  c += `\nvoid setup() {\n  Serial.begin(9600);\n${outs.map(p => `  pinMode(${p}, OUTPUT);\n`).join('')}${btns.map(p => `  pinMode(${p}, INPUT_PULLUP);  // pressed = LOW\n`).join('')}}\n\nvoid loop() {\n`;
  if (pots.length && leds.length && (B.pwm === 'all' || leds.some(p => B.pwm.includes(p)))) { const L = leds.find(p => B.pwm === 'all' || B.pwm.includes(p));
    c += `  int knob = analogRead(${pots[0]});\n  analogWrite(${L}, map(knob, 0, ${2 ** B.adcBits - 1}, 0, 255));\n  Serial.println(knob);\n  delay(100);\n`; }
  else if (btns.length) c += `  bool pressed = digitalRead(${btns[0]}) == LOW;\n${outs.map(p => `  digitalWrite(${p}, pressed ? HIGH : LOW);\n`).join('')}  delay(50);\n`;
  else c += outs.map(p => `  digitalWrite(${p}, HIGH);\n  delay(500);\n  digitalWrite(${p}, LOW);\n  delay(500);\n`).join('') + `  Serial.println("blink");\n`;
  c += `}\n`;
  $('src').value = c; gutter(); save(); $('err').hidden = true;
};

// ---------------- editor ----------------
function gutter() { const n = $('src').value.split('\n').length; $('gutter').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
$('src').addEventListener('input', () => { gutter(); save(); });
$('src').addEventListener('scroll', () => { $('gutter').scrollTop = $('src').scrollTop; });
$('src').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText('  ', s, t.selectionEnd, 'end'); gutter(); } });
$('btnMin').onclick = () => { $('code').classList.toggle('min'); setTimeout(() => { drawWires(); drawPins(); }, 200); };

// ---------------- projects, save, load ----------------
function load(data, opts = {}) {
  if (!opts.keepHistory) { hist.stack = []; hist.i = -1; }
  S.ready = false; stopCode(); for (const r of els.values()) r.host.remove(); els.clear();
  S.parts = structuredClone(data.parts || []); S.wires = structuredClone(data.wires || []);
  S.nextId = 1 + Math.max(0, ...S.parts.map(p => +(p.id.match(/\d+$/)?.[0] || 0)));
  S.parts.forEach(mountPart); $('src').value = data.code || ''; gutter(); selectThing(null);
  Promise.all(['wokwi-arduino-uno', 'wokwi-led', 'wokwi-resistor', 'cb-breadboard'].map(t => customElements.whenDefined(t))).then(() => setTimeout(() => {
    for (const p of S.parts) if (p.at) {
      const hole = pinPos(p.at.bb + ':' + p.at.hole), pin = pinPos(p.id + ':' + p.at.pin);
      if (hole && pin) { p.x += hole[0] - pin[0]; p.y += hole[1] - pin[1]; placeHost(p); tryInsert(p); }
      delete p.at;
    }
    changed(); setTimeout(() => { drawWires(); drawPins(); requestAnimationFrame(() => { S.ready = true; pushHistory(); }); }, 200);
  }, 60));
}
$('projects').onchange = e => { if (e.target.value) load(PROJECTS[e.target.value]); e.target.value = ''; };
$('btnNew').onclick = () => { if (confirm('Start a new empty circuit?')) load({ parts: [], wires: [], code: 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n' }); };
$('btnExport').onclick = () => { const b = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'circuit.json'; a.click(); };
$('fileIn').onchange = async e => { const f = e.target.files[0]; if (f) { try { load(JSON.parse(await f.text())); } catch { alert('That file is not a valid circuit.'); } } };
const snapshot = () => ({ version: 1, parts: S.parts.map(({ state, ...p }) => p), wires: S.wires, code: $('src').value });
function save() { try { localStorage.setItem('ccbb.circuit', JSON.stringify(snapshot())); } catch {} }
addEventListener('resize', () => { drawWires(); drawPins(); });

function setZoom(z) { Z = Math.max(0.6, Math.min(2.2, Math.round(z * 100) / 100)); $('world').style.transform = `scale(${Z})`; $('zoomLbl').textContent = Math.round(Z * 100) + '%'; drawWires(); drawPins(); }
$('zIn').onclick = () => setZoom(Z + 0.15); $('zOut').onclick = () => setZoom(Z - 0.15); setZoom(Z);
// expose for tests / power users
$('btnBom').onclick = showBom; $('btnUndo').onclick = undo; $('btnRedo').onclick = redo;
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !navigator.webdriver) navigator.serviceWorker.register('sw.js').catch(() => {});
window.ccbb = { billOfMaterials, showInfo, rotatePart, undo, redo, hist, get simT() { return simT; }, get Z() { return Z; }, setZoom, S, load, addPart, connect: (from, to) => { S.wires.push({ from, to }); changed(); }, simNow: () => (runSim(), S.sim), pinPos, PROJECTS };

let initial = null; try { initial = JSON.parse(localStorage.getItem('ccbb.circuit')); } catch {}
const q = new URLSearchParams(location.search).get('project');
load(q && PROJECTS[q] ? PROJECTS[q] : initial?.parts?.length ? initial : PROJECTS.blink);
