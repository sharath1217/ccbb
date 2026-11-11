// Lab assistant: an offline tutor that reads the student's circuit, plus optional Claude (student/teacher API key).
import { INFO } from './info.js';

// How to wire each common part to a 5 V Arduino (offline answers)
export const WIRING = {
  led: 'Long leg (A) → 220 Ω resistor → a digital pin. Short leg (C) → GND.',
  pushbutton: 'One leg → a digital pin, the opposite-side leg → GND. In code: pinMode(pin, INPUT_PULLUP); pressed reads LOW.',
  pot: 'Outer pins → 5V and GND, middle pin (SIG) → A0. Read with analogRead(A0).',
  dht22: 'VCC → 5V, GND → GND, SDA (data) → pin 2. Use #include <DHT.h> and DHT dht(2, DHT22);',
  hcsr04: 'VCC → 5V, GND → GND, TRIG → pin 9, ECHO → pin 10. Pulse TRIG for 10 µs, then pulseIn(10, HIGH) × 0.0343 / 2 = cm.',
  pir: 'VCC → 5V, GND → GND, OUT → pin 2. digitalRead(2) is HIGH when motion is seen.',
  ldr: 'VCC → 5V, GND → GND, AO → A0 (analog light level), DO → a digital pin (on/off at the pot threshold).',
  ntc: 'VCC → 5V, GND → GND, OUT → A0. 25 °C reads about 512.',
  gas: 'VCC → 5V, GND → GND, AOUT → A0. Higher reading = more gas. DOUT goes LOW above the threshold.',
  flame: 'VCC → 5V, GND → GND, DOUT → a digital pin (LOW = flame), AOUT → A0.',
  sound: 'VCC → 5V, GND → GND, DOUT → a digital pin (HIGH on loud sound), AOUT → A0.',
  servo: 'Brown → GND, Red → 5V, Orange → a PWM pin (e.g. 9). Use #include <Servo.h>, servo.attach(9), servo.write(angle).',
  lcd: 'GND → GND, VCC → 5V, SDA → A4, SCL → A5 (on Uno). Use LiquidCrystal_I2C lcd(0x27, 16, 2).',
  oled: 'GND → GND, VIN → 5V (or 3.3V), DATA (SDA) → A4, CLK (SCL) → A5. Address 0x3C.',
  relay: 'Never drive the coil from a pin. Pin → 1 kΩ → NPN base, coil between 5V and collector, emitter → GND, diode across the coil.',
  motor: 'Use a MOSFET: pin → gate (10 kΩ gate→GND), motor between battery + and drain, source → GND, diode across the motor. Join battery − with Arduino GND.',
  buzzer: '+ (pin 1) → a digital pin, − → GND. digitalWrite(pin, HIGH) beeps.',
  rgb: 'Common (longest) leg → GND. R, G and B each through their own 220 Ω resistor to PWM pins.',
  seg7: 'COM → GND (common cathode). Each segment A–G through a 220 Ω resistor to a pin.',
  npn: 'Pin → 1 kΩ → B. Load between + and C. E → GND.',
  nmos: 'Pin → G (plus 10 kΩ from G to S). Load between + and D. S → GND.',
  lm358: 'Pin 8 → +, pin 4 → GND. Amplifier 1 uses pins 1 (out), 2 (−), 3 (+).',
  ne555: 'Pin 8 and 4 → +, pin 1 → GND, 2 and 6 joined to the capacitor, R1 from + to pin 7, R2 from 7 to 6. Output on pin 3.',
  keypad: 'R1–R4 and C1–C4 to 8 digital pins. Scan: drive one row LOW at a time and read the columns with INPUT_PULLUP.',
  joystick: 'VCC → 5V, GND → GND, VERT → A0, HORZ → A1, SEL → a digital pin with INPUT_PULLUP.',
};

