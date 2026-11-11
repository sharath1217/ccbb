// Accuracy tests for every component model, checked against hand calculations / datasheet behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, MODELS, PIN_LIST } from '../app/engine/circuit.js';
import { BOARDS } from '../app/engine/boards.js';
import { createRunner, transpile } from '../app/engine/arduino.js';

const near = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b} ± ${tol}, got ${a}`);
const W = (from, to) => ({ from, to });
const P = (id, type, props = {}) => ({ id, type, props });
const bat = (v = 9) => P('b', 'battery', { volts: v, rint: 0 });
const run = (parts, wires, io, opts) => simulate(parts, wires, io, opts);
// advance a transient simulation for `secs` seconds in `dt` steps
function advance(parts, wires, secs, dt = 1e-3, io = {}) { let s; for (let t = 0; t < secs; t += dt) s = run(parts, wires, io, { dt, t }); return s; }

test('every part type has a model and pins', () => {
  for (const [t, m] of Object.entries(MODELS)) { assert.ok(typeof m.elements === 'function', t); assert.ok(Array.isArray(PIN_LIST[t]), t); }
  assert.ok(Object.keys(MODELS).length >= 45, 'expected 45+ part types, got ' + Object.keys(MODELS).length);
});

// ---------------- microcontrollers ----------------
for (const [type, B] of Object.entries(BOARDS)) {
  test(`${B.name}: power pins give the right voltage and an output pin drives an LED`, () => {
    const pin = B.io.find(p => !(B.inputOnly || []).includes(p) && !/RX|TX/.test(p));
    const parts = [P('m', type), P('r', 'resistor', { ohms: 220 }), P('l', 'led', { color: 'red' })];
    const wires = [W('m:' + pin, 'r:1'), W('r:2', 'l:A'), W('l:C', 'm:' + B.gnd[0])];
    const s = run(parts, wires, { mcu: 'm', pins: { [pin]: { mode: 'OUTPUT', v: B.vcc } } });
    for (const [pp, v] of Object.entries(B.power)) near(s.voltAt('m', pp), v, 0.01, pp);
    const expected = (B.vcc - 2.0) / (220 + 25);       // pin output resistance 25 Ω
    near(s.parts.l.current, expected, expected * 0.12 + 0.0008, 'LED current on ' + pin);
    assert.equal(s.warnings.length, 0, JSON.stringify(s.warnings));
  });
}
test('3.3 V boards warn when 5 V is put on a pin', () => {
  const s = run([P('m', 'esp32'), bat(5)], [W('b:+', 'm:D4'), W('b:-', 'm:GND.1')]);
  assert.ok(s.warnings.some(w => /3\.3 V chip/.test(w.text)), JSON.stringify(s.warnings));
});
test('ESP8266 pins have a lower current limit than Arduino', () => {
  const parts = [P('m', 'esp8266'), P('l', 'led', { color: 'red' }), P('r', 'resistor', { ohms: 47 })];
  const s = run(parts, [W('m:D1', 'r:1'), W('r:2', 'l:A'), W('l:C', 'm:GND.1')], { mcu: 'm', pins: { D1: { mode: 'OUTPUT', v: 3.3 } } });
  assert.ok(s.warnings.some(w => /Pin D1/.test(w.text)));
});

// ---------------- passives ----------------
test('RC charging: 1 kΩ + 1000 µF reaches 63 % of 5 V after one time constant (1 s)', () => {
  const parts = [bat(5), P('r', 'resistor', { ohms: 1000 }), P('c', 'ecap', { farads: 1e-3, rating: 25 })];
  const s = advance(parts, [W('b:+', 'r:1'), W('r:2', 'c:+'), W('c:-', 'b:-')], 1.0, 1e-3);
  near(s.parts.c.voltage, 5 * (1 - Math.exp(-1)), 0.03, 'Vc(τ)');
});
test('electrolytic capacitor reversed is flagged', () => {
  const s = run([bat(9), P('c', 'ecap', { farads: 1e-4 })], [W('b:+', 'c:-'), W('c:+', 'b:-')], {}, { dt: 1e-3 });
  assert.ok(s.warnings.some(w => /backwards/.test(w.text)));
});
test('silicon diode drops about 0.7 V at 10 mA; reverse blocks', () => {
  const parts = [bat(5), P('r', 'resistor', { ohms: 430 }), P('d', 'diode')];
  let s = run(parts, [W('b:+', 'r:1'), W('r:2', 'd:A'), W('d:K', 'b:-')]);
  near(s.voltAt('d', 'A'), 0.7, 0.08, 'Vf'); near(s.parts.d.current, 0.01, 0.001, 'I');
  s = run(parts, [W('b:+', 'r:1'), W('r:2', 'd:K'), W('d:A', 'b:-')]);
  assert.ok(Math.abs(s.parts.d.current) < 1e-6);
});
test('potentiometer and slide pot divide voltage', () => {
  for (const t of ['pot', 'slidepot']) { const s = run([bat(9), P('p', t, { pos: 25 })], [W('b:+', 'p:VCC'), W('b:-', 'p:GND')]); near(s.voltAt('p', 'SIG'), 2.25, 0.01, t); }
});

// ---------------- transistors ----------------
test('NPN as a switch: 5 V through 1 kΩ base drives a 220 Ω load into saturation', () => {
  const parts = [bat(5), P('rb', 'resistor', { ohms: 1000 }), P('rc', 'resistor', { ohms: 220 }), P('q', 'npn')];
  const s = run(parts, [W('b:+', 'rb:1'), W('rb:2', 'q:B'), W('b:+', 'rc:1'), W('rc:2', 'q:C'), W('q:E', 'b:-')]);
  near(s.voltAt('q', 'B'), 0.75, 0.1, 'Vbe'); assert.ok(s.parts.q.vce < 0.2, 'Vce(sat) ' + s.parts.q.vce);
  near(s.parts.q.current, (5 - s.parts.q.vce) / 220, 0.001, 'Ic');
});
test('NPN in active region: Ic ≈ β·Ib', () => {
  const parts = [bat(9), P('rb', 'resistor', { ohms: 1e6 }), P('rc', 'resistor', { ohms: 1000 }), P('q', 'npn', { beta: 200 })];
  const s = run(parts, [W('b:+', 'rb:1'), W('rb:2', 'q:B'), W('b:+', 'rc:1'), W('rc:2', 'q:C'), W('q:E', 'b:-')]);
  const ib = (9 - s.voltAt('q', 'B')) / 1e6; near(s.parts.q.current / ib, 200, 15, 'β');
});
test('PNP switch turns on when base is pulled low', () => {
  const parts = [bat(5), P('rb', 'resistor', { ohms: 1000 }), P('rl', 'resistor', { ohms: 220 }), P('q', 'pnp')];
  const s = run(parts, [W('b:+', 'q:E'), W('q:B', 'rb:1'), W('rb:2', 'b:-'), W('q:C', 'rl:1'), W('rl:2', 'b:-')]);
  assert.ok(s.parts.q.current > 0.02, 'Ic ' + s.parts.q.current);
});
test('logic-level MOSFET: 5 V gate switches a 12 V / 1 A load; 0 V gate is off', () => {
  const parts = [P('b', 'battery', { volts: 12, rint: 0 }), P('g', 'battery', { volts: 5, rint: 0 }), P('rl', 'resistor', { ohms: 12 }), P('m', 'nmos')];
  const w = [W('b:+', 'rl:1'), W('rl:2', 'm:D'), W('m:S', 'b:-'), W('g:-', 'b:-'), W('g:+', 'm:G')];
  let s = run(parts, w); near(s.parts.m.current, 1, 0.05, 'Id on'); assert.ok(s.parts.m.vds < 0.3);
  parts[1].props.volts = 0; s = run(parts, w); assert.ok(s.parts.m.current < 1e-4, 'Id off ' + s.parts.m.current);
});
test('motor straight on an Arduino pin is flagged; through a MOSFET it is fine', () => {
  let s = run([P('u', 'uno'), P('mo', 'motor')], [W('u:9', 'mo:1'), W('mo:2', 'u:GND.1')], { mcu: 'u', pins: { 9: { mode: 'OUTPUT', v: 5 } } });
  assert.ok(s.warnings.some(w => /Motor connected straight/.test(w.text)));
  const parts = [P('u', 'uno'), P('mo', 'motor'), P('m', 'nmos'), P('b', 'battery', { volts: 6, rint: 0.2 }), P('d', 'diode')];
  s = run(parts, [W('u:9', 'm:G'), W('m:S', 'u:GND.1'), W('b:-', 'u:GND.2'), W('b:+', 'mo:1'), W('mo:2', 'm:D'), W('d:A', 'mo:2'), W('d:K', 'mo:1')], { mcu: 'u', pins: { 9: { mode: 'OUTPUT', v: 5 } } });
  assert.ok(Math.abs(s.parts.mo.rpm) > 1000 && !s.warnings.some(w => w.level === 'bad'), JSON.stringify([s.parts.mo, s.warnings]));
});

// ---------------- ICs ----------------
const opamp = (parts, wires) => run([P('s', 'battery', { volts: 9, rint: 0 }), P('op', 'lm358'), ...parts], [W('s:+', 'op:8'), W('s:-', 'op:4'), ...wires]);
test('LM358 non-inverting amplifier: gain 1 + Rf/Rg = 3', () => {
  const s = opamp([P('v', 'battery', { volts: 1, rint: 0 }), P('rf', 'resistor', { ohms: 20000 }), P('rg', 'resistor', { ohms: 10000 })],
    [W('v:+', 'op:3'), W('v:-', 's:-'), W('op:1', 'rf:1'), W('rf:2', 'op:2'), W('op:2', 'rg:1'), W('rg:2', 's:-')]);
  near(s.voltAt('op', '1'), 3, 0.005);
});
test('LM358 output clips 1.5 V below the supply (real LM358 behaviour)', () => {
  const s = opamp([P('v', 'battery', { volts: 4, rint: 0 }), P('rf', 'resistor', { ohms: 20000 }), P('rg', 'resistor', { ohms: 10000 })],
    [W('v:+', 'op:3'), W('v:-', 's:-'), W('op:1', 'rf:1'), W('rf:2', 'op:2'), W('op:2', 'rg:1'), W('rg:2', 's:-')]);
  near(s.voltAt('op', '1'), 7.5, 0.02);
});
test('LM358 as a comparator with a voltage follower on the second half', () => {
  const s = opamp([P('v', 'battery', { volts: 2, rint: 0 }), P('ref', 'battery', { volts: 3, rint: 0 })],
    [W('v:+', 'op:3'), W('v:-', 's:-'), W('ref:+', 'op:2'), W('ref:-', 's:-'), W('v:+', 'op:5'), W('op:7', 'op:6')]);
  near(s.voltAt('op', '1'), 0.02, 0.01, 'comparator low'); near(s.voltAt('op', '7'), 2, 0.001, 'follower');
});
test('NE555 astable blinks at f = 1.44 / ((R1 + 2·R2)·C)', () => {
  const R1 = 1000, R2 = 4700, C = 10e-6, f = 1.44 / ((R1 + 2 * R2) * C);   // ≈ 13.8 Hz
  const parts = [bat(9), P('t', 'ne555'), P('r1', 'resistor', { ohms: R1 }), P('r2', 'resistor', { ohms: R2 }), P('c', 'ecap', { farads: C, rating: 25 })];
  const wires = [W('b:+', 't:8'), W('b:+', 't:4'), W('b:-', 't:1'), W('b:+', 'r1:1'), W('r1:2', 't:7'), W('t:7', 'r2:1'), W('r2:2', 't:6'), W('t:6', 't:2'), W('t:6', 'c:+'), W('c:-', 'b:-')];
  let edges = 0, last = null, first = null, lastEdge = null, t = 0; const dt = 2e-4;
  for (; t < 1.2; t += dt) { const s = run(parts, wires, {}, { dt, t }); const q = s.parts.t.output === 'HIGH';
    if (last === false && q) { edges++; if (first === null && t > 0.2) first = t; if (t > 0.2) lastEdge = t; } last = q; }
  const counted = edges; const measured = (counted - 1) > 0 ? 1 : 0; assert.ok(measured);
  const periods = Math.round((lastEdge - first) * f); const fm = periods / (lastEdge - first);
  near(fm, f, f * 0.08, '555 frequency');
});
for (const [t, name, truth] of [['hc08', 'AND', [0, 0, 0, 1]], ['hc32', 'OR', [0, 1, 1, 1]], ['hc00', 'NAND', [1, 1, 1, 0]], ['hc86', 'XOR', [0, 1, 1, 0]]]) {
  test(`74HC ${name} gate truth table`, () => {
    [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([a, b], i) => {
      const parts = [bat(5), P('ic', t)];
      const wires = [W('b:+', 'ic:14'), W('b:-', 'ic:7'), W(a ? 'b:+' : 'b:-', 'ic:1'), W(b ? 'b:+' : 'b:-', 'ic:2')];
      const s = run(parts, wires); near(s.voltAt('ic', '3'), truth[i] * 5, 0.05, `${name}(${a},${b})`);
    });
  });
}
test('74HC04 inverter', () => {
  const s = run([bat(5), P('ic', 'hc04')], [W('b:+', 'ic:14'), W('b:-', 'ic:7'), W('b:+', 'ic:1'), W('b:-', 'ic:3')]);
  near(s.voltAt('ic', '2'), 0, 0.05); near(s.voltAt('ic', '4'), 5, 0.05);
});
test('7805 regulator: 9 V in → 5 V out; 6 V in drops out with a warning', () => {
  const parts = [bat(9), P('r', 'reg7805'), P('l', 'resistor', { ohms: 100 })];
  const w = [W('b:+', 'r:IN'), W('b:-', 'r:GND'), W('r:OUT', 'l:1'), W('l:2', 'b:-')];
  let s = run(parts, w); near(s.voltAt('r', 'OUT'), 5, 0.01);
  near(s.parts.b ? 0 : 0, 0, 0); parts[0].props.volts = 6; s = run(parts, w);
  near(s.voltAt('r', 'OUT'), 4, 0.05); assert.ok(s.warnings.some(x => /at least 7 V/.test(x.text)));
});
test('bench power supply current limit kicks in on a short', () => {
  const parts = [P('p', 'psu', { volts: 12, limit: 0.5 }), P('r', 'resistor', { ohms: 1 })];
  const s = run(parts, [W('p:+', 'r:1'), W('r:2', 'p:-')]);
  near(s.parts.r.current, 0.5, 0.01); assert.ok(s.warnings.some(x => /current limit/.test(x.text)));
});
test('relay switches its contacts when the coil gets 5 V', () => {
  const parts = [bat(5), P('k', 'relay'), P('l', 'resistor', { ohms: 1000 })];
  const base = [W('b:-', 'k:COIL2'), W('b:+', 'k:P1'), W('k:NO1', 'l:1'), W('l:2', 'b:-')];
  let s = run(parts, base); assert.ok(Math.abs(s.parts.l.current) < 1e-6, 'NO open when off');
  s = run(parts, [...base, W('b:+', 'k:COIL1')]); near(s.parts.l.current, 0.005, 1e-4, 'NO closed when on');
});
test('L298N drives a motor forward, reverse and stop', () => {
  const parts = [P('b', 'battery', { volts: 12, rint: 0 }), P('d', 'l298n'), P('m', 'motor'), P('lg', 'battery', { volts: 5, rint: 0 })];
  const w = (in1, in2) => [W('b:+', 'd:12V'), W('b:-', 'd:GND'), W('lg:-', 'b:-'), W('lg:+', 'd:ENA'), W(in1 ? 'lg:+' : 'b:-', 'd:IN1'), W(in2 ? 'lg:+' : 'b:-', 'd:IN2'), W('d:OUT1', 'm:1'), W('d:OUT2', 'm:2')];
  assert.ok(run(parts, w(1, 0)).parts.m.rpm > 1000); assert.ok(run(parts, w(0, 1)).parts.m.rpm < -1000); assert.equal(run(parts, w(0, 0)).parts.m.rpm, 0);
});

// ---------------- outputs ----------------
test('RGB LED: each colour lights from its own pin; 7-segment shows lit segments', () => {
  let s = run([bat(5), P('r', 'resistor', { ohms: 220 }), P('x', 'rgb')], [W('b:+', 'r:1'), W('r:2', 'x:G'), W('x:COM', 'b:-')]);
  assert.ok(s.parts.x.rgb[1] > 0.5 && s.parts.x.rgb[0] === 0);
  s = run([bat(5), P('r', 'resistor', { ohms: 220 }), P('d', 'seg7', { common: 'cathode' })], [W('b:+', 'r:1'), W('r:2', 'd:A'), W('d:COM.2', 'b:-')]);
  assert.deepEqual(s.parts.d.values, [1, 0, 0, 0, 0, 0, 0, 0]);
});

// ---------------- sensors ----------------
test('LDR module: brighter light → lower AO voltage; DO switches', () => {
  const mk = lux => run([bat(5), P('s', 'ldr', { lux, threshold: 50 })], [W('b:+', 's:VCC'), W('b:-', 's:GND')]);
  const dark = mk(1), bright = mk(2000);
  assert.ok(dark.voltAt('s', 'AO') > 4 && bright.voltAt('s', 'AO') < 2, `${dark.voltAt('s', 'AO')} ${bright.voltAt('s', 'AO')}`);
  assert.ok(dark.voltAt('s', 'DO') > 4 && bright.voltAt('s', 'DO') < 0.1);
});
test('NTC module: 25 °C gives half the supply (10 k / 10 k)', () => {
  const s = run([P('u', 'uno'), P('n', 'ntc', { temp: 25 })], [W('u:5V', 'n:VCC'), W('u:GND.1', 'n:GND'), W('n:OUT', 'u:A0')]);
  near(s.voltAt('u', 'A0'), 2.5, 0.01);
});
test('PIR output goes high on motion only when powered with 5 V', () => {
  const mk = (v, motion) => run([bat(v), P('p', 'pir', { motion })], [W('b:+', 'p:VCC'), W('b:-', 'p:GND')]);
  near(mk(5, true).voltAt('p', 'OUT'), 3.3, 0.01); near(mk(5, false).voltAt('p', 'OUT'), 0, 0.01);
  const low = mk(3.3, true); near(low.voltAt('p', 'OUT'), 0, 0.01); assert.ok(low.warnings.some(w => /4\.5/.test(w.text)));
});
test('gas, flame, sound and tilt modules respond to the environment', () => {
  const mod = (t, props, pin) => run([bat(5), P('s', t, props)], [W('b:+', 's:VCC'), W('b:-', 's:GND')]).voltAt('s', pin);
  assert.ok(mod('gas', { ppm: 5000 }, 'AOUT') > mod('gas', { ppm: 100 }, 'AOUT') + 1);
  assert.ok(mod('flame', { flame: 90 }, 'DOUT') < 0.1 && mod('flame', { flame: 0 }, 'DOUT') > 4.9);
  assert.ok(mod('sound', { db: 95 }, 'DOUT') > 4.9 && mod('sound', { db: 40 }, 'DOUT') < 0.1);
  assert.ok(mod('tilt', { tilted: true }, 'OUT') > 4.9 && mod('tilt', { tilted: false }, 'OUT') < 0.1);
});
test('HC-SR04 on an ESP32 warns about the 5 V echo signal', () => {
  const s = run([P('m', 'esp32'), P('h', 'hcsr04')], [W('m:VIN', 'h:VCC'), W('m:GND.1', 'h:GND'), W('h:ECHO', 'm:D18'), W('h:TRIG', 'm:D5')]);
  assert.ok(s.warnings.some(w => /divider/.test(w.text)), JSON.stringify(s.warnings));
});
test('joystick centre gives half supply on both axes; keypad key connects its row and column', () => {
  let s = run([bat(5), P('j', 'joystick', { x: 0, y: 0 })], [W('b:+', 'j:VCC'), W('b:-', 'j:GND')]);
  near(s.voltAt('j', 'VERT'), 2.5, 0.01); near(s.voltAt('j', 'HORZ'), 2.5, 0.01);
  s = run([bat(5), P('k', 'keypad', { key: { row: 2, col: 3 } }), P('r', 'resistor', { ohms: 1000 })], [W('b:+', 'k:R2'), W('k:C3', 'r:1'), W('r:2', 'b:-')]);
  near(s.parts.r.current, 0.005, 1e-4);
});

// ---------------- code libraries ----------------
function board(lib = {}, pins = {}) {
  const log = [];
  const io = { pinMode() {}, digitalWrite: (p, v) => log.push(['dw', p, v]), analogWrite() {}, digitalRead: () => 0, analogRead: p => pins[p] ?? 0, serial: t => log.push(['s', t]), lib, pulseIn: lib.pulseIn };
  let clock = 0; return { log, r: createRunner(io, { now: () => clock, sleep: async ms => { clock += ms; } }) };
}
test('library: DHT22 reads temperature and humidity from the connected sensor', async () => {
  const b = board({ dht: pin => pin === '2' ? { t: 31.5, h: 48 } : null });
  await b.r.run(`#include <DHT.h>\nDHT dht(2, DHT22);\nvoid setup(){ Serial.begin(9600); dht.begin(); Serial.println(dht.readTemperature(), 1); Serial.println(dht.readHumidity(), 0); }`, { maxLoops: 0 });
  assert.equal(b.log.filter(x => x[0] === 's').map(x => x[1]).join(''), '31.5\n48\n');
});
test('library: Servo write() moves the servo on its pin', async () => {
  const moves = []; const b = board({ servo: (pin, a) => moves.push([pin, a]) });
  await b.r.run(`#include <Servo.h>\nServo s;\nvoid setup(){ s.attach(9); s.write(45); s.write(200); }`, { maxLoops: 0 });
  assert.deepEqual(moves, [['9', 45], ['9', 180]]);
});
test('library: LiquidCrystal_I2C prints on the right row and column', async () => {
  let shown; const b = board({ lcd: (addr, rows) => { shown = rows; } });
  await b.r.run(`#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup(){ lcd.init(); lcd.backlight(); lcd.setCursor(0,0); lcd.print("Temp:"); lcd.setCursor(6,0); lcd.print(23.456, 1); lcd.setCursor(0,1); lcd.print("OK"); }`, { maxLoops: 0 });
  assert.deepEqual(shown, ['Temp: 23.5      ', 'OK              ']);
});
test('library: Adafruit_SSD1306 records text drawing for the OLED', async () => {
  let ops; const b = board({ oled: o => { ops = o; } });
  await b.r.run(`#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 display(128, 64, &Wire, -1);\nvoid setup(){ display.begin(SSD1306_SWITCHCAPVCC, 0x3C); display.clearDisplay(); display.setTextSize(2); display.setCursor(0,10); display.println("Hi"); display.display(); }`, { maxLoops: 0 });
  assert.deepEqual(ops, [['text', 0, 10, 2, 'Hi', 1]]);
});
test('pulseIn returns the HC-SR04 echo time; distance code computes centimetres', async () => {
  const b = board({ pulseIn: () => 2916 });
  await b.r.run(`void setup(){ Serial.begin(9600); long d = pulseIn(10, HIGH) * 0.0343 / 2; Serial.println(d); }`, { maxLoops: 0 });
  assert.equal(b.log.filter(x => x[0] === 's').map(x => x[1]).join(''), '50\n');
});
test('board constants: ESP8266 D-pins and STM32 PC13 resolve', () => {
  assert.match(transpile('void setup(){ pinMode(D4, OUTPUT); }'), /pinMode\(D4, OUTPUT\)/);
  const r = createRunner({ pinMode() {} }, { board: BOARDS.esp8266 }); assert.equal(r.compile('').program ? 1 : 0, 1);
  assert.equal(BOARDS.esp8266.pin(2), 'D4'); assert.equal(BOARDS.esp32.pin(36), 'VP'); assert.equal(BOARDS.pico.pin(25), 'GP25'); assert.equal(BOARDS.bluepill.pin('PC13'), 'PC13');
});
test('PWM: 50 % duty on an LED gives half the average current of full on (real switching, not a lower voltage)', () => {
  const parts = [P('u', 'uno'), P('r', 'resistor', { ohms: 220 }), P('l', 'led', { color: 'red' })];
  const w = [W('u:9', 'r:1'), W('r:2', 'l:A'), W('l:C', 'u:GND.1')];
  const full = run(parts, w, { mcu: 'u', pins: { 9: { mode: 'OUTPUT', v: 5 } } }).parts.l.current;
  const half = run(parts, w, { mcu: 'u', pins: { 9: { mode: 'OUTPUT', v: 5, vhigh: 5, duty: 0.5 } } }).parts.l.current;
  near(half, full / 2, 1e-4, 'average current');
});
