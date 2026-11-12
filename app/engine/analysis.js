// Circuit Lab analysis engine: schematic → netlist → DC operating point, transient, AC sweep (Bode) and DC sweep.
// Schematic: { comps: [{ id, type, x, y, rot, props }], wires: [{ pts: [[x, y], ...] }] } on a 20 px grid.
import { solve, ledParams, SILICON, DEVICES } from './solver.js';

// ---------- symbols: pin positions at rot = 0 (relative to the component origin) ----------
export const SYMBOLS = {
  res: { pins: [[0, 0, '1'], [60, 0, '2']], label: 'R', two: true },
  cap: { pins: [[0, 0, '1'], [60, 0, '2']], label: 'C', two: true },
  ind: { pins: [[0, 0, '1'], [60, 0, '2']], label: 'L', two: true },
  diode: { pins: [[0, 0, 'A'], [60, 0, 'K']], label: 'D', two: true },
  led: { pins: [[0, 0, 'A'], [60, 0, 'K']], label: 'LED', two: true },
  zener: { pins: [[0, 0, 'A'], [60, 0, 'K']], label: 'DZ', two: true },
  switch: { pins: [[0, 0, '1'], [60, 0, '2']], label: 'S', two: true },
  vdc: { pins: [[0, 0, '+'], [0, 60, '-']], label: 'V', two: true },
  vsin: { pins: [[0, 0, '+'], [0, 60, '-']], label: 'Vsin', two: true },
  vpulse: { pins: [[0, 0, '+'], [0, 60, '-']], label: 'Vsq', two: true },
  vtri: { pins: [[0, 0, '+'], [0, 60, '-']], label: 'Vtri', two: true },
  idc: { pins: [[0, 0, '+'], [0, 60, '-']], label: 'I', two: true },
  gnd: { pins: [[0, 0, 'G']], label: 'GND' },
  probe: { pins: [[0, 0, 'P']], label: 'Probe' },
  npn: { pins: [[0, 20, 'B'], [40, 0, 'C'], [40, 40, 'E']], label: 'Q' },
  pnp: { pins: [[0, 20, 'B'], [40, 0, 'C'], [40, 40, 'E']], label: 'Q' },
  nmos: { pins: [[0, 20, 'G'], [40, 0, 'D'], [40, 40, 'S']], label: 'M' },
  opamp: { pins: [[0, 0, '-'], [0, 40, '+'], [80, 20, 'OUT']], label: 'U' },
  lm358: { pins: [[0, 0, '-'], [0, 40, '+'], [80, 20, 'OUT'], [40, -20, 'V+'], [40, 60, 'V-']], label: 'U' },
};
export const DEFAULTS = {
  res: { R: 1000 }, cap: { C: 1e-6 }, ind: { L: 1e-3 }, diode: {}, led: { color: 'red' }, zener: { vz: 5.1 }, switch: { closed: true },
  vdc: { V: 5 }, vsin: { offset: 0, amp: 1, freq: 1000, ac: 1 }, vpulse: { low: 0, high: 5, freq: 1000, duty: 50 }, vtri: { low: -1, high: 1, freq: 1000 }, idc: { I: 0.001 },
  gnd: {}, probe: { name: 'Vout' }, npn: { beta: 200 }, pnp: { beta: 200 }, nmos: {}, opamp: {}, lm358: {},
};
export function pinXY(c) {
  const r = ((c.rot || 0) % 360 + 360) % 360;
  return SYMBOLS[c.type].pins.map(([dx, dy, name]) => {
    const [x, y] = r === 90 ? [-dy, dx] : r === 180 ? [-dx, -dy] : r === 270 ? [dy, -dx] : [dx, dy];
    return { name, x: c.x + x, y: c.y + y };
  });
}

