// ── planet maps: flat 2:1 paintings, generated here, painted later ─
const NP = new Uint8Array(512), NV = new Float32Array(256);
(() => { const r = rng(7), p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) NP[i] = p[i & 255]; for (let i = 0; i < 256; i++) NV[i] = r(); })();
function vnoise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), fx = x - X, fy = y - Y, fz = z - Z;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => NV[NP[NP[NP[(X + i) & 255] + ((Y + j) & 255)] + ((Z + k) & 255)]];
  const a = lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v), b = lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v);
  return lerp(a, b, w);
}
function fbm3(x, y, z, o = 5) { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return s / n; }
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function field(W, H, f) { const out = new Float32Array(W * H); for (let j = 0; j < H; j++) { const lat = (j / (H - 1) - 0.5) * Math.PI; for (let i = 0; i < W; i++) { const lon = i / W * Math.PI * 2; out[j * W + i] = f(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), lat, lon); } } return out; }
const ramp = (v, ts, cols, w = 0.003) => { let i = 0; while (i < ts.length && v > ts[i] + w) i++; if (i < ts.length && v > ts[i] - w) { const k = (v - ts[i] + w) / (2 * w); return cols[i].map((c, n) => lerp(c, cols[i + 1][n], k)); } return cols[i]; };
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pctl = (arr, q) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(q * (s.length - 1))]; };
function paint(W, H, fn) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), img = c.createImageData(W, H); for (let i = 0; i < W * H; i++) { const [r, g, b, a = 255] = fn(i); img.data.set([r, g, b, a], i * 4); } c.putImageData(img, 0, 0); return cv; }
const MAPS = {};
function planetMaps(kind) {
  if (MAPS[kind]) return MAPS[kind];
  const W = 768, H = 384;
  if (kind === 'jupiter') {
    const stops = ['#7A4A2E', '#C99A66', '#EAD7AE', '#B8743F', '#E2C48E', '#9A6440', '#EFE0BE', '#C58A55'].map(hexRGB);
    const f = field(W, H, (x, y, z, lat, lon) => lat * 7.5 + 0.9 * (fbm3(x * 3, y * 9, z * 3) - 0.5) * 2);
    const map = paint(W, H, i => { const t = f[i], k = Math.floor(t * 1.4 + 20), q = ((t * 1.4 + 20) % 1); const a = stops[k % 8], b = stops[(k + 1) % 8], s = q > 0.78 ? (q - 0.78) / 0.22 : 0; let [r, g, bb] = a.map((v, n) => lerp(v, b[n], s)); const j = Math.floor(i / W), ii = i % W, lat = (j / (H - 1) - 0.5) * Math.PI, lon = ii / W * Math.PI * 2; const dx = (lon - 1.2) / 0.34, dy = (lat + 0.38) / 0.12, d = dx * dx + dy * dy; if (d < 1) { const w = d < 0.55 ? 1 : 0.55; [r, g, bb] = [r, g, bb].map((v, n) => lerp(v, [181, 85, 58][n], w)); } return [r, g, bb]; });
    return MAPS[kind] = { map, clouds: undefined };
  }
  const ochre = kind === 'ochre';
  const land = field(W, H, (x, y, z) => fbm3(x * 2.2 + 3, y * 2.2, z * 2.2 - 1));
  const t1 = pctl(land, ochre ? 0.3 : 0.6), t2 = pctl(land, ochre ? 0.62 : 0.78), t3 = pctl(land, ochre ? 0.88 : 0.93), t0 = pctl(land, 0.35);
  const pal = ochre ? ['#6E4A34', '#9A6440', '#C08A58', '#DDBB86', '#EAD7AE'].map(hexRGB) : ['#1E4A86', '#2C62A6', '#9C5A3C', '#B98452', '#D8C39A'].map(hexRGB);
  const map = paint(W, H, i => ramp(land[i], [t0, t1, t2, t3], pal));
  const cf = field(W, H, (x, y, z) => fbm3(x * 3.1 - 7, y * 4.2, z * 3.1 + 5, 4)), c1 = pctl(cf, ochre ? 0.92 : 0.74), c2 = pctl(cf, ochre ? 0.97 : 0.87);
  const clouds = paint(W, H, i => { const v = cf[i], a = sstep(c1 - 0.004, c1 + 0.004, v) * 150 + sstep(c2 - 0.004, c2 + 0.004, v) * 80; return [236, 242, 248, a]; });
  return MAPS[kind] = { map, clouds };
}

