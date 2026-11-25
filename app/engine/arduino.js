// Arduino sketch runner: translates beginner Arduino C/C++ into async JavaScript and runs it
// against simulated pins. Supports: setup/loop, pinMode, digitalWrite/Read, analogWrite/Read,
// delay, millis, micros, Serial.print/println, tone/noTone, map, constrain, random, #define,
// global/local variables, arrays, user functions, pulseIn, and these libraries: DHT, Servo,
// LiquidCrystal_I2C, Adafruit_SSD1306 (text + basic shapes). Not supported: your own classes, pointers.
export const LIBS = ['LiquidCrystal', 'DHT', 'Servo', 'LiquidCrystal_I2C', 'Adafruit_SSD1306', 'OneWire', 'DallasTemperature', 'Adafruit_BMP280', 'BH1750', 'MFRC522', 'Adafruit_NeoPixel', 'TM1637Display', 'LedControl', 'HX711', 'SoftwareSerial'];
const TYPES = '(?:unsigned\\s+)?(?:int|long|float|double|bool|boolean|byte|char|String|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|word|short|size_t)';
const FN_TYPES = '(?:void|' + TYPES + ')';

// ---- 8051 (Keil C51 / SDCC) and PIC (MPLAB XC8) register-level C → Arduino-style program ----
// Ports and pins become calls to __set/__get, delay loops become timed waits, main() runs once with its while(1).
// Insert a yield at the start of every while/for loop body, matching brackets so conditions like (__get("TF0") == 0) work.
function yieldLoops(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const m = /\b(while|for)\s*\(/g; m.lastIndex = i; const hit = m.exec(s);
    if (!hit) { out += s.slice(i); break; }
    let j = hit.index + hit[0].length, depth = 1; while (j < s.length && depth) { if (s[j] === '(') depth++; else if (s[j] === ')') depth--; j++; }
    out += s.slice(i, j); let k = j; while (/\s/.test(s[k])) k++;
    if (s[k] === '{') { out += s.slice(j, k + 1) + ' __spin(0);'; i = k + 1; }
    else if (s[k] === ';' && hit[1] === 'while') { out += ' { __spin(0); }'; i = k + 1; }
    else i = j;
  }
  return out;
}
export function preprocessRegisterC(src, lang) {
  let s = src.replace(/\r/g, '');
  const bits = {};
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // comments first, so text in them is never treated as code
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
  const isrs = [];
  s = s.replace(/\b(void\s+(\w+)\s*\(\s*(?:void)?\s*\))\s*interrupt\s+(\d+)(?:\s+using\s+\d+)?/g, (m, head, name, n) => { isrs.push([+n, name]); return head; });
  const SFR51 = ['TMOD', 'TH0', 'TL0', 'TH1', 'TL1', 'TCON', 'SCON', 'SBUF', 'IE', 'IP', 'PCON', 'TR0', 'TF0', 'TR1', 'TF1', 'TI', 'RI', 'REN', 'EA', 'ET0', 'ET1', 'ES', 'EX0', 'EX1', 'IT0', 'IT1', 'IE0', 'IE1'];
  const regs = lang === 'c51' ? ['P0', 'P1', 'P2', 'P3', ...SFR51] : ['PORTA', 'PORTB', 'PORTC', 'PORTD', 'PORTE', 'TRISA', 'TRISB', 'TRISC', 'TRISD', 'TRISE'];
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
  s = yieldLoops(s);   // while/for bodies (and empty polling loops like while(!TF0);) yield and keep real 8051 speed
  if (isrs.length) s = s.replace(/void setup\(\)\s*\{/, m => m + ' ' + isrs.map(([n, f]) => `__isr(${n}, ${f});`).join(' '));
  preprocessRegisterC.bits = bits; preprocessRegisterC.isrs = isrs;
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
  s = s.replace(/\b([A-Za-z_]\w*)\.(trim|toUpperCase|toLowerCase)\(\)\s*;/g, '$1 = $1.$2();');   // Arduino String methods change the string in place
  s = s.replace(/\(\s*(?:unsigned\s+)?(?:int|long|byte|short|char|uint8_t|uint16_t|int16_t|uint32_t|int32_t)\s*\)\s*([A-Za-z_]\w*(?:\.\w+)?(?:\([^()]*\))?|\([^()]*\))/g, '__int($1)');
  s = s.replace(/\(\s*(?:float|double)\s*\)\s*(?=[\w(])/g, '');
  s = s.replace(/\b(millis|micros)\(\)\s*\/\s*(\d+)(?![.\d])/g, '__int($1() / $2)');   // millis() / 1000 is integer division in C
  const INTS = '(?:unsigned\\s+)?(?:int|long|byte|short|word|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t)';
  s = s.replace(new RegExp('\\b((?:static\\s+)?(?:const\\s+)?' + INTS + ')\\s+([A-Za-z_]\\w*)\\s*=\\s*([^;{}]+);', 'g'), (m, t, n, e) =>
    /^\s*-?\d+\s*$/.test(e) || /,\s*[A-Za-z_]\w*\s*=/.test(e) ? m : `${t} ${n} = __int(${e});`);
  s = s.replace(new RegExp('\\b(?:static\\s+)?(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(?=[A-Za-z_])', 'g'), 'let ');
  s = s.replace(/let\s+(\w+)\s*\[\s*\w*\s*\]\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/let\s+(\w+)\s*\[\s*\w*\s*\]\s*=\s*"((?:[^"\\]|\\.)*)"/g, (m, n, str) => `let ${n} = [${[...(() => { try { return JSON.parse('"' + str + '"'); } catch { return str; } })()].map(c => c.charCodeAt(0)).concat(0).join(', ')}]`);   // char msg[] = "VTU" → bytes + 0
  s = s.replace(/let\s+(\w+)\s*\[\s*(\w+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
  s = s.replace(/\(\s*(?:int|long|float|byte)\s*\)/g, '');           // casts
  s = s.replace(/(\d+(?:\.\d+)?)[uU]?[lL]\b/g, '$1');                     // 1000UL
  const asyncObjs = [...s.matchAll(/let\s+(\w+)\s*=\s*new\s+LiquidCrystal\(/g)].map(m => m[1]);
  for (const o of asyncObjs) s = s.replace(new RegExp('(?<![\\w.])' + o + '\\.(begin|clear|home|setCursor|print|write|display|noDisplay)\\s*\\(', 'g'), `await ${o}.$1(`);
  const calls = ['delay', 'delayMicroseconds', '__spin', ...fnNames.filter(n => n !== 'setup' && n !== 'loop')];
  for (const f of calls) s = s.replace(new RegExp('(?<!function\\s)(?<![\\w.])' + f + '\\s*\\(', 'g'), `await ${f}(`);
  return s;
}

// printf-style formatting: %d %i %u %ld %x %X %c %s %f %.2f %% (width and zero padding supported)
export function cfmt(fmt, a) { let i = 0;
  return String(fmt).replace(/%([-0]?)(\d*)(?:\.(\d+))?(l?)([diuxXcsf%])/g, (m, flag, w, prec, l, t) => {
    if (t === '%') return '%'; let v = a[i++]; if (v && v.__float !== undefined) v = v.__float; let o;
    if (t === 'd' || t === 'i' || t === 'u') o = String(Math.trunc(+v)); else if (t === 'x') o = (Math.trunc(+v) >>> 0).toString(16); else if (t === 'X') o = (Math.trunc(+v) >>> 0).toString(16).toUpperCase();
    else if (t === 'c') o = typeof v === 'number' ? String.fromCharCode(v) : String(v)[0]; else if (t === 's') o = String(v); else o = (+v).toFixed(prec === undefined ? 6 : +prec);
    w = +w || 0; return flag === '-' ? o.padEnd(w) : o.padStart(w, flag === '0' ? '0' : ' '); }); }

export class Stop extends Error {}

// io: { pinMode, digitalWrite, analogWrite, digitalRead, analogRead, serial, tone, noTone, onChange }
export function createRunner(io, { speed = 1, now = () => performance.now(), sleep, board } = {}) {
  let stopped = false, t0 = 0, lastYield = 0, spinDebt = 0, inIsr = false; const isrTable = {};
  const realSleep = sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const delay = async ms => { if (stopped) throw new Stop(); await realSleep(Math.max(0, ms) / speed); if (stopped) throw new Stop(); };
  const pin = p => String(p); let rxq = '';
  const api = {
    HIGH: 1, LOW: 0, OUTPUT: 'OUTPUT', INPUT: 'INPUT', INPUT_PULLUP: 'INPUT_PULLUP', LED_BUILTIN: 13, true: true, false: false,
    MSBFIRST: 1, LSBFIRST: 0, A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5', DEC: 10, HEX: 16, BIN: 2, PI: Math.PI,
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
    TM1637Display: class { constructor(clk, dio) { this.clk = pin(clk); this.dio = pin(dio); this.segs = [0, 0, 0, 0]; this.bright = 7; this.on = true; }
      push() { io.lib?.tm1637?.(this.clk, this.dio, this.on ? this.segs.slice() : [0, 0, 0, 0], this.bright); }
      setBrightness(b, on = true) { this.bright = Math.max(0, Math.min(7, b)); this.on = !!on; }
      encodeDigit(d) { return [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71][d & 15]; }
      setSegments(arr, len = 4, pos = 0) { for (let i = 0; i < len && pos + i < 4; i++) this.segs[pos + i] = arr[i] & 255; this.push(); }
      clear() { this.segs = [0, 0, 0, 0]; this.push(); }
      showNumberDec(n, lz = false, len = 4, pos = 0) { this.showNumberDecEx(n, 0, lz, len, pos); }
      showNumberDecEx(n, dots = 0, lz = false, len = 4, pos = 0) { n = Math.trunc(n); const neg = n < 0; let v = Math.abs(n); const out = Array(len).fill(0);
        for (let i = len - 1; i >= 0; i--) { const d = v % 10; out[i] = (v || lz || i === len - 1) ? this.encodeDigit(d) : 0; v = Math.floor(v / 10); }
        if (neg) { const k = out.findIndex(x => x); if (k > 0) out[k - 1] = 0x40; }
        for (let i = 0; i < len; i++) if ((dots << i) & 0x80) out[i] |= 0x80;   // TM1637Display: 0b01000000 lights the colon (dot after digit 2)
        this.setSegments(out, len, pos); }
      showNumberHexEx(n, dots = 0, lz = false, len = 4, pos = 0) { const out = []; for (let i = len - 1; i >= 0; i--) out[i] = this.encodeDigit((n >> ((len - 1 - i) * 4)) & 15); this.setSegments(out, len, pos); } },
    LedControl: class { constructor(din, clk, cs, n = 1) { Object.assign(this, { din: pin(din), clk: pin(clk), cs: pin(cs), n }); this.rows = Array.from({ length: n }, () => Array(8).fill(0)); this.off = Array(n).fill(true); }
      push(a) { io.lib?.max7219?.(this.din, this.clk, this.cs, a, this.off[a] ? Array(8).fill(0) : this.rows[a].slice()); }
      getDeviceCount() { return this.n; } shutdown(a, b) { this.off[a] = !!b; this.push(a); } setIntensity() {} setScanLimit() {}
      clearDisplay(a) { this.rows[a] = Array(8).fill(0); this.push(a); }
      setLed(a, r, c, on) { const m = 0x80 >> c; this.rows[a][r] = on ? this.rows[a][r] | m : this.rows[a][r] & ~m; this.push(a); }
      setRow(a, r, v) { this.rows[a][r] = v & 255; this.push(a); }
      setColumn(a, c, v) { for (let r = 0; r < 8; r++) this.setLed(a, r, c, (v >> (7 - r)) & 1); } },
    HX711: class { constructor() { this.offset = 0; this.scale = 1; }
      begin(dout, sck) { this.dout = pin(dout); this.sck = pin(sck); }
      raw() { const v = io.lib?.hx711?.(this.dout, this.sck); return v === null || v === undefined ? null : v; }
      is_ready() { return this.raw() !== null; } wait_ready() {}
      read() { return this.raw() ?? 0; } read_average(n = 10) { return this.read(); }
      get_value(n = 1) { return this.read_average(n) - this.offset; } get_units(n = 1) { return this.get_value(n) / this.scale; }
      tare(n = 10) { this.offset = this.read_average(n); } set_scale(s = 1) { this.scale = s || 1; } get_scale() { return this.scale; }
      set_offset(o) { this.offset = o; } get_offset() { return this.offset; } power_down() {} power_up() {} },
    SoftwareSerial: class { constructor(rx, tx) { this.rx = pin(rx); this.tx = pin(tx); this.q = ''; }
      begin() {} listen() { return true; } pull() { this.q += io.lib?.btPoll?.(this.rx) || ''; }
      available() { this.pull(); return this.q.length; } read() { this.pull(); if (!this.q) return -1; const c = this.q.charCodeAt(0); this.q = this.q.slice(1); return c; }
      peek() { this.pull(); return this.q ? this.q.charCodeAt(0) : -1; }
      readString() { this.pull(); const t = this.q; this.q = ''; return t; } readStringUntil(ch) { this.pull(); const c = typeof ch === 'number' ? String.fromCharCode(ch) : ch, k = this.q.indexOf(c); const t = k < 0 ? this.q : this.q.slice(0, k); this.q = k < 0 ? '' : this.q.slice(k + 1); return t; }
      write(v) { io.lib?.btSend?.(this.tx, typeof v === 'number' ? String.fromCharCode(v) : String(v)); } print(v) { io.lib?.btSend?.(this.tx, fmtNum(v)); } println(v = '') { io.lib?.btSend?.(this.tx, fmtNum(v) + '\n'); } },
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
    __isr: (n, f) => { isrTable[n] = f; },
    __spin: async n => { if (stopped) throw new Stop(); spinDebt += n * 0.000784 / speed + (io.takeDebt ? io.takeDebt() / speed : 0);
      const v = io.pendingIrq?.(); if (v !== undefined && v !== null && isrTable[v] && !inIsr) { inIsr = true; try { await isrTable[v](); } finally { inIsr = false; io.retIrq?.(v); } }   // busy-wait time, slept in chunks for accurate timing
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
    printf: (fmt, ...a) => io.serial(cfmt(fmt, a)), sprintf: (buf, fmt, ...a) => cfmt(fmt, a), putchar: c => io.serial(String.fromCharCode(c)),
    LiquidCrystal: class {   // HD44780 in 4-bit mode, driving real pins so the LCD on the board decodes it
      constructor(rs, en, d4, d5, d6, d7) { this.p = { rs: pin(rs), en: pin(en), d: [d4, d5, d6, d7].map(pin) }; }
      async pulse() { io.digitalWrite(this.p.en, 0); io.digitalWrite(this.p.en, 1); io.digitalWrite(this.p.en, 0); await delay(0.05); }
      async nib(v) { this.p.d.forEach((q, i) => io.digitalWrite(q, (v >> i) & 1)); await this.pulse(); }
      async send(v, rs) { io.digitalWrite(this.p.rs, rs); await this.nib(v >> 4); await this.nib(v & 15); }
      async begin(cols = 16, rows = 2) { for (const q of [this.p.rs, this.p.en, ...this.p.d]) io.pinMode(q, 'OUTPUT'); io.digitalWrite(this.p.rs, 0);
        for (const v of [3, 3, 3, 2]) await this.nib(v); for (const c of [0x28, 0x0C, 0x01, 0x06]) await this.send(c, 0); this.rows = rows; }
      async clear() { await this.send(0x01, 0); await delay(2); } async home() { await this.send(0x02, 0); await delay(2); }
      async setCursor(c, r) { await this.send(0x80 | (c + [0, 0x40, 0x14, 0x54][r]), 0); }
      async print(v, d) { if (v && v.__float !== undefined) { v = v.__float; d = d ?? 2; } const t = typeof v !== 'number' ? String(v) : d !== undefined && ![2, 8, 10, 16].includes(d) ? v.toFixed(d) : Number.isInteger(v) ? String(v) : v.toFixed(2);
        for (const ch of t) await this.send(ch.charCodeAt(0), 1); }
      async write(c) { await this.send(c, 1); } async display() { await this.send(0x0C, 0); } async noDisplay() { await this.send(0x08, 0); } },
    __f: v => ({ __float: v }), __int: v => typeof v === 'number' ? Math.trunc(v) : v, isnan: Number.isNaN, isinf: v => !isFinite(v), sq: x => x * x,
    pinMode: (p, m) => io.pinMode(pin(p), m),
    digitalWrite: (p, v) => io.digitalWrite(pin(p), v ? 1 : 0),
    shiftOut: (d, c, order, val) => { for (let i = 0; i < 8; i++) { const b = order === 1 ? (val >> (7 - i)) & 1 : (val >> i) & 1;   // 1 = MSBFIRST
      io.digitalWrite(pin(d), b); io.digitalWrite(pin(c), 1); io.digitalWrite(pin(c), 0); } },
    shiftIn: (d, c, order) => { let v = 0; for (let i = 0; i < 8; i++) { io.digitalWrite(pin(c), 1); const b = io.digitalRead(pin(d)) ? 1 : 0; v |= order === 1 ? b << (7 - i) : b << i; io.digitalWrite(pin(c), 0); } return v; },
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
    Serial: { begin: () => {}, pull() { rxq += io.serialIn?.() || ''; }, available() { this.pull(); return rxq.length; }, read() { this.pull(); if (!rxq) return -1; const c = rxq.charCodeAt(0); rxq = rxq.slice(1); return c; },
      peek() { this.pull(); return rxq ? rxq.charCodeAt(0) : -1; }, readString() { this.pull(); const t = rxq; rxq = ''; return t; },
      readStringUntil(ch) { this.pull(); const c = typeof ch === 'number' ? String.fromCharCode(ch) : ch, k = rxq.indexOf(c); const t = k < 0 ? rxq : rxq.slice(0, k); rxq = k < 0 ? '' : rxq.slice(k + 1); return t; },
      parseInt() { this.pull(); const m = /^\D*?(-?\d+)/.exec(rxq); if (!m) { rxq = ''; return 0; } rxq = rxq.slice(m.index + m[0].length); return +m[1]; },
      parseFloat() { this.pull(); const m = /^[^\d-]*?(-?\d+(?:\.\d+)?)/.exec(rxq); if (!m) { rxq = ''; return 0; } rxq = rxq.slice(m.index + m[0].length); return { __float: +m[1] }; },
      write: v => io.serial(typeof v === 'number' ? String.fromCharCode(v) : String(v)), flush() {},
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
