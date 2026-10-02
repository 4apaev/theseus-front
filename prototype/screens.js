// ── ui helpers inside a bezel ──────────────────────────────────────
const pct = (x, y) => `left:${x / 12.8}%;top:${y / 7.2}%`;
function ui(el) { let u = $('.ui', el); if (!u) { el.insertAdjacentHTML('beforeend', '<div class="ui"></div>'); u = $('.ui', el); } return u; }
function card(el, x, y, body, cls = '') {
  $('.card', el)?.remove();
  const c = document.createElement('div'); c.className = 'card ' + cls; c.innerHTML = body; ui(el).appendChild(c);
  const b = el.getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight, px = x / VW * b.width, py = y / VH * b.height;
  c.style.left = clamp(px + 14, 8, b.width - cw - 8) + 'px'; c.style.top = clamp(py - ch / 2, 8, b.height - ch - 8) + 'px';
  return c;
}
const row = (k, v, cls = '') => `<div class="kv ${cls}"><span>${k}</span><span>${v}</span></div>`;
const shapeTxt = gid => shape(gid).join('×');

// ══ PORT · Sol Outpost ═══════════════════════════════════════════
function port(el) {
  const st = new Stage(el, { planet: 'ocean', px: 1125, py: 150, pr: 250, tilt: 0.35, light: [-0.75, 0.4, 0.55], spin: 1 / 240 });
  const B = st.back, F = st.front;
  const far = st.sprite(B, 'ship-02', { x: -120, y: 96, w: 120, ax: 0.5, ay: 0.5, z: -1, a: 0.9 });
  st.sprite(B, 'platform-02', { x: 1030, y: 560, w: 560, ax: 0.5, ay: 0.5, z: 0 });
  st.sprite(B, 'platform-01', { x: 560, y: 420, w: 820, ax: 0.5, ay: 0.5, z: 1 });
  const beacons = [[211, 336], [905, 350], [530, 515], [517, 176], [694, 253]].map(([x, y], i) => { const g = glowSprite(0xFFB54A, 40); g.material.depthTest = false; g.position.set(x, -y, 0); g.renderOrder = 1.5; B.add(g); return g; });
  st.sprite(B, 'structure-01', { x: 372, y: 326, w: 300, z: 2 });
  st.sprite(B, 'structure-02', { x: 716, y: 300, w: 165, z: 2 });
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthTest: false, depthWrite: false, opacity: 0.55 }));
  shade.scale.set(400, 120, 1); shade.position.set(553, -392, 0); shade.rotation.z = 0.49; shade.renderOrder = 2.5; B.add(shade);
  lights(st.scene);
  const ship = new Ship(S.rig, { legs: true }); ship.group.rotation.y = -Math.PI / 2; ship.group.position.y = ship.floor ?? 1.6; st.scene.add(ship.group);
  const s = 50, O = [553, 390];
  st.cam = new THREE.OrthographicCamera(-O[0] / s, (VW - O[0]) / s, O[1] / s, -(VH - O[1]) / s, 0.1, 200);
  const az = 42 * Math.PI / 180, elv = 29 * Math.PI / 180; st.cam.position.set(Math.sin(az) * Math.cos(elv) * 60, Math.sin(elv) * 60, Math.cos(az) * Math.cos(elv) * 60); st.cam.lookAt(0, 0, 0);
  on('rig', () => SLOT_IDS.forEach(id => ship.slots[id].id !== S.rig[id] && ship.fit(id, S.rig[id], false)));
  st.sprite(F, 'cargo-01', { x: 292, y: 452, w: 76, z: 3 });
  st.sprite(F, 'cargo-02', { x: 1000, y: 585, w: 96, z: 3 });
  st.sprite(F, 'cargo-01', { x: 1080, y: 628, w: 66, z: 3 });
  const bots = GLTF ? [[glbModel('deckhand', 0.8), [3.0, -4.0], [3.0, 2.2], 16, 0], [glbModel('porter', 0.8), [9.0, -1.0], [13.6, -1.0], 13, 0.3], [glbModel('deckhand', 0.75), [-2.4, 2.6], [-4.6, -2.0], 19, 0.6]] : [];
  bots.forEach(([g]) => st.scene.add(g));
  st.ticks.push((t, dt) => {
    ship.tick(t, dt);
    beacons.forEach((g, i) => g.material.opacity = 0.5 + 0.45 * Math.sin(t * 2.2 + i * 1.7));
    bots.forEach(([g, a, b, period, ph]) => patrol(g, a, b, t, dt, period, ph));
    st.place(far, (t * 16) % 1600 - 160, 96 + Math.sin(t * 0.4) * 5);
  });
  const u = ui(el);
  u.insertAdjacentHTML('beforeend', html`
    <a class="tag" href="#exchange" style="${pct(1040, 470)}">exchange</a>
    <a class="tag" href="#rigging" style="${pct(372, 150)}">rigging</a>
    <button class="tag" data-comms style="${pct(716, 150)}">comms <i class="dot"></i></button>
    <a class="tag hot" href="#exchange" style="${pct(600, 262)}">far treasure · hold</a>`);
  $('[data-comms]', u).addEventListener('click', () => card(el, 716, 260, `<div class="h">ember station · personal</div><p class="prose">"You won't recognise the dock. Mum retired two winters ago. We kept your berth."</p><div class="mut">sent 31.4 galaxy years ago · 25.1 for you · example</div>`, 'letter'));
  hud(el, '<b>sol outpost</b> · sol · 1.00 au · home'); tabs(el, 'port');
}
const SHADOW = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(10,8,6,.9)'); g.addColorStop(0.6, 'rgba(10,8,6,.45)'); g.addColorStop(1, 'rgba(10,8,6,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();

// ══ EXCHANGE · drag goods into the hold ══════════════════════════
const MARKET = 'sol.outpost', LIST = ['ore', 'electronics', 'titanium', 'chips', 'grain', 'spice', 'mainframe', 'hydrogen', 'water', 'livestock'];
function holdView(host, { pieceDrag } = {}) {
  const grid = document.createElement('div'); grid.className = 'grid'; host.appendChild(grid);
  const draw = (pending = []) => {
    const R = rows(); grid.style.setProperty('--rows', R); grid.innerHTML = '';
    for (let y = 0; y < R; y++) for (let x = 0; x < COLS; x++) grid.insertAdjacentHTML('beforeend', `<i class="cell" style="--x:${x};--y:${y}"></i>`);
    const add = (p, cls) => { const d = document.createElement('div'); d.className = 'piece ' + cls; d.style.cssText = `--x:${p.x};--y:${p.y};--w:${p.w};--h:${p.h}`; d.innerHTML = `<img src="${ico(p.gid)}" alt="${G[p.gid].n}">`; d.title = `${G[p.gid].n} · ${p.w}×${p.h}`; grid.appendChild(d); pieceDrag && cls === '' && pieceDrag(d, p); return d; };
    S.hold.forEach(p => add(p, '')); pending.forEach(p => add(p, 'pend'));
  };
  const cellAt = (cx, cy, w = 1, h = 1) => { const b = grid.getBoundingClientRect(), cs = b.width / COLS; if (cx < b.left - cs || cx > b.right + cs || cy < b.top - cs || cy > b.bottom + cs) return; return { x: Math.round((cx - b.left) / cs - w / 2), y: Math.round((cy - b.top) / cs - h / 2) }; };
  const ghost = document.createElement('div'); ghost.className = 'fit-ghost'; ghost.hidden = true;
  const showGhost = (at, w, h, ok) => { if (!at) return ghost.hidden = true; if (!ghost.isConnected) grid.appendChild(ghost); ghost.hidden = false; ghost.className = 'fit-ghost ' + (ok ? 'ok' : 'bad'); ghost.style.cssText = `--x:${at.x};--y:${at.y};--w:${w};--h:${h}`; };
  draw(); return { grid, draw, cellAt, showGhost };
}
function exchange(el) {
  const st = new Stage(el, { planet: 'ocean', px: 170, py: 120, pr: 200, tilt: -0.3, light: [0.7, 0.5, 0.5], rot0: 2, spin: 1 / 260 });
  st.sprite(st.back, 'platform-02', { x: 520, y: 330, w: 980, ax: 0.5, ay: 0.5, z: 0 });
  lights(st.scene);
  { const s = 59.8, O = [520, 330], az = 42 * Math.PI / 180, elv = 29 * Math.PI / 180;
    st.cam = new THREE.OrthographicCamera(-O[0] / s, (VW - O[0]) / s, O[1] / s, -(VH - O[1]) / s, 0.1, 200);
    st.cam.position.set(Math.sin(az) * Math.cos(elv) * 60, Math.sin(elv) * 60, Math.cos(az) * Math.cos(elv) * 60); st.cam.lookAt(0, 0, 0); }
  if (GLTF) { kitBox(st, 'container_20', [-5.4, -0.9], 1.25); kitBox(st, 'container_20', [-5.4, -0.9], 1.25, 0, 1.25); kitBox(st, 'container_reefer', [-2.2, -1.0], 1.25); kitBox(st, 'container_40', [3.0, -1.0], 1.25); }
  const crew = GLTF ? [[glbModel('deckhand', 0.8), [-3.6, 1.2], [2.6, 1.2], 14, 0], [glbModel('porter', 0.8), [5.0, 0.3], [-1.2, 0.3], 11, 0.4]] : [];
  crew.forEach(([g]) => st.scene.add(g));
  st.ticks.push((t, dt) => crew.forEach(([g, a, b, period, ph]) => patrol(g, a, b, t, dt, period, ph)));
  const u = ui(el);
  u.insertAdjacentHTML('beforeend', html`
    <div class="tray market"><div class="lbl">sol outpost exchange · drag a good into your hold · ▲ made here ▼ wanted here</div><div class="tiles"></div></div>
    <div class="holdp"><div class="lbl"><span>hold · dry</span><b class="hc"></b></div><div class="gridhost"></div><div class="lbl mut">drag a piece back to the counter to sell · r rotates</div></div>`);
  const tiles = $('.tiles', u), market = $('.market', u), hc = $('.hc', u);
  const upd = () => hc.textContent = `${used()} / ${stats(S.rig).capacity}`;
  let pend = [], rot = false;
  const hv = holdView($('.gridhost', u), { pieceDrag: (d, p) => dragFrom(d, () => ({ src: ico(p.gid), move(x, y) { market.classList.toggle('over', over(market, x, y)); const at = hv.cellAt(x, y, p.w, p.h); hv.showGhost(at, p.w, p.h, at && free(S.hold, at.x, at.y, p.w, p.h, p)); }, drop(x, y) { hv.showGhost(); market.classList.remove('over'); if (over(market, x, y)) return sell(p, x, y); const at = hv.cellAt(x, y, p.w, p.h); if (at && free(S.hold, at.x, at.y, p.w, p.h, p)) { p.x = at.x; p.y = at.y; emit('hold'); } } })) });
  const over = (n, x, y) => { const b = n.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; };
  LIST.forEach(gid => {
    const g = G[gid], q = quote(MARKET, gid), st2 = ST[MARKET], flag = st2.pr[gid] ? '<i class="made">▲</i>' : st2.co[gid] ? '<i class="want">▼</i>' : '';
    tiles.insertAdjacentHTML('beforeend', `<button class="tile" data-gid="${gid}" title="${g.n} · ${g.f} · volume ${g.v}">${flag}<img src="${ico(gid)}" alt=""><span class="n">${gid}</span><span class="px">${fmt(q.ask)} ₢</span></button>`);
    const tile = tiles.lastElementChild;
    dragFrom(tile, () => ({ src: ico(gid),
      move(x, y) { let [w, h] = shape(gid); if (rot) [w, h] = [h, w]; const at = hv.cellAt(x, y, w, h); hv.showGhost(at, w, h, at && g.f === 'dry' && free(S.hold.concat(pend), at.x, at.y, w, h)); },
      drop(x, y) { let [w, h] = shape(gid); if (rot) [w, h] = [h, w]; const at = hv.cellAt(x, y, w, h); hv.showGhost(); if (at) buy(gid, at, w, h, x, y); },
      click() { const b = hv.grid.getBoundingClientRect(); buy(gid, spot(S.hold, ...shape(gid)), ...shape(gid), b.left + b.width / 2, b.top); } }));
  });
  addEventListener('keydown', e => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey) rot = !rot; });
  function buy(gid, at, w, h, cx, cy) {
    const g = G[gid];
    if (g.f !== 'dry') return toast(el, `${g.n} is ${g.f} · the dry hold needs ${FORM_NEEDS[g.f]}`, 'bad');
    if (!at || !free(S.hold, at.x, at.y, w, h)) { at = spot(S.hold, w, h, at); if (!at) return toast(el, `no ${w}×${h} space left in the hold`, 'bad'); w = at.w; h = at.h; }
    pend = [{ id: 0, gid, x: at.x, y: at.y, w, h }];
    const ask = quote(MARKET, gid).ask, [vx, vy] = st.virt(cx, cy);
    const render = () => { hv.draw(pend); const n = pend.length, total = Math.round(ask * n); const c = card(el, vx, vy, `<div class="h">${g.n}<span class="chip">${g.f} · ${w}×${h}</span></div>${row('quantity', `<span class="step"><button data-d="-1" aria-label="one less">−</button><b>${n}</b><button data-d="1" aria-label="one more">+</button></span>`)}${row('ask', `${fmt(ask, 1)} ₢`)}${row('total', `<b>${fmt(total)} ₢</b>`)}${row('hold after', `${used() + n * w * h} / ${stats(S.rig).capacity}`)}${total > S.wallet ? '<div class="warn">not enough ₢</div>' : ''}<div class="btns"><button class="go" data-go ${total > S.wallet ? 'disabled' : ''}>buy ${n} · ${fmt(total)} ₢</button><button data-no>cancel</button></div>`);
      c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (+b.dataset.d > 0) { const p = stow(gid, pend[0], S.hold.concat(pend)); p ? pend.push(p) : toast(el, 'the hold is full', 'bad'); } else if (pend.length > 1) pend.pop(); render(); });
      c.querySelector('[data-go]').onclick = () => { pend.forEach(p => S.hold.push({ ...p, id: ++PID })); pay(-total, 'buy'); pend = []; c.remove(); emit('hold'); };
      c.querySelector('[data-no]').onclick = () => { pend = []; c.remove(); hv.draw(); };
    };
    render();
  }
  function sell(p, cx, cy) {
    const same = S.hold.filter(q => q.gid === p.gid), bid = quote(MARKET, p.gid).bid, [vx, vy] = st.virt(cx, cy); let n = 1;
    const render = () => { const total = Math.round(bid * n), c = card(el, vx, vy - 80, `<div class="h">sell ${G[p.gid].n}</div>${row('quantity', `<span class="step"><button data-d="-1" aria-label="one less">−</button><b>${n}</b><button data-d="1" aria-label="one more">+</button></span>`)}${row('bid', `${fmt(bid, 1)} ₢`)}${row('total', `<b class="te">+${fmt(total)} ₢</b>`)}<div class="btns"><button class="go" data-go>sell ${n} · ${fmt(total)} ₢</button><button data-no>cancel</button></div>`);
      c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { n = clamp(n + +b.dataset.d, 1, same.length); render(); });
      c.querySelector('[data-go]').onclick = () => { [p, ...same.filter(q => q !== p)].slice(0, n).forEach(q => S.hold.splice(S.hold.indexOf(q), 1)); pay(total, 'sell'); c.remove(); emit('hold'); };
      c.querySelector('[data-no]').onclick = () => c.remove(); };
    render();
  }
  on('hold', () => { hv.draw(pend); upd(); }); on('rig', () => { hv.draw(pend); upd(); }); upd();
  hud(el, '<b>sol outpost</b> · exchange'); tabs(el, 'exchange');
}

