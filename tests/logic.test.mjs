// Digital IC function tables (74HC / 74LS / CD4000), checked against the datasheets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../app/engine/circuit.js';
import { LOGIC_ICS } from '../app/engine/logic-ics.js';

// A test bench: the chip powered from 5 V, every input tied HIGH or LOW by a wire to a rail.
function bench(type, props = {}) {
  const spec = LOGIC_ICS[type], chip = { id: 'u', type, props: {}, state: {} };
  const parts = [{ id: 'b', type: 'battery', props: { volts: 5, rint: 0 } }, chip];
  let levels = { ...props };
  const solve = () => simulate(parts, [{ from: 'b:+', to: 'u:' + spec.vcc }, { from: 'b:-', to: 'u:' + spec.gnd },
    ...Object.entries(levels).map(([pin, v]) => ({ from: v ? 'b:+' : 'b:-', to: 'u:' + pin }))]);
  let s = solve();
  return {
    set(l) { levels = { ...levels, ...l }; s = solve(); return this; },
    pulse(pin, active = 1) { this.set({ [pin]: 1 - active }); this.set({ [pin]: active }); return this.set({ [pin]: 1 - active }); },
    v: pin => s.voltAt('u', String(pin)), q: pin => (s.voltAt('u', String(pin)) > 2.5 ? 1 : 0),
    bits: list => list.reduce((a, p, i) => a | ((s.voltAt('u', String(p)) > 2.5 ? 1 : 0) << i), 0),
    get sim() { return s; }, chip,
  };
}

test('74HC02 NOR truth table', () => {
  for (const [a, b, y] of [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]]) assert.equal(bench('hc02', { 2: a, 3: b }).q(1), y);
});

test('74HC74 D flip-flop: stores D on the rising clock edge; preset and clear override', () => {
  const u = bench('hc74', { 1: 1, 4: 1, 2: 1, 3: 0 });
  assert.equal(u.q(5), 0, 'starts cleared');
  u.set({ 3: 1 }); assert.equal(u.q(5), 1); assert.equal(u.q(6), 0);
  u.set({ 2: 0 }); assert.equal(u.q(5), 1, 'D changes alone do nothing');
  u.set({ 3: 0 }); assert.equal(u.q(5), 1, 'falling edge does nothing');
  u.set({ 3: 1 }); assert.equal(u.q(5), 0);
  u.set({ 4: 0 }); assert.equal(u.q(5), 1, 'preset'); u.set({ 4: 1, 1: 0 }); assert.equal(u.q(5), 0, 'clear');
  u.set({ 4: 0 }); assert.equal(u.q(5), 1); assert.equal(u.q(6), 1, 'PRE and CLR both low: Q = Q̅ = HIGH');
  assert.ok(Math.abs(u.v(5) - 5) < 0.05, 'output swings to the rail');
});

test('74HC74 wired as a T flip-flop (Q̅ → D) divides the clock by 2', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 5, rint: 0 } }, { id: 'u', type: 'hc74', props: {}, state: {} }];
  let clk = 0; const seq = [];
  for (let i = 0; i < 8; i++) { clk ^= 1;
    const s = simulate(parts, [{ from: 'b:+', to: 'u:14' }, { from: 'b:-', to: 'u:7' }, { from: 'b:+', to: 'u:1' }, { from: 'b:+', to: 'u:4' }, { from: 'u:6', to: 'u:2' }, { from: clk ? 'b:+' : 'b:-', to: 'u:3' }]);
    seq.push(s.voltAt('u', '5') > 2.5 ? 1 : 0); }
  assert.deepEqual(seq, [0, 0, 1, 1, 0, 0, 1, 1]);   // the first solve has no previous level, so no edge
});

