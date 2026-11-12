// Circuit Lab: schematic editor + DC operating point / transient / AC (Bode) / DC sweep, with plots and measurements.
import { SYMBOLS, DEFAULTS, pinXY, parseValue, fmtEng, operatingPoint, transient, acSweep, dcSweep, measureAC, measureWave } from '../engine/analysis.js';
import { LAB_TEMPLATES } from './lab-templates.js';

const $ = id => document.getElementById(id), G = 20, NS = 'http://www.w3.org/2000/svg';
const L = { sch: { comps: [], wires: [] }, sel: null, mode: null, place: null, wireFrom: null, mouse: [0, 0], result: null, n: {} };
const PREFIX = { res: 'R', cap: 'C', ind: 'L', diode: 'D', led: 'LED', zener: 'DZ', switch: 'S', vdc: 'V', vsin: 'V', vpulse: 'V', vtri: 'V', idc: 'I', gnd: 'G', probe: 'P', npn: 'Q', pnp: 'Q', nmos: 'M', opamp: 'U', lm358: 'U' };
const NAMES = { res: 'Resistor', cap: 'Capacitor', ind: 'Inductor', diode: 'Diode', led: 'LED', zener: 'Zener', switch: 'Switch', vdc: 'DC source', vsin: 'Sine source', vpulse: 'Square source', vtri: 'Triangle source', idc: 'Current source', gnd: 'Ground', probe: 'Probe', npn: 'NPN', pnp: 'PNP', nmos: 'N-MOSFET', opamp: 'Op-amp (ideal)', lm358: 'LM358' };
const GROUPS = [['Passive', ['res', 'cap', 'ind', 'switch']], ['Sources', ['vdc', 'vsin', 'vpulse', 'vtri', 'idc', 'gnd']], ['Semiconductors', ['diode', 'led', 'zener', 'npn', 'pnp', 'nmos']], ['Amplifiers', ['opamp', 'lm358']], ['Measure', ['probe']]];

