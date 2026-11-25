// Projects for the display, sensor, communication and power modules.
const W = (from, to) => ({ from, to });
const uno = { id: 'uno1', type: 'uno', x: 20, y: 220, props: {} };

const tm1637 = { name: '29 · Module: TM1637 4-digit stopwatch', parts: [uno, { id: 'disp1', type: 'tm1637', x: 420, y: 80, props: {} }],
  wires: [W('disp1:CLK', 'uno1:2'), W('disp1:DIO', 'uno1:3'), W('disp1:VCC', 'uno1:5V'), W('disp1:GND', 'uno1:GND.2')],
  code: `#include <TM1637Display.h>
// CLK → D2, DIO → D3. Shows minutes:seconds with a blinking colon.
TM1637Display display(2, 3);

void setup() {
  display.setBrightness(7);
  Serial.begin(9600);
}

void loop() {
  unsigned long s = millis() / 1000;
  int mmss = (s / 60) * 100 + s % 60;
  display.showNumberDecEx(mmss, (s % 2) ? 0b01000000 : 0, true);   // 0b01000000 = colon
  delay(200);
}` };

const matrix = { name: '30 · Module: MAX7219 8×8 LED matrix', parts: [uno, { id: 'mx1', type: 'max7219', x: 440, y: 60, props: {} }],
  wires: [W('mx1:DIN', 'uno1:12'), W('mx1:CLK', 'uno1:11'), W('mx1:CS', 'uno1:10'), W('mx1:VCC', 'uno1:5V'), W('mx1:GND', 'uno1:GND.2')],
  code: `#include <LedControl.h>
// DIN → D12, CLK → D11, CS → D10. Each byte is one row; bit 7 is the left column.
LedControl lc(12, 11, 10, 1);
byte smile[8] = {0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C};
byte heart[8] = {0x00, 0x66, 0xFF, 0xFF, 0xFF, 0x7E, 0x3C, 0x18};

void setup() {
  lc.shutdown(0, false);    // the MAX7219 starts in power-save mode
  lc.setIntensity(0, 8);
  lc.clearDisplay(0);
}

void loop() {
  for (int r = 0; r < 8; r++) lc.setRow(0, r, smile[r]);
  delay(1000);
  for (int r = 0; r < 8; r++) lc.setRow(0, r, heart[r]);
  delay(1000);
}` };

const scale = { name: '31 · Module: HX711 weighing scale', parts: [uno, { id: 'hx1', type: 'hx711', x: 430, y: 80, props: { grams: 0 } }, { id: 'disp1', type: 'tm1637', x: 430, y: 260, props: {} }],
  wires: [W('hx1:DT', 'uno1:3'), W('hx1:SCK', 'uno1:2'), W('hx1:VCC', 'uno1:5V'), W('hx1:GND', 'uno1:GND.2'), W('disp1:CLK', 'uno1:4'), W('disp1:DIO', 'uno1:5'), W('disp1:VCC', 'uno1:5V'), W('disp1:GND', 'uno1:GND.3')],
  code: `#include <HX711.h>
#include <TM1637Display.h>
// HX711 DT → D3, SCK → D2. TM1637 CLK → D4, DIO → D5.
// Select the load cell and drag "Weight on the scale" to weigh something.
HX711 scale;
TM1637Display display(4, 5);
float factor = 420.0;      // counts per gram: found by calibrating with a known weight

void setup() {
  Serial.begin(9600);
  scale.begin(3, 2);
  scale.set_scale(factor);
  scale.tare();            // whatever is on the platform now becomes 0 g
  display.setBrightness(7);
  Serial.println("Scale ready: tared");
}

void loop() {
  float g = scale.get_units(5);
  Serial.print("Weight: "); Serial.print(g, 1); Serial.println(" g");
  display.showNumberDec((int)g);
  delay(500);
}` };

const encoder = { name: '32 · Module: rotary encoder KY-040', parts: [uno, { id: 'enc1', type: 'encoder', x: 440, y: 100, props: { pressed: false } }],
  wires: [W('enc1:CLK', 'uno1:2'), W('enc1:DT', 'uno1:3'), W('enc1:SW', 'uno1:4'), W('enc1:VCC', 'uno1:5V'), W('enc1:GND', 'uno1:GND.2')],
  code: `// CLK → D2, DT → D3, SW → D4. Select the encoder and press the turn buttons.
int counter = 0;
int lastClk;

void setup() {
  pinMode(2, INPUT); pinMode(3, INPUT); pinMode(4, INPUT_PULLUP);
  Serial.begin(9600);
  lastClk = digitalRead(2);
}

void loop() {
  int clk = digitalRead(2);
  if (clk != lastClk && clk == LOW) {          // a falling edge on CLK = one detent
    if (digitalRead(3) != clk) counter++;      // DT still HIGH → clockwise
    else counter--;
    Serial.print("Position: "); Serial.println(counter);
  }
  lastClk = clk;
  if (digitalRead(4) == LOW) { counter = 0; Serial.println("Reset"); delay(300); }
}` };