// Parse engineering values: 10k, 4.7u, 100n, 2.2meg, 1m
export function parseValue(s) {
  if (typeof s === 'number') return s;
  const m = /^\s*(-?[\d.]+(?:e-?\d+)?)\s*(meg|[TGMkmunpfµ])?/i.exec(String(s)); if (!m) return NaN;
  const mult = { T: 1e12, G: 1e9, meg: 1e6, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[m[2] && m[2].toLowerCase() === 'meg' ? 'meg' : m[2]] ?? 1;
  return parseFloat(m[1]) * mult;
}
export function fmtEng(v, unit = '') {
  if (!isFinite(v)) return '—'; const a = Math.abs(v);
  const [d, p] = a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : a >= 1 || a === 0 ? [1, ''] : a >= 1e-3 ? [1e-3, 'm'] : a >= 1e-6 ? [1e-6, 'µ'] : a >= 1e-9 ? [1e-9, 'n'] : [1e-12, 'p'];
  return +(v / d).toPrecision(4) + ' ' + p + unit;
}

// ---------- connectivity ----------
function topology(sch) {
  const parent = new Map(), find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); parent.set(k, r); return r; };
  const union = (a, b) => parent.set(find(a), find(b));
  const key = (x, y) => Math.round(x) + ',' + Math.round(y);
  const pts = [];
  for (const c of sch.comps) for (const p of pinXY(c)) { const k = key(p.x, p.y); find(k); pts.push([p.x, p.y]); if (c.type === 'gnd') union(k, 'GND'); }
  for (const w of sch.wires) for (const [x, y] of w.pts) pts.push([x, y]);
  for (const w of sch.wires) {
    for (let i = 1; i < w.pts.length; i++) {
      const [x1, y1] = w.pts[i - 1], [x2, y2] = w.pts[i]; union(key(x1, y1), key(x2, y2));
      for (const [x, y] of pts) if ((x1 === x2 && x === x1 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) || (y1 === y2 && y === y1 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2))) union(key(x, y), key(x1, y1));
    }
  }
  return { find, key };
}

// ---------- netlist ----------
const sourceValue = (c, t) => { const p = c.props;
  if (c.type === 'vdc') return parseValue(p.V);
  if (c.type === 'vsin') return parseValue(p.offset) + parseValue(p.amp) * Math.sin(2 * Math.PI * parseValue(p.freq) * t);
  if (c.type === 'vpulse') { const T = 1 / parseValue(p.freq), ph = ((t % T) + T) % T / T; return ph < parseValue(p.duty) / 100 ? parseValue(p.high) : parseValue(p.low); }
  if (c.type === 'vtri') { const T = 1 / parseValue(p.freq), ph = ((t % T) + T) % T / T, lo = parseValue(p.low), hi = parseValue(p.high); return ph < 0.5 ? lo + (hi - lo) * ph * 2 : hi - (hi - lo) * (ph - 0.5) * 2; }
  return 0; };

