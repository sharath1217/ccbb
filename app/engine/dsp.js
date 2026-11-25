// Signals, DSP and control-systems maths for the VTU labs, matching MATLAB / SciPy results.
// Complex numbers are [re, im]. Polynomials are coefficient arrays, highest power first (like MATLAB).

// ---------- complex helpers ----------
export const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  abs: a => Math.hypot(a[0], a[1]), arg: a => Math.atan2(a[1], a[0]), exp: t => [Math.cos(t), Math.sin(t)], scale: (a, k) => [a[0] * k, a[1] * k],
};

// ---------- basic signal operations ----------
export function conv(x, h) { const y = new Array(x.length + h.length - 1).fill(0); for (let i = 0; i < x.length; i++) for (let j = 0; j < h.length; j++) y[i + j] += x[i] * h[j]; return y; }
export function cconv(x, h, N = Math.max(x.length, h.length)) { const y = new Array(N).fill(0); for (let n = 0; n < N; n++) for (let k = 0; k < N; k++) y[n] += (x[k] || 0) * (h[((n - k) % N + N) % N] || 0); return y; }
// cross-correlation like MATLAB xcorr(x, y): lags −(N−1)…(N−1), r[l] = Σ x[n+l]·y[n]
export function xcorr(x, y = x) { const N = Math.max(x.length, y.length), out = [], lags = [];
  for (let l = -(N - 1); l <= N - 1; l++) { let s = 0; for (let n = 0; n < N; n++) s += (x[n + l] || 0) * (y[n] || 0); out.push(s); lags.push(l); } return { r: out, lags }; }

export function dft(x, N = x.length) { const X = []; for (let k = 0; k < N; k++) { let re = 0, im = 0; for (let n = 0; n < N; n++) { const v = x[n] || 0, a = -2 * Math.PI * k * n / N; re += v * Math.cos(a); im += v * Math.sin(a); } X.push([re, im]); } return X; }
export function idft(X) { const N = X.length, x = []; for (let n = 0; n < N; n++) { let re = 0, im = 0; for (let k = 0; k < N; k++) { const a = 2 * Math.PI * k * n / N, c = Math.cos(a), s = Math.sin(a); re += X[k][0] * c - X[k][1] * s; im += X[k][0] * s + X[k][1] * c; } x.push([re / N, im / N]); } return x; }
// radix-2 decimation-in-time FFT (N padded to a power of two), complex in / out
export function fft(x, N) { const n0 = N || 1 << Math.ceil(Math.log2(Math.max(1, x.length)));
  const a = Array.from({ length: n0 }, (_, i) => { const v = x[i]; return v === undefined ? [0, 0] : Array.isArray(v) ? [v[0], v[1]] : [v, 0]; });
  if (n0 & (n0 - 1)) return dft(a.map(v => v[0]), n0);   // not a power of two: plain DFT (real input)
  for (let i = 1, j = 0; i < n0; i++) { let b = n0 >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) [a[i], a[j]] = [a[j], a[i]]; }
  for (let len = 2; len <= n0; len <<= 1) { const w = C.exp(-2 * Math.PI / len);
    for (let i = 0; i < n0; i += len) { let wn = [1, 0]; for (let k = 0; k < len / 2; k++) { const u = a[i + k], v = C.mul(a[i + k + len / 2], wn); a[i + k] = C.add(u, v); a[i + k + len / 2] = C.sub(u, v); wn = C.mul(wn, w); } } }
  return a; }

// y = filter(b, a, x): direct form difference equation, a[0] normalised
export function filter(b, a, x, zi) { const a0 = a[0], y = []; for (let n = 0; n < x.length; n++) { let v = 0; for (let k = 0; k < b.length; k++) v += b[k] * (x[n - k] ?? (zi && n - k < 0 ? 0 : 0)); for (let k = 1; k < a.length; k++) v -= a[k] * (y[n - k] ?? 0); y.push(v / a0); } return y; }
export const impz = (b, a, N = 32) => filter(b, a, Array.from({ length: N }, (_, i) => +(i === 0)));
export const stepz = (b, a, N = 32) => filter(b, a, new Array(N).fill(1));
// frequency response at N points on 0…π (like freqz(b, a, N))
export function freqz(b, a = [1], N = 512) { const w = [], H = [];
  for (let i = 0; i < N; i++) { const wi = Math.PI * i / N; w.push(wi); const z = C.exp(-wi); let nb = [0, 0], nz = [1, 0]; for (const c of b) { nb = C.add(nb, C.scale(nz, c)); nz = C.mul(nz, z); }
    let na = [0, 0]; nz = [1, 0]; for (const c of a) { na = C.add(na, C.scale(nz, c)); nz = C.mul(nz, z); } H.push(C.div(nb, na)); }
  return { w, H, mag: H.map(C.abs), db: H.map(h => 20 * Math.log10(Math.max(C.abs(h), 1e-12))), phase: unwrap(H.map(C.arg)) }; }
