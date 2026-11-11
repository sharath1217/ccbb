// DC circuit solver: Modified nodal analysis with Newton-Raphson for diodes/LEDs.
// Node 0 is ground. Elements:
//   {type:'R', a, b, r}               resistor
//   {type:'S', a, b, v, r}            voltage source v (a = +) with series resistance r (Norton form)
//   {type:'I', a, b, i}               current source pushing i amps into node a, out of node b
//   {type:'D', a, c, is, n}           diode / LED (anode a, cathode c), Shockley model
export const VT = 0.02585;
const GMIN = 1e-12;
const XMAX = 40; // exponent limit; beyond this the diode curve is linearised (keeps Newton stable)

function dexp(x) { return x > XMAX ? Math.exp(XMAX) * (1 + x - XMAX) : Math.exp(x); }
function dexpD(x) { return x > XMAX ? Math.exp(XMAX) : Math.exp(x); }

export function diodeCurrent(e, vd) { const nvt = e.n * VT; return e.is * (dexp(vd / nvt) - 1); }

function gauss(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k, m = Math.abs(A[k][k]);
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > m) { m = Math.abs(A[i][k]); p = i; }
    if (m < 1e-30) continue;
    if (p !== k) { [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]]; }
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k]; if (!f) continue;
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
      b[i] -= f * b[k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = Math.abs(A[i][i]) < 1e-30 ? 0 : s / A[i][i];
  }
  return x;
}

export function solve(nodeCount, elements, { maxIter = 200, tol = 1e-7 } = {}) {
  const N = nodeCount - 1; // unknowns (ground excluded)
  let V = new Array(nodeCount).fill(0);
  const diodes = elements.filter(e => e.type === 'D');
  let converged = diodes.length === 0, iter = 0;
  for (iter = 0; iter < maxIter; iter++) {
    const A = Array.from({ length: N }, () => new Array(N).fill(0)), b = new Array(N).fill(0);
    const G = (a, c, g) => {
      if (a > 0) A[a - 1][a - 1] += g;
      if (c > 0) A[c - 1][c - 1] += g;
      if (a > 0 && c > 0) { A[a - 1][c - 1] -= g; A[c - 1][a - 1] -= g; }
    };
    const J = (a, c, i) => { if (a > 0) b[a - 1] += i; if (c > 0) b[c - 1] -= i; }; // i into a, out of c
    for (let k = 0; k < N; k++) A[k][k] += GMIN;
    for (const e of elements) {
      if (e.type === 'R') G(e.a, e.b, 1 / Math.max(e.r, 1e-6));
      else if (e.type === 'S') { const g = 1 / Math.max(e.r, 1e-6); G(e.a, e.b, g); J(e.a, e.b, e.v * g); }
      else if (e.type === 'I') J(e.a, e.b, e.i);
      else if (e.type === 'D') {
        const nvt = e.n * VT, vd = V[e.a] - V[e.c];
        const id = diodeCurrent(e, vd), gd = e.is / nvt * dexpD(vd / nvt) + GMIN;
        G(e.a, e.c, gd); J(e.a, e.c, -(id - gd * vd));
      }
    }
    const x = gauss(A, b);
    const Vn = [0, ...x];
    let dmax = 0; for (let k = 1; k < nodeCount; k++) dmax = Math.max(dmax, Math.abs(Vn[k] - V[k]));
    // damp large steps across diodes for robustness
    if (diodes.length && dmax > 1) { const s = 1 / dmax; for (let k = 1; k < nodeCount; k++) Vn[k] = V[k] + (Vn[k] - V[k]) * Math.max(s, .5); }
    V = Vn;
    if (diodes.length === 0) { converged = true; break; }
    if (dmax < tol) { converged = true; break; }
  }
  const current = e => {
    const va = V[e.a] ?? 0, vb = V[e.b ?? e.c] ?? 0;
    if (e.type === 'R') return (va - vb) / Math.max(e.r, 1e-6);
    if (e.type === 'S') return (e.v - (va - vb)) / Math.max(e.r, 1e-6); // current leaving + terminal
    if (e.type === 'I') return e.i;
    if (e.type === 'D') return diodeCurrent(e, va - vb);
    return 0;
  };
  return { V, converged, iterations: iter + 1, currents: elements.map(current) };
}

// LED model parameters: forward voltage at 20 mA, ideality n = 2
export function ledParams(color) {
  const vf = { red: 2.0, orange: 2.05, yellow: 2.1, green: 2.2, blue: 3.1, white: 3.1, purple: 3.2 }[color] ?? 2.0;
  const n = 2; return { vf, n, is: 0.02 / Math.exp(vf / (n * VT)) };
}
export const SILICON = { n: 1.8, is: 2.5e-9 }; // 1N4148-ish
