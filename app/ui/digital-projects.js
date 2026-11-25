// VTU digital electronics lab projects built on a breadboard with real 74xx chips.
const W = (from, to) => ({ from, to });
const B = h => 'bb1:' + h;
const res = (id, ohms, x, y) => ({ id, type: 'resistor', x, y, props: { ohms } });
const power5 = () => [{ id: 'ps1', type: 'battery', x: 40, y: 140, props: { volts: 5, rint: 0.05 } }, { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} }];
const rails = [W('ps1:+', B('TP1')), W('ps1:-', B('TN1')), W(B('TP2'), B('BP2')), W(B('TN3'), B('BN3'))];

// Decade counter: 555 clock (≈1 Hz) → 74HC90 (BCD) → 74LS47 → common-anode 7-segment display
const segs = [['a', 20], ['b', 21], ['c', 22], ['d', 23], ['e', 24], ['f', 18], ['g', 19]];
const counter = { name: '25 · Digital: decade counter 7490 + 7447 + 7-segment (555 clock)', parts: [...power5(),
    { id: 't1', type: 'ne555', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F2' } },
    { id: 'u1', type: 'hc90', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F8' } },
    { id: 'u2', type: 'ls47', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F17' } },
    res('r1', 1000, 210, 300), res('r2', 68000, 290, 300), { id: 'c1', type: 'ecap', x: 380, y: 290, props: { farads: 1e-5, rating: 25 } },
    ...segs.map(([k], i) => res('r' + k, 330, 540, 70 + i * 26)),
    { id: 'd1', type: 'seg7', x: 650, y: 90, props: { common: 'anode' } }],
  wires: [...rails,
    // 555 astable: f = 1.44 / ((R1 + 2·R2)·C) = 1.44 / (137 kΩ · 10 µF) ≈ 1.05 Hz
    W(B('J2'), B('BN4')), W(B('A2'), B('TP4')), W(B('J5'), B('BP5')), W(B('B2'), 'r1:1'), W('r1:2', B('B3')), W(B('C3'), 'r2:1'), W('r2:2', B('C4')),
    W(B('D4'), B('G3')), W(B('H3'), 'c1:+'), W('c1:-', B('BN6')), W(B('I4'), B('C8')),
    // 74HC90 as BCD counter: R0 and R9 to GND, QA → CKB
    W(B('J12'), B('BP12')), W(B('A12'), B('TN12')), W(B('J9'), B('BN9')), W(B('J10'), B('BN10')), W(B('J13'), B('BN13')), W(B('J14'), B('BN14')), W(B('B10'), B('G8')),
    // 74LS47: VCC, GND, BCD inputs (LT, BI, RBI left open: TTL inputs float HIGH)
    W(B('A17'), B('TP17')), W(B('J24'), B('BN24')), W(B('C10'), B('H23')), W(B('C13'), B('H17')), W(B('C14'), B('H18')), W(B('C11'), B('H22')),
    ...segs.flatMap(([k, col]) => [W(B('B' + col), 'r' + k + ':1'), W('r' + k + ':2', 'd1:' + k.toUpperCase())]), W('d1:COM.1', B('TP26'))],
  code: `// No microcontroller: a classic VTU digital lab circuit.
// 555 astable (about 1 Hz) → 74HC90 decade counter (QA wired to CKB for BCD) →
// 74LS47 BCD-to-7-segment decoder → common-anode display through 330 Ω resistors.
// Try: connect R0(1) and R0(2) (pins 2, 3) to +5 V to reset, or R9 (pins 6, 7) to show 9.
// Change C1 to 1 µF to count ten times faster.` };

// 74HC595 shift register driven by an Arduino (shiftOut) → 8-LED bar graph
const shiftReg = { name: '26 · Digital: 74HC595 shift register with Arduino shiftOut', parts: [
    { id: 'uno1', type: 'uno', x: 20, y: 300, props: {} }, { id: 'bb1', type: 'breadboard', x: 200, y: 60, props: {} },
    { id: 'u1', type: 'hc595', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
    ...Array.from({ length: 8 }, (_, i) => res('r' + i, 330, 540, 66 + i * 24)),
    { id: 'bar1', type: 'bargraph', x: 650, y: 80, props: {} }],
  wires: [W('uno1:5V', B('TP1')), W('uno1:GND.1', B('TN1')), W(B('TP2'), B('BP2')), W(B('TN3'), B('BN3')),
    W(B('A10'), B('TP10')), W(B('J17'), B('BN17')), W(B('A16'), B('TP16')), W(B('A13'), B('TN13')),
    W('uno1:11', B('B12')), W('uno1:12', B('B15')), W('uno1:8', B('B14')),
    ...['C11', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15', 'G16'].flatMap((h, i) => [W(B(h), 'r' + i + ':1'), W('r' + i + ':2', 'bar1:A' + (i + 1)), W('bar1:C' + (i + 1), B('BN' + (20 + i)))])],
  code: `// 74HC595: 3 Arduino pins drive 8 LEDs. QA–QH → 330 Ω → bar graph.
// SER (pin 14) = D11, SRCLK (pin 11) = D12, RCLK/latch (pin 12) = D8, OE (13) = GND, SRCLR (10) = +5 V.
int dataPin = 11, clockPin = 12, latchPin = 8;

void show(int value) {
  digitalWrite(latchPin, LOW);
  shiftOut(dataPin, clockPin, MSBFIRST, value);
  digitalWrite(latchPin, HIGH);      // rising edge copies the shift register to the outputs
}

void setup() {
  pinMode(dataPin, OUTPUT); pinMode(clockPin, OUTPUT); pinMode(latchPin, OUTPUT);
  Serial.begin(9600);
  show(0b10110010); Serial.println("pattern 10110010");
  delay(1500);
}

void loop() {
  for (int i = 0; i < 8; i++) { show(1 << i); delay(150); }   // running light
}` };

// D flip-flop 74HC74: switch on D, push-button clock, LEDs on Q and Q̅
const dff = { name: '27 · Digital: D flip-flop 74HC74 (switch + clock button)', parts: [...power5(),
    { id: 'u1', type: 'hc74', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
    { id: 'swD', type: 'switch', x: 240, y: 300, props: { on: true } }, { id: 'btn1', type: 'pushbutton', x: 340, y: 300, props: { pressed: false } },
    res('rp', 10000, 430, 310), res('rq', 330, 540, 110), res('rqn', 330, 540, 160),
    { id: 'ledQ', type: 'led', x: 630, y: 80, props: { color: 'red' } }, { id: 'ledQn', type: 'led', x: 690, y: 80, props: { color: 'green' } }],
  wires: [...rails, W(B('A10'), B('TP10')), W(B('J16'), B('BN16')), W(B('J10'), B('BP10')), W(B('J13'), B('BP13')),
    W(B('A14'), B('TP14')), W(B('A11'), B('TP11')), W(B('A13'), B('TN13')), W(B('A12'), B('TN12')),
    W('swD:2', B('I11')), W('swD:1', B('BN11')), W('swD:3', B('BP11')),
    W('btn1:1.l', B('BP15')), W('btn1:2.l', B('H12')), W(B('G12'), 'rp:1'), W('rp:2', B('BN22')),
    W(B('I14'), 'rq:1'), W('rq:2', 'ledQ:A'), W('ledQ:C', B('BN25')), W(B('I15'), 'rqn:1'), W('rqn:2', 'ledQn:A'), W('ledQn:C', B('BN26'))],
  code: `// 74HC74 positive-edge D flip-flop. CLR (1) and PRE (4) tied HIGH (inactive).
// D (pin 2) comes from the slide switch; CLK (pin 3) from the push button with a 10 kΩ pull-down.
// Q is stored ONLY at the moment the button is pressed (rising edge):
// set the switch, press the button, then change the switch and see that Q does not follow.
// Unused second flip-flop: its inputs are tied to a rail, as on a real board.` };

// 4-bit binary adder 74HC283: DIP switches for A and B, LEDs for the 5-bit sum
const sumH = ['H13', 'H10', 'D13', 'D16', 'D17'], inA = ['G14', 'G12', 'C12', 'C14'], inB = ['G15', 'G11', 'C11', 'C15'];
const adder = { name: '28 · Digital: 4-bit adder 74HC283 (DIP switches + LEDs)', parts: [...power5(),
    { id: 'u1', type: 'hc283', x: 0, y: 0, props: {}, at: { bb: 'bb1', pin: '1', hole: 'F10' } },
    { id: 'sw1', type: 'dipswitch', x: 220, y: 300, props: { bits: [1, 0, 1, 0, 0, 1, 1, 0] } },
    ...Array.from({ length: 8 }, (_, i) => res('pd' + i, 10000, 360, 290 + i * 22)),
    ...Array.from({ length: 5 }, (_, i) => res('rs' + i, 330, 540, 70 + i * 26)),
    { id: 'bar1', type: 'bargraph', x: 650, y: 80, props: {} }],
  wires: [...rails, W(B('A10'), B('TP10')), W(B('J17'), B('BN17')), W(B('J16'), B('BN16')),
    ...[...inA, ...inB].flatMap((h, i) => [W('sw1:' + (i + 1) + 'a', B('BP' + (4 + i))), W('sw1:' + (i + 1) + 'b', B(h)), W(B(h.replace(/^./, c => c === 'G' ? 'I' : 'A')), 'pd' + i + ':1'), W('pd' + i + ':2', B('BN' + (18 + i)))]),
    ...sumH.flatMap((h, i) => [W(B(h.replace(/^H/, 'J').replace(/^D/, 'B')), 'rs' + i + ':1'), W('rs' + i + ':2', 'bar1:A' + (i + 1)), W('bar1:C' + (i + 1), B('TN' + (20 + i)))])],
  code: `// 74HC283 4-bit full adder.  Switches 1–4 = A (A1 is the LSB), switches 5–8 = B. Carry-in C0 = 0.
// Bars 1–4 show the sum S1–S4, bar 5 the carry-out C4.
// Each input has a 10 kΩ pull-down so it reads 0 when its switch is OFF (CMOS inputs must never float).
// Start: A = 0101 (5), B = 0110 (6) → sum = 01011 (11).  Try 1111 + 0001 to see the carry.` };

export const DIGITAL_PROJECTS = { dig_counter: counter, dig_595: shiftReg, dig_dff: dff, dig_adder: adder };
