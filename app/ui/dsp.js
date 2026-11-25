// Signals, DSP & Control Lab: pick an experiment, set parameters, see plots and MATLAB-style numbers.
// Optional: run the equivalent NumPy/SciPy code in the browser with Pyodide.
import { DSP_TEMPLATES } from './dsp-templates.js';

const $ = id => document.getElementById(id);
const S = { key: null, P: {}, result: null };
const COLORS = ['#2f5bea', '#dc2626', '#0f9d8f', '#f59e0b', '#7c3aed'];

// ---------- experiment list ----------
function buildList() { const groups = {};
  for (const [k, t] of Object.entries(DSP_TEMPLATES)) (groups[t.group] ??= []).push([k, t]);
  $('exps').innerHTML = Object.entries(groups).map(([g, items]) => `<h5>${g}</h5>` + items.map(([k, t], i) => `<button data-k="${k}">${i + 1}. ${t.name}</button>`).join('')).join('');
  for (const b of $('exps').querySelectorAll('button')) b.onclick = () => select(b.dataset.k); }

function select(key) { const t = DSP_TEMPLATES[key]; if (!t) return; S.key = key; S.P = Object.fromEntries(t.params.map(p => [p.key, p.value]));
  for (const b of $('exps').querySelectorAll('button')) b.classList.toggle('on', b.dataset.k === key);
  $('eTitle').textContent = t.name; $('eGroup').textContent = t.group; history.replaceState(null, '', '?e=' + key);
  $('params').innerHTML = t.params.map(p => `<label>${p.label}${p.options ? `<select data-k="${p.key}">${p.options.map(o => `<option ${o === p.value ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input data-k="${p.key}" class="${p.list ? 'wide' : ''}" value="${p.value}" ${p.list ? '' : 'inputmode="decimal"'}>`}</label>`).join('') + '<button class="btn run" type="submit">▶ Run</button>';
  for (const el of $('params').querySelectorAll('[data-k]')) el.onchange = () => { read(); run(); };
  $('params').onsubmit = e => { e.preventDefault(); read(); run(); }; run(); }

function read() { const t = DSP_TEMPLATES[S.key];
  for (const p of t.params) { const el = $('params').querySelector(`[data-k="${p.key}"]`); if (!el) continue; const v = el.value.trim();
    S.P[p.key] = p.options || p.list ? v : (Number.isFinite(+v) && v !== '' ? +v : p.value); } }

function run() { const t = DSP_TEMPLATES[S.key];
  try { S.result = t.run({ ...S.P }); } catch (e) { $('plots').innerHTML = `<p class="warn">Could not compute: ${e.message}. Check the inputs (lists are numbers separated by spaces).</p>`; $('rtab').innerHTML = ''; return; }
  $('plots').innerHTML = S.result.plots.map((p, i) => `<figure><figcaption>${p.title}</figcaption><canvas id="pl${i}" width="900" height="520"></canvas></figure>`).join('');
  S.result.plots.forEach((p, i) => draw($('pl' + i), p));
  $('rtab').innerHTML = S.result.table.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  $('pyCode').value = t.py({ ...S.P }); window.dspResult = S.result; }

// ---------- plotting ----------
const nice = (lo, hi, n = 6) => { const span = hi - lo || 1, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= step0);
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 * step; v += step) out.push(+v.toPrecision(10)); return out; };
const fmt = v => Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(1) : +v.toPrecision(4) + '';
function draw(cv, p) { const g = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 70, r: 20, t: 16, b: 52 };
  g.clearRect(0, 0, W, H); g.font = '20px Inter, system-ui, sans-serif'; g.lineJoin = 'round';
  let xs = [], ys = [], series = [];
  if (p.kind === 'pz' || p.kind === 'locus') {   // s-plane / z-plane
    const pts = [...(p.poles || []), ...(p.zeros || []), ...(p.loc || []).flatMap(l => l.poles)], R = Math.max(1.2, ...pts.map(z => Math.max(Math.abs(z[0]), Math.abs(z[1])) * 1.15));
    xs = p.splane || p.kind === 'locus' ? [Math.min(-R, ...pts.map(z => z[0] * 1.15)), Math.max(R * 0.4, ...pts.map(z => z[0] * 1.15))] : [-R, R]; ys = [-R, R]; }
  else { series = p.series.map((s, i) => ({ ...s, x: s.x || p.x, c: s.faint ? '#94a3b8' : COLORS[i % COLORS.length] }));
    for (const s of series) s.y.forEach((v, i) => { if (Number.isFinite(v)) { ys.push(v); xs.push(s.x[i]); } });
    if (p.hline !== undefined) ys.push(p.hline); if (series.some(s => s.stem)) ys.push(0); }
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; } const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  if (series.some(s => s.stem)) { const pd = (x1 - x0 || 1) * 0.04; x0 -= pd; x1 += pd; }
  if (p.kind === 'pz' || p.kind === 'locus') { const sx = (x1 - x0) / (W - m.l - m.r), sy = (y1 - y0) / (H - m.t - m.b), k = Math.max(sx, sy);   // equal scale on both axes
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - k * (W - m.l - m.r) / 2; x1 = cx + k * (W - m.l - m.r) / 2; y0 = cy - k * (H - m.t - m.b) / 2; y1 = cy + k * (H - m.t - m.b) / 2; }
  const lx = v => p.logx ? Math.log10(v) : v, X = v => m.l + (lx(v) - lx(x0)) / (lx(x1) - lx(x0) || 1) * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  // grid + axes
  g.strokeStyle = '#e5e7eb'; g.fillStyle = '#6b7385'; g.lineWidth = 1;
  const xt = p.logx ? Array.from({ length: Math.floor(Math.log10(x1)) - Math.ceil(Math.log10(x0)) + 1 }, (_, i) => 10 ** (Math.ceil(Math.log10(x0)) + i)) : nice(x0, x1);
  for (const v of xt) { g.beginPath(); g.moveTo(X(v), m.t); g.lineTo(X(v), H - m.b); g.stroke(); g.textAlign = 'center'; g.fillText(fmt(v), X(v), H - m.b + 24); }
  for (const v of nice(y0, y1, 5)) { g.beginPath(); g.moveTo(m.l, Y(v)); g.lineTo(W - m.r, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(fmt(v), m.l - 8, Y(v) + 6); }
  g.strokeStyle = '#64748b'; g.strokeRect(m.l, m.t, W - m.l - m.r, H - m.t - m.b);
  if (y0 < 0 && y1 > 0) { g.beginPath(); g.moveTo(m.l, Y(0)); g.lineTo(W - m.r, Y(0)); g.stroke(); }
  g.textAlign = 'center'; g.fillStyle = '#1c2230'; if (p.xl) g.fillText(p.xl, (m.l + W - m.r) / 2, H - 8);
  if (p.yl) { g.save(); g.translate(18, (m.t + H - m.b) / 2); g.rotate(-Math.PI / 2); g.fillText(p.yl, 0, 0); g.restore(); }
  if (p.hline !== undefined) { g.setLineDash([8, 6]); g.strokeStyle = '#dc2626'; g.beginPath(); g.moveTo(m.l, Y(p.hline)); g.lineTo(W - m.r, Y(p.hline)); g.stroke(); g.setLineDash([]); }
  if (p.kind === 'pz' || p.kind === 'locus') {
    g.strokeStyle = '#94a3b8'; g.beginPath(); g.moveTo(X(0), m.t); g.lineTo(X(0), H - m.b); g.stroke();
    if (!p.splane && p.kind !== 'locus') { g.setLineDash([6, 5]); g.beginPath(); g.ellipse(X(0), Y(0), X(1) - X(0), Y(0) - Y(1), 0, 0, 7); g.stroke(); g.setLineDash([]); }
    if (p.loc) { g.fillStyle = '#2f5bea'; for (const l of p.loc) for (const z of l.poles) g.fillRect(X(z[0]) - 1.5, Y(z[1]) - 1.5, 3, 3); }
    g.lineWidth = 3; g.strokeStyle = '#dc2626'; for (const z of p.poles || []) { const x = X(z[0]), y = Y(z[1]); g.beginPath(); g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9); g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9); g.stroke(); }
    g.strokeStyle = '#0f766e'; for (const z of p.zeros || []) { g.beginPath(); g.arc(X(z[0]), Y(z[1]), 9, 0, 7); g.stroke(); }
    g.fillStyle = '#1c2230'; g.textAlign = 'left'; g.fillText(p.splane || p.kind === 'locus' ? 'Re(s) →' : 'Re(z) →  (dashed: unit circle)', m.l + 8, H - m.b - 8); return; }
  for (const s of series) { g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.faint ? 2 : 3;
    if (s.stem) { s.y.forEach((v, i) => { const x = X(s.x[i]); g.beginPath(); g.moveTo(x, Y(Math.max(y0, Math.min(y1, 0)))); g.lineTo(x, Y(v)); g.stroke(); g.beginPath(); g.arc(x, Y(v), 5, 0, 7); g.fill(); }); }
    else { g.beginPath(); s.y.forEach((v, i) => { if (!Number.isFinite(v)) return; const x = X(s.x[i]), y = Y(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } }
  if (series.length > 1) { g.textAlign = 'left'; let yy = m.t + 22; for (const s of series) { g.fillStyle = s.c; g.fillRect(W - m.r - 230, yy - 12, 18, 6); g.fillStyle = '#1c2230'; g.fillText(s.name, W - m.r - 205, yy - 4); yy += 26; } }
}

// ---------- tabs ----------
for (const b of document.querySelectorAll('.tab')) b.onclick = () => { for (const x of document.querySelectorAll('.tab')) x.classList.toggle('on', x === b);
  $('tabResults').hidden = b.dataset.tab !== 'results'; $('tabPython').hidden = b.dataset.tab !== 'python'; };
$('pyCopy').onclick = () => navigator.clipboard?.writeText($('pyCode').value);

// ---------- optional Python (Pyodide) ----------
let py = null;
async function loadPy() { if (py) return py;
  $('pyState').textContent = 'Downloading Python + NumPy + SciPy (first time only)…';
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js'; s.onload = ok; s.onerror = () => bad(new Error('could not download Python: check the internet connection')); document.head.append(s); });
  py = await window.loadPyodide(); await py.loadPackage(['numpy', 'scipy', 'matplotlib']);
  await py.runPythonAsync('import matplotlib\nmatplotlib.use("AGG")\nimport matplotlib.pyplot as plt\nplt.show = lambda *a, **k: None'); return py; }
$('pyRun').onclick = async () => { $('pyOut').textContent = ''; $('pyFigs').innerHTML = ''; $('pyRun').disabled = true;
  try { const p = await loadPy(); $('pyState').textContent = 'Running…'; let out = '';
    p.setStdout({ batched: t => { out += t + '\n'; $('pyOut').textContent = out; } }); p.setStderr({ batched: t => { out += t + '\n'; $('pyOut').textContent = out; } });
    await p.runPythonAsync('plt.close("all")\n' + $('pyCode').value);
    const figs = p.runPython('import io, base64\n_f = []\nfor n in plt.get_fignums():\n    b = io.BytesIO(); plt.figure(n).savefig(b, format="png", dpi=90); _f.append(base64.b64encode(b.getvalue()).decode())\n_f').toJs();
    $('pyFigs').innerHTML = figs.map(f => `<img alt="Python figure" src="data:image/png;base64,${f}">`).join(''); $('pyState').textContent = '✔ done';
  } catch (e) { $('pyOut').textContent += String(e.message || e); $('pyState').textContent = '✘ error'; }
  $('pyRun').disabled = false; };

buildList(); select(new URLSearchParams(location.search).get('e') || 'sampling');
window.dsp = { select, S, DSP_TEMPLATES };
