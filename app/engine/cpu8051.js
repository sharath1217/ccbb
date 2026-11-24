// 8051 (AT89S52) instruction-level emulator and two-pass assembler.
// Covers the full MCS-51 instruction set (255 opcodes), PSW flags, register banks, internal/external RAM,
// timers 0/1 (modes 0–2), serial port, interrupts and the four I/O ports.

// ---------------- opcode table ----------------
const SIZE = { direct: 1, '#data': 1, '#data16': 2, bit: 1, '/bit': 1, rel: 1, addr11: 1, addr16: 2 };
export const OPS = [];
const def = (op, mn, ops = [], cy = 1) => { OPS[op] = { op, mn, ops, cy, size: 1 + ops.reduce((s, k) => s + (SIZE[k] || 0), 0) }; };
const Rn = (base, mn, pre = [], post = [], cy = 1) => { for (let n = 0; n < 8; n++) def(base + n, mn, [...pre, 'R' + n, ...post], cy); };
const Ri = (base, mn, pre = [], post = [], cy = 1) => { for (let i = 0; i < 2; i++) def(base + i, mn, [...pre, '@R' + i, ...post], cy); };
def(0x00, 'NOP');
for (let p = 0; p < 8; p++) { def(0x01 + p * 32, 'AJMP', ['addr11'], 2); def(0x11 + p * 32, 'ACALL', ['addr11'], 2); }
def(0x02, 'LJMP', ['addr16'], 2); def(0x12, 'LCALL', ['addr16'], 2);
def(0x03, 'RR', ['A']); def(0x13, 'RRC', ['A']); def(0x23, 'RL', ['A']); def(0x33, 'RLC', ['A']);
def(0x04, 'INC', ['A']); def(0x05, 'INC', ['direct']); Ri(0x06, 'INC'); Rn(0x08, 'INC');
def(0x14, 'DEC', ['A']); def(0x15, 'DEC', ['direct']); Ri(0x16, 'DEC'); Rn(0x18, 'DEC');
def(0x10, 'JBC', ['bit', 'rel'], 2); def(0x20, 'JB', ['bit', 'rel'], 2); def(0x30, 'JNB', ['bit', 'rel'], 2);
def(0x40, 'JC', ['rel'], 2); def(0x50, 'JNC', ['rel'], 2); def(0x60, 'JZ', ['rel'], 2); def(0x70, 'JNZ', ['rel'], 2); def(0x80, 'SJMP', ['rel'], 2);
def(0x22, 'RET', [], 2); def(0x32, 'RETI', [], 2);
for (const [b, mn] of [[0x20, 'ADD'], [0x30, 'ADDC'], [0x90, 'SUBB']]) { def(b + 4, mn, ['A', '#data']); def(b + 5, mn, ['A', 'direct']); Ri(b + 6, mn, ['A']); Rn(b + 8, mn, ['A']); }
for (const [b, mn] of [[0x40, 'ORL'], [0x50, 'ANL'], [0x60, 'XRL']]) { def(b + 2, mn, ['direct', 'A']); def(b + 3, mn, ['direct', '#data'], 2); def(b + 4, mn, ['A', '#data']); def(b + 5, mn, ['A', 'direct']); Ri(b + 6, mn, ['A']); Rn(b + 8, mn, ['A']); }
def(0x72, 'ORL', ['C', 'bit'], 2); def(0xA0, 'ORL', ['C', '/bit'], 2); def(0x82, 'ANL', ['C', 'bit'], 2); def(0xB0, 'ANL', ['C', '/bit'], 2);
def(0x73, 'JMP', ['@A+DPTR'], 2);
def(0x74, 'MOV', ['A', '#data']); def(0x75, 'MOV', ['direct', '#data'], 2); Ri(0x76, 'MOV', [], ['#data']); Rn(0x78, 'MOV', [], ['#data']);
def(0x83, 'MOVC', ['A', '@A+PC'], 2); def(0x93, 'MOVC', ['A', '@A+DPTR'], 2);
def(0x84, 'DIV', ['AB'], 4); def(0xA4, 'MUL', ['AB'], 4);
def(0x85, 'MOV', ['direct', 'direct'], 2); Ri(0x86, 'MOV', ['direct'], [], 2); Rn(0x88, 'MOV', ['direct'], [], 2);
def(0x90, 'MOV', ['DPTR', '#data16'], 2); def(0x92, 'MOV', ['bit', 'C'], 2); def(0xA2, 'MOV', ['C', 'bit']);
def(0xA3, 'INC', ['DPTR'], 2); Ri(0xA6, 'MOV', [], ['direct'], 2); Rn(0xA8, 'MOV', [], ['direct'], 2);
def(0xB2, 'CPL', ['bit']); def(0xB3, 'CPL', ['C']);
def(0xB4, 'CJNE', ['A', '#data', 'rel'], 2); def(0xB5, 'CJNE', ['A', 'direct', 'rel'], 2); Ri(0xB6, 'CJNE', [], ['#data', 'rel'], 2); Rn(0xB8, 'CJNE', [], ['#data', 'rel'], 2);
def(0xC0, 'PUSH', ['direct'], 2); def(0xD0, 'POP', ['direct'], 2);
def(0xC2, 'CLR', ['bit']); def(0xC3, 'CLR', ['C']); def(0xE4, 'CLR', ['A']); def(0xD2, 'SETB', ['bit']); def(0xD3, 'SETB', ['C']); def(0xF4, 'CPL', ['A']);
def(0xC4, 'SWAP', ['A']); def(0xC5, 'XCH', ['A', 'direct']); Ri(0xC6, 'XCH', ['A']); Rn(0xC8, 'XCH', ['A']);
def(0xD4, 'DA', ['A']); def(0xD5, 'DJNZ', ['direct', 'rel'], 2); Ri(0xD6, 'XCHD', ['A']); Rn(0xD8, 'DJNZ', [], ['rel'], 2);
def(0xE0, 'MOVX', ['A', '@DPTR'], 2); Ri(0xE2, 'MOVX', ['A'], [], 2); def(0xE5, 'MOV', ['A', 'direct']); Ri(0xE6, 'MOV', ['A']); Rn(0xE8, 'MOV', ['A']);
def(0xF0, 'MOVX', ['@DPTR', 'A'], 2); Ri(0xF2, 'MOVX', [], ['A'], 2); def(0xF5, 'MOV', ['direct', 'A']); Ri(0xF6, 'MOV', [], ['A']); Rn(0xF8, 'MOV', [], ['A']);