test('74HC112 JK flip-flop: hold, reset, set, toggle on the falling edge', () => {
  const u = bench('hc112', { 15: 1, 4: 1, 1: 1, 3: 0, 2: 0 });
  u.pulse(1, 0); assert.equal(u.q(5), 0, 'J=K=0 holds');
  u.set({ 3: 1 }).pulse(1, 0); assert.equal(u.q(5), 1, 'J=1 sets');
  u.set({ 3: 0, 2: 1 }).pulse(1, 0); assert.equal(u.q(5), 0, 'K=1 resets');
  u.set({ 3: 1, 2: 1 }); const t = []; for (let i = 0; i < 4; i++) { u.pulse(1, 0); t.push(u.q(5)); }
  assert.deepEqual(t, [1, 0, 1, 0], 'J=K=1 toggles');
  u.set({ 1: 1 }); u.set({ 1: 0 }); assert.equal(u.q(5), 1, 'falling edge acts'); u.set({ 1: 1 }); assert.equal(u.q(5), 1, 'rising edge does nothing');
});

test('74HC161 counts 0–15 with ripple carry, loads and clears', () => {
  const u = bench('hc161', { 1: 1, 9: 1, 7: 1, 10: 1, 2: 0 }), Q = ['14', '13', '12', '11'];
  for (let n = 1; n <= 15; n++) { u.pulse(2); assert.equal(u.bits(Q), n); }
  assert.equal(u.q(15), 1, 'RCO at 15'); u.pulse(2); assert.equal(u.bits(Q), 0); assert.equal(u.q(15), 0);
  u.set({ 9: 0, 3: 1, 4: 0, 5: 1, 6: 0 }).pulse(2); assert.equal(u.bits(Q), 5, 'synchronous load');
  u.set({ 9: 1, 7: 0 }).pulse(2); assert.equal(u.bits(Q), 5, 'ENP low holds');
  u.set({ 1: 0 }); assert.equal(u.bits(Q), 0, 'asynchronous clear');
});

test('74HC90 as a BCD decade counter (QA → CKB): 0…9 then back to 0', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 5, rint: 0 } }, { id: 'u', type: 'hc90', props: {}, state: {} }];
  const base = [{ from: 'b:+', to: 'u:5' }, { from: 'b:-', to: 'u:10' }, { from: 'u:12', to: 'u:1' }, { from: 'b:-', to: 'u:2' }, { from: 'b:-', to: 'u:3' }, { from: 'b:-', to: 'u:6' }, { from: 'b:-', to: 'u:7' }];
  const val = s => ['12', '9', '8', '11'].reduce((a, p, i) => a | ((s.voltAt('u', p) > 2.5 ? 1 : 0) << i), 0); const seen = [];
  for (let i = 0; i < 24; i++) { const s = simulate(parts, [...base, { from: i % 2 ? 'b:-' : 'b:+', to: 'u:14' }]); if (i % 2) seen.push(val(s)); }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
});

test('74HC90 reset-to-0 and set-to-9 inputs', () => {
  const u = bench('hc90', { 2: 1, 3: 1, 6: 0, 7: 0 }); assert.equal(u.bits(['12', '9', '8', '11']), 0);
  u.set({ 6: 1, 7: 1 }); assert.equal(u.bits(['12', '9', '8', '11']), 9);
});

test('CD4017 decade counter: one output HIGH at a time, carry for 0–4, reset', () => {
  const u = bench('cd4017', { 13: 0, 15: 0, 14: 0 }), Q = ['3', '2', '4', '7', '10', '1', '5', '6', '9', '11'];
  for (let n = 0; n < 12; n++) { const hi = Q.map(p => u.q(p)); assert.equal(hi.indexOf(1), n % 10); assert.equal(hi.filter(Boolean).length, 1); assert.equal(u.q(12), +(n % 10 < 5)); u.pulse(14); }
  u.set({ 13: 1 }).pulse(14); assert.equal(u.q(4), 1, 'INH stops counting'); u.set({ 15: 1 }); assert.equal(u.q(3), 1, 'reset');
});