const CODE = {
  dht22: '#include <DHT.h>\nDHT dht(2, DHT22);\nvoid setup(){ Serial.begin(9600); dht.begin(); }\nvoid loop(){ Serial.println(dht.readTemperature()); delay(2000); }',
  hcsr04: 'void setup(){ Serial.begin(9600); pinMode(9, OUTPUT); pinMode(10, INPUT); }\nvoid loop(){\n  digitalWrite(9, LOW); delayMicroseconds(2); digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW);\n  long cm = pulseIn(10, HIGH) * 0.0343 / 2;\n  Serial.println(cm); delay(200);\n}',
  ldr: 'void setup(){ Serial.begin(9600); }\nvoid loop(){ Serial.println(analogRead(A0)); delay(200); }',
  pir: 'void setup(){ Serial.begin(9600); pinMode(2, INPUT); }\nvoid loop(){ if (digitalRead(2)) Serial.println("Motion!"); delay(200); }',
  gas: 'void setup(){ Serial.begin(9600); pinMode(8, OUTPUT); }\nvoid loop(){ int g = analogRead(A0); digitalWrite(8, g > 400); Serial.println(g); delay(300); }',
  servo: '#include <Servo.h>\nServo s;\nvoid setup(){ s.attach(9); }\nvoid loop(){ s.write(0); delay(1000); s.write(180); delay(1000); }',
  led: 'void setup(){ pinMode(13, OUTPUT); }\nvoid loop(){ digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }',
  pushbutton: 'void setup(){ pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }\nvoid loop(){ digitalWrite(13, digitalRead(2) == LOW); }',
  lcd: '#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup(){ lcd.init(); lcd.backlight(); lcd.print("Hello!"); }\nvoid loop(){}',
};

const TOOLS_HELP = 'Real-world tools are in the "Real world" group: drag the 🔥 lighter, 🌀 fan, 🧴 gas can, 🔦 torch, ✋ hand, 🧊 ice, 💧 water, 🔊 speaker, 🧲 magnet or 💳 RFID card next to a sensor. Closer = stronger. Click a tool and use its switch (e.g. "Lit") to turn it on.';