export function buildNetlist(sch, { t = 0, state = {}, override = {} } = {}) {
  const topo = topology(sch), map = new Map(); let n = 1;
  if (topo.find('GND') !== 'GND' || sch.comps.some(c => c.type === 'gnd')) map.set(topo.find('GND'), 0);
  const node = k => { const r = topo.find(k); if (!map.has(r)) map.set(r, n++); return map.get(r); };
  const internal = name => { const r = '#' + name; if (!map.has(r)) map.set(r, n++); return map.get(r); };
  const els = [];
  for (const c of sch.comps) {
    const P = Object.fromEntries(pinXY(c).map(p => [p.name, node(topo.key(p.x, p.y))])), pr = c.props || {}, tag = c.id;
    const v = k => parseValue(override[c.id] ?? pr[k]);
    switch (c.type) {
      case 'res': els.push({ type: 'R', a: P['1'], b: P['2'], r: Math.max(v('R'), 1e-6), tag }); break;
      case 'cap': els.push({ type: 'C', a: P['1'], b: P['2'], c: v('C'), v0: state[c.id] || 0, tag }); break;
      case 'ind': els.push({ type: 'L', a: P['1'], b: P['2'], l: v('L'), i0: state[c.id] || 0, tag }); break;
      case 'switch': els.push({ type: 'R', a: P['1'], b: P['2'], r: pr.closed ? 0.01 : 1e9, tag }); break;
      case 'diode': els.push({ type: 'D', a: P.A, c: P.K, ...SILICON, tag }); break;
      case 'led': els.push({ type: 'D', a: P.A, c: P.K, ...ledParams(pr.color), tag }); break;
      case 'zener': { const z = internal(c.id + ':z'); els.push({ type: 'D', a: P.A, c: P.K, ...SILICON, tag }, { type: 'D', a: P.K, c: z, ...SILICON, tag: tag + ':rev' }, { type: 'S', a: z, b: P.A, v: Math.max(0, v('vz') - 0.62), r: 2, tag: tag + ':vz' }); break; }
      case 'vdc': case 'vsin': case 'vpulse': case 'vtri': els.push({ type: 'S', a: P['+'], b: P['-'], v: override[c.id] !== undefined ? parseValue(override[c.id]) : sourceValue(c, t), r: 1e-3, tag, ac: c.type === 'vsin' ? parseValue(pr.ac ?? 1) : 0 }); break;
      case 'idc': els.push({ type: 'I', a: P['+'], b: P['-'], i: -v('I'), tag }); break;   // pushes current out of + into the circuit
      case 'npn': case 'pnp': els.push({ type: 'Q', c: P.C, b: P.B, e: P.E, pol: c.type === 'npn' ? 1 : -1, is: 1e-14, bf: v('beta') || 200, br: 5, tag }); break;
      case 'nmos': els.push({ type: 'M', d: P.D, g: P.G, s: P.S, pol: 1, vth: 1.5, k: 12, lambda: 0.01, tag }); break;
      case 'opamp': { const vp = internal(c.id + ':vp'), vn = internal(c.id + ':vn');
        els.push({ type: 'S', a: vp, b: 0, v: 15, r: 1e-3, tag: tag + ':rail+' }, { type: 'S', a: vn, b: 0, v: -15, r: 1e-3, tag: tag + ':rail-' },
          { type: 'OA', p: P['+'], n: P['-'], o: P.OUT, vp, vn, a: 1e6, ro: 1, hi: 0, lo: 0, tag }); break; }
      case 'lm358': els.push({ type: 'OA', p: P['+'], n: P['-'], o: P.OUT, vp: P['V+'], vn: P['V-'], a: 1e5, ro: 15, hi: 1.5, lo: 0.02, tag }, { type: 'R', a: P['V+'], b: P['V-'], r: 7000, tag: tag + ':iq' }); break;
    }
  }
  const probes = sch.comps.filter(c => c.type === 'probe').map(c => { const p = pinXY(c)[0]; return { name: c.props?.name || c.id, node: node(topo.key(p.x, p.y)) }; });
  return { nodeCount: Math.max(n, 1), els, probes, hasGround: map.has(topo.find('GND')) && sch.comps.some(c => c.type === 'gnd') };
}
const currentsOf = (els, res) => { const o = {}; els.forEach((e, i) => { if (!String(e.tag).includes(':')) o[e.tag] = res.currents[i]; }); return o; };

// ---------- DC operating point ----------
export function operatingPoint(sch, opts = {}) {
  const net = buildNetlist(sch, opts);
  const res = solve(net.nodeCount, net.els, {});
  return { net, res, V: Object.fromEntries(net.probes.map(p => [p.name, res.V[p.node] ?? 0])), I: currentsOf(net.els, res), converged: res.converged, warnings: checks(sch, net) };
}
function checks(sch, net) {
  const w = [];
  if (!net.hasGround) w.push('Add a ground (GND) symbol: every circuit needs a 0 V reference.');
  if (!net.probes.length) w.push('Add a voltage probe to choose what to plot.');
  return w;
}

