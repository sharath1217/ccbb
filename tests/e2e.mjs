// End-to-end tests: drive the real app in Chromium like a student would.
// Run: node tests/e2e.mjs   (set SHOTS=1 to also save screenshots)
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
const base = `http://localhost:${server.address().port}/app/index.html`;
const SHOTS = !!process.env.SHOTS;

let pass = 0, fail = 0; const results = [];
const browser = await chromium.launch();
async function page(project) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errors.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(base + (project ? '?project=' + project : ''));
  await p.waitForFunction(() => window.ccbb && window.ccbb.S.sim && window.ccbb.S.ready);
  return p;
}
const ONLY = process.env.ONLY && new RegExp(process.env.ONLY, 'i');
async function test(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now(); try { await fn(); pass++; results.push('ok   ' + name); console.log('ok   ' + name + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)'); }
  catch (e) { fail++; const m = 'FAIL ' + name + '\n     ' + e.message.split('\n')[0]; results.push(m); console.log(m); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const shot = (p, n) => SHOTS ? p.screenshot({ path: path.join(root, 'screenshots', 'app-' + n + '.png') }) : null;
const ledOn = (p, id) => p.evaluate(id => document.querySelector(`[data-id="${id}"] wokwi-led`).value, id);
const reading = (p, id) => p.evaluate(id => window.ccbb.simNow().parts[id].reading, id);
const warnings = p => p.evaluate(() => window.ccbb.simNow().warnings.map(w => w.text));

await test('app loads with no errors and draws parts, wires and pins', async () => {
  const p = await page('blink');
  assert(await p.locator('.part').count() === 4, 'expected 4 parts (Uno, breadboard, resistor, LED)');
  assert(await p.locator('path.wire').count() === 3, 'expected 3 jumper wires');
  const ins = await p.evaluate(() => window.ccbb.S.wires.filter(w => w.hidden).map(w => w.from + '>' + w.to).sort().join(' '));
  assert(ins === 'led1:A>bb1:A14 led1:C>bb1:A13 r1:1>bb1:C8 r1:2>bb1:C14', 'parts not seated in the right holes: ' + ins);
  assert(await p.locator('circle.pin').count() > 20, 'pins not drawn');
  assert(p.errors.length === 0, 'page errors: ' + p.errors.join(' | '));
  await p.close();
});

await test('Blink: Run makes the LED flash on and off, then Stop', async () => {
  const p = await page('blink');
  await p.click('#btnRun');
  const seen = new Set();
  for (let i = 0; i < 30; i++) { seen.add(await ledOn(p, 'led1')); await p.waitForTimeout(100); }
  assert(seen.has(true) && seen.has(false), 'LED did not toggle: ' + [...seen]);
  await shot(p, '1-blink');
  await p.click('#btnStop');
  await p.waitForTimeout(300);
  assert(!(await ledOn(p, 'led1')), 'LED should be off after stop');
  assert(p.errors.length === 0, p.errors.join(' | '));
  await p.close();
});

await test('Build from scratch by clicking: battery + 470 Ω + LED lights safely', async () => {
  const p = await page('blink'); await p.evaluate(() => window.ccbb.setZoom(1));
  await p.click('#btnNew');
  await p.waitForFunction(() => window.ccbb.S.parts.length === 0 && window.ccbb.S.ready);
  for (const t of ['battery', 'resistor', 'led']) await p.click(`.pal[data-type="${t}"]`);
  const ids = await p.evaluate(() => window.ccbb.S.parts.map(x => x.id));
  // drag each part by its name tag to its own spot (also tests dragging)
  const board = await p.locator('#world').boundingBox();
  const spots = [[90, 220], [300, 150], [470, 110]];
  for (let i = 0; i < 3; i++) {
    const t = await p.locator(`[data-id="${ids[i]}"] .tag`).boundingBox();
    await p.mouse.move(t.x + 5, t.y + 5); await p.mouse.down();
    await p.mouse.move(board.x + spots[i][0] + 5, board.y + spots[i][1] - 19, { steps: 6 }); await p.mouse.up();
  }
  await p.waitForTimeout(150);
  const moved = await p.evaluate(() => window.ccbb.S.parts.map(x => [x.x, x.y]));
  assert(moved.every((m, i) => Math.abs(m[0] - spots[i][0]) < 8), 'drag failed: ' + JSON.stringify(moved));
  const [b, r, l] = ids;
  const clickPin = async k => { await p.waitForTimeout(80); const c = p.locator(`circle.pin[data-k="${k}"]`); const bb = await c.boundingBox(); if (!bb) throw new Error('pin not found ' + k); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  for (const [a, z] of [[b + ':+', r + ':1'], [r + ':2', l + ':A'], [l + ':C', b + ':-']]) { await clickPin(a); await clickPin(z); }
  await p.waitForTimeout(150);
  assert(await p.locator('path.wire').count() === 3, 'wires not created by clicking: ' + await p.evaluate(() => JSON.stringify([window.ccbb.S.wires, window.ccbb.S.pending, window.ccbb.S.parts.map(q => [q.id, q.x, q.y])])));
  // 220 Ω on 9 V → ~31 mA → the LED burns: the app must say so
  await p.waitForTimeout(150);
  assert((await p.locator('.warn.bad').count()) > 0, 'expected a burn warning with 220 Ω on 9 V');
  // fix it: select resistor, pick 470 Ω, replace LED
  await p.locator(`[data-id="${r}"] .tag`).click();
  await p.selectOption('#props [data-k="ohms"]', '470');
  await p.locator(`[data-id="${l}"] .tag`).click();
  await p.click('#pFix');
  await p.waitForTimeout(150);
  assert(await ledOn(p, l), 'LED should light after fixing');
  assert((await warnings(p)).length === 0, 'unexpected warnings: ' + (await warnings(p)).join(' | '));
  await shot(p, '2-built-by-hand');
  assert(p.errors.length === 0, p.errors.join(' | '));
  await p.close();
});

await test('Mistake lab: LED straight on 9 V burns and explains why', async () => {
  const p = await page('burn'); await p.waitForTimeout(150);
  const w = (await p.locator('#warns').innerText());
  assert(/burnt/i.test(w) && /resistor/i.test(w), 'warning text missing: ' + w);
  assert(await p.locator('.part.burnt').count() === 1, 'LED not marked burnt');
  await shot(p, '3-mistake-lab');
  await p.close();
});

await test('Button project: pressing the button lights the LED', async () => {
  const p = await page('button');
  await p.click('#btnRun'); await p.waitForTimeout(400);
  assert(!(await ledOn(p, 'led1')), 'LED should start off');
  await p.evaluate(() => document.querySelector('[data-id="btn1"] wokwi-pushbutton').dispatchEvent(new Event('button-press')));
  await p.waitForTimeout(400);
  assert(await ledOn(p, 'led1'), 'LED should be on while pressed');
  assert(/pressed/.test(await p.locator('#serial').innerText()), 'serial should say pressed');
  await shot(p, '4-button');
  await p.evaluate(() => document.querySelector('[data-id="btn1"] wokwi-pushbutton').dispatchEvent(new Event('button-release')));
  await p.waitForTimeout(400);
  assert(!(await ledOn(p, 'led1')), 'LED should turn off on release');
  await p.click('#btnStop'); await p.close();
});

await test('Dimmer: turning the knob changes analogRead and LED brightness', async () => {
  const p = await page('dimmer');
  await p.click('#btnRun'); await p.waitForTimeout(400);
  const lvl = () => p.evaluate(() => window.ccbb.S.sim.parts.led1.current);
  await p.locator('[data-id="pot1"] .tag').click();
  await p.locator('#props [data-k="pos"]').fill('10'); await p.waitForTimeout(500); const low = await lvl();
  await p.locator('#props [data-k="pos"]').fill('95'); await p.waitForTimeout(500); const high = await lvl();
  assert(high > low * 3, `brightness should rise: ${low} → ${high}`);
  const lines = (await p.locator('#serial').innerText()).trim().split('\n');
  assert(/A0 = \d+/.test(lines.at(-1)), 'serial should print A0 values');
  await shot(p, '5-dimmer');
  await p.click('#btnStop'); await p.close();
});

await test('Multimeter: divider reads ~6 V, Ω mode warns when powered, A mode reads current', async () => {
  const p = await page('divider'); await p.waitForTimeout(150);
  const v = await reading(p, 'm1'); assert(/^5\.99\d V$|^6\.00\d V$/.test(v), 'divider reading ' + v);
  await shot(p, '6-multimeter');
  await p.evaluate(() => { const m = window.ccbb.S.parts.find(x => x.id === 'm1'); m.props.mode = 'Ω'; });
  assert(/powered circuit/.test((await warnings(p)).join()), 'Ω-on-powered warning missing');
  await p.close();
});

await test('Switch: battery LED turns off when the switch is flipped', async () => {
  const p = await page('battery'); await p.waitForTimeout(150);
  assert(await ledOn(p, 'led1'), 'LED should start on');
  await p.locator('[data-id="sw1"] .tag').click(); await p.click('#props [data-t="on"]'); await p.waitForTimeout(150);
  assert(!(await ledOn(p, 'led1')), 'LED should go off');
  await p.close();
});

await test('Code errors are shown in plain words', async () => {
  const p = await page('blink');
  await p.fill('#src', 'void setup( {\n'); await p.click('#btnRun');
  await p.waitForTimeout(100);
  assert(await p.locator('#err').isVisible(), 'error box not shown');
  assert(/Code error/.test(await p.locator('#err').innerText()), 'wrong error text');
  await p.close();
});

await test('"Code from my circuit" writes runnable code for the wiring', async () => {
  const p = await page('button');
  await p.fill('#src', ''); await p.click('#btnAuto');
  const code = await p.inputValue('#src');
  assert(/pinMode\(13, OUTPUT\)/.test(code) && /pinMode\(2, INPUT_PULLUP\)/.test(code), 'generated code:\n' + code);
  await p.click('#btnRun'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-id="btn1"] wokwi-pushbutton').dispatchEvent(new Event('button-press')));
  await p.waitForTimeout(300);
  assert(await ledOn(p, 'led1'), 'generated code did not work');
  await p.click('#btnStop'); await p.close();
});

await test('Delete key removes a selected part and its wires; work is autosaved', async () => {
  const p = await page('blink');
  await p.locator('[data-id="led1"] .tag').click(); await p.keyboard.press('Delete');
  assert(await p.locator('.part').count() === 3 && !(await p.evaluate(() => window.ccbb.S.wires.some(w => w.from.startsWith('led1') || w.to.startsWith('led1')))), 'delete failed');
  await p.goto(base); await p.waitForFunction(() => window.ccbb && window.ccbb.S.sim && window.ccbb.S.ready);
  assert(await p.locator('.part').count() === 3, 'autosave/restore failed');
  await p.close();
});

await test('Dropping an LED onto the breadboard snaps it into holes and connects it', async () => {
  const p = await page('blink'); await p.evaluate(() => window.ccbb.setZoom(1));
  await p.click('.pal[data-type="led"]');
  const id = await p.evaluate(() => window.ccbb.S.parts.at(-1).id);
  const hole = await p.evaluate(() => window.ccbb.pinPos('bb1:H20'));
  const world = await p.locator('#world').boundingBox(), tag = await p.locator(`[data-id="${id}"] .tag`).boundingBox();
  const pin = await p.evaluate(id => window.ccbb.pinPos(id + ':C'), id);
  const grabX = tag.x + 5, grabY = tag.y + 5;
  await p.mouse.move(grabX, grabY); await p.mouse.down();
  await p.mouse.move(grabX + (world.x + hole[0]) - (world.x + pin[0]) + 3, grabY + (world.y + hole[1]) - (world.y + pin[1]) - 2, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(150);
  const ins = await p.evaluate(id => window.ccbb.S.wires.filter(w => w.hidden && w.from.startsWith(id)).map(w => w.from.split(':')[1] + '>' + w.to.split(':')[1]).sort().join(' '), id);
  assert(ins === 'A>H21 C>H20', 'LED did not snap into H20/H21: ' + ins);
  const after = await p.evaluate(id => window.ccbb.pinPos(id + ':C'), id);
  assert(Math.hypot(after[0] - hole[0], after[1] - hole[1]) < 0.6, 'LED leg not centred on hole');
  await p.close();
});

await test('Moving the breadboard carries its parts with it', async () => {
  const p = await page('blink'); await p.evaluate(() => window.ccbb.setZoom(1));
  const before = await p.evaluate(() => window.ccbb.S.parts.find(q => q.id === 'led1').x);
  const t = await p.locator('[data-id="bb1"] .tag').boundingBox();
  await p.mouse.move(t.x + 5, t.y + 5); await p.mouse.down(); await p.mouse.move(t.x + 101, t.y + 53, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(150);
  const after = await p.evaluate(() => window.ccbb.S.parts.find(q => q.id === 'led1').x);
  assert(Math.abs(after - before - 96) < 6, `LED should move with board: ${before} → ${after}`);
  assert(await p.evaluate(() => window.ccbb.S.wires.filter(w => w.hidden && w.from.startsWith('led1')).length) === 2, 'LED should stay seated');
  await p.close();
});

await test('All jumper wires are neat: only straight lines and right-angle bends', async () => {
  const p = await page('dimmer'); await p.waitForTimeout(300);
  const ds = await p.evaluate(() => [...document.querySelectorAll('path.wire')].map(x => x.getAttribute('d')));
  assert(ds.length >= 6, 'expected wires');
  assert(ds.every(d => !/C/.test(d)), 'curvy wire found: ' + ds.find(d => /C/.test(d)));
  await p.close();
});

await test('Every one of the parts in the palette can be placed without errors', async () => {
  const p = await page('blink'); await p.click('#btnNew'); await p.waitForFunction(() => window.ccbb.S.parts.length === 0 && window.ccbb.S.ready);
  const types = await p.evaluate(() => [...document.querySelectorAll('.pal')].map(b => b.dataset.type));
  assert(types.length >= 55, 'palette has only ' + types.length);
  for (const t of types) { await p.evaluate(t => { const S = window.ccbb.S; if (S.parts.length >= 8) { window.ccbb.load({ parts: [], wires: [], code: '' }); } }, t); await p.waitForTimeout(20); await p.click(`.pal[data-type="${t}"]`); }
  await p.waitForTimeout(300);
  assert(p.errors.length === 0, 'errors: ' + p.errors.slice(0, 3).join(' | '));
  await p.close();
});

await test('555 timer project blinks the LED on its own (no code)', async () => {
  const p = await page('timer555'); const seen = new Set();
  for (let i = 0; i < 40; i++) { seen.add(await ledOn(p, 'led1')); await p.waitForTimeout(100); }
  assert(seen.has(true) && seen.has(false), 'LED did not blink: ' + [...seen]);
  await shot(p, '7-555-timer'); assert(p.errors.length === 0, p.errors.join(' | ')); await p.close();
});

await test('Op-amp project: multimeter reads 3 × the knob voltage', async () => {
  const p = await page('opamp'); await p.waitForTimeout(200);
  const vin = await p.evaluate(() => window.ccbb.simNow().voltAt('pot1', 'SIG'));
  const out = parseFloat(await reading(p, 'm1'));
  assert(Math.abs(out - 3 * vin) < 0.02, `Vout ${out} vs 3×${vin.toFixed(3)}`);
  await shot(p, '8-opamp'); await p.close();
});

await test('Logic gate project: AND output follows the switches', async () => {
  const p = await page('gate'); await p.waitForTimeout(200);
  assert(!(await ledOn(p, 'led1')), 'A=1,B=0 should be off');
  await p.locator('[data-id="swB"] .tag').click(); await p.click('#props [data-t="on"]'); await p.waitForTimeout(200);
  assert(await ledOn(p, 'led1'), 'A=1,B=1 should be on');
  await shot(p, '9-logic-gate'); await p.close();
});

await test('MOSFET project: PWM code makes the motor speed up', async () => {
  const p = await page('mosfet'); await p.click('#btnRun');
  const rpm = []; for (let i = 0; i < 12; i++) { rpm.push(await p.evaluate(() => window.ccbb.S.sim.parts.mot1.rpm || 0)); await p.waitForTimeout(300); }
  const ab = rpm.map(Math.abs); assert(Math.max(...ab) > 2000 && ab[0] < Math.max(...ab), 'rpm ' + rpm.join(','));
  const bad = (await warnings(p)).filter(w => /damage|destroy/.test(w)); assert(!bad.length, bad.join());
  await shot(p, '10-mosfet-motor'); await p.click('#btnStop'); await p.close();
});

await test('DHT22 + LCD project shows the temperature; the lighter heats it up', async () => {
  const p = await page('weather'); await p.click('#btnRun'); await p.waitForTimeout(700);
  let text = await p.evaluate(() => document.querySelector('[data-id="lcd1"] wokwi-lcd1602').text);
  assert(/Temp: 27\.0 C/.test(text), 'LCD text: ' + text);
  await p.evaluate(() => { window.ccbb.S.parts.find(x => x.id === 'dht1').props.lighter = 5; });
  await p.waitForTimeout(2600);
  text = await p.evaluate(() => document.querySelector('[data-id="lcd1"] wokwi-lcd1602').text);
  assert(/Temp: 57\.0 C/.test(text), 'after lighter: ' + text);
  await shot(p, '11-dht-lcd'); await p.click('#btnStop'); await p.close();
});

await test('Ultrasonic project: distance moves the servo', async () => {
  const p = await page('radar'); await p.click('#btnRun'); await p.waitForTimeout(600);
  const a1 = await p.evaluate(() => window.ccbb.S.parts.find(x => x.id === 'sv1').state.angle);
  await p.evaluate(() => { window.ccbb.S.parts.find(x => x.id === 'us1').props.dist = 150; }); await p.waitForTimeout(600);
  const a2 = await p.evaluate(() => window.ccbb.S.parts.find(x => x.id === 'sv1').state.angle);
  assert(Math.abs(a1 - 45) <= 1 && Math.abs(a2 - 135) <= 1, `servo angles ${a1} → ${a2}`);
  assert(/1(49|50) cm/.test(await p.locator('#serial').innerText()), 'serial distance');
  await shot(p, '12-ultrasonic-servo'); await p.click('#btnStop'); await p.close();
});

await test('ESP32 project: code runs on the ESP32 and blinks its LED at 3.3 V', async () => {
  const p = await page('esp32'); await p.click('#btnRun'); const seen = new Set();
  for (let i = 0; i < 15; i++) { seen.add(await ledOn(p, 'led1')); await p.waitForTimeout(100); }
  assert(seen.has(true) && seen.has(false), 'no blink');
  assert(/ESP32/.test(await p.locator('#boardSel').innerText()), 'board label');
  const v = await p.evaluate(() => { const s = window.ccbb.S; return s.sim.voltAt('esp1', '3V3'); }); assert(Math.abs(v - 3.3) < 0.05);
  await shot(p, '13-esp32'); await p.click('#btnStop'); await p.close();
});

await test('Every microcontroller runs Blink on its built-in LED pin', async () => {
  const p = await page('blink');
  for (const t of ['uno', 'nano', 'mega', 'esp32', 'esp8266', 'pico', 'rp2040', 'bluepill', 'leonardo', 'promini', 'esp32c3', 'esp32s3', 'picow', 'atmega328', 'attiny85']) {
    const ext = { atmega328: ['7', '8'], attiny85: ['8', '4'] }[t];
    await p.evaluate(([t, ext]) => window.ccbb.load({ parts: [{ id: 'm1', type: t, x: 60, y: 80, props: {} }, ...(ext ? [{ id: 'b1', type: 'battery', x: 400, y: 80, props: { volts: 5, rint: 0.1 } }] : [])],
      wires: ext ? [{ from: 'b1:+', to: 'm1:' + ext[0] }, { from: 'b1:-', to: 'm1:' + ext[1] }] : [], code: 'void setup(){ pinMode(LED_BUILTIN, OUTPUT); }\nvoid loop(){ digitalWrite(LED_BUILTIN, HIGH); delay(150); digitalWrite(LED_BUILTIN, LOW); delay(150); }' }), [t, ext]);
    await p.waitForFunction(() => window.ccbb.S.ready); await p.click('#btnRun');
    const vals = new Set(); for (let i = 0; i < 8; i++) { vals.add(await p.evaluate(() => { const s = window.ccbb.S, m = s.parts[0]; const pin = Object.keys(s.io.pins)[0]; return pin ? s.io.pins[pin].v : -1; })); await p.waitForTimeout(60); }
    assert(vals.size >= 2, t + ' LED pin did not toggle: ' + [...vals]);
    await p.click('#btnStop');
  }
  assert(p.errors.length === 0, p.errors.join(' | ')); await p.close();
});

await test('Rotate: R key turns a part 90° and its pins move with it', async () => {
  const p = await page('blink'); await p.evaluate(() => window.ccbb.setZoom(1));
  await p.click('.pal[data-type="pushbutton"]'); const id = await p.evaluate(() => window.ccbb.S.parts.at(-1).id);
  const before = await p.evaluate(id => [window.ccbb.pinPos(id + ':1.l'), window.ccbb.pinPos(id + ':1.r')], id);
  await p.keyboard.press('r'); await p.waitForTimeout(150);
  const after = await p.evaluate(id => [window.ccbb.pinPos(id + ':1.l'), window.ccbb.pinPos(id + ':1.r')], id);
  assert(Math.abs(before[0][1] - before[1][1]) < 1 && Math.abs(after[0][0] - after[1][0]) < 1, 'pins did not rotate: ' + JSON.stringify([before, after]));
  assert(await p.evaluate(id => window.ccbb.S.parts.find(x => x.id === id).rot, id) === 90);
  await p.close();
});

await test('Oscilloscope shows Blink as a 0.5 Hz square wave and PWM duty cycle', async () => {
  const p = await page('blink');
  await p.evaluate(() => { const S = window.ccbb.S; S.parts.push({ id: 'sc1', type: 'scope', x: 760, y: 360, props: { tdiv: 0.5, vdiv: 2 } }); window.ccbb.load({ parts: S.parts, wires: [...S.wires, { from: 'sc1:CH1', to: 'uno1:13' }, { from: 'sc1:GND', to: 'uno1:GND.2' }], code: document.getElementById('src').value }); });
  await p.waitForFunction(() => window.ccbb.S.ready); await p.click('#btnRun'); await p.waitForTimeout(4600);
  const txt = await p.evaluate(() => document.querySelector('[data-id="sc1"] cb-scope').textContent);
  const f = parseFloat((txt.match(/f ([\d.]+) Hz/) || [])[1]);
  assert(Math.abs(f - 0.5) < 0.08 && /max 4\.[5-9]\dV/.test(txt), 'scope readout: ' + txt);
  await shot(p, '14-oscilloscope'); await p.click('#btnStop');
  // pin 13 has no PWM on an Uno (analogWrite there is just on/off), so probe PWM pin 9
  await p.evaluate(() => { const S = window.ccbb.S; S.parts.find(x => x.id === 'sc1').props.tdiv = 0.002;
    window.ccbb.load({ parts: S.parts, wires: [...S.wires.filter(w => !w.from.startsWith('sc1:CH1')), { from: 'sc1:CH1', to: 'uno1:9' }], code: 'void setup(){ pinMode(9, OUTPUT); analogWrite(9, 64); }\nvoid loop(){}' }); });
  await p.waitForFunction(() => window.ccbb.S.ready);
  await p.click('#btnRun'); await p.waitForTimeout(400);
  const t2 = await p.evaluate(() => document.querySelector('[data-id="sc1"] cb-scope').textContent);
  assert(/duty 25%/.test(t2) && /490 Hz/.test(t2), 'PWM readout: ' + t2);
  await p.click('#btnStop'); await p.close();
});

await test('Info window opens for every part with all 7 tabs', async () => {
  const p = await page('blink');
  const types = await p.evaluate(() => [...document.querySelectorAll('.pal')].map(b => b.dataset.type));
  for (const t of types) { await p.evaluate(t => window.ccbb.showInfo(t), t);
    const n = await p.locator('#modal .mtab').count(); assert(n === 7, t + ' tabs ' + n);
    await p.click('#modal .mtab[data-tab="pins"]'); assert(await p.locator('#mBody td').count() >= 2, t + ' pins'); }
  await p.evaluate(() => window.ccbb.showInfo('ne555')); await p.click('#modal .mtab[data-tab="how"]');
  await shot(p, '15-info'); await p.keyboard.press('Escape'); assert(await p.locator('#modal').isHidden());
  await p.close();
});

await test('Parts & cost lists the circuit with prices and totals', async () => {
  const p = await page('timer555'); await p.click('#btnBom');
  const txt = await p.locator('#modal').innerText();
  assert(/NE555/.test(txt) && /47\.00 kΩ|47 kΩ/.test(txt) && /Estimated total/.test(txt), txt);
  const b = await p.evaluate(() => window.ccbb.billOfMaterials());
  assert(b.parts.find(r => /Resistor/.test(r.name) && r.variant === '470 Ω').qty === 1 && b.min > 100 && b.max > b.min, JSON.stringify(b));
  await shot(p, '16-parts-cost'); await p.close();
});

await test('Undo and redo restore deleted parts', async () => {
  const p = await page('blink'); await p.waitForTimeout(300);
  await p.locator('[data-id="led1"] .tag').click({ force: true }); await p.keyboard.press('Delete'); await p.waitForTimeout(300);
  assert(await p.locator('.part').count() === 3, 'delete');
  await p.keyboard.press('Control+z'); await p.waitForFunction(() => window.ccbb.S.ready); await p.waitForTimeout(500);
  assert(await p.locator('.part').count() === 4, 'undo'); 
  await p.keyboard.press('Control+y'); await p.waitForFunction(() => window.ccbb.S.ready); await p.waitForTimeout(500);
  assert(await p.locator('.part').count() === 3, 'redo'); await p.close();
});

await test('Home page: every lesson link opens its project without errors', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base.replace('app/index.html', 'index.html')); if (SHOTS) await p.screenshot({ path: path.join(root, 'screenshots', 'home.png'), fullPage: true });
  const links = await p.locator('a.lesson').evaluateAll(as => as.map(a => a.href));
  assert(links.length === 26, 'lessons ' + links.length);
  for (const l of links.filter(x => x.includes('project='))) { await p.goto(l); await p.waitForFunction(() => window.ccbb && window.ccbb.S.ready, null, { timeout: 15000 });
    assert(await p.locator('.part').count() > 1, 'empty project ' + l); }
  const man = JSON.parse(fs.readFileSync(path.join(root, 'app/manifest.webmanifest'), 'utf8')); assert(man.name && man.icons.length && man.start_url, 'manifest');
  assert(errs.length === 0, errs.join(' | ')); await ctx.close();
});

const dragTo = async (p, id, tx, ty) => { await p.evaluate(() => window.ccbb.setZoom(1)); const t = await p.locator(`[data-id="${id}"] .tag`).boundingBox(); const w = await p.locator('#world').boundingBox();
  const cur = await p.evaluate(id => { const q = window.ccbb.S.parts.find(x => x.id === id); return [q.x, q.y]; }, id);
  await p.mouse.move(t.x + 5, t.y + 5); await p.mouse.down(); await p.mouse.move(t.x + 5 + (tx - cur[0]), t.y + 5 + (ty - cur[1]), { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300); };
const partXY = (p, id) => p.evaluate(id => { const q = window.ccbb.S.parts.find(x => x.id === id); return [q.x, q.y]; }, id);

await test('Game: bringing the lit lighter to the flame sensor sounds the fire alarm', async () => {
  const p = await page('fire'); await p.click('#btnRun'); await p.waitForTimeout(500);
  assert(/safe/.test(await p.locator('#serial').innerText()) && !(await p.evaluate(() => document.querySelector('[data-id="bz1"] wokwi-buzzer').hasSignal)), 'should start safe');
  await p.locator('[data-id="lt1"] .tag').click(); await p.selectOption('#props [data-k="mode"]', 'lit'); await p.waitForTimeout(700);
  assert(/FIRE/.test(await p.locator('#serial').innerText()) && await p.evaluate(() => document.querySelector('[data-id="bz1"] wokwi-buzzer').hasSignal), 'alarm did not go off');
  await shot(p, '17-fire-game'); await p.click('#btnStop'); await p.close();
});

await test('Game: spraying gas near the MQ-2 lights the warning LED; the fan clears it', async () => {
  const p = await page('gasleak'); await p.click('#btnRun'); await p.waitForTimeout(500);
  assert(!(await ledOn(p, 'led1')), 'no leak at start');
  await p.locator('[data-id="gc1"] .tag').click(); await p.click('#props [data-t="on"]');
  const [gx, gy] = await partXY(p, 'mq1'); await dragTo(p, 'gc1', gx + 150, gy); await p.waitForTimeout(800);
  assert(await ledOn(p, 'led1'), 'leak not detected: ' + (await p.locator('#serial').innerText()).split('\n').slice(-2).join(' '));
  await shot(p, '18-gas-game');
  await p.locator('[data-id="fan1"] .tag').click(); await p.click('#props [data-t="on"]'); await dragTo(p, 'fan1', gx + 20, gy + 110); await p.waitForTimeout(900);
  assert(!(await ledOn(p, 'led1')), 'fan did not clear the gas: ' + (await p.locator('#serial').innerText()).split('\n').slice(-2).join(' '));
  await p.click('#btnStop'); await p.close();
});

await test('8051 Keil C and PIC XC8 projects blink their LEDs', async () => {
  for (const proj of ['c51', 'pic']) {
    const p = await page(proj); await p.click('#btnRun'); const seen = new Set();
    for (let i = 0; i < 25; i++) { seen.add(await ledOn(p, 'led1')); await p.waitForTimeout(100); }
    assert(seen.has(true) && seen.has(false), proj + ' LED did not blink; errors: ' + (await p.locator('#err').innerText()) + p.errors.join('|'));
    await shot(p, proj === 'c51' ? '19-8051' : '20-pic'); await p.click('#btnStop'); await p.close();
  }
});

await test('Lab assistant (offline) explains a burnt LED and how to wire a part', async () => {
  const p = await page('burn'); await p.click('#btnAsk'); await p.fill('#aIn', 'why is my circuit not working?'); await p.click('#aForm button');
  const a1 = await p.locator('.amsg.bot').last().innerText(); assert(/burnt/i.test(a1) && /resistor/i.test(a1), a1);
  await p.fill('#aIn', 'how do I connect the DHT22?'); await p.click('#aForm button');
  const a2 = await p.locator('.amsg.bot').last().innerText(); assert(/SDA/.test(a2) && /pin 2/.test(a2), a2);
  await p.fill('#aIn', 'how do I test the gas sensor?'); await p.click('#aForm button');
  const a3 = await p.locator('.amsg.bot').last().innerText(); assert(/gas can/i.test(a3) && /fan/i.test(a3), a3);
  await shot(p, '21-assistant'); await p.close();
});

await test('Circuit Lab: every experiment runs and shows results without errors', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: SHOTS ? 2 : 1 }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base.replace('index.html', 'lab.html')); await p.waitForSelector('body[data-ready]');
  const keys = await p.evaluate(() => Object.keys(window.lab.LAB_TEMPLATES)); assert(keys.length >= 13, 'templates ' + keys.length);
  for (const k of keys) { await p.goto(base.replace('index.html', 'lab.html') + '?t=' + k); await p.waitForSelector('body[data-ready]'); await p.waitForTimeout(150);
    assert(!(await p.locator('#results').isHidden()), k + ': no results'); assert((await p.locator('#meas').innerText()).length > 10, k + ': empty measurements');
    if (SHOTS && ['rclow', 'inverting', 'halfwave', 'zener', 'ceamp', 'divider'].includes(k)) await p.screenshot({ path: path.join(root, 'screenshots', 'lab-' + k + '.png') }); }
  const rc = await p.goto(base.replace('index.html', 'lab.html') + '?t=rclow').then(() => p.waitForTimeout(300)).then(() => p.locator('#meas').innerText());
  assert(/−3 dB \(high\)\s*1(5[5-9]|6[0-3])(\.\d)? Hz/.test(rc), 'RC cut-off readout: ' + rc.slice(0, 200));
  assert(errs.length === 0, errs.join(' | ')); await ctx.close();
});

await test('Circuit Lab: a student draws a voltage divider with the mouse and gets 6 V', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } }); const p = await ctx.newPage(); p.on('dialog', d => d.accept());
  await p.goto(base.replace('index.html', 'lab.html')); await p.waitForSelector('body[data-ready]'); await p.click('#bNew');
  const sb = await p.locator('#sheet').boundingBox(), at = (x, y) => p.mouse.click(sb.x + x, sb.y + y);
  const place = async (t, x, y, rot) => { await p.click(`.symb[data-t="${t}"]`); await p.mouse.move(sb.x + x, sb.y + y); if (rot) await p.keyboard.press('r'); await at(x, y); };
  await place('vdc', 100, 100); await place('res', 160, 100); await place('res', 280, 100, true); await place('gnd', 100, 200); await place('gnd', 280, 200); await place('probe', 280, 60);
  await p.evaluate(() => { window.lab.L.sch.comps.find(c => c.id === 'V1').props.V = '9'; window.lab.L.sch.comps.find(c => c.id === 'R2').props.R = '20k'; window.lab.L.sch.comps.find(c => c.id === 'R1').props.R = '10k'; });
  const wire = async (a, b) => { await p.keyboard.press('w'); await at(...a); await at(...b); await p.keyboard.press('Escape'); };
  await wire([100, 100], [160, 100]); await wire([220, 100], [280, 100]); await wire([280, 160], [280, 200]); await wire([100, 160], [100, 200]); await wire([280, 60], [280, 100]);
  await p.selectOption('#kind', 'op'); await p.click('#bRun'); await p.waitForTimeout(200);
  const t = await p.locator('#meas').innerText(); assert(/Vout\s*6 V/.test(t), 'divider result: ' + t.slice(0, 200));
  await ctx.close();
});

await test('Code panel minimizes and restores', async () => {
  const p = await page('blink');
  await p.click('#btnMin'); await p.waitForTimeout(250);
  const w = await p.locator('#code').evaluate(e => e.getBoundingClientRect().width);
  assert(w < 80, 'panel not minimized: ' + w);
  await p.click('#btnMin'); await p.close();
});

await browser.close(); server.close();
console.log(results.join('\n'));
console.log(`\n# e2e pass ${pass}\n# e2e fail ${fail}`);
process.exit(fail ? 1 : 0);