// ══ RIGGING · Ganymede Yards ═════════════════════════════════════
const YARD = 'sol.ganymede';
// the tray holds every module: the yard's stock, the rest of the catalogue, the planned ones
const famOf = id => M[id]?.family ?? PLANNED_FAMILY[id], nameOf = id => G[id]?.n ?? PLANNED[id];
const slotOrder = id => SLOT_IDS.findIndex(s => FAMILY[s] === famOf(id));
const CATALOGUE = [...Object.keys(M), ...Object.keys(PLANNED)].sort((a, b) => slotOrder(a) - slotOrder(b));
const sellers = id => Object.values(ST).filter(t => t.stocks?.includes(id)).map(t => t.name.toLowerCase());
function rigging(el) {
  const st = new Stage(el, { blueprint: true });
  st.live = true; lights(st.scene, 1.05);
  const ship = new Ship(S.rig); st.scene.add(ship.group);
  const cam = st.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200); cam.filmOffset = 3.2;
  const view = { az: 0.55, el: 0.3, dist: 16, auto: true, ta: 0.55, te: 0.3, name: 'iso' };
  const aim = () => { cam.position.set(Math.sin(view.az) * Math.cos(view.el) * view.dist, Math.sin(view.el) * view.dist, Math.cos(view.az) * Math.cos(view.el) * view.dist); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); };
  el.addEventListener('pointerdown', e => { if (e.target.closest('.ui button, .ui .tile, .card, .tray')) return; view.auto = false; view.name = 'free'; const x0 = e.clientX, y0 = e.clientY, a0 = view.az, e0 = view.el; const mv = ev => { view.az = a0 - (ev.clientX - x0) * 0.008; view.el = clamp(e0 + (ev.clientY - y0) * 0.006, -0.2, 1.5); st.dirty = true; }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  st.ticks.push((t, dt) => { if (view.auto) view.az = 0.55 + Math.sin(t * 0.12) * 0.5; else if (view.name !== 'free') { view.az = lerp(view.az, view.ta, Math.min(1, dt * 4)); view.el = lerp(view.el, view.te, Math.min(1, dt * 4)); } aim(); ship.tick(t, dt); ship.group.position.y = Math.sin(t * 0.6) * 0.04; });
  aim();
  const u = ui(el);
  u.insertAdjacentHTML('beforeend', html`
    <div class="marks">${SLOT_IDS.map(id => `<button class="mark ${['cruise1', 'power1'].includes(id) ? 'l' : ''}" data-slot="${id}"><i></i><span><b>${id}</b><em></em></span></button>`).join('')}</div>
    <svg class="dims" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true"><line class="axis"/><g class="dim"><line class="d0"/><line class="d1"/><line class="d2"/><text>length 50 m · example</text></g></svg>
    <div class="spec"><div class="lbl">far treasure · starter hull · 5 light slots</div><div class="stats"></div></div>
    <div class="views" role="group" aria-label="view"><button data-v="iso" class="on">iso</button><button data-v="side">side</button><button data-v="top">top</button></div>
    <div class="titleblock"><b>far treasure</b><span>tramp freighter · starter hull</span><dl><div><dt>dwg</dt><dd>01</dd></div><div><dt>rev</dt><dd>c</dd></div><div><dt>view</dt><dd class="vw">iso</dd></div><div><dt>class</dt><dd>freight</dd></div></dl></div>
    <div class="tray yard"><div class="lbl">every module · a price means in stock here · drag one onto a slot · drag a slot here to strip it</div><div class="tiles"></div></div>`);
  const marks = Object.fromEntries(SLOT_IDS.map(id => [id, $(`[data-slot="${id}"]`, u)])), tiles = $('.yard .tiles', u), tray = $('.yard', u), spec = $('.stats', u);
  const v3 = new THREE.Vector3();
  const svg = $('.dims', u), P = (x, y) => { v3.set(x, y, 0).applyMatrix4(ship.group.matrixWorld).project(cam); return [(v3.x + 1) / 2 * VW, (1 - v3.y) / 2 * VH]; };
  const seg = (n, [a, b], [c, d]) => { n.setAttribute('x1', a); n.setAttribute('y1', b); n.setAttribute('x2', c); n.setAttribute('y2', d); };
  st.after = () => {
    ship.group.updateMatrixWorld(); for (const id of SLOT_IDS) { v3.copy(ship.slots[id].mark).applyMatrix4(ship.group.matrixWorld).project(cam); const m = marks[id]; m.style.left = ((v3.x + 1) / 2 * 100) + '%'; m.style.top = ((1 - v3.y) / 2 * 100) + '%'; }
    const bow = 5.05, aft = -4.3, low = -1.7;
    seg($('.axis', svg), P(bow + 1.4, 0), P(aft - 1.4, 0));
    const a = P(bow, low), b = P(aft, low); seg($('.d0', svg), a, b); seg($('.d1', svg), P(bow, low + .35), P(bow, low - .35)); seg($('.d2', svg), P(aft, low + .35), P(aft, low - .35));
    const tx = $('text', svg); tx.setAttribute('x', (a[0] + b[0]) / 2); tx.setAttribute('y', (a[1] + b[1]) / 2 - 10);
  };
  u.querySelectorAll('[data-v]').forEach(btn => btn.onclick = () => { const v = { iso: [0.55, 0.3], side: [0, 0.02], top: [0, 1.5] }[btn.dataset.v]; view.auto = false; view.name = btn.dataset.v; view.ta = v[0]; view.te = v[1]; u.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === btn)); $('.vw', u).textContent = btn.dataset.v; });
  const bar = (a, b, max) => `<span class="bar" style="--a:${a / max * 100}%;--b:${b / max * 100}%"></span>`;
  function drawSpec(next) {
    const a = stats(S.rig), b = next ? stats(next) : a, arrow = (x, y, f = v => v) => x === y ? f(x) : `${f(x)} → <b class="te">${f(y)}</b>`;
    spec.innerHTML = row('power', `${arrow(`${a.power.used}/${a.power.available}`, `${b.power.used}/${b.power.available}`)}`) + bar(b.power.used, b.power.available, 12) + row('cruise', arrow(a.velocity, b.velocity, v => v.toFixed(3) + 'c')) + row('thrust', arrow(a.acceleration, b.acceleration, v => v.toFixed(3) + ' m/s²')) + row('hold', arrow(a.capacity, b.capacity, v => v + ' cells'));
    SLOT_IDS.forEach(id => $('em', marks[id]).textContent = S.rig[id] ? G[S.rig[id]].n : 'empty');
  }
  function drawTray() {
    const stock = ST[YARD].stocks, held = S.hold.filter(p => M[p.gid]).map(p => ({ id: p.gid, from: 'hold', piece: p }));
    const all = CATALOGUE.map(id => ({ id, from: stock.includes(id) ? 'yard' : PLANNED[id] ? 'plan' : 'try' })).concat(held);
    const tag = o => o.from === 'yard' ? fmt(Math.round(quote(YARD, o.id).ask)) + ' ₢' : { hold: 'in hold', plan: 'planned', try: 'try it' }[o.from];
    tiles.innerHTML = all.map((o, i) => `<button class="tile ${o.from}" data-i="${i}" title="${nameOf(o.id)}"><img src="${ico(o.id)}" alt=""><span class="n">${o.id.replace('.', ' ')}</span><span class="px">${tag(o)}</span></button>`).join('');
    tiles.querySelectorAll('.tile').forEach((t, i) => { const o = all[i]; dragFrom(t, () => ({ src: ico(o.id),
      move(x, y) { const s = slotAt(x, y); SLOT_IDS.forEach(id => marks[id].classList.toggle('fits', FAMILY[id] === famOf(o.id))); SLOT_IDS.forEach(id => marks[id].classList.toggle('over', id === s)); },
      drop(x, y) { clearMarks(); const s = slotAt(x, y); if (s) propose(s, o.id, o.from, o.piece); },
      click() { const s = SLOT_IDS.find(id => FAMILY[id] === famOf(o.id)); propose(s, o.id, o.from, o.piece); } })); });
  }
  const clearMarks = () => SLOT_IDS.forEach(id => marks[id].classList.remove('fits', 'over'));
  const slotAt = (x, y) => SLOT_IDS.map(id => { const b = $('i', marks[id]).getBoundingClientRect(); return [id, Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2))]; }).sort((a, b) => a[1] - b[1]).find(([, d]) => d < 60)?.[0];
  /* a fit the yard would refuse is still a fit to look at: check() lists the reasons in `why`.
     only a module for another slot family, or a strip the rig cannot take, is refused outright */
  function check(slot, newId, from, piece) {
    if (newId && famOf(newId) !== FAMILY[slot]) return { err: `${nameOf(newId)} fits a ${famOf(newId)} slot, not ${slot}` };
    const oldId = S.rig[slot], rig2 = { ...S.rig, [slot]: newId };
    if (PLANNED[newId]) return { oldId, rig2, why: ['a planned module · the domain has no numbers for it yet'] };
    const v = validate(rig2), why = v.errs.map(e => e + (e.includes('power rank 2') ? ' · fit reactor mk2 first' : ''));
    const sold = from === 'try' && sellers(newId);
    if (sold) why.push('ganymede yards does not stock it' + (sold.length ? ' · ' + sold.join(', ') + ' sell it' : ''));
    const cost = from === 'yard' ? Math.round(quote(YARD, newId).ask) : 0;
    if (cost > S.wallet) why.push(`not enough ₢ · ${nameOf(newId)} costs ${fmt(cost)} ₢`);
    const R2 = Math.ceil(v.stats.capacity / COLS), hold2 = S.hold.filter(p => p !== piece).map(p => ({ ...p }));
    if (hold2.some(p => p.y + p.h > R2)) why.push('cargo would sit outside the smaller hold · sell or move it first');
    else if (oldId && !stow(oldId, undefined, hold2, R2)) why.push(`no ${shapeTxt(oldId)} space in the hold for the ${G[oldId].n} package`);
    if (!newId && why.length) return { err: why[0] };
    return { oldId, cost, rig2, hold2, stats2: v.stats, why };
  }
  function tryCard(slot, newId, from, r, vx, vy) {
    $('em', marks[slot]).textContent = 'try · ' + nameOf(newId);
    const src = { yard: `ganymede yards · <b>${fmt(r.cost)} ₢</b>`, hold: 'your hold', plan: 'the drawing board', try: 'another yard' }[from];
    const c = card(el, vx, vy, `<div class="h">try ${nameOf(newId)}<span class="chip">${slot}</span></div>${row('from', src)}${r.stats2 ? row('power after', `${r.stats2.power.used} / ${r.stats2.power.available}`) : ''}<div class="warn2">the yard would refuse this rig:</div>${r.why.map(w => `<div class="why">· ${w}</div>`).join('')}<div class="btns"><button class="go" data-keep>keep the look</button><button data-no>undo</button></div>`);
    c.querySelector('[data-keep]').onclick = () => c.remove();
    c.querySelector('[data-no]').onclick = () => { ship.fit(slot, S.rig[slot]); drawSpec(); c.remove(); };
  }
  function propose(slot, newId, from, piece) {
    if (!slot) return;
    const r = check(slot, newId, from, piece);
    if (r.err) { marks[slot].classList.add('bad'); setTimeout(() => marks[slot].classList.remove('bad'), 700); return toast(el, r.err, 'bad'); }
    ship.fit(slot, newId); r.stats2 ? drawSpec(r.rig2) : drawSpec();
    const b = $('i', marks[slot]).getBoundingClientRect(), [vx, vy] = st.virt(b.right, b.top);
    if (r.why.length) return tryCard(slot, newId, from, r, vx, vy);
    const what = newId ? `fit ${G[newId].n}` : `strip ${G[r.oldId].n}`;
    const c = card(el, vx, vy, `<div class="h">${what}<span class="chip">${slot}</span></div>${newId ? row('from', from === 'yard' ? `ganymede yards · <b>${fmt(r.cost)} ₢</b>` : 'your hold') : ''}${r.oldId ? row('old module', `${G[r.oldId].n} → hold · ${shapeTxt(r.oldId)}`) : ''}${row('power after', `${r.stats2.power.used} / ${r.stats2.power.available}`)}<div class="btns"><button class="go" data-go>${newId ? (r.cost ? `fit · ${fmt(r.cost)} ₢` : 'fit') : 'strip'}</button><button data-no>undo</button></div>`);
    c.querySelector('[data-go]').onclick = () => { S.rig = r.rig2; S.hold.length = 0; r.hold2.forEach(p => S.hold.push({ ...p, id: p.id || ++PID })); r.cost && pay(-r.cost, 'fit'); c.remove(); emit('rig'); emit('hold'); };
    c.querySelector('[data-no]').onclick = () => { ship.fit(slot, S.rig[slot]); drawSpec(); c.remove(); };
  }
  SLOT_IDS.forEach(id => dragFrom(marks[id], () => S.rig[id] && ({ src: ico(S.rig[id]), move(x, y) { tray.classList.toggle('over', over2(tray, x, y)); }, drop(x, y) { tray.classList.remove('over'); if (over2(tray, x, y)) propose(id, null, 'strip'); }, click() { toast(el, `${id} · ${G[S.rig[id]].n} · drag it to the tray to strip it`); } })));
  const over2 = (n, x, y) => { const b = n.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; };
  on('rig', () => { drawSpec(); drawTray(); SLOT_IDS.forEach(id => ship.slots[id].id !== S.rig[id] && ship.fit(id, S.rig[id])); }); on('hold', drawTray); on('wallet', drawTray);
  drawSpec(); drawTray();
  hud(el, '<b>ganymede yards</b> · sol · 5.20 au · stocks mk2'); tabs(el, 'rigging');
}

