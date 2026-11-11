import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, ledParams } from '../app/engine/solver.js';
import { simulate } from '../app/engine/circuit.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} ± ${tol}, got ${a}`);
const W = (from, to) => ({ from, to });

test('voltage divider: 9 V across 1k + 2k gives 6 V at the middle (ideal source)', () => {
  const r = solve(3, [{ type: 'S', a: 1, b: 0, v: 9, r: 1e-6 }, { type: 'R', a: 1, b: 2, r: 1000 }, { type: 'R', a: 2, b: 0, r: 2000 }]);
  near(r.V[2], 6, 1e-6);
});

test('LED model: red LED gives 2.0 V at 20 mA', () => {
  const p = ledParams('red');
  const r = solve(2, [{ type: 'I', a: 1, b: 0, i: 0.02 }, { type: 'D', a: 1, c: 0, ...p }]);
  assert.ok(r.converged); near(r.V[1], 2.0, 0.01);
});

const blinkParts = (ohms, color = 'red') => [
  { id: 'u', type: 'uno', props: {} }, { id: 'r', type: 'resistor', props: { ohms } }, { id: 'l', type: 'led', props: { color } }];
const blinkWires = [W('u:13', 'r:1'), W('r:2', 'l:A'), W('l:C', 'u:GND.1')];

test('Arduino pin 13 HIGH → 220 Ω → red LED: about 12 mA, no warnings', () => {
  const s = simulate(blinkParts(220), blinkWires, { pins: { 13: { mode: 'OUTPUT', v: 5 } } });
  const I = s.parts.l.current; near(I, 0.0123, 0.0015, 'LED current');
  assert.ok(s.parts.l.brightness > 0.4);
  assert.equal(s.warnings.length, 0, JSON.stringify(s.warnings));
});

test('pin LOW → LED off', () => {
  const s = simulate(blinkParts(220), blinkWires, { pins: { 13: { mode: 'OUTPUT', v: 0 } } });
  assert.ok(s.parts.l.current < 1e-6);
});

test('LED with no resistor on a 9 V battery burns and warns', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9 } }, { id: 'l', type: 'led', props: { color: 'red' } }];
  const s = simulate(parts, [W('b:+', 'l:A'), W('l:C', 'b:-')]);
  assert.ok(s.parts.l.burn, 'LED should burn');
  assert.ok(s.warnings.some(w => w.level === 'bad' && w.part === 'l'));
});

test('9 V battery + 470 Ω + LED: about 15 mA and safe', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9 } }, { id: 'r', type: 'resistor', props: { ohms: 470 } }, { id: 'l', type: 'led', props: { color: 'red' } }];
  const s = simulate(parts, [W('b:+', 'r:1'), W('r:2', 'l:A'), W('l:C', 'b:-')]);
  near(s.parts.l.current, 0.0148, 0.0015); assert.ok(!s.parts.l.burn);
});

test('reversed LED does not conduct', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9 } }, { id: 'r', type: 'resistor', props: { ohms: 470 } }, { id: 'l', type: 'led', props: { color: 'red' } }];
  const s = simulate(parts, [W('b:+', 'r:1'), W('r:2', 'l:C'), W('l:A', 'b:-')]);
  assert.ok(Math.abs(s.parts.l.current) < 1e-6);
});

test('short circuit across battery is detected', () => {
  const s = simulate([{ id: 'b', type: 'battery', props: { volts: 9 } }], [W('b:+', 'b:-')]);
  assert.ok(s.warnings.some(w => /Short circuit/.test(w.text)));
});

test('shorting Arduino 5V to GND is detected', () => {
  const s = simulate([{ id: 'u', type: 'uno', props: {} }], [W('u:5V', 'u:GND.2')]);
  assert.ok(s.warnings.some(w => /5 V pin/.test(w.text)));
});

test('pin overcurrent: LED with 22 Ω on a pin warns about the ATmega', () => {
  const s = simulate(blinkParts(22), blinkWires, { pins: { 13: { mode: 'OUTPUT', v: 5 } } });
  assert.ok(s.warnings.some(w => /Pin 13/.test(w.text)), JSON.stringify(s.warnings));
});

test('multimeter V: reads 4.5 V across one of two equal resistors', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9, rint: 0 } }, { id: 'r1', type: 'resistor', props: { ohms: 1000 } }, { id: 'r2', type: 'resistor', props: { ohms: 1000 } }, { id: 'm', type: 'meter', props: { mode: 'V' } }];
  const s = simulate(parts, [W('b:+', 'r1:1'), W('r1:2', 'r2:1'), W('r2:2', 'b:-'), W('m:V', 'r2:1'), W('m:COM', 'b:-')]);
  assert.match(s.parts.m.reading, /^4\.5\d* V$/);
});