// ---------------- SFRs and named bits ----------------
export const SFR = { P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87, TCON: 0x88, TMOD: 0x89, TL0: 0x8A, TL1: 0x8B, TH0: 0x8C, TH1: 0x8D, P1: 0x90, SCON: 0x98, SBUF: 0x99,
  P2: 0xA0, IE: 0xA8, P3: 0xB0, IP: 0xB8, T2CON: 0xC8, RCAP2L: 0xCA, RCAP2H: 0xCB, TL2: 0xCC, TH2: 0xCD, PSW: 0xD0, ACC: 0xE0, A: 0xE0, B: 0xF0 };
export const BITS = { IT0: 0x88, IE0: 0x89, IT1: 0x8A, IE1: 0x8B, TR0: 0x8C, TF0: 0x8D, TR1: 0x8E, TF1: 0x8F, RI: 0x98, TI: 0x99, RB8: 0x9A, TB8: 0x9B, REN: 0x9C, SM2: 0x9D, SM1: 0x9E, SM0: 0x9F,
  EX0: 0xA8, ET0: 0xA9, EX1: 0xAA, ET1: 0xAB, ES: 0xAC, ET2: 0xAD, EA: 0xAF, RXD: 0xB0, TXD: 0xB1, INT0: 0xB2, INT1: 0xB3, T0: 0xB4, T1: 0xB5, WR: 0xB6, RD: 0xB7,
  PX0: 0xB8, PT0: 0xB9, PX1: 0xBA, PT1: 0xBB, PS: 0xBC, P: 0xD0, OV: 0xD2, RS0: 0xD3, RS1: 0xD4, F0: 0xD5, AC: 0xD6, CY: 0xD7 };