// ══ CHART · the neighbourhood in 3D ══════════════════════════════
const SPECT = { O: 0x9BB0FF, B: 0xAABFFF, A: 0xCAD7FF, F: 0xF8F4E8, G: 0xFFEFC8, K: 0xFFC98A, M: 0xFFA66A };
const spectColor = s => SPECT[(s.replace(/^sd/, '')[0] || 'G').toUpperCase()] ?? 0xFFEFC8;
const toV = ([x, y, z]) => new THREE.Vector3(x, z, -y);
function chart(el) {
  const st = new Stage(el, { band: 1.5, t1: '#2F6F86', t2: '#7A5AB0' }); st.live = true;
  const cam = st.cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 500), sc = st.scene;
  const view = { az: -0.5, el: 0.55, dist: 34, auto: true, k: 0, units: 'ly' };
  const lineMat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const circle = (r, c, o) => { const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(c, o)); };
  const rings = []; for (let r = 2; r <= 14; r += 2) { const l = circle(r, 0x3FB6A8, r % 4 ? 0.2 : 0.38); sc.add(l); rings.push({ r, l }); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(Math.cos(a) * 14, 0, Math.sin(a) * 14)]), lineMat(0x3FB6A8, 0.12))); }
  // the beam: a ring on the plane at 7 ly
  const beamRing = circle(7, 0xF2B134, 0.45); sc.add(beamRing);
  const R0 = routeFrom('sol');
  const nodes = D.sys.map(s => { const ly = toV(s.xyz), d = ly.length(), yr = d ? ly.clone().normalize().multiplyScalar(R0.years[s.id] / GAMMA) : new THREE.Vector3(); const g = glowSprite(spectColor(s.spect), s.id === 'sol' ? 1.5 : 1.15), core = glowSprite(0xffffff, 0.4); sc.add(g); sc.add(core); const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat(0xE8DFCB, 0.5)); sc.add(drop); const foot = circle(0.18, 0xE8DFCB, 0.4); sc.add(foot); return { s, ly, yr, d, g, core, drop, foot, pos: ly.clone() }; });
  const bg = D.bg.filter(b => !D.sys.some(s => toV(s.xyz).distanceTo(toV(b.xyz)) < 0.4)).map(b => { const g = glowSprite(spectColor(b.spect), 0.9); g.material.opacity = 0.55; g.position.copy(toV(b.xyz)); sc.add(g); return { b, g, v: toV(b.xyz) }; });
  const links = D.links.map(([a, b]) => { const A = nodes.find(n => n.s.id === ST[a].sys), Bn = nodes.find(n => n.s.id === ST[b].sys), l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([A.pos, Bn.pos]), lineMat(0x8FA3B8, 0.22)); sc.add(l); return { A, B: Bn, l }; });
  let route, sel;
  const u = ui(el);
  u.insertAdjacentHTML('beforeend', html`
    <div class="labels">${nodes.map((n, i) => `<button class="star" data-i="${i}"><i></i><span>${n.s.name.toLowerCase()}</span><small></small></button>`).join('')}${bg.map(b => `<span class="bgstar">${b.b.n.toLowerCase()}</span>`).join('')}</div>
    <div class="ringlbl">${rings.filter(r => r.r % 4 === 0).map(r => `<span data-r="${r.r}"></span>`).join('')}</div>
    <div class="maptools"><div class="seg" role="group" aria-label="map units"><button class="on" data-u="ly">light years</button><button data-u="yr">ship years</button></div><button data-z="-1" aria-label="zoom in">+</button><button data-z="1" aria-label="zoom out">−</button></div>
    <div class="legend"><span class="bm">◯ icarus beam · 7 ly</span><span>drag to turn · click a star</span></div>`);
  const labels = [...u.querySelectorAll('.star')], bgl = [...u.querySelectorAll('.bgstar')], rl = [...u.querySelectorAll('.ringlbl span')];
  const aim = () => { cam.position.set(Math.sin(view.az) * Math.cos(view.el) * view.dist, Math.sin(view.el) * view.dist, Math.cos(view.az) * Math.cos(view.el) * view.dist); cam.lookAt(0, 0, 0); };
  el.addEventListener('pointerdown', e => { if (e.target.closest('.ui button, .card')) return; view.auto = false; const x0 = e.clientX, y0 = e.clientY, a0 = view.az, e0 = view.el; const mv = ev => { view.az = a0 - (ev.clientX - x0) * 0.008; view.el = clamp(e0 + (ev.clientY - y0) * 0.006, 0.05, 1.45); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  u.querySelectorAll('[data-z]').forEach(b => b.onclick = () => view.dist = clamp(view.dist * (1 + +b.dataset.z * 0.18), 14, 70));
  u.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { view.units = b.dataset.u; u.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('on', x === b)); $('.card', el)?.remove(); });
  labels.forEach((l, i) => l.onclick = () => select(nodes[i]));
  function select(n) {
    sel = n; if (route) { sc.remove(route); route = undefined; }
    if (n.s.id === 'sol') return card(el, VW / 2, VH / 2, `<div class="h">sol<span class="chip">home</span></div><div class="mut">you are docked at sol outpost.</div>`);
    const path = R0.path(n.s.id), pts = path.map(id => nodes.find(x => x.s.id === id).pos.clone());
    route = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.07, 6, false), new THREE.MeshBasicMaterial({ color: 0xE8612C })); sc.add(route);
    const gy = R0.years[n.s.id], hops = path.length - 1;
    const b = labels[nodes.indexOf(n)].getBoundingClientRect(), [vx, vy] = st.virt(b.left + 20, b.top);
    const c = card(el, vx, vy, `<div class="h">${n.s.name.toLowerCase()}<span class="chip">${n.d <= 7 ? 'inside the beam' : 'frontier'}</span></div><div class="mut">${n.s.star.toLowerCase()} · ${n.s.st.length} station${n.s.st.length > 1 ? 's' : ''}</div>${row('distance', `${n.d.toFixed(2)} ly`)}${row('route', hops === 1 ? 'direct' : path.map(id => SYS[id].name.toLowerCase()).join(' → '))}${row('galaxy years', gy.toFixed(2))}${row('ship years', `<b class="te">${(gy / GAMMA).toFixed(2)}</b>`)}${row('capital at 5%', `×${((1 + RATE) ** gy).toFixed(2)}`)}<div class="btns"><button class="go" data-go>plot course</button><button data-no>close</button></div>`);
    c.querySelector('[data-go]').onclick = () => toast(el, `course plotted to ${n.s.name.toLowerCase()} · this preview does not fly`);
    c.querySelector('[data-no]').onclick = () => { c.remove(); if (route) { sc.remove(route); route = undefined; } sel = undefined; };
  }
  const v3 = new THREE.Vector3();
  st.ticks.push((t, dt) => {
    view.k = clamp(view.k + (view.units === 'yr' ? dt : -dt) * 1.2, 0, 1); const k = easeIO(view.k);
    if (view.auto) view.az += dt * 0.05; aim();
    nodes.forEach(n => { n.pos.lerpVectors(n.ly, n.yr, k); n.g.position.copy(n.pos); n.core.position.copy(n.pos); n.g.material.opacity = 0.5 + 0.12 * Math.sin(t * 2 + n.d); n.drop.geometry.setFromPoints([n.pos, new THREE.Vector3(n.pos.x, 0, n.pos.z)]); n.foot.position.set(n.pos.x, 0, n.pos.z); });
    links.forEach(L => L.l.geometry.setFromPoints([L.A.pos, L.B.pos]));
    if (route && sel) { const pts = R0.path(sel.s.id).map(id => nodes.find(x => x.s.id === id).pos.clone()); route.geometry.dispose(); route.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.07, 6, false); }
    bg.forEach(b => b.g.material.opacity = 0.55 * (1 - k));
    beamRing.material.opacity = 0.45 * (1 - k * 0.8);
  });
  st.after = () => {
    const w = el.clientWidth, h = el.clientHeight, k = easeIO(view.k);
    const put = (node, p) => { v3.copy(p).project(cam); const vis = v3.z < 1; node.style.display = vis ? '' : 'none'; node.style.left = ((v3.x + 1) / 2 * w) + 'px'; node.style.top = ((1 - v3.y) / 2 * h) + 'px'; };
    nodes.forEach((n, i) => { put(labels[i], n.pos); $('small', labels[i]).textContent = n.d ? (k > 0.5 ? `${(R0.years[n.s.id] / GAMMA).toFixed(1)} yr` : `${n.d.toFixed(2)} ly`) : 'you'; });
    bg.forEach((b, i) => { put(bgl[i], b.v); bgl[i].style.opacity = 1 - k; });
    rl.forEach(s => { const r = +s.dataset.r; put(s, new THREE.Vector3(r * 0.707, 0, r * 0.707)); s.textContent = k > 0.5 ? `${r} yr` : `${r} ly`; });
  };
  aim(); hud(el, '<b>chart</b> · 10 stars · hyg catalogue positions'); tabs(el, 'chart');
}

