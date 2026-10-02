// ── materials: a 4-step toon ramp over a painted grime map ─────────
const RAMP = (() => { const d = new Uint8Array([52, 52, 52, 255, 112, 112, 112, 255, 172, 172, 172, 255, 222, 222, 222, 255]), t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const canvasTex = (w, h, draw, rep) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const GRIME = canvasTex(256, 256, (c, w, h) => {
  const r = rng(31); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,70,50,${r() * 0.07})`; c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
  c.strokeStyle = 'rgba(70,55,40,.16)'; for (let i = 0; i < 40; i++) { c.lineWidth = 0.6 + r(); c.beginPath(); const x = r() * w, y = r() * h; c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 6); c.stroke(); }
  c.strokeStyle = 'rgba(60,45,30,.22)'; c.lineWidth = 1.2; [64, 128, 192].forEach(v => { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, h); c.stroke(); });
}, true);
const HAZARD = canvasTex(64, 64, (c) => { c.fillStyle = '#E7A73A'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#23201c'; for (let k = -64; k < 128; k += 32) { c.beginPath(); c.moveTo(k, 64); c.lineTo(k + 16, 64); c.lineTo(k + 80, 0); c.lineTo(k + 64, 0); c.closePath(); c.fill(); } }, true);
const FLAME = canvasTex(8, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(90,150,255,0)'); g.addColorStop(0.6, 'rgba(140,200,255,.55)'); g.addColorStop(1, 'rgba(235,248,255,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const COL = { cream: 0xEADAB2, cream2: 0xD2BC8F, teal: 0x4E7F86, tealD: 0x35585E, mustard: 0xE7A73A, olive: 0x7A8A50, rust: 0xB45A36, rustD: 0x6E2E22, red: 0x9B3F2F, dark: 0x45484D, darker: 0x2C2E32, glass: 0x1E2F3E, navy: 0x2C3E5C, white: 0xE8E6DF, frost: 0xBFE3F2 };
const MATS = {};
const mat = (c, map = true) => MATS[c + '' + map] ??= new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP, map: map ? GRIME : null });
const hazardMat = () => MATS.hazard ??= new THREE.MeshToonMaterial({ gradientMap: RAMP, map: HAZARD });
const EDGE = new THREE.MeshBasicMaterial({ color: 0x15110d, side: THREE.BackSide });
const glowMat = c => MATS['e' + c] ??= new THREE.MeshBasicMaterial({ color: c });
function chamfer(w, h, d, bev = 0.06) {
  const x = w / 2 - bev, y = h / 2 - bev, s = new THREE.Shape(); s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  g.translate(0, 0, -(d - 2 * bev) / 2); g.computeVertexNormals(); return g;
}
function part(parent, geo, color, [x, y, z] = [0, 0, 0], { edge = 0.045, dims, rot } = {}) {
  geo.computeBoundingBox(); const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z); dims ??= [sz.x, sz.y, sz.z];
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color) : color); m.position.set(x + c.x, y + c.y, z + c.z); rot && m.rotation.set(...rot);
  if (edge && dims) { const o = new THREE.Mesh(geo, EDGE); o.scale.set(...dims.map(v => (v + 2 * edge) / v)); m.add(o); }
  parent.add(m); return m;
}
const box = (p, w, h, d, c, at, o = {}) => part(p, chamfer(w, h, d, Math.min(0.07, Math.min(w, h, d) * 0.2)), c, at, { dims: [w, h, d], ...o });
const tube = (p, r0, r1, len, c, at, o = {}) => part(p, new THREE.CylinderGeometry(r0, r1, len, 14), c, at, { dims: [Math.max(r0, r1) * 2, len, Math.max(r0, r1) * 2], ...o });
const along = [0, 0, Math.PI / 2];
const ring = (p, r, t, c, at, rot = [0, Math.PI / 2, 0]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 28), mat(c)); m.position.set(...at); m.rotation.set(...rot); p.add(m); return m; };
function profile(pts, depth, bev = 0.05) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 }); g.translate(0, 0, -(depth - 2 * bev) / 2); g.computeVertexNormals(); return g; }
function light(p, at, c = 0xFFB54A, size = 0.1, blink) { const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.6, size * 0.6), glowMat(c)); m.position.set(...at); p.add(m); const g = glowSprite(c, size * 7); g.position.set(...at); g.material.opacity = 0.7; p.add(g); if (blink) g.userData.blink = blink; return g; }
function glowAt(p, at, c, s) { const g = glowSprite(c, s); g.position.set(...at); g.material.opacity = 0; g.userData.fireGlow = true; p.add(g); return g; }
// an exhaust plume: bright at the nozzle, gone at the tip, only while the drive burns
function flame(p, at, r, len) { const geo = new THREE.ConeGeometry(r, len, 14, 1, true); geo.translate(0, len / 2, 0); geo.rotateZ(Math.PI / 2); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: FLAME, color: 0xBFE0FF, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(...at); m.userData.flame = true; m.visible = false; p.add(m); return m; }
function nozzle(p, at, r0, r1, len, glow = 1) { tube(p, r1, r0, len, COL.darker, at, { rot: along }); const tip = [at[0] - len / 2 - 0.02, at[1], at[2]]; const d = new THREE.Mesh(new THREE.CircleGeometry(r1 * 0.8, 16), glowMat(0x1B2430)); d.position.set(...tip); d.rotation.y = -Math.PI / 2; p.add(d); glowAt(p, tip, 0x9CD3FF, r1 * 3.2 * glow); flame(p, tip, r1 * 0.85, r1 * 5); }
// stencils on the hull, lit like the paint under them
function decal(p, lines, at, w, side = 1, color = '#2E4F57') {
  const t = canvasTex(512, 128, c => { c.fillStyle = color; c.textBaseline = 'middle'; c.font = '700 60px "IBM Plex Mono", ui-monospace, monospace'; c.fillText(lines[0], 6, lines[1] ? 44 : 64); if (lines[1]) { c.font = '400 30px "IBM Plex Mono", ui-monospace, monospace'; c.fillText(lines[1], 8, 102); } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshToonMaterial({ map: t, gradientMap: RAMP, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.position.set(...at); if (side < 0) m.rotation.y = Math.PI; p.add(m); return m;
}
// one pass over a model: blinking lights, burning drives, spinning dishes
function liven(g, t, dt, fire = 0) {
  g.traverse(o => {
    const u = o.userData;
    if (u.blink) o.material.opacity = Math.sin((t / u.blink + (u.phase ?? 0)) * Math.PI * 2) > 0.2 ? 0.95 : 0.05;
    else if (u.fireGlow) o.material.opacity = fire * (0.75 + 0.25 * Math.sin(t * 40 + o.id));
    else if (u.flame) { o.visible = fire > 0.02; o.scale.set(fire * (0.85 + 0.15 * Math.sin(t * 31 + o.id)), 1 + 0.08 * Math.sin(t * 23 + o.id), 1 + 0.08 * Math.sin(t * 23 + o.id)); o.material.opacity = Math.min(1, fire * 1.2); }
    else if (u.pulse) o.material.opacity = 0.55 + 0.35 * Math.sin(t * 3);
    if (u.spin) o.rotation.y += u.spin * dt;
  });
}

// ── modules: one builder per design, plus an empty mount ──────────
const MODS = {
  'reactor.mk1': g => { box(g, 1.2, 0.14, 1.0, COL.darker, [0, 0.07, 0]); tube(g, 0.36, 0.36, 1.0, COL.cream, [0, 0.52, 0], { rot: along }); [-0.3, 0.3].forEach(x => tube(g, 0.39, 0.39, 0.1, COL.mustard, [x, 0.52, 0], { rot: along })); tube(g, 0.2, 0.2, 0.08, COL.darker, [0.54, 0.52, 0], { rot: along, edge: 0 }); tube(g, 0.05, 0.05, 0.5, COL.mustard, [-0.45, 0.3, 0.42], { edge: 0 }); light(g, [0, 0.52, 0.37], 0xFFB54A, 0.12); },
  'reactor.mk2': g => { box(g, 1.5, 0.16, 1.2, COL.darker, [0, 0.08, 0]); tube(g, 0.5, 0.5, 1.3, COL.teal, [0, 0.66, 0], { rot: along }); [-0.42, 0, 0.42].forEach(x => tube(g, 0.54, 0.54, 0.11, COL.mustard, [x, 0.66, 0], { rot: along })); [-1, 1].forEach(s => [-0.3, 0, 0.3].forEach(x => box(g, 0.16, 0.5, 0.36, COL.cream, [x, 0.6, s * 0.72]))); const core = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 32), glowMat(0xFF9A3C)); core.rotation.y = Math.PI / 2; core.position.set(0.21, 0.66, 0); g.add(core); light(g, [0.21, 0.66, 0.55], 0xFF9A3C, 0.16).userData.pulse = true; },
  'cruise.mk1': g => { box(g, 1.6, 1.6, 1.7, COL.dark, [0, 0, 0]); box(g, 0.3, 1.66, 1.76, COL.rust, [0.45, 0, 0]); [-1, 1].forEach(s => { box(g, 0.9, 0.7, 0.05, COL.teal, [-0.2, 0.1, s * 0.86], { edge: 0 }); box(g, 0.5, 0.14, 0.05, COL.darker, [-0.2, -0.5, s * 0.86], { edge: 0 }); }); [-0.45, 0.45].forEach(z => nozzle(g, [-1.05, 0, z], 0.3, 0.42, 0.55)); light(g, [0.2, 0.84, 0.6]); },
  'cruise.mk2': g => { box(g, 1.9, 1.8, 2.0, COL.tealD, [-0.1, 0, 0]); box(g, 0.34, 1.86, 2.06, COL.red, [0.5, 0, 0]); tube(g, 0.95, 0.95, 0.16, COL.mustard, [-0.75, 0, 0], { rot: along }); [-1, 1].forEach(s => [-0.4, 0, 0.4].forEach(y => box(g, 0.9, 0.06, 0.3, COL.cream, [-0.2, y, s * 1.12], { edge: 0.02 }))); [[-0.5, 0.35], [0.5, 0.35], [0, -0.45]].forEach(([z, y]) => nozzle(g, [-1.35, y, z], 0.34, 0.5, 0.7, 1.2)); light(g, [0.2, 0.94, 0.7]); light(g, [0.2, 0.94, -0.7]); },
  'maneuver.mk1': g => [-1, 1].forEach(s => { box(g, 0.3, 0.14, 0.3, COL.darker, [0, 0, s * 0.98]); tube(g, 0.2, 0.2, 0.8, COL.cream, [0, 0, s * 1.2], { rot: along }); nozzle(g, [-0.48, 0, s * 1.2], 0.08, 0.12, 0.16, 0.8); }),
  'maneuver.mk2': g => [-1, 1].forEach(s => { box(g, 0.5, 0.16, 0.34, COL.mustard, [0, 0, s * 1.0]); tube(g, 0.28, 0.28, 1.15, COL.teal, [0, 0, s * 1.3], { rot: along }); ring(g, 0.3, 0.04, COL.mustard, [0.2, 0, s * 1.3]); nozzle(g, [-0.66, 0, s * 1.3], 0.1, 0.15, 0.18, 0.9); tube(g, 0.1, 0.15, 0.18, COL.darker, [0.66, 0, s * 1.3], { rot: [0, 0, -Math.PI / 2] }); light(g, [0.3, 0.3, s * 1.3], 0xFFB54A, 0.08); }),
  'cargo.mk1': g => { box(g, 1.6, 1.7, 1.8, COL.cream, [0, 0, 0]); [-1, 1].forEach(s => { box(g, 1.1, 1.0, 0.06, COL.olive, [0, -0.05, s * 0.9], { edge: 0.02 }); box(g, 0.1, 0.3, 0.06, COL.mustard, [0.4, -0.05, s * 0.94], { edge: 0 }); [-0.3, 0.2].forEach(y => box(g, 1.0, 0.03, 0.02, COL.darker, [0, y, s * 0.935], { edge: 0 })); }); decal(g, ['01'], [-0.62, 0.62, 0.905], 0.5, 1, '#3A3A30'); decal(g, ['01'], [0.62, 0.62, -0.905], 0.5, -1, '#3A3A30'); },
  'cargo.mk2': g => { MODS['cargo.mk1'](g); [-1, 1].forEach(s => { box(g, 1.7, 0.08, 0.5, COL.mustard, [0, -0.5, s * 1.18]); [[-0.52, COL.teal], [0, COL.rust], [0.52, COL.olive]].forEach(([x, c]) => box(g, 0.46, 0.5, 0.42, c, [x, -0.2, s * 1.18])); [-0.6, 0.6].forEach(x => box(g, 0.06, 0.7, 0.06, COL.darker, [x, -0.1, s * 1.42], { edge: 0 })); }); },
  'ansible.mk1': g => { box(g, 0.5, 0.1, 0.5, COL.darker, [0, 0.05, 0]); tube(g, 0.04, 0.05, 0.8, COL.dark, [0, 0.45, 0], { edge: 0 }); const dish = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 8, 0, Math.PI * 2, 0, 1.0), MATS.dish ??= new THREE.MeshToonMaterial({ color: COL.cream, gradientMap: RAMP, side: THREE.DoubleSide })); dish.position.set(0.1, 0.72, 0); dish.rotation.z = -1.1; g.add(dish); light(g, [0, 0.88, 0], 0xFF5A4A, 0.08, 1.3); },
  // planned: the hauling classes and the fight, not in the domain yet
  'cargo.tank': g => { box(g, 1.6, 0.14, 1.7, COL.darker, [0, -0.78, 0]); [-0.42, 0.42].forEach(z => { tube(g, 0.46, 0.46, 1.5, COL.cream2, [0, -0.12, z], { rot: along }); [-0.5, 0.5].forEach(x => tube(g, 0.48, 0.48, 0.08, COL.mustard, [x, -0.12, z], { rot: along, edge: 0 })); }); box(g, 1.62, 0.2, 0.06, hazardMat(), [0, 0.5, 0.86], { edge: 0 }); box(g, 1.62, 0.2, 0.06, hazardMat(), [0, 0.5, -0.86], { edge: 0 }); box(g, 1.6, 0.5, 1.7, COL.cream, [0, 0.6, 0]); },
  'cargo.reefer': g => { box(g, 1.6, 1.7, 1.8, COL.white, [0, 0, 0]); [-1, 1].forEach(s => [-0.5, -0.25, 0, 0.25, 0.5].forEach(x => box(g, 0.08, 1.2, 0.26, COL.frost, [x, 0, s * 1.02], { edge: 0.015 }))); light(g, [0.7, 0.9, 0.7], 0x8FD8FF, 0.1, 1.6); },
  'cargo.pen': g => { box(g, 1.6, 1.7, 1.8, COL.olive, [0, 0, 0]); [-1, 1].forEach(s => [-0.45, 0.1].forEach(x => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), glowMat(0xFFD27A)); w.position.set(x, 0.25, s * 0.91); if (s < 0) w.rotation.y = Math.PI; g.add(w); ring(g, 0.2, 0.04, COL.cream, [x, 0.25, s * 0.91], [0, 0, 0]); })); [-1, 1].forEach(s => box(g, 0.9, 0.2, 0.05, COL.darker, [0, -0.45, s * 0.91], { edge: 0 })); light(g, [-0.7, 0.9, 0], 0x7CE08A, 0.1, 2.2); },
  'radar.mk1': g => { box(g, 0.6, 0.12, 0.6, COL.darker, [0, 0.06, 0]); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(COL.cream)); dome.position.y = 0.12; g.add(dome); const arm = new THREE.Group(); arm.position.y = 0.55; arm.userData.spin = 1.6; g.add(arm); box(arm, 0.9, 0.12, 0.08, COL.cream2, [0, 0.1, 0]); tube(arm, 0.03, 0.03, 0.2, COL.dark, [0, -0.05, 0], { edge: 0 }); light(g, [0, 0.9, 0], 0xFF5A4A, 0.07, 1.1); },
  'driver.mk1': g => { box(g, 0.7, 0.3, 0.6, COL.darker, [-0.2, 0.15, 0]); [-0.14, 0.14].forEach(z => box(g, 2.6, 0.08, 0.08, COL.dark, [0.9, 0.36, z], { edge: 0.02 })); [0.3, 0.9, 1.5].forEach(x => ring(g, 0.24, 0.05, COL.mustard, [x, 0.36, 0])); box(g, 0.4, 0.3, 0.44, COL.rust, [-0.2, 0.45, 0]); light(g, [2.2, 0.36, 0], 0xFF4A3A, 0.06, 0.6); },
};
const PLANNED = { 'cargo.tank': 'tank module', 'cargo.reefer': 'reefer module', 'cargo.pen': 'life support pen', 'radar.mk1': 'radar mk1', 'driver.mk1': 'mass driver mk1' };
const PLANNED_FAMILY = { 'cargo.tank': 'cargo', 'cargo.reefer': 'cargo', 'cargo.pen': 'cargo', 'radar.mk1': 'utility', 'driver.mk1': 'utility' };
const EMPTY = {
  power: g => { box(g, 1.2, 0.12, 1.0, COL.darker, [0, 0.06, 0]); [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]].forEach(([x, z]) => tube(g, 0.05, 0.05, 0.1, COL.mustard, [x, 0.16, z], { edge: 0 })); },
  cruise: g => { [[0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]].forEach(([y, z]) => box(g, 1.5, 0.12, 0.12, COL.darker, [0, y, z])); [0.6, -0.6].forEach(x => box(g, 0.12, 1.5, 1.5, COL.dark, [x, 0, 0], { edge: 0.02 })); },
  maneuver: g => [-1, 1].forEach(s => box(g, 0.3, 0.14, 0.3, COL.darker, [0, 0, s * 0.98])),
  cargo: g => { [[0.75, 0.8], [0.75, -0.8], [-0.75, 0.8], [-0.75, -0.8]].forEach(([y, z]) => box(g, 1.6, 0.12, 0.12, COL.dark, [0, y, z])); [-0.7, 0, 0.7].forEach(x => box(g, 0.1, 1.6, 1.7, COL.darker, [x, 0, 0], { edge: 0.02 })); },
  utility: g => box(g, 0.5, 0.1, 0.5, COL.darker, [0, 0.05, 0]),
};
// where each slot mounts on the hull, and where its marker floats
const MOUNT = {
  power1: { at: [-1.3, 0.85, 0], mark: [-1.3, 2.1, 0] },
  cruise1: { at: [-3.1, 0, 0], mark: [-4.3, 0.2, 0] },
  maneuver1: { at: [2.2, -0.45, 0], mark: [2.2, -0.45, 1.7] },
  cargo1: { at: [0.55, 0, 0], mark: [0.55, 1.4, 0] },
  utility1: { at: [2.6, 0.85, 0], mark: [3.0, 2.2, 0] },
};

class FarTreasure {
  constructor(rig, { legs = false } = {}) {
    const g = this.group = new THREE.Group(); this.slots = {}; this.fire = 0;
    // the nose: a teal chin under a cream cab, glass on the slope, a name on each side
    part(g, profile([[3.05, -0.85], [4.6, -0.85], [5.25, -0.42], [5.2, -0.15], [3.05, -0.15]], 1.7), COL.teal);
    part(g, profile([[3.05, -0.15], [5.2, -0.15], [5.05, 0.2], [4.35, 0.8], [3.05, 0.85]], 1.7), COL.cream);
    const slope = Math.atan2(0.6, -0.7), nx = 0.6 / 0.92, ny = 0.7 / 0.92;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 1.62), mat(COL.darker, false)); visor.position.set(4.7 + nx * 0.02, 0.5 + ny * 0.02, 0); visor.rotation.z = slope - Math.PI; g.add(visor);
    [-0.52, 0, 0.52].forEach(z => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.44), mat(0x2E4A5E, false)); w.position.set(4.7 + nx * 0.05, 0.5 + ny * 0.05, z); w.rotation.z = slope - Math.PI; g.add(w); const hl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.06), glowMat(0x9FC4DA)); hl.position.set(4.66 + nx * 0.06, 0.52 + ny * 0.06, z - 0.12); hl.rotation.z = slope - Math.PI; g.add(hl); });
    box(g, 2.1, 0.08, 1.74, COL.mustard, [4.1, -0.15, 0], { edge: 0 });
    [-1, 1].forEach(s => { box(g, 0.7, 0.26, 0.04, COL.glass, [3.7, 0.45, s * 0.86], { edge: 0 }); light(g, [5.18, -0.3, s * 0.52], 0xFFC46A, 0.12); decal(g, ['far treasure', 'far cargo · brighter tomorrow'], [3.85, 0.1, s * 0.862], 1.3, s); });
    // the spine: bands and hull segments, a keel, rails, pipes
    box(g, 1.5, 1.7, 1.8, COL.cream, [2.3, 0, 0]);
    box(g, 0.5, 0.3, 0.05, COL.darker, [2.0, 0.35, 0.9], { edge: 0 }); box(g, 0.4, 0.5, 0.05, COL.teal, [2.7, -0.3, 0.9], { edge: 0 });
    box(g, 0.22, 1.82, 1.92, COL.teal, [1.5, 0, 0]);
    box(g, 0.18, 1.8, 1.9, COL.mustard, [-0.4, 0, 0]);
    box(g, 1.6, 1.7, 1.8, COL.cream, [-1.3, 0, 0]);
    [-1, 1].forEach(s => { box(g, 1.2, 0.9, 0.05, COL.olive, [-1.3, -0.15, s * 0.9], { edge: 0.02 }); [-1.75, -1.3, -0.85].forEach(x => box(g, 0.36, 0.22, 0.04, COL.cream2, [x, 0.55, s * 0.9], { edge: 0.015 })); });
    box(g, 0.22, 1.82, 1.92, COL.teal, [-2.2, 0, 0]);
    box(g, 6.6, 0.3, 1.2, COL.darker, [0.1, -0.95, 0]);
    [-1, 1].forEach(s => { tube(g, 0.045, 0.045, 5.1, COL.mustard, [0.45, -0.58, s * 0.95], { rot: along, edge: 0 }); [-1.7, -0.5, 1.9, 2.9].forEach(x => box(g, 0.12, 0.16, 0.08, COL.darker, [x, -0.58, s * 0.93], { edge: 0 })); });
    [[2.0, 0.4], [2.0, -0.4]].forEach(([x, z]) => { box(g, 0.56, 0.07, 0.34, COL.darker, [x, 0.88, z], { edge: 0.02 }); for (let k = -2; k <= 2; k++) box(g, 0.5, 0.02, 0.03, COL.dark, [x, 0.925, z + k * 0.06], { edge: 0 }); });
    box(g, 0.4, 0.22, 0.36, COL.teal, [3.0, 0.96, -0.5]); box(g, 0.3, 0.16, 0.3, COL.cream2, [-2.0, 0.93, 0.5]);
    [-1, 1].forEach(s => { tube(g, 0.035, 0.035, 5.0, COL.mustard, [0.3, 0.92, s * 0.72], { rot: along, edge: 0 }); [-2, -0.6, 1.4, 2.8].forEach(x => tube(g, 0.03, 0.03, 0.1, COL.mustard, [x, 0.87, s * 0.72], { edge: 0 })); });
    // the airlock, port side: hazard frame round a dark door
    box(g, 0.62, 0.9, 0.05, hazardMat(), [2.3, 0.05, -0.905], { edge: 0.015 }); box(g, 0.46, 0.74, 0.06, COL.darker, [2.3, 0.05, -0.915], { edge: 0 }); box(g, 0.2, 0.06, 0.03, COL.mustard, [2.42, 0.05, -0.95], { edge: 0 });
    // propellant tanks under the aft hull
    [-1, 1].forEach(s => { tube(g, 0.2, 0.2, 1.3, COL.cream2, [-0.9, -0.95, s * 0.72], { rot: along }); [-1.35, -0.45].forEach(x => tube(g, 0.215, 0.215, 0.06, COL.mustard, [x, -0.95, s * 0.72], { rot: along, edge: 0 })); });
    // rcs quads at the four corners
    [[3.2, 0.7], [3.2, -0.7], [-2.05, 0.7], [-2.05, -0.7]].forEach(([x, z]) => { box(g, 0.16, 0.16, 0.16, COL.darker, [x, 0.72, z * 1.34], { edge: 0.015 }); tube(g, 0.03, 0.05, 0.08, COL.dark, [x, 0.72, z * 1.34 + Math.sign(z) * 0.1], { rot: [Math.PI / 2, 0, 0], edge: 0 }); });
    // running lights: amber on the spine, red to port, green to starboard, a white strobe aft
    [[3.0, 0.86, 0.8], [3.0, 0.86, -0.8], [-2.0, 0.86, 0.8], [-2.0, 0.86, -0.8], [0.6, -1.1, 0.5], [-1.4, -1.1, -0.5]].forEach((at, i) => light(g, at, 0xFFB54A, 0.1, i % 3 === 0 ? 0.9 + i * 0.3 : 0));
    light(g, [2.9, 0.6, -0.95], 0xFF4A3A, 0.09, 1.4); light(g, [2.9, 0.6, 0.95], 0x5FF28A, 0.09, 1.4); light(g, [-2.2, 1.0, 0], 0xFFFFFF, 0.08, 0.45);
    if (legs) [[2.6, 0.55], [2.6, -0.55], [-1.8, 0.55], [-1.8, -0.55]].forEach(([x, z]) => { tube(g, 0.07, 0.09, 0.5, COL.dark, [x, -1.3, z], { edge: 0 }); box(g, 0.34, 0.08, 0.34, COL.darker, [x, -1.55, z]); });
    for (const id of SLOT_IDS) { const s = this.slots[id] = { group: new THREE.Group(), mark: new THREE.Vector3(...MOUNT[id].mark) }; s.group.position.set(...MOUNT[id].at); g.add(s.group); this.fit(id, rig[id], false); }
  }
  fit(slot, id, animate = true) {
    const s = this.slots[slot], g = s.group; while (g.children.length) g.remove(g.children[0]);
    const inner = new THREE.Group(); g.add(inner);
    (id ? MODS[id] : EMPTY[FAMILY[slot]])(inner);
    s.id = id; s.inner = inner; s.pop = animate && MOT ? 0 : 1;
  }
  tick(t, dt) {
    for (const s of Object.values(this.slots)) if (s.pop < 1) { s.pop = Math.min(1, s.pop + dt * 1.8); const k = s.pop, e = 1 + Math.sin(k * Math.PI) * 0.18; s.inner.scale.setScalar(lerp(0.4, 1, ease(k)) * e); }
    liven(this.group, t, dt, this.fire);
  }
}

// ── the tug: mustard, hazard-striped, a claw and a winch ──────────
function tug() {
  const g = new THREE.Group();
  box(g, 1.7, 1.0, 1.2, COL.mustard, [0, 0, 0]); box(g, 0.25, 1.04, 1.24, COL.rust, [0.35, 0, 0]); box(g, 0.7, 0.72, 0.9, COL.cream, [1.1, 0.12, 0]);
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.7), mat(COL.glass, false)); w.position.set(1.46, 0.22, 0); g.add(w);
  box(g, 0.08, 0.3, 1.0, hazardMat(), [1.48, -0.3, 0], { edge: 0.015 });
  [[0.3, 0.3], [0.3, -0.3], [-0.3, 0.3], [-0.3, -0.3]].forEach(([y, z]) => nozzle(g, [-1.0, y, z], 0.18, 0.26, 0.4, 1.1));
  [-1, 1].forEach(s => { box(g, 0.6, 0.12, 0.12, COL.darker, [1.7, -0.3, s * 0.3]); box(g, 0.12, 0.3, 0.12, COL.darker, [2.0, -0.42, s * 0.24]); });
  tube(g, 0.2, 0.2, 0.7, COL.darker, [-0.3, 0.6, 0], { rot: [Math.PI / 2, 0, 0] }); ring(g, 0.21, 0.04, COL.mustard, [-0.3, 0.6, 0.2], [0, 0, 0]); ring(g, 0.21, 0.04, COL.mustard, [-0.3, 0.6, -0.2], [0, 0, 0]);
  tube(g, 0.02, 0.02, 0.6, COL.dark, [0.9, 0.78, 0.3], { edge: 0 });
  decal(g, ['tug 04'], [-0.2, 0.05, 0.605], 0.9, 1, '#2A2620'); decal(g, ['tug 04'], [-0.2, 0.05, -0.605], 0.9, -1, '#2A2620');
  light(g, [0.6, 0.55, 0.45], 0xFFB54A, 0.1, 0.8); light(g, [0.6, 0.55, -0.45], 0xFFB54A, 0.1, 0.8); light(g, [-0.2, 0.55, 0], 0xFF5A4A, 0.1, 0.5); light(g, [0.9, 1.1, 0.3], 0xFFB54A, 0.07, 0.35);
  return g;
}

// ── npc ships: a bulk hauler, a raider, a patrol cutter ───────────
function hauler(seed = 3) {
  const g = new THREE.Group(), r = rng(seed), cols = [COL.teal, COL.rust, COL.olive, COL.cream2, COL.mustard, COL.tealD];
  box(g, 9.4, 0.36, 0.36, COL.darker, [0, 0, 0]);
  [-3.4, -1.7, 0, 1.7].forEach(x => { [[0.62, 0.55], [0.62, -0.55], [-0.62, 0.55], [-0.62, -0.55]].forEach(([y, z]) => { if (r() < 0.12) return; const c = box(g, 1.6, 1.1, 1.0, cols[Math.floor(r() * cols.length)], [x, y, z]); }); box(g, 0.12, 2.6, 0.12, COL.dark, [x + 0.85, 0, 1.1], { edge: 0.02 }); box(g, 0.12, 2.6, 0.12, COL.dark, [x + 0.85, 0, -1.1], { edge: 0.02 }); });
  part(g, profile([[3.2, -0.8], [4.6, -0.8], [5.2, -0.3], [5.1, 0.3], [4.4, 0.8], [3.2, 0.85]], 1.6), COL.cream);
  box(g, 1.9, 0.5, 1.64, COL.teal, [4.1, -0.55, 0], { edge: 0 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 1.4), mat(0x2E4A5E, false)); v.position.set(4.8, 0.6, 0); v.rotation.z = Math.atan2(0.5, -0.7) - Math.PI; g.add(v);
  box(g, 1.3, 1.8, 1.8, COL.dark, [-5.0, 0, 0]); box(g, 0.24, 1.84, 1.84, COL.mustard, [-4.4, 0, 0]);
  [[0.45, 0.45], [0.45, -0.45], [-0.45, 0.45], [-0.45, -0.45]].forEach(([y, z]) => nozzle(g, [-5.9, y, z], 0.26, 0.36, 0.5, 1.1));
  [[3.2, 0.9, 0.8], [-4.4, 1.0, 0.8], [-4.4, 1.0, -0.8], [0, 1.25, 0]].forEach((at, i) => light(g, at, 0xFFB54A, 0.12, i === 3 ? 1.1 : 0));
  return g;
}
function raider() {
  const g = new THREE.Group();
  box(g, 3.2, 1.1, 1.4, COL.rust, [0, 0, 0], { rot: [0, 0, 0.02] });
  box(g, 1.4, 0.8, 1.2, COL.rustD, [1.95, -0.08, 0.08], { rot: [0.05, 0, -0.05] });
  box(g, 1.2, 1.3, 1.6, COL.darker, [-2.0, 0, 0]);
  box(g, 0.8, 0.5, 0.05, COL.teal, [0.4, 0.2, 0.72], { edge: 0.015 }); box(g, 0.6, 0.4, 0.05, COL.cream2, [-0.6, -0.12, -0.72], { edge: 0.015 }); box(g, 0.5, 0.35, 0.05, COL.olive, [0.9, -0.25, -0.72], { edge: 0.015 });
  [-0.2, 0.2].forEach(z => box(g, 3.8, 0.1, 0.1, COL.dark, [0.7, 0.78, z], { edge: 0.02 })); [-0.4, 0.4, 1.2, 2.0].forEach(x => ring(g, 0.3, 0.06, COL.mustard, [x, 0.78, 0])); box(g, 0.6, 0.4, 0.6, COL.rustD, [-1.3, 0.75, 0]);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.8), glowMat(0xFF6A4A)); slit.position.set(2.66, 0.02, 0.08); g.add(slit);
  nozzle(g, [-2.85, 0.2, 0.45], 0.35, 0.46, 0.6, 1.2); nozzle(g, [-2.8, -0.25, -0.45], 0.22, 0.3, 0.45, 0.9);
  [[0.3, 0.6, 0.5, 0.5], [-0.8, 0.62, -0.4, -0.4], [1.2, 0.45, 0.3, 0.9]].forEach(([x, y, z, a]) => tube(g, 0.02, 0.03, 0.9, COL.dark, [x, y + 0.4, z], { rot: [a, 0, 0.2], edge: 0 }));
  decal(g, ['nobody', 'no port · no problem'], [0.1, -0.3, 0.705], 1.2, 1, '#2A1A14');
  [[1.0, 0.6, 0.72], [-1.4, 0.7, -0.8], [2.5, -0.4, 0.5]].forEach((at, i) => light(g, at, 0xFF3B30, 0.1, 0.7 + i * 0.3));
  return g;
}
function cutter() {
  const g = new THREE.Group();
  part(g, profile([[-2.4, -0.42], [2.1, -0.42], [3.1, -0.1], [2.2, 0.36], [-2.4, 0.48]], 1.4), COL.navy);
  box(g, 4.2, 0.12, 1.44, COL.white, [-0.1, -0.02, 0], { edge: 0.02 });
  box(g, 1.6, 0.38, 1.0, COL.white, [0.4, 0.62, 0]);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.9), mat(0x2E4A5E, false)); v.position.set(1.1, 0.66, 0); g.add(v);
  box(g, 0.7, 0.1, 0.24, COL.darker, [0.4, 0.86, 0], { edge: 0.02 });
  const bar = [light(g, [0.2, 0.95, 0], 0x4F8BFF, 0.12), light(g, [0.6, 0.95, 0], 0xFF4A4A, 0.12)];
  bar[0].userData.blink = 0.5; bar[1].userData.blink = 0.5; bar[1].userData.phase = 0.5;
  [-1, 1].forEach(s => { box(g, 1.3, 0.08, 0.7, COL.navy, [-1.3, -0.2, s * 0.95], { rot: [s * 0.2, 0, 0] }); nozzle(g, [-2.65, 0.05, s * 0.4], 0.24, 0.32, 0.45, 1.1); });
  decal(g, ['patrol', 'sol outpost authority'], [-0.6, -0.26, 0.705], 1.4, 1, '#E8E6DF'); decal(g, ['patrol', 'sol outpost authority'], [-0.6, -0.26, -0.705], 1.4, -1, '#E8E6DF');
  light(g, [3.05, -0.1, 0], 0xFFFFFF, 0.08, 0.9);
  return g;
}

// ── the buoy, the neon, the shards ────────────────────────────────
function neonSign(lines) {
  const t = canvasTex(512, 220, c => {
    c.fillStyle = 'rgba(20,16,28,.88)'; c.beginPath(); c.roundRect(8, 8, 496, 204, 14); c.fill(); c.strokeStyle = '#3a2f48'; c.lineWidth = 4; c.stroke();
    const glowText = (s, y, size, col) => { c.font = `700 ${size}px "IBM Plex Mono", ui-monospace, monospace`; c.textAlign = 'center'; c.shadowColor = col; for (const b of [22, 10, 0]) { c.shadowBlur = b; c.fillStyle = b ? col : '#fff4fb'; c.fillText(s, 256, y); } };
    glowText(lines[0], 92, 54, '#FF4FA0'); glowText(lines[1], 164, 36, '#5FF2E6');
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(3.0, 1.29, 1); return s;
}
function buoy() {
  const g = new THREE.Group();
  [[0.55, COL.rust], [0.25, COL.cream], [-0.05, COL.rust], [-0.35, COL.cream]].forEach(([y, c]) => tube(g, 0.3, 0.3, 0.3, c, [0, y, 0]));
  tube(g, 0.02, 0.3, 0.45, COL.cream, [0, 0.93, 0]); tube(g, 0.02, 0.02, 0.6, COL.dark, [0, 1.4, 0], { edge: 0 });
  [-1, 1].forEach(s => { box(g, 0.06, 0.5, 0.9, COL.teal, [s * 0.55, 0.1, 0], { edge: 0.02 }); box(g, 0.25, 0.05, 0.05, COL.darker, [s * 0.4, 0.1, 0], { edge: 0 }); });
  tube(g, 0.18, 0.12, 0.2, COL.darker, [0, -0.6, 0], { edge: 0 });
  g.userData.beacon = light(g, [0, 1.72, 0], 0xFF4FA0, 0.14, 0.7);
  const sign = neonSign(['stuck?', 'call us now!']); sign.position.set(0, 2.9, 0); g.add(sign); g.userData.sign = sign;
  return g;
}
function shards(n, seed) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const geo = new THREE.IcosahedronGeometry(0.1 + r() * 0.22, 0), pos = geo.attributes.position, jit = {};
    for (let k = 0; k < pos.count; k++) { const key = [pos.getX(k), pos.getY(k), pos.getZ(k)].map(v => v.toFixed(3)).join(); const j = jit[key] ??= [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12, (r() - 0.5) * 0.3]; pos.setXYZ(k, pos.getX(k) + j[0], pos.getY(k) * 0.6 + j[1], pos.getZ(k) + j[2]); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat([COL.cream, COL.teal, COL.dark, COL.mustard, COL.cream2][i % 5]));
    m.userData = { rad: 2.4 + r() * 2.2, tilt: (r() - 0.5) * 1.2, yaw: r() * 6.28, speed: (0.08 + r() * 0.12) * (r() > 0.5 ? 1 : -1), ph: r() * 6.28, roll: [r() - 0.5, r() - 0.5, r() - 0.5].map(v => v * 2) };
    out.push(m);
  }
  return out;
}

// ── the painted fleet: glb from blender, frontend/scripts/build-painted-fleet.py ─
const GLTF = window.THREE && THREE.GLTFLoader ? new THREE.GLTFLoader() : undefined, GLB = {};
const OUTLINE = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0.03 } }, side: THREE.BackSide,
  vertexShader: 'attribute vec3 aOutline; uniform float uT; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aOutline * uT, 1.); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(.08, .066, .05, 1.); }' });
// one normal per corner, so the outline hull closes over flat-shaded bevels
function outlineNormals(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, acc = new Map(), keys = [];
  for (let i = 0; i < pos.count; i++) { const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`, a = acc.get(k) ?? [0, 0, 0]; keys.push(k); a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k, a); }
  const out = new Float32Array(pos.count * 3); keys.forEach((k, i) => { const a = acc.get(k), l = Math.hypot(...a) || 1; out.set([a[0] / l, a[1] / l, a[2] / l], i * 3); });
  geo.setAttribute('aOutline', new THREE.BufferAttribute(out, 3));
}
// box-projected uv, so the grime map lands on every face
function boxUV(geo) {
  if (geo.attributes.uv) return; const pos = geo.attributes.position, nor = geo.attributes.normal, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const n = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))], a = n.indexOf(Math.max(...n)), p = [pos.getX(i), pos.getY(i), pos.getZ(i)]; const [u, v] = a === 0 ? [p[2], p[1]] : a === 1 ? [p[0], p[2]] : [p[0], p[1]]; uv[i * 2] = u * 0.35; uv[i * 2 + 1] = v * 0.35; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function paintGLB(root) {
  const meshes = []; root.traverse(o => o.isMesh && meshes.push(o));
  meshes.forEach(m => {
    const src = m.material, e = src.emissive, lit = e && e.r + e.g + e.b > 0.01, c = (lit ? e : src.color).clone().convertLinearToSRGB(), hex = c.getHex();
    if (lit) { m.material = glowMat(hex); const k = m.name; if (/tip|nav|beacon|lightbar|eye/.test(k) && !/frame/.test(k)) { const g = glowSprite(hex, /beacon|lightbar/.test(k) ? 0.9 : /eye/.test(k) ? 0.12 : 0.6); g.material.opacity = 0.6; m.add(g); if (hex !== 0xFFB347 && !/spot|eye/.test(k)) { g.userData.blink = /lightbar/.test(k) ? 0.6 : 1.3; if (/lightbar_(red|amber)/.test(k)) g.userData.phase = 0.5; } } return; }
    boxUV(m.geometry); outlineNormals(m.geometry); m.material = mat(hex); m.add(new THREE.Mesh(m.geometry, OUTLINE));
  });
  root.traverse(o => { if (o.userData.plume) { const r = o.userData.radius; glowAt(o, [0, 0, 0], 0x9CD3FF, r * 3.2); flame(o, [0, 0, 0], r, r * 5); } });
  return root;
}
// the page gets each glb as base64 in json, a type the artifact host serves
const unpack = b64 => { const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; };
// ?local reads the glb exports in place; the artifact host gets them as json
const LOCAL = /[?&]local/.test(location.search);
const loadGLB = name => GLB[name] ??= LOCAL
  ? new Promise((ok, no) => GLTF.load(`../public/models/painted/${name}.glb`, g => ok(paintGLB(g.scene)), undefined, no))
  : fetch(`models/${name}.json`).then(r => r.ok ? r.json() : Promise.reject(new Error(`${name}: ${r.status}`))).then(j => new Promise((ok, no) => GLTF.parse(unpack(j.glb), '', g => ok(paintGLB(g.scene)), no)));