export function unwrap(p) { const o = [...p]; for (let i = 1; i < o.length; i++) { let d = o[i] - o[i - 1]; while (d > Math.PI) { o[i] -= 2 * Math.PI; d -= 2 * Math.PI; } while (d < -Math.PI) { o[i] += 2 * Math.PI; d += 2 * Math.PI; } } return o; }

// ---------- polynomials ----------
export function poly(roots) { let p = [[1, 0]]; for (const r of roots) { const q = new Array(p.length + 1).fill(0).map(() => [0, 0]); for (let i = 0; i < p.length; i++) { q[i] = C.add(q[i], p[i]); q[i + 1] = C.sub(q[i + 1], C.mul(p[i], r)); } p = q; } return p; }
export const realPoly = roots => poly(roots.map(r => Array.isArray(r) ? r : [r, 0])).map(c => Math.abs(c[0]) < 1e-14 ? 0 : c[0]);
export function polyval(p, x) { let v = [0, 0]; const z = Array.isArray(x) ? x : [x, 0]; for (const c of p) v = C.add(C.mul(v, z), Array.isArray(c) ? c : [c, 0]); return v; }
// all roots (Aberth–Ehrlich iteration), like MATLAB roots()
export function roots(p) { let a = [...p]; while (a.length && Math.abs(a[0]) < 1e-14) a.shift(); let zeros = 0; while (a.length > 1 && Math.abs(a.at(-1)) < 1e-14) { a.pop(); zeros++; }
  const n = a.length - 1; const out = Array.from({ length: zeros }, () => [0, 0]); if (n < 1) return out;
  const c = a.map(v => v / a[0]); const R = 1 + Math.max(...c.slice(1).map(Math.abs));
  let z = Array.from({ length: n }, (_, k) => C.scale(C.exp(2 * Math.PI * k / n + 0.4), R * 0.7));
  const dp = c.slice(0, -1).map((v, i) => v * (n - i));
  for (let it = 0; it < 500; it++) { let moved = 0;
    z = z.map((zi, i) => { const f = polyval(c, zi), d = polyval(dp, zi); if (C.abs(f) < 1e-15) return zi; const ratio = C.div(f, d);
      let s = [0, 0]; for (let j = 0; j < n; j++) if (j !== i) s = C.add(s, C.div([1, 0], C.sub(zi, z[j])));
      const w = C.div(ratio, C.sub([1, 0], C.mul(ratio, s))); moved = Math.max(moved, C.abs(w)); return C.sub(zi, w); });
    if (moved < 1e-14) break; }
  return [...out, ...z.map(r => [Math.abs(r[1]) < 1e-9 ? r[0] : r[0], Math.abs(r[1]) < 1e-9 ? 0 : r[1]])].sort((x, y) => y[0] - x[0] || y[1] - x[1]); }

// ---------- FIR design (window method), like MATLAB fir1 ----------
export const WINDOWS = {
  rectangular: (n, N) => 1, hamming: (n, N) => 0.54 - 0.46 * Math.cos(2 * Math.PI * n / N), hann: (n, N) => 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N),
  blackman: (n, N) => 0.42 - 0.5 * Math.cos(2 * Math.PI * n / N) + 0.08 * Math.cos(4 * Math.PI * n / N), bartlett: (n, N) => 1 - Math.abs(2 * n / N - 1),
};
const sinc = x => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
// order N (N+1 taps); wn normalised to Nyquist (0…1), or [w1, w2] for band-pass/stop
export function fir1(N, wn, type = 'low', win = 'hamming') { const M = N / 2, w = n => WINDOWS[win](n, N);
  const lp = (fc, n) => fc * sinc(fc * (n - M));
  let h = Array.from({ length: N + 1 }, (_, n) => { const d = +(n === M);
    switch (type) { case 'low': return lp(wn, n); case 'high': return d - lp(wn, n); case 'bandpass': return lp(wn[1], n) - lp(wn[0], n); default: return d - (lp(wn[1], n) - lp(wn[0], n)); } }).map((v, n) => v * w(n));
  // scale so the gain is exactly 1 at the centre of the first passband (MATLAB 'scale' option)
  const f0 = type === 'low' || type === 'stop' ? 0 : type === 'high' ? 1 : (wn[0] + wn[1]) / 2;
  const g = C.abs(h.reduce((acc, v, n) => C.add(acc, C.scale(C.exp(-Math.PI * f0 * n), v)), [0, 0])); return h.map(v => v / g); }

