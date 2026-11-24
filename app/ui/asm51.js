// 8051 Assembly Lab: assemble, run, single-step, and watch registers, flags, RAM, ports and the serial port.
import { assemble, CPU51 } from '../engine/cpu8051.js';
import { ASM_TEMPLATES } from './asm51-templates.js';

const $ = id => document.getElementById(id), hx = (v, n = 2) => v.toString(16).toUpperCase().padStart(n, '0');
const S = { asm: null, cpu: null, running: false, ext: [0xFF, 0xFF, 0xFF, 0xFF], prev: null, setup: {}, out: '' };

$('tpl').innerHTML += Object.entries(ASM_TEMPLATES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
function gutter() { const n = $('src').value.split('\n').length, cur = S.cpu && S.asm ? S.asm.listing.find(l => l.addr === S.cpu.pc)?.line : null;
  $('gut').innerHTML = Array.from({ length: n }, (_, i) => i + 1 === cur ? `<span class="cur">${i + 1}</span>` : i + 1).join('\n'); $('gut').scrollTop = $('src').scrollTop; }
$('src').addEventListener('input', () => { S.asm = null; gutter(); save(); });
$('src').addEventListener('scroll', () => { $('gut').scrollTop = $('src').scrollTop; });
$('src').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); e.target.setRangeText('        ', e.target.selectionStart, e.target.selectionEnd, 'end'); } });

function build() {
  stop(); const a = assemble($('src').value);
  $('errs').innerHTML = a.errors.map(e => `<div data-l="${e.line}">⛔ Line ${e.line}: ${e.msg}</div>`).join('');
  for (const d of $('errs').querySelectorAll('[data-l]')) d.onclick = () => goLine(+d.dataset.l);
  if (a.errors.length) { status('Fix the errors', 'bad'); S.asm = null; return false; }
  S.asm = a; S.out = ''; $('term').textContent = '';
  S.cpu = new CPU51(a.code, { readPort: p => S.ext[p], onSerial: b => { S.out += String.fromCharCode(b); $('term').textContent = S.out; } });
  for (const [k, v] of Object.entries(S.setup.iram || {})) S.cpu.iram.set(v, +k);
  for (const [k, v] of Object.entries(S.setup.xram || {})) S.cpu.xram.set(v, +k);
  S.prev = snapshot(); status(`Assembled: ${a.size} bytes`, 'ok'); render(); return true;
}
function goLine(n) { const t = $('src'), lines = t.value.split('\n'); const pos = lines.slice(0, n - 1).join('\n').length + (n > 1 ? 1 : 0); t.focus(); t.setSelectionRange(pos, pos + (lines[n - 1] || '').length); }
function status(t, cls) { $('status').textContent = t; $('status').className = 'pill' + (cls === 'bad' ? ' run' : ''); }
const snapshot = () => S.cpu && { iram: S.cpu.iram.slice(), sfr: S.cpu.sfr.slice() };