// ══ ADRIFT · the tug ═════════════════════════════════════════════
function adrift(el) {
  const st = new Stage(el, { planet: 'ochre', px: 1090, py: 560, pr: 170, tilt: -0.2, light: [-0.8, 0.35, 0.5], rim: '#FFC99A', night: '#1A1410', spin: 1 / 200, rot0: 1 });
  st.live = true; lights(st.scene); const cam = st.cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200); cam.position.set(0, 1.6, 17); cam.lookAt(0, 0, 0);
  const hulk = new THREE.Group(); hulk.position.x = -2; st.scene.add(hulk);
  let ship = new Ship(S.rig); hulk.add(ship.group); const warn = light(ship.group, [0.6, 1.05, 0], 0xFF3B30, 0.16, 0.9);
  const bits = shards(18, 5); bits.forEach(b => st.scene.add(b));
  const by = GLTF ? glbBuoy() : buoy(); by.visible = false; st.scene.add(by);
  const tg = GLTF ? glbModel('tug', 0.5) : tug(); tg.visible = false; st.scene.add(tg); let tugFire = 0;
  const traffic = GLTF ? glbModel('hauler') : hauler(7); traffic.position.set(-70, 7, -48); st.scene.add(traffic);
  const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xE7A73A })); cable.visible = false; st.scene.add(cable);
  const u = ui(el);
  u.insertAdjacentHTML('beforeend', html`<button class="beacon" hidden aria-label="open the tug buoy"><i></i><span>tug buoy</span></button><div class="status"><b>adrift</b> · no propellant · no destination</div>`);
  const hot = $('.beacon', u), status = $('.status', u);
  let phase = 'drift', t0 = 0, tBuoy = 2.5, paid = 0;
  const NOSE = new THREE.Vector3(5.25, 0, 0), TAIL = new THREE.Vector3(-1.3, 0, 0), v3 = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  function reset() { tugFire = 0; phase = 'drift'; t0 = st.t; tBuoy = st.t + 2.5; by.visible = false; tg.visible = false; cable.visible = false; hot.hidden = true; hulk.position.set(-2, 0, 0); $('.card', el)?.remove(); status.innerHTML = '<b>adrift</b> · no propellant · no destination'; hulk.remove(ship.group); ship = new Ship(S.rig); hulk.add(ship.group); light(ship.group, [0.6, 1.05, 0], 0xFF3B30, 0.16, 0.9); }
  hot.onclick = () => {
    const price = 420, [vx, vy] = [by.userData.vx ?? 900, by.userData.vy ?? 260];
    const c = card(el, vx, vy, `<div class="h">orbital tug<span class="chip">sol outpost dispatch</span></div>${row('tow to', 'sol outpost · 00:42 · example')}${row('price', `${price} ₢ · example`)}<label class="sw"><input type="checkbox" id="adrift-insured" ${S.insured ? 'checked' : ''}> insured · the tow is covered</label><div class="mut small">no ₢? the tug takes cargo first, then modules, at salvage price. never the hull, never the starter rig.</div><div class="btns"><button class="go" data-go>call the tug</button><button data-no>not now</button></div>`);
    const box = c.querySelector('#adrift-insured'); box.onchange = () => S.insured = box.checked;
    c.querySelector('[data-no]').onclick = () => c.remove();
    c.querySelector('[data-go]').onclick = () => { c.remove(); hot.hidden = true; paid = S.insured ? 0 : price; paid && pay(-paid, 'tow'); phase = 'tug'; t0 = st.t; tg.visible = true; status.innerHTML = '<b>tug inbound</b> · hold on'; };
  };
  st.ticks.push((t, dt) => {
    ship.tick(t, dt); liven(tg, t, dt, tugFire); traffic.position.x = -70 + (t * 1.6) % 140; liven(traffic, t, dt, 0.7);
    bits.forEach(m => { const d = m.userData, ang = d.ph + t * d.speed; m.position.set(hulk.position.x + Math.cos(ang) * d.rad, Math.sin(ang) * d.rad * Math.sin(d.tilt) * 0.6, Math.sin(ang) * d.rad * Math.cos(d.tilt)).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.yaw * 0.2); m.rotation.x += d.roll[0] * dt; m.rotation.y += d.roll[1] * dt; m.rotation.z += d.roll[2] * dt; });
    const tumble = [0.35 * Math.sin(t * 0.13) + 0.1, 0.25 + 0.3 * Math.sin(t * 0.09), 0.3 * Math.sin(t * 0.11)];
    if (phase === 'drift' || phase === 'buoy') hulk.rotation.set(...tumble);
    if (phase === 'drift' && t > tBuoy) { phase = 'buoy'; t0 = t; by.visible = true; }
    if (by.visible) { const k = ease(clamp((t - tBuoy) / 4, 0, 1)); by.position.set(lerp(14, 4.6, k), 0.4 + Math.sin(t * 0.8) * 0.12, -2); by.rotation.z = Math.sin(t * 0.5) * 0.08; liven(by, t, 0.016); by.userData.sign.material.opacity = Math.random() > 0.04 ? 1 : 0.35; if (phase === 'buoy' && k >= 1) hot.hidden = false; }
    if (phase === 'tug') {
      const s = t - t0;
      hulk.rotation.x = lerp(hulk.rotation.x, 0, dt * 1.2); hulk.rotation.y = lerp(hulk.rotation.y, 0.2, dt * 1.2); hulk.rotation.z = lerp(hulk.rotation.z, 0, dt * 1.2);
      const dock = new THREE.Vector3(8.6, 0.25, -1.4), k = ease(clamp(s / 3.5, 0, 1));
      if (s < 4.5) { tg.position.set(lerp(20, dock.x, k), lerp(5, dock.y, k), lerp(-8, dock.z, k)); tg.rotation.set(0, lerp(0.8, 0.2, k), 0); tugFire = s < 3 ? 0.35 : 0; }
      cable.visible = s > 3.6;
      if (s >= 4.5) { const m = (s - 4.5), dx = m * m * 0.9; tg.position.set(dock.x + dx, dock.y, dock.z - dx * 0.18); hulk.position.set(-2 + Math.max(0, dx - 0.4), 0, -Math.max(0, dx - 0.4) * 0.18); tugFire = 1; status.innerHTML = '<b>under tow</b> · to sol outpost'; }
      if (cable.visible) { hulk.updateMatrixWorld(true); tg.updateMatrixWorld(true); a.copy(ship.nose ?? NOSE).applyMatrix4(ship.group.matrixWorld); b.copy(TAIL).applyMatrix4(tg.matrixWorld); const pts = []; for (let i = 0; i < 24; i++) { const q = i / 23; pts.push(new THREE.Vector3().lerpVectors(a, b, q).add(new THREE.Vector3(0, -Math.sin(q * Math.PI) * (s < 4.5 ? 0.5 : 0.12), 0))); } cable.geometry.setFromPoints(pts); }
      if (s > 9.5) { phase = 'done'; cable.visible = false; status.innerHTML = '<b>towed</b> · sol outpost'; const c = card(el, 520, 420, `<div class="h">towed to sol outpost</div><div class="mut">${paid ? `you paid ${paid} ₢ for the tow.` : 'insurance covered the tow.'} the far treasure is back at its berth.</div><div class="btns"><button class="go" data-go>drift again</button></div>`, 'center'); c.querySelector('[data-go]').onclick = reset; }
    }
  });
  st.after = () => { if (!by.visible) return; v3.copy(by.position).project(cam); const w = el.clientWidth, h = el.clientHeight; hot.style.left = ((v3.x + 1) / 2 * w) + 'px'; hot.style.top = ((1 - v3.y) / 2 * h) + 'px'; by.userData.vx = (v3.x + 1) / 2 * VW; by.userData.vy = (1 - v3.y) / 2 * VH; };
  hud(el, '<b>far treasure</b> · 0.4 au from sol outpost'); tabs(el, 'adrift');
}