// ---------- IIR design (analog prototype + bilinear transform), like MATLAB butter / cheby1 ----------
function bilinear(polesS, zerosS, nZerosAt, gainAt) {   // s-plane poles/zeros → z-plane, normalise |H| = target at z = gainAt.z
  const bz = s => C.div(C.add([1, 0], s), C.sub([1, 0], s));
  const p = polesS.map(bz), z = [...zerosS.map(bz), ...Array.from({ length: nZerosAt.count }, () => [nZerosAt.at, 0])];
  const b0 = realPoly(z), a = realPoly(p); const zz = [gainAt.z, 0];
  const g = gainAt.mag / C.abs(C.div(polyval(b0, zz), polyval(a, zz))); return { b: b0.map(v => v * g), a, poles: p, zeros: z }; }
function protoPoles(n, kind, rp) { const out = [];
  if (kind === 'butter') for (let k = 1; k <= n; k++) out.push(C.exp(Math.PI * (2 * k + n - 1) / (2 * n)));
  else { const eps = Math.sqrt(10 ** (rp / 10) - 1), mu = Math.asinh(1 / eps) / n;
    for (let k = 1; k <= n; k++) { const th = Math.PI * (2 * k - 1) / (2 * n); out.push([-Math.sinh(mu) * Math.sin(th), Math.cosh(mu) * Math.cos(th)]); } }
  return out; }
export function iir(n, wn, { kind = 'butter', type = 'low', rp = 0.5 } = {}) {
  const W = Math.tan(Math.PI * wn / 2), proto = protoPoles(n, kind, rp);
  const dcGain = kind === 'cheby1' && n % 2 === 0 ? 1 / Math.sqrt(1 + (10 ** (rp / 10) - 1)) : 1;
  if (type === 'low') return bilinear(proto.map(p => C.scale(p, W)), [], { count: n, at: -1 }, { z: 1, mag: dcGain });
  return bilinear(proto.map(p => C.div([W, 0], p)), [], { count: n, at: 1 }, { z: -1, mag: dcGain }); }
export const butter = (n, wn, type = 'low') => iir(n, wn, { kind: 'butter', type });
export const cheby1 = (n, rp, wn, type = 'low') => iir(n, wn, { kind: 'cheby1', type, rp });
// minimum Butterworth order and cut-off for a spec (like buttord), edges normalised to Nyquist, ripples in dB
export function buttord(wp, ws, rp, rs) { const Wp = Math.tan(Math.PI * wp / 2), Ws = Math.tan(Math.PI * ws / 2), lp = wp < ws, r = lp ? Ws / Wp : Wp / Ws;
  const n = Math.ceil(Math.log10((10 ** (rs / 10) - 1) / (10 ** (rp / 10) - 1)) / (2 * Math.log10(r)));
  const W0 = lp ? Wp / (10 ** (rp / 10) - 1) ** (1 / (2 * n)) : Wp * (10 ** (rp / 10) - 1) ** (1 / (2 * n)); return { n, wn: 2 * Math.atan(W0) / Math.PI }; }

// ---------- control systems (continuous transfer functions) ----------
// step / impulse response of G(s) = num/den by state-space simulation (RK4); returns {t, y}
export function lsim(num, den, u, T, dt = T / 2000) { const a0 = den[0]; const d = den.map(v => v / a0), n = d.length - 1;
  const b = new Array(n + 1 - num.length).fill(0).concat(num.map(v => v / a0));
  if (n === 0) { const t = [], y = []; for (let k = 0; k * dt <= T + 1e-12; k++) { t.push(k * dt); y.push(b[0] * u(k * dt)); } return { t, y }; }
  // controllable canonical form: x' = A x + B u, y = Cx + D u
  const D = b[0], Cc = Array.from({ length: n }, (_, i) => b[n - i] - b[0] * d[n - i]);
  const f = (x, uu) => x.map((_, i) => (i < n - 1 ? x[i + 1] : uu - d.slice(1).reduce((s, di, k) => s + di * x[n - 1 - k], 0)));
  let x = new Array(n).fill(0); const t = [], y = [];
  for (let k = 0; k * dt <= T + 1e-12; k++) { const tk = k * dt; t.push(tk); y.push(Cc.reduce((s, c, i) => s + c * x[i], 0) + D * u(tk));
    const add = (p, q, h) => p.map((v, i) => v + q[i] * h); const k1 = f(x, u(tk)), k2 = f(add(x, k1, dt / 2), u(tk + dt / 2)), k3 = f(add(x, k2, dt / 2), u(tk + dt / 2)), k4 = f(add(x, k3, dt), u(tk + dt));
    x = x.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); }
  return { t, y }; }
