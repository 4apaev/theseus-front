const D = /*DATA*/null;
const MOT = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const html = (s, ...v) => s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ''), '');

// ── the seed and its formulas, as in packages/domain ──────────────
const G = Object.fromEntries(D.goods.map(g => [g.id, g]));
const M = D.modules;
const ST = Object.fromEntries(D.sys.flatMap(s => s.st.map(t => [t.id, { ...t, sys: s.id }])));
const SYS = Object.fromEntries(D.sys.map(s => [s.id, s]));
const K = D.constants, RATE = K.interest_rate, LIGHT = K.light_speed, YEAR = K.year_seconds, LYM = LIGHT * YEAR, V0 = 0.6, A0 = 0.002, GAMMA = 1 / Math.sqrt(1 - V0 * V0);
function legTime(ly, c) { if (c >= 1) return ly / V0; const d = ly * LYM, v = c * LIGHT; return (Math.sqrt(A0 * d) <= v ? 2 * Math.sqrt(d / A0) : d / v + v / A0) / YEAR; }
const level = (st, gid) => st.pr?.[gid] ? 160 : st.co?.[gid] ? 40 : 100;
function quote(stid, gid) { const g = G[gid], st = ST[stid], stock = st ? level(st, gid) : 100, p = g.b * (100 / stock) ** g.e; return { p, bid: p * 0.9, ask: p * 1.1, stock }; }

// the star graph: gateway links, walked by galaxy years
const GATE = Object.fromEntries(D.links.flatMap(([a, b]) => [[a, ST[a].sys], [b, ST[b].sys]]));
const STAR_ADJ = {};
D.links.forEach(([a, b, ly]) => { const x = ST[a].sys, y = ST[b].sys; (STAR_ADJ[x] ??= []).push({ to: y, ly }); (STAR_ADJ[y] ??= []).push({ to: x, ly }); });
function routeFrom(src) {
  const dist = { [src]: 0 }, prev = {}, done = new Set();
  for (;;) {
    let at, best = Infinity; for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; at = k; }
    if (at === undefined) break; done.add(at);
    for (const e of STAR_ADJ[at] || []) { const t = best + legTime(e.ly, 1); if (t < (dist[e.to] ?? Infinity)) { dist[e.to] = t; prev[e.to] = at; } }
  }
  const path = to => { const p = [to]; while (prev[p[0]]) p.unshift(prev[p[0]]); return p; };
  return { years: dist, path };
}

// ── the rig: the domain's fitting rules, compressed ───────────────
const HULL = D.hull, SLOT_IDS = HULL.slots.map(s => s.id), FAMILY = Object.fromEntries(HULL.slots.map(s => [s.id, s.family]));
function stats(rig) {
  const ds = Object.values(rig).filter(Boolean).map(id => M[id]);
  const eff = stat => ds.flatMap(d => d.effects).filter(e => e.stat === stat);
  const flat = s => eff(s).filter(e => e.kind === 'flat').reduce((n, e) => n + e.value, 0);
  const pct = s => eff(s).filter(e => e.kind === 'percent').reduce((n, e) => n + e.value, 0);
  const ranks = {}; ds.forEach(d => d.provides.forEach(p => ranks[p.rate] = Math.max(ranks[p.rate] ?? 0, p.rank)));
  return {
    power: { available: HULL.power_base + flat('power'), used: ds.reduce((n, d) => n + d.power, 0) },
    velocity: Math.min(HULL.velocity_max, HULL.velocity_base * (1 + pct('velocity'))),
    acceleration: Math.min(HULL.acceleration_max, HULL.acceleration_base + flat('acceleration')),
    capacity: HULL.capacity_base + flat('capacity'),
    ranks,
  };
}
function validate(rig) {
  const s = stats(rig), errs = [];
  for (const [slot, id] of Object.entries(rig)) if (id) for (const r of M[id].requires) if ((s.ranks[r.rate] ?? 0) < r.rank) errs.push(`${G[id].n} needs ${r.rate} rank ${r.rank}`);
  s.power.used <= s.power.available || errs.push(`power draw ${s.power.used} exceeds ${s.power.available}`);
  return { ok: !errs.length, errs, stats: s };
}