// ---------- offline tutor ----------
export function offlineAnswer(q, ctx, BY_TYPE) {
  const t = q.toLowerCase(), out = [];
  const find = () => { const all = Object.entries(BY_TYPE).sort((a, b) => b[1].name.length - a[1].name.length);
    for (const [type, c] of all) { const names = [c.name.toLowerCase(), type, ...c.name.toLowerCase().split(/[ (]/).filter(w => w.length > 3 && !['sensor', 'module', 'temp', 'with'].includes(w))];
      if (names.some(n => t.includes(n))) return type; }
    return ctx.selected?.type || null; };
  const part = find(), c = part && BY_TYPE[part], d = part && INFO[part];
  if (/not work|doesn.?t work|wrong|problem|error|why|help|stuck|fix/.test(t)) {
    if (ctx.warnings.length) out.push('**The circuit check found:**\n' + ctx.warnings.map(w => '• ' + w.text).join('\n'));
    if (ctx.unconnected.length) out.push('**These parts have pins that are not connected to anything:**\n' + ctx.unconnected.map(u => `• ${u.name}: ${u.pins.join(', ')}`).join('\n'));
    if (ctx.board && !ctx.running && ctx.code.trim()) out.push('Your code is not running. Press **▶ Run**.');
    if (!ctx.board && ctx.parts.some(p => ['dht22', 'hcsr04', 'lcd', 'oled', 'servo'].includes(p.type))) out.push('These parts need a microcontroller running code. Add an Arduino Uno from the left and wire it up.');
    if (ctx.codeError) out.push('**Your code has an error:** ' + ctx.codeError + '\nCheck brackets { } and semicolons ; on the line before.');
    if (!out.length) out.push('I don\'t see any wiring problems. Check: is every GND connected together? Are your pin numbers in the code the same as the wires? Open the Serial Monitor output to see what the code is doing.');
  }
  if (/connect|wire|wiring|pin|hook/.test(t) && part) out.push(`**How to connect the ${c.name}:** ${WIRING[part] || d?.pins.map(([a, b]) => `${a}: ${b}`).join('; ') || ''}`);
  if (/code|program|sketch|example/.test(t) && part && CODE[part]) out.push(`**Example code for the ${c.name}:**\n\`\`\`\n${CODE[part]}\n\`\`\``);
  if (/what is|explain|how does|how it works|inside|tell me/.test(t) && d) out.push(`**${c.name}:** ${d.how}\n\n*Inside:* ${d.inside}`);
  if (/buy|price|cost|cheap/.test(t)) out.push(part && c?.price ? `${c.name} costs about ₹${c.price[0]}–${c.price[1]}. ${d?.buy || ''}` : 'Click **🧾 Parts & cost** in the toolbar to see the full shopping list for your circuit with prices.');
  if (/test|lighter|fan|gas|torch|real|game|heat|fire|smoke|hand|try/.test(t)) out.push(TOOLS_HELP + (part ? `\n\nFor the ${c.name}: ${toolTip(part)}` : ''));
  if (/mistake|careful|danger|burn|damage/.test(t) && d) out.push('**Common mistakes:**\n' + d.mistakes.filter(Boolean).map(m => '• ' + m).join('\n'));
  if (!out.length && d) out.push(`**${c.name}:** ${d.how}\n\n**How to connect:** ${WIRING[part] || d.pins.map(([a, b]) => `${a}: ${b}`).join('; ')}`);
  if (!out.length) out.push('I can help with: **"why is my circuit not working?"**, **"how do I connect the DHT22?"**, **"code for the ultrasonic sensor"**, **"what is a MOSFET?"**, **"how do I test the gas sensor?"** or **"how much will this cost?"**. Select a part first and I will answer about that part.');
  return out.join('\n\n');
}
function toolTip(type) {
  return ({ dht22: 'bring the 🔥 lighter close (watch the temperature rise), then the 🌀 fan or 🧊 ice to cool it. 💧 water raises humidity.', ntc: 'the 🔥 lighter heats it, 🧊 ice cools it.', ldr: 'shine the 🔦 torch on it, or move it away for darkness.',
    flame: 'bring the 🔥 lighter (lit) within 80 cm. The 🔦 torch should NOT trigger it much.', gas: 'use the 🧴 gas can, or the lighter in "Gas only" mode (unlit). The 🌀 fan clears the gas.', hcsr04: 'move the ✋ hand in front of it: the distance follows.',
    pir: 'drag the ✋ hand around near it: moving = motion.', sound: 'turn on the 🔊 speaker near it.', heartbeat: 'put the ✋ hand (finger) right on it.', hall: 'bring the 🧲 magnet close.', reed: 'bring the 🧲 magnet close.', touch: 'touch it with the ✋ hand.',
    irobstacle: 'move the ✋ hand within 10 cm.', rain: 'drop 💧 water on it.', soil: 'pour 💧 water next to it.', rc522: 'hold the 💳 RFID card over it.', water: 'put it in 💧 water.' })[type] || 'try the real-world tools near it.';
}

// ---------- Claude (optional, uses the student's or teacher's own API key) ----------
const SYSTEM = `You are the lab assistant inside ccbb, a virtual electronics lab used by engineering students (often in India) to build and test circuits before buying parts.
Help the student understand and fix their circuit and code. Be encouraging, practical and short: explain in simple words, then give exact steps (which pin to which pin, which line of code to change). Use ₹ for prices.
You receive the student's current circuit (parts, which pins are connected together, the simulator's warnings, their code and serial output). Base your answer on it; if something is missing, say so.
Teach, don't just answer: when you fix a mistake, say why it was wrong in one sentence. Never encourage unsafe mains (230 V) work without a teacher.
In this simulator, students can drag real-world tools (lighter, fan, gas can, torch, hand, ice, water, speaker, magnet, RFID card) near sensors to test them.`;

let sdk = null;
export async function askClaude({ apiKey, model, question, ctx, history, onText }) {
  if (!sdk) sdk = (await import('../../vendor/anthropic-sdk.mjs')).default;
  const client = new sdk({ apiKey, dangerouslyAllowBrowser: true });
  const context = `Current circuit (JSON):\n${JSON.stringify(ctx).slice(0, 60000)}`;
  const stream = client.beta.messages.stream({
    model, max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',   // if a request is declined, the API retries on a fallback model
    system: SYSTEM,
    messages: [...history, { role: 'user', content: `${context}\n\nStudent question: ${question}` }],
  });
  let text = '';
  for await (const ev of stream) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { text += ev.delta.text; onText(text); }
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') { text += '\n\n(I can\'t help with that request.)'; onText(text); }
  return text;
}