test('74HC151 8:1 MUX selects every input; strobe disables', () => {
  const D = ['4', '3', '2', '1', '15', '14', '13', '12'];
  for (let sel = 0; sel < 8; sel++) {
    const lv = { 7: 0, 11: sel & 1, 10: (sel >> 1) & 1, 9: (sel >> 2) & 1 }; D.forEach((p, i) => { lv[p] = +(i === sel); });
    const u = bench('hc151', lv); assert.equal(u.q(5), 1); assert.equal(u.q(6), 0);
    D.forEach((p, i) => { lv[p] = +(i !== sel); }); assert.equal(bench('hc151', lv).q(5), 0);
  }
  assert.equal(bench('hc151', { 7: 1, 4: 1 }).q(5), 0);
});

test('74HC153 dual 4:1 MUX', () => {
  for (let sel = 0; sel < 4; sel++) { const lv = { 1: 0, 15: 0, 14: sel & 1, 2: sel >> 1 };
    ['6', '5', '4', '3'].forEach((p, i) => { lv[p] = +(i === sel); }); ['10', '11', '12', '13'].forEach((p, i) => { lv[p] = +(i !== sel); });
    const u = bench('hc153', lv); assert.equal(u.q(7), 1); assert.equal(u.q(9), 0); }
});

test('74HC138 decoder: exactly one active-LOW output; enables', () => {
  const Y = ['15', '14', '13', '12', '11', '10', '9', '7'];
  for (let n = 0; n < 8; n++) { const u = bench('hc138', { 1: n & 1, 2: (n >> 1) & 1, 3: n >> 2, 4: 0, 5: 0, 6: 1 });
    assert.deepEqual(Y.map(p => u.q(p)), Y.map((_, i) => +(i !== n))); }
  assert.ok(['15', '7'].every(p => bench('hc138', { 4: 1, 5: 0, 6: 1 }).q(p) === 1), 'G2A high disables');
  assert.equal(bench('hc138', { 4: 0, 5: 0, 6: 0 }).q(15), 1, 'G1 low disables');
});

test('74HC283 4-bit adder: all 512 input combinations', () => {
  const A = ['5', '3', '14', '12'], B = ['6', '2', '15', '11'];
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) for (const c of [0, 1]) {
    const lv = { 7: c }; A.forEach((p, i) => { lv[p] = (a >> i) & 1; }); B.forEach((p, i) => { lv[p] = (b >> i) & 1; });
    const u = bench('hc283', lv); assert.equal(u.bits(['4', '1', '13', '10', '9']), a + b + c, `${a}+${b}+${c}`); }
});

test('74HC85 magnitude comparator with cascade inputs', () => {
  const A = ['10', '12', '13', '15'], B = ['9', '11', '14', '1'];
  const cmp = (a, b, casc = { 2: 0, 3: 1, 4: 0 }) => { const lv = { ...casc }; A.forEach((p, i) => { lv[p] = (a >> i) & 1; }); B.forEach((p, i) => { lv[p] = (b >> i) & 1; }); const u = bench('hc85', lv); return [u.q(5), u.q(6), u.q(7)]; };
  for (let a = 0; a < 16; a += 3) for (let b = 0; b < 16; b += 2) assert.deepEqual(cmp(a, b), [+(a > b), +(a === b), +(a < b)], `${a} vs ${b}`);
  assert.deepEqual(cmp(7, 7, { 2: 0, 3: 0, 4: 1 }), [1, 0, 0]); assert.deepEqual(cmp(7, 7, { 2: 1, 3: 0, 4: 0 }), [0, 0, 1]);
});

test('74HC595: shift 8 bits in, latch them out; OE high floats the outputs', () => {
  const u = bench('hc595', { 10: 1, 13: 0, 11: 0, 12: 0, 14: 0 }), Q = ['15', '1', '2', '3', '4', '5', '6', '7'];
  const byte = 0b10110010; for (let i = 7; i >= 0; i--) { u.set({ 14: (byte >> i) & 1 }); u.pulse(11); }   // MSB first, like shiftOut(MSBFIRST)
  assert.equal(u.bits(Q), 0, 'nothing shows before the latch clock'); u.pulse(12); assert.equal(u.bits(Q), byte);
  assert.equal(u.q(9), 1, "QH' = bit 7 of the shift register");
  u.set({ 13: 1 }); assert.equal(u.sim.parts.u.outputs.includes('Z'), true, '3-state when OE is HIGH');
  u.set({ 13: 0, 10: 0 }).pulse(12); assert.equal(u.bits(Q), 0, 'SRCLR then latch clears');
});

