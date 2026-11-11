import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transpile, createRunner } from '../app/engine/arduino.js';

function fakeBoard(inputs = {}) {
  const log = [], pins = {}, serial = [];
  const io = {
    pinMode: (p, m) => { pins[p] = { ...(pins[p] || {}), mode: m }; log.push(['mode', p, m]); },
    digitalWrite: (p, v) => { pins[p] = { ...(pins[p] || {}), v }; log.push(['dw', p, v]); },
    analogWrite: (p, v) => log.push(['aw', p, v]),
    digitalRead: p => inputs[p] ?? 0, analogRead: p => inputs[p] ?? 0,
    serial: t => serial.push(t), tone: (p, f) => log.push(['tone', p, f]), noTone: p => log.push(['notone', p]),
  };
  let clock = 0;
  const runner = createRunner(io, { now: () => clock, sleep: async ms => { clock += ms; } });
  return { runner, log, pins, serial: () => serial.join('') };
}

test('transpiles function, variable and array declarations', () => {
  const js = transpile('#define LED 13\nint arr[3] = {1,2,3};\nunsigned long t = 0;\nvoid setup() { pinMode(LED, OUTPUT); }\nint twice(int x) { return x*2; }\nvoid loop(){ delay(10); t = twice(2); }');
  assert.match(js, /const LED = 13;/); assert.match(js, /let arr = \[1,2,3\]/); assert.match(js, /let t = 0/);
  assert.match(js, /async function twice\(x\)/); assert.match(js, /await twice\(2\)/); assert.match(js, /await delay\(10\)/);
});

test('Blink toggles pin 13 every 1000 ms', async () => {
  const b = fakeBoard();
  await b.runner.run(`void setup(){ pinMode(LED_BUILTIN, OUTPUT); }
void loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(1000); digitalWrite(LED_BUILTIN, LOW); delay(1000); }`, { maxLoops: 2 });
  const w = b.log.filter(x => x[0] === 'dw').map(x => x[2]);
  assert.deepEqual(w, [1, 0, 1, 0]);
  assert.deepEqual(b.log[0], ['mode', '13', 'OUTPUT']);
});

test('Serial prints numbers and floats like Arduino', async () => {
  const b = fakeBoard();
  await b.runner.run(`void setup(){ Serial.begin(9600); int x = 42; float f = 3.14159; Serial.print("x="); Serial.println(x); Serial.println(f); Serial.println(255, HEX); }`, { maxLoops: 0 });
  assert.equal(b.serial(), 'x=42\n3.14\nFF\n');
});

test('button logic with INPUT_PULLUP reads pin and drives LED', async () => {
  const b = fakeBoard({ 2: 0 });
  await b.runner.run(`const int BTN = 2; const int LED = 13;
void setup(){ pinMode(BTN, INPUT_PULLUP); pinMode(LED, OUTPUT); }
void loop(){ if (digitalRead(BTN) == LOW) { digitalWrite(LED, HIGH); } else { digitalWrite(LED, LOW); } }`, { maxLoops: 1 });
  assert.deepEqual(b.log.at(-1), ['dw', '13', 1]);
});

test('analogRead + map + analogWrite dimmer', async () => {
  const b = fakeBoard({ A0: 1023 });
  await b.runner.run(`void setup(){} void loop(){ int v = analogRead(A0); analogWrite(9, map(v, 0, 1023, 0, 255)); }`, { maxLoops: 1 });
  assert.deepEqual(b.log.at(-1), ['aw', '9', 255]);
});

test('for loops, arrays and millis work', async () => {
  const b = fakeBoard();
  await b.runner.run(`int pins[3] = {2,3,4};
void setup(){ for (int i = 0; i < 3; i++) { pinMode(pins[i], OUTPUT); digitalWrite(pins[i], HIGH); } delay(250); Serial.println(millis()); }`, { maxLoops: 0 });
  assert.equal(b.log.filter(x => x[0] === 'dw').length, 3); assert.equal(b.serial(), '250\n');
});

test('stop() ends an infinite loop', async () => {
  const b = fakeBoard();
  const real = createRunner({ ...{ pinMode() {}, digitalWrite() {}, analogWrite() {}, digitalRead: () => 0, analogRead: () => 0, serial() {} } });
  const p = real.run(`void loop(){ delay(1); }`);
  setTimeout(() => real.stop(), 30);
  await p; assert.ok(real.stopped); assert.ok(b);
});

test('syntax errors are reported, not swallowed', () => {
  const b = fakeBoard();
  assert.throws(() => b.runner.compile('void setup( { }'));
});
