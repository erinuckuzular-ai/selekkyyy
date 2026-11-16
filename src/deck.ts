// A turntable. Visual rotation is simulated; the tune's speed follows it through the YouTube playback rate.
import { byId, fmtTime, thumb, type Track } from './catalogue';
import { Player } from './player';
import { needleDrop, surface } from './audio';
import { h } from './ui-bits';

const ARM_REST = -32, ARM_IN = -4, ARM_OUT = 22; // degrees
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Deck {
  el: HTMLElement; track: Track | null = null;
  private angle = 0; private speed = 0; private targetSpeed = 0; // rpm
  private pitch = 0; private rpmSel: 33 | 45 | 78 = 33;
  private record!: HTMLElement; private arm!: HTMLElement; private readout!: HTMLElement; private titleEl!: HTMLElement; private timeEl!: HTMLElement; private pitchIn!: HTMLInputElement;
  private scratching = false; private armDrag = false; private lastT = performance.now();
  private running = false; private lastRateStep = 1;
  onLoad: ((t: Track) => void) | null = null;
  constructor(public side: 'A' | 'B', public player: Player, host: HTMLElement) {
    this.el = h(`<section class="deck" data-side="${side}">
      <div class="deck-top"><span class="deck-tag">DECK ${side}</span><span class="deck-title">drop a record</span><span class="deck-time">--:--</span></div>
      <div class="table">
        <div class="plinth"></div>
        <div class="strobe"></div>
        <div class="platter"><div class="mat"></div><div class="record size12"><div class="grooves"></div><div class="rlabel"></div><div class="spindle"></div></div></div>
        <div class="arm-base"><div class="arm"><div class="headshell"></div></div></div>
        <div class="speed"><button data-rpm="33">33</button><button data-rpm="45">45</button><button data-rpm="78">78</button></div>
        <button class="startstop" title="Start / stop">START<br>STOP</button>
        <div class="pitch"><span>+8</span><input type="range" min="-8" max="8" step="0.1" value="0" orient="vertical"><span>-8</span><b class="readout">0.0%</b></div>
        <div class="drop-hint">DROP HERE</div>
      </div>
    </section>`);
    host.append(this.el);
    this.record = this.el.querySelector('.record')!; this.arm = this.el.querySelector('.arm')!; this.readout = this.el.querySelector('.readout')!;
    this.titleEl = this.el.querySelector('.deck-title')!; this.timeEl = this.el.querySelector('.deck-time')!; this.pitchIn = this.el.querySelector('input')!;
    this.el.querySelector('.startstop')!.addEventListener('click', () => this.toggle());
    this.el.querySelector('.speed')!.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b) this.setRpm(Number(b.dataset.rpm) as 33 | 45 | 78); });
    this.pitchIn.addEventListener('input', () => { this.pitch = Number(this.pitchIn.value); this.applyRate(); });
    this.pitchIn.addEventListener('dblclick', () => { this.pitchIn.value = '0'; this.pitch = 0; this.applyRate(); });
    this.wireScratch(); this.wireArm();
    player.onState(s => { if (s === 'playing' && !this.running) { this.running = true; this.targetSpeed = this.rpmSel; } if ((s === 'paused' || s === 'ended' || s === 'idle') && this.running && !this.braking) { this.running = false; this.targetSpeed = 0; } this.el.classList.toggle('live', s === 'playing'); if (s === 'playing' && this.side === 'A') surface.start(); });
    this.setArm(ARM_REST);
    requestAnimationFrame(t => this.frame(t));
  }
  private braking = false;
  load(t: Track, autoplay = true, start = 0) {
    this.track = t; this.titleEl.textContent = `${t.artist} – ${t.title}`;
    this.record.className = `record size${t.size}`; this.record.querySelector<HTMLElement>('.rlabel')!.style.backgroundImage = `url(${thumb(t.id, 'hq')})`;
    this.el.dataset.kind = t.kind; this.setRpm(t.rpm, false);
    this.onLoad?.(t);
    if (autoplay) { needleDrop(); this.player.play(t.id, start); this.targetSpeed = this.rpmSel; this.running = true; this.setArm(ARM_IN); }
    else { this.player.cue(t.id); }
  }
  setRpm(r: 33 | 45 | 78, apply = true) { this.rpmSel = r; for (const b of this.el.querySelectorAll<HTMLElement>('.speed button')) b.classList.toggle('on', Number(b.dataset.rpm) === r); if (this.running) this.targetSpeed = r; if (apply) this.applyRate(); }
  private applyRate() {
    if (!this.track) return;
    const base = this.rpmSel / this.track.rpm; const r = base * (1 + this.pitch / 100);
    this.player.setRate(r); this.readout.textContent = `${this.pitch >= 0 ? '+' : ''}${this.pitch.toFixed(1)}%`;
    this.readout.title = `rate ×${r.toFixed(3)}`;
  }
  toggle() { if (!this.track) return; this.running ? this.stop() : this.start(); }
  start() { if (!this.track) return; this.running = true; this.braking = false; this.targetSpeed = this.rpmSel; this.player.setRate(0.25); this.player.resume(); if (this.player.state === 'idle' || this.player.state === 'cued') this.player.play(this.track.id); this.setArm(this.armForProgress()); }
  stop() { this.running = false; this.braking = true; this.targetSpeed = 0; }
  isRunning() { return this.running; }
  private armForProgress() { const d = this.player.duration() || this.track?.seconds || 1; return ARM_IN + (ARM_OUT - ARM_IN) * clamp(this.player.time() / d, 0, 1); }
  private setArm(deg: number) { this.arm.style.transform = `rotate(${deg}deg)`; }
  private frame(t: number) {
    requestAnimationFrame(tt => this.frame(tt));
    const dt = Math.min(0.05, (t - this.lastT) / 1000); this.lastT = t;
    const tau = this.targetSpeed > this.speed ? 0.25 : 0.55; // spin-up fast, brake slower
    this.speed += (this.targetSpeed - this.speed) * (1 - Math.exp(-dt / tau));
    if (!this.scratching) this.angle = (this.angle + this.speed * 6 * dt * (1 + this.pitch / 100)) % 360;
    this.record.style.transform = `rotate(${this.angle}deg)`;
    // follow the brake/spin-up with the real playback rate in the steps YouTube allows
    if (this.track) {
      const frac = this.targetSpeed ? this.speed / this.targetSpeed : this.speed / this.rpmSel;
      const want = this.targetSpeed === 0 ? (frac < 0.06 ? 0 : frac < 0.3 ? 0.25 : frac < 0.6 ? 0.5 : 0.75) : (frac < 0.5 ? 0.5 : frac < 0.9 ? 0.75 : 1);
      if (want !== this.lastRateStep) {
        this.lastRateStep = want;
        if (want === 0) { this.player.pause(); this.braking = false; this.setArm(this.armForProgress()); surface.stop(); }
        else { const base = (this.rpmSel / this.track.rpm) * (1 + this.pitch / 100); this.player.setRate(want === 1 ? base : Math.min(base, want)); }
      }
    }
    if (this.running && !this.armDrag && this.player.state === 'playing') { this.setArm(this.armForProgress()); this.timeEl.textContent = `${fmtTime(this.player.time())} / ${fmtTime(this.player.duration() || this.track?.seconds || 0)}`; }
  }
  private wireScratch() {
    const rec = this.record; let last = 0; let pid = -1;
    const ang = (e: PointerEvent) => { const r = rec.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
    rec.addEventListener('pointerdown', e => { if (!this.track) return; this.scratching = true; pid = e.pointerId; last = ang(e); rec.setPointerCapture(pid); rec.classList.add('hand'); });
    rec.addEventListener('pointermove', e => {
      if (!this.scratching || e.pointerId !== pid) return; const a = ang(e); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = a;
      this.angle = (this.angle + d + 360) % 360; const secPerRev = 60 / this.rpmSel; this.player.seek(this.player.time() + d / 360 * secPerRev);
    });
    const up = () => { if (!this.scratching) return; this.scratching = false; rec.classList.remove('hand'); };
    rec.addEventListener('pointerup', up); rec.addEventListener('pointercancel', up);
  }
  private wireArm() {
    const base = this.el.querySelector<HTMLElement>('.arm-base')!;
    const deg = (e: PointerEvent) => { const r = base.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height * 0.18; return Math.atan2(e.clientX - cx, cy - e.clientY) * -180 / Math.PI * -1; };
    let pid = -1, startDeg = 0, startArm = 0;
    base.addEventListener('pointerdown', e => { if (!this.track) return; this.armDrag = true; pid = e.pointerId; base.setPointerCapture(pid); startDeg = deg(e); startArm = this.currentArm(); });
    base.addEventListener('pointermove', e => { if (!this.armDrag || e.pointerId !== pid) return; const a = clamp(startArm + (deg(e) - startDeg), ARM_REST, ARM_OUT); this.setArm(a); });
    const up = (e: PointerEvent) => {
      if (!this.armDrag || e.pointerId !== pid) return; this.armDrag = false; const a = this.currentArm();
      if (a < ARM_IN - 6) { this.stop(); return; }
      const frac = clamp((a - ARM_IN) / (ARM_OUT - ARM_IN), 0, 0.98); const d = this.player.duration() || this.track!.seconds;
      needleDrop(); this.player.seek(frac * d); if (!this.running) this.start();
    };
    base.addEventListener('pointerup', up); base.addEventListener('pointercancel', up);
  }
  private currentArm() { const m = /rotate\(([-\d.]+)deg\)/.exec(this.arm.style.transform); return m ? Number(m[1]) : ARM_REST; }
}