const RESERVED = new Set(['A', 'C', 'AB', 'DPTR', '@DPTR', '@A+DPTR', '@A+PC', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', '@R0', '@R1']);

// ---------------- assembler ----------------
export function assemble(src) {
  const lines = src.replace(/\r/g, '').split('\n'), sym = { ...SFR }, bits = { ...BITS }, errors = [], listing = [];
  const code = new Uint8Array(65536); let maxAddr = 0;
  const strip = l => { let out = '', q = null; for (const ch of l) { if (q) { out += ch; if (ch === q) q = null; } else if (ch === "'" || ch === '"') { q = ch; out += ch; } else if (ch === ';') break; else out += ch; } return out; };
  const splitOps = s => { const out = []; let cur = '', q = null; for (const ch of s) { if (q) { cur += ch; if (ch === q) q = null; } else if (ch === "'" || ch === '"') { q = ch; cur += ch; } else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  const num = (t, pc, pass) => {
    t = t.trim(); if (!t) throw new Error('missing value');
    const terms = t.replace(/\s+/g, '').match(/[+\-]?[^+\-]+/g) || []; let v = 0;
    for (let term of terms) { let sign = 1; if (term[0] === '-') { sign = -1; term = term.slice(1); } else if (term[0] === '+') term = term.slice(1);
      let m, x; const U = term.toUpperCase();
      if ((m = /^(HIGH|LOW)\((.+)\)$/i.exec(term))) { const y = num(m[2], pc, pass); x = m[1].toUpperCase() === 'HIGH' ? (y >> 8) & 255 : y & 255; }
      else if (/^'.'$/.test(term)) x = term.charCodeAt(1);
      else if (term === '$') x = pc;
      else if (/^0X[0-9A-F]+$/i.test(term)) x = parseInt(term.slice(2), 16);
      else if (/^[0-9][0-9A-F]*H$/i.test(term)) x = parseInt(term.slice(0, -1), 16);
      else if (/^[01]+B$/i.test(term)) x = parseInt(term.slice(0, -1), 2);
      else if (/^[0-9]+D?$/i.test(term)) x = parseInt(term, 10);
      else if (U in sym) x = sym[U];
      else if (U in bits) x = bits[U];
      else if (pass === 1) x = 0; else throw new Error(`unknown symbol "${term}"`);
      v += sign * x; }
    return v;
  };
  const bitAddr = (t, pc, pass) => { const U = t.toUpperCase().trim(); if (U in bits) return bits[U];
    const m = /^(.+)\.([0-7])$/.exec(U); if (m) { const base = num(m[1], pc, pass); if (base >= 0x20 && base <= 0x2F) return (base - 0x20) * 8 + +m[2]; if (base >= 0x80 && (base & 7) === 0) return base + +m[2]; if (pass === 2) throw new Error(`${m[1]} is not bit-addressable`); return 0; }
    return num(t, pc, pass); };
  const matches = (kind, t) => { const U = t.toUpperCase().replace(/\s+/g, '');
    if (['A', 'C', 'AB', 'DPTR', '@DPTR', '@A+DPTR', '@A+PC'].includes(kind) || /^@?R[0-7]$/.test(kind)) return U === kind;
    if (kind === '#data' || kind === '#data16') return U.startsWith('#');
    if (kind === '/bit') return U.startsWith('/');
    return !RESERVED.has(U) && !U.startsWith('#') && !U.startsWith('/'); };
  const pick = (mn, ops) => { if (mn === 'JMP' && !/^@A\+DPTR$/i.test(ops[0]?.replace(/\s+/g, ''))) mn = 'LJMP'; if (mn === 'CALL') mn = 'LCALL';
    return OPS.find(o => o && o.mn === mn && o.ops.length === ops.length && o.ops.every((k, i) => matches(k, ops[i]))); };
  for (const pass of [1, 2]) {
    let pc = 0;
    lines.forEach((raw, ln) => {
      let l = strip(raw).trim(); if (!l) return;
      try {
        let m;
        if ((m = /^([A-Za-z_]\w*)\s+(EQU|SET|DATA|IDATA|XDATA|CODE)\s+(.+)$/i.exec(l))) { sym[m[1].toUpperCase()] = num(m[3], pc, pass); return; }
        if ((m = /^([A-Za-z_]\w*)\s+BIT\s+(.+)$/i.exec(l))) { bits[m[1].toUpperCase()] = bitAddr(m[2], pc, pass); return; }
        if ((m = /^([A-Za-z_]\w*):\s*(.*)$/.exec(l))) { if (pass === 1) { if (m[1].toUpperCase() in sym && !(m[1].toUpperCase() in SFR)) throw new Error(`label "${m[1]}" defined twice`); sym[m[1].toUpperCase()] = pc; } l = m[2].trim(); if (!l) return; }
        const sp = l.search(/\s/), mn = (sp < 0 ? l : l.slice(0, sp)).toUpperCase(), rest = sp < 0 ? '' : l.slice(sp + 1).trim();
        if (mn === 'ORG') { pc = num(rest, pc, pass); return; }
        if (mn === 'END') { pc = 1e9; return; }
        if (pc >= 1e9) return;
        if (mn === 'DB' || mn === 'DW') { for (const o of splitOps(rest)) {
            if (/^".*"$|^'.{2,}'$/.test(o)) { for (const ch of o.slice(1, -1)) { if (pass === 2) code[pc] = ch.charCodeAt(0); pc++; } }
            else { const v = num(o, pc, pass); if (mn === 'DW') { if (pass === 2) { code[pc] = (v >> 8) & 255; code[pc + 1] = v & 255; } pc += 2; } else { if (pass === 2) code[pc] = v & 255; pc++; } } }
          maxAddr = Math.max(maxAddr, pc); return; }
        if (mn === 'DS') { pc += num(rest, pc, pass); return; }
        const ops = splitOps(rest), o = pick(mn, ops);
        if (!o) throw new Error(OPS.some(x => x && x.mn === (mn === 'CALL' ? 'LCALL' : mn === 'JMP' ? 'LJMP' : mn)) ? `wrong operands for ${mn}: "${rest}"` : `unknown instruction "${mn}"`);
        if (pass === 2) {
          const bytes = [o.op]; let a11 = null;
          const vals = o.ops.map((k, i) => {
            const t = ops[i].replace(/^#/, '').replace(/^\//, '');
            if (k === 'direct' || k === '#data') { const v = num(t, pc, pass); if (v < -128 || v > 255) throw new Error(`value ${v} does not fit in 8 bits`); return [k, v & 255]; }
            if (k === '#data16' || k === 'addr16') return [k, num(t, pc, pass) & 0xFFFF];
            if (k === 'bit' || k === '/bit') { const v = bitAddr(t, pc, pass); if (v < 0 || v > 255) throw new Error('bad bit address'); return [k, v]; }
            if (k === 'rel') { const d = num(t, pc, pass) - (pc + o.size); if (d < -128 || d > 127) throw new Error(`jump to "${t}" is too far (${d} bytes); use LJMP`); return [k, d & 255]; }
            if (k === 'addr11') { const target = num(t, pc, pass); if ((target & 0xF800) !== ((pc + o.size) & 0xF800)) throw new Error('AJMP/ACALL target outside the 2 KB page'); a11 = target; return [k, target & 255]; }
            return [k, null]; });
          if (a11 !== null) bytes[0] |= ((a11 >> 8) & 7) << 5;
          let ordered = vals.filter(([, v]) => v !== null);
          if (o.op === 0x85) ordered = [ordered[1], ordered[0]];          // MOV direct,direct is encoded source first
          for (const [k, v] of ordered) { if (k === '#data16' || k === 'addr16') bytes.push(v >> 8, v & 255); else bytes.push(v); }
          bytes.forEach((b, i) => { code[pc + i] = b; });
          listing.push({ line: ln + 1, addr: pc, bytes, text: raw.trim() });
        }
        pc += o.size; maxAddr = Math.max(maxAddr, pc);
      } catch (e) { if (pass === 2 || /twice/.test(e.message)) errors.push({ line: ln + 1, msg: e.message }); }
    });
  }
  return { code, size: maxAddr, errors, listing, symbols: sym };
}

// ---------------- CPU ----------------
const parity = v => { v ^= v >> 4; v ^= v >> 2; v ^= v >> 1; return v & 1; };
export class CPU51 {
  constructor(code, { xtal = 11.0592e6, readPort, onPortWrite, onSerial } = {}) {
    this.code = code; this.xtal = xtal; this.readPort = readPort || (() => 0xFF); this.onPortWrite = onPortWrite || (() => {}); this.onSerial = onSerial || (() => {});
    this.iram = new Uint8Array(256); this.sfr = new Uint8Array(256); this.xram = new Uint8Array(65536); this.reset();
  }
  reset() { this.pc = 0; this.iram.fill(0); this.sfr.fill(0); this.sfr[0x81] = 7; for (const p of [0x80, 0x90, 0xA0, 0xB0]) this.sfr[p] = 0xFF;
    this.cycles = 0; this.inService = []; this.txBusy = 0; this.rxQueue = []; this.halted = false; this.lastPins = {}; }
  get time() { return this.cycles * 12 / this.xtal; }
  // ----- register helpers -----
  get A() { return this.sfr[0xE0]; } set A(v) { this.sfr[0xE0] = v & 255; }
  get PSW() { return (this.sfr[0xD0] & 0xFE) | parity(this.sfr[0xE0]); }
  get CY() { return this.sfr[0xD0] >> 7; } set CY(v) { this.sfr[0xD0] = (this.sfr[0xD0] & 0x7F) | (v ? 0x80 : 0); }
  setFlag(bit, v) { this.sfr[0xD0] = v ? this.sfr[0xD0] | (1 << bit) : this.sfr[0xD0] & ~(1 << bit); }
  get bank() { return (this.sfr[0xD0] >> 3) & 3; }
  R(n) { return this.iram[this.bank * 8 + n]; } setR(n, v) { this.iram[this.bank * 8 + n] = v & 255; }
  get DPTR() { return (this.sfr[0x83] << 8) | this.sfr[0x82]; } set DPTR(v) { this.sfr[0x83] = (v >> 8) & 255; this.sfr[0x82] = v & 255; }
  rd(a, latch = false) {   // direct address read (ports read the pins unless it is a read-modify-write)
    if (a < 0x80) return this.iram[a];
    if ([0x80, 0x90, 0xA0, 0xB0].includes(a) && !latch) return this.sfr[a] & this.readPort((a - 0x80) >> 4);
    if (a === 0xD0) return this.PSW;
    if (a === 0x99) return this.sbufIn || 0;
    return this.sfr[a]; }
  wr(a, v) { v &= 255; if (a < 0x80) { this.iram[a] = v; return; }
    if (a === 0x99) { this.sfr[0x99] = v; this.txBusy = this.serialBitTime() * 10 || 1040; this.txByte = v; return; }
    this.sfr[a] = v; if ([0x80, 0x90, 0xA0, 0xB0].includes(a)) this.onPortWrite((a - 0x80) >> 4, v); }
  bitAddr(b) { return b < 0x80 ? [0x20 + (b >> 3), b & 7] : [b & 0xF8, b & 7]; }
  rdBit(b, latch = false) { const [a, n] = this.bitAddr(b); return (this.rd(a, latch) >> n) & 1; }
  wrBit(b, v) { const [a, n] = this.bitAddr(b); const cur = this.rd(a, true); this.wr(a, v ? cur | (1 << n) : cur & ~(1 << n)); }
  push(v) { this.sfr[0x81] = (this.sfr[0x81] + 1) & 255; this.iram[this.sfr[0x81]] = v & 255; }
  pop() { const v = this.iram[this.sfr[0x81]]; this.sfr[0x81] = (this.sfr[0x81] - 1) & 255; return v; }
  fetch() { const v = this.code[this.pc]; this.pc = (this.pc + 1) & 0xFFFF; return v; }
  serialBitTime() { const smod = this.sfr[0x87] >> 7, th1 = this.sfr[0x8D]; const baud = (2 ** smod / 32) * (this.xtal / 12) / (256 - th1); return baud > 0 ? Math.round((this.xtal / 12) / baud) : 0; }
  // ----- operand access -----
  get_(k, x, rmw) { switch (k) {
    case 'A': return this.A; case 'C': return this.CY; case 'direct': return this.rd(x, rmw); case '#data': return x; case 'bit': return this.rdBit(x, rmw); case '/bit': return this.rdBit(x) ^ 1;
    case '@R0': return this.iram[this.R(0)]; case '@R1': return this.iram[this.R(1)]; default: if (k[0] === 'R') return this.R(+k[1]); } }
  set_(k, x, v) { switch (k) {
    case 'A': this.A = v; return; case 'C': this.CY = v; return; case 'direct': this.wr(x, v); return; case 'bit': this.wrBit(x, v); return;
    case '@R0': this.iram[this.R(0)] = v & 255; return; case '@R1': this.iram[this.R(1)] = v & 255; return; default: if (k[0] === 'R') this.setR(+k[1], v); } }
  add(v, carry) { const a = this.A, c = carry ? this.CY : 0, r = a + v + c;
    this.setFlag(6, ((a & 15) + (v & 15) + c) > 15); this.setFlag(2, ((a ^ r) & (v ^ r) & 0x80) !== 0); this.CY = r > 255; this.A = r; }
  subb(v) { const a = this.A, c = this.CY, r = a - v - c;
    this.setFlag(6, (a & 15) - (v & 15) - c < 0); this.setFlag(2, ((a ^ v) & (a ^ r) & 0x80) !== 0); this.CY = r < 0; this.A = r; }
  // ----- one instruction -----
  step() {
    const at = this.pc, o = OPS[this.fetch()];
    if (!o) { this.halted = true; throw new Error(`invalid opcode at ${at.toString(16).toUpperCase().padStart(4, '0')}H`); }
    const raw = []; for (const k of o.ops) { if (k === '#data16' || k === 'addr16') raw.push((this.fetch() << 8) | this.fetch()); else if (SIZE[k]) raw.push(this.fetch()); else raw.push(null); }
    if (o.op === 0x85) { const t = raw[0]; raw[0] = raw[1]; raw[1] = t; }          // MOV direct,direct: dst is the second byte
    const [k0, k1] = o.ops, [x0, x1] = raw, rel = d => (this.pc + ((d << 24) >> 24)) & 0xFFFF;
    switch (o.mn) {
      case 'NOP': break;
      case 'AJMP': this.pc = (this.pc & 0xF800) | ((o.op >> 5) << 8) | x0; break;
      case 'ACALL': this.push(this.pc & 255); this.push(this.pc >> 8); this.pc = (this.pc & 0xF800) | ((o.op >> 5) << 8) | x0; break;
      case 'LJMP': this.pc = x0; break;
      case 'LCALL': this.push(this.pc & 255); this.push(this.pc >> 8); this.pc = x0; break;
      case 'RET': this.pc = (this.pop() << 8) | this.pop(); break;
      case 'RETI': this.pc = (this.pop() << 8) | this.pop(); this.inService.pop(); break;
      case 'SJMP': this.pc = rel(x0); break;
      case 'JMP': this.pc = (this.A + this.DPTR) & 0xFFFF; break;
      case 'JC': if (this.CY) this.pc = rel(x0); break; case 'JNC': if (!this.CY) this.pc = rel(x0); break;
      case 'JZ': if (!this.A) this.pc = rel(x0); break; case 'JNZ': if (this.A) this.pc = rel(x0); break;
      case 'JB': if (this.rdBit(x0)) this.pc = rel(x1); break; case 'JNB': if (!this.rdBit(x0)) this.pc = rel(x1); break;
      case 'JBC': if (this.rdBit(x0, true)) { this.wrBit(x0, 0); this.pc = rel(x1); } break;
      case 'RR': this.A = (this.A >> 1) | ((this.A & 1) << 7); break; case 'RL': this.A = (this.A << 1) | (this.A >> 7); break;
      case 'RRC': { const c = this.CY; this.CY = this.A & 1; this.A = (this.A >> 1) | (c << 7); break; }
      case 'RLC': { const c = this.CY; this.CY = this.A >> 7; this.A = (this.A << 1) | c; break; }
      case 'INC': if (k0 === 'DPTR') this.DPTR = (this.DPTR + 1) & 0xFFFF; else this.set_(k0, x0, this.get_(k0, x0, true) + 1); break;
      case 'DEC': this.set_(k0, x0, this.get_(k0, x0, true) - 1); break;
      case 'ADD': this.add(this.get_(k1, x1), false); break; case 'ADDC': this.add(this.get_(k1, x1), true); break; case 'SUBB': this.subb(this.get_(k1, x1)); break;
      case 'ORL': case 'ANL': case 'XRL': { const f = { ORL: (a, b) => a | b, ANL: (a, b) => a & b, XRL: (a, b) => a ^ b }[o.mn]; this.set_(k0, x0, f(this.get_(k0, x0, true), this.get_(k1, x1))); break; }
      case 'MOV': if (k0 === 'DPTR') this.DPTR = x1; else this.set_(k0, x0, this.get_(k1, x1)); break;
      case 'MOVC': this.A = this.code[((k1 === '@A+PC' ? this.pc : this.DPTR) + this.A) & 0xFFFF]; break;
      case 'MOVX': { const addr = k0 === 'A' ? (k1 === '@DPTR' ? this.DPTR : (this.sfr[0xA0] << 8) | this.R(+k1[2])) : (k0 === '@DPTR' ? this.DPTR : (this.sfr[0xA0] << 8) | this.R(+k0[2]));
        if (k0 === 'A') this.A = this.xram[addr]; else this.xram[addr] = this.A; break; }
      case 'MUL': { const p = this.A * this.sfr[0xF0]; this.A = p & 255; this.sfr[0xF0] = p >> 8; this.CY = 0; this.setFlag(2, p > 255); break; }
      case 'DIV': { const b = this.sfr[0xF0]; this.CY = 0; if (!b) { this.setFlag(2, 1); break; } const a = this.A; this.A = Math.floor(a / b); this.sfr[0xF0] = a % b; this.setFlag(2, 0); break; }
      case 'CJNE': { const a = this.get_(k0, x0), b = this.get_(k1, x1); this.CY = a < b; if (a !== b) this.pc = rel(raw[2]); break; }
      case 'DJNZ': { const v = (this.get_(k0, x0, true) - 1) & 255; this.set_(k0, x0, v); if (v) this.pc = rel(x1); break; }
      case 'PUSH': this.push(this.rd(x0)); break; case 'POP': this.wr(x0, this.pop()); break;
      case 'CLR': this.set_(k0, x0, 0); break; case 'SETB': this.set_(k0, x0, 1); break;
      case 'CPL': this.set_(k0, x0, k0 === 'A' ? ~this.A : this.get_(k0, x0, true) ^ 1); break;
      case 'SWAP': this.A = ((this.A << 4) | (this.A >> 4)) & 255; break;
      case 'XCH': { const v = this.get_(k1, x1); this.set_(k1, x1, this.A); this.A = v; break; }
      case 'XCHD': { const p = this.R(+k1[2]), m = this.iram[p]; this.iram[p] = (m & 0xF0) | (this.A & 15); this.A = (this.A & 0xF0) | (m & 15); break; }
      case 'DA': { let a = this.A, c = this.CY; if ((a & 15) > 9 || (this.sfr[0xD0] & 0x40)) { a += 6; if (a > 255) c = 1; } if ((a >> 4) > 9 || c) { a += 0x60; c = 1; } this.CY = c || a > 255; this.A = a; break; }
    }
    this.cycles += o.cy; this.peripherals(o.cy); this.interrupts();
    return o.cy;
  }
  peripherals(cy) {
    const tmod = this.sfr[0x89], tcon = this.sfr[0x88];
    for (const t of [0, 1]) {
      if (!((tcon >> (4 + 2 * t)) & 1)) continue;
      const mode = (tmod >> (4 * t)) & 3, TL = 0x8A + t, TH = 0x8C + t; let tl = this.sfr[TL], th = this.sfr[TH], ovf = 0;
      if ((tmod >> (4 * t + 2)) & 1) continue;                                 // counter mode (external pin) is not clocked here
      if (mode === 1) { let v = (th << 8 | tl) + cy; if (v > 0xFFFF) { ovf = 1; v &= 0xFFFF; } th = v >> 8; tl = v & 255; }
      else if (mode === 2) { let v = tl + cy; while (v > 255) { ovf = 1; v = th + (v - 256); } tl = v; }
      else if (mode === 0) { let v = ((th << 5) | (tl & 31)) + cy; if (v > 0x1FFF) { ovf = 1; v &= 0x1FFF; } th = v >> 5; tl = v & 31; }
      else if (mode === 3 && t === 0) { let v = tl + cy; if (v > 255) { ovf = 1; v &= 255; } tl = v; }
      this.sfr[TL] = tl; this.sfr[TH] = th; if (ovf) this.sfr[0x88] |= 1 << (5 + 2 * t);
    }
    if (this.txBusy > 0) { this.txBusy -= cy; if (this.txBusy <= 0) { this.txBusy = 0; this.sfr[0x98] |= 2; this.onSerial(this.txByte); } }
    if (this.rxQueue.length && (this.sfr[0x98] & 0x10) && !(this.sfr[0x98] & 1)) { this.sbufIn = this.rxQueue.shift(); this.sfr[0x98] |= 1; }
    // external interrupt pins INT0 (P3.2) / INT1 (P3.3): falling edge when ITx = 1, low level otherwise
    const p3 = this.readPort(3) & this.sfr[0xB0];
    for (const [pin, ie, it] of [[2, 1, 0], [3, 3, 2]]) { const now = (p3 >> pin) & 1, was = this.lastPins[pin] ?? 1;
      if ((this.sfr[0x88] >> it) & 1 ? (was && !now) : !now) this.sfr[0x88] |= 1 << ie; this.lastPins[pin] = now; }
  }
  interrupts() {
    const ie = this.sfr[0xA8], tcon = this.sfr[0x88], scon = this.sfr[0x98]; if (!(ie & 0x80)) return;
    const level = this.inService.length ? Math.max(...this.inService) : -1;
    const src = [[ie & 1, tcon & 2, 0x03, 0x88, 1], [ie & 2, tcon & 0x20, 0x0B, 0x88, 5], [ie & 4, tcon & 8, 0x13, 0x88, 3], [ie & 8, tcon & 0x80, 0x1B, 0x88, 7], [ie & 16, scon & 3, 0x23, null, null]];
    for (let i = 0; i < src.length; i++) { const [en, flag, vec, reg, bit] = src[i], prio = (this.sfr[0xB8] >> i) & 1;
      if (en && flag && prio > level) {
        // timer flags are cleared on entry; INTx flags only in edge-triggered mode (ITx = 1); serial flags are cleared by software
        if (reg !== null && (bit === 5 || bit === 7 || ((tcon >> (bit - 1)) & 1))) this.sfr[reg] &= ~(1 << bit);
        this.push(this.pc & 255); this.push(this.pc >> 8); this.pc = vec; this.inService.push(prio); this.cycles += 2; return; } }
  }
  // 'HERE: SJMP HERE' ends the program, unless interrupts or a serial transfer can still change something
  run(maxCycles = 1e6) { const end = this.cycles + maxCycles; while (this.cycles < end && !this.halted) { const pc = this.pc; this.step(); if (this.pc === pc && OPS[this.code[pc]]?.mn === 'SJMP' && !(this.sfr[0xA8] & 0x80) && !this.txBusy) { this.halted = 'loop'; break; } } return this.halted; }
}