// ---------- symbol drawings (local coordinates, rot 0) ----------
const circ = (cy, inner) => `<line x1="0" y1="0" x2="0" y2="16"/><circle cx="0" cy="30" r="14"/>${inner}<line x1="0" y1="44" x2="0" y2="60"/>`;
const DRAW = {
  res: () => `<polyline points="0,0 15,0 18,-7 24,7 30,-7 36,7 42,-7 45,0 60,0"/>`,
  cap: () => `<line x1="0" y1="0" x2="26" y2="0"/><line x1="26" y1="-12" x2="26" y2="12"/><line x1="34" y1="-12" x2="34" y2="12"/><line x1="34" y1="0" x2="60" y2="0"/>`,
  ind: () => `<line x1="0" y1="0" x2="10" y2="0"/><path d="M10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0"/><line x1="50" y1="0" x2="60" y2="0"/>`,
  diode: () => `<line x1="0" y1="0" x2="20" y2="0"/><polygon points="20,-9 20,9 38,0" fill="#1c2230"/><line x1="38" y1="-9" x2="38" y2="9"/><line x1="38" y1="0" x2="60" y2="0"/>`,
  led: c => DRAW.diode() + `<path d="M28 -12 l6 -8 M33 -10 l6 -8" stroke="${({ red: '#dc2626', green: '#16a34a', blue: '#2563eb', yellow: '#ca8a04', white: '#94a3b8' })[c.props.color] || '#dc2626'}"/>`,
  zener: () => `<line x1="0" y1="0" x2="20" y2="0"/><polygon points="20,-9 20,9 38,0" fill="#1c2230"/><polyline points="34,-12 38,-9 38,9 42,12"/><line x1="38" y1="0" x2="60" y2="0"/>`,
  switch: c => `<line x1="0" y1="0" x2="16" y2="0"/><circle cx="18" cy="0" r="2.5"/><circle cx="42" cy="0" r="2.5"/><line x1="20" y1="0" x2="${c.props.closed ? 40 : 38}" y2="${c.props.closed ? 0 : -14}"/><line x1="44" y1="0" x2="60" y2="0"/>`,
  vdc: () => circ(30, `<text x="-4" y="26" style="font-size:13px">+</text><text x="-3" y="41" style="font-size:13px">−</text>`),
  vsin: () => circ(30, `<path d="M-8 30 q4 -10 8 0 q4 10 8 0"/>`),
  vpulse: () => circ(30, `<polyline points="-8,34 -8,24 0,24 0,34 8,34 8,24"/>`),
  vtri: () => circ(30, `<polyline points="-9,34 -4,24 2,34 8,24"/>`),
  idc: () => circ(30, `<line x1="0" y1="38" x2="0" y2="22"/><polyline points="-4,26 0,21 4,26"/>`),
  gnd: () => `<line x1="0" y1="0" x2="0" y2="10"/><line x1="-12" y1="10" x2="12" y2="10"/><line x1="-7" y1="15" x2="7" y2="15"/><line x1="-3" y1="20" x2="3" y2="20"/>`,
  probe: () => `<line x1="0" y1="0" x2="0" y2="-10"/><polygon points="0,-10 0,-24 16,-17" fill="#f59e0b" stroke="#b45309"/>`,
  npn: () => `<line x1="0" y1="20" x2="18" y2="20"/><line x1="18" y1="6" x2="18" y2="34" stroke-width="3"/><line x1="18" y1="14" x2="40" y2="0"/><line x1="18" y1="26" x2="40" y2="40"/><polygon points="40,40 30,38 35,32" fill="#1c2230"/>`,
  pnp: () => `<line x1="0" y1="20" x2="18" y2="20"/><line x1="18" y1="6" x2="18" y2="34" stroke-width="3"/><line x1="18" y1="14" x2="40" y2="0"/><line x1="18" y1="26" x2="40" y2="40"/><polygon points="20,27 30,28 26,34" fill="#1c2230"/>`,
  nmos: () => `<line x1="0" y1="20" x2="14" y2="20"/><line x1="14" y1="8" x2="14" y2="32"/><line x1="20" y1="6" x2="20" y2="34" stroke-dasharray="6 3"/><polyline points="20,10 40,10 40,0"/><polyline points="20,30 40,30 40,40"/><line x1="20" y1="20" x2="40" y2="20"/><polyline points="40,20 40,30"/><polygon points="20,20 27,16 27,24" fill="#1c2230"/>`,
  opamp: () => `<polygon points="10,-10 10,50 80,20" fill="#fff"/><line x1="0" y1="0" x2="10" y2="0"/><line x1="0" y1="40" x2="10" y2="40"/><text x="14" y="5" style="font-size:14px">−</text><text x="14" y="45" style="font-size:14px">+</text>`,
  lm358: () => DRAW.opamp() + `<line x1="40" y1="-20" x2="40" y2="4"/><line x1="40" y1="36" x2="40" y2="60"/><text x="44" y="-10" style="font-size:9px">V+</text><text x="44" y="58" style="font-size:9px">V−</text>`,
};
const VALUE = c => { const p = c.props; switch (c.type) {
  case 'res': return fmtEng(parseValue(p.R), 'Ω'); case 'cap': return fmtEng(parseValue(p.C), 'F'); case 'ind': return fmtEng(parseValue(p.L), 'H');
  case 'vdc': return p.V + ' V'; case 'vsin': return `${p.amp} V ${fmtEng(parseValue(p.freq), 'Hz')}`; case 'vpulse': case 'vtri': return `${p.low}…${p.high} V ${fmtEng(parseValue(p.freq), 'Hz')}`;
  case 'idc': return fmtEng(parseValue(p.I), 'A'); case 'zener': return p.vz + ' V'; case 'probe': return p.name; case 'led': return p.color; case 'switch': return p.closed ? 'closed' : 'open';
  case 'npn': return 'BC547'; case 'pnp': return 'BC557'; case 'nmos': return 'IRLZ44N'; default: return ''; } };