// an instance of its own: lights and plumes keep their own state
function instance(scene) { const c = scene.clone(true); c.traverse(o => { if (o.userData.blink || o.userData.flame || o.userData.fireGlow) o.material = o.material.clone(); }); STAGES.forEach(s => s.dirty = true); return c; }
function glbModel(name, scale = 1) { const g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(scale); g.add(inner); loadGLB(name).then(s => inner.add(instance(s))).catch(e => console.error(name, e)); return g; }

// the far treasure, fitted from glb modules on the hull's sockets
const PSCALE = 0.78;
const SOCK = { power1: [-1.75, 1.11, 0], cruise1: [-3.85, 0, 0], maneuver1: [-1.75, -0.72, 0], cargo1: [0.3, 0, 0], utility1: [2.3, 1.11, 0] };
const MARKOFF = { power1: [0, 1.4, 0], cruise1: [-1.8, 0.3, 0], maneuver1: [0, 0, 2.2], cargo1: [0, 1.5, 0], utility1: [0.6, 1.5, 0] };
class PaintedShip {
  constructor(rig, { legs = false } = {}) {
    this.group = new THREE.Group(); this.model = new THREE.Group(); this.model.scale.setScalar(PSCALE); this.group.add(this.model);
    this.fire = 0; this.slots = {}; this.floor = (legs ? 1.78 : 1.2) * PSCALE; this.nose = new THREE.Vector3(6.4 * PSCALE, -0.46 * PSCALE, 0);
    for (const id of SLOT_IDS) { const s = this.slots[id] = { group: new THREE.Group(), mark: new THREE.Vector3(...SOCK[id].map((v, i) => (v + MARKOFF[id][i]) * PSCALE)), pop: 1 }; s.group.position.set(...SOCK[id]); this.model.add(s.group); this.fit(id, rig[id], false); }
    if (legs) [[2.2, 0.6], [2.2, -0.6], [-1.6, 0.6], [-1.6, -0.6]].forEach(([x, z]) => { tube(this.model, 0.09, 0.12, 0.5, COL.dark, [x, -1.42, z], { edge: 0 }); box(this.model, 0.42, 0.1, 0.42, COL.darker, [x, -1.72, z]); });
    loadGLB('far-treasure').then(s => this.model.add(instance(s))).catch(e => console.error('far-treasure', e));
  }
  fit(slot, id, animate = true) {
    const s = this.slots[slot], token = s.token = {}, key = (id ?? 'empty.' + FAMILY[slot]).replace('.', '-'); s.id = id;
    loadGLB('modules/' + key).then(scene => { if (s.token !== token) return; while (s.group.children.length) s.group.remove(s.group.children[0]); s.inner = instance(scene); s.group.add(s.inner); s.pop = animate && MOT ? 0 : 1; if (s.pop < 1) s.inner.scale.setScalar(0.4); }).catch(e => console.error(key, e));
  }
  tick(t, dt) {
    for (const s of Object.values(this.slots)) if (s.inner && s.pop < 1) { s.pop = Math.min(1, s.pop + dt * 1.8); const k = s.pop, e = 1 + Math.sin(k * Math.PI) * 0.18; s.inner.scale.setScalar(lerp(0.4, 1, ease(k)) * e); }
    liven(this.group, t, dt, this.fire);
  }
}
const Ship = GLTF ? PaintedShip : FarTreasure;