// ── shaders: the ether, the stars, the planet ──────────────────────
const GLSL_NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 1.7; a *= .5; } return v; }`;
const ETHER_FS = `${GLSL_NOISE}
uniform float uTime; uniform vec2 uAspect; uniform vec2 uPar; uniform vec3 uT1; uniform vec3 uT2; uniform float uBand;
varying vec2 vUv;
float stars(vec2 p, float scale, float t, float cut){
  vec2 g = p * scale, id = floor(g), f = fract(g) - .5; float h = hash(id);
  if (h < cut) return 0.;
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - .5; float d = length(f - o * .6);
  float tw = .55 + .45 * sin(t * (.7 + h * 2.6) + h * 60.);
  return smoothstep(.12 + .1 * (h - cut) / (1. - cut), 0., d) * tw * (.35 + (h - cut) / (1. - cut));
}
void main(){
  vec2 p = (vUv - .5) * uAspect;
  vec3 col = mix(vec3(.028, .05, .1), vec3(.06, .1, .19), vUv.y * .7 + .15);
  float band = exp(-pow((p.y - p.x * .38 + .06) * 2.4, 2.)) * uBand;
  vec2 q = p * 1.5 + vec2(uTime * .008, -uTime * .005) + uPar * .02;
  float w = fbm(q + 1.4 * fbm(q * 1.2 + uTime * .015));
  col += uT1 * pow(w, 2.4) * (.35 + .8 * band);
  col += uT2 * pow(fbm(q * 2.4 - 4.), 3.) * (.2 + .9 * band);
  col += vec3(.95, .9, .85) * band * .05;
  col += vec3(1., .96, .88) * stars(p + uPar * .006, 64., uTime, .9);
  col += vec3(.78, .88, 1.) * stars(p + uPar * .018 + 13., 30., uTime * 1.25, .93) * 1.5;
  gl_FragColor = vec4(col, 1.);
}`;
const PLANET_FS = `
uniform sampler2D uMap; uniform sampler2D uClouds; uniform float uHasClouds; uniform float uRot; uniform float uCloudRot; uniform float uTilt;
uniform vec3 uLight; uniform vec3 uRim; uniform vec3 uNight; varying vec2 vUv;
void main(){
  vec2 p = (vUv * 2. - 1.) * 1.22; float r = length(p);
  if (r > 1.) { float h = smoothstep(1.2, 1., r); gl_FragColor = vec4(uRim, h * h * .55); return; }
  vec3 n = vec3(p.x, p.y, sqrt(1. - r * r));
  float ct = cos(uTilt), st = sin(uTilt); vec3 m = vec3(ct * n.x - st * n.y, st * n.x + ct * n.y, n.z);
  float lon = atan(m.x, m.z), lat = asin(clamp(m.y, -1., 1.));
  vec2 uv = vec2(fract((lon + uRot) / 6.2831853 + .5), lat / 3.14159265 + .5);
  vec3 base = texture2D(uMap, uv).rgb;
  if (uHasClouds > .5) { vec4 cl = texture2D(uClouds, vec2(fract((lon + uCloudRot) / 6.2831853 + .5), uv.y)); base = mix(base, cl.rgb, cl.a); }
  float d = dot(n, normalize(uLight)), lit = smoothstep(-.2, .45, d);
  lit = floor(lit * 3. + .5) / 3. * .35 + lit * .65;
  vec3 col = mix(uNight * (.25 + base * .25), base, lit);
  float fres = pow(1. - n.z, 2.6);
  col += uRim * fres * (.55 * lit + .12);
  gl_FragColor = vec4(col, smoothstep(1., .992, r));
}`;
const BLUEPRINT_FS = `
varying vec2 vUv;
float line(float v, float step, float w){ float d = abs(fract(v / step + .5) - .5) * step; return 1. - smoothstep(0., w, d); }
void main(){
  vec2 px = vUv * vec2(1280., 720.);
  vec3 col = mix(vec3(.047, .055, .1), vec3(.07, .08, .14), vUv.y);
  float minor = max(line(px.x, 24., .9), line(px.y, 24., .9)), major = max(line(px.x, 120., 1.3), line(px.y, 120., 1.3));
  col += vec3(.2, .24, .4) * (minor * .22 + major * .45);
  vec2 c = vUv - .5; col *= 1. - dot(c, c) * .7;
  gl_FragColor = vec4(col, 1.);
}`;
const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const tex = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };

const VW = 1280, VH = 720;
class Space {
  constructor(scene, o = {}) {
    this.u = { uTime: { value: 0 }, uAspect: { value: new THREE.Vector2(16 / 9, 1) }, uPar: { value: new THREE.Vector2() }, uT1: { value: new THREE.Color(o.t1 ?? '#2F7F86') }, uT2: { value: new THREE.Color(o.t2 ?? '#6B4FA0') }, uBand: { value: o.band ?? 1 } };
    const ether = new THREE.Mesh(new THREE.PlaneGeometry(VW, VH), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: QUAD_VS, fragmentShader: o.blueprint ? BLUEPRINT_FS : ETHER_FS, depthTest: false, depthWrite: false }));
    ether.position.set(VW / 2, -VH / 2, -5); scene.add(ether);
    if (o.planet) {
      const m = planetMaps(o.planet), R = o.pr;
      this.pu = { uMap: { value: tex(m.map) }, uClouds: { value: m.clouds ? tex(m.clouds) : null }, uHasClouds: { value: m.clouds ? 1 : 0 }, uRot: { value: o.rot0 ?? 0 }, uCloudRot: { value: 0 }, uTilt: { value: o.tilt ?? 0.3 }, uLight: { value: new THREE.Vector3(...(o.light ?? [-0.6, 0.5, 0.7])) }, uRim: { value: new THREE.Color(o.rim ?? '#8FC4FF') }, uNight: { value: new THREE.Color(o.night ?? '#101A33') } };
      this.planet = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.44, R * 2.44), new THREE.ShaderMaterial({ uniforms: this.pu, vertexShader: QUAD_VS, fragmentShader: PLANET_FS, transparent: true, depthTest: false, depthWrite: false }));
      this.planet.position.set(o.px, -o.py, -4); this.pp = [o.px, o.py]; this.spin = o.spin ?? 1 / 300; scene.add(this.planet);
    }
  }
  tick(t, mouse) {
    this.u.uTime.value = t; this.u.uPar.value.set(mouse.x, -mouse.y);
    if (this.planet) { const a = MOT ? t : 0; this.pu.uRot.value = a * Math.PI * 2 * this.spin; this.pu.uCloudRot.value = a * Math.PI * 2 * this.spin * 1.35; this.planet.position.set(this.pp[0] - mouse.x * 10, -this.pp[1] + mouse.y * 6, -4); }
  }
}

// a soft light, for beacons, stars and engines
const GLOW = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
function glowSprite(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(size, size, 1); return s; }

// ── the stage: space, painted layers, the 3D pass, painted layers ─
const LOADER = new THREE.TextureLoader(), TEX = {};
const art = src => TEX[src] ??= LOADER.load(`art/${src}.webp`, t => { t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; STAGES.forEach(s => s.dirty = true); });
const STAGES = new Set();
class Stage {
  constructor(el, o = {}) {
    this.el = el; this.t = 0; this.ticks = []; this.mouse = new THREE.Vector2();
    const r = this.r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]pdb/.test(location.search) });
    r.autoClear = false; r.setClearColor(0x070b14, 1); r.domElement.className = 'gl'; el.prepend(r.domElement);
    this.cam2 = new THREE.OrthographicCamera(0, VW, 0, -VH, -10, 10);
    this.bg = new THREE.Scene(); this.back = new THREE.Scene(); this.scene = new THREE.Scene(); this.front = new THREE.Scene();
    this.space = new Space(this.bg, o);
    el.addEventListener('pointermove', e => { const b = el.getBoundingClientRect(); this.mouse.set((e.clientX - b.left) / b.width - 0.5, (e.clientY - b.top) / b.height - 0.5); });
    new ResizeObserver(() => this.resize()).observe(el);
    new IntersectionObserver(es => es.forEach(e => this.visible = e.isIntersecting), { rootMargin: '80px' }).observe(el);
    STAGES.add(this); this.resize();
  }
  resize() { const b = this.el.getBoundingClientRect(); this.w = Math.max(1, b.width); this.h = Math.max(1, b.height); this.r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.r.setSize(this.w, this.h, false); this.onResize?.(); this.dirty = true; }
  // virtual 1280×720 → css px inside the bezel
  css(x, y) { return [x / VW * this.w, y / VH * this.h]; }
  virt(cx, cy) { const b = this.el.getBoundingClientRect(); return [(cx - b.left) / b.width * VW, (cy - b.top) / b.height * VH]; }
  sprite(layer, src, { x, y, w, ax = 0.5, ay = 0.92, z = 0, a = 1 }) {
    const t = art(src), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, opacity: a }));
    const fit = () => { const img = t.image; if (!img?.width) return; const h = w * img.height / img.width; m.scale.set(w, h, 1); m.userData.h = h; m.position.set(m.userData.x + (0.5 - ax) * w, -(m.userData.y + (0.5 - ay) * h), z); };
    m.userData = { x, y, fit }; m.renderOrder = z; layer.add(m); t.image?.width ? fit() : (m.userData.pending = true);
    return m;
  }
  place(m, x, y) { m.userData.x = x; m.userData.y = y; m.userData.fit(); }
  frame(dt) {
    this.t += dt; this.space.tick(this.t, this.mouse); this.ticks.forEach(f => f(this.t, dt));
    [this.back, this.front].forEach(l => l.children.forEach(m => m.userData.pending && m.material.map.image?.width && (m.userData.pending = false, m.userData.fit())));
    const r = this.r; r.clear(); r.render(this.bg, this.cam2); r.render(this.back, this.cam2); r.clearDepth(); if (this.cam) r.render(this.scene, this.cam); r.render(this.front, this.cam2);
    this.after?.(); this.dirty = false;
  }
}
let last = 0;
function loop(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
  if (!document.hidden) STAGES.forEach(s => (s.visible && (MOT || s.dirty || s.live)) && s.frame(MOT || s.live ? dt : 0));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// a lit, toon-shaded 3D pass that sits in the painted light: warm key upper left, cool rim
function lights(scene, k = 1) {
  scene.add(new THREE.HemisphereLight(0xa8bde0, 0x4a3826, 0.5 * k));
  const key = new THREE.DirectionalLight(0xffe2b8, 0.72 * k); key.position.set(-4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb0ff, 0.28 * k); rim.position.set(5, 2, -6); scene.add(rim);
}
