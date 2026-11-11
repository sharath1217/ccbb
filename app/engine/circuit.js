// Builds a netlist from placed parts + wires, solves it and interprets results
// (LED brightness, burnt parts, meter readings, mistakes and warnings).
import { solve, ledParams } from './solver.js';

export const UNO_DIGITAL = ['0','1','2','3','4','5','6','7','8','9','10','11','12','13'];
export const UNO_ANALOG = ['A0','A1','A2','A3','A4','A5'];
const PWM = ['3','5','6','9','10','11'];
export { PWM };

// Electrical model for each part type. `p` = part {id,type,props}, `io` = runtime state (Arduino pins).
export const MODELS = {
  uno: {
    ties: [['GND.1','GND.2'],['GND.2','GND.3'],['A4','A4.2'],['A5','A5.2']], ground: 'GND.1',
    elements(p, io) {
      const el = [{ type:'S', a:'5V', b:'GND.1', v:5, r:0.05, tag:'5V' }, { type:'S', a:'3.3V', b:'GND.1', v:3.3, r:0.5, tag:'3V3' }];
      for (const pin of [...UNO_DIGITAL, ...UNO_ANALOG]) {
        const s = io?.pins?.[pin] || {};
        if (s.mode === 'OUTPUT') el.push({ type:'S', a:pin, b:'GND.1', v:s.v ?? 0, r:25, tag:'pin:'+pin });
        else if (s.mode === 'INPUT_PULLUP') el.push({ type:'S', a:pin, b:'GND.1', v:5, r:35000, tag:'pullup:'+pin });
        else el.push({ type:'R', a:pin, b:'GND.1', r:1e8, tag:'in:'+pin });
      }
      return el;
    } },
  battery: { ground: '-', elements: p => [{ type:'S', a:'+', b:'-', v:p.props.volts ?? 9, r:p.props.rint ?? 1.5, tag:'cell' }] },
  resistor: { elements: p => [{ type:'R', a:'1', b:'2', r:p.props.ohms ?? 220, tag:'R' }] },
  led: { elements: p => p.props.burnt ? [] : [{ type:'D', a:'A', c:'C', ...ledParams(p.props.color), tag:'LED' }] },
  pushbutton: { ties: [['1.l','1.r'],['2.l','2.r']], elements: p => p.props.pressed ? [{ type:'R', a:'1.l', b:'2.l', r:0.05, tag:'contact' }] : [] },
  switch: { elements: p => [{ type:'R', a:'2', b:p.props.on ? '3' : '1', r:0.05, tag:'contact' }] },
  pot: { elements: p => { const t = p.props.ohms ?? 10000, x = (p.props.pos ?? 50) / 100;
    return [{ type:'R', a:'GND', b:'SIG', r:Math.max(x*t,1), tag:'R1' }, { type:'R', a:'SIG', b:'VCC', r:Math.max((1-x)*t,1), tag:'R2' }]; } },
  buzzer: { elements: () => [{ type:'R', a:'1', b:'2', r:42, tag:'coil' }] },
  meter: { elements: p => p.props.mode === 'A' ? [{ type:'R', a:'V', b:'COM', r:0.1, tag:'shunt' }] : [{ type:'R', a:'V', b:'COM', r:10e6, tag:'input' }] },
};

const BB_ROWS = ['TN','TP','A','B','C','D','E','F','G','H','I','J','BP','BN'];
const BB_PINS = BB_ROWS.flatMap(r => Array.from({ length: 30 }, (_, i) => r + (i + 1)));
const BB_TIES = [];
for (let c = 1; c <= 30; c++) { for (const grp of ['ABCDE', 'FGHIJ']) for (let i = 0; i < 4; i++) BB_TIES.push([grp[i] + c, grp[i + 1] + c]); }
for (const r of ['TN', 'TP', 'BP', 'BN']) for (let c = 1; c < 30; c++) BB_TIES.push([r + c, r + (c + 1)]);
MODELS.breadboard = { ties: BB_TIES, elements: () => [] };
export const PIN_LIST = {
  breadboard: BB_PINS,
  uno: ['A5.2','A4.2','AREF','GND.1','13','12','11','10','9','8','7','6','5','4','3','2','1','0','IOREF','RESET','3.3V','5V','GND.2','GND.3','VIN','A0','A1','A2','A3','A4','A5'],
  battery: ['+','-'], resistor: ['1','2'], led: ['A','C'], pushbutton: ['1.l','2.l','1.r','2.r'],
  switch: ['1','2','3'], pot: ['GND','SIG','VCC'], buzzer: ['1','2'], meter: ['COM','V'],
};

