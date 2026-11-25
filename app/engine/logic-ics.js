// Digital ICs for the VTU digital electronics lab: flip-flops, counters, MUX, decoders, adders,
// comparators, shift registers and the 7447 BCD-to-7-segment driver.
// Every chip uses its real DIP pinout (TI/Nexperia datasheets). Inputs are CMOS (100 MΩ), outputs are
// push-pull with ~50 Ω output resistance, so they load and drive the rest of the circuit realistically.
// Sequential chips act on clock edges seen between successive circuit solutions.

// spec: { n, vcc, gnd, inputs: [pin], outputs: [pin], pullups: [pin], openDrain: bool,
//         logic(L, st, edge) → { pin: 0 | 1 | null(high-Z) } }
// L(pin) → 0/1 input level; edge(pin, 'rise'|'fall') → true once on that clock edge.
const pins = n => Array.from({ length: n }, (_, i) => String(i + 1));
const bitsOf = (L, list) => list.reduce((a, p, i) => a | (L(p) << i), 0);
const outBits = (list, v) => Object.fromEntries(list.map((p, i) => [p, (v >> i) & 1]));

export const LOGIC_ICS = {
  hc02: { label: '74HC02', name: 'NOR gate 74HC02', desc: 'Quad 2-input NOR · 2–6 V', n: 14, vcc: '14', gnd: '7',
    inputs: ['2', '3', '5', '6', '8', '9', '11', '12'], outputs: ['1', '4', '10', '13'],
    logic: L => ({ 1: +!(L(2) | L(3)), 4: +!(L(5) | L(6)), 10: +!(L(8) | L(9)), 13: +!(L(11) | L(12)) }) },

  hc74: { label: '74HC74', name: 'D flip-flop 74HC74', desc: 'Dual D flip-flop, rising edge, preset/clear', n: 14, vcc: '14', gnd: '7',
    inputs: ['1', '2', '3', '4', '10', '11', '12', '13'], outputs: ['5', '6', '8', '9'],
    logic(L, st, edge) { const o = {};
      for (const [k, clr, d, clk, pre, q, qn] of [[0, '1', '2', '3', '4', '5', '6'], [1, '13', '12', '11', '10', '9', '8']]) {
        st.q ??= [0, 0]; const c = !L(clr), p = !L(pre);
        if (c || p) { st.q[k] = p ? 1 : 0; o[q] = p ? 1 : 0; o[qn] = c ? 1 : 0; continue; }   // both low: Q = Q̅ = HIGH (datasheet)
        if (edge(clk, 'rise')) st.q[k] = L(d);
        o[q] = st.q[k]; o[qn] = 1 - st.q[k]; }
      return o; } },

  hc112: { label: '74HC112', name: 'JK flip-flop 74HC112', desc: 'Dual JK flip-flop, falling edge, preset/clear', n: 16, vcc: '16', gnd: '8',
    inputs: ['1', '2', '3', '4', '15', '10', '11', '12', '13', '14'], outputs: ['5', '6', '9', '7'],
    logic(L, st, edge) { const o = {};
      for (const [k, clk, kk, j, pre, clr, q, qn] of [[0, '1', '2', '3', '4', '15', '5', '6'], [1, '13', '12', '11', '10', '14', '9', '7']]) {
        st.q ??= [0, 0]; const c = !L(clr), p = !L(pre);
        if (c || p) { st.q[k] = p ? 1 : 0; o[q] = p ? 1 : 0; o[qn] = c ? 1 : 0; continue; }
        if (edge(clk, 'fall')) { const J = L(j), K = L(kk); st.q[k] = J && K ? 1 - st.q[k] : J ? 1 : K ? 0 : st.q[k]; }
        o[q] = st.q[k]; o[qn] = 1 - st.q[k]; }
      return o; } },

  hc161: { label: '74HC161', name: 'Counter 74HC161', desc: '4-bit synchronous binary counter, async clear, load', n: 16, vcc: '16', gnd: '8',
    inputs: ['1', '2', '3', '4', '5', '6', '7', '9', '10'], outputs: ['14', '13', '12', '11', '15'],
    logic(L, st, edge) { st.n ??= 0;
      if (!L(1)) st.n = 0;
      else if (edge(2, 'rise')) { if (!L(9)) st.n = bitsOf(L, ['3', '4', '5', '6']); else if (L(7) && L(10)) st.n = (st.n + 1) & 15; }
      return { ...outBits(['14', '13', '12', '11'], st.n), 15: +(L(10) && st.n === 15) }; } },

  hc90: { label: '74HC90', name: 'Decade counter 74HC90', desc: '÷2 and ÷5 ripple counter (7490), falling edge', n: 14, vcc: '5', gnd: '10',
    inputs: ['14', '1', '2', '3', '6', '7'], outputs: ['12', '9', '8', '11'],
    logic(L, st, edge) { st.a ??= 0; st.b ??= 0; const fa = edge(14, 'fall'), fb = edge(1, 'fall');
      if (L(6) && L(7)) { st.a = 1; st.b = 4; }                 // R9: set to 9 (QD QA = 1)
      else if (L(2) && L(3)) { st.a = 0; st.b = 0; }            // R0: reset to 0
      else { if (fa) st.a ^= 1; if (fb) st.b = (st.b + 1) % 5; }
      return { 12: st.a, 9: st.b & 1, 8: (st.b >> 1) & 1, 11: (st.b >> 2) & 1 }; } },

  cd4017: { label: 'CD4017', name: 'Decade counter CD4017', desc: 'Johnson counter, 10 decoded outputs · 3–15 V', n: 16, vcc: '16', gnd: '8',
    inputs: ['13', '14', '15'], outputs: ['3', '2', '4', '7', '10', '1', '5', '6', '9', '11', '12'],
    logic(L, st, edge) { st.n ??= 0; const r = edge(14, 'rise');
      if (L(15)) st.n = 0; else if (r && !L(13)) st.n = (st.n + 1) % 10;
      const o = Object.fromEntries(['3', '2', '4', '7', '10', '1', '5', '6', '9', '11'].map((p, i) => [p, +(st.n === i)])); o[12] = +(st.n < 5); return o; } },

  hc151: { label: '74HC151', name: '8:1 MUX 74HC151', desc: '8-input multiplexer, Y and Y̅ outputs', n: 16, vcc: '16', gnd: '8',
    inputs: ['4', '3', '2', '1', '15', '14', '13', '12', '11', '10', '9', '7'], outputs: ['5', '6'],
    logic(L) { if (L(7)) return { 5: 0, 6: 1 }; const s = bitsOf(L, ['11', '10', '9']), y = L(['4', '3', '2', '1', '15', '14', '13', '12'][s]); return { 5: y, 6: 1 - y }; } },

  hc153: { label: '74HC153', name: 'Dual 4:1 MUX 74HC153', desc: 'Dual 4-input multiplexer, common select', n: 16, vcc: '16', gnd: '8',
    inputs: ['1', '15', '14', '2', '6', '5', '4', '3', '10', '11', '12', '13'], outputs: ['7', '9'],
    logic(L) { const s = bitsOf(L, ['14', '2']); return { 7: L(1) ? 0 : L(['6', '5', '4', '3'][s]), 9: L(15) ? 0 : L(['10', '11', '12', '13'][s]) }; } },

  hc138: { label: '74HC138', name: '3:8 decoder 74HC138', desc: '3-to-8 line decoder, active-LOW outputs', n: 16, vcc: '16', gnd: '8',
    inputs: ['1', '2', '3', '4', '5', '6'], outputs: ['15', '14', '13', '12', '11', '10', '9', '7'],
    logic(L) { const en = L(6) && !L(4) && !L(5), s = bitsOf(L, ['1', '2', '3']);
      return Object.fromEntries(['15', '14', '13', '12', '11', '10', '9', '7'].map((p, i) => [p, +!(en && i === s)])); } },

  hc283: { label: '74HC283', name: '4-bit adder 74HC283', desc: '4-bit binary full adder with fast carry', n: 16, vcc: '16', gnd: '8',
    inputs: ['5', '3', '14', '12', '6', '2', '15', '11', '7'], outputs: ['4', '1', '13', '10', '9'],
    logic(L) { const s = bitsOf(L, ['5', '3', '14', '12']) + bitsOf(L, ['6', '2', '15', '11']) + L(7); return { ...outBits(['4', '1', '13', '10'], s), 9: s >> 4 }; } },

  hc85: { label: '74HC85', name: 'Comparator 74HC85', desc: '4-bit magnitude comparator, cascadable', n: 16, vcc: '16', gnd: '8',
    inputs: ['10', '12', '13', '15', '9', '11', '14', '1', '2', '3', '4'], outputs: ['5', '6', '7'],
    logic(L) { const a = bitsOf(L, ['10', '12', '13', '15']), b = bitsOf(L, ['9', '11', '14', '1']);
      if (a > b) return { 5: 1, 6: 0, 7: 0 }; if (a < b) return { 5: 0, 6: 0, 7: 1 };
      if (L(3)) return { 5: 0, 6: 1, 7: 0 };                   // equal: cascade inputs decide (datasheet function table)
      return { 5: +!L(2), 6: 0, 7: +!L(4) }; } },

  hc595: { label: '74HC595', name: 'Shift register 74HC595', desc: '8-bit serial-in, parallel-out, latched, 3-state', n: 16, vcc: '16', gnd: '8',
    inputs: ['10', '11', '12', '13', '14'], outputs: ['15', '1', '2', '3', '4', '5', '6', '7', '9'],
    logic(L, st, edge) { st.sr ??= 0; st.out ??= 0; const sh = edge(11, 'rise'), lt = edge(12, 'rise');
      if (!L(10)) st.sr = 0; else if (sh) st.sr = ((st.sr << 1) | L(14)) & 255;
      if (lt) st.out = st.sr;
      const o = Object.fromEntries(['15', '1', '2', '3', '4', '5', '6', '7'].map((p, i) => [p, L(13) ? null : (st.out >> i) & 1])); o[9] = (st.sr >> 7) & 1; return o; } },

  hc194: { label: '74HC194', name: 'Shift register 74HC194', desc: '4-bit bidirectional universal shift register', n: 16, vcc: '16', gnd: '8',
    inputs: ['1', '2', '3', '4', '5', '6', '7', '9', '10', '11'], outputs: ['15', '14', '13', '12'],
    logic(L, st, edge) { st.q ??= 0; const r = edge(11, 'rise');
      if (!L(1)) st.q = 0;
      else if (r) { const m = L(9) | (L(10) << 1);
        if (m === 1) st.q = ((st.q << 1) | L(2)) & 15;                       // shift right: SR → QA → QB → QC → QD
        else if (m === 2) st.q = (st.q >> 1) | (L(7) << 3);                  // shift left: SL → QD → QC → QB → QA
        else if (m === 3) st.q = bitsOf(L, ['3', '4', '5', '6']); }
      return outBits(['15', '14', '13', '12'], st.q); } },

  ls47: { label: '74LS47', name: 'BCD to 7-seg 74LS47', desc: 'Common-anode driver, open-collector active-LOW outputs', n: 16, vcc: '16', gnd: '8', ttl: true,
    inputs: ['7', '1', '2', '6', '3', '4', '5'], pullups: ['7', '1', '2', '6', '3', '4', '5'], outputs: ['13', '12', '11', '10', '9', '15', '14'], openDrain: true,
    // segments a..g lit for 0–15 (datasheet numeral designations: 10–14 are odd symbols, 15 is blank)
    SEG: [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7C, 0x07, 0x7F, 0x67, 0x58, 0x4C, 0x62, 0x69, 0x78, 0x00],
    logic(L) { const v = bitsOf(L, ['7', '1', '2', '6']); let seg = this.SEG[v];
      if (!L(3)) seg = 0x7F; else if (!L(4) || (!L(5) && v === 0)) seg = 0;
      return Object.fromEntries(['13', '12', '11', '10', '9', '15', '14'].map((p, i) => [p, (seg >> i) & 1 ? 0 : null])); } },
};

