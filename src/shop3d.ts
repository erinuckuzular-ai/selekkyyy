// The walk-in shop: a warm wooden room with seven crates, a counter and a turntable.
import * as THREE from 'three';
import { crates, tracksIn, type Crate } from './catalogue';

export interface ShopHandlers { onCrate(slug: string): void; onDeck(): void; onHover(text: { title: string; sub: string } | null, x: number, y: number): void }

const ROOM = { w: 16, d: 12, h: 3.6 };
const EYE = 1.6;

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4; return t;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function woodTexture(base = '#8a5a30', dark = '#5a361a', planks = 6) {
  return canvasTex(512, 512, c => {
    c.fillStyle = base; c.fillRect(0, 0, 512, 512);
    const ph = 512 / planks;
    for (let p = 0; p < planks; p++) {
      const y = p * ph; const off = (p % 2) * 200;
      c.fillStyle = `rgba(0,0,0,${rnd(0, 0.08)})`; c.fillRect(0, y, 512, ph);
      for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(40,20,5,${rnd(0.05, 0.25)})`; c.lineWidth = rnd(0.5, 2); c.beginPath(); const yy = y + rnd(2, ph - 2); c.moveTo(0, yy); c.bezierCurveTo(170, yy + rnd(-6, 6), 340, yy + rnd(-6, 6), 512, yy); c.stroke(); }
      c.fillStyle = dark; c.fillRect(0, y, 512, 2); c.fillRect((off + 256) % 512, y, 2, ph);
    }
  });
}
function plasterTexture() {
  return canvasTex(256, 256, c => { c.fillStyle = '#e9dcc3'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(90,60,30,${rnd(0.02, 0.08)})`; c.fillRect(rnd(0, 256), rnd(0, 256), 1.5, 1.5); } }, [4, 2]);
}
function signTexture(title: string, sub: string, color: string) {
  return canvasTex(512, 192, c => {
    c.fillStyle = '#f3e9d8'; c.fillRect(0, 0, 512, 192);
    c.fillStyle = color; c.fillRect(0, 0, 512, 14); c.fillRect(0, 178, 512, 14);
    c.fillStyle = '#241a12'; c.font = 'bold 64px Fraunces, Georgia, serif'; c.textAlign = 'center'; c.fillText(title, 256, 96);
    c.font = '26px "DM Sans", system-ui, sans-serif'; c.fillStyle = '#6b5a48'; c.fillText(sub, 256, 146);
  });
}
function posterTexture(lines: string[], bg: string, fg: string) {
  return canvasTex(384, 512, c => {
    c.fillStyle = bg; c.fillRect(0, 0, 384, 512);
    c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(16, 16, 352, 480);
    c.fillStyle = fg; c.textAlign = 'center'; c.font = 'italic 900 54px Fraunces, Georgia, serif';
    lines.forEach((l, i) => c.fillText(l, 192, 180 + i * 70));
    c.beginPath(); c.arc(192, 400, 50, 0, Math.PI * 2); c.fill();
    c.fillStyle = bg; c.beginPath(); c.arc(192, 400, 14, 0, Math.PI * 2); c.fill();
  });
}
function sleeveTexture(color: string, n: number) {
  return canvasTex(128, 128, c => {
    const h = new THREE.Color(color); h.offsetHSL(rnd(-0.06, 0.06), rnd(-0.1, 0.1), rnd(-0.15, 0.2));
    c.fillStyle = `#${h.getHexString()}`; c.fillRect(0, 0, 128, 128);
    c.fillStyle = `rgba(255,255,255,${rnd(0.15, 0.5)})`;
    if (n % 3 === 0) c.fillRect(16, 16, 96, 96); else if (n % 3 === 1) { c.beginPath(); c.arc(64, 64, 40, 0, Math.PI * 2); c.fill(); } else c.fillRect(0, 48, 128, 32);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.font = 'bold 12px sans-serif'; c.fillText('SELEKKYYY', 8, 120);
  });
}

interface Hotspot { mesh: THREE.Object3D; slug: string | 'deck'; crate?: Crate; focus: THREE.Vector3; look: THREE.Vector3; glow: THREE.PointLight }

