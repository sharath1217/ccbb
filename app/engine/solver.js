// Circuit solver: modified nodal analysis + Newton-Raphson, with transient capacitors.
// Node 0 is ground. Elements:
//   {type:'R', a, b, r}                       resistor
//   {type:'S', a, b, v, r}                    voltage source v (a = +) with series resistance r
//   {type:'I', a, b, i}                       current source: i amps into node a, out of node b
//   {type:'C', a, b, c, v0}                   capacitor (open in DC; backward-Euler companion when dt given)
//   {type:'D', a, c, is, n}                   diode / LED (Shockley)
//   {type:'Q', c, b, e, pol, is, bf, br}      bipolar transistor, pol = +1 NPN, -1 PNP (Ebers–Moll transport model)
//   {type:'M', d, g, s, pol, vth, k, lambda}  MOSFET, pol = +1 N, -1 P (square law, smoothed)
//   {type:'OA', p, n, o, vp, vn, a, ro, hi, lo}  op-amp: output saturates hi volts below V+ rail, lo above V- rail
export const VT = 0.02585;
const GMIN = 1e-12, XMAX = 40;
const dexp = x => x > XMAX ? Math.exp(XMAX) * (1 + x - XMAX) : Math.exp(x);

export function diodeCurrent(e, vd) { return e.is * (dexp(vd / (e.n * VT)) - 1); }

// Currents flowing INTO each terminal for nonlinear devices, given terminal voltages.
const DEVICES = {
  D: { t: ['a', 'c'], f(e, [va, vc]) { const i = diodeCurrent(e, va - vc); return [i, -i]; } },
  Q: { t: ['c', 'b', 'e'], f(e, [vc, vb, ve]) {
    const p = e.pol, vbe = p * (vb - ve), vbc = p * (vb - vc);
    const xe = dexp(vbe / VT) - 1, xc = dexp(vbc / VT) - 1;
    const ic = e.is * (xe - xc) - e.is / e.br * xc, ib = e.is / e.bf * xe + e.is / e.br * xc;
    return [p * ic, p * ib, -p * (ic + ib)]; } },
  M: { t: ['d', 'g', 's'], f(e, [vd, vg, vs]) {
    const p = e.pol; let d = p * vd, s = p * vs; const g = p * vg; let sw = 1;
    if (d < s) { [d, s] = [s, d]; sw = -1; }
    const vgs = g - s, vds = d - s, w = 0.03;
    const vov = w * Math.log1p(Math.exp(Math.min((vgs - e.vth) / w, 50))) + (vgs - e.vth > 50 * w ? (vgs - e.vth) - w * Math.log1p(Math.exp(50)) + 0 : 0);
    const id = vds < vov ? e.k * (vov * vds - vds * vds / 2) * (1 + e.lambda * vds) : e.k / 2 * vov * vov * (1 + e.lambda * vds);
    const i = p * sw * id; return [i, 0, -i]; } },
};

function gauss(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k, m = Math.abs(A[k][k]);
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > m) { m = Math.abs(A[i][k]); p = i; }
    if (m < 1e-30) continue;
    if (p !== k) { [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]]; }
    for (let i = k + 1; i < n; i++) { const f = A[i][k] / A[k][k]; if (!f) continue; for (let j = k; j < n; j++) A[i][j] -= f * A[k][j]; b[i] -= f * b[k]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = Math.abs(A[i][i]) < 1e-30 ? 0 : s / A[i][i]; }
  return x;
}

