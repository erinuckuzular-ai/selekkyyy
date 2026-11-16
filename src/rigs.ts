// Soundsystems. Honest note: the tune itself sounds the same on every rig (it comes from YouTube).
// What changes: the stack on screen, the meter, the accent colour, the default surface-noise level and the toys you get.
export interface Rig { id: string; name: string; line: string; accent: string; accent2: string; noise: number; toys: ('siren' | 'horn' | 'pullup')[]; stack: string; meter: 'bars' | 'scope' | 'leds' }
export const rigs: Rig[] = [
  { id: 'bedroom', name: 'Bedroom', line: 'Two bookshelf speakers, one lamp, door shut.', accent: '#05d9e8', accent2: '#ff2a6d', noise: 0.3, toys: ['pullup'], meter: 'leds',
    stack: `<div class="spk book"><i class="tw"></i><i class="wf"></i></div><div class="spk book"><i class="tw"></i><i class="wf"></i></div>` },
  { id: 'dub', name: 'Dub rig', line: 'Four scoops a side. The bass you feel in your teeth.', accent: '#ffe600', accent2: '#ff2a6d', noise: 0.5, toys: ['siren', 'horn', 'pullup'], meter: 'bars',
    stack: `<div class="col"><div class="spk horn"></div><div class="spk mid"><i class="wf"></i><i class="wf"></i></div><div class="spk scoop"></div><div class="spk scoop"></div></div><div class="col"><div class="spk horn"></div><div class="spk mid"><i class="wf"></i><i class="wf"></i></div><div class="spk scoop"></div><div class="spk scoop"></div></div>` },
  { id: 'arcade', name: 'Arcade', line: 'A cabinet with the coin door jammed open.', accent: '#ff2a6d', accent2: '#05d9e8', noise: 0.15, toys: ['horn'], meter: 'scope',
    stack: `<div class="cab"><div class="marquee">INSERT COIN</div><div class="crt"></div><div class="panel"><i></i><i></i><i></i></div></div>` },
  { id: 'warehouse', name: 'Warehouse', line: 'Tops, subs, a strobe someone forgot to switch off.', accent: '#d300c5', accent2: '#ffe600', noise: 0.1, toys: ['siren', 'pullup'], meter: 'bars',
    stack: `<div class="col"><div class="spk top"><i class="wf"></i></div><div class="spk top"><i class="wf"></i></div><div class="spk sub"></div><div class="spk sub"></div></div><div class="col"><div class="spk top"><i class="wf"></i></div><div class="spk top"><i class="wf"></i></div><div class="spk sub"></div><div class="spk sub"></div></div>` },
];
export const rigById = (id: string) => rigs.find(r => r.id === id) ?? rigs[0];