test('multimeter Ω: 1k + 1k in series reads 2.00 kΩ, open reads OL', () => {
  const parts = [{ id: 'r1', type: 'resistor', props: { ohms: 1000 } }, { id: 'r2', type: 'resistor', props: { ohms: 1000 } }, { id: 'm', type: 'meter', props: { mode: 'Ω' } }];
  let s = simulate(parts, [W('r1:2', 'r2:1'), W('m:V', 'r1:1'), W('m:COM', 'r2:2')]);
  assert.equal(s.parts.m.reading, '2.00 kΩ');
  s = simulate(parts, [W('m:V', 'r1:1'), W('m:COM', 'r2:2')]);
  assert.equal(s.parts.m.reading, 'OL');
});

test('multimeter Ω in a powered circuit warns', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9 } }, { id: 'r', type: 'resistor', props: { ohms: 1000 } }, { id: 'm', type: 'meter', props: { mode: 'Ω' } }];
  const s = simulate(parts, [W('b:+', 'r:1'), W('r:2', 'b:-'), W('m:V', 'r:1'), W('m:COM', 'r:2')]);
  assert.ok(s.warnings.some(w => /powered circuit/.test(w.text)));
});

test('multimeter A in series reads the loop current', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9, rint: 0 } }, { id: 'r', type: 'resistor', props: { ohms: 1000 } }, { id: 'm', type: 'meter', props: { mode: 'A' } }];
  const s = simulate(parts, [W('b:+', 'm:V'), W('m:COM', 'r:1'), W('r:2', 'b:-')]);
  assert.match(s.parts.m.reading, /^8\.99? mA$|^9\.0 mA$/);
});

test('potentiometer: middle position gives 2.5 V from 5 V', () => {
  const parts = [{ id: 'u', type: 'uno', props: {} }, { id: 'p', type: 'pot', props: { pos: 50 } }];
  const s = simulate(parts, [W('p:VCC', 'u:5V'), W('p:GND', 'u:GND.2'), W('p:SIG', 'u:A0')]);
  near(s.voltAt('u', 'A0'), 2.5, 0.02);
});

test('pushbutton with INPUT_PULLUP: released = 5 V, pressed = 0 V', () => {
  const mk = pressed => simulate([{ id: 'u', type: 'uno', props: {} }, { id: 'k', type: 'pushbutton', props: { pressed } }],
    [W('k:1.l', 'u:2'), W('k:2.l', 'u:GND.1')], { pins: { 2: { mode: 'INPUT_PULLUP' } } });
  near(mk(false).voltAt('u', '2'), 5, 0.01); near(mk(true).voltAt('u', '2'), 0, 0.01);
});

test('resistor overheating: 10 Ω across 9 V warns about 0.25 W', () => {
  const s = simulate([{ id: 'b', type: 'battery', props: { volts: 9 } }, { id: 'r', type: 'resistor', props: { ohms: 10 } }], [W('b:+', 'r:1'), W('r:2', 'b:-')]);
  assert.ok(s.warnings.some(w => /0\.25 W/.test(w.text)));
});

test('blue LED needs more voltage: 3.3 V + 100 Ω gives only a few mA', () => {
  const parts = [{ id: 'u', type: 'uno', props: {} }, { id: 'r', type: 'resistor', props: { ohms: 100 } }, { id: 'l', type: 'led', props: { color: 'blue' } }];
  const s = simulate(parts, [W('u:3.3V', 'r:1'), W('r:2', 'l:A'), W('l:C', 'u:GND.1')]);
  assert.ok(s.parts.l.current < 0.004, 'got ' + s.parts.l.current);
});

test('breadboard: same column (a–e) connects, across the channel does not, rails run along', () => {
  const parts = [{ id: 'b', type: 'battery', props: { volts: 9, rint: 0 } }, { id: 'bb', type: 'breadboard', props: {} }, { id: 'r', type: 'resistor', props: { ohms: 1000 } }];
  // battery + → A5, resistor from E5 to TN1 rail, battery − → TN30 (rail continuity)
  let s = simulate(parts, [W('b:+', 'bb:A5'), W('r:1', 'bb:E5'), W('r:2', 'bb:TN1'), W('b:-', 'bb:TN30')]);
  near(s.parts.r.current, 0.009, 1e-4, 'column + rail should conduct');
  s = simulate(parts, [W('b:+', 'bb:A5'), W('r:1', 'bb:F5'), W('r:2', 'bb:TN1'), W('b:-', 'bb:TN30')]);
  assert.ok(Math.abs(s.parts.r.current) < 1e-6, 'across the centre channel must not conduct');
  s = simulate(parts, [W('b:+', 'bb:A5'), W('r:1', 'bb:A6'), W('r:2', 'bb:TN1'), W('b:-', 'bb:TN30')]);
  assert.ok(Math.abs(s.parts.r.current) < 1e-6, 'neighbour columns must not conduct');
});
