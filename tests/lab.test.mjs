// Circuit Lab: every analysis checked against the textbook formula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operatingPoint, transient, acSweep, dcSweep, measureAC, measureWave, parseValue } from '../app/engine/analysis.js';
import { LAB_TEMPLATES as T } from '../app/ui/lab-templates.js';
const near = (a, b, tol, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} expected ${b} ± ${tol}, got ${a}`);

test('engineering values parse', () => { near(parseValue('4.7k'), 4700, 1e-9); near(parseValue('100n'), 1e-7, 1e-20); near(parseValue('1meg'), 1e6, 1e-6); near(parseValue('10u'), 1e-5, 1e-18); });
test('voltage divider: 9 V × 20k/30k = 6 V', () => { near(operatingPoint(T.divider.sch).V.Vout, 6, 0.002); });
test('LED: (5 − 2.0)/220 ≈ 13.6 mA', () => { const op = operatingPoint(T.led.sch); near(op.I.R1, 0.0136, 0.0007); near(op.V.Vled, 2.0, 0.05); });
test('RC low-pass: −3 dB at 1/(2πRC) = 159 Hz, −20 dB/decade', () => {
  const r = acSweep(T.rclow.sch, { fstart: 10, fstop: 1e5, ppd: 40 }), m = measureAC(r.f, r['Vout dB']);
  near(m.f3dbHigh, 159.2, 4, 'f-3dB'); near(m.maxDb, 0, 0.05);
  const i = r.f.findIndex(f => f >= 15900); near(r['Vout dB'][i], -40, 0.6, 'at 100 × fc'); near(r['Vout °'][r.f.findIndex(f => f >= 159)], -45, 3, 'phase at fc');
});
test('RC high-pass: −3 dB at 159 Hz from below', () => { const r = acSweep(T.rchigh.sch, { fstart: 1, fstop: 1e5, ppd: 40 }); near(measureAC(r.f, r['Vout dB']).f3dbLow, 159.2, 4); });
test('RLC: resonance at 1/(2π√LC) = 1.59 kHz with 0 dB peak', () => { const r = acSweep(T.rlc.sch, { fstart: 100, fstop: 1e5, ppd: 80 }), m = measureAC(r.f, r['VR dB']); near(m.fPeak, 1591, 40); near(m.maxDb, 0, 0.2); });
test('inverting amp: gain −10 (5 V peak out, inverted)', () => {
  const r = transient(T.inverting.sch, { tstop: 0.003, dt: 2e-6 }), w = measureWave(r.t, r.Vout); near(w.vpp, 10, 0.05);
  const k = r.t.findIndex(t => t >= 0.00025); near(r.Vout[k], -5, 0.05, 'at input peak');
});
test('non-inverting amp: gain 11', () => { const r = transient(T.noninv.sch, { tstop: 0.003, dt: 2e-6 }); near(measureWave(r.t, r.Vout).vpp, 11, 0.06); });
test('inverting amp clips at the ±15 V rails when overdriven', () => { const s = structuredClone(T.inverting.sch); s.comps.find(c => c.id === 'V1').props.amp = 3; const r = transient(s, { tstop: 0.002, dt: 2e-6 }); near(Math.max(...r.Vout), 15, 0.05); near(Math.min(...r.Vout), -15, 0.05); });
test('integrator: square in → triangle out with slope 1/(RC) = 1000 V/s', () => {
  const r = transient(T.integrator.sch, { tstop: 0.004, dt: 2e-6 }), w = measureWave(r.t, r.Vout); near(w.vpp, 0.5, 0.03, 'triangle p-p'); near(w.freq, 1000, 30);
});
test('half-wave rectifier: peak ≈ 10 − 0.7 V, ripple ≈ I/(fC)', () => {
  const r = transient(T.halfwave.sch, { tstop: 0.12, dt: 5e-5 }), w = measureWave(r.t, r.Vout);
  near(w.max, 9.25, 0.25, 'peak'); assert.ok(w.vpp > 1.2 && w.vpp < 2.2, 'ripple ' + w.vpp);
});
test('zener regulator: follows input below 5 V, holds 5.1 V above', () => {
  const r = dcSweep(T.zener.sch, { source: 'V1', from: 0, to: 15, step: 0.5 }), at = v => r.Vout[r.x.indexOf(v)];
  near(at(3), 3 * 1000 / 1470, 0.05, 'below zener'); near(at(12), 5.1, 0.12); near(at(15) - at(10), 0, 0.12, 'regulation');
});
test('diode I–V: ~0.65–0.75 V at 10–100 mA', () => {
  const r = dcSweep(T.diodeiv.sch, { source: 'V1', from: 0, to: 3, step: 0.05 }), k = r['I(D1)'].findIndex(i => i > 0.05);
  assert.ok(r.Vd[k] > 0.62 && r.Vd[k] < 0.85, 'Vd at 50 mA ' + r.Vd[k]); assert.ok(r['I(D1)'][r.x.indexOf(0.3)] < 1e-5, 'off below 0.3 V');
});
test('common-emitter amplifier: mid-band gain ≈ gm·(RC∥RL)', () => {
  const op = operatingPoint(T.ceamp.sch); const r = acSweep(T.ceamp.sch, { fstart: 10, fstop: 1e5, ppd: 10 });
  const g = r['Vout dB'][r.f.findIndex(f => f >= 1000)]; assert.ok(g > 38 && g < 48, 'gain dB ' + g);
});
test('RC charging: reaches 63 % at τ = 10 ms', () => {
  const r = transient(T.rccharge.sch, { tstop: 0.03, dt: 2e-5 }), k = r.t.findIndex(t => t >= 0.01); near(r.Vc[k], 5 * (1 - Math.exp(-1)), 0.06);
});
test('all templates run their analysis without errors', () => {
  for (const [k, t] of Object.entries(T)) { const a = t.analysis;
    const r = a.kind === 'op' ? operatingPoint(t.sch) : a.kind === 'tran' ? transient(t.sch, { tstop: a.tstop, dt: a.tstop / 400 }) : a.kind === 'ac' ? acSweep(t.sch, a) : dcSweep(t.sch, a);
    assert.ok(r, k); }
});