// ---------- palette ----------
(function palette() {
  let h = `<button class="symb" data-t="wire"><svg viewBox="-5 -15 70 30"><polyline class="body" points="0,8 30,8 30,-8 60,-8" style="stroke:#0f766e;stroke-width:3;fill:none"/></svg>Wire (W)</button>`;
  for (const [g, ts] of GROUPS) { h += `<h5>${g}</h5>`; for (const t of ts) h += `<button class="symb" data-t="${t}" title="${NAMES[t]}"><svg viewBox="${['vdc', 'vsin', 'vpulse', 'vtri', 'idc'].includes(t) ? '-35 -5 70 70' : t === 'gnd' || t === 'probe' ? '-30 -28 60 52' : ['npn', 'pnp', 'nmos'].includes(t) ? '-10 -8 60 56' : ['opamp', 'lm358'].includes(t) ? '-5 -25 90 90' : '-5 -20 70 40'}"><g class="body" style="stroke:#1c2230;stroke-width:2;fill:none">${DRAW[t]({ props: DEFAULTS[t] })}</g></svg>${NAMES[t]}</button>`; }
  $('sym').innerHTML = h;
  $('sym').onclick = e => { const b = e.target.closest('.symb'); if (!b) return; setMode(b.dataset.t === 'wire' ? 'wire' : 'place', b.dataset.t); };
  $('tpl').innerHTML += Object.entries(LAB_TEMPLATES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
})();
function setMode(m, t) { L.mode = m; L.place = m === 'place' ? t : null; L.wireFrom = null; for (const b of document.querySelectorAll('.symb')) b.classList.toggle('on', (m === 'wire' && b.dataset.t === 'wire') || (m === 'place' && b.dataset.t === t)); $('sheet').style.cursor = m ? 'crosshair' : 'default'; draw(); }

// ---------- drawing ----------
const snap = v => Math.round(v / G) * G;
function svgPoint(e) { const r = $('sheet').getBoundingClientRect(); return [snap(e.clientX - r.left), snap(e.clientY - r.top)]; }
function route(a, b) { return a[0] === b[0] || a[1] === b[1] ? [a, b] : [a, [b[0], a[1]], b]; }
function labelPos(c) { const ps = pinXY(c), xs = ps.map(p => p.x), ys = ps.map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const vertical = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
  return c.type === 'gnd' ? null : c.type === 'probe' ? [c.x + 20, c.y - 14] : vertical ? [cx + 20, cy - 2] : ['opamp', 'lm358', 'npn', 'pnp', 'nmos'].includes(c.type) ? [cx + 4, Math.min(...ys) - 26] : [cx - 14, cy - 26]; }
function draw() {
  const s = L.sch, counts = new Map(), bump = (x, y) => counts.set(x + ',' + y, (counts.get(x + ',' + y) || 0) + 1);
  for (const c of s.comps) for (const p of pinXY(c)) bump(p.x, p.y);
  for (const w of s.wires) { bump(...w.pts[0]); bump(...w.pts.at(-1)); }
  let h = '';
  s.wires.forEach((w, i) => { const d = 'M' + w.pts.map(p => p.join(',')).join(' L'); h += `<path class="wg" data-w="${i}" d="${d}"/><path class="w${L.sel?.w === i ? ' sel' : ''}" d="${d}"/>`; });
  for (const [k, n] of counts) if (n >= 3) { const [x, y] = k.split(','); h += `<circle class="dot" cx="${x}" cy="${y}" r="3.5"/>`; }
  for (const c of s.comps) {
    const lp = labelPos(c);
    h += `<g class="c${L.sel?.c === c.id ? ' sel' : ''}" data-c="${c.id}"><g class="body" transform="translate(${c.x},${c.y}) rotate(${c.rot || 0})"><rect x="-8" y="-24" width="${['opamp', 'lm358'].includes(c.type) ? 96 : 76}" height="${['vdc', 'vsin', 'vpulse', 'vtri', 'idc', 'lm358'].includes(c.type) ? 90 : 60}" fill="transparent" stroke="none"/>${DRAW[c.type](c)}</g>`;
    if (lp) h += `<text x="${lp[0]}" y="${lp[1]}">${c.type === 'probe' ? '' : c.id}</text><text class="val" x="${lp[0]}" y="${lp[1] + 13}">${VALUE(c)}</text>`;
    for (const p of pinXY(c)) h += `<circle class="pin" data-p="${p.x},${p.y}" cx="${p.x}" cy="${p.y}" r="3"/>`;
    h += '</g>';
  }
  if (L.result?.kind === 'op') h += opLabels();
  if (L.mode === 'wire' && L.wireFrom) h += `<polyline class="w" style="stroke-dasharray:5 4" points="${route(L.wireFrom, L.mouse).map(p => p.join(',')).join(' ')}"/>`;
  if (L.mode === 'place') { const g = { type: L.place, x: L.mouse[0], y: L.mouse[1], rot: L.placeRot || 0, props: DEFAULTS[L.place] }; h += `<g opacity=".45" class="body" transform="translate(${g.x},${g.y}) rotate(${g.rot})">${DRAW[g.type](g)}</g>`; }
  $('sheet').innerHTML = h;
}
function opLabels() {
  const r = L.result, out = [];
  for (const c of L.sch.comps) { if (c.type === 'probe') out.push(`<text class="opv" x="${c.x + 20}" y="${c.y + 4}">${c.props.name} = ${fmtEng(r.op.V[c.props.name], 'V')}</text>`);
    else if (r.op.I[c.id] !== undefined && SYMBOLS[c.type].two && c.type !== 'gnd') { const lp = labelPos(c); if (lp) out.push(`<text class="opi" x="${lp[0]}" y="${lp[1] + 26}">${fmtEng(Math.abs(r.op.I[c.id]), 'A')}</text>`); } }
  return out.join('');
}

// ---------- editing ----------
function nextId(type) { const p = PREFIX[type]; let n = 1; while (L.sch.comps.some(c => c.id === p + n)) n++; return p + n; }
function changed() { L.result = null; save(); draw(); props(); }
$('sheet').addEventListener('mousemove', e => { L.mouse = svgPoint(e); if (L.mode) draw(); });
$('sheet').addEventListener('mousedown', e => {
  const pt = svgPoint(e);
  if (L.mode === 'place') { const c = { id: nextId(L.place), type: L.place, x: pt[0], y: pt[1], rot: L.placeRot || 0, props: structuredClone(DEFAULTS[L.place]) }; L.sch.comps.push(c); L.sel = { c: c.id }; if (!e.shiftKey) setMode(null); changed(); return; }
  if (L.mode === 'wire') { if (!L.wireFrom) { L.wireFrom = pt; return; } if (pt[0] !== L.wireFrom[0] || pt[1] !== L.wireFrom[1]) { L.sch.wires.push({ pts: route(L.wireFrom, pt) }); L.wireFrom = pt; changed(); }
    if (e.target.classList.contains('pin') || e.detail >= 2) L.wireFrom = null; return; }
  const cg = e.target.closest('[data-c]'), wg = e.target.dataset?.w;
  if (cg) { const c = L.sch.comps.find(q => q.id === cg.dataset.c); L.sel = { c: c.id }; const ox = c.x, oy = c.y, [sx, sy] = pt; let moved = false;
    const mv = ev => { const [x, y] = svgPoint(ev); if (x !== sx || y !== sy) moved = true; c.x = ox + x - sx; c.y = oy + y - sy; draw(); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) changed(); else { draw(); props(); } };
    addEventListener('mousemove', mv); addEventListener('mouseup', up); return; }
  if (wg !== undefined) { L.sel = { w: +wg }; draw(); props(); return; }
  L.sel = null; draw(); props();
});
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'Escape') { setMode(null); L.sel = null; draw(); props(); }
  if (e.key === 'w' || e.key === 'W') setMode('wire');
  if (e.key === 'r' || e.key === 'R') { if (L.mode === 'place') { L.placeRot = ((L.placeRot || 0) + 90) % 360; draw(); } else if (L.sel?.c) { const c = L.sch.comps.find(q => q.id === L.sel.c); c.rot = ((c.rot || 0) + 90) % 360; changed(); } }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (L.sel?.c) L.sch.comps = L.sch.comps.filter(c => c.id !== L.sel.c); else if (L.sel?.w !== undefined) L.sch.wires.splice(L.sel.w, 1); L.sel = null; changed(); }
});

