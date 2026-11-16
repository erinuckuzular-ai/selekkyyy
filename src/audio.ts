// Everything here is synthesised locally with Web Audio: surface noise, dub siren, airhorn, pull-up, needle drop.
// The tune itself comes out of the YouTube player and cannot be routed through here.
let ctx: AudioContext | null = null;
let master: GainNode;
let noise: { gain: GainNode; hiss: GainNode; rumble: GainNode; pops: number; running: boolean } | null = null;
let amount = 0.35;

export function ac() {
  if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const unlockAudio = () => { try { ac(); } catch { /* no audio */ } };

function noiseBuffer(c: AudioContext, seconds = 2) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}

export const surface = {
  get amount() { return amount; },
  set(a: number) { amount = Math.max(0, Math.min(1, a)); if (noise) { noise.hiss.gain.value = 0.012 * amount; noise.rumble.gain.value = 0.05 * amount; } },
  start() {
    const c = ac(); if (noise?.running) return;
    if (!noise) {
      const gain = c.createGain(); gain.connect(master);
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c); src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.5;
      const hiss = c.createGain(); hiss.gain.value = 0.012 * amount; src.connect(bp).connect(hiss).connect(gain); src.start();
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 31; const rumble = c.createGain(); rumble.gain.value = 0.05 * amount; osc.connect(rumble).connect(gain); osc.start();
      noise = { gain, hiss, rumble, pops: 0, running: false };
    }
    noise.running = true; noise.gain.gain.setTargetAtTime(1, c.currentTime, 0.05);
    const pop = () => {
      if (!noise?.running) return;
      if (amount > 0.02) {
        const t = c.currentTime; const g = c.createGain(); const o = c.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(900 + Math.random() * 2200, t); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03 + Math.random() * 0.12 * amount, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.03);
        o.connect(g).connect(noise.gain); o.start(t); o.stop(t + 0.08);
      }
      setTimeout(pop, 40 + Math.random() * (900 - 700 * amount));
    };
    pop();
  },
  stop() { if (!noise) return; noise.running = false; noise.gain.gain.setTargetAtTime(0, ac().currentTime, 0.08); },
};

export function needleDrop() {
  const c = ac(); const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.3);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  src.connect(lp).connect(g).connect(master); src.start(t);
  const o = c.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.2);
  const og = c.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(og).connect(master); o.start(t); o.stop(t + 0.35);
}

// ---- Dub siren: pulse oscillator, LFO sweep, pitch envelope, into a feedback echo with a dark lowpass in the loop.
let echo: { input: GainNode } | null = null;
function getEcho() {
  if (echo) return echo; const c = ac();
  const input = c.createGain(); const delay = c.createDelay(1.5); delay.delayTime.value = 0.36;
  const fb = c.createGain(); fb.gain.value = 0.48; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const wet = c.createGain(); wet.gain.value = 0.7;
  input.connect(master); input.connect(delay); delay.connect(lp).connect(fb).connect(delay); delay.connect(wet).connect(master);
  echo = { input }; return echo;
}
export type SirenMode = 0 | 1 | 2 | 3;
export const SIREN_NAMES = ['RISE', 'TWO-TONE', 'ZAP', 'WOBBLE'];
let sn: { osc: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode; depth: GainNode; g: GainNode; filt: BiquadFilterNode; mode: SirenMode; base: number } | null = null;
export const siren = {
  active: () => !!sn,
  start(mode: SirenMode = 0) {
    if (sn) return; const c = ac(); const t = c.currentTime; const out = getEcho().input;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2600; filt.Q.value = 2;
    const osc = c.createOscillator(); osc.type = 'square'; const sub = c.createOscillator(); sub.type = 'square';
    const base = [420, 620, 1400, 520][mode];
    osc.frequency.setValueAtTime(base * (mode === 2 ? 1 : 0.5), t); osc.frequency.exponentialRampToValueAtTime(base, t + (mode === 2 ? 0.01 : 0.25));
    sub.frequency.setValueAtTime(base / 2, t); sub.detune.value = 7;
    const lfo = c.createOscillator(); const depth = c.createGain();
    if (mode === 0) { lfo.type = 'sawtooth'; lfo.frequency.value = 1.6; depth.gain.value = 260; }
    if (mode === 1) { lfo.type = 'square'; lfo.frequency.value = 3.2; depth.gain.value = 160; }
    if (mode === 2) { lfo.type = 'sawtooth'; lfo.frequency.value = 11; depth.gain.value = -900; }
    if (mode === 3) { lfo.type = 'triangle'; lfo.frequency.value = 6; depth.gain.value = 220; }
    lfo.connect(depth); depth.connect(osc.frequency); depth.connect(sub.frequency);
    osc.connect(filt); sub.connect(filt); filt.connect(g); g.connect(out);
    osc.start(t); sub.start(t); lfo.start(t);
    sn = { osc, sub, lfo, depth, g, filt, mode, base };
    if (mode === 2) setTimeout(() => siren.stop(), 260); // zaps are one-shots
  },
  // live control while held: x = sweep rate (0..1), y = pitch (0..1, up = higher)
  bend(x: number, y: number) {
    if (!sn) return; const c = ac(); const t = c.currentTime;
    const f = sn.base * Math.pow(2, (y - 0.5) * 2); sn.osc.frequency.setTargetAtTime(f, t, 0.03); sn.sub.frequency.setTargetAtTime(f / 2, t, 0.03);
    const rate = [0.4 + x * 6, 1 + x * 10, 4 + x * 20, 1 + x * 14][sn.mode]; sn.lfo.frequency.setTargetAtTime(rate, t, 0.05);
    sn.filt.frequency.setTargetAtTime(900 + y * 3500, t, 0.05);
  },
  stop() {
    if (!sn) return; const c = ac(); const { osc, sub, lfo, g } = sn; sn = null;
    g.gain.setTargetAtTime(0.0001, c.currentTime, 0.03); setTimeout(() => { osc.stop(); sub.stop(); lfo.stop(); }, 250);
  },
};

export function airhorn() {
  const c = ac(); const t = c.currentTime; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.setValueAtTime(0.22, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(g).connect(getEcho().input);
  for (const f of [233, 311, 466]) for (const det of [-6, 0, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); o.frequency.setValueAtTime(f, t + 0.5); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 0.9); o.connect(lp); o.start(t); o.stop(t + 0.95); }
}

export function pullUp() {
  const c = ac(); const t = c.currentTime;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 1); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(6000, t + 0.7);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + 0.85);
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.7); const og = c.createGain(); og.gain.setValueAtTime(0.08, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.75); o.connect(og).connect(master); o.start(t); o.stop(t + 0.8);
}

export function blip(f = 880, dur = 0.08, vol = 0.08) {
  const c = ac(); const t = c.currentTime; const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export function setMaster(v: number) { if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); }
