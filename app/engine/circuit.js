// Builds a netlist from placed parts + wires, solves it (DC or one transient step) and interprets the results.
import { solve, ledParams, SILICON, SCHOTTKY } from './solver.js';
import { BOARDS, boardPinList } from './boards.js';

const fmt = (v, u) => { const a = Math.abs(v);
  if (!isFinite(v)) return '— ' + u;
  if (a >= 1e6) return (v / 1e6).toFixed(2) + ' M' + u; if (a >= 1e3) return (v / 1e3).toFixed(2) + ' k' + u;
  if (a >= 1 || a === 0) return v.toFixed(2) + ' ' + u; if (a >= 1e-3) return (v * 1e3).toFixed(1) + ' m' + u;
  if (a >= 1e-6) return (v * 1e6).toFixed(1) + ' µ' + u; return (v * 1e9).toFixed(1) + ' n' + u; };
export { fmt };
export const PWM = BOARDS.uno.pwm, UNO_DIGITAL = BOARDS.uno.io.slice(0, 14), UNO_ANALOG = BOARDS.uno.analog;

const R = (a, b, r, tag) => ({ type: 'R', a, b, r, tag });
const Src = (a, b, v, r, tag) => ({ type: 'S', a, b, v, r, tag });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const OPEN = 1e9;

// ---------------- microcontroller model (shared by all boards) ----------------
function mcuModel(type) {
  const B = BOARDS[type];
  return {
    pins: boardPinList(type).concat(type === 'pico' ? ['GP25'] : []), ties: [...B.ties, ...B.gnd.slice(1).map(g => [B.gnd[0], g])], ground: B.gnd[0], mcu: true,
    elements(p, c) {
      const g = B.gnd[0], el = Object.entries(B.power).map(([pin, v]) => Src(pin, g, v, v > 4 ? 0.05 : 0.5, 'pwr:' + pin));
      const io = c.io?.mcu === p.id ? c.io.pins : {};
      for (const pin of B.io) { const s = io[pin] || {};
        if (s.mode === 'OUTPUT' && !(B.inputOnly || []).includes(pin)) el.push(Src(pin, g, s.v ?? 0, 25, 'pin:' + pin));
        else if (s.mode === 'INPUT_PULLUP') el.push(Src(pin, g, B.vcc, 35000, 'pullup:' + pin));
        else if (s.mode === 'INPUT_PULLDOWN') el.push(R(pin, g, 35000, 'pulldown:' + pin));
        else el.push(R(pin, g, 1e8, 'in:' + pin)); }
      return el;
    },
    check(p, c, W) {
      for (const [e, I] of c.els) {
        if (e.tag.startsWith('pwr:') && I > (e.v > 4 ? 0.5 : 0.15)) W('bad', `Too much current from the ${e.tag.slice(4)} pin (${fmt(I, 'A')}). Is something shorted?`);
        if (e.tag.startsWith('pin:')) { const a = Math.abs(I), pin = e.tag.slice(4);
          if (a > B.maxPin) W('bad', `Pin ${pin} carries ${fmt(a, 'A')}. The ${B.chip} limit is ${fmt(B.maxPin, 'A')}: this damages the chip. Add a resistor or use a transistor.`);
          else if (a > B.maxPin / 2) W('warn', `Pin ${pin} carries ${fmt(a, 'A')}, above the recommended ${fmt(B.maxPin / 2, 'A')}.`); }
      }
      for (const pin of B.io) { const v = c.v(pin); if (v > B.vcc + 0.6) W('bad', `${v.toFixed(1)} V on pin ${pin}. The ${B.chip} is a ${B.vcc} V chip: this can destroy it. Use a voltage divider or level shifter.`); }
      for (const [pin, v] of Object.entries(B.power)) { const m = c.v(pin); if (m > v * 1.12 + 0.1) W('bad', `${m.toFixed(1)} V forced onto the ${pin} pin (expected ${v} V). This can destroy the board.`); }
    },
  };
}

// helper for sensor modules: output = source referenced to the module's own supply
const supply = (c, vcc = 'VCC', gnd = 'GND') => c.v(vcc) - c.v(gnd);

// LED-like part with any colour
const led = (a, cth, color, tag) => ({ type: 'D', a, c: cth, ...ledParams(color), tag });

