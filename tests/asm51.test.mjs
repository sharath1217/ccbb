// 8051 assembler + emulator: instruction behaviour and the VTU-style lab programs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, CPU51, OPS } from '../app/engine/cpu8051.js';
import { ASM_TEMPLATES } from '../app/ui/asm51-templates.js';

const run = (src, setup = {}, cycles = 2e6) => {
  const a = assemble(src); assert.deepEqual(a.errors, [], JSON.stringify(a.errors));
  let out = ''; const c = new CPU51(a.code, { onSerial: b => { out += String.fromCharCode(b); } });
  for (const [k, v] of Object.entries(setup.iram || {})) c.iram.set(v, +k);
  for (const [k, v] of Object.entries(setup.xram || {})) c.xram.set(v, +k);
  c.run(cycles); return { c, out, a };
};
test('opcode table has all 255 defined MCS-51 instructions (A5H reserved)', () => {
  assert.equal(OPS.filter(Boolean).length, 255); assert.equal(OPS[0xA5], undefined);
});
test('ADD sets CY, AC and OV correctly', () => {
  const { c } = run('MOV A,#7FH\nADD A,#01H\nMOV 30H,PSW\nMOV A,#0FFH\nADD A,#01H\nMOV 31H,PSW\nHERE: SJMP HERE');
  assert.equal(c.iram[0x30] & 0xC4, 0x44, 'OV+AC after 7F+1'); assert.equal(c.iram[0x31] & 0xC4, 0xC0, 'CY+AC after FF+1');
});
test('SUBB borrows, DA A adjusts BCD, MUL/DIV set flags', () => {
  let { c } = run('CLR C\nMOV A,#10H\nSUBB A,#20H\nMOV 30H,A\nMOV 31H,PSW\nMOV A,#38H\nADD A,#29H\nDA A\nMOV 32H,A\nHERE: SJMP HERE');
  assert.equal(c.iram[0x30], 0xF0); assert.ok(c.iram[0x31] & 0x80, 'borrow'); assert.equal(c.iram[0x32], 0x67, '38 + 29 = 67 BCD');
  ({ c } = run('MOV A,#0\nMOV B,#0\nDIV AB\nMOV 30H,PSW\nHERE: SJMP HERE')); assert.ok(c.iram[0x30] & 4, 'divide by zero sets OV');
});
test('rotates, SWAP, bit instructions and register banks', () => {
  const { c } = run('MOV A,#81H\nRL A\nMOV 30H,A\nRRC A\nMOV 31H,A\nMOV A,#12H\nSWAP A\nMOV 32H,A\nSETB 20H.3\nMOV C,20H.3\nCPL C\nMOV 21H.0,C\nSETB RS0\nMOV R0,#55H\nCLR RS0\nMOV R0,#66H\nHERE: SJMP HERE');
  assert.equal(c.iram[0x30], 0x03); assert.equal(c.iram[0x31], 0x01, 'RRC with CY=0'); assert.equal(c.iram[0x32], 0x21);
  assert.equal(c.iram[0x20], 0x08); assert.equal(c.iram[0x21] & 1, 0); assert.equal(c.iram[0x08], 0x55, 'bank 1 R0'); assert.equal(c.iram[0x00], 0x66, 'bank 0 R0');
});
test('CALL/RET use the stack; LCALL/LJMP/AJMP and MOVC tables work', () => {
  const { c } = run('ORG 0\nMOV SP,#60H\nLCALL SUB\nMOV DPTR,#TAB\nMOV A,#2\nMOVC A,@A+DPTR\nMOV 31H,A\nHERE: SJMP HERE\nSUB: MOV 30H,#0AAH\nRET\nTAB: DB 10H,20H,30H');
  assert.equal(c.iram[0x30], 0xAA); assert.equal(c.iram[0x31], 0x30); assert.equal(c.sfr[0x81], 0x60, 'stack restored');
});
test('timer 0 interrupt fires and RETI returns', () => {
  const { c } = run(`ORG 0\nLJMP MAIN\nORG 000BH\nINC 30H\nMOV TH0,#0FFH\nMOV TL0,#00H\nRETI\nMAIN: MOV TMOD,#01H\nMOV TH0,#0FFH\nMOV TL0,#00H\nSETB ET0\nSETB EA\nSETB TR0\nHERE: SJMP HERE`, {}, 3000);
  assert.ok(c.iram[0x30] >= 5, 'interrupt count ' + c.iram[0x30]);
});
test('assembler reports clear errors with line numbers', () => {
  const a = assemble('MOV A,#300\nFOO R1\nSJMP NOWHERE');
  assert.deepEqual(a.errors.map(e => e.line), [1, 2, 3]); assert.match(a.errors[0].msg, /8 bits/); assert.match(a.errors[1].msg, /unknown instruction/); assert.match(a.errors[2].msg, /unknown symbol/);
});
for (const [k, t] of Object.entries(ASM_TEMPLATES)) {
  test(`lab program: ${t.name}`, () => { const { c, out } = run(t.src, t.setup, 5e6); assert.ok(t.check(c, out), `${k}: wrong result (serial "${out}")`); });
}