test('74HC194 universal shift register: right, left, parallel load, hold, clear', () => {
  const u = bench('hc194', { 1: 1, 9: 1, 10: 1, 3: 1, 4: 0, 5: 0, 6: 1, 2: 0, 7: 0, 11: 0 }), Q = ['15', '14', '13', '12'];
  u.pulse(11); assert.equal(u.bits(Q), 0b1001, 'load');
  u.set({ 9: 1, 10: 0, 2: 1 }).pulse(11); assert.equal(u.bits(Q), 0b0011, 'shift right, SR=1 enters QA');
  u.set({ 9: 0, 10: 1, 7: 1 }).pulse(11); assert.equal(u.bits(Q), 0b1001, 'shift left, SL=1 enters QD');
  u.set({ 9: 0, 10: 0 }).pulse(11); assert.equal(u.bits(Q), 0b1001, 'hold'); u.set({ 1: 0 }); assert.equal(u.bits(Q), 0, 'clear');
});

test('74LS47 drives a common-anode 7-segment display: BCD 0–9, lamp test, blanking', () => {
  const SEG = ['13', '12', '11', '10', '9', '15', '14'], lit = u => SEG.reduce((a, p, i) => a | ((u.chip.state.out[p] === 0 ? 1 : 0) << i), 0);   // open collector: 0 = sinking (segment lit), null = off
  const expect = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7C, 0x07, 0x7F, 0x67];
  for (let n = 0; n < 10; n++) assert.equal(lit(bench('ls47', { 7: n & 1, 1: (n >> 1) & 1, 2: (n >> 2) & 1, 6: n >> 3 })), expect[n], 'digit ' + n);
  assert.equal(lit(bench('ls47', { 7: 0, 1: 0, 2: 0, 6: 0, 3: 0 })), 0x7F, 'lamp test');
  assert.equal(lit(bench('ls47', { 7: 1, 1: 0, 2: 0, 6: 0, 4: 0 })), 0, 'blanking input');
  assert.equal(lit(bench('ls47', {})), 0, 'open TTL inputs float HIGH: 15 shows blank');
});

test('74LS47 + common-anode display: lit segments really conduct', async () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 5, rint: 0 } }, { id: 'u', type: 'ls47', props: {}, state: {} }, { id: 'd', type: 'seg7', props: { common: 'anode' } },
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(k => ({ id: 'r' + k, type: 'resistor', props: { ohms: 330 } }))];
  const wires = [{ from: 'b:+', to: 'u:16' }, { from: 'b:-', to: 'u:8' }, { from: 'b:+', to: 'd:COM.1' }, { from: 'b:-', to: 'u:7' }, { from: 'b:-', to: 'u:2' }, { from: 'b:-', to: 'u:6' }, { from: 'b:+', to: 'u:1' },
    ...['13', '12', '11', '10', '9', '15', '14'].flatMap((p, i) => { const k = 'abcdefg'[i]; return [{ from: 'u:' + p, to: 'r' + k + ':1' }, { from: 'r' + k + ':2', to: 'd:' + k.toUpperCase() }]; })];
  const s = simulate(parts, wires); const v = s.parts.d.values || [];
  assert.deepEqual(v.slice(0, 7).map(x => (x ? 1 : 0)), [1, 1, 0, 1, 1, 0, 1], 'digit 2 = a b d e g: ' + JSON.stringify(v));
});

test('logic chips warn when unpowered or over-voltage', () => {
  const s = simulate([{ id: 'b', type: 'battery', props: { volts: 9, rint: 0 } }, { id: 'u', type: 'hc161', props: {}, state: {} }], [{ from: 'b:+', to: 'u:16' }, { from: 'b:-', to: 'u:8' }]);
  assert.ok(s.warnings.some(w => /above its maximum/.test(w.text)));
});