// ══ HANGAR · every model on a turntable ══════════════════════════
const HANGAR_SLOTS = { power1: ['reactor.mk1', 'reactor.mk2', null], cruise1: ['cruise.mk1', 'cruise.mk2', null], maneuver1: ['maneuver.mk1', 'maneuver.mk2', null], cargo1: ['cargo.mk1', 'cargo.mk2', 'cargo.tank', 'cargo.reefer', 'cargo.pen', null], utility1: ['ansible.mk1', 'radar.mk1', 'driver.mk1', null] };
const modName = id => id ? (PLANNED[id] ?? G[id].n) : 'empty';
// m: the real size in metres, the length of a ship or the height of a robot (tall)
const MODELS = [
  { id: 'far', name: 'far treasure', role: 'your ship · starter hull · 5 light slots', m: 50 },
  { id: 'tug', name: 'tug 04', role: 'sol outpost dispatch · it tows the adrift home', m: 35, make: () => GLTF ? glbModel('tug', 0.5) : tug(), fire: 0.6 },
  { id: 'hauler', name: 'container hauler', role: 'npc traffic · 24 boxes between the big ports', m: 59, make: () => GLTF ? glbModel('hauler') : hauler(), fire: 0.7 },
  { id: 'raider', name: 'nobody', role: 'npc raider · salvage, a stolen box, a mass driver', m: 55, make: () => GLTF ? glbModel('nobody', 0.9) : raider(), fire: 0.6 },
  { id: 'cutter', name: 'patrol cutter', role: 'npc police · sol outpost authority', m: 40, make: () => GLTF ? glbModel('patrol-cutter') : cutter(), fire: 0.5 },
  { id: 'buoy', name: 'tug buoy', role: 'an advert that listens for the adrift', m: 12, tall: true, make: () => GLTF ? glbBuoy() : buoy() },
  { id: 'deckhand', name: 'deckhand', role: 'a robot that walks the docks', m: 2, tall: true, make: () => glbModel('deckhand'), walk: true, group: 'robots' },
  { id: 'porter', name: 'porter', role: 'a robot on wheels, with a crate', m: 1.6, tall: true, make: () => glbModel('porter'), walk: true, group: 'robots' },
  { id: 'boxes', name: 'containers', role: '20 ft · 40 ft · high cube · reefer · tank · open top · flat rack', m: 49, make: () => glbModel('containers') },
];
// the hangar fleet: one model per hangar painting, in public/models/painted/hangar
const HANGAR = [
  ['police-light', 'police light', 'authority · a patrol van, two light bars, a shield', 45],
  ['police-heavy', 'police heavy', 'authority · an armoured carrier, four drives, a radar', 85],
  ['freighter', 'freighter', 'trade · three dry holds, two cranes', 280],
  ['tanker', 'tanker', 'trade · six pressure tanks for liquid and gas', 320],
  ['transport', 'transport', 'passengers · a bus between the stations', 70],
  ['liner', 'liner', 'passengers · a market deck, houses in tiers', 380],
  ['colony', 'colony ship', 'settlers · three habitat rings, two gardens', 1600],
  ['research', 'research ship', 'science · a dish, telescopes, sensor booms', 160],
  ['yacht', 'yacht', 'private · a glazed cabin, a winch, a crane', 30],
  ['tug', 'tug', 'service · two jaws and a winch', 40],
  ['prison', 'prison barge', 'authority · six cell blocks', 240],
  ['corvette', 'corvette', 'military · one heavy drive, armour plates', 120],
  ['frigate', 'frigate', 'military · two gun pods on outriggers', 220],
  ['battleship', 'battleship', 'military · armour, three mast towers', 600],
  ['police-patrol', 'patrol robot', 'a police robot that walks the docks', 2, true],
  ['police-inspector', 'inspector robot', 'a police robot with a scanner and a riot shield', 2.6, true],
].map(([file, name, role, m, walk]) => ({ id: 'h-' + file, name, role, m, tall: walk, group: walk ? 'robots' : 'hangar', make: () => glbModel('hangar/' + file), fire: walk ? 0 : 0.6, walk }));
MODELS.push(...HANGAR);
function hangar(el) {
  const st = new Stage(el, { planet: 'ocean', px: 1150, py: 110, pr: 80, tilt: 0.3, light: [-0.7, 0.4, 0.6], spin: 1 / 200, band: 0.8 }); st.live = true;
  lights(st.scene, 1.05);
  const cam = st.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 300); cam.filmOffset = 3.6;
  const pad = new THREE.Group(); st.scene.add(pad);
  for (let r = 1; r <= 5; r++) { const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); } pad.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3FB6A8, transparent: true, opacity: r === 5 ? 0.45 : 0.18, depthWrite: false }))); }
  const view = { az: 0.7, el: 0.28, dist: 17, auto: true };
  let cur, ship, model, ref, fire = 0, legs = false, shownAt = 0; const rig = { ...S.rig }, aim = new THREE.Vector3();
  const MPU = 50 / 8.6;  // metres per scene unit: the far treasure is 8.6 units, 50 m
  const box = o => { const bb = new THREE.Box3(); o.traverse(c => c.isMesh && !c.material.isShaderMaterial && bb.expandByObject(c)); return bb; };
  // a model at its real size. the camera fits it; the far treasure parks beside a ship for scale
  const recenter = () => {
    cur.position.set(0, 0, 0); cur.scale.setScalar(1); cur.updateMatrixWorld(true);
    let bb = box(cur); if (bb.isEmpty()) return;
    const raw = bb.getSize(new THREE.Vector3()); cur.scale.setScalar(model.m / MPU / (model.tall ? raw.y : raw.x)); cur.updateMatrixWorld(true);
    bb = box(cur); const size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
    cur.position.set(-mid.x, 0, -mid.z); bb.translate(new THREE.Vector3(-mid.x, 0, -mid.z));
    if (ref) { ref.group.position.set(0, bb.min.y + ref.floor, -(size.z / 2 + 3.4)); ref.group.updateMatrixWorld(true); bb.union(box(ref.group)); }
    const all = bb.getSize(new THREE.Vector3()); bb.getCenter(aim);
    pad.position.set(aim.x, bb.min.y - 0.08, aim.z); pad.scale.setScalar(Math.max(all.x, all.z) * 0.13);
    view.dist = Math.max(all.x, all.y * 1.6, all.z) * 1.9;
  };
  const sizeTxt = m => m.tall ? `${m.m} m tall` : m.m >= 1000 ? `${(m.m / 1000).toFixed(1)} km` : `${m.m} m`;
  const u = ui(el);
  const column = (label, group) => `<div class="mcol"><div class="mh">${label}</div>${MODELS.map((m, i) => (m.group ?? 'fleet') === group ? `<button data-m="${i}">${m.name}</button>` : '').join('')}</div>`;
  u.insertAdjacentHTML('beforeend', html`<div class="models">${column('the fleet', 'fleet')}${column('the hangar', 'hangar')}${column('robots', 'robots')}</div><div class="spec slotsp"></div><div class="cap2"></div>`);
  const panel = $('.slotsp', u), cap = $('.cap2', u);
  function show(m) {
    if (cur) st.scene.remove(cur); if (ref) st.scene.remove(ref.group); model = m;
    ref = m.id !== 'far' && m.m >= 10 ? new Ship(S.rig) : undefined; ref && st.scene.add(ref.group);
    if (m.id === 'far') { ship = new Ship(rig, { legs }); cur = ship.group; fire = panel.dataset.fire === '1' ? 1 : 0; } else { ship = undefined; cur = m.make(); fire = m.fire ?? 0; }
    st.scene.add(cur); shownAt = st.t; recenter();
    u.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', +b.dataset.m === MODELS.indexOf(m)));
    cap.innerHTML = `<b>${m.name}</b> <span>· ${m.role} · <b>${sizeTxt(m)}</b>${ref ? ' · beside it the far treasure, 50 m' : ''}</span>`; drawPanel();
  }
  function drawPanel() {
    if (model.id !== 'far') { panel.innerHTML = `<div class="lbl">${model.name}</div><div class="mut2">one model, toon light, a dark outline. no slots: npc ships keep one rig.</div><div class="toggles"><button data-t="fire" class="${fire ? 'on' : ''}">drive ${fire ? 'on' : 'off'}</button></div>`; bindToggles(); return; }
    const real = Object.values(rig).every(id => !id || M[id]), v = real ? validate(rig) : undefined, s = v?.stats;
    panel.innerHTML = `<div class="lbl">swap a module per slot · dashed = planned</div>` + SLOT_IDS.map(id => `<div class="srow"><span class="sl">${id}</span><div class="chips">${HANGAR_SLOTS[id].map(m => `<button data-s="${id}" data-id="${m ?? ''}" class="${rig[id] === m ? 'on' : ''} ${m && PLANNED[m] ? 'plan' : ''}">${modName(m)}</button>`).join('')}</div></div>`).join('')
      + `<div class="toggles"><button data-t="fire" class="${fire ? 'on' : ''}">drive ${fire ? 'on' : 'off'}</button><button data-t="legs" class="${legs ? 'on' : ''}">legs ${legs ? 'down' : 'up'}</button></div>`
      + (s ? `<div class="kvs">${row('power', `${s.power.used} / ${s.power.available}`)}${row('cruise', s.velocity.toFixed(3) + 'c')}${row('hold', s.capacity + ' cells')}</div>` + (v.ok ? '' : `<div class="warn2">${v.errs[0]} · the yard would refuse this rig</div>`) : '<div class="mut2">a planned module: no numbers in the domain yet.</div>');
    panel.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const id = b.dataset.id || null; rig[b.dataset.s] = id; ship.fit(b.dataset.s, id); drawPanel(); });
    bindToggles();
  }
  function bindToggles() {
    panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { if (b.dataset.t === 'fire') { fire = fire ? 0 : (model.fire ?? 1); panel.dataset.fire = fire ? '1' : '0'; } else { legs = !legs; show(model); return; } drawPanel(); });
  }
  u.querySelectorAll('[data-m]').forEach(b => b.onclick = () => show(MODELS[+b.dataset.m]));
  el.addEventListener('pointerdown', e => { if (e.target.closest('.ui button, .spec, .card')) return; view.auto = false; const x0 = e.clientX, y0 = e.clientY, a0 = view.az, e0 = view.el; const mv = ev => { view.az = a0 - (ev.clientX - x0) * 0.008; view.el = clamp(e0 + (ev.clientY - y0) * 0.006, -0.3, 1.2); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  st.ticks.push((t, dt) => {
    if (view.auto) view.az += dt * 0.22;
    cam.position.set(aim.x + Math.sin(view.az) * Math.cos(view.el) * view.dist, aim.y + Math.sin(view.el) * view.dist, aim.z + Math.cos(view.az) * Math.cos(view.el) * view.dist); cam.lookAt(aim); cam.near = view.dist / 100; cam.far = view.dist * 8; cam.updateProjectionMatrix();
    if (t - shownAt < 3) recenter();
    if (model.walk) walkRobot(cur, dt, 0.8);
    if (ship) { ship.fire = fire; ship.tick(t, dt); } else liven(cur, t, dt, fire);
    if (model.id === 'buoy') cur.userData.sign.material.opacity = Math.random() > 0.04 ? 1 : 0.35;
  });
  show(MODELS[0]);
  hud(el, '<b>hangar</b> · every 3D model in this preview'); tabs(el, 'hangar');
}

// ── the planet section: the flat maps behind the turning discs ─────
function mapsFig(el) { ['ocean', 'jupiter', 'ochre'].forEach(k => { const cv = planetMaps(k).map, f = document.createElement('figure'); f.className = 'flat'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `${k} map, 2:1`); f.appendChild(cv); f.insertAdjacentHTML('beforeend', `<figcaption>${k} · 768 × 384</figcaption>`); el.appendChild(f); }); }

const SCREENS = { port, exchange, rigging, chart, adrift, hangar };
const boot = el => { if (el.dataset.done) return; el.dataset.done = 1; try { SCREENS[el.dataset.screen](el); } catch (e) { console.error(el.dataset.screen, e); el.insertAdjacentHTML('beforeend', `<div class="fail">${el.dataset.screen}: ${e.message}</div>`); } };
if (!window.THREE) document.querySelectorAll('[data-screen]').forEach(el => el.insertAdjacentHTML('beforeend', '<div class="fail">three.js did not load</div>'));
else {
  const lazy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { lazy.unobserve(e.target); boot(e.target); } }), { rootMargin: '400px' });
  document.querySelectorAll('[data-screen]').forEach(el => lazy.observe(el));
  const mf = $('#maps'); mf && new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); mapsFig(mf); } }), { rootMargin: '400px' }).observe(mf);
}