export const step = (num, den, T) => lsim(num, den, () => 1, T);
// step-response characteristics like MATLAB stepinfo (10–90 % rise, 2 % settling)
export function stepinfo({ t, y }) { const yf = y.at(-1), peak = Math.max(...y), ip = y.indexOf(peak);
  const cross = lv => { for (let i = 1; i < y.length; i++) if ((y[i] - lv) * (y[i - 1] - lv) <= 0 && y[i] !== y[i - 1]) return t[i - 1] + (lv - y[i - 1]) / (y[i] - y[i - 1]) * (t[i] - t[i - 1]); return NaN; };
  let ts = 0; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - yf) > 0.02 * Math.abs(yf)) { ts = t[Math.min(i + 1, t.length - 1)]; break; }
  return { riseTime: cross(0.9 * yf) - cross(0.1 * yf), peakTime: t[ip], overshoot: Math.max(0, (peak - yf) / Math.abs(yf) * 100), settlingTime: ts, final: yf, peak }; }
// open-loop polynomial helpers
export const polyMul = (p, q) => conv(p, q);
export function polyAdd(p, q) { const n = Math.max(p.length, q.length), a = [...new Array(n - p.length).fill(0), ...p], b = [...new Array(n - q.length).fill(0), ...q]; return a.map((v, i) => v + b[i]); }
export const feedback = (num, den, k = 1) => ({ num: num.map(v => v * k), den: polyAdd(den, num.map(v => v * k)) });   // unity negative feedback
export function bode(num, den, wmin = 0.01, wmax = 100, N = 400) { const w = [], mag = [], ph = [];
  for (let i = 0; i < N; i++) { const wi = wmin * (wmax / wmin) ** (i / (N - 1)); w.push(wi); const H = C.div(polyval(num, [0, wi]), polyval(den, [0, wi])); mag.push(20 * Math.log10(Math.max(C.abs(H), 1e-12))); ph.push(C.arg(H) * 180 / Math.PI); }
  const phase = unwrap(ph.map(p => p * Math.PI / 180)).map(p => p * 180 / Math.PI); return { w, mag, phase }; }
// gain and phase margins (like MATLAB margin)
export function margin(num, den) { const H = w => C.div(polyval(num, [0, w]), polyval(den, [0, w]));
  const find = (fn, lo = 1e-4, hi = 1e4) => { const pts = 4000; let prev = null;
    for (let i = 0; i <= pts; i++) { const w = lo * (hi / lo) ** (i / pts), v = fn(w); if (prev && Math.sign(v) !== Math.sign(prev.v)) { let a = prev.w, b = w; for (let k = 0; k < 60; k++) { const m = Math.sqrt(a * b); if (Math.sign(fn(m)) === Math.sign(prev.v)) a = m; else b = m; } return Math.sqrt(a * b); } prev = { w, v }; } return null; };
  const wgc = find(w => C.abs(H(w)) - 1);
  const phaseDeg = w => { const b = bode(num, den, 1e-4, w, 600); return b.phase.at(-1); };
  const wpc = find(w => phaseDeg(w) + 180);
  return { gm: wpc ? -20 * Math.log10(C.abs(H(wpc))) : Infinity, pm: wgc ? 180 + phaseDeg(wgc) : Infinity, wgc, wpc }; }
// root locus: closed-loop poles of den + K·num for a range of gains
export function rlocus(num, den, Ks) { return Ks.map(k => ({ k, poles: roots(polyAdd(den, num.map(v => v * k))) })); }
export function routh(p) { const n = p.length; const rows = [p.filter((_, i) => i % 2 === 0), p.filter((_, i) => i % 2 === 1)]; const w = rows[0].length; rows[1] = [...rows[1], ...new Array(w - rows[1].length).fill(0)];
  for (let r = 2; r < n; r++) { const a = rows[r - 2], b = rows[r - 1]; let piv = b[0]; if (Math.abs(piv) < 1e-12) piv = 1e-9;
    rows.push(Array.from({ length: w }, (_, i) => i + 1 < w ? (piv * a[i + 1] - a[0] * (b[i + 1] ?? 0)) / piv : 0)); }
  const first = rows.map(r => r[0]); let changes = 0; for (let i = 1; i < first.length; i++) if (Math.sign(first[i]) !== Math.sign(first[i - 1]) && first[i] !== 0) changes++;
  return { rows, firstColumn: first, rhpPoles: changes, stable: changes === 0 && first.every(v => v > 0 || v < 0) }; }