export const MODELS = {
  // ---------- power ----------
  battery: { pins: ['+', '-'], ground: '-', elements: p => [Src('+', '-', p.props.volts ?? 9, p.props.rint ?? 1.5, 'cell')],
    check(p, c, W) { if (c.I('cell') > 2) W('bad', `Short circuit! The battery is delivering ${fmt(c.I('cell'), 'A')}. It will get hot quickly.`); } },
  psu: { pins: ['+', '-'], ground: '-', elements(p, c) {
      const v = p.props.volts ?? 5, lim = p.props.limit ?? 1, cc = (p.state.cc ??= false);
      return [cc ? { type: 'I', a: '+', b: '-', i: lim, tag: 'out' } : Src('+', '-', v, 0.01, 'out')]; },
    behave(p, c) { const v = p.props.volts ?? 5, lim = p.props.limit ?? 1;
      if (!p.state.cc && c.I('out') > lim) p.state.cc = true; else if (p.state.cc && c.v('+') - c.v('-') > v) p.state.cc = false; },
    check(p, c, W) { if (p.state.cc) W('warn', `Power supply in current limit (${fmt(p.props.limit ?? 1, 'A')}). Voltage dropped: check for a short or heavy load.`); } },
  reg7805: { dyn: true, pins: ['IN', 'GND', 'OUT'], elements(p, c) { const vin = supply(c, 'IN', 'GND'), vout = clamp(vin - 2, 0, 5);
      return [Src('OUT', 'GND', vout, 0.05, 'out'), R('IN', 'GND', 1000, 'q'), { type: 'I', a: 'GND', b: 'IN', i: Math.max(0, p.state.iout || 0), tag: 'pass' }]; },
    behave(p, c) { p.state.iout = Math.max(0, c.I('out')); },
    check(p, c, W) { const vin = supply(c, 'IN', 'GND'); const P = Math.max(0, vin - 5) * (p.state.iout || 0);
      if (vin > 2 && vin < 7) W('warn', `7805 needs at least 7 V in to give a steady 5 V (now ${vin.toFixed(1)} V in).`);
      if (vin > 35) W('bad', `7805 input ${vin.toFixed(0)} V is above its 35 V maximum.`);
      if (P > 1) W('warn', `7805 is burning ${fmt(P, 'W')} as heat. Add a heatsink or lower the input voltage.`); } },

  // ---------- passive ----------
  resistor: { pins: ['1', '2'], elements: p => [R('1', '2', p.props.ohms ?? 220, 'R')],
    check(p, c, W, out) { const I = c.I('R'), P = I * I * (p.props.ohms ?? 220); out.current = I; out.power = P;
      if (P > 0.25) W('bad', `Resistor dissipates ${fmt(P, 'W')}, above its 0.25 W rating. It will overheat and burn.`); } },
  pot: { pins: ['GND', 'SIG', 'VCC'], elements: p => { const t = p.props.ohms ?? 10000, x = (p.props.pos ?? 50) / 100;
    return [R('GND', 'SIG', Math.max(x * t, 1), 'R1'), R('SIG', 'VCC', Math.max((1 - x) * t, 1), 'R2')]; } },
  slidepot: { pins: ['VCC', 'SIG', 'GND'], elements: p => { const t = 10000, x = (p.props.pos ?? 50) / 100;
    return [R('GND', 'SIG', Math.max(x * t, 1), 'R1'), R('SIG', 'VCC', Math.max((1 - x) * t, 1), 'R2')]; } },
  capacitor: { pins: ['1', '2'], elements: p => [{ type: 'C', a: '1', b: '2', c: p.props.farads ?? 1e-7, v0: p.state.v || 0, tag: 'C' }],
    commit(p, c) { p.state.v = c.v('1') - c.v('2'); },
    check(p, c, W, out) { const v = c.v('1') - c.v('2'); out.voltage = v; if (Math.abs(v) > (p.props.rating ?? 50)) W('bad', `Capacitor has ${v.toFixed(1)} V across it, above its ${p.props.rating ?? 50} V rating.`); } },
  ecap: { pins: ['+', '-'], elements: p => [{ type: 'C', a: '+', b: '-', c: p.props.farads ?? 1e-4, v0: p.state.v || 0, tag: 'C' }],
    commit(p, c) { p.state.v = c.v('+') - c.v('-'); },
    check(p, c, W, out) { const v = c.v('+') - c.v('-'); out.voltage = v;
      if (v < -0.8) W('bad', `Electrolytic capacitor is connected backwards (${v.toFixed(1)} V). It can bulge or burst. The stripe marks the − leg.`);
      if (v > (p.props.rating ?? 25)) W('bad', `Capacitor voltage ${v.toFixed(1)} V is above its ${p.props.rating ?? 25} V rating.`); } },
  diode: { pins: ['A', 'K'], elements: p => [{ type: 'D', a: 'A', c: 'K', ...(p.props.kind === 'schottky' ? SCHOTTKY : SILICON), tag: 'D' }],
    check(p, c, W, out) { const I = c.I('D'); out.current = I; if (I > 1) W('bad', `Diode current ${fmt(I, 'A')} is above its 1 A rating.`); } },

  // ---------- semiconductors ----------
  npn: { pins: ['E', 'B', 'C'], elements: p => [{ type: 'Q', c: 'C', b: 'B', e: 'E', pol: 1, is: 1e-14, bf: p.props.beta ?? 200, br: 5, tag: 'Q' }],
    check(p, c, W, out) { const ic = c.I('Q'); out.current = ic; out.vce = c.v('C') - c.v('E'); out.vbe = c.v('B') - c.v('E');
      if (ic > 0.1) W('bad', `Collector current ${fmt(ic, 'A')} is above the BC547's 100 mA limit. Use a bigger transistor or a MOSFET.`);
      if (out.vbe > 0.95) W('bad', `Base–emitter voltage ${out.vbe.toFixed(2)} V: no base resistor? Add 1 kΩ in series with the base.`); } },
  pnp: { pins: ['E', 'B', 'C'], elements: p => [{ type: 'Q', c: 'C', b: 'B', e: 'E', pol: -1, is: 1e-14, bf: p.props.beta ?? 200, br: 5, tag: 'Q' }],
    check(p, c, W, out) { const ic = -c.I('Q'); out.current = ic; if (ic > 0.1) W('bad', `Collector current ${fmt(ic, 'A')} is above the BC557's 100 mA limit.`);
      if (c.v('E') - c.v('B') > 0.95) W('bad', `Emitter–base voltage too high: add a base resistor.`); } },
  nmos: { pins: ['G', 'D', 'S'], elements: p => [{ type: 'M', d: 'D', g: 'G', s: 'S', pol: 1, vth: 1.5, k: 12, lambda: 0.01, tag: 'M' }, R('G', 'S', 1e9, 'gs')],
    check(p, c, W, out) { const id = c.I('M'), vds = c.v('D') - c.v('S'), vgs = c.v('G') - c.v('S'); out.current = id; out.vgs = vgs; out.vds = vds;
      if (vgs > 16) W('bad', `Gate voltage ${vgs.toFixed(0)} V exceeds ±16 V: the gate oxide will break.`);
      if (id * vds > 1.5) W('warn', `MOSFET is heating up (${fmt(id * vds, 'W')}). Drive the gate harder or add a heatsink.`);
      if (Math.abs(c.v('G') - c.v('S')) < 0.01 && c.floating('G')) W('warn', 'MOSFET gate is floating. Add a 10 kΩ pull-down from gate to source.'); } },

  // ---------- ICs ----------
  lm358: { pins: ['1', '2', '3', '4', '5', '6', '7', '8'], // 1 OUT1, 2 IN1−, 3 IN1+, 4 GND, 5 IN2+, 6 IN2−, 7 OUT2, 8 VCC
    elements: () => [{ type: 'OA', p: '3', n: '2', o: '1', vp: '8', vn: '4', a: 1e5, ro: 15, hi: 1.5, lo: 0.02, tag: 'A' },
      { type: 'OA', p: '5', n: '6', o: '7', vp: '8', vn: '4', a: 1e5, ro: 15, hi: 1.5, lo: 0.02, tag: 'B' }, R('8', '4', 7000, 'iq')],
    check(p, c, W, out) { const vs = supply(c, '8', '4'); out.supply = vs; out.out1 = c.v('1'); out.out2 = c.v('7');
      if (vs > 32) W('bad', `LM358 supply ${vs.toFixed(0)} V exceeds its 32 V maximum.`);
      if (vs > 0.5 && vs < 3) W('warn', `LM358 needs at least 3 V supply (now ${vs.toFixed(1)} V).`); } },
  ne555: { pins: ['1', '2', '3', '4', '5', '6', '7', '8'], // 1 GND, 2 TRIG, 3 OUT, 4 RESET, 5 CTRL, 6 THR, 7 DIS, 8 VCC
    elements(p) { const q = !!p.state.q;
      return [R('8', '5', 5000, 'd1'), R('5', '1', 10000, 'd2'),               // internal divider sets CTRL at 2/3 VCC
        Src('3', '1', q ? Math.max(0, (p.state.vcc || 0) - 1.7) : 0.05, 10, 'out'), R('7', '1', q ? OPEN : 5, 'dis'), R('8', '1', 1500, 'iq'),
        R('2', '1', 1e8, 'in2'), R('6', '1', 1e8, 'in6'), R('4', '1', 1e8, 'in4')]; },
    behave(p, c) { const vcc = supply(c, '8', '1'); p.state.vcc = vcc;
      if (vcc < 4.5) { p.state.q = false; return; }
      const ctrl = c.v('5') - c.v('1');
      if (c.v('4') - c.v('1') < 0.7) p.state.q = false;
      else if (c.v('2') - c.v('1') < ctrl / 2) p.state.q = true;
      else if (c.v('6') - c.v('1') > ctrl) p.state.q = false; },
    check(p, c, W, out) { out.output = p.state.q ? 'HIGH' : 'LOW'; const vcc = supply(c, '8', '1');
      if (vcc > 0.5 && vcc < 4.5) W('warn', `NE555 needs 4.5–16 V (now ${vcc.toFixed(1)} V).`); if (vcc > 16) W('bad', `NE555 supply ${vcc.toFixed(0)} V exceeds 16 V.`); } },
  ...Object.fromEntries([['hc00', 'NAND', (a, b) => !(a && b)], ['hc08', 'AND', (a, b) => a && b], ['hc32', 'OR', (a, b) => a || b], ['hc86', 'XOR', (a, b) => a !== b]].map(([t, , fn]) => [t, {
    pins: Array.from({ length: 14 }, (_, i) => String(i + 1)),
    gates: [['1', '2', '3'], ['4', '5', '6'], ['10', '9', '8'], ['13', '12', '11']], fn,
    elements(p) { const out = p.state.out || [0, 0, 0, 0], vcc = p.state.vcc || 0, on = vcc > 1.8;
      return [R('14', '7', 50000, 'iq'), ...this.gates.flatMap(([a, b, y], i) => [R(a, '7', 1e8, 'in'), R(b, '7', 1e8, 'in'),
        on ? Src(y, '7', out[i] ? vcc : 0, 50, 'y' + i) : R(y, '7', OPEN, 'y' + i)])]; },
    behave(p, c) { const vcc = supply(c, '14', '7'); p.state.vcc = vcc;
      p.state.out = this.gates.map(([a, b]) => this.fn(c.v(a) - c.v('7') > vcc / 2, c.v(b) - c.v('7') > vcc / 2) ? 1 : 0); },
    check(p, c, W, out) { const vcc = supply(c, '14', '7'); out.supply = vcc; out.outputs = (p.state.out || []).join(' ');
      if (vcc > 0.3 && vcc < 2) W('warn', `74HC chip is not powered: connect pin 14 to + and pin 7 to GND.`); if (vcc > 7) W('bad', `74HC chips max 7 V supply (now ${vcc.toFixed(1)} V).`); } }])),
  hc04: { pins: Array.from({ length: 14 }, (_, i) => String(i + 1)), gates: [['1', '2'], ['3', '4'], ['5', '6'], ['9', '8'], ['11', '10'], ['13', '12']],
    elements(p) { const out = p.state.out || [], vcc = p.state.vcc || 0, on = vcc > 1.8;
      return [R('14', '7', 50000, 'iq'), ...this.gates.flatMap(([a, y], i) => [R(a, '7', 1e8, 'in'), on ? Src(y, '7', out[i] ? vcc : 0, 50, 'y' + i) : R(y, '7', OPEN, 'y' + i)])]; },
    behave(p, c) { const vcc = supply(c, '14', '7'); p.state.vcc = vcc; p.state.out = this.gates.map(([a]) => c.v(a) - c.v('7') > vcc / 2 ? 0 : 1); },
    check(p, c, W, out) { out.outputs = (p.state.out || []).join(' '); } },

  // ---------- output ----------
  led: { pins: ['A', 'C'], elements: p => p.props.burnt ? [] : [led('A', 'C', p.props.color, 'LED')],
    check(p, c, W, out) { const I = c.I('LED'); out.current = I; out.brightness = p.props.burnt ? 0 : clamp(I / 0.02, 0, 1);
      if (p.props.burnt) W('bad', 'LED is burnt out. Real LEDs die above ~30 mA. Replace it and add a series resistor (220 Ω at 5 V).');
      else if (I > 0.03) { out.burn = true; W('bad', `LED current ${fmt(I, 'A')} is far above its 20 mA rating. It just burnt out! Add a series resistor.`); }
      else if (I > 0.021) W('warn', `LED current ${fmt(I, 'A')} is above the 20 mA rating. It will age fast; use a bigger resistor.`); } },
  rgb: { pins: ['R', 'COM', 'G', 'B'], elements: () => [led('R', 'COM', 'red', 'r'), led('G', 'COM', 'green', 'g'), led('B', 'COM', 'blue', 'b')],
    check(p, c, W, out) { out.rgb = ['r', 'g', 'b'].map(t => clamp(c.I(t) / 0.02, 0, 1)); for (const t of ['r', 'g', 'b']) if (c.I(t) > 0.03) W('bad', `RGB LED ${t.toUpperCase()} channel current ${fmt(c.I(t), 'A')}: add a resistor on each colour pin.`); } },
  bargraph: { pins: [...Array.from({ length: 10 }, (_, i) => 'A' + (i + 1)), ...Array.from({ length: 10 }, (_, i) => 'C' + (i + 1))],
    elements: () => Array.from({ length: 10 }, (_, i) => led('A' + (i + 1), 'C' + (i + 1), 'red', 's' + i)),
    check(p, c, W, out) { out.values = Array.from({ length: 10 }, (_, i) => clamp(c.I('s' + i) / 0.01, 0, 1)); if (out.values.some((v, i) => c.I('s' + i) > 0.03)) W('bad', 'A bar-graph segment is over 30 mA: use a resistor per segment.'); } },
  seg7: { pins: ['COM.1', 'COM.2', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'], ties: [['COM.1', 'COM.2']],
    elements: p => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'].map(s => p.props.common === 'anode' ? led('COM.1', s, 'red', s) : led(s, 'COM.1', 'red', s)),
    check(p, c, W, out) { out.values = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'].map(s => c.I(s) > 5e-4 ? 1 : 0);
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'].some(s => c.I(s) > 0.03)) W('bad', '7-segment: a segment is over 30 mA. Use a 220 Ω resistor on each segment pin.'); } },
  buzzer: { pins: ['1', '2'], elements: () => [R('1', '2', 42, 'coil')], check(p, c, W, out) { out.current = c.I('coil'); out.on = Math.abs(c.I('coil')) > 0.005; } },
  motor: { pins: ['1', '2'], elements: () => [R('1', '2', 8, 'coil')],
    check(p, c, W, out) { const I = c.I('coil'), v = c.v('1') - c.v('2'); out.current = I; out.rpm = Math.round(clamp((Math.abs(v) - 0.5) / 5.5, 0, 2) * 7000) * Math.sign(v);
      for (const m of c.mcuPinsOn(['1', '2'])) W('bad', `Motor connected straight to an MCU pin (${m}). Pins give ~20 mA; a motor needs ~300 mA+. Use a transistor/MOSFET or a motor driver.`); } },
  servo: { pins: ['GND', 'V+', 'PWM'], elements: () => [R('V+', 'GND', 50, 'motor'), R('PWM', 'GND', 1e6, 'sig')],
    check(p, c, W, out) { out.angle = p.state.angle ?? 90; const vs = supply(c, 'V+', 'GND'); out.supply = vs;
      if (vs > 0.5 && vs < 4) W('warn', `Servo needs 4.8–6 V (now ${vs.toFixed(1)} V).`); if (vs > 6.5) W('bad', `Servo supply ${vs.toFixed(1)} V is too high (max 6 V).`); } },
  relay: { pins: ['NO2', 'NC2', 'P2', 'COIL2', 'NO1', 'NC1', 'P1', 'COIL1'],
    elements: p => [R('COIL1', 'COIL2', 125, 'coil'), R('P1', p.state.on ? 'NO1' : 'NC1', 0.05, 'k1'), R('P2', p.state.on ? 'NO2' : 'NC2', 0.05, 'k2')],
    behave(p, c) { const i = Math.abs(c.I('coil')); if (!p.state.on && i > 0.03) p.state.on = true; else if (p.state.on && i < 0.008) p.state.on = false; },
    check(p, c, W, out) { out.on = !!p.state.on; out.coil = c.I('coil'); for (const m of c.mcuPinsOn(['COIL1', 'COIL2'])) W('warn', `Relay coil driven straight from pin ${m}. A relay coil needs ~40 mA: use a transistor and a flyback diode.`); } },
  l298n: { pins: ['12V', 'GND', '5V', 'ENA', 'IN1', 'IN2', 'OUT1', 'OUT2'],
    elements(p) { const s = p.state, on = (s.v12 || 0) > 5;
      return [R('12V', 'GND', 2000, 'iq'), R('ENA', 'GND', 1e5, 'e'), R('IN1', 'GND', 1e5, 'i1'), R('IN2', 'GND', 1e5, 'i2'),
        on && (s.v12 || 0) > 7 ? Src('5V', 'GND', 5, 0.2, 'reg') : R('5V', 'GND', OPEN, 'reg'),
        on && s.en > 0.05 ? Src('OUT1', 'GND', s.in1 ? ((s.v12 - 1.8) * s.en) : 0.1, 2, 'o1') : R('OUT1', 'GND', OPEN, 'o1'),
        on && s.en > 0.05 ? Src('OUT2', 'GND', s.in2 ? ((s.v12 - 1.8) * s.en) : 0.1, 2, 'o2') : R('OUT2', 'GND', OPEN, 'o2')]; },
    behave(p, c) { const s = p.state; s.v12 = supply(c, '12V', 'GND'); s.en = clamp((c.v('ENA') - c.v('GND')) / 2.5, 0, 1); s.in1 = c.v('IN1') - c.v('GND') > 2.3; s.in2 = c.v('IN2') - c.v('GND') > 2.3; },
    check(p, c, W, out) { out.mode = !p.state.en ? 'stopped' : p.state.in1 === p.state.in2 ? 'brake' : p.state.in1 ? 'forward' : 'reverse';
      if (supply(c, '12V', 'GND') > 0.5 && supply(c, '12V', 'GND') < 5) W('warn', 'L298N needs 5–35 V on the 12V terminal for the motors.'); } },

  // ---------- input ----------
  pushbutton: { pins: ['1.l', '2.l', '1.r', '2.r'], ties: [['1.l', '1.r'], ['2.l', '2.r']], elements: p => p.props.pressed ? [R('1.l', '2.l', 0.05, 'contact')] : [] },
  switch: { pins: ['1', '2', '3'], elements: p => [R('2', p.props.on ? '3' : '1', 0.05, 'contact')] },
  dipswitch: { pins: [1, 2, 3, 4, 5, 6, 7, 8].flatMap(i => [i + 'a', i + 'b']), elements: p => (p.props.bits || []).map((on, i) => on ? R((i + 1) + 'a', (i + 1) + 'b', 0.05, 'sw' + i) : null).filter(Boolean) },
  keypad: { pins: ['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'],
    elements: p => p.props.key ? [R('R' + p.props.key.row, 'C' + p.props.key.col, 0.1, 'key')] : [] },
  joystick: { pins: ['VCC', 'VERT', 'HORZ', 'SEL', 'GND'], elements: p => { const t = 10000, y = ((p.props.y ?? 0) + 100) / 200, x = ((p.props.x ?? 0) + 100) / 200;
    return [R('GND', 'VERT', Math.max(y * t, 1), 'v1'), R('VERT', 'VCC', Math.max((1 - y) * t, 1), 'v2'), R('GND', 'HORZ', Math.max(x * t, 1), 'h1'), R('HORZ', 'VCC', Math.max((1 - x) * t, 1), 'h2'),
      ...(p.props.pressed ? [R('SEL', 'GND', 0.1, 'sel')] : [])]; } },

  // ---------- sensors (environment comes from p.props) ----------
  ldr: { dyn: true, pins: ['VCC', 'GND', 'DO', 'AO'], elements(p, c) { const vs = Math.max(0, supply(c)), lux = p.props.lux ?? 300;
      const rl = 5e5 / Math.pow(lux + 1, 0.7), ao = vs * rl / (rl + 10000);              // LDR on the low side of a 10 k divider: bright → low voltage
      return [R('VCC', 'GND', 2000, 'iq'), Src('AO', 'GND', ao, 10000, 'ao'), Src('DO', 'GND', ao > vs * (p.props.threshold ?? 50) / 100 ? vs : 0, 100, 'do')]; } },
  ntc: { dyn: true, pins: ['GND', 'VCC', 'OUT'], elements(p, c) { const vs = Math.max(0, supply(c)), T = (p.props.temp ?? 25) + 273.15, r = 10000 * Math.exp(3950 * (1 / T - 1 / 298.15));
      return [R('VCC', 'GND', 20000, 'iq'), Src('OUT', 'GND', vs * 10000 / (10000 + r), 5000, 'out')]; } },
  dht22: { pins: ['VCC', 'SDA', 'NC', 'GND'], elements: () => [R('VCC', 'GND', 5000, 'iq'), R('SDA', 'GND', 1e8, 'data')],
    check(p, c, W) { const vs = supply(c); if (vs > 0.3 && vs < 3.2) W('warn', `DHT22 needs 3.3–6 V (now ${vs.toFixed(1)} V).`); } },
  hcsr04: { pins: ['VCC', 'TRIG', 'ECHO', 'GND'], elements: () => [R('VCC', 'GND', 330, 'iq'), R('TRIG', 'GND', 1e6, 'trig'), R('ECHO', 'GND', 1e6, 'echo')],
    check(p, c, W) { const vs = supply(c); if (vs > 0.3 && vs < 4.5) W('warn', `HC-SR04 needs 5 V (now ${vs.toFixed(1)} V). On 3.3 V boards use the HC-SR04P.`);
      for (const m of c.mcuPinsOn(['ECHO'], true)) if (m.vcc < 4) W('warn', `HC-SR04 ECHO outputs 5 V into a ${m.vcc} V board. Use a 1 k / 2 k divider.`); } },
  pir: { dyn: true, pins: ['VCC', 'OUT', 'GND'], elements(p, c) { const vs = supply(c), on = vs >= 4.5 && p.props.motion;
      return [R('VCC', 'GND', 5000, 'iq'), Src('OUT', 'GND', on ? 3.3 : 0, 100, 'out')]; },
    check(p, c, W) { const vs = supply(c); if (vs > 0.3 && vs < 4.5) W('warn', `PIR (HC-SR501) needs 4.5–20 V (now ${vs.toFixed(1)} V).`); } },
  gas: { dyn: true, pins: ['AOUT', 'DOUT', 'GND', 'VCC'], elements(p, c) { const vs = Math.max(0, supply(c)), ppm = p.props.ppm ?? 200;
      const ao = vs * clamp(0.08 + 0.4 * Math.log10(1 + ppm / 300), 0, 0.95);
      return [R('VCC', 'GND', 33, 'heater'), Src('AOUT', 'GND', ao, 1000, 'ao'), Src('DOUT', 'GND', ao > vs * (p.props.threshold ?? 40) / 100 ? 0 : vs, 100, 'do')]; },
    check(p, c, W) { if (c.mcuPinsOn(['VCC']).length && c.I('heater') > 0.1 && supply(c) > 4) W('warn', 'MQ-2 heater draws ~150 mA. Fine on the 5V pin, but several MQ sensors need an external supply.'); } },
  flame: { dyn: true, pins: ['VCC', 'GND', 'DOUT', 'AOUT'], elements(p, c) { const vs = Math.max(0, supply(c)), f = clamp((p.props.flame ?? 0) / 100, 0, 1);
      const ao = vs * (0.95 - 0.9 * f); return [R('VCC', 'GND', 3000, 'iq'), Src('AOUT', 'GND', ao, 1000, 'ao'), Src('DOUT', 'GND', f > 0.4 ? 0 : vs, 100, 'do')]; } },
  sound: { dyn: true, pins: ['AOUT', 'GND', 'VCC', 'DOUT'], elements(p, c) { const vs = Math.max(0, supply(c)), db = p.props.db ?? 40;
      const ao = vs * clamp(0.5 + (db - 40) / 140, 0.5, 0.98); return [R('VCC', 'GND', 3000, 'iq'), Src('AOUT', 'GND', ao, 1000, 'ao'), Src('DOUT', 'GND', db > (p.props.threshold ?? 70) ? vs : 0, 100, 'do')]; } },
  tilt: { dyn: true, pins: ['GND', 'VCC', 'OUT'], elements: (p, c) => [R('VCC', 'GND', 10000, 'iq'), Src('OUT', 'GND', p.props.tilted ? Math.max(0, supply(c)) : 0, 100, 'out')] },
  heartbeat: { dyn: true, pins: ['GND', 'VCC', 'OUT'], elements(p, c) { const vs = Math.max(0, supply(c)), bpm = p.props.bpm ?? 72, t = c.t % (60 / bpm), beat = Math.exp(-Math.pow((t - 0.1) / 0.03, 2));
      return [R('VCC', 'GND', 2000, 'iq'), Src('OUT', 'GND', vs * (0.5 + 0.4 * beat), 1000, 'out')]; } },
  irrecv: { dyn: true, pins: ['GND', 'VCC', 'DAT'], elements: (p, c) => [R('VCC', 'GND', 3000, 'iq'), Src('DAT', 'GND', Math.max(0, supply(c)), 10000, 'out')] },

  // ---------- displays & modules on I2C (driven by code libraries) ----------
  lcd: { pins: ['GND', 'VCC', 'SDA', 'SCL'], elements: () => [R('VCC', 'GND', 250, 'backlight'), R('SDA', 'GND', 1e7, 'sda'), R('SCL', 'GND', 1e7, 'scl')],
    check(p, c, W) { const vs = supply(c); if (vs > 0.3 && vs < 4.5) W('warn', `LCD 16×2 needs 5 V (now ${vs.toFixed(1)} V): text will be faint or missing.`); } },
  oled: { pins: ['DATA', 'CLK', 'DC', 'RST', 'CS', '3V3', 'VIN', 'GND'], elements: () => [R('VIN', 'GND', 250, 'iq'), R('DATA', 'GND', 1e7, 'sda'), R('CLK', 'GND', 1e7, 'scl')] },
  mpu6050: { pins: ['INT', 'AD0', 'XCL', 'XDA', 'SDA', 'SCL', 'GND', 'VCC'], elements: () => [R('VCC', 'GND', 1000, 'iq')] },
  rtc: { pins: ['GND', '5V', 'SDA', 'SCL', 'SQW'], elements: () => [R('5V', 'GND', 10000, 'iq')] },

  // ---------- instruments & prototyping ----------
  scope: { pins: ['CH1', 'CH2', 'GND'], ground: null, elements: () => [R('CH1', 'GND', 1e6, 'ch1'), R('CH2', 'GND', 1e6, 'ch2')] },
  meter: { pins: ['COM', 'V'], elements: p => p.props.mode === 'A' ? [R('V', 'COM', 0.1, 'shunt')] : [R('V', 'COM', 10e6, 'input')] },
  breadboard: { pins: [], ties: [], elements: () => [] },
};

// breadboard pins + internal strips
const BB_ROWS = ['TN', 'TP', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'BP', 'BN'];
MODELS.breadboard.pins = BB_ROWS.flatMap(r => Array.from({ length: 30 }, (_, i) => r + (i + 1)));
for (let c = 1; c <= 30; c++) for (const grp of ['ABCDE', 'FGHIJ']) for (let i = 0; i < 4; i++) MODELS.breadboard.ties.push([grp[i] + c, grp[i + 1] + c]);
for (const r of ['TN', 'TP', 'BP', 'BN']) for (let c = 1; c < 30; c++) MODELS.breadboard.ties.push([r + c, r + (c + 1)]);
for (const t of Object.keys(BOARDS)) MODELS[t] = mcuModel(t);

export const PIN_LIST = Object.fromEntries(Object.entries(MODELS).map(([k, m]) => [k, m.pins]));
export const isMcu = t => !!MODELS[t]?.mcu;

class DSU { constructor() { this.p = new Map(); }
  find(x) { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(x, r); return r; }
  union(a, b) { this.p.set(this.find(a), this.find(b)); } }

function topology(parts, wires) {
  const dsu = new DSU(), key = (id, pin) => id + ':' + pin;
  for (const p of parts) for (const pin of MODELS[p.type]?.pins || []) dsu.find(key(p.id, pin));
  for (const p of parts) for (const [a, b] of MODELS[p.type]?.ties || []) dsu.union(key(p.id, a), key(p.id, b));
  for (const w of wires) dsu.union(w.from, w.to);
  const gnds = parts.filter(p => MODELS[p.type]?.ground).sort((a, b) => (isMcu(b.type) ? 1 : 0) - (isMcu(a.type) ? 1 : 0));
  const ref = gnds.length ? dsu.find(key(gnds[0].id, MODELS[gnds[0].type].ground)) : null;
  return { dsu, key, ref };
}

function netlist(parts, topo, ctxFor, { zeroSources = false } = {}) {
  const { dsu, key, ref } = topo, nodeOf = new Map(); let n = 1; if (ref) nodeOf.set(ref, 0);
  const node = k => { const r = dsu.find(k); if (!nodeOf.has(r)) nodeOf.set(r, n++); return nodeOf.get(r); };
  const elements = [];
  for (const p of parts) { const m = MODELS[p.type]; if (!m) continue;
    for (const e of m.elements.call(m, p, ctxFor(p))) {
      const out = { ...e, part: p.id, pins: [] };
      // terminal fields hold pin names (strings); numeric fields such as a capacitor's c are values
      for (const t of ['a', 'b', 'c', 'e', 'd', 'g', 's', 'p', 'n', 'o', 'vp', 'vn']) if (typeof e[t] === 'string') { out[t] = node(key(p.id, e[t])); out.pins.push(e[t]); }
      if (zeroSources && out.type === 'S') out.v = 0;
      if (zeroSources && out.type === 'I' && !out.test) out.i = 0;
      elements.push(out);
    } }
  return { nodeCount: Math.max(n, 1), elements, node, key };
}

// Main entry. io = { mcu: partId, pins: {pinName:{mode,v,duty}} }; opts = { dt (s), t (s), commit (bool) }
// PWM pins (0 < duty < 1) really switch between 0 and VCC, so we solve both states and average them by duty cycle:
// LED brightness and motor speed follow the average current, while warnings use the peak (HIGH) state.
export function simulate(parts, wires, io = {}, opts = {}) {
  const pwm = Object.entries(io.pins || {}).filter(([, s]) => s.mode === 'OUTPUT' && s.duty > 0 && s.duty < 1);
  if (!pwm.length) return simulateOnce(parts, wires, io, opts);
  const d = pwm.reduce((a, [, s]) => Math.max(a, s.duty), 0);             // one shared duty (exact for a single PWM pin)
  const ioHi = { ...io, pins: { ...io.pins } }, ioLo = { ...io, pins: { ...io.pins } };
  for (const [k, s] of pwm) { ioHi.pins[k] = { ...s, v: s.vhigh }; ioLo.pins[k] = { ...s, v: 0 }; }
  const lo = simulateOnce(parts, wires, ioLo, { ...opts, commit: false }), hi = simulateOnce(parts, wires, ioHi, opts);
  const mix = (a, b) => typeof a === 'number' && typeof b === 'number' ? a * (1 - d) + b * d : Array.isArray(a) && Array.isArray(b) ? a.map((x, i) => mix(x, b[i])) : b;
  for (const id of Object.keys(hi.parts)) for (const k of Object.keys(hi.parts[id])) { if (k === 'burn') continue; const v = mix(lo.parts[id]?.[k], hi.parts[id][k]); hi.parts[id][k] = k === 'rpm' ? Math.round(v) : v; }
  for (const k of Object.keys(hi.pinCurrent)) hi.pinCurrent[k] = mix(lo.pinCurrent[k] || 0, hi.pinCurrent[k]);
  const vh = hi.voltAt, nh = hi.nodeVoltage;
  hi.voltAt = (id, pin) => mix(lo.voltAt(id, pin), vh(id, pin)); hi.nodeVoltage = k => mix(lo.nodeVoltage(k), nh(k)); hi.duty = d;
  return hi;
}
function simulateOnce(parts, wires, io = {}, opts = {}) {
  const { dt = 0, t = 0, commit = true } = opts;
  for (const p of parts) p.state ??= {};
  const topo = topology(parts, wires);
  let V = null, net = null, res = null;
  const mk = p => {
    const vAt = pin => { if (!V || !net) return 0; const k = topo.key(p.id, pin); const r = topo.dsu.find(k); return net.__nodeOfRoot?.get(r) !== undefined ? V[net.__nodeOfRoot.get(r)] ?? 0 : 0; };
    return { io, t, dt, v: vAt, I: tag => { if (!res) return 0; const i = net.elements.findIndex(e => e.part === p.id && e.tag === tag); return i < 0 ? 0 : res.currents[i]; } };
  };
  // behavioural parts (logic, 555, relays…) are re-evaluated until their outputs settle
  const behavers = parts.filter(p => MODELS[p.type]?.behave);
  const dynamic = parts.some(p => MODELS[p.type]?.dyn);
  let prevSig = null;
  for (let pass = 0; pass < 12; pass++) {
    net = netlist(parts, topo, mk);
    net.__nodeOfRoot = new Map(); for (const k of topo.dsu.p.keys()) { const r = topo.dsu.find(k); if (!net.__nodeOfRoot.has(r)) { const n = net.node(k); net.__nodeOfRoot.set(r, n); } }
    res = solve(net.nodeCount, net.elements, { dt, V0: V && V.length === net.nodeCount ? V : undefined });
    V = res.V;
    if (!behavers.length && !dynamic) break;
    for (const p of behavers) MODELS[p.type].behave.call(MODELS[p.type], p, mk(p));
    const sig = JSON.stringify(behavers.map(p => p.state)) + (dynamic ? '|' + V.map(x => x.toFixed(6)).join(',') : '');
    if (sig === prevSig) break; prevSig = sig;
  }
  const out = { V: {}, parts: {}, warnings: [], pinCurrent: {}, converged: res.converged, net, t };
  const volt = (id, pin) => { const r = topo.dsu.find(topo.key(id, pin)); const n = net.__nodeOfRoot.get(r); return n === undefined ? 0 : V[n] ?? 0; };
  out.voltAt = volt; out.nodeVoltage = k => { const r = topo.dsu.find(k); const n = net.__nodeOfRoot.get(r); return n === undefined ? 0 : V[n] ?? 0; };
  out.sameNode = (a, b) => topo.dsu.find(a) === topo.dsu.find(b);
  net.elements.forEach((e, i) => { const I = Math.abs(res.currents[i]); for (const pin of e.pins) { const k = topo.key(e.part, pin); out.pinCurrent[k] = Math.max(out.pinCurrent[k] || 0, I); } });
  const mcus = parts.filter(p => isMcu(p.type));
  for (const p of parts) {
    const m = MODELS[p.type]; if (!m) continue;
    const c = mk(p), r = (out.parts[p.id] = {});
    c.els = net.elements.map((e, i) => [e, res.currents[i]]).filter(([e]) => e.part === p.id);
    c.floating = pin => { const k = topo.key(p.id, pin); return !parts.some(q => q.id !== p.id && (MODELS[q.type]?.pins || []).some(pp => topo.dsu.find(topo.key(q.id, pp)) === topo.dsu.find(k))); };
    c.mcuPinsOn = (pins, withBoard) => { const hits = [];
      for (const m2 of mcus) for (const io2 of BOARDS[m2.type].io) for (const pin of pins) if (topo.dsu.find(topo.key(m2.id, io2)) === topo.dsu.find(topo.key(p.id, pin))) hits.push(withBoard ? { pin: io2, vcc: BOARDS[m2.type].vcc } : io2);
      return hits; };
    if (commit && m.commit && dt > 0) m.commit(p, c);
    m.check?.call(m, p, c, (level, text) => out.warnings.push({ level, part: p.id, text }), r);
    if (p.type === 'meter') meterReading(parts, wires, io, p, c, r, out);
  }
  return out;
}

function meterReading(parts, wires, io, p, c, r, out) {
  const mode = p.props.mode || 'V', dv = c.v('V') - c.v('COM');
  if (mode === 'V') r.reading = dv.toFixed(Math.abs(dv) < 10 ? 3 : 2) + ' V';
  if (mode === 'A') { const I = c.I('shunt'); r.reading = fmt(I, 'A');
    if (Math.abs(I) > 10) out.warnings.push({ level: 'bad', part: p.id, text: `Meter current ${fmt(I, 'A')} exceeds the 10 A fuse. An ammeter must be in series, never across a source.` }); }
  if (mode === 'Ω') {
    if (Math.abs(dv) > 0.05) { r.reading = 'ERR'; out.warnings.push({ level: 'bad', part: p.id, text: `Don't measure resistance in a powered circuit. Remove power first.` }); }
    else r.reading = measureOhms(parts, wires, io, p);
  }
}

export function measureOhms(parts, wires, io, meter) {
  const topo = topology(parts, wires);
  const net = netlist(parts.filter(q => q.id !== meter.id), topo, p => ({ io, t: 0, dt: 0, v: () => 0, I: () => 0 }), { zeroSources: true });
  const a = net.node(topo.key(meter.id, 'V')), b = net.node(topo.key(meter.id, 'COM'));
  const els = net.elements;
  els.push({ type: 'I', a, b, i: 1e-3, test: true });
  const res = solve(net.nodeCount, els);
  const Rm = (res.V[a] - res.V[b]) / 1e-3;
  return !isFinite(Rm) || Rm > 4e7 ? 'OL' : fmt(Rm, 'Ω');
}