// ── one shared demo state for every screen ─────────────────────────
const S = {
  wallet: 2400, insured: true,
  rig: { power1: 'reactor.mk1', cruise1: 'cruise.mk1', maneuver1: 'maneuver.mk1', cargo1: 'cargo.mk1', utility1: 'ansible.mk1' },
  hold: [],
};
const bus = new EventTarget();
const emit = (t, detail) => bus.dispatchEvent(new CustomEvent(t, { detail }));
const on = (t, f) => bus.addEventListener(t, e => f(e.detail));

// ── the hold: a cell is one unit of volume ─────────────────────────
const COLS = 5;
const SHAPE = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2] };
const shape = gid => SHAPE[G[gid].v] ?? [G[gid].v, 1];
const rows = () => Math.ceil(stats(S.rig).capacity / COLS);
const used = (hold = S.hold) => hold.reduce((n, p) => n + p.w * p.h, 0);
function occupied(hold, skip) { const m = new Set(); hold.forEach(p => { if (p === skip) return; for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) m.add(x + ',' + y); }); return m; }
function free(hold, x, y, w, h, skip, R = rows()) { if (x < 0 || y < 0 || x + w > COLS || y + h > R) return false; const m = occupied(hold, skip); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (m.has(i + ',' + j)) return false; return true; }
function spot(hold, w, h, near, R = rows()) {
  const cand = [];
  for (const [ww, hh] of w === h ? [[w, h]] : [[w, h], [h, w]]) for (let y = 0; y < R; y++) for (let x = 0; x < COLS; x++) if (free(hold, x, y, ww, hh, undefined, R)) cand.push({ x, y, w: ww, h: hh, d: (near ? Math.hypot(x - near.x, y - near.y) : y * COLS + x) + (ww !== w ? 2.5 : 0) });
  return cand.sort((a, b) => a.d - b.d)[0];
}
let PID = 0;
function stow(gid, near, hold = S.hold, R = rows()) { const [w, h] = shape(gid), at = spot(hold, w, h, near, R); if (!at) return; const p = { id: ++PID, gid, x: at.x, y: at.y, w: at.w, h: at.h }; hold.push(p); return p; }
const FORM_NEEDS = { liquid: 'a tank module', gas: 'a tank module', chilled: 'a reefer module', live: 'a life support pen' };
['titanium', 'titanium'].forEach(g => stow(g));

// ── ₢: numbers run, colour follows the sign ────────────────────────
const WALLETS = new Set(); let shown = S.wallet, wAnim = 0;
function pay(delta, why) {
  S.wallet += delta; const from = shown, to = S.wallet, t0 = performance.now(), dur = MOT ? 800 : 1;
  cancelAnimationFrame(wAnim);
  WALLETS.forEach(el => { el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(delta >= 0 ? 'up' : 'down'); const f = document.createElement('i'); f.className = 'delta ' + (delta >= 0 ? 'up' : 'down'); f.textContent = `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))} ₢`; el.appendChild(f); setTimeout(() => f.remove(), 1500); });
  const step = now => { const k = Math.min(1, (now - t0) / dur); shown = Math.round(lerp(from, to, ease(k))); WALLETS.forEach(el => el.firstChild.textContent = fmt(shown)); if (k < 1) wAnim = requestAnimationFrame(step); };
  wAnim = requestAnimationFrame(step); emit('wallet', { delta, why });
}
function hud(el, where) {
  ui(el).insertAdjacentHTML('beforeend', html`<div class="hud"><div class="where">${where}</div><div class="read"><span class="wallet"><b>${fmt(shown)}</b> ₢</span><span class="cap"><b></b></span></div></div>`);
  WALLETS.add($('.wallet', el));
  const cap = $('.cap b', el), upd = () => cap.textContent = `hold ${used()} / ${stats(S.rig).capacity}`; upd(); on('hold', upd); on('rig', upd);
}
function tabs(el, cur) {
  ui(el).insertAdjacentHTML('beforeend', html`<nav class="tabs" aria-label="screens">${['port', 'exchange', 'rigging', 'chart', 'adrift', 'hangar'].map(t => `<a href="#${t}" class="${t === cur ? 'on' : ''}">${t}</a>`).join('')}</nav>`);
}
function toast(el, msg, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; el.appendChild(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2800); }

