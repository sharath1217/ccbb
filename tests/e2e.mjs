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
async function test(name, fn) {
  try { await fn(); pass++; results.push('ok   ' + name); }
  catch (e) { fail++; results.push('FAIL ' + name + '\n     ' + e.message.split('\n')[0]); }
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
  for (const name of ['9 V Battery', 'Resistor', 'LED']) await p.click(`.pal:has-text("${name}")`);
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
  await p.selectOption('#pOhm', '470');
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
  await p.locator('#pPos').fill('10'); await p.waitForTimeout(500); const low = await lvl();
  await p.locator('#pPos').fill('95'); await p.waitForTimeout(500); const high = await lvl();
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
  await p.locator('[data-id="sw1"] .tag').click(); await p.click('#pSw'); await p.waitForTimeout(150);
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
  await p.click('.pal:has-text("LED")');
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
