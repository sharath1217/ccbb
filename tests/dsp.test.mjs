// DSP and control maths checked against MATLAB / SciPy outputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../app/engine/dsp.js';
const near = (a, b, tol = 1e-4, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} expected ${b} got ${a}`);
const nearArr = (a, b, tol = 1e-4, m = '') => { assert.equal(a.length, b.length, m + ' length'); a.forEach((v, i) => near(v, b[i], tol, m + '[' + i + ']')); };

test('linear and circular convolution', () => {
  nearArr(D.conv([1, 2, 3], [1, 1, 1]), [1, 3, 6, 5, 3]);
  nearArr(D.cconv([1, 2, 3, 4], [1, 2, 1, 1]), [14, 11, 12, 13]);   // MATLAB cconv([1 2 3 4],[1 2 1 1],4)
  nearArr(D.cconv([1, 2, 3], [1, 1, 1], 5), [1, 3, 6, 5, 3], 1e-9, 'N ≥ L+M−1 equals linear');
});
test('autocorrelation like xcorr', () => { const { r, lags } = D.xcorr([1, 2, 3]); nearArr(r, [3, 8, 14, 8, 3]); assert.deepEqual(lags, [-2, -1, 0, 1, 2]); });
test('DFT, IDFT and FFT agree', () => {
  const x = [1, 2, 3, 4], X = D.dft(x); nearArr(X.map(c => c[0]), [10, -2, -2, -2]); nearArr(X.map(c => c[1]), [0, 2, 0, -2]);
  nearArr(D.idft(X).map(c => c[0]), x, 1e-9); const F = D.fft([1, 2, 3, 4, 5, 6, 7, 8]), G = D.dft([1, 2, 3, 4, 5, 6, 7, 8]);
  F.forEach((c, i) => { near(c[0], G[i][0], 1e-9); near(c[1], G[i][1], 1e-9); });
  near(D.C.abs(D.fft([1, 1, 1, 1, 0, 0, 0, 0])[1]), 2.6131, 1e-4);
});
test('difference equation: filter, impulse and step response', () => {
  nearArr(D.impz([1], [1, -0.5], 5), [1, 0.5, 0.25, 0.125, 0.0625]);
  nearArr(D.filter([1, 2], [1, 0.3], [1, 1, 1, 1]), [1, 2.7, 2.19, 2.343]);
  near(D.stepz([1], [1, -0.5], 60).at(-1), 2, 1e-9);
});
test('roots and poly round trip', () => {
  const r = D.roots([1, -6, 11, -6]); nearArr(r.map(c => c[0]), [3, 2, 1], 1e-8);
  const q = D.roots([1, 2, 5]); near(q[0][0], -1, 1e-9); near(Math.abs(q[0][1]), 2, 1e-9); nearArr(D.realPoly([[-1, 2], [-1, -2]]), [1, 2, 5], 1e-9);
});
test('butter matches MATLAB butter(2, 0.2) and butter(3, 0.5, "high")', () => {
  const { b, a } = D.butter(2, 0.2); nearArr(b, [0.0675, 0.1349, 0.0675], 1e-4); nearArr(a, [1, -1.1430, 0.4128], 1e-4);
  const h = D.butter(3, 0.5, 'high'); nearArr(h.b, [0.1667, -0.5, 0.5, -0.1667], 1e-4); nearArr(h.a, [1, 0, 0.3333, 0], 1e-4);
  const f = D.freqz(b, a, 1000); near(f.db[200], -3.0103, 0.02, '−3 dB at the cut-off');
});
test('cheby1 matches SciPy/MATLAB cheby1(2, 1, 0.3) and cheby1(3, 0.5, 0.25)', () => {
  const { b, a } = D.cheby1(2, 1, 0.3); nearArr(b, [0.138225, 0.276451, 0.138225], 1e-5); nearArr(a, [1, -0.773503, 0.393869], 1e-5);
  const c = D.cheby1(3, 0.5, 0.25); nearArr(c.b, [0.027746, 0.083237, 0.083237, 0.027746], 1e-5); nearArr(c.a, [1, -1.692706, 1.292980, -0.378309], 1e-5);
});
test('buttord gives the minimum order', () => { const { n, wn } = D.buttord(0.2, 0.4, 1, 30); assert.equal(n, 6); near(wn, 0.22204, 1e-4); });
test('fir1 matches MATLAB fir1(8, 0.4) (Hamming) and is linear phase', () => {
  const h = D.fir1(8, 0.4); nearArr(h, [-0.0061, -0.0136, 0.0512, 0.2657, 0.4057, 0.2657, 0.0512, -0.0136, -0.0061], 1e-4);
  near(h.reduce((s, v) => s + v, 0), 1, 1e-12, 'unity DC gain'); h.forEach((v, i) => near(v, h[8 - i], 1e-12));
  const hp = D.fir1(8, 0.4, 'high'); near(D.C.abs(D.freqz(hp, [1], 512).H.at(-1)), 1, 0.01, 'high-pass gain ≈ 1 near Nyquist');
});
test('second-order step response matches the textbook formulas', () => {
  const wn = 2, z = 0.4, s = D.step([wn * wn], [1, 2 * z * wn, wn * wn], 12), i = D.stepinfo(s);
  near(i.overshoot, 100 * Math.exp(-z * Math.PI / Math.sqrt(1 - z * z)), 0.05, 'Mp %');
  near(i.peakTime, Math.PI / (wn * Math.sqrt(1 - z * z)), 0.01, 'tp'); near(i.final, 1, 1e-3); near(i.settlingTime, 4.6, 0.6, 'ts ≈ 4/(ζωn)');
  const first = D.step([1], [1, 1], 10); near(first.y[first.t.findIndex(t => t >= 1)], 1 - Math.exp(-1), 2e-3, 'first order at t = τ');
});
test('Bode and margins of K/(s(s+1)(s+2)) with K = 2 (MATLAB margin: GM 9.54 dB, PM 32.6°)', () => {
  const m = D.margin([2], [1, 3, 2, 0]); near(m.gm, 9.542, 0.02); near(m.pm, 32.6, 0.2); near(m.wpc, Math.SQRT2, 1e-3);
  const b = D.bode([1], [1, 1], 0.01, 100, 401); near(b.mag[200], -3.0103, 0.01, 'corner −3 dB'); near(b.phase[200], -45, 0.1);
});
test('Routh-Hurwitz and root locus', () => {
  assert.equal(D.routh([1, 3, 3, 1]).stable, true); const u = D.routh([1, 1, 2, 8]); assert.equal(u.stable, false); assert.equal(u.rhpPoles, 2);
  const rl = D.rlocus([1], [1, 3, 2, 0], [6]); assert.ok(rl[0].poles.some(p => Math.abs(p[0]) < 1e-6 && Math.abs(Math.abs(p[1]) - Math.SQRT2) < 1e-6), 'K = 6 puts poles on the jω axis at ±j√2');
});
