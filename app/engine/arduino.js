// Arduino sketch runner: translates beginner Arduino C/C++ into async JavaScript and runs it
// against simulated pins. Supports: setup/loop, pinMode, digitalWrite/Read, analogWrite/Read,
// delay, millis, micros, Serial.print/println, tone/noTone, map, constrain, random, #define,
// global/local variables, arrays, user functions. Not supported: classes, pointers, libraries.
const TYPES = '(?:unsigned\\s+)?(?:int|long|float|double|bool|boolean|byte|char|String|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|word|short|size_t)';
const FN_TYPES = '(?:void|' + TYPES + ')';

export function transpile(src) {
  let s = src.replace(/\r/g, '');
  s = s.replace(/^\s*#include.*$/gm, '');
  s = s.replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, 'const $1 = $2;');
  const fnNames = [];
  s = s.replace(new RegExp('\\b' + FN_TYPES + '\\s+([A-Za-z_]\\w*)\\s*\\(([^)]*)\\)\\s*\\{', 'g'), (m, name, params) => {
    fnNames.push(name);
    const ps = params.trim() === 'void' ? '' : params.split(',').map(x => x.trim().split(/\s+/).pop().replace(/[\[\]&*]/g, '')).filter(Boolean).join(', ');
    return `async function ${name}(${ps}) {`;
  });
  s = s.replace(new RegExp('\\b(?:static\\s+)?(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(?=[A-Za-z_])', 'g'), 'let ');
  s = s.replace(/let\s+(\w+)\s*\[\s*\w*\s*\]\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/let\s+(\w+)\s*\[\s*(\w+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
  s = s.replace(/\(\s*(?:int|long|float|byte)\s*\)/g, '');           // casts
  s = s.replace(/(\d+(?:\.\d+)?)[uU]?[lL]\b/g, '$1');                     // 1000UL
  const calls = ['delay', 'delayMicroseconds', ...fnNames.filter(n => n !== 'setup' && n !== 'loop')];
  for (const f of calls) s = s.replace(new RegExp('(?<!function\\s)(?<![\\w.])' + f + '\\s*\\(', 'g'), `await ${f}(`);
  return s;
}

export class Stop extends Error {}

// io: { pinMode, digitalWrite, analogWrite, digitalRead, analogRead, serial, tone, noTone, onChange }
export function createRunner(io, { speed = 1, now = () => performance.now(), sleep } = {}) {
  let stopped = false, t0 = 0;
  const realSleep = sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const delay = async ms => { if (stopped) throw new Stop(); await realSleep(Math.max(0, ms) / speed); if (stopped) throw new Stop(); };
  const pin = p => String(p);
  const api = {
    HIGH: 1, LOW: 0, OUTPUT: 'OUTPUT', INPUT: 'INPUT', INPUT_PULLUP: 'INPUT_PULLUP', LED_BUILTIN: 13, true: true, false: false,
    A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5', DEC: 10, HEX: 16, BIN: 2, PI: Math.PI,
    pinMode: (p, m) => io.pinMode(pin(p), m),
    digitalWrite: (p, v) => io.digitalWrite(pin(p), v ? 1 : 0),
    analogWrite: (p, v) => io.analogWrite(pin(p), Math.max(0, Math.min(255, Math.round(v)))),
    digitalRead: p => io.digitalRead(pin(p)),
    analogRead: p => io.analogRead(pin(typeof p === 'number' && p < 6 ? 'A' + p : p)),
    tone: (p, f) => io.tone?.(pin(p), f), noTone: p => io.noTone?.(pin(p)),
    delay, delayMicroseconds: us => delay(us / 1000),
    millis: () => Math.floor((now() - t0) * speed), micros: () => Math.floor((now() - t0) * speed * 1000),
    map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c),
    constrain: (x, a, b) => Math.min(Math.max(x, a), b), min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
    random: (a, b) => b === undefined ? Math.floor(Math.random() * a) : Math.floor(a + Math.random() * (b - a)),
    randomSeed: () => {},
    Serial: { begin: () => {}, available: () => 0, read: () => -1,
      print: (v, base) => io.serial(fmtNum(v, base)), println: (v = '', base) => io.serial(fmtNum(v, base) + '\n') },
  };
  function fmtNum(v, base) {
    if (typeof v === 'number' && base && base !== 10 && base < 10) return Math.trunc(v).toString(base);
    if (typeof v === 'number' && base === 16) return Math.trunc(v).toString(16).toUpperCase();
    if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(typeof base === 'number' && base <= 6 ? base : 2);
    return String(v);
  }
  return {
    compile(src) {
      const js = transpile(src);
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const names = Object.keys(api).filter(k => k !== 'true' && k !== 'false');
      const factory = new Function(...names, `"use strict";\n${js}\nreturn { setup: typeof setup==='function'?setup:async()=>{}, loop: typeof loop==='function'?loop:async()=>{} };`);
      return { js, program: factory(...names.map(n => api[n])) };
    },
    async run(src, { maxLoops = Infinity } = {}) {
      stopped = false; t0 = now();
      const { program } = this.compile(src);
      try {
        await program.setup();
        let last = now();
        for (let i = 0; i < maxLoops && !stopped; i++) {
          await program.loop();
          if (now() - last > 12) { await realSleep(0); last = now(); }
        }
      } catch (e) { if (!(e instanceof Stop)) throw e; }
    },
    stop() { stopped = true; },
    get stopped() { return stopped; },
  };
}