export function solve(nodeCount, elements, { maxIter = 300, tol = 1e-7, dt = 0, V0 } = {}) {
  const N = nodeCount - 1;
  let V = V0 && V0.length === nodeCount ? V0.slice() : new Array(nodeCount).fill(0);
  const nonlinear = elements.filter(e => DEVICES[e.type] || e.type === 'OA');
  for (const e of elements) if (e.type === 'OA' && !e._mode) e._mode = 'lin';
  let converged = !nonlinear.length, iter;
  for (iter = 0; iter < maxIter; iter++) {
    const A = Array.from({ length: N }, () => new Array(N).fill(0)), b = new Array(N).fill(0);
    const G = (a, c, g) => { if (a > 0) A[a - 1][a - 1] += g; if (c > 0) A[c - 1][c - 1] += g; if (a > 0 && c > 0) { A[a - 1][c - 1] -= g; A[c - 1][a - 1] -= g; } };
    const J = (a, c, i) => { if (a > 0) b[a - 1] += i; if (c > 0) b[c - 1] -= i; };
    for (let k = 0; k < N; k++) A[k][k] += GMIN;
    for (const e of elements) {
      if (e.type === 'R') G(e.a, e.b, 1 / Math.max(e.r, 1e-6));
      else if (e.type === 'S') { const g = 1 / Math.max(e.r, 1e-6); G(e.a, e.b, g); J(e.a, e.b, e.v * g); }
      else if (e.type === 'I') J(e.a, e.b, e.i);
      else if (e.type === 'C') { if (dt > 0) { const g = e.c / dt; G(e.a, e.b, g); J(e.a, e.b, g * (e.v0 || 0)); } }
      else if (e.type === 'OA') {
        // Linear gain A until the output would pass a rail, then clamp at that rail (mode switching).
        const rp = V[e.vp], rn = V[e.vn], g = 1 / e.ro, powered = iter === 0 || rp - rn > 1;
        const hi = rp - e.hi, lo = rn + e.lo, mid = (hi + lo) / 2;
        if (e.o > 0) A[e.o - 1][e.o - 1] += g;
        if (!powered) { if (e.o > 0) b[e.o - 1] += g * rn; }
        else if (e._mode === 'lin') { if (e.o > 0) { if (e.p > 0) A[e.o - 1][e.p - 1] -= g * e.a; if (e.n > 0) A[e.o - 1][e.n - 1] += g * e.a; b[e.o - 1] += g * mid; } }
        else if (e.o > 0) b[e.o - 1] += g * (e._mode === 'hi' ? hi : lo);
      }
      else if (DEVICES[e.type]) {
        const d = DEVICES[e.type], nodes = d.t.map(t => e[t]), v = nodes.map(n => V[n]);
        const I0 = d.f(e, v), h = 1e-6;
        for (let j = 0; j < nodes.length; j++) {           // numerical Jacobian dI_k/dV_j
          const vj = v.slice(); vj[j] += h; const I1 = d.f(e, vj);
          for (let k = 0; k < nodes.length; k++) { const g = (I1[k] - I0[k]) / h; if (nodes[k] > 0 && nodes[j] > 0) A[nodes[k] - 1][nodes[j] - 1] += g; if (nodes[k] > 0) b[nodes[k] - 1] += g * v[j]; }
        }
        for (let k = 0; k < nodes.length; k++) if (nodes[k] > 0) b[nodes[k] - 1] -= I0[k];
      }
    }
    const Vn = [0, ...gauss(A, b)];
    let dmax = 0; for (let k = 1; k < nodeCount; k++) dmax = Math.max(dmax, Math.abs(Vn[k] - V[k]));
    let modeChanged = false;   // op-amp: linear until the output passes a rail; leave saturation when the input sign reverses
    if (iter > 0) for (const e of elements) if (e.type === 'OA') {
      const hi = Vn[e.vp] - e.hi, lo = Vn[e.vn] + e.lo, vd = Vn[e.p] - Vn[e.n];
      let m = e._mode;
      if (m === 'lin') m = Vn[e.o] > hi + 1e-6 ? 'hi' : Vn[e.o] < lo - 1e-6 ? 'lo' : 'lin';
      else if (m === 'hi' && vd < 0) m = 'lin';
      else if (m === 'lo' && vd > 0) m = 'lin';
      if (m !== e._mode) { e._mode = m; modeChanged = true; }
    }
    const hasDev = elements.some(e => DEVICES[e.type]);
    if (hasDev && dmax > 1) { const s = 1 / dmax; for (let k = 1; k < nodeCount; k++) Vn[k] = V[k] + (Vn[k] - V[k]) * s; }
    V = Vn;
    if (!nonlinear.length) { converged = true; break; }
    if (dmax < tol && !modeChanged && iter > 0) { converged = true; break; }
  }
  const at = n => V[n] ?? 0;
  const current = e => {
    if (e.type === 'R') return (at(e.a) - at(e.b)) / Math.max(e.r, 1e-6);
    if (e.type === 'S') return (e.v - (at(e.a) - at(e.b))) / Math.max(e.r, 1e-6);
    if (e.type === 'I') return e.i;
    if (e.type === 'C') return dt > 0 ? e.c / dt * ((at(e.a) - at(e.b)) - (e.v0 || 0)) : 0;
    if (e.type === 'OA') return (at(e.o) - (e._mode === 'hi' ? at(e.vp) - e.hi : e._mode === 'lo' ? at(e.vn) + e.lo : (at(e.vp) - e.hi + at(e.vn) + e.lo) / 2 + e.a * (at(e.p) - at(e.n)))) / e.ro * -1;
    if (DEVICES[e.type]) { const I = DEVICES[e.type].f(e, DEVICES[e.type].t.map(t => at(e[t]))); return I[0]; }
    return 0;
  };
  return { V, converged, iterations: iter + 1, currents: elements.map(current) };
}

export function ledParams(color) {
  const vf = { red: 2.0, orange: 2.05, yellow: 2.1, green: 2.2, blue: 3.1, white: 3.1, purple: 3.2 }[color] ?? 2.0;
  const n = 2; return { vf, n, is: 0.02 / Math.exp(vf / (n * VT)) };
}
export const SILICON = { n: 1.9, is: 7e-9 };      // 1N4007-like: ~0.7 V at 10 mA
export const SCHOTTKY = { n: 1.1, is: 3e-6 };     // 1N5819-like: ~0.3 V