class DSU { constructor() { this.p = new Map(); }
  find(x) { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(x, r); return r; }
  union(a, b) { this.p.set(this.find(a), this.find(b)); } }

export function buildNetlist(parts, wires, io, { zeroSources = false } = {}) {
  const dsu = new DSU(), key = (id, pin) => id + ':' + pin;
  for (const p of parts) for (const pin of PIN_LIST[p.type] || []) dsu.find(key(p.id, pin));
  for (const p of parts) for (const [a, b] of MODELS[p.type]?.ties || []) dsu.union(key(p.id, a), key(p.id, b));
  for (const w of wires) dsu.union(w.from, w.to);
  // choose reference: Uno GND first, then battery minus
  const gnds = parts.filter(p => MODELS[p.type]?.ground).sort((a, b) => (a.type === 'uno' ? -1 : 0) - (b.type === 'uno' ? -1 : 0));
  const refRoot = gnds.length ? dsu.find(key(gnds[0].id, MODELS[gnds[0].type].ground)) : null;
  const nodeOf = new Map(); let n = 1; if (refRoot) nodeOf.set(refRoot, 0);
  const node = k => { const r = dsu.find(k); if (!nodeOf.has(r)) nodeOf.set(r, n++); return nodeOf.get(r); };
  for (const k of dsu.p.keys()) node(k);
  const elements = [];
  for (const p of parts) {
    const m = MODELS[p.type]; if (!m) continue;
    for (const e of m.elements(p, io)) {
      const out = { ...e, part: p.id, a: node(key(p.id, e.a)) };
      if (e.b !== undefined) out.b = node(key(p.id, e.b));
      if (e.c !== undefined) out.c = node(key(p.id, e.c));
      if (zeroSources && out.type === 'S') out.v = 0;
      out.pins = [e.a, e.b ?? e.c];
      elements.push(out);
    }
  }
  return { nodeCount: Math.max(n, 1), elements, node, key, hasRef: !!refRoot };
}

const fmt = (v, u) => { const a = Math.abs(v);
  if (a >= 1e6) return (v/1e6).toFixed(2)+' M'+u; if (a >= 1e3) return (v/1e3).toFixed(2)+' k'+u;
  if (a >= 1 || a === 0) return v.toFixed(2)+' '+u; if (a >= 1e-3) return (v*1e3).toFixed(1)+' m'+u; return (v*1e6).toFixed(0)+' µ'+u; };
export { fmt };

