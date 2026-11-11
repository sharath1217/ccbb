// Our own SVG parts (battery, multimeter). Expose pinInfo like the Wokwi elements so wiring works the same.
class CbBattery extends HTMLElement {
  constructor() { super(); this.volts = 9; }
  connectedCallback() { this.render(); }
  render() {
    this.innerHTML = `<svg width="78" height="120" viewBox="0 0 78 120">
      <defs><linearGradient id="bg9" x1="0" x2="1"><stop offset="0" stop-color="#2b2f36"/><stop offset=".5" stop-color="#4a505a"/><stop offset="1" stop-color="#23262c"/></linearGradient>
      <linearGradient id="cu" x1="0" x2="1"><stop offset="0" stop-color="#b9772a"/><stop offset=".5" stop-color="#f0b45a"/><stop offset="1" stop-color="#a8641d"/></linearGradient></defs>
      <rect x="6" y="18" width="66" height="98" rx="6" fill="url(#bg9)"/>
      <rect x="6" y="18" width="66" height="34" rx="6" fill="url(#cu)"/><rect x="6" y="40" width="66" height="12" fill="url(#cu)"/>
      <text x="39" y="84" fill="#fff" font-family="Arial" font-weight="700" font-size="22" text-anchor="middle">${this.volts}V</text>
      <text x="39" y="102" fill="#aab" font-family="Arial" font-size="9" text-anchor="middle">ALKALINE</text>
      <rect x="16" y="6" width="14" height="13" rx="2" fill="#c9ccd2" stroke="#8a8f99"/><polygon points="50,6 62,6 64,12 62,19 50,19 48,12" fill="#c9ccd2" stroke="#8a8f99"/>
      <text x="23" y="34" font-family="Arial" font-weight="700" font-size="14" text-anchor="middle" fill="#7a1d1d">+</text><text x="56" y="34" font-family="Arial" font-weight="700" font-size="14" text-anchor="middle" fill="#222">−</text></svg>`;
  }
  get pinInfo() { return [{ name: '+', x: 23, y: 6 }, { name: '-', x: 56, y: 6 }]; }
}
class CbMultimeter extends HTMLElement {
  constructor() { super(); this._reading = '0.000 V'; this._mode = 'V'; }
  connectedCallback() { this.render(); }
  set reading(v) { this._reading = v; const t = this.querySelector('.rd'); if (t) t.textContent = v; }
  set mode(m) { this._mode = m; this.render(); }
  render() {
    const modes = [['V', 'V⎓', -55], ['A', 'A', 0], ['Ω', 'Ω', 55]];
    this.innerHTML = `<svg width="132" height="200" viewBox="0 0 132 200">
      <rect x="2" y="2" width="128" height="196" rx="16" fill="#f2b705"/><rect x="10" y="10" width="112" height="180" rx="10" fill="#2a2e35"/>
      <rect x="18" y="20" width="96" height="40" rx="5" fill="#b9c8a6"/>
      <text class="rd" x="108" y="50" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="18" fill="#141">${this._reading}</text>
      <circle cx="66" cy="112" r="30" fill="#1c1f24" stroke="#444" stroke-width="2"/>
      ${modes.map(([m, l, a]) => { const r = a * Math.PI / 180, x = 66 + Math.sin(r) * 42, y = 112 - Math.cos(r) * 38;
        return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="${m === this._mode ? '#ffd23f' : '#cfd3da'}">${l}</text>`; }).join('')}
      <rect x="61" y="86" width="10" height="34" rx="4" fill="#111" transform="rotate(${({ V: -55, A: 0, 'Ω': 55 })[this._mode]} 66 112)"/>
      <rect x="64" y="86" width="4" height="10" rx="2" fill="#ff4d4d" transform="rotate(${({ V: -55, A: 0, 'Ω': 55 })[this._mode]} 66 112)"/>
      <circle cx="44" cy="172" r="8" fill="#111" stroke="#555"/><circle cx="88" cy="172" r="8" fill="#7f1d1d" stroke="#555"/>
      <text x="44" y="158" text-anchor="middle" font-family="Arial" font-size="9" fill="#cfd3da">COM</text><text x="88" y="158" text-anchor="middle" font-family="Arial" font-size="9" fill="#cfd3da">VΩA</text></svg>`;
  }
  get pinInfo() { return [{ name: 'COM', x: 44, y: 172 }, { name: 'V', x: 88, y: 172 }]; }
}
customElements.define('cb-battery', CbBattery);
customElements.define('cb-multimeter', CbMultimeter);
