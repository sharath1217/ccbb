// Real-world environment: tools (lighter, fan, gas can, torch, hand…) change what nearby sensors measure.
// Distances are in cm (the canvas uses 2.54 mm = 9.6 px, so 1 cm ≈ 37.8 px). Effects fall off with distance
// roughly like the real thing: heat and light spread out, gas dilutes, a fan blows heat and gas away.
export const PX_PER_CM = 9.6 / 0.254;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const TOOL_TYPES = ['lighter', 'fan', 'gascan', 'torch', 'hand', 'ice', 'water', 'speaker', 'magnet', 'rfidcard', 'incense'];

// tool: { type, on, mode, pos:{x,y} (cm), moving (bool) }   sensor: { type, props, pos }
export function sense(sensor, tools, ambient = {}) {
  const T0 = ambient.temp ?? sensor.props.temp ?? 27, H0 = ambient.hum ?? sensor.props.hum ?? 55;
  const near = t => Math.hypot(t.pos.x - sensor.pos.x, t.pos.y - sensor.pos.y);
  const on = t => t.on !== false;
  const fan = tools.filter(t => t.type === 'fan' && on(t)).reduce((k, t) => Math.max(k, clamp(1 - near(t) / 60, 0, 1)), 0); // 0..1 airflow
  let dT = 0, dH = 0, lux = 0, flame = 0, ppm = 0, db = 0, dist = null, motion = false, finger = false, magnet = false, touch = false, wet = 0, card = null;
  for (const t of tools) {
    const d = Math.max(0.3, near(t));
    switch (t.type) {
      case 'lighter':
        if (t.mode === 'lit') { dT += Math.min(120, 150 / d); dH -= Math.min(30, 60 / d); lux += Math.min(400, 3000 / (1 + (d / 3) ** 2)); flame = Math.max(flame, clamp(100 * (1 - d / 80), 0, 100)); }
        if (t.mode === 'gas') ppm += Math.min(9000, 20000 / (1 + (d / 3) ** 2));                // unlit lighter leaking butane
        break;
      case 'ice': dT -= Math.min(25, 60 / (d + 1)); dH += Math.min(10, 20 / (d + 1)); break;
      case 'water': dH += Math.min(35, 70 / (d + 1)); if (d < 3) wet = Math.max(wet, 100 * (1 - d / 3)); break;
      case 'torch': if (on(t)) { lux += Math.min(25000, 30000 / (1 + (d / 5) ** 2)); flame = Math.max(flame, clamp(12 * (1 - d / 30), 0, 12)); } break;
      case 'gascan': if (on(t)) ppm += Math.min(10000, 40000 / (1 + (d / 4) ** 2)); break;
      case 'incense': if (on(t)) { ppm += Math.min(3000, 10000 / (1 + (d / 5) ** 2)); dT += Math.min(5, 8 / d); } break;
      case 'speaker': if (on(t)) db = Math.max(db, clamp(100 - 20 * Math.log10(Math.max(d, 1) / 10), 30, 120)); break;
      case 'hand': if (dist === null || d < dist) dist = d; if (t.moving && d < 700) motion = true; if (d < 2.5) finger = true; if (d < 1.5) touch = true; dT += d < 3 ? 6 * (1 - d / 3) : 0; break;
      case 'magnet': if (d < 2.5) magnet = true; break;
      case 'rfidcard': if (d < 4) card = t.uid || 'DE AD BE EF'; break;
    }
  }
  dT *= 1 - 0.7 * fan; ppm *= 1 - 0.9 * fan; dH -= 8 * fan;
  return { temp: T0 + dT, hum: clamp(H0 + dH, 0, 100), lux, flame, ppm, db, dist, motion, finger, magnet, touch, wet, card, wind: fan };
}

// Which sensor props each environment value drives (merged on top of the student's own slider values)
export function effectiveProps(type, props, env) {
  const p = { ...props };
  switch (type) {
    case 'dht22': case 'ntc': case 'lm35': case 'ds18b20': case 'bmp280': p.temp = Math.round(env.temp * 10) / 10; if ('hum' in props) p.hum = Math.round(env.hum); break;
    case 'ldr': case 'bh1750': case 'photodiode': p.lux = (props.lux ?? 300) + env.lux; break;
    case 'flame': p.flame = Math.max(props.flame ?? 0, env.flame); break;
    case 'gas': case 'mq135': p.ppm = (props.ppm ?? 200) + env.ppm; break;
    case 'sound': p.db = Math.max(props.db ?? 40, env.db); break;
    case 'hcsr04': if (env.dist !== null) p.dist = Math.round(env.dist); break;
    case 'irobstacle': p.obstacle = (env.dist !== null && env.dist < 10) || !!props.obstacle; break;
    case 'pir': p.motion = env.motion || !!props.motion; break;
    case 'heartbeat': p.bpm = env.finger ? (props.bpm ?? 72) : 0; break;
    case 'hall': case 'reed': p.magnet = env.magnet || !!props.magnet; break;
    case 'touch': p.touched = env.touch || !!props.touched; break;
    case 'rain': p.wet = Math.max(props.wet ?? 0, env.wet); break;
    case 'soil': p.moisture = Math.max(props.moisture ?? 20, env.wet ? 85 : 0); break;
    case 'waterlevel': p.level = Math.max(props.level ?? 0, env.wet); break;
    case 'rc522': p.card = env.card; break;
  }
  return p;
}