// Build circuit models (elements / behave / check) for every chip.
export function logicModels({ R, Src, OPEN, supply }) {
  const out = {};
  for (const [type, spec] of Object.entries(LOGIC_ICS)) {
    const { vcc: V, gnd: G } = spec, minV = spec.ttl ? 4.5 : 2;
    out[type] = {
      pins: pins(spec.n), logicIc: true,
      elements(p) { const o = p.state.out || {}, vcc = p.state.vcc || 0, on = vcc >= minV;
        return [R(V, G, spec.ttl ? 400 : 50000, 'iq'),
          ...spec.inputs.map(a => spec.pullups?.includes(a) ? R(a, V, 20000, 'pu' + a) : R(a, G, 1e8, 'in' + a)),
          ...spec.outputs.map(y => { const lv = on ? o[y] : null;
            return lv === null || lv === undefined ? R(y, G, OPEN, 'y' + y) : spec.openDrain ? Src(y, G, 0, 15, 'y' + y) : Src(y, G, lv ? vcc : 0, 50, 'y' + y); })]; },
      behave(p, c) { const vcc = supply(c, V, G), st = p.state; st.vcc = vcc; st.mem ??= {}; st.prev ??= {};
        if (vcc < minV) { st.out = {}; return; }
        const L = pin => (c.v(String(pin)) - c.v(G) > vcc / 2 ? 1 : 0);
        // edges are found by comparing every input with its level at the previous circuit solution
        const now = Object.fromEntries(spec.inputs.map(pin => [pin, L(pin)])), was = st.prev; st.prev = now;
        const edge = (pin, kind) => { pin = String(pin); return was[pin] !== undefined && was[pin] !== now[pin] && (kind === 'rise') === !!now[pin]; };
        st.out = spec.logic.call(spec, L, st.mem, edge); },
      check(p, c, W, o) { const vcc = supply(c, V, G); o.supply = vcc;
        o.outputs = spec.outputs.map(y => `${y}:${p.state.out?.[y] ?? 'Z'}`).join(' ');
        if (vcc > 0.3 && vcc < minV) W('warn', `${spec.label} is not powered: connect pin ${V} to + and pin ${G} to GND.`);
        if (vcc > (spec.label === 'CD4017' ? 15.5 : spec.ttl ? 5.25 : 7)) W('bad', `${spec.label} supply ${vcc.toFixed(1)} V is above its maximum rating.`); },
    };
  }
  return out;
}