// ---------- transient ----------
export function transient(sch, { tstop = 0.01, dt, fromOp = false, maxPoints = 2000 } = {}) {
  dt = dt || tstop / 1000;
  const state = {}, rows = { t: [] }, cur = {};
  if (fromOp) { const op = operatingPoint(sch); for (const e of op.net.els) { if (e.type === 'C') state[e.tag] = (op.res.V[e.a] ?? 0) - (op.res.V[e.b] ?? 0); if (e.type === 'L') state[e.tag] = op.I[e.tag] || 0; } }
  let V0, every = Math.max(1, Math.ceil(tstop / dt / maxPoints));
  const steps = Math.round(tstop / dt);
  for (let k = 0; k <= steps; k++) {
    const t = k * dt, net = buildNetlist(sch, { t, state });
    const res = solve(net.nodeCount, net.els, { dt: k === 0 && !fromOp ? dt : dt, V0 });
    V0 = res.V;
    for (const e of net.els) { if (e.type === 'C') state[e.tag] = (res.V[e.a] ?? 0) - (res.V[e.b] ?? 0); if (e.type === 'L') state[e.tag] = (e.i0 || 0) + dt / e.l * ((res.V[e.a] ?? 0) - (res.V[e.b] ?? 0)); }
    if (k % every === 0) { rows.t.push(t); for (const p of net.probes) (rows[p.name] ??= []).push(res.V[p.node] ?? 0); const I = currentsOf(net.els, res); for (const [id, i] of Object.entries(I)) (cur['I(' + id + ')'] ??= []).push(i); }
  }
  return { ...rows, ...cur };
}

// ---------- AC sweep (small-signal, linearised at the operating point) ----------
function cgauss(A, b) { // complex Gaussian elimination; numbers are [re, im]
  const n = b.length, mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]], sub = (x, y) => [x[0] - y[0], x[1] - y[1]];
  const div = (x, y) => { const d = y[0] * y[0] + y[1] * y[1]; return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]; }, abs = x => Math.hypot(x[0], x[1]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (abs(A[i][k]) > abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]]; if (abs(A[k][k]) < 1e-30) continue;
    for (let i = k + 1; i < n; i++) { const f = div(A[i][k], A[k][k]); if (!f[0] && !f[1]) continue; for (let j = k; j < n; j++) A[i][j] = sub(A[i][j], mul(f, A[k][j])); b[i] = sub(b[i], mul(f, b[k])); }
  }
  const x = Array.from({ length: n }, () => [0, 0]);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s = sub(s, mul(A[i][j], x[j])); x[i] = abs(A[i][i]) < 1e-30 ? [0, 0] : div(s, A[i][i]); }
  return x;
}
export function acSweep(sch, { fstart = 10, fstop = 1e6, ppd = 20 } = {}) {
  const op = operatingPoint(sch, { t: 0 }), { net, res } = op, V = res.V, N = net.nodeCount - 1;
  const freqs = [], out = { f: freqs };
  for (let k = 0, d = Math.log10(fstop / fstart) * ppd; k <= d; k++) freqs.push(fstart * Math.pow(10, k / ppd));
  for (const f of freqs) {
    const w = 2 * Math.PI * f, A = Array.from({ length: N }, () => Array.from({ length: N }, () => [0, 0])), b = Array.from({ length: N }, () => [0, 0]);
    const Y = (a, c, y) => { const add = (i, j, s) => { if (i > 0 && j > 0) { A[i - 1][j - 1][0] += s * y[0]; A[i - 1][j - 1][1] += s * y[1]; } }; add(a, a, 1); add(c, c, 1); add(a, c, -1); add(c, a, -1); };
    for (let k = 0; k < N; k++) A[k][k][0] += 1e-12;
    for (const e of net.els) {
      if (e.type === 'R') Y(e.a, e.b, [1 / e.r, 0]);
      else if (e.type === 'S') { Y(e.a, e.b, [1 / e.r, 0]); if (e.ac) { if (e.a > 0) b[e.a - 1][0] += e.ac / e.r; if (e.b > 0) b[e.b - 1][0] -= e.ac / e.r; } }
      else if (e.type === 'C') Y(e.a, e.b, [0, w * e.c]);
      else if (e.type === 'L') Y(e.a, e.b, [0, -1 / (w * e.l)]);
      else if (e.type === 'OA') { const g = 1 / e.ro; if (e.o > 0) { A[e.o - 1][e.o - 1][0] += g; if (e._mode === 'lin') { if (e.p > 0) A[e.o - 1][e.p - 1][0] -= g * e.a; if (e.n > 0) A[e.o - 1][e.n - 1][0] += g * e.a; } } }
      else if (DEVICES[e.type]) { const d = DEVICES[e.type], nodes = d.t.map(t => e[t]), v = nodes.map(n => V[n] ?? 0), I0 = d.f(e, v), h = 1e-6;
        for (let j = 0; j < nodes.length; j++) { const vj = v.slice(); vj[j] += h; const I1 = d.f(e, vj);
          for (let k = 0; k < nodes.length; k++) if (nodes[k] > 0 && nodes[j] > 0) A[nodes[k] - 1][nodes[j] - 1][0] += (I1[k] - I0[k]) / h; } }
    }
    const x = [[0, 0], ...cgauss(A, b)];
    for (const p of net.probes) { const z = x[p.node] || [0, 0]; (out[p.name + ' dB'] ??= []).push(20 * Math.log10(Math.max(Math.hypot(z[0], z[1]), 1e-12))); (out[p.name + ' °'] ??= []).push(Math.atan2(z[1], z[0]) * 180 / Math.PI); }
  }
  return out;
}