// Main entry: returns everything the UI needs.
export function simulate(parts, wires, io = {}) {
  const net = buildNetlist(parts, wires, io);
  const res = solve(net.nodeCount, net.elements);
  const V = res.V, out = { V: {}, parts: {}, warnings: [], pinCurrent: {}, converged: res.converged, net };
  const volt = (id, pin) => V[net.node(net.key(id, pin))] ?? 0;
  out.voltAt = (id, pin) => volt(id, pin);
  net.elements.forEach((e, i) => { const I = Math.abs(res.currents[i]);
    for (const pin of e.pins) { const k = net.key(e.part, pin); out.pinCurrent[k] = Math.max(out.pinCurrent[k] || 0, I); } });
  const W = (level, part, text) => out.warnings.push({ level, part, text });
  const byPart = id => net.elements.map((e, i) => [e, res.currents[i]]).filter(([e]) => e.part === id);
  for (const p of parts) {
    const els = byPart(p.id), r = (out.parts[p.id] = {});
    if (p.type === 'led') {
      const I = els[0]?.[1] ?? 0; r.current = I; r.brightness = p.props.burnt ? 0 : Math.max(0, Math.min(1, I / 0.02));
      if (p.props.burnt) W('bad', p.id, `LED is burnt out. Real LEDs die above ~30 mA. Replace it and add a series resistor (220 Ω at 5 V).`);
      else if (I > 0.03) { r.burn = true; W('bad', p.id, `LED current ${fmt(I,'A')} is far above its 20 mA rating. It just burnt out! Add a series resistor.`); }
      else if (I > 0.021) W('warn', p.id, `LED current ${fmt(I,'A')} is above the 20 mA rating. It will age fast; use a bigger resistor.`);
      const vr = volt(p.id, 'C') - volt(p.id, 'A'); if (vr > 5) W('warn', p.id, `LED reverse voltage ${vr.toFixed(1)} V exceeds the typical 5 V limit.`);
    }
    if (p.type === 'resistor') { const I = els[0]?.[1] ?? 0, P = I * I * (p.props.ohms ?? 220); r.current = I; r.power = P;
      if (P > 0.25) W('bad', p.id, `Resistor dissipates ${fmt(P,'W')}, above its 0.25 W rating. It will overheat and burn.`); }
    if (p.type === 'battery') { const I = els[0]?.[1] ?? 0; r.current = I;
      if (I > 2) W('bad', p.id, `Short circuit! The battery is delivering ${fmt(I,'A')}. It will heat up quickly.`); }
    if (p.type === 'buzzer') { const I = els[0]?.[1] ?? 0; r.current = I; r.on = Math.abs(I) > 0.005; }
    if (p.type === 'uno') {
      for (const [e, I] of els) {
        if (e.tag === '5V' && I > 0.5) W('bad', p.id, `Short circuit on the 5 V pin (${fmt(I,'A')}). USB power would cut out or the board could be damaged.`);
        if (e.tag === '3V3' && I > 0.15) W('bad', p.id, `3.3 V pin overloaded (${fmt(I,'A')}); it can supply only ~50 mA.`);
        if (e.tag.startsWith('pin:')) { const a = Math.abs(I), pin = e.tag.slice(4);
          if (a > 0.04) W('bad', p.id, `Pin ${pin} is sourcing ${fmt(a,'A')}. The absolute max is 40 mA: this damages the ATmega328P.`);
          else if (a > 0.02) W('warn', p.id, `Pin ${pin} current ${fmt(a,'A')} is above the recommended 20 mA.`); }
      }
      const vin = volt(p.id, '5V'); if (vin > 5.6) W('bad', p.id, `${vin.toFixed(1)} V applied to the 5 V pin. Max is 5.5 V: this destroys the board. Use VIN for 7–12 V.`);
    }
    if (p.type === 'meter') {
      const mode = p.props.mode || 'V', dv = volt(p.id, 'V') - volt(p.id, 'COM');
      if (mode === 'V') r.reading = dv.toFixed(Math.abs(dv) < 10 ? 3 : 2) + ' V';
      if (mode === 'A') { const I = els[0]?.[1] ?? 0; r.reading = fmt(I, 'A');
        if (Math.abs(I) > 10) W('bad', p.id, `Meter current ${fmt(I,'A')} exceeds the 10 A fuse. Did you connect the ammeter across a source? It must be in series.`); }
      if (mode === 'Ω') {
        if (Math.abs(dv) > 0.05) { r.reading = 'ERR'; W('bad', p.id, `Don't measure resistance in a powered circuit. Remove power first.`); }
        else r.reading = measureOhms(parts, wires, io, p);
      }
    }
  }
  out.nodeVoltage = k => V[net.node(k)] ?? 0;
  return out;
}

export function measureOhms(parts, wires, io, meter) {
  const others = parts.map(p => p.id === meter.id ? { ...p, props: { ...p.props, mode: 'Ω-open' } } : p);
  const net = buildNetlist(others, wires, io, { zeroSources: true });
  // remove the meter's own 10 MΩ input, inject 1 mA test current
  const els = net.elements.filter(e => e.part !== meter.id);
  const a = net.node(net.key(meter.id, 'V')), b = net.node(net.key(meter.id, 'COM'));
  els.push({ type: 'I', a, b, i: 1e-3 });
  const r = solve(net.nodeCount, els);
  const R = (r.V[a] - r.V[b]) / 1e-3;
  if (!isFinite(R) || R > 4e7) return 'OL';
  return fmt(R, 'Ω');
}
