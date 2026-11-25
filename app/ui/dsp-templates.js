// Signals, DSP and control experiments (VTU DSP lab, Signals & Systems, Control Systems).
// Each experiment: params, run(P) → { plots, table, note }, and py(P) → equivalent NumPy/SciPy code.
import * as D from '../engine/dsp.js';

const list = s => String(s).split(/[\s,;]+/).filter(Boolean).map(Number);
const f4 = v => (Math.abs(v) < 5e-13 ? 0 : +v.toPrecision(5));
const arr = a => '[' + a.map(f4).join(', ') + ']';
const idx = n => Array.from({ length: n }, (_, i) => i);
const pyList = s => '[' + list(s).join(', ') + ']';
const HEAD = 'import numpy as np\nimport matplotlib.pyplot as plt\n';

export const DSP_TEMPLATES = {
  sampling: { group: 'DSP lab', name: 'Sampling theorem & aliasing',
    params: [{ key: 'f', label: 'Signal frequency (Hz)', value: 50 }, { key: 'fs', label: 'Sampling frequency (Hz)', value: 400 }],
    run({ f, fs }) { const T = 3 / f, tc = idx(600).map(i => i * T / 599), n = idx(Math.floor(T * fs) + 1), ts = n.map(k => k / fs);
      const alias = Math.abs(f - fs * Math.round(f / fs));
      return { plots: [{ title: 'x(t) = sin(2π·f·t) and its samples', x: tc.map(t => t * 1000), xl: 't (ms)', series: [{ name: 'continuous', y: tc.map(t => Math.sin(2 * Math.PI * f * t)) }, { name: 'samples', x: ts.map(t => t * 1000), y: ts.map(t => Math.sin(2 * Math.PI * f * t)), stem: true }] },
          { title: 'Reconstructed (what the samples look like)', x: tc.map(t => t * 1000), xl: 't (ms)', series: [{ name: 'apparent ' + alias + ' Hz', y: tc.map(t => Math.sin(2 * Math.PI * alias * t * Math.sign(Math.sin(2 * Math.PI * f / fs) || 1))) }] }],
        table: [['Nyquist rate 2f', 2 * f + ' Hz'], ['fs / f', f4(fs / f) + ' samples per cycle'], ['Condition', fs >= 2 * f ? '✔ fs ≥ 2f: no aliasing' : '✘ fs < 2f: ALIASING'], ['Apparent frequency', alias + ' Hz']] }; },
    py: ({ f, fs }) => HEAD + `f, fs = ${f}, ${fs}\nt = np.linspace(0, 3/f, 600)\nn = np.arange(0, 3/f, 1/fs)\nplt.plot(t*1000, np.sin(2*np.pi*f*t), label='continuous')\nplt.stem(n*1000, np.sin(2*np.pi*f*n), 'r', label='samples')\nplt.xlabel('t (ms)'); plt.legend(); plt.show()\nprint('Nyquist rate =', 2*f, 'Hz; aliasing' if fs < 2*f else '; no aliasing')` },

  linconv: { group: 'DSP lab', name: 'Linear convolution',
    params: [{ key: 'x', label: 'x[n]', value: '1 2 3 4', list: true }, { key: 'h', label: 'h[n]', value: '1 1 1', list: true }],
    run({ x, h }) { const X = list(x), H = list(h), y = D.conv(X, H);
      return { plots: [{ title: 'y[n] = x[n] * h[n]', x: idx(y.length), xl: 'n', series: [{ name: 'y[n]', y, stem: true }] }, { title: 'inputs', x: idx(Math.max(X.length, H.length)), xl: 'n', series: [{ name: 'x[n]', y: X, stem: true }, { name: 'h[n]', y: H, stem: true }] }],
        table: [['y[n]', arr(y)], ['Length', `${X.length} + ${H.length} − 1 = ${y.length}`]] }; },
    py: ({ x, h }) => HEAD + `x = np.array(${pyList(x)}); h = np.array(${pyList(h)})\ny = np.convolve(x, h)\nprint('y =', y)\nplt.stem(y); plt.title('Linear convolution'); plt.xlabel('n'); plt.show()` },

  circconv: { group: 'DSP lab', name: 'Circular convolution',
    params: [{ key: 'x', label: 'x[n]', value: '1 2 3 4', list: true }, { key: 'h', label: 'h[n]', value: '1 2 1 1', list: true }, { key: 'N', label: 'N (points)', value: 4 }],
    run({ x, h, N }) { const y = D.cconv(list(x), list(h), N), lin = D.conv(list(x), list(h));
      return { plots: [{ title: `${N}-point circular convolution`, x: idx(N), xl: 'n', series: [{ name: 'y[n]', y, stem: true }] }],
        table: [['y[n]', arr(y)], ['Linear conv (for comparison)', arr(lin)], ['Equal to linear?', N >= lin.length ? 'yes: N ≥ L + M − 1' : 'no: time-aliased (N < L + M − 1)']] }; },
    py: ({ x, h, N }) => HEAD + `x = np.array(${pyList(x)}); h = np.array(${pyList(h)}); N = ${N}\ny = np.real(np.fft.ifft(np.fft.fft(x, N) * np.fft.fft(h, N)))\nprint('y =', np.round(y, 4))\nplt.stem(y); plt.title('Circular convolution'); plt.show()` },

  corr: { group: 'DSP lab', name: 'Auto- and cross-correlation',
    params: [{ key: 'x', label: 'x[n]', value: '1 2 3 4', list: true }, { key: 'y', label: 'y[n] (blank = autocorrelation)', value: '', list: true }],
    run({ x, y }) { const X = list(x), Y = y ? list(y) : X, { r, lags } = D.xcorr(X, Y), c = Math.max(...r);
      const props = !y ? [['r(0) = energy', f4(r[(r.length - 1) / 2])], ['Even symmetry r(l) = r(−l)', r.every((v, i) => Math.abs(v - r[r.length - 1 - i]) < 1e-9) ? '✔' : '✘'], ['Max at l = 0', r[(r.length - 1) / 2] === c ? '✔' : '✘']] : [];
      return { plots: [{ title: y ? 'cross-correlation r_xy(l)' : 'autocorrelation r_xx(l)', x: lags, xl: 'lag l', series: [{ name: 'r(l)', y: r, stem: true }] }], table: [['r(l)', arr(r)], ...props] }; },
    py: ({ x, y }) => HEAD + `x = np.array(${pyList(x)}); y = ${y ? 'np.array(' + pyList(y) + ')' : 'x'}\nr = np.correlate(x, y, 'full')\nprint('r =', r)\nplt.stem(np.arange(-len(x)+1, len(x)), r); plt.xlabel('lag'); plt.show()` },

  dft: { group: 'DSP lab', name: 'N-point DFT and IDFT',
    params: [{ key: 'x', label: 'x[n]', value: '1 2 3 4', list: true }, { key: 'N', label: 'N', value: 8 }],
    run({ x, N }) { const X = D.dft(list(x), N), back = D.idft(X).map(c => c[0]);
      return { plots: [{ title: '|X(k)|', x: idx(N), xl: 'k', series: [{ name: '|X(k)|', y: X.map(D.C.abs), stem: true }] }, { title: '∠X(k) (rad)', x: idx(N), xl: 'k', series: [{ name: 'phase', y: X.map(c => (D.C.abs(c) < 1e-9 ? 0 : D.C.arg(c))), stem: true }] }],
        table: [['X(k)', X.map(c => `${f4(c[0])}${c[1] < 0 ? '−' : '+'}j${f4(Math.abs(c[1]))}`).join(', ')], ['IDFT → x[n]', arr(back)], ['Parseval Σ|x|² = Σ|X|²/N', `${f4(list(x).reduce((s, v) => s + v * v, 0))} = ${f4(X.reduce((s, c) => s + D.C.abs(c) ** 2, 0) / N)}`]] }; },
    py: ({ x, N }) => HEAD + `x = np.array(${pyList(x)}); N = ${N}\nX = np.fft.fft(x, N)\nprint('X =', np.round(X, 4))\nprint('IDFT =', np.round(np.real(np.fft.ifft(X)), 4))\nfig, ax = plt.subplots(2); ax[0].stem(abs(X)); ax[1].stem(np.angle(X)); plt.show()` },

  spectrum: { group: 'DSP lab', name: 'FFT spectrum of a signal',
    params: [{ key: 'f1', label: 'f1 (Hz)', value: 50 }, { key: 'f2', label: 'f2 (Hz)', value: 120 }, { key: 'a2', label: 'Amplitude of f2', value: 0.5 }, { key: 'fs', label: 'fs (Hz)', value: 1000 }, { key: 'N', label: 'N (FFT points)', value: 1024 }],
    run({ f1, f2, a2, fs, N }) { const x = idx(N).map(n => Math.sin(2 * Math.PI * f1 * n / fs) + a2 * Math.sin(2 * Math.PI * f2 * n / fs)), X = D.fft(x, N);
      const half = idx(N / 2), mag = half.map(k => 2 * D.C.abs(X[k]) / N), fr = half.map(k => k * fs / N);
      const peaks = half.filter(k => k > 0 && mag[k] > mag[k - 1] && mag[k] >= (mag[k + 1] ?? 0) && mag[k] > 0.1).map(k => `${f4(fr[k])} Hz (${f4(mag[k])})`);
      return { plots: [{ title: 'x[n] (first 100 samples)', x: idx(100), xl: 'n', series: [{ name: 'x[n]', y: x.slice(0, 100) }] }, { title: 'Single-sided amplitude spectrum', x: fr, xl: 'f (Hz)', series: [{ name: '|X(f)|', y: mag }] }],
        table: [['Frequency resolution fs/N', f4(fs / N) + ' Hz'], ['Peaks', peaks.join(', ')], ['Note', 'Peaks that fall between FFT bins leak into neighbours: try N = 1000 vs 1024.']] }; },
    py: ({ f1, f2, a2, fs, N }) => HEAD + `fs, N = ${fs}, ${N}\nn = np.arange(N)\nx = np.sin(2*np.pi*${f1}*n/fs) + ${a2}*np.sin(2*np.pi*${f2}*n/fs)\nX = np.fft.fft(x)\nf = np.arange(N//2)*fs/N\nplt.plot(f, 2*abs(X[:N//2])/N); plt.xlabel('f (Hz)'); plt.show()` },

  diffeq: { group: 'DSP lab', name: 'Difference equation: impulse & step response',
    params: [{ key: 'b', label: 'b (numerator)', value: '1', list: true }, { key: 'a', label: 'a (denominator)', value: '1 -0.9', list: true }, { key: 'N', label: 'Samples', value: 30 }],
    run({ b, a, N }) { const B = list(b), A = list(a), h = D.impz(B, A, N), s = D.stepz(B, A, N), p = D.roots(A);
      const stable = p.every(r => D.C.abs(r) < 1);
      return { plots: [{ title: 'impulse response h[n]', x: idx(N), xl: 'n', series: [{ name: 'h[n]', y: h, stem: true }] }, { title: 'step response s[n]', x: idx(N), xl: 'n', series: [{ name: 's[n]', y: s, stem: true }] },
          { title: 'pole-zero plot (unit circle)', kind: 'pz', poles: p, zeros: D.roots(B) }],
        table: [['h[0…9]', arr(h.slice(0, 10))], ['Poles', p.map(r => `${f4(r[0])}${r[1] ? (r[1] < 0 ? '−' : '+') + 'j' + f4(Math.abs(r[1])) : ''}`).join(', ') || 'none'], ['Stable (all |p| < 1)', stable ? '✔ yes' : '✘ no']] }; },
    py: ({ b, a, N }) => HEAD + `from scipy import signal\nb, a, N = ${pyList(b)}, ${pyList(a)}, ${N}\nimp = np.zeros(N); imp[0] = 1\nh = signal.lfilter(b, a, imp)\ns = signal.lfilter(b, a, np.ones(N))\nprint('h =', np.round(h[:10], 4))\nfig, ax = plt.subplots(2); ax[0].stem(h); ax[1].stem(s); plt.show()` },

  fir: { group: 'DSP lab', name: 'FIR filter design (window method)',
    params: [{ key: 'N', label: 'Order N', value: 30 }, { key: 'fc', label: 'Cut-off (Hz)', value: 1000 }, { key: 'fc2', label: 'Upper cut-off for band filters (Hz)', value: 2000 }, { key: 'fs', label: 'fs (Hz)', value: 8000 },
      { key: 'type', label: 'Type', value: 'low', options: ['low', 'high', 'bandpass', 'stop'] }, { key: 'win', label: 'Window', value: 'hamming', options: Object.keys(D.WINDOWS) }],
    run({ N, fc, fc2, fs, type, win }) { if ((type === 'high' || type === 'stop') && N % 2) N++;
      const wn = type === 'bandpass' || type === 'stop' ? [2 * fc / fs, 2 * fc2 / fs] : 2 * fc / fs, h = D.fir1(N, wn, type, win), F = D.freqz(h, [1], 512);
      return { plots: [{ title: `h[n] (${N + 1} taps)`, x: idx(N + 1), xl: 'n', series: [{ name: 'h[n]', y: h, stem: true }] }, { title: 'magnitude response', x: F.w.map(w => w * fs / 2 / Math.PI), xl: 'f (Hz)', yl: 'dB', series: [{ name: '|H| dB', y: F.db }] }],
        table: [['Coefficients', arr(h)], ['Min stop-band attenuation (approx.)', ({ rectangular: '21 dB', bartlett: '25 dB', hann: '44 dB', hamming: '53 dB', blackman: '74 dB' })[win]], ['Linear phase', '✔ symmetric h[n]']], note: type !== 'low' && N % 2 === 0 ? '' : '' }; },
    py: ({ N, fc, fc2, fs, type, win }) => HEAD + `from scipy import signal\nfs = ${fs}\nh = signal.firwin(${N + ((type === 'high' || type === 'stop') && N % 2 ? 2 : 1)}, ${type === 'bandpass' || type === 'stop' ? `[${fc}, ${fc2}]` : fc}, window='${win === 'rectangular' ? 'boxcar' : win}', pass_zero=${type === 'low' || type === 'stop' ? 'True' : 'False'}, fs=fs)\nw, H = signal.freqz(h, fs=fs)\nprint(np.round(h, 4))\nplt.plot(w, 20*np.log10(abs(H))); plt.xlabel('f (Hz)'); plt.ylabel('dB'); plt.show()` },

  iir: { group: 'DSP lab', name: 'IIR filter: Butterworth / Chebyshev',
    params: [{ key: 'kind', label: 'Type', value: 'butter', options: ['butter', 'cheby1'] }, { key: 'type', label: 'Response', value: 'low', options: ['low', 'high'] }, { key: 'n', label: 'Order', value: 4 },
      { key: 'fc', label: 'Cut-off (Hz)', value: 1000 }, { key: 'fs', label: 'fs (Hz)', value: 8000 }, { key: 'rp', label: 'Chebyshev ripple (dB)', value: 0.5 }],
    run({ kind, type, n, fc, fs, rp }) { const { b, a, poles } = D.iir(n, 2 * fc / fs, { kind, type, rp }), F = D.freqz(b, a, 512);
      return { plots: [{ title: 'magnitude response', x: F.w.map(w => w * fs / 2 / Math.PI), xl: 'f (Hz)', yl: 'dB', series: [{ name: '|H| dB', y: F.db.map(v => Math.max(v, -100)) }] }, { title: 'pole-zero plot', kind: 'pz', poles, zeros: D.roots(b) }],
        table: [['b', arr(b)], ['a', arr(a)], ['|H| at cut-off', f4(F.db[Math.round(512 * 2 * fc / fs)]) + ' dB'], ['Stable', poles.every(p => D.C.abs(p) < 1) ? '✔ all poles inside the unit circle' : '✘']] }; },
    py: ({ kind, type, n, fc, fs, rp }) => HEAD + `from scipy import signal\nfs = ${fs}\nb, a = signal.${kind}(${n}, ${kind === 'cheby1' ? rp + ', ' : ''}${fc}, '${type}', fs=fs)\nprint('b =', np.round(b, 5)); print('a =', np.round(a, 5))\nw, H = signal.freqz(b, a, fs=fs)\nplt.plot(w, 20*np.log10(abs(H))); plt.ylim(-80, 5); plt.xlabel('f (Hz)'); plt.show()` },

  buttord: { group: 'DSP lab', name: 'Butterworth design from specifications',
    params: [{ key: 'fp', label: 'Pass-band edge (Hz)', value: 1000 }, { key: 'fst', label: 'Stop-band edge (Hz)', value: 2000 }, { key: 'rp', label: 'Pass-band ripple (dB)', value: 1 }, { key: 'rs', label: 'Stop-band attenuation (dB)', value: 30 }, { key: 'fs', label: 'fs (Hz)', value: 8000 }],
    run({ fp, fst, rp, rs, fs }) { const { n, wn } = D.buttord(2 * fp / fs, 2 * fst / fs, rp, rs), type = fp < fst ? 'low' : 'high', { b, a } = D.butter(n, wn, type), F = D.freqz(b, a, 1024), at = f => F.db[Math.round(1024 * 2 * f / fs)];
      return { plots: [{ title: `order-${n} Butterworth meets the spec`, x: F.w.map(w => w * fs / 2 / Math.PI), xl: 'f (Hz)', yl: 'dB', series: [{ name: '|H| dB', y: F.db.map(v => Math.max(v, -100)) }] }],
        table: [['Minimum order N', n], ['Cut-off', f4(wn * fs / 2) + ' Hz'], ['At pass edge', f4(at(fp)) + ` dB (≥ −${rp})`], ['At stop edge', f4(at(fst)) + ` dB (≤ −${rs})`], ['b', arr(b)], ['a', arr(a)]] }; },
    py: ({ fp, fst, rp, rs, fs }) => HEAD + `from scipy import signal\nfs = ${fs}\nN, Wn = signal.buttord(${fp}, ${fst}, ${rp}, ${rs}, fs=fs)\nprint('order', N, 'cut-off', Wn)\nb, a = signal.butter(N, Wn, fs=fs)\nw, H = signal.freqz(b, a, fs=fs)\nplt.plot(w, 20*np.log10(abs(H))); plt.ylim(-80, 5); plt.show()` },

  second: { group: 'Control systems', name: 'Second-order system: time response',
    params: [{ key: 'wn', label: 'Natural frequency ωn (rad/s)', value: 2 }, { key: 'z', label: 'Damping ratio ζ', value: 0.4 }, { key: 'T', label: 'Simulate for (s)', value: 12 }],
    run({ wn, z, T }) { const s = D.step([wn * wn], [1, 2 * z * wn, wn * wn], T), i = D.stepinfo(s), wd = wn * Math.sqrt(Math.max(0, 1 - z * z));
      const others = [0.2, 0.7, 1].filter(v => v !== z).map(zz => ({ name: 'ζ = ' + zz, y: D.step([wn * wn], [1, 2 * zz * wn, wn * wn], T).y, faint: true }));
      return { plots: [{ title: `step response  ωn²/(s² + 2ζωn s + ωn²)`, x: s.t, xl: 't (s)', series: [{ name: 'ζ = ' + z, y: s.y }, ...others] }],
        table: [['', 'Simulated · Formula'], ['Peak overshoot Mp', `${f4(i.overshoot)} % · ${z < 1 ? f4(100 * Math.exp(-z * Math.PI / Math.sqrt(1 - z * z))) : 0} %`], ['Peak time tp', `${f4(i.peakTime)} s · ${z < 1 ? f4(Math.PI / wd) : '∞'} s`],
          ['Rise time (10–90 %)', f4(i.riseTime) + ' s'], ['Settling time (2 %)', `${f4(i.settlingTime)} s · ${f4(4 / (z * wn))} s (4/ζωn)`], ['Damping', z === 0 ? 'undamped' : z < 1 ? 'under-damped' : z === 1 ? 'critically damped' : 'over-damped']] }; },
    py: ({ wn, z, T }) => HEAD + `from scipy import signal\nwn, z = ${wn}, ${z}\nsys = signal.TransferFunction([wn**2], [1, 2*z*wn, wn**2])\nt, y = signal.step(sys, T=np.linspace(0, ${T}, 2000))\nMp = (max(y) - y[-1]) / y[-1] * 100\nprint('Overshoot %.2f %%, peak time %.3f s' % (Mp, t[np.argmax(y)]))\nplt.plot(t, y); plt.grid(); plt.xlabel('t (s)'); plt.show()` },

  tfstep: { group: 'Control systems', name: 'Transfer function: open vs closed loop',
    params: [{ key: 'num', label: 'Numerator', value: '10', list: true }, { key: 'den', label: 'Denominator', value: '1 3 2', list: true }, { key: 'T', label: 'Simulate for (s)', value: 8 }],
    run({ num, den, T }) { const N = list(num), Dd = list(den), cl = D.feedback(N, Dd), o = D.step(N, Dd, T), c = D.step(cl.num, cl.den, T), i = D.stepinfo(c);
      const p = D.roots(cl.den), kp = D.polyval(N, 0)[0] / (D.polyval(Dd, 0)[0] || 1e-300);
      return { plots: [{ title: 'step responses', x: o.t, xl: 't (s)', series: [{ name: 'open loop G(s)', y: o.y, faint: true }, { name: 'closed loop G/(1+G)', y: c.y }] }, { title: 'closed-loop poles (s-plane)', kind: 'pz', splane: true, poles: p, zeros: D.roots(N) }],
        table: [['Closed loop', `${arr(cl.num)} / ${arr(cl.den)}`], ['Poles', p.map(r => `${f4(r[0])}${r[1] ? (r[1] < 0 ? '−' : '+') + 'j' + f4(Math.abs(r[1])) : ''}`).join(', ')], ['Stable', p.every(r => r[0] < 0) ? '✔ all poles in the left half' : '✘ unstable'],
          ['Final value', f4(i.final)], ['Position constant Kp / steady-state error', `${isFinite(kp) ? f4(kp) : '∞'} / ${isFinite(kp) ? f4(1 / (1 + kp)) : 0}`], ['Overshoot', f4(i.overshoot) + ' %'], ['Settling (2 %)', f4(i.settlingTime) + ' s']] }; },
    py: ({ num, den, T }) => HEAD + `from scipy import signal\nnum, den = ${pyList(num)}, ${pyList(den)}\ncl_den = np.polyadd(den, num)\nt = np.linspace(0, ${T}, 2000)\nt, y = signal.step((num, cl_den), T=t)\nprint('closed-loop poles:', np.roots(cl_den))\nplt.plot(t, y); plt.grid(); plt.show()` },

  bode: { group: 'Control systems', name: 'Bode plot, gain & phase margin',
    params: [{ key: 'num', label: 'Numerator G(s)', value: '2', list: true }, { key: 'den', label: 'Denominator', value: '1 3 2 0', list: true }],
    run({ num, den }) { const N = list(num), Dd = list(den), b = D.bode(N, Dd, 0.01, 100, 500), m = D.margin(N, Dd);
      return { plots: [{ title: 'magnitude', x: b.w, logx: true, xl: 'ω (rad/s)', yl: 'dB', series: [{ name: '|G(jω)| dB', y: b.mag }], hline: 0 }, { title: 'phase', x: b.w, logx: true, xl: 'ω (rad/s)', yl: 'deg', series: [{ name: '∠G(jω)', y: b.phase }], hline: -180 }],
        table: [['Gain margin', isFinite(m.gm) ? `${f4(m.gm)} dB at ω = ${f4(m.wpc)} rad/s` : '∞'], ['Phase margin', isFinite(m.pm) ? `${f4(m.pm)}° at ω = ${f4(m.wgc)} rad/s` : '∞'], ['Closed loop', m.gm > 0 && m.pm > 0 ? '✔ stable' : '✘ unstable']] }; },
    py: ({ num, den }) => HEAD + `from scipy import signal\nsys = signal.TransferFunction(${pyList(num)}, ${pyList(den)})\nw, mag, ph = signal.bode(sys, np.logspace(-2, 2, 500))\nfig, ax = plt.subplots(2); ax[0].semilogx(w, mag); ax[1].semilogx(w, ph); plt.show()` },

  rlocus: { group: 'Control systems', name: 'Root locus',
    params: [{ key: 'num', label: 'Numerator', value: '1', list: true }, { key: 'den', label: 'Denominator', value: '1 3 2 0', list: true }, { key: 'kmax', label: 'Maximum gain K', value: 30 }],
    run({ num, den, kmax }) { const N = list(num), Dd = list(den), Ks = idx(600).map(i => kmax * (i / 599) ** 2), loc = D.rlocus(N, Dd, Ks);
      let kc = null; for (let i = 1; i < loc.length; i++) if (loc[i].poles.some(p => p[0] > 1e-9) && !loc[i - 1].poles.some(p => p[0] > 1e-9)) { kc = loc[i].k; break; }
      return { plots: [{ title: 'root locus (× open-loop poles, ○ zeros)', kind: 'locus', loc, poles: D.roots(Dd), zeros: D.roots(N) }],
        table: [['Open-loop poles', D.roots(Dd).map(r => f4(r[0]) + (r[1] ? `±j${f4(Math.abs(r[1]))}` : '')).join(', ')], ['Becomes unstable at K ≈', kc ? f4(kc) : 'stays stable up to K = ' + kmax]] }; },
    py: ({ num, den, kmax }) => HEAD + `num, den = np.array(${pyList(num)}), np.array(${pyList(den)})\nfor K in np.linspace(0, ${kmax}, 400):\n    r = np.roots(np.polyadd(den, K*num))\n    plt.plot(r.real, r.imag, 'b.', ms=2)\nplt.axvline(0, color='k'); plt.grid(); plt.show()` },

  routh: { group: 'Control systems', name: 'Routh-Hurwitz stability',
    params: [{ key: 'p', label: 'Characteristic polynomial', value: '1 2 3 4 5', list: true }],
    run({ p }) { const P = list(p), r = D.routh(P), z = D.roots(P);
      return { plots: [{ title: 'roots in the s-plane', kind: 'pz', splane: true, poles: z, zeros: [] }],
        table: [...r.rows.map((row, i) => [`s^${P.length - 1 - i}`, row.map(f4).join('   ')]), ['Sign changes in 1st column', r.rhpPoles], ['Result', r.stable ? '✔ stable' : `✘ unstable: ${r.rhpPoles} pole(s) in the right half plane`]] }; },
    py: ({ p }) => HEAD + `p = ${pyList(p)}\nr = np.roots(p)\nprint('roots:', np.round(r, 4))\nprint('stable' if all(r.real < 0) else 'unstable')` },

  pid: { group: 'Control systems', name: 'PID controller tuning',
    params: [{ key: 'num', label: 'Plant numerator', value: '1', list: true }, { key: 'den', label: 'Plant denominator', value: '1 3 1', list: true }, { key: 'kp', label: 'Kp', value: 10 }, { key: 'ki', label: 'Ki', value: 5 }, { key: 'kd', label: 'Kd', value: 2 }, { key: 'T', label: 'Simulate for (s)', value: 10 }],
    run({ num, den, kp, ki, kd, T }) { const N = list(num), Dd = list(den);
      const Cn = [kd, kp, ki], Cd = [1, 0], L = { num: D.conv(Cn, N), den: D.conv(Cd, Dd) }, cl = D.feedback(L.num, L.den), s = D.step(cl.num, cl.den, T), i = D.stepinfo(s), p = D.step(D.feedback(N, Dd).num, D.feedback(N, Dd).den, T);
      return { plots: [{ title: 'closed-loop step response', x: s.t, xl: 't (s)', series: [{ name: 'with PID', y: s.y }, { name: 'plant alone (unity feedback)', y: p.y, faint: true }] }],
        table: [['Controller', `${kd}s² + ${kp}s + ${ki} over s`], ['Overshoot', f4(i.overshoot) + ' %'], ['Rise time', f4(i.riseTime) + ' s'], ['Settling (2 %)', f4(i.settlingTime) + ' s'], ['Steady-state error', f4(1 - i.final)], ['Tip', 'Kp speeds up, Ki removes the steady-state error, Kd reduces overshoot.']] }; },
    py: ({ num, den, kp, ki, kd, T }) => HEAD + `from scipy import signal\nplant_n, plant_d = ${pyList(num)}, ${pyList(den)}\nKp, Ki, Kd = ${kp}, ${ki}, ${kd}\nLn = np.polymul([Kd, Kp, Ki], plant_n); Ld = np.polymul([1, 0], plant_d)\nt, y = signal.step((Ln, np.polyadd(Ld, Ln)), T=np.linspace(0, ${T}, 2000))\nplt.plot(t, y); plt.grid(); plt.show()` },
};