export function createShop(canvas: HTMLCanvasElement, handlers: ShopHandlers) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a110b');
  scene.fog = new THREE.Fog('#1a110b', 14, 30);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
  camera.position.set(0, EYE, ROOM.d / 2 - 1.2);
  let yaw = 0, pitch = 0; // camera looks down -z, into the room

  // Room
  const floorTex = woodTexture('#7a4a26', '#4a2c14', 8); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.65, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h; scene.add(ceiling);
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95 });
  const walls: [number, number, number, number, number][] = [
    [0, ROOM.h / 2, -ROOM.d / 2, 0, ROOM.w], [0, ROOM.h / 2, ROOM.d / 2, Math.PI, ROOM.w],
    [-ROOM.w / 2, ROOM.h / 2, 0, Math.PI / 2, ROOM.d], [ROOM.w / 2, ROOM.h / 2, 0, -Math.PI / 2, ROOM.d],
  ];
  for (const [x, y, z, ry, w] of walls) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); }
  // Skirting + wainscot
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture('#6b3f22', '#3d2211', 4), roughness: 0.6 });
  for (const [x, y, z, ry, w] of walls) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.04), woodMat); m.position.set(x, 0.45, z); m.rotation.y = ry; m.translateZ(0.02); scene.add(m); }

  // Lights
  scene.add(new THREE.HemisphereLight('#f7e3c0', '#3a2414', 0.55));
  const pendants: THREE.Vector3[] = [new THREE.Vector3(-4, 2.9, -2), new THREE.Vector3(4, 2.9, -2), new THREE.Vector3(0, 2.9, 2.5), new THREE.Vector3(-4.5, 2.9, 3), new THREE.Vector3(4.5, 2.9, 3)];
  const shadeGeo = new THREE.ConeGeometry(0.28, 0.24, 24, 1, true);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#2b1a10', side: THREE.DoubleSide, emissive: '#ffb562', emissiveIntensity: 0.25 });
  for (const p of pendants) {
    const l = new THREE.PointLight('#ffcf8a', 22, 11, 2); l.position.copy(p).add(new THREE.Vector3(0, -0.15, 0)); scene.add(l);
    const shade = new THREE.Mesh(shadeGeo, shadeMat); shade.position.copy(p); shade.rotation.x = Math.PI; scene.add(shade);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ROOM.h - p.y + 0.1), new THREE.MeshBasicMaterial({ color: '#111' })); cord.position.set(p.x, (ROOM.h + p.y) / 2, p.z); scene.add(cord);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#fff1d0' })); bulb.position.copy(p).add(new THREE.Vector3(0, -0.1, 0)); scene.add(bulb);
  }

  // Posters
  const poster = (lines: string[], bg: string, fg: string, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.47), new THREE.MeshStandardMaterial({ map: posterTexture(lines, bg, fg), roughness: 0.9 }));
    m.position.set(x, 2.15, z); m.rotation.y = ry; scene.add(m);
  };
  poster(['SELEK', 'KYYY'], '#d4a03a', '#241a12', -2.2, -ROOM.d / 2 + 0.03, 0);
  poster(['FREE', 'TUNES', 'ALWAYS'], '#8c2f1f', '#f3e9d8', 2.2, -ROOM.d / 2 + 0.03, 0);
  poster(['DIG', 'DEEP'], '#1f7a6d', '#f3e9d8', ROOM.w / 2 - 0.03, 4.2, -Math.PI / 2);
  poster(['SOUL', 'JAZZ', 'DUB'], '#2f5d8a', '#f3e9d8', -ROOM.w / 2 + 0.03, 4.2, Math.PI / 2);

  // Crates
  const hotspots: Hotspot[] = [];
  const tableMat = new THREE.MeshStandardMaterial({ map: woodTexture('#5a3418', '#2e1a0c', 3), roughness: 0.7 });
  const crateMat = new THREE.MeshStandardMaterial({ map: woodTexture('#b07a44', '#7a4a26', 2), roughness: 0.8 });
  const layout: [number, number, number][] = [ // x, z, rotation facing
    [-6.9, -2.5, Math.PI / 2], [-6.9, 1.5, Math.PI / 2], [-3.2, -5.2, 0], [1.2, -5.2, 0], [6.9, -2.5, -Math.PI / 2], [6.9, 1.5, -Math.PI / 2], [-6.9, 4.6, Math.PI / 2],
  ];
  crates.forEach((crate, i) => {
    const [x, z, ry] = layout[i];
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.1), tableMat); table.position.y = 0.78; g.add(table);
    for (const [lx, lz] of [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.08), tableMat); leg.position.set(lx, 0.38, lz); g.add(leg); }
    const box = new THREE.Group(); box.position.y = 0.82;
    const sides: [number, number, number, number, number, number][] = [[0, 0.22, -0.4, 1.3, 0.44, 0.03], [0, 0.22, 0.4, 1.3, 0.44, 0.03], [-0.65, 0.22, 0, 0.03, 0.44, 0.8], [0.65, 0.22, 0, 0.03, 0.44, 0.8], [0, 0.015, 0, 1.3, 0.03, 0.8]];
    for (const [sx, sy, sz, w, h, d] of sides) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), crateMat); m.position.set(sx, sy, sz); box.add(m); }
    const n = Math.min(tracksIn(crate.slug).length, 34);
    const recGeo = new THREE.BoxGeometry(0.03, 0.62, 0.62);
    for (let r = 0; r < n; r++) {
      const mat = new THREE.MeshStandardMaterial({ map: sleeveTexture(crate.color, r), roughness: 0.6 });
      const rec = new THREE.Mesh(recGeo, mat); rec.position.set(-0.58 + r * (1.16 / Math.max(n - 1, 1)), 0.32 + rnd(-0.01, 0.03), rnd(-0.02, 0.02)); rec.rotation.z = rnd(-0.12, 0.05); rec.rotation.y = Math.PI / 2 + rnd(-0.03, 0.03);
      box.add(rec);
    }
    g.add(box);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshStandardMaterial({ map: signTexture(crate.name, `${tracksIn(crate.slug).length} records`, crate.color), roughness: 0.9 }));
    sign.position.set(0, 1.85, -0.52); g.add(sign);
    const glow = new THREE.PointLight(crate.color, 0, 3, 2); glow.position.set(0, 1.4, 0.3); g.add(glow);
    scene.add(g);
    const front = new THREE.Vector3(0, 0, 2.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, EYE, z));
    hotspots.push({ mesh: g, slug: crate.slug, crate, focus: front, look: new THREE.Vector3(x, 1.1, z), glow });
  });

  // Counter + turntable (the deck)
  const counter = new THREE.Group(); counter.position.set(4.2, 0, 4.6);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1), tableMat); top.position.y = 0.95; counter.add(top);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 0.9), woodMat); body.position.y = 0.45; counter.add(body);
  const deck = new THREE.Group(); deck.position.set(0.3, 1.0, 0);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.4 })); plinth.position.y = 0.04; deck.add(plinth);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 48), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3, metalness: 0.4 })); platter.position.set(-0.1, 0.09, 0); deck.add(platter);
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.006, 48), new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.25, metalness: 0.2 })); vinyl.position.set(-0.1, 0.105, 0); deck.add(vinyl);
  const vlabel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.007, 32), new THREE.MeshStandardMaterial({ color: '#d4a03a' })); vlabel.position.set(-0.1, 0.106, 0); deck.add(vlabel);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.36), new THREE.MeshStandardMaterial({ color: '#cfc3b0', metalness: 0.6, roughness: 0.3 })); arm.position.set(0.3, 0.16, -0.1); arm.rotation.y = 0.5; deck.add(arm);
  counter.add(deck); scene.add(counter);
  const deckGlow = new THREE.PointLight('#ffb562', 0, 3, 2); deckGlow.position.set(0.3, 1.6, 0); counter.add(deckGlow);
  hotspots.push({ mesh: counter, slug: 'deck', focus: new THREE.Vector3(4.2, EYE, 6.3), look: new THREE.Vector3(4.5, 1.05, 4.6), glow: deckGlow });

  // A plant and a rug for warmth
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: '#8c2f1f', roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0); scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.75, 48), new THREE.MeshStandardMaterial({ color: '#d4a03a', roughness: 1 })); rug2.rotation.x = -Math.PI / 2; rug2.position.set(0, 0.006, 0); scene.add(rug2);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16), new THREE.MeshStandardMaterial({ color: '#b5613b' })); pot.position.set(-4.5, 0.2, 4.8); scene.add(pot);
  for (let i = 0; i < 9; i++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, rnd(0.7, 1.2), 6), new THREE.MeshStandardMaterial({ color: '#3f7a3a' })); leaf.position.set(-4.5 + rnd(-0.1, 0.1), 0.8, 4.8 + rnd(-0.1, 0.1)); leaf.rotation.set(rnd(-0.5, 0.5), rnd(0, 6), rnd(-0.5, 0.5)); scene.add(leaf); }

  // Interaction
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: Hotspot | null = null;
  const pickables = hotspots.map(h => h.mesh);
  function pick(x: number, y: number): Hotspot | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object; while (o && !pickables.includes(o)) o = o.parent;
    return hotspots.find(h => h.mesh === o) ?? null;
  }

  const keys = new Set<string>();
  let dragging = false, moved = 0, lastX = 0, lastY = 0, pinchDist = 0;
  let glide: { from: THREE.Vector3; to: THREE.Vector3; fy: number; ty: number; fp: number; tp: number; t: number } | null = null;
  const vel = new THREE.Vector3();
  const active = { on: false };

  const anglesTo = (target: THREE.Vector3, from: THREE.Vector3) => { const d = target.clone().sub(from); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
  const wrap = (a: number, ref: number) => { while (a - ref > Math.PI) a -= 2 * Math.PI; while (a - ref < -Math.PI) a += 2 * Math.PI; return a; };
  function glideTo(pos: THREE.Vector3, look: THREE.Vector3) {
    const a = anglesTo(look, pos);
    glide = { from: camera.position.clone(), to: pos.clone(), fy: yaw, ty: wrap(a.yaw, yaw), fp: pitch, tp: a.pitch, t: 0 };
  }

  canvas.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (dragging && (e.buttons & 1 || e.pointerType === 'touch')) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.0045; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0035, -0.9, 0.9); glide = null;
    }
    lastX = e.clientX; lastY = e.clientY;
    if (e.pointerType !== 'touch') {
      const h = pick(e.clientX, e.clientY);
      if (h !== hovered) { hovered = h; canvas.style.cursor = h ? 'pointer' : 'grab'; }
      if (h) handlers.onHover(h.slug === 'deck' ? { title: 'The deck', sub: 'What is playing, or start the radio' } : { title: h.crate!.name, sub: h.crate!.blurb }, e.clientX, e.clientY); else handlers.onHover(null, 0, 0);
    }
  });
  canvas.addEventListener('pointerup', e => {
    dragging = false; handlers.onHover(null, 0, 0); hovered = null;
    if (moved < 8) { const h = pick(e.clientX, e.clientY); if (h) { focus(h); h.slug === 'deck' ? handlers.onDeck() : handlers.onCrate(h.slug); } }
  });
  canvas.addEventListener('pointerleave', () => { dragging = false; handlers.onHover(null, 0, 0); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); vel.z -= Math.sign(e.deltaY) * 0.6; glide = null; }, { passive: false });
  canvas.addEventListener('touchstart', e => { if (e.touches.length === 2) pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  canvas.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); vel.z -= (d - pinchDist) * 0.02; pinchDist = d; glide = null; } }, { passive: true });
  window.addEventListener('keydown', e => { if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return; keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  function focus(h: Hotspot) { glideTo(h.focus, h.look); }

  // Render loop
  const clock = new THREE.Clock();
  let raf = 0;
  function resize() { const w = canvas.clientWidth, hgt = canvas.clientHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(hgt * renderer.getPixelRatio())) { renderer.setSize(w, hgt, false); camera.aspect = w / hgt; camera.updateProjectionMatrix(); } }
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!active.on) return;
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    if (glide) {
      glide.t = Math.min(1, glide.t + dt / 1.1); const k = 1 - Math.pow(1 - glide.t, 3);
      camera.position.lerpVectors(glide.from, glide.to, k); yaw = glide.fy + (glide.ty - glide.fy) * k; pitch = glide.fp + (glide.tp - glide.fp) * k;
      if (glide.t >= 1) glide = null;
    } else {
      const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      vel.z -= f * 9 * dt; vel.x += s * 9 * dt;
      vel.multiplyScalar(Math.pow(0.02, dt));
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      camera.position.addScaledVector(fwd, -vel.z * dt).addScaledVector(right, vel.x * dt);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM.w / 2 + 1.6, ROOM.w / 2 - 1.6);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM.d / 2 + 1.6, ROOM.d / 2 - 0.6);
      camera.position.y = EYE;
    }
    camera.rotation.set(0, 0, 0); camera.rotateY(yaw); camera.rotateX(pitch);
    vinyl.rotation.y += dt * (spinning ? 3.5 : 0); vlabel.rotation.y = vinyl.rotation.y;
    const tt = clock.elapsedTime; for (const h of hotspots) h.glow.intensity = h.slug === litSlug ? 6 + Math.sin(tt * 3) * 1.5 : 0;
    renderer.render(scene, camera);
  }
  frame();
  let spinning = false, litSlug: string | null = null;

  return {
    setActive(on: boolean) { active.on = on; if (on) { clock.getDelta(); resize(); } },
    focusCrate(slug: string) { const h = hotspots.find(h => h.slug === slug); if (h) focus(h); },
    setNowPlaying(slug: string | null, isSpinning: boolean) { litSlug = slug; spinning = isSpinning; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
