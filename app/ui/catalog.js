// Parts the student can place, and starter projects.
export const CATALOG = [
  { type: 'uno', tag: 'wokwi-arduino-uno', name: 'Arduino Uno', group: 'Boards', props: {}, desc: 'ATmega328P · 5 V · 14 digital + 6 analog pins' },
  { type: 'breadboard', tag: 'cb-breadboard', name: 'Breadboard', group: 'Boards', props: {}, desc: 'Half size · 30 columns · rows a–e and f–j joined, + and − rails' },
  { type: 'battery', tag: 'cb-battery', name: '9 V Battery', group: 'Power', props: { volts: 9, rint: 1.5 }, desc: 'Alkaline 9 V, ~1.5 Ω internal resistance' },
  { type: 'resistor', tag: 'wokwi-resistor', name: 'Resistor', group: 'Passive', props: { ohms: 220 }, desc: '¼ W carbon film' },
  { type: 'pot', tag: 'wokwi-potentiometer', name: 'Potentiometer 10k', group: 'Passive', props: { ohms: 10000, pos: 50 }, desc: 'Rotary, linear taper' },
  { type: 'led', tag: 'wokwi-led', name: 'LED', group: 'Output', props: { color: 'red' }, desc: '5 mm, 20 mA rated' },
  { type: 'buzzer', tag: 'wokwi-buzzer', name: 'Active buzzer', group: 'Output', props: {}, desc: '5 V, beeps when powered' },
  { type: 'pushbutton', tag: 'wokwi-pushbutton', name: 'Push button', group: 'Input', props: { pressed: false }, desc: 'Momentary, 4 legs (pairs joined)' },
  { type: 'switch', tag: 'wokwi-slide-switch', name: 'Slide switch', group: 'Input', props: { on: false }, desc: 'SPDT: middle pin connects to a side' },
  { type: 'meter', tag: 'cb-multimeter', name: 'Multimeter', group: 'Instruments', props: { mode: 'V' }, desc: 'Volts · Amps · Ohms' },
];
export const BY_TYPE = Object.fromEntries(CATALOG.map(c => [c.type, c]));

const W = (from, to) => ({ from, to });
export const PROJECTS = {
  blink: { name: '1 · Blink an LED', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'red' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } }],
    wires: [W('uno1:13', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2')],
    code: `// Blink: turn the LED on for 1 second, off for 1 second
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}` },
  button: { name: '2 · Button controls LED', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'green' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } },
      { id: 'btn1', type: 'pushbutton', x: 470, y: 400, props: { pressed: false } }],
    wires: [W('uno1:13', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2'), W('uno1:2', 'btn1:1.l'), W('btn1:2.l', 'uno1:GND.3')],
    code: `// Hold the button to light the LED
const int BUTTON = 2;
const int LED = 13;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);  // pressed = LOW
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool pressed = digitalRead(BUTTON) == LOW;
  digitalWrite(LED, pressed ? HIGH : LOW);
  Serial.println(pressed ? "pressed" : "released");
  delay(200);
}` },
  dimmer: { name: '3 · Knob dims an LED (PWM)', parts: [
      { id: 'uno1', type: 'uno', x: 30, y: 290, props: {} },
      { id: "bb1", type: "breadboard", x: 330, y: 60, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 220 }, at: { bb: 'bb1', pin: '1', hole: 'C8' } },
      { id: 'led1', type: 'led', x: 0, y: 0, props: { color: 'yellow' }, at: { bb: 'bb1', pin: 'C', hole: 'A13' } },
      { id: 'pot1', type: 'pot', x: 0, y: 0, props: { ohms: 10000, pos: 50 }, at: { bb: 'bb1', pin: 'GND', hole: 'F22' } }],
    wires: [W('uno1:9', 'bb1:E8'), W('bb1:E13', 'bb1:TN13'), W('uno1:GND.1', 'bb1:TN2'), W('bb1:J22', 'bb1:BN22'), W('bb1:J24', 'bb1:BP24'), W('uno1:5V', 'bb1:BP2'), W('uno1:GND.2', 'bb1:BN2'), W('uno1:A0', 'bb1:J23')],
    code: `// Turn the knob to change LED brightness
void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);              // 0..1023
  int level = map(knob, 0, 1023, 0, 255); // 0..255
  analogWrite(9, level);
  Serial.print("A0 = "); Serial.println(knob);
  delay(200);
}` },
  battery: { name: '4 · Battery + LED (no code)', parts: [
      { id: 'bat1', type: 'battery', x: 90, y: 160, props: { volts: 9, rint: 1.5 } },
      { id: 'sw1', type: 'switch', x: 260, y: 90, props: { on: true } },
      { id: 'r1', type: 'resistor', x: 380, y: 130, props: { ohms: 470 } },
      { id: 'led1', type: 'led', x: 520, y: 90, props: { color: 'red' } },
      { id: 'm1', type: 'meter', x: 330, y: 260, props: { mode: 'V' } }],
    wires: [W('bat1:+', 'sw1:2'), W('sw1:3', 'r1:1'), W('r1:2', 'led1:A'), W('led1:C', 'bat1:-'), W('m1:V', 'led1:A'), W('m1:COM', 'bat1:-')],
    code: `// This circuit has no microcontroller: just a battery.\n// Flip the switch, change the resistor, and read the multimeter.` },
  burn: { name: '5 · Mistake lab: LED without resistor', parts: [
      { id: 'bat1', type: 'battery', x: 120, y: 160, props: { volts: 9, rint: 1.5 } },
      { id: 'led1', type: 'led', x: 330, y: 110, props: { color: 'red' } }],
    wires: [W('bat1:+', 'led1:A'), W('led1:C', 'bat1:-')],
    code: `// What happens when you connect an LED straight to 9 V?\n// Look at the warnings panel, then fix it with a resistor.` },
  divider: { name: '6 · Voltage divider + multimeter', parts: [
      { id: 'bat1', type: 'battery', x: 80, y: 150, props: { volts: 9, rint: 1.5 } },
      { id: 'bb1', type: 'breadboard', x: 240, y: 110, props: {} },
      { id: 'r1', type: 'resistor', x: 0, y: 0, props: { ohms: 1000 }, at: { bb: 'bb1', pin: '1', hole: 'C6' } },
      { id: 'r2', type: 'resistor', x: 0, y: 0, props: { ohms: 2000 }, at: { bb: 'bb1', pin: '1', hole: 'D12' } },
      { id: 'm1', type: 'meter', x: 600, y: 90, props: { mode: 'V' } }],
    wires: [W('bat1:+', 'bb1:TP1'), W('bat1:-', 'bb1:TN1'), W('bb1:TP6', 'bb1:A6'), W('bb1:E18', 'bb1:TN18'), W('m1:V', 'bb1:E12'), W('m1:COM', 'bb1:TN24')],
    code: `// Vout = Vin × R2 / (R1 + R2) = 9 × 2k / 3k = 6 V\n// Change R1 or R2 and check the multimeter.` },
};
