import { simulate, fmt, PIN_LIST, PWM } from '../engine/circuit.js';
import { createRunner } from '../engine/arduino.js';
import { CATALOG, BY_TYPE, PROJECTS } from './catalog.js';

const $ = id => document.getElementById(id);
const S = { parts: [], wires: [], selected: null, pending: null, io: { pins: {} }, sim: null, runner: null, nextId: 1 };
const els = new Map(); // part id -> {host, el}

// ---------------- palette ----------------
(function buildPalette() {
  let html = '', group = '';
  for (const c of CATALOG) {
    if (c.group !== group) { group = c.group; html += `<h5>${group}</h5>`; }
    html += `<button class="pal" data-type="${c.type}" title="${c.desc}"><span class="th"><${c.tag}></${c.tag}></span><span>${c.name}<small>${c.desc.split('·')[0]}</small></span></button>`;
  }
  $('palette').innerHTML = html;
  $('palette').onclick = e => { const b = e.target.closest('.pal'); if (b) { const sc = $('scroll');
    const n = S.parts.length; addPart(b.dataset.type, sc.scrollLeft + 60 + (n % 4) * 190, sc.scrollTop + 70 + (Math.floor(n / 4) % 3) * 230, null, true); } };
  $('projects').innerHTML += Object.entries(PROJECTS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join('');
})();

// ---------------- parts ----------------
function addPart(type, x, y, props, select) {
  const c = BY_TYPE[type]; const id = type + (S.nextId++);
  const p = { id, type, x: Math.round(x), y: Math.round(y), props: structuredClone(props || c.props) };
  S.parts.push(p); mountPart(p); if (select) selectThing({ part: id }); changed(); return p;
}
function mountPart(p) {
  const c = BY_TYPE[p.type], host = document.createElement('div');
  host.className = 'part'; host.dataset.id = p.id; host.style.left = p.x + 'px'; host.style.top = p.y + 'px';
  host.innerHTML = `<span class="tag">${c.name}${p.type === 'resistor' ? ' ' + fmt(p.props.ohms, 'Ω').replace('.00', '') : ''}</span><${c.tag}></${c.tag}>`;
  $('parts').appendChild(host);
  const el = host.lastElementChild; els.set(p.id, { host, el });
  applyProps(p);
  // interactive parts
  if (p.type === 'pushbutton') {
    el.addEventListener('button-press', () => { p.props.pressed = true; changed(); });
    el.addEventListener('button-release', () => { p.props.pressed = false; changed(); });
  }
  if (p.type === 'switch') el.addEventListener('input', () => { p.props.on = !!el.value; changed(); });
  if (p.type === 'pot') el.addEventListener('input', () => { p.props.pos = (el.value - (el.min ?? 0)) / ((el.max ?? 100) - (el.min ?? 0)) * 100; changed(); refreshProps(); });
  host.addEventListener('pointerdown', e => {
    const interactive = ['pushbutton', 'switch', 'pot'].includes(p.type) && !e.target.classList.contains('tag');
    selectThing({ part: p.id });
    if (!interactive) startDrag(e, p);
  });
}
function applyProps(p) {
  const { el, host } = els.get(p.id);
  if (p.type === 'resistor') { el.value = String(p.props.ohms); host.querySelector('.tag').textContent = 'Resistor ' + fmt(p.props.ohms, 'Ω').replace('.00', ''); }
  if (p.type === 'led') el.color = p.props.color;
  if (p.type === 'switch') el.value = p.props.on ? 1 : 0;
  if (p.type === 'pot') el.value = (el.min ?? 0) + (p.props.pos / 100) * ((el.max ?? 100) - (el.min ?? 0));
  if (p.type === 'meter') el.mode = p.props.mode;
  if (p.type === 'battery') { el.volts = p.props.volts; el.render?.(); }
  if (p.type === 'uno') el.ledPower = true;
  host.classList.toggle('burnt', !!p.props.burnt);
}
function startDrag(e, p) {
  const sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y; let moved = false;
  const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 3) return; moved = true;
    p.x = Math.max(0, ox + dx); p.y = Math.max(30, oy + dy); const h = els.get(p.id).host; h.style.left = p.x + 'px'; h.style.top = p.y + 'px'; drawWires(); drawPins(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) save(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
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
  const sc = r.el.offsetWidth ? b.width / r.el.offsetWidth : 1;
  return [b.left - w.left + info.x * sc, b.top - w.top + info.y * sc];
}
const isGnd = k => /:(GND[.\d]*|-|COM)$/.test(k), isPwr = k => /:(5V|3\.3V|\+|VCC|VIN)$/.test(k);
const PALETTE = ['#2f5bea', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777'];
const wireColor = (w, i) => isGnd(w.from) || isGnd(w.to) ? '#2b2f36' : isPwr(w.from) || isPwr(w.to) ? '#dc2626' : PALETTE[i % PALETTE.length];
function wirePath(a, b) { const dy = Math.max(40, Math.abs(b[0] - a[0]) * .25);
  const up = (a[1] + b[1]) / 2 > Math.min(a[1], b[1]) ? -1 : 1;
  return `M${a[0]},${a[1]} C${a[0]},${a[1] + up * dy} ${b[0]},${b[1] + up * dy} ${b[0]},${b[1]}`; }

// ---------------- drawing ----------------
let flowOffset = 0;
function drawWires() {
  const svg = $('wires');
  svg.innerHTML = S.wires.map((w, i) => { const a = pinPos(w.from), b = pinPos(w.to); if (!a || !b) return '';
    const d = wirePath(a, b), sel = S.selected?.wire === i ? ' sel' : '';
    return `<path class="wire${sel}" data-i="${i}" d="${d}" stroke="${wireColor(w, i)}"/><path class="flow" data-f="${i}" d="${d}"/>`; }).join('')
    + (S.pending?.mouse ? (() => { const a = pinPos(S.pending.from); return a ? `<path class="ghost" d="M${a[0]},${a[1]} L${S.pending.mouse[0]},${S.pending.mouse[1]}"/>` : ''; })() : '');
}
function drawPins() {
  let h = '';
  for (const p of S.parts) for (const pin of PIN_LIST[p.type] || []) {
    if (p.type === 'uno' && ['A5.2', 'A4.2', 'AREF', 'IOREF', 'RESET'].includes(pin)) continue;
    const k = p.id + ':' + pin, xy = pinPos(k); if (!xy) continue;
    h += `<circle class="pin${S.pending?.from === k ? ' armed' : ''}" data-k="${k}" cx="${xy[0]}" cy="${xy[1]}" r="4"/>`;
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
  const w = $('world').getBoundingClientRect(), x = e.clientX - w.left, y = e.clientY - w.top;
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
  if (e.key === 'Escape') { S.pending = null; drawWires(); drawPins(); }
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
  if (p.type === 'resistor') f += `<label>Resistance <select id="pOhm">${[10, 100, 220, 330, 470, 1000, 2000, 4700, 10000, 47000, 100000, 1000000].map(v => `<option value="${v}" ${v == p.props.ohms ? 'selected' : ''}>${fmt(v, 'Ω').replace('.00', '')}</option>`).join('')}</select></label>`;
  if (p.type === 'led') f += `<label>Colour <select id="pCol">${['red', 'yellow', 'green', 'blue', 'white'].map(v => `<option ${v == p.props.color ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${p.props.burnt ? '<button class="btn" id="pFix">Replace burnt LED</button>' : ''}`;
  if (p.type === 'battery') f += `<label>Voltage <select id="pV">${[1.5, 3, 3.7, 5, 9, 12].map(v => `<option ${v == p.props.volts ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (p.type === 'pot') f += `<label>Knob <input id="pPos" type="range" min="0" max="100" value="${p.props.pos}"></label>`;
  if (p.type === 'switch') f += `<label>Position <button class="btn" id="pSw">${p.props.on ? 'ON (2–3)' : 'OFF (1–2)'}</button></label>`;
  if (p.type === 'pushbutton') f += `<div class="mut">Click and hold the button on the board to press it.</div>`;
  if (p.type === 'meter') f += `<label>Mode <select id="pMode">${[['V', 'Volts (V⎓)'], ['A', 'Amps (in series!)'], ['Ω', 'Ohms (power off)']].map(([v, l]) => `<option value="${v}" ${v == p.props.mode ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="mut">Red probe = V/Ω/A, black = COM.</div>`;
  const live = [];
  if (r.current !== undefined) live.push(['Current', fmt(Math.abs(r.current), 'A')]);
  if (r.power !== undefined) live.push(['Power', fmt(r.power, 'W') + ' / 0.25 W']);
  if (r.brightness !== undefined) live.push(['Brightness', Math.round(r.brightness * 100) + ' %']);
  if (r.reading !== undefined) live.push(['Reading', r.reading]);
  box.innerHTML = `<h4>${c.name}</h4><div class="mut">${c.desc}</div>${f}<div class="kv">${live.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><p><button class="btn" id="pDel">Delete part</button></p>`;
  const on = (id, fn) => { const x = $(id); if (x) x.onchange = x.oninput = fn; };
  on('pOhm', e => { p.props.ohms = +e.target.value; applyProps(p); changed(); });
  on('pCol', e => { p.props.color = e.target.value; applyProps(p); changed(); });
  on('pV', e => { p.props.volts = +e.target.value; applyProps(p); changed(); });
  on('pPos', e => { p.props.pos = +e.target.value; applyProps(p); changed(); });
  on('pMode', e => { p.props.mode = e.target.value; applyProps(p); changed(); });
  if ($('pSw')) $('pSw').onclick = () => { p.props.on = !p.props.on; applyProps(p); changed(); refreshProps(); };
  if ($('pFix')) $('pFix').onclick = () => { p.props.burnt = false; applyProps(p); changed(); refreshProps(); };
  $('pDel').onclick = () => removePart(p.id);
}

// ---------------- simulation ----------------
let queued = false;
function changed() { save(); if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; runSim(); drawWires(); drawPins(); }); } }
function runSim() {
  S.sim = simulate(S.parts, S.wires, S.io);
  let reburn = false;
  for (const p of S.parts) { const r = S.sim.parts[p.id] || {}, { el } = els.get(p.id);
    if (p.type === 'led') { if (r.burn && !p.props.burnt) { p.props.burnt = true; reburn = true; applyProps(p); }
      el.value = (r.brightness || 0) > 0.01; el.brightness = Math.min(1, 0.15 + (r.brightness || 0)); }
    if (p.type === 'buzzer') el.hasSignal = !!r.on;
    if (p.type === 'meter') el.reading = r.reading ?? '';
    if (p.type === 'uno') { const v = S.io.pins['13']; el.led13 = !!(v && v.mode === 'OUTPUT' && v.v > 2.5); }
  }
  if (reburn) { const keep = S.sim.warnings; S.sim = simulate(S.parts, S.wires, S.io); S.sim.warnings = [...keep.filter(w => /burnt out!/.test(w.text)), ...S.sim.warnings.filter(w => !/burnt out\. Real/.test(w.text))]; }
  const w = S.sim.warnings;
  $('warns').innerHTML = `<h4>Circuit check</h4>` + (w.length ? w.map(x => `<div class="warn ${x.level}" data-p="${x.part}">${x.level === 'bad' ? '⛔' : '⚠️'} ${x.text}</div>`).join('') : `<div class="okmsg">✔ No problems found${S.parts.length ? '' : '. Add some parts to begin.'}</div>`);
  if (S.selected) refreshPropsLive();
}
let propsTimer = 0; function refreshPropsLive() { const now = performance.now(); if (now - propsTimer > 150 && !document.activeElement?.closest?.('#props')) { propsTimer = now; refreshProps(); } }
$('warns').addEventListener('click', e => { const p = e.target.closest('.warn')?.dataset.p; if (p) selectThing({ part: p }); });
(function animate() {
  flowOffset -= 1;
  if (S.sim) for (const path of document.querySelectorAll('.flow')) {
    const w = S.wires[path.dataset.f]; if (!w) continue;
    const I = Math.max(S.sim.pinCurrent[w.from] || 0, S.sim.pinCurrent[w.to] || 0);
    if (I < 2e-4) { path.style.opacity = 0; continue; }
    path.style.opacity = Math.min(1, 0.35 + I * 40);
    path.style.strokeDashoffset = flowOffset * Math.min(3, 0.4 + Math.log10(I / 2e-4));
  }
  requestAnimationFrame(animate);
})();

// ---------------- Arduino runner ----------------
const unoId = () => S.parts.find(p => p.type === 'uno')?.id;
const io = {
  pinMode(pin, mode) { S.io.pins[pin] = { mode, v: 0 }; runSim(); },
  digitalWrite(pin, v) { const s = S.io.pins[pin] || { mode: 'INPUT' };
    if (s.mode !== 'OUTPUT') { if (v) S.io.pins[pin] = { mode: 'INPUT_PULLUP' }; else S.io.pins[pin] = { mode: 'INPUT' }; }
    else S.io.pins[pin] = { mode: 'OUTPUT', v: v ? 5 : 0 }; runSim(); },
  analogWrite(pin, val) { const pwm = PWM.includes(pin);
    S.io.pins[pin] = { mode: 'OUTPUT', v: pwm ? val / 255 * 5 : (val >= 128 ? 5 : 0) };
    if (!pwm && !warnedPwm.has(pin)) { warnedPwm.add(pin); serial(`[sim] Pin ${pin} has no PWM (~). analogWrite acts like on/off. Use 3, 5, 6, 9, 10 or 11.\n`); } runSim(); },
  digitalRead(pin) { const id = unoId(); return id && S.sim ? (S.sim.voltAt(id, pin) > 2.5 ? 1 : 0) : 0; },
  analogRead(pin) { const id = unoId(); return id && S.sim ? Math.max(0, Math.min(1023, Math.round(S.sim.voltAt(id, pin) / 5 * 1023))) : 0; },
  serial: t => serial(t), tone: (pin) => { io.digitalWrite(pin, 1); }, noTone: pin => io.digitalWrite(pin, 0),
};
const warnedPwm = new Set();
let serialBuf = '';
function serial(t) { serialBuf = (serialBuf + t).slice(-6000); const s = $('serial'); s.textContent = serialBuf; s.scrollTop = 1e9; }
$('btnClear').onclick = () => { serialBuf = ''; $('serial').textContent = ''; };
$('btnRun').onclick = async () => {
  stopCode(); $('err').hidden = true;
  if (!unoId()) { showErr('Add an Arduino Uno to the board first: your code runs on it.'); return; }
  S.io.pins = {}; warnedPwm.clear(); serial('');
  const r = S.runner = createRunner(io);
  try { r.compile($('src').value); } catch (e) { showErr('Code error: ' + e.message + '\nTip: check brackets { } and semicolons ;'); return; }
  setRunning(true);
  try { await r.run($('src').value); } catch (e) { showErr('Runtime error: ' + e.message); }
  if (S.runner === r) setRunning(false);
};
$('btnStop').onclick = () => stopCode();
function stopCode() { if (S.runner) { S.runner.stop(); S.runner = null; } S.io.pins = {}; setRunning(false); changed(); }
function setRunning(on) { $('btnRun').disabled = on; $('btnStop').disabled = !on; const p = $('simState'); p.textContent = on ? '● Running code' : '● Live'; p.classList.toggle('run', on); }
function showErr(t) { const e = $('err'); e.textContent = t; e.hidden = false; }

// ---------------- code from circuit (rule-based helper) ----------------
$('btnAuto').onclick = () => {
  const id = unoId(); if (!id) { showErr('Add an Arduino Uno and wire some parts first.'); return; }
  const sim = simulate(S.parts, S.wires, {}), node = k => sim.net.node(k);
  const unoPins = ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  const pinAt = n => unoPins.find(pn => node(id + ':' + pn) === n);
  const viaResistor = n => { for (const r of S.parts.filter(p => p.type === 'resistor')) { const a = node(r.id + ':1'), b = node(r.id + ':2');
    if (a === n && pinAt(b)) return pinAt(b); if (b === n && pinAt(a)) return pinAt(a); } return null; };
  const leds = S.parts.filter(p => p.type === 'led').map(p => pinAt(node(p.id + ':A')) || viaResistor(node(p.id + ':A'))).filter(Boolean);
  const btns = S.parts.filter(p => p.type === 'pushbutton').map(p => pinAt(node(p.id + ':1.l')) || pinAt(node(p.id + ':2.l'))).filter(Boolean);
  const pots = S.parts.filter(p => p.type === 'pot').map(p => pinAt(node(p.id + ':SIG'))).filter(Boolean);
  const buz = S.parts.filter(p => p.type === 'buzzer').map(p => pinAt(node(p.id + ':1')) || pinAt(node(p.id + ':2'))).filter(Boolean);
  if (!leds.length && !buz.length) { showErr('I could not find an LED or buzzer connected to an Arduino pin. Wire one (through a resistor) and try again.'); return; }
  let c = `// Generated from your wiring: ${[...leds.map(p => 'LED on ' + p), ...btns.map(p => 'button on ' + p), ...pots.map(p => 'knob on ' + p), ...buz.map(p => 'buzzer on ' + p)].join(', ')}\n`;
  const outs = [...leds, ...buz];
  c += `\nvoid setup() {\n  Serial.begin(9600);\n${outs.map(p => `  pinMode(${p}, OUTPUT);\n`).join('')}${btns.map(p => `  pinMode(${p}, INPUT_PULLUP);  // pressed = LOW\n`).join('')}}\n\nvoid loop() {\n`;
  if (pots.length && leds.some(p => PWM.includes(p))) { const L = leds.find(p => PWM.includes(p));
    c += `  int knob = analogRead(${pots[0]});\n  analogWrite(${L}, map(knob, 0, 1023, 0, 255));\n  Serial.println(knob);\n  delay(100);\n`; }
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
function load(data) {
  stopCode(); for (const r of els.values()) r.host.remove(); els.clear();
  S.parts = structuredClone(data.parts || []); S.wires = structuredClone(data.wires || []);
  S.nextId = 1 + Math.max(0, ...S.parts.map(p => +(p.id.match(/\d+$/)?.[0] || 0)));
  S.parts.forEach(mountPart); $('src').value = data.code || ''; gutter(); selectThing(null);
  customElements.whenDefined('wokwi-arduino-uno').then(() => { requestAnimationFrame(() => changed()); setTimeout(() => { drawWires(); drawPins(); }, 250); });
}
$('projects').onchange = e => { if (e.target.value) load(PROJECTS[e.target.value]); e.target.value = ''; };
$('btnNew').onclick = () => { if (confirm('Start a new empty circuit?')) load({ parts: [], wires: [], code: 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n' }); };
$('btnExport').onclick = () => { const b = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'circuit.json'; a.click(); };
$('fileIn').onchange = async e => { const f = e.target.files[0]; if (f) { try { load(JSON.parse(await f.text())); } catch { alert('That file is not a valid circuit.'); } } };
const snapshot = () => ({ version: 1, parts: S.parts, wires: S.wires, code: $('src').value });
function save() { try { localStorage.setItem('ccbb.circuit', JSON.stringify(snapshot())); } catch {} }
addEventListener('resize', () => { drawWires(); drawPins(); });

// expose for tests / power users
window.ccbb = { S, load, addPart, connect: (from, to) => { S.wires.push({ from, to }); changed(); }, simNow: () => (runSim(), S.sim), pinPos, PROJECTS };

let initial = null; try { initial = JSON.parse(localStorage.getItem('ccbb.circuit')); } catch {}
const q = new URLSearchParams(location.search).get('project');
load(q && PROJECTS[q] ? PROJECTS[q] : initial?.parts?.length ? initial : PROJECTS.blink);