// ---------- run / step ----------
function ensure() { return S.cpu || build(); }
function stepOnce() { if (!ensure()) return; S.prev = snapshot(); try { S.cpu.step(); } catch (e) { status(e.message, 'bad'); } render(); }
let last = 0;
function run() {
  if (!ensure()) return; if (S.cpu.halted) build(); S.running = true; $('bRun').disabled = true; $('bStop').disabled = false; S.prev = snapshot(); last = performance.now(); status('Running…');
  const loop = now => {
    if (!S.running) return;
    const real = $('speed').value === 'real', budget = real ? Math.min(0.05, (now - last) / 1000) * S.cpu.xtal / 12 : 200000; last = now;
    try { const h = S.cpu.run(budget); if (h) { finish(h === 'loop' ? 'Finished (reached HERE: SJMP HERE)' : 'Stopped'); return; } }
    catch (e) { finish(e.message, 'bad'); return; }
    render(); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function finish(msg, cls) { S.running = false; $('bRun').disabled = false; $('bStop').disabled = true; status(msg, cls); render(); }
function stop() { if (S.running) finish('Stopped'); }
$('bAsm').onclick = build; $('bRun').onclick = run; $('bStep').onclick = stepOnce; $('bStop').onclick = stop; $('bReset').onclick = () => { build(); };

// ---------- views ----------
function render() {
  const c = S.cpu; if (!c) return; const p = S.prev || snapshot();
  const regs = [['A', c.A, p.sfr[0xE0]], ['B', c.sfr[0xF0], p.sfr[0xF0]], ...Array.from({ length: 8 }, (_, n) => ['R' + n, c.R(n), p.iram[c.bank * 8 + n]]),
    ['SP', c.sfr[0x81], p.sfr[0x81]], ['DPTR', c.DPTR, (p.sfr[0x83] << 8) | p.sfr[0x82], 4], ['PC', c.pc, null, 4], ['TMOD', c.sfr[0x89], p.sfr[0x89]], ['TH0', c.sfr[0x8C], p.sfr[0x8C]], ['TL0', c.sfr[0x8A], p.sfr[0x8A]],
    ['TCON', c.sfr[0x88], p.sfr[0x88]], ['SCON', c.sfr[0x98], p.sfr[0x98]], ['IE', c.sfr[0xA8], p.sfr[0xA8]], ['SBUF', c.sfr[0x99], p.sfr[0x99]]];
  $('regs').innerHTML = regs.map(([n, v, o, w]) => `<div class="${o !== null && o !== undefined && o !== v ? 'ch' : ''}"><b>${n}</b>${hx(v, w || 2)}</div>`).join('');
  const psw = c.PSW; $('flags').innerHTML = ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', '-', 'P'].map((f, i) => `<span class="${(psw >> (7 - i)) & 1 ? 'on' : ''}" title="${f}">${f}</span>`).join('');
  $('ports').innerHTML = [0, 1, 2, 3].map(pt => { const latch = c.sfr[0x80 + pt * 16], pins = latch & S.ext[pt];
    return `<div class="port"><b>P${pt}</b>${[7, 6, 5, 4, 3, 2, 1, 0].map(b => `<i data-p="${pt}" data-b="${b}" class="${(pins >> b) & 1 ? 'h' : ''}${(S.ext[pt] >> b) & 1 ? '' : ' ext'}" title="P${pt}.${b}">${b}</i>`).join('')}<span class="mut">${hx(pins)}H</span></div>`; }).join('');
  for (const i of $('ports').querySelectorAll('i')) i.onclick = () => { S.ext[+i.dataset.p] ^= 1 << +i.dataset.b; render(); };
  $('iram').innerHTML = hexGrid(c.iram, p.iram, 0, 128);
  const xa = parseInt($('xaddr').value, 16) || 0; $('xram').innerHTML = hexGrid(c.xram, null, xa, 64);
  $('clock').textContent = `${c.cycles.toLocaleString()} cycles · ${(c.time * 1000).toFixed(3)} ms`; gutter();
}
function hexGrid(mem, old, start, n) { let h = '<span class="a"></span>' + Array.from({ length: 16 }, (_, i) => `<span class="a">${hx(i, 1)}</span>`).join('');
  for (let r = start; r < start + n; r += 16) { h += `<span class="a">${hx(r, 4)}</span>`; for (let k = r; k < r + 16; k++) h += `<span class="${old && old[k] !== mem[k] ? 'ch' : mem[k] ? '' : 'z'}">${hx(mem[k])}</span>`; }
  return h; }
$('xaddr').onchange = render;

// ---------- files ----------
function load(k) { const t = ASM_TEMPLATES[k]; if (!t) return; stop(); $('src').value = t.src; S.setup = t.setup || {}; $('about').textContent = t.about;
  if (t.view?.xram) $('xaddr').value = hx(t.view.xram[0], 4); S.cpu = null; S.ext = [0xFF, 0xFF, 0xFF, 0xFF]; build(); save(); }
$('tpl').onchange = e => { load(e.target.value); e.target.value = ''; };
$('bNew').onclick = () => { $('src').value = '        ORG 0000H\n\n        ; your program here\n\nHERE:   SJMP HERE\n        END\n'; S.setup = {}; $('about').textContent = ''; S.cpu = null; build(); };
$('bSave').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('src').value], { type: 'text/plain' })); a.download = 'program.asm'; a.click(); };
$('fOpen').onchange = async e => { $('src').value = await e.target.files[0].text(); S.setup = {}; S.cpu = null; build(); };
function save() { try { localStorage.setItem('ccbb.asm', $('src').value); } catch {} }
window.asm = { S, build, run, stepOnce, load, ASM_TEMPLATES };
const q = new URLSearchParams(location.search).get('p'); let saved = null; try { saved = localStorage.getItem('ccbb.asm'); } catch {}
if (q && ASM_TEMPLATES[q]) load(q); else if (saved) { $('src').value = saved; build(); } else load('blockmove');
document.body.dataset.ready = 1;