// ── icons, painted as small miniatures: three faces, one warm light ─
const OUT = '#1d1a16';
function iso(c, x, y, w, d, h, [top, left, right], lw = 2.5) {
  const a = [x, y], b = [x + w, y + w / 2], cc = [x + w - d, y + w / 2 + d / 2], e = [x - d, y + d / 2];
  const face = (pts, col) => { c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); };
  face([e, [e[0], e[1] + h], [cc[0], cc[1] + h], cc], left);
  face([cc, [cc[0], cc[1] + h], [b[0], b[1] + h], b], right);
  face([a, b, cc, e], top);
  return { a, b, c: cc, e };
}
function cyl(c, x, y, rx, h, [top, side, dark]) {
  c.lineWidth = 2.5; c.strokeStyle = OUT;
  c.beginPath(); c.moveTo(x - rx, y); c.lineTo(x - rx, y + h); c.ellipse(x, y + h, rx, rx * 0.45, 0, Math.PI, 0, true); c.lineTo(x + rx, y); c.closePath();
  const g = c.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, side); g.addColorStop(1, dark); c.fillStyle = g; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(x, y, rx, rx * 0.45, 0, 0, 7); c.fillStyle = top; c.fill(); c.stroke();
}
const lamp = (c, x, y, r = 3) => { c.fillStyle = '#FFB54A'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,181,74,.35)'; c.beginPath(); c.arc(x, y, r * 2.4, 0, 7); c.fill(); };
const P = { cream: ['#EFE2C2', '#D6C39C', '#B8A47C'], teal: ['#5E8C92', '#3F6A72', '#2E4F57'], mustard: ['#F2B64A', '#D9962E', '#B3761F'], olive: ['#8A9A5E', '#6C7B45', '#526034'], rust: ['#D0764A', '#A8532F', '#843E22'], dark: ['#6A6D72', '#4A4D52', '#35373B'], blue: ['#7FA7D8', '#4F7DB5', '#3A5F8E'], green: ['#7BB07A', '#4E8A55', '#3A6A40'] };
function icon(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(48, 82, 30, 8, 0, 0, 7); c.fill();
  const box = (col, h = 26) => iso(c, 48, 22, 30, 30, h, P[col]);
  switch (kind) {
    case 'metal': iso(c, 40, 44, 22, 22, 12, P.dark); iso(c, 58, 34, 22, 22, 12, P.cream); iso(c, 48, 26, 22, 22, 12, P.dark); break;
    case 'ore': { c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.moveTo(20, 66); c.lineTo(26, 40); c.lineTo(44, 28); c.lineTo(66, 32); c.lineTo(78, 52); c.lineTo(70, 72); c.lineTo(34, 76); c.closePath(); c.fillStyle = '#5A5550'; c.fill(); c.stroke(); c.fillStyle = '#77716A'; c.beginPath(); c.moveTo(26, 40); c.lineTo(44, 28); c.lineTo(66, 32); c.lineTo(50, 48); c.closePath(); c.fill(); [[40, 58, '#D0764A'], [58, 50, '#F2B64A'], [52, 64, '#A8532F']].forEach(([x, y, col]) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.closePath(); c.fill(); c.stroke(); }); break; }
    case 'tech': { const f = box('teal', 20); for (let k = 0; k < 4; k++) { c.fillStyle = '#F2B64A'; c.fillRect(24 + k * 6, 50 + k * 3, 3, 8); } c.fillStyle = '#1d2a30'; c.beginPath(); c.moveTo(48, 28); c.lineTo(62, 35); c.lineTo(48, 42); c.lineTo(34, 35); c.closePath(); c.fill(); lamp(c, 70, 48, 2.5); break; }
    case 'consumer': { box('cream', 24); c.fillStyle = '#D0764A'; c.beginPath(); c.moveTo(44, 24); c.lineTo(52, 24); c.lineTo(38, 45); c.lineTo(30, 41); c.closePath(); c.fill(); c.fillStyle = '#3F6A72'; c.font = 'bold 9px monospace'; c.fillText('FRAGILE', 52, 62); break; }
    case 'food': { c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.moveTo(28, 74); c.bezierCurveTo(16, 60, 22, 36, 34, 28); c.lineTo(62, 28); c.bezierCurveTo(74, 36, 80, 60, 68, 74); c.closePath(); c.fillStyle = '#C9B07A'; c.fill(); c.stroke(); c.fillStyle = '#A88E58'; c.beginPath(); c.moveTo(48, 28); c.lineTo(62, 28); c.bezierCurveTo(74, 36, 80, 60, 68, 74); c.lineTo(52, 74); c.closePath(); c.fill(); c.beginPath(); c.moveTo(34, 28); c.lineTo(62, 28); c.stroke(); c.fillStyle = '#6C7B45'; c.fillRect(36, 46, 24, 12); c.strokeRect(36, 46, 24, 12); break; }
    case 'liquid': cyl(c, 48, 26, 20, 44, ['#9CC1E6', '#4F7DB5', '#2E4F7A']); c.fillStyle = '#EFE2C2'; c.fillRect(29, 46, 38, 7); break;
    case 'chemical': cyl(c, 48, 26, 20, 44, ['#E39A6E', '#A8532F', '#6E3219']); for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#1d1a16' : '#F2B64A'; c.fillRect(29 + k * 8, 46, 8, 7); } break;
    case 'gas': { c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.roundRect(18, 34, 60, 30, 15); const g = c.createLinearGradient(0, 34, 0, 64); g.addColorStop(0, '#8FBFC4'); g.addColorStop(1, '#3F6A72'); c.fillStyle = g; c.fill(); c.stroke(); c.fillStyle = '#F2B64A'; c.fillRect(40, 34, 6, 30); c.strokeRect(40, 34, 6, 30); c.fillStyle = '#4A4D52'; c.fillRect(74, 44, 8, 10); c.strokeRect(74, 44, 8, 10); break; }
    case 'luxury': { box('cream', 20); c.strokeStyle = '#D9962E'; c.lineWidth = 3; c.beginPath(); c.moveTo(18, 37); c.lineTo(48, 52); c.lineTo(78, 37); c.stroke(); c.fillStyle = '#F2B64A'; c.beginPath(); c.moveTo(48, 20); c.lineTo(56, 28); c.lineTo(48, 36); c.lineTo(40, 28); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); break; }
    case 'bottle': { box('olive', 16); [[36, 20], [48, 26], [60, 20]].forEach(([x, y]) => { c.lineWidth = 2.2; c.strokeStyle = OUT; c.beginPath(); c.roundRect(x - 6, y - 4, 12, 22, 4); c.fillStyle = '#4E8A55'; c.fill(); c.stroke(); c.fillRect(x - 2, y - 12, 4, 9); c.strokeRect(x - 2, y - 12, 4, 9); }); break; }
    case 'live': { box('olive', 26); c.strokeStyle = OUT; c.lineWidth = 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(22 + k * 6, 42 + k * 3); c.lineTo(22 + k * 6, 62 + k * 3); c.stroke(); } lamp(c, 64, 44, 2.5); break; }
    case 'rare': { iso(c, 48, 36, 26, 26, 18, P.dark); [[40, 34, '#F2B64A'], [52, 30, '#D0764A'], [58, 38, '#F2B64A']].forEach(([x, y, col]) => { c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 5, y); c.lineTo(x, y + 4); c.lineTo(x - 5, y); c.closePath(); c.fill(); c.stroke(); }); break; }
    case 'mainframe': { iso(c, 48, 12, 22, 22, 50, P.teal); for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#F2B64A' : '#8FE0C8'; c.fillRect(30 + (k % 2) * 6, 32 + k * 6, 4, 2); } lamp(c, 60, 46, 2.5); break; }
    case 'reactor': { cyl(c, 48, 22, 22, 42, ['#EFE2C2', '#D6C39C', '#9E8A62']); c.strokeStyle = '#D9962E'; c.lineWidth = 5; [38, 54].forEach(y => { c.beginPath(); c.ellipse(48, y, 22, 9, 0, 0, Math.PI); c.stroke(); }); lamp(c, 48, 46, 4); break; }
    case 'reactor2': { cyl(c, 48, 20, 25, 46, ['#8FBFC4', '#3F6A72', '#243E45']); c.strokeStyle = '#F2B64A'; c.lineWidth = 5; [32, 44, 56].forEach(y => { c.beginPath(); c.ellipse(48, y, 25, 10, 0, 0, Math.PI); c.stroke(); }); lamp(c, 48, 46, 5); break; }
    case 'cruise': case 'cruise2': { const big = kind === 'cruise2'; c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.moveTo(34, 20); c.lineTo(62, 20); c.lineTo(big ? 76 : 70, 66); c.lineTo(big ? 20 : 26, 66); c.closePath(); c.fillStyle = big ? '#3F6A72' : '#4A4D52'; c.fill(); c.stroke(); c.fillStyle = '#A8532F'; c.fillRect(36, 30, 24, 6); c.beginPath(); c.ellipse(48, 66, big ? 28 : 22, 8, 0, 0, 7); c.fillStyle = '#9CD3FF'; c.fill(); c.stroke(); break; }
    case 'maneuver': case 'maneuver2': { const big = kind === 'maneuver2'; c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.roundRect(20, 34, 56, big ? 28 : 22, 11); c.fillStyle = big ? '#5E8C92' : '#EFE2C2'; c.fill(); c.stroke(); [26, big ? 70 : 64].forEach(x => { c.beginPath(); c.ellipse(x, 48, 5, 9, 0, 0, 7); c.fillStyle = '#4A4D52'; c.fill(); c.stroke(); }); c.fillStyle = '#F2B64A'; c.fillRect(44, 34, 6, big ? 28 : 22); break; }
    case 'cargo': case 'cargo2': { iso(c, 48, 20, 30, 30, 26, P.cream); c.fillStyle = '#6C7B45'; c.beginPath(); c.moveTo(22, 40); c.lineTo(44, 51); c.lineTo(44, 68); c.lineTo(22, 57); c.closePath(); c.fill(); if (kind === 'cargo2') { iso(c, 76, 44, 12, 12, 14, P.rust); iso(c, 24, 58, 12, 12, 14, P.teal); } break; }
    case 'ansible': { c.lineWidth = 2.5; c.strokeStyle = OUT; c.beginPath(); c.moveTo(48, 76); c.lineTo(48, 40); c.stroke(); c.beginPath(); c.ellipse(46, 36, 26, 14, -0.5, 0, 7); c.fillStyle = '#EFE2C2'; c.fill(); c.stroke(); c.beginPath(); c.ellipse(48, 38, 12, 6, -0.5, 0, 7); c.fillStyle = '#D6C39C'; c.fill(); lamp(c, 48, 20, 3); break; }
    default: box('cream');
  }
  return cv.toDataURL();
}
const KIND = { ore: 'ore', titanium: 'metal', chinesium: 'metal', 'rare.earth': 'rare', chips: 'tech', optics: 'tech', mainframe: 'mainframe', electronics: 'consumer', trinkets: 'consumer', textiles: 'consumer', grain: 'food', protein: 'food', spice: 'luxury', artifacts: 'luxury', water: 'liquid', reagents: 'chemical', polymer: 'chemical', hydrogen: 'gas', liquor: 'bottle', livestock: 'live',
  'reactor.mk1': 'reactor', 'reactor.mk2': 'reactor2', 'cruise.mk1': 'cruise', 'cruise.mk2': 'cruise2', 'maneuver.mk1': 'maneuver', 'maneuver.mk2': 'maneuver2', 'cargo.mk1': 'cargo', 'cargo.mk2': 'cargo2', 'ansible.mk1': 'ansible',
  'cargo.tank': 'liquid', 'cargo.reefer': 'gas', 'cargo.pen': 'live', 'radar.mk1': 'ansible', 'driver.mk1': 'mainframe' };
// the domain modules have painted icons in art/; the rest are drawn here
const ICONS = {}; const ico = gid => ICONS[gid] ??= M[gid] ? `art/mod-${gid.replace('.', '-')}.webp` : icon(KIND[gid] ?? 'box');

// ── drag: a ghost follows the pointer; the screen decides the drop ─
function dragFrom(el, make) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; const d = make(e); if (!d) return; e.preventDefault();
    const ghost = document.createElement('img'); ghost.className = 'ghost-drag'; ghost.src = d.src; ghost.alt = ''; document.body.appendChild(ghost);
    let moved = false; const x0 = e.clientX, y0 = e.clientY;
    const move = ev => { if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; moved = true; ghost.style.transform = `translate(${ev.clientX - 28}px, ${ev.clientY - 28}px)`; ghost.style.opacity = 1; d.move?.(ev.clientX, ev.clientY); };
    const up = ev => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); ghost.remove(); moved ? d.drop?.(ev.clientX, ev.clientY) : d.click?.(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
}