// ---------- DC sweep ----------
export function dcSweep(sch, { source, from = 0, to = 5, step = 0.05 } = {}) {
  const out = { x: [] }; let V0;
  for (let v = from; v <= to + step / 2; v += step) {
    const net = buildNetlist(sch, { override: { [source]: v } }), res = solve(net.nodeCount, net.els, { V0 }); V0 = res.V;
    out.x.push(+v.toFixed(9)); for (const p of net.probes) (out[p.name] ??= []).push(res.V[p.node] ?? 0);
    for (const [id, i] of Object.entries(currentsOf(net.els, res))) (out['I(' + id + ')'] ??= []).push(i);
  }
  return out;
}

// ---------- measurements ----------
export function measureAC(f, db) {
  const max = Math.max(...db), i = db.indexOf(max); let f3 = null;
  for (let k = i + 1; k < db.length; k++) if (db[k] <= max - 3) { const t = (max - 3 - db[k - 1]) / (db[k] - db[k - 1]); f3 = Math.pow(10, Math.log10(f[k - 1]) + t * (Math.log10(f[k]) - Math.log10(f[k - 1]))); break; }
  let f3lo = null; for (let k = i - 1; k >= 0; k--) if (db[k] <= max - 3) { const t = (max - 3 - db[k + 1]) / (db[k] - db[k + 1]); f3lo = Math.pow(10, Math.log10(f[k + 1]) + t * (Math.log10(f[k]) - Math.log10(f[k + 1]))); break; }
  return { maxDb: max, fPeak: f[i], f3dbHigh: f3, f3dbLow: f3lo };
}
export function measureWave(t, y) {
  // skip the first 20 % (start-up), then average over whole periods so Avg/RMS are not biased by a partial cycle
  const n = y.length, s0 = Math.floor(n * 0.2), part = y.slice(s0), mx = Math.max(...part), mn = Math.min(...part), mid = (mx + mn) / 2, ups = [];
  for (let i = s0 + 1; i < n; i++) if (y[i - 1] < mid && y[i] >= mid) ups.push(i);
  const [a, b] = ups.length > 1 ? [ups[0], ups.at(-1)] : [s0, n], seg = y.slice(a, b);
  const avg = seg.reduce((p, q) => p + q, 0) / seg.length, rms = Math.sqrt(seg.reduce((p, q) => p + q * q, 0) / seg.length);
  return { max: mx, min: mn, vpp: mx - mn, avg, rms, freq: ups.length > 1 ? (ups.length - 1) / (t[ups.at(-1)] - t[ups[0]]) : null };
}