// ---------- properties ----------
const FIELD = { R: 'Resistance', C: 'Capacitance', L: 'Inductance', V: 'Voltage (V)', I: 'Current (A)', amp: 'Amplitude (V)', offset: 'DC offset (V)', freq: 'Frequency (Hz)', ac: 'AC magnitude (V)', low: 'Low (V)', high: 'High (V)', duty: 'Duty (%)', vz: 'Zener voltage', beta: 'Gain β', name: 'Probe name' };
function props() {
  const box = $('props'), c = L.sch.comps.find(q => q.id === L.sel?.c);
  if (!c) { box.innerHTML = L.sel?.w !== undefined ? '<b>Wire</b><button class="btn" id="pDel">Delete wire</button>' : '<b>Select a part</b><p class="mut small">Click a symbol on the sheet to edit its value. Values accept 10k, 4.7u, 100n, 1meg.</p>'; if ($('pDel')) $('pDel').onclick = () => { L.sch.wires.splice(L.sel.w, 1); L.sel = null; changed(); }; return; }
  let h = `<b>${c.id} · ${NAMES[c.type]}</b>`;
  for (const [k, v] of Object.entries(c.props)) {
    if (k === 'color') h += `<label>Colour <select data-k="color">${['red', 'green', 'blue', 'yellow', 'white'].map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    else if (k === 'closed') h += `<label>Switch <button class="btn" data-t="closed">${v ? 'Closed' : 'Open'}</button></label>`;
    else h += `<label>${FIELD[k] || k} <input type="text" data-k="${k}" value="${v}"></label>`; }
  h += `<div class="row"><button class="btn" id="pRot">⟳ Rotate (R)</button><button class="btn" id="pDel">Delete</button></div>`;
  box.innerHTML = h;
  for (const x of box.querySelectorAll('[data-k]')) x.onchange = () => { c.props[x.dataset.k] = x.dataset.k === 'name' || x.dataset.k === 'color' ? x.value : x.value.trim(); if (x.dataset.k !== 'name' && x.dataset.k !== 'color' && isNaN(parseValue(x.value))) { x.style.borderColor = 'red'; return; } changed(); };
  for (const x of box.querySelectorAll('[data-t]')) x.onclick = () => { c.props.closed = !c.props.closed; changed(); };
  $('pRot').onclick = () => { c.rot = ((c.rot || 0) + 90) % 360; changed(); }; $('pDel').onclick = () => { L.sch.comps = L.sch.comps.filter(q => q !== c); L.sel = null; changed(); };
}

// ---------- analysis ----------
function params() {
  const k = $('kind').value, a = L.analysis || {}, srcs = L.sch.comps.filter(c => ['vdc', 'vsin', 'vpulse', 'vtri', 'idc'].includes(c.type));
  const F = (id, label, v) => `<label>${label} <input type="text" id="${id}" value="${v}"></label>`;
  $('aParams').innerHTML = k === 'tran' ? F('aT', 'Stop time (s)', a.tstop ?? '10m') + `<label class="small"><input type="checkbox" id="aOp"> Start from DC operating point</label>`
    : k === 'ac' ? F('aF1', 'Start freq (Hz)', a.fstart ?? 10) + F('aF2', 'Stop freq (Hz)', a.fstop ?? '1meg') + F('aP', 'Points / decade', a.ppd ?? 20) + '<p class="mut small">Uses the AC magnitude of the sine source (1 V = 0 dB).</p>'
    : k === 'dc' ? `<label>Sweep <select id="aS">${srcs.map(s => `<option ${s.id === a.source ? 'selected' : ''}>${s.id}</option>`).join('')}</select></label>` + F('aD1', 'From', a.from ?? 0) + F('aD2', 'To', a.to ?? 5) + F('aD3', 'Step', a.step ?? 0.05)
    : '<p class="mut small">Calculates every voltage and current with the circuit settled (capacitors open, inductors shorted).</p>';
}
$('kind').onchange = () => { L.analysis = null; params(); };
const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];
$('bRun').onclick = run;
function run() {
  const k = $('kind').value, s = L.sch, warn = [];
  if (!s.comps.some(c => c.type === 'gnd')) warn.push('Add a ground (GND) symbol.');
  if (k !== 'op' && !s.comps.some(c => c.type === 'probe')) warn.push('Add a Probe where you want to measure.');
  $('aWarn').textContent = warn.join(' '); if (warn.length && k !== 'op') return;
  try {
    if (k === 'op') { const op = operatingPoint(s); L.result = { kind: 'op', op }; showOp(op); }
    if (k === 'tran') { const tstop = parseValue($('aT').value); const r = transient(s, { tstop, dt: tstop / 1000, fromOp: $('aOp').checked }); L.result = { kind: 'tran', r };
      showPlot(r, 't', 'Time', 'V', Object.keys(r).filter(n => n !== 't' && !n.startsWith('I(')), false); }
    if (k === 'ac') { const r = acSweep(s, { fstart: parseValue($('aF1').value), fstop: parseValue($('aF2').value), ppd: parseValue($('aP').value) }); L.result = { kind: 'ac', r };
      showPlot(r, 'f', 'Frequency (Hz)', 'Gain (dB)', Object.keys(r).filter(n => n.endsWith(' dB')), true); }
    if (k === 'dc') { const src = $('aS').value; const r = dcSweep(s, { source: src, from: parseValue($('aD1').value), to: parseValue($('aD2').value), step: parseValue($('aD3').value) }); L.result = { kind: 'dc', r, src };
      const ys = Object.keys(r).filter(n => n !== 'x' && !n.startsWith('I(')); showPlot(r, 'x', src + ' (V)', 'V / A', L.analysis?.y ? [L.analysis.y] : ys, false, L.analysis?.x); }
  } catch (e) { $('aWarn').textContent = 'Could not solve this circuit: ' + e.message; }
  draw();
}
function showOp(op) {
  $('results').hidden = false; $('rTitle').textContent = 'DC operating point'; $('xSel').innerHTML = ''; $('plot').hidden = true;
  const rows = [...Object.entries(op.V).map(([n, v]) => [n, fmtEng(v, 'V')]), ...Object.entries(op.I).filter(([id]) => L.sch.comps.find(c => c.id === id && c.type !== 'gnd')).map(([id, i]) => {
    const c = L.sch.comps.find(q => q.id === id), P = c?.type === 'res' ? ` · ${fmtEng(i * i * parseValue(c.props.R), 'W')}` : ''; return ['I(' + id + ')', fmtEng(Math.abs(i), 'A') + P]; })];
  $('meas').style.width = '100%'; $('meas').innerHTML = `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` + (op.converged ? '' : '<p class="warnbox">The solver did not fully converge: check the circuit.</p>');
}
function showPlot(r, xk, xl, yl, ys, logx, xOverride) {
  $('results').hidden = false; $('plot').hidden = false; $('meas').style.width = '280px';
  $('rTitle').textContent = { tran: 'Transient', ac: 'AC sweep (Bode)', dc: 'DC sweep' }[L.result.kind];
  const opts = Object.keys(r).filter(k => k !== xk);
  $('xSel').innerHTML = L.result.kind === 'dc' ? `X axis <select id="xAx"><option value="${xk}">${xl}</option>${opts.map(o => `<option ${o === xOverride ? 'selected' : ''}>${o}</option>`).join('')}</select>` : '';
  const sel = new Set(ys);
  const render = () => { const xKey = $('xAx')?.value || xk; plot(r[xKey], [...sel].map((k, i) => ({ name: k, y: r[k], color: COLORS[i % COLORS.length] })), { logx, xl: xKey === xk ? xl : xKey, yl }); measure(r, xk, [...sel]); };
  $('meas').innerHTML = '';
  if ($('xAx')) $('xAx').onchange = render;
  L.render = render; L.sel2 = sel; render();
}
function measure(r, xk, keys) {
  const k = L.result.kind; let h = '<table>';
  for (const key of keys) {
    if (k === 'tran') { const m = measureWave(r.t, r[key]); h += `<tr><td colspan="2"><b>${key}</b></td></tr><tr><td>Max / Min</td><td>${fmtEng(m.max, 'V')} / ${fmtEng(m.min, 'V')}</td></tr><tr><td>Peak-peak</td><td>${fmtEng(m.vpp, 'V')}</td></tr><tr><td>Average</td><td>${fmtEng(m.avg, 'V')}</td></tr><tr><td>RMS</td><td>${fmtEng(m.rms, 'V')}</td></tr><tr><td>Frequency</td><td>${m.freq ? fmtEng(m.freq, 'Hz') : '—'}</td></tr>`; }
    if (k === 'ac') { const m = measureAC(r.f, r[key]), ph = r[key.replace(' dB', ' °')]; h += `<tr><td colspan="2"><b>${key.replace(' dB', '')}</b></td></tr><tr><td>Max gain</td><td>${m.maxDb.toFixed(2)} dB</td></tr><tr><td>at</td><td>${fmtEng(m.fPeak, 'Hz')}</td></tr><tr><td>−3 dB (high)</td><td>${m.f3dbHigh ? fmtEng(m.f3dbHigh, 'Hz') : '—'}</td></tr><tr><td>−3 dB (low)</td><td>${m.f3dbLow ? fmtEng(m.f3dbLow, 'Hz') : '—'}</td></tr><tr><td>Phase at peak</td><td>${ph[r.f.indexOf(m.fPeak)].toFixed(1)}°</td></tr>`; }
    if (k === 'dc') { const y = r[key]; h += `<tr><td colspan="2"><b>${key}</b></td></tr><tr><td>Start / End</td><td>${fmtEng(y[0], '')} / ${fmtEng(y.at(-1), '')}</td></tr>`; }
  }
  const all = Object.keys(r).filter(n => n !== xk && !(k === 'ac' && n.endsWith(' °')));
  h += `</table><p class="mut small">Show:</p>${all.map(n => `<label class="small" style="display:flex;gap:6px"><input type="checkbox" data-s="${n}" ${keys.includes(n) ? 'checked' : ''}>${n}</label>`).join('')}`;
  $('meas').innerHTML = h;
  for (const cb of $('meas').querySelectorAll('[data-s]')) cb.onchange = () => { cb.checked ? L.sel2.add(cb.dataset.s) : L.sel2.delete(cb.dataset.s); L.render(); };
}
function plot(x, series, { logx, xl, yl }) {
  const cv = $('plot'), dpr = devicePixelRatio || 1, W = cv.clientWidth || 800, H = cv.clientHeight || 300; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.font = '11px Inter, system-ui, sans-serif';
  const m = { l: 58, r: 14, t: 14, b: 34 }, X = v => logx ? Math.log10(v) : v;
  const xs = x.map(X), x0 = Math.min(...xs), x1 = Math.max(...xs), all = series.flatMap(s => s.y).filter(isFinite);
  let y0 = Math.min(...all, 0), y1 = Math.max(...all, 0); if (y1 - y0 < 1e-9) { y1 += 1; y0 -= 1; } const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const px = v => m.l + (X(v) - x0) / (x1 - x0 || 1) * (W - m.l - m.r), py = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  g.strokeStyle = '#e6e0d3'; g.fillStyle = '#6b7385'; g.lineWidth = 1;
  const step = n => { const r = n / 6, p = Math.pow(10, Math.floor(Math.log10(r))); return [1, 2, 5, 10].map(k => k * p).find(k => k >= r); };
  const ys = step(y1 - y0); for (let v = Math.ceil(y0 / ys) * ys; v <= y1; v += ys) { g.beginPath(); g.moveTo(m.l, py(v)); g.lineTo(W - m.r, py(v)); g.stroke(); g.fillText(fmtEng(v, '').trim(), 4, py(v) + 4); }
  if (logx) for (let d = Math.ceil(x0); d <= x1; d++) { const v = Math.pow(10, d); g.beginPath(); g.moveTo(px(v), m.t); g.lineTo(px(v), H - m.b); g.stroke(); g.fillText(fmtEng(v, 'Hz'), px(v) - 14, H - m.b + 16); }
  else { const xs2 = step(x1 - x0); for (let v = Math.ceil(x0 / xs2) * xs2; v <= x1; v += xs2) { g.beginPath(); g.moveTo(px(v), m.t); g.lineTo(px(v), H - m.b); g.stroke(); g.fillText(fmtEng(v, '').trim(), px(v) - 10, H - m.b + 16); } }
  g.fillStyle = '#1c2230'; g.fillText(xl, W / 2 - 30, H - 4); g.save(); g.translate(12, H / 2); g.rotate(-Math.PI / 2); g.restore();
  series.forEach((s, i) => { g.strokeStyle = s.color; g.lineWidth = 2; g.beginPath(); s.y.forEach((v, k) => { if (!isFinite(v)) return; k ? g.lineTo(px(x[k]), py(v)) : g.moveTo(px(x[k]), py(v)); }); g.stroke();
    g.fillStyle = s.color; g.fillRect(W - m.r - 150, m.t + 4 + i * 16, 10, 10); g.fillStyle = '#1c2230'; g.fillText(s.name, W - m.r - 134, m.t + 13 + i * 16); });
}
$('rClose').onclick = () => { $('results').hidden = true; L.result = null; draw(); };
$('bCsv').onclick = () => { const r = L.result?.r; if (!r) return; const keys = Object.keys(r), n = r[keys[0]].length;
  const csv = keys.join(',') + '\n' + Array.from({ length: n }, (_, i) => keys.map(k => r[k][i]).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'results.csv'; a.click(); };

// ---------- files ----------
function load(data, analysis, notes) { L.sch = structuredClone(data); L.sel = null; L.result = null; L.analysis = analysis || null; if (analysis) $('kind').value = analysis.kind; params();
  if (analysis?.kind === 'tran') $('aT').value = analysis.tstop; if (analysis?.kind === 'ac') { $('aF1').value = analysis.fstart; $('aF2').value = analysis.fstop; $('aP').value = analysis.ppd; }
  if (analysis?.kind === 'dc') { $('aS').value = analysis.source; $('aD1').value = analysis.from; $('aD2').value = analysis.to; $('aD3').value = analysis.step; }
  $('note').hidden = !notes; $('note').innerHTML = notes ? '💡 ' + notes : ''; $('results').hidden = true; save(); draw(); props(); }
$('tpl').onchange = e => { const t = LAB_TEMPLATES[e.target.value]; if (t) { load(t.sch, t.analysis, t.notes); run(); } e.target.value = ''; };
$('bNew').onclick = () => { if (confirm('Start an empty schematic?')) load({ comps: [], wires: [] }); };
$('bSave').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(L.sch, null, 1)], { type: 'application/json' })); a.download = 'schematic.json'; a.click(); };
$('fOpen').onchange = async e => { try { load(JSON.parse(await e.target.files[0].text())); } catch { alert('Not a valid schematic file.'); } };
function save() { try { localStorage.setItem('ccbb.lab', JSON.stringify(L.sch)); } catch {} }
window.lab = { L, load, run, LAB_TEMPLATES };
let saved = null; try { saved = JSON.parse(localStorage.getItem('ccbb.lab')); } catch {}
const q = new URLSearchParams(location.search).get('t');
if (q && LAB_TEMPLATES[q]) { const t = LAB_TEMPLATES[q]; load(t.sch, t.analysis, t.notes); run(); } else if (saved?.comps?.length) load(saved); else { const t = LAB_TEMPLATES.rclow; load(t.sch, t.analysis, t.notes); }
document.body.dataset.ready = 1;