// a robot's joints, swung by a phase that follows its speed
function walkRobot(g, dt, speed) {
  const j = g.userData.joints ??= (() => { const m = {}; g.traverse(o => { if (/^(leg|arm|wheel)_[lr]$|^head$/.test(o.name)) m[o.name] = o; }); return Object.keys(m).length ? m : undefined; })();
  if (!j) return;
  const ph = g.userData.ph = (g.userData.ph ?? 0) + dt * speed * 7, sw = Math.sin(ph) * 0.55 * Math.min(1, speed * 2);
  if (j.leg_l) { j.leg_l.rotation.z = sw; j.leg_r.rotation.z = -sw; j.arm_l.rotation.z = -sw * 0.8; j.arm_r.rotation.z = sw * 0.8; }
  if (j.wheel_l) { j.wheel_l.rotation.z -= dt * speed * 6; j.wheel_r.rotation.z -= dt * speed * 6; }
  if (j.head) j.head.rotation.y = Math.sin(ph * 0.21) * 0.25;
}
// to and fro between a and b on the deck, turning at each end
function patrol(g, [ax, az], [bx, bz], t, dt, period, ph = 0) {
  const w = (t / period + ph) * Math.PI * 2, k = (1 - Math.cos(w)) / 2, dir = Math.sin(w) >= 0 ? 1 : -1;
  g.position.set(lerp(ax, bx, k), 0, lerp(az, bz, k)); g.rotation.y = Math.atan2(-(bz - az) * dir, (bx - ax) * dir);
  walkRobot(g, dt, Math.abs(Math.sin(w)) * 1.1 + 0.05);
}
function glbBuoy(scale = 1) { const g = glbModel('tug-buoy', scale), sign = neonSign(['stuck?', 'call us now!']); sign.scale.set(1.8, 0.78, 1); sign.position.set(-0.04 * scale, 1.9 * scale, 0); sign.material.depthTest = false; sign.renderOrder = 10; g.add(sign); g.userData.sign = sign; return g; }
// one box from the container kit, set on the deck
function kitBox(stage, name, [x, z], scale = 2, turn = 0, lift = 0) {
  const g = new THREE.Group(); g.position.set(x, lift, z); g.rotation.y = turn; g.scale.setScalar(scale); stage.scene.add(g);
  loadGLB('containers').then(s => { const src = s.getObjectByName(name); if (!src) return; const c = instance(src); c.position.set(0, (name === 'container_hc' ? BHC2 : 0.5), 0); g.add(c); });
  return g;
}
const BHC2 = 0.56;
