// Arduino sketch runner: translates beginner Arduino C/C++ into async JavaScript and runs it
// against simulated pins. Supports: setup/loop, pinMode, digitalWrite/Read, analogWrite/Read,
// delay, millis, micros, Serial.print/println, tone/noTone, map, constrain, random, #define,
// global/local variables, arrays, user functions, pulseIn, and these libraries: DHT, Servo,
// LiquidCrystal_I2C, Adafruit_SSD1306 (text + basic shapes). Not supported: your own classes, pointers.
export const LIBS = ['DHT', 'Servo', 'LiquidCrystal_I2C', 'Adafruit_SSD1306', 'OneWire', 'DallasTemperature', 'Adafruit_BMP280', 'BH1750', 'MFRC522', 'Adafruit_NeoPixel'];
const TYPES = '(?:unsigned\\s+)?(?:int|long|float|double|bool|boolean|byte|char|String|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|word|short|size_t)';
const FN_TYPES = '(?:void|' + TYPES + ')';

// ---- 8051 (Keil C51 / SDCC) and PIC (MPLAB XC8) register-level C → Arduino-style program ----
// Ports and pins become calls to __set/__get, delay loops become timed waits, main() runs once with its while(1).
export function preprocessRegisterC(src, lang) {
  let s = src.replace(/\r/g, '');
  const bits = {};
  s = s.replace(/^\s*#(include|pragma|use|fuses).*$/gm, '').replace(/^\s*#define\s+_XTAL_FREQ.*$/gm, '');
  if (lang === 'c51') {
    s = s.replace(/\bsbit\s+(\w+)\s*=\s*(P[0-3])\s*\^\s*([0-7])\s*;/g, (m, n, port, b) => { bits[n] = port + '.' + b; return ''; });
    s = s.replace(/\b(P[0-3])_([0-7])\b/g, (m, port, b) => { const n = `${port}_${b}`; bits[n] = port + '.' + b; return n; });
  } else {
    s = s.replace(/\b(PORT|LAT|TRIS)([A-E])bits\.(?:R|LAT|TRIS)?([A-E])?(\d)\b/g, (m, reg, port, p2, b) => reg === 'TRIS' ? `TRIS${port}${b}` : `R${port}${b}`);
    s = s.replace(/\bLAT([A-E])\b/g, 'PORT$1');
  }
  s = s.replace(/\b__delay_ms\s*\(/g, 'delay(').replace(/\b__delay_us\s*\(/g, 'delayMicroseconds(');
  s = s.replace(/\bbit\b(?=\s+\w)/g, 'bool');
  const regs = lang === 'c51' ? ['P0', 'P1', 'P2', 'P3'] : ['PORTA', 'PORTB', 'PORTC', 'PORTD', 'PORTE', 'TRISA', 'TRISB', 'TRISC', 'TRISD', 'TRISE'];
  const pinRe = lang === 'c51' ? null : /\b(R[A-E]\d|TRIS[A-E]\d)\b/g;
  const names = [...regs, ...Object.keys(bits)];
  if (pinRe) for (const m of s.matchAll(pinRe)) if (!names.includes(m[1])) names.push(m[1]);
  const NAMES = names.sort((a, b) => b.length - a.length).join('|');
  // empty busy-wait loops → timed delay (the classic 8051 loop of 1275 iterations ≈ 1 ms at 11.0592 MHz)
  s = s.replace(/for\s*\(\s*(\w+)\s*=\s*(\d+)\s*;\s*\1\s*(<=?)\s*(\d+)\s*;\s*\1\s*\+\+\s*\)\s*;/g, (m, v, a, op, b) => `{ ${v} = ${b}; __spin(${+b - +a + (op === '<=' ? 1 : 0)}); }`);
  // compound and plain assignments to ports / pins
  s = s.replace(new RegExp('\\b(' + NAMES + ')\\s*([|&^+\\-])=\\s*([^;]+);', 'g'), (m, n, op, e) => `__set("${n}", __get("${n}") ${op} (${e}));`);
  s = s.replace(new RegExp('\\b(' + NAMES + ')\\s*=(?!=)\\s*([^;]+);', 'g'), (m, n, e) => `__set("${n}", ${e});`);
  s = s.replace(new RegExp('~\\s*(' + Object.keys(bits).concat(pinRe ? [...s.matchAll(/__set\("(R[A-E]\d)"/g)].map(x => x[1]) : []).join('|') + ')\\b', 'g'), (m, n) => n ? `!${n}` : m);
  s = s.replace(new RegExp('(?<!["\\w])(' + NAMES + ')(?![\\w"])', 'g'), '__get("$1")');
  s = s.replace(/__set\("__get\("(\w+)"\)"/g, '__set("$1"');
  // main() with while(1) becomes setup(); loops yield so the page stays responsive
  s = s.replace(/\b(?:void|int)\s+main\s*\(\s*(?:void)?\s*\)/, 'void setup()');
  s = s.replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, 'while ($1) { __spin(0);');
  preprocessRegisterC.bits = bits;
  return s;
}

export function transpile(src) {
  let s = src.replace(/\r/g, '');
  s = s.replace(/^\s*#include.*$/gm, '');
  s = s.replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, 'const $1 = $2;');
  s = s.replace(/&\s*Wire\b/g, 'Wire');
  s = s.replace(new RegExp('\\b(' + LIBS.join('|') + ')\\s+(\\w+)\\s*(?:\\(([^;]*)\\))?\\s*;', 'g'), (m, cls, name, args) => `let ${name} = new ${cls}(${(args || '').replace(/&\s*/g, '')});`);
  const floats = [...s.matchAll(/\b(?:float|double)\s+([A-Za-z_]\w*)/g)].map(m => m[1]);
  if (floats.length) s = s.replace(new RegExp('\\.(print|println)\\(\\s*(' + floats.join('|') + ')\\s*([,)])', 'g'), '.$1(__f($2)$3');
  const fnNames = [];
  s = s.replace(new RegExp('\\b' + FN_TYPES + '\\s+([A-Za-z_]\\w*)\\s*\\(([^)]*)\\)\\s*\\{', 'g'), (m, name, params) => {
    fnNames.push(name);
    const ps = params.trim() === 'void' ? '' : params.split(',').map(x => x.trim().split(/\s+/).pop().replace(/[\[\]&*]/g, '')).filter(Boolean).join(', ');
    return `async function ${name}(${ps}) {`;
  });
  const INTS = '(?:unsigned\\s+)?(?:int|long|byte|short|word|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t)';
  s = s.replace(new RegExp('\\b((?:static\\s+)?(?:const\\s+)?' + INTS + ')\\s+([A-Za-z_]\\w*)\\s*=\\s*([^;{}]+);', 'g'), (m, t, n, e) =>
    /^\s*-?\d+\s*$/.test(e) || /,\s*[A-Za-z_]\w*\s*=/.test(e) ? m : `${t} ${n} = __int(${e});`);
  s = s.replace(new RegExp('\\b(?:static\\s+)?(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(?=[A-Za-z_])', 'g'), 'let ');
  s = s.replace(/let\s+(\w+)\s*\[\s*\w*\s*\]\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/let\s+(\w+)\s*\[\s*(\w+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
  s = s.replace(/\(\s*(?:int|long|float|byte)\s*\)/g, '');           // casts
  s = s.replace(/(\d+(?:\.\d+)?)[uU]?[lL]\b/g, '$1');                     // 1000UL
  const calls = ['delay', 'delayMicroseconds', '__spin', ...fnNames.filter(n => n !== 'setup' && n !== 'loop')];
  for (const f of calls) s = s.replace(new RegExp('(?<!function\\s)(?<![\\w.])' + f + '\\s*\\(', 'g'), `await ${f}(`);
  return s;
}

export class Stop extends Error {}

// io: { pinMode, digitalWrite, analogWrite, digitalRead, analogRead, serial, tone, noTone, onChange }
export function createRunner(io, { speed = 1, now = () => performance.now(), sleep, board } = {}) {
  let stopped = false, t0 = 0, lastYield = 0, spinDebt = 0;
  const realSleep = sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const delay = async ms => { if (stopped) throw new Stop(); await realSleep(Math.max(0, ms) / speed); if (stopped) throw new Stop(); };
  const pin = p => String(p);
  const api = {
    HIGH: 1, LOW: 0, OUTPUT: 'OUTPUT', INPUT: 'INPUT', INPUT_PULLUP: 'INPUT_PULLUP', LED_BUILTIN: 13, true: true, false: false,
    A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5', DEC: 10, HEX: 16, BIN: 2, PI: Math.PI,
    INPUT_PULLDOWN: 'INPUT_PULLDOWN', DHT11: 11, DHT22: 22, SSD1306_SWITCHCAPVCC: 2, SSD1306_WHITE: 1, SSD1306_BLACK: 0, WHITE: 1, BLACK: 0,
    Wire: { begin: () => {}, setClock: () => {} },
    pulseIn: (p, level = 1, timeout = 1e6) => io.pulseIn ? io.pulseIn(pin(p), level, timeout) : 0,
    DHT: class { constructor(p, type) { this.pin = pin(p); this.type = type; this.last = -1e9; this.cache = null; }
      begin() {} read() { const t = now(); if (t - this.last >= 2000 / speed || !this.cache) { this.cache = io.lib?.dht?.(this.pin) || null; this.last = t; } return this.cache; }
      readTemperature(f) { const r = this.read(); return r ? (f ? r.t * 9 / 5 + 32 : r.t) : NaN; }
      readHumidity() { const r = this.read(); return r ? r.h : NaN; } },
    Servo: class { attach(p) { this.pin = pin(p); this.a = 90; return 1; } detach() { this.pin = null; } attached() { return !!this.pin; }
      write(a) { this.a = Math.max(0, Math.min(180, Math.round(a))); if (this.pin) io.lib?.servo?.(this.pin, this.a); }
      writeMicroseconds(us) { this.write((us - 544) / (2400 - 544) * 180); } read() { return this.a; } },
    LiquidCrystal_I2C: class { constructor(addr = 0x27, cols = 16, rows = 2) { Object.assign(this, { addr, cols, rows, x: 0, y: 0, bl: true }); this.buf = Array.from({ length: rows }, () => ' '.repeat(cols)); }
      push() { io.lib?.lcd?.(this.addr, this.buf.slice(), this.bl); }
      init() { this.push(); } begin() { this.push(); } backlight() { this.bl = true; this.push(); } noBacklight() { this.bl = false; this.push(); }
      clear() { this.buf = this.buf.map(() => ' '.repeat(this.cols)); this.x = this.y = 0; this.push(); } home() { this.x = this.y = 0; }
      setCursor(x, y) { this.x = x; this.y = y; }
      print(v, d) { if (v && v.__float !== undefined) v = v.__float, d = d ?? 2; let t = typeof v !== 'number' ? String(v) : d !== undefined && ![2, 8, 10, 16].includes(d) ? v.toFixed(d) : Number.isInteger(v) ? String(v) : v.toFixed(2);
        const row = this.buf[this.y]; if (row === undefined) return; this.buf[this.y] = (row.slice(0, this.x) + t + row.slice(this.x + t.length)).slice(0, this.cols); this.x += t.length; this.push(); } },
    Adafruit_SSD1306: class { constructor(w = 128, h = 64) { Object.assign(this, { w, h, ops: [], size: 1, x: 0, y: 0, color: 1 }); }
      begin() { return true; } clearDisplay() { this.ops = []; } display() { io.lib?.oled?.(this.ops.slice()); }
      setTextSize(n) { this.size = n; } setTextColor(c) { this.color = c; } setCursor(x, y) { this.x = x; this.y = y; }
      print(v, d) { if (v && v.__float !== undefined) { v = v.__float; d = d ?? 2; } const t = typeof v !== 'number' ? String(v) : d !== undefined && ![2, 8, 10, 16].includes(d) ? v.toFixed(d) : Number.isInteger(v) ? String(v) : v.toFixed(2); this.ops.push(['text', this.x, this.y, this.size, t, this.color]); this.x += t.length * 6 * this.size; }
      println(v = '', d) { this.print(v, d); this.x = 0; this.y += 8 * this.size; }
      drawPixel(x, y, c = 1) { this.ops.push(['px', x, y, c]); } drawLine(a, b, c2, d, c = 1) { this.ops.push(['line', a, b, c2, d, c]); }
      drawRect(x, y, w, h, c = 1) { this.ops.push(['rect', x, y, w, h, c, 0]); } fillRect(x, y, w, h, c = 1) { this.ops.push(['rect', x, y, w, h, c, 1]); }
      drawCircle(x, y, r, c = 1) { this.ops.push(['circle', x, y, r, c, 0]); } fillCircle(x, y, r, c = 1) { this.ops.push(['circle', x, y, r, c, 1]); } },
    ...(board?.consts || {}),
    __spin: async n => { if (stopped) throw new Stop(); spinDebt += n * 0.000784 / speed;   // busy-wait time, slept in chunks for accurate timing
      if (spinDebt >= 8) { const d = spinDebt; spinDebt = 0; await realSleep(d); lastYield = now(); } else if (now() - lastYield > 12) { lastYield = now(); await realSleep(0); } if (stopped) throw new Stop(); },
    __set: (r, v) => io.regSet?.(r, v), __get: r => io.regGet ? io.regGet(r) : 0,
    SPI: { begin: () => {}, end: () => {} }, NEO_GRB: 0, NEO_RGB: 1, NEO_KHZ800: 0,
    OneWire: class { constructor(p) { this.pin = pin(p); } },
    DallasTemperature: class { constructor(w) { this.pin = w?.pin; } begin() {} requestTemperatures() {} getDeviceCount() { return io.lib?.ds18b20?.(this.pin) == null ? 0 : 1; }
      getTempCByIndex() { const t = io.lib?.ds18b20?.(this.pin); return t == null ? -127 : t; } getTempFByIndex() { const t = this.getTempCByIndex(); return t === -127 ? -196.6 : t * 9 / 5 + 32; } },
    Adafruit_BMP280: class { begin() { return !!io.lib?.bmp280?.(); } readTemperature() { return io.lib?.bmp280?.()?.t ?? NaN; } readPressure() { return io.lib?.bmp280?.()?.p ?? NaN; }
      readAltitude(sea = 1013.25) { const pr = this.readPressure() / 100; return 44330 * (1 - Math.pow(pr / sea, 0.1903)); } },
    BH1750: class { begin() { return !!io.lib?.bh1750?.(); } readLightLevel() { return io.lib?.bh1750?.() ?? -1; } },
    MFRC522: class { constructor(ss, rst) { this.uid = { size: 0, uidByte: [] }; } PCD_Init() {} PICC_HaltA() {} PCD_StopCrypto1() {}
      PICC_IsNewCardPresent() { const c = io.lib?.rfid?.(); if (!c) { this.last = null; return false; } if (this.last === c) return false; this.pending = c; return true; }
      PICC_ReadCardSerial() { if (!this.pending) return false; const b = this.pending.split(' ').map(x => parseInt(x, 16)); this.uid = { size: b.length, uidByte: b }; this.last = this.pending; this.pending = null; return true; } },
    Adafruit_NeoPixel: class { constructor(n, p) { this.n = n; this.pin = pin(p); this.px = Array.from({ length: n }, () => [0, 0, 0]); this.br = 255; }
      begin() {} show() { io.lib?.neopixel?.(this.pin, this.px.map(c => c.map(v => Math.round(v * this.br / 255)))); } clear() { this.px = this.px.map(() => [0, 0, 0]); }
      setBrightness(b) { this.br = b; } numPixels() { return this.n; } Color(r, g, b) { return (r << 16) | (g << 8) | b; }
      setPixelColor(i, r, g, b) { if (i < 0 || i >= this.n) return; this.px[i] = g === undefined ? [(r >> 16) & 255, (r >> 8) & 255, r & 255] : [r, g, b]; } },
    __f: v => ({ __float: v }), __int: v => typeof v === 'number' ? Math.trunc(v) : v, isnan: Number.isNaN, isinf: v => !isFinite(v), sq: x => x * x,
    pinMode: (p, m) => io.pinMode(pin(p), m),
    digitalWrite: (p, v) => io.digitalWrite(pin(p), v ? 1 : 0),
    analogWrite: (p, v) => io.analogWrite(pin(p), Math.max(0, Math.min(255, Math.round(v)))),
    digitalRead: p => io.digitalRead(pin(p)),
    analogRead: p => io.analogRead(pin(typeof p === 'number' && p < 6 ? 'A' + p : p)),
    tone: (p, f, d) => io.tone?.(pin(p), f, d), noTone: p => io.noTone?.(pin(p)),
    delay, delayMicroseconds: us => delay(us / 1000),
    millis: () => Math.floor((now() - t0) * speed), micros: () => Math.floor((now() - t0) * speed * 1000),
    map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c),
    constrain: (x, a, b) => Math.min(Math.max(x, a), b), min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow,
    random: (a, b) => b === undefined ? Math.floor(Math.random() * a) : Math.floor(a + Math.random() * (b - a)),
    randomSeed: () => {},
    Serial: { begin: () => {}, available: () => 0, read: () => -1,
      print: (v, base) => io.serial(fmtNum(v, base)), println: (v = '', base) => io.serial(fmtNum(v, base) + '\n') },
  };
  // Arduino: print(int, base) for base 2/8/16, print(float, digits) otherwise
  function fmtNum(v, base) {
    if (v && v.__float !== undefined) return isNaN(v.__float) ? 'nan' : v.__float.toFixed(base !== undefined && ![2, 8, 10, 16].includes(base) ? base : 2);
    if (typeof v !== 'number') return String(v);
    if (Number.isInteger(v) && (base === 2 || base === 8 || base === 16)) return Math.trunc(v).toString(base).toUpperCase();
    if (base !== undefined && ![2, 8, 10, 16].includes(base)) return v.toFixed(base);          // print(x, digits)
    if (!Number.isInteger(v)) return v.toFixed(2);
    return String(v);
  }
  return {
    compile(src) {
      const js = transpile(src);
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const names = Object.keys(api).filter(k => k !== 'true' && k !== 'false' && /^[A-Za-z_]\w*$/.test(k));
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
