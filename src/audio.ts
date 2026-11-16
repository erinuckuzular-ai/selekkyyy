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

let sirenNodes: { o1: OscillatorNode; o2: OscillatorNode; lfo: OscillatorNode; g: GainNode } | null = null;
export const siren = {
  start(mode: 0 | 1 | 2 = 0) {
    if (sirenNodes) return; const c = ac(); const t = c.currentTime;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.03); g.connect(master);
    const o1 = c.createOscillator(); o1.type = 'square'; const o2 = c.createOscillator(); o2.type = 'square';
    const base = [520, 680, 440][mode]; o1.frequency.value = base; o2.frequency.value = base * 1.005;
    const lfo = c.createOscillator(); lfo.type = ['triangle', 'square', 'sawtooth'][mode] as OscillatorType; lfo.frequency.value = [5, 9, 2.5][mode];
    const depth = c.createGain(); depth.gain.value = [180, 260, 320][mode]; lfo.connect(depth); depth.connect(o1.frequency); depth.connect(o2.frequency);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    o1.connect(lp); o2.connect(lp); lp.connect(g); o1.start(); o2.start(); lfo.start();
    sirenNodes = { o1, o2, lfo, g };
  },
  stop() { if (!sirenNodes) return; const c = ac(); const { o1, o2, lfo, g } = sirenNodes; sirenNodes = null; g.gain.setTargetAtTime(0.0001, c.currentTime, 0.04); setTimeout(() => { o1.stop(); o2.stop(); lfo.stop(); }, 300); },
};

export function airhorn() {
  const c = ac(); const t = c.currentTime; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.setValueAtTime(0.22, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(g).connect(master);
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