const bt = { name: '33 · Module: HC-05 Bluetooth LED control', parts: [uno, { id: 'bt1', type: 'hc05', x: 440, y: 80, props: { paired: true } },
    { id: 'r1', type: 'resistor', x: 440, y: 230, props: { ohms: 1000 } }, { id: 'r2', type: 'resistor', x: 540, y: 230, props: { ohms: 2000 } },
    { id: 'led1', type: 'led', x: 650, y: 200, props: { color: 'green' } }, { id: 'r3', type: 'resistor', x: 640, y: 300, props: { ohms: 220 } }],
  wires: [W('bt1:VCC', 'uno1:5V'), W('bt1:GND', 'uno1:GND.2'), W('bt1:TXD', 'uno1:10'), W('uno1:11', 'r1:1'), W('r1:2', 'bt1:RXD'), W('r1:2', 'r2:1'), W('r2:2', 'uno1:GND.3'),
    W('uno1:7', 'led1:A'), W('led1:C', 'r3:1'), W('r3:2', 'uno1:GND.1')],
  code: `#include <SoftwareSerial.h>
// HC-05 TXD → D10 (RX), D11 (TX) → 1k/2k divider → HC-05 RXD (3.3 V).
// Run, select the HC-05 and type ON or OFF in the phone box.
SoftwareSerial bt(10, 11);

void setup() {
  pinMode(7, OUTPUT);
  bt.begin(9600);
  Serial.begin(9600);
  bt.println("Send ON or OFF");
}

void loop() {
  if (bt.available()) {
    String cmd = bt.readStringUntil('\\n');
    cmd.trim();
    Serial.print("Phone says: "); Serial.println(cmd);
    if (cmd == "ON")  { digitalWrite(7, HIGH); bt.println("LED is ON"); }
    if (cmd == "OFF") { digitalWrite(7, LOW);  bt.println("LED is OFF"); }
  }
}` };

const rectifier = { name: '34 · Power: bridge rectifier with filter capacitor', parts: [
    { id: 'tr1', type: 'transformer', x: 40, y: 80, props: { vsec: 12 } },
    ...['d1', 'd2', 'd3', 'd4'].map((id, i) => ({ id, type: 'diode', x: 200 + (i % 2) * 100, y: 50 + Math.floor(i / 2) * 100, props: { kind: 'silicon' } })),
    { id: 'c1', type: 'ecap', x: 430, y: 110, props: { farads: 4.7e-4, rating: 35 } }, { id: 'rl', type: 'resistor', x: 480, y: 200, props: { ohms: 2200 } },
    { id: 'sc1', type: 'scope', x: 200, y: 280, props: { tdiv: 0.01, vdiv: 5 } }],
  // bridge: S1 → D1 → +OUT, S2 → D2 → +OUT, −OUT → D3 → S1, −OUT → D4 → S2
  wires: [W('tr1:S1', 'd1:A'), W('tr1:CT', 'd2:A'), W('d1:K', 'c1:+'), W('d2:K', 'c1:+'), W('d3:K', 'tr1:S1'), W('d4:K', 'tr1:CT'), W('d3:A', 'c1:-'), W('d4:A', 'c1:-'),
    W('c1:+', 'rl:1'), W('rl:2', 'c1:-'), W('sc1:CH1', 'c1:+'), W('sc1:GND', 'c1:-')],
  code: `// No microcontroller: this circuit runs by itself (no need to press Run).
// 12 V RMS winding (S1–CT, 17 V peak) → bridge of 4 × 1N4007 → 470 µF filter → 2.2 kΩ load.
// DC out ≈ 17 − 2 × 0.7 ≈ 15.5 V. Ripple ≈ I / (2·f·C) = 7 mA / (2 × 50 Hz × 470 µF) ≈ 0.15 V at 100 Hz.
// Set C1 to 1 µF (select it) to see the bare full-wave pulses; use S1–S2 for 24 V RMS (check the resistor power!).` };

export const MODULE_PROJECTS = { mod_tm1637: tm1637, mod_matrix: matrix, mod_scale: scale, mod_encoder: encoder, mod_bt: bt, mod_rectifier: rectifier };
