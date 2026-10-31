import { html } from 'lit'
import * as T from 'three'
import { type Conic, type Vec, apoapsis, circular, conic, periapsis, period, radius } from '../core/kepler.ts'
import { type Session, station, stationName } from '../core/session.ts'
import { number, span } from '../core/util.ts'
import { fleet } from '../content/fleet.ts'
import type { Palette } from '../content/palettes.ts'
import { mySkin } from '../content/skins.ts'
import { worldOf } from '../content/stations.ts'
import type { Kit } from '../kit/index.ts'
import type { KitMark } from '../kit/mark.ts'
import { beads, wave } from '../world/beads.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import { model } from '../world/loader.ts'
import { picture, toon, toy } from '../world/toy.ts'
import type { Place } from './router.ts'

// the toy's units: metres a unit, the planet's radius, the station's orbit, the edge of the view, gravity
const U = 10, R = 4, R0 = 12, EDGE = 40, MU = 1

// the toy in the player's numbers: the planet's radius, the speed on the station's orbit
const KM = 6000, MS = 3000

// the burn's 4 handles in 2 pairs, prograde green and retrograde red, radial out amber and in pink: their way in prograde and radial parts
const HANDLES: Record<string, [ keyof Palette, Vec ]> = { pro: [ 'green', [ 1, 0 ]], retro: [ 'red', [ -1, 0 ]], out: [ 'amber', [ 0, 1 ]], in: [ 'pink', [ 0, -1 ]]}
const NAMES: Record<string, string> = { pro: 'prograde', retro: 'retrograde', out: 'radial out', in: 'radial in' }

type Drag = { kind: string, from: T.Vector3, dv: Vec }

/**
 * orbital maneuvers, the client's toy: the planet, its moon, the station
 * on its orbit, our ship on the same orbit. the player drags the burn
 * node round the orbit, and its handles to add Δv prograde, retrograde,
 * radial out or in; the new orbit runs in red dots from the node, its
 * periapsis and apoapsis pinned. the card tells Δv, the burn time, the
 * new orbit. the server flies no maneuver yet: the burn does nothing.
 */
export class Orbit implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly world = new T.Group
    private readonly plan = new T.Group
    private ship?: Ship
    private moon?: T.Object3D
    private run?: T.InstancedMesh
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private session?: Session
    private drag?: Drag
    private node = Math.PI / 2
    private dv: Vec = [ 0, 0 ]
    private t = 0

    constructor(stage: Stage, kit: Kit, p: Palette) {
        this.stage = stage
        this.kit   = kit
        this.p     = p
        this.world.scale.setScalar(U)
        this.plan.scale.setScalar(U)
        kit.view.addEventListener('turn', e => this.world.parent && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.world.parent && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.session = s
        this.build(s)
        this.stage.scene.add(this.world, this.plan)
        this.stage.view(new T.Vector3, 17 * U)
        this.stage.tilt(.05, .4)
        this.kit.view.hidden = false
        this.untick = this.stage.tick((t, dt) => this.tick(t, dt))
        // before the camera's own: a handle under the pointer holds the camera
        this.stage.host.addEventListener('pointerdown', this.press, true)
        this.redraw()
    }

    sync(s: Session) {
        this.session = s
    }

    leave() {
        this.untick?.()
        this.stage.host.removeEventListener('pointerdown', this.press, true)
        this.release()
        this.clear(this.world)
        this.clear(this.plan)
        this.world.removeFromParent()
        this.plan.removeFromParent()
        this.ship = this.moon = this.run = void 0
        this.marks.forEach(m => m.el.remove())
        this.marks = []
        this.kit.view.hidden = true
        this.kit.card.close()
    }

    // the planet, its ring, the moon, the station's orbit in dots, the station and our ship on it
    private build(s: Session) {
        const planet = ball(R, toon(this.p.teal)), ring = new T.Mesh(new T.TorusGeometry(R * 1.6, .12, 8, 96), toon(this.p.mist))
        ring.rotation.set(Math.PI / 2 + .3, 0, .2)
        const moon = this.moon = ball(1.2, toon(this.p.cream))
        const lands = this.lands()
        this.world.add(planet, ring, moon, beads(loop(R0, 3), [ this.p.mist, this.p.cream ], .12), ...lands)
        void this.dress([ planet, ...lands ], moon)
        const here = new T.Sprite(new T.SpriteMaterial({ map: picture(worldOf(s.ship?.stid ?? '')), transparent: true }))
        here.scale.setScalar(4)
        here.position.set(R0, .3, 0)
        here.center.set(.5, .14)
        this.world.add(here)
        this.ship = new Ship(fleet.player, 2.4 * U, mySkin())
        this.stage.scene.add(this.ship.group)
        this.label(stationName(s, s.ship?.stid), 'here', new T.Vector3(R0, 3.6, 0)).here = true
    }

    // sam's planet and moon, when they load, in place of the plain balls
    private async dress(planet: T.Object3D[], moon: T.Object3D) {
        const [ p, m ] = await Promise.all([ 'toy/orbit/orbit-planet', 'toy/orbit/orbit-moon' ].map(id => model(id, toy).catch(() => void 0)))
        if (!this.world.parent) return
        for (const [ was, now, r ] of [[ planet, p, R ], [[ moon ], m, 1.2 ]] as const) {
            if (!now) continue
            now.scale.setScalar(r * 2 / (new T.Box3).setFromObject(now).getSize(new T.Vector3).length() * Math.sqrt(3))
            now.position.copy(was[ 0 ].position)
            was.forEach(o => o.visible = false)
            this.world.add(now)
            if (was[ 0 ] === moon) this.moon = now
        }
    }

    // flat blobs on the planet, cream lands and amber lakes, the same each visit
    private lands() {
        return Array.from({ length: 9 }, (_, i) => {
            const m = ball(1, toon(i % 3 ? this.p.cream : this.p.amber)), n = new T.Vector3(Math.cos(i * 2.4), Math.sin(i * 1.7) * .8, Math.sin(i * 2.4)).normalize()
            m.scale.set(R * (.22 + i % 4 * .06), R * .05, R * (.18 + i % 3 * .07))
            m.position.copy(n).multiplyScalar(R * .985)
            m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n)
            return m
        })
    }

    // the node, its handles, the new orbit from the node in red, its pins and the card
    private redraw() {
        this.clear(this.plan)
        this.marks.filter(m => m.el.value !== 'here').forEach(m => m.el.remove())
        this.marks = this.marks.filter(m => m.el.value === 'here')
        const [ r, v ] = circular(R0, this.node, MU), [ pro, out ] = frame(r, v), w: Vec = [ v[ 0 ] + pro[ 0 ] * this.dv[ 0 ] + out[ 0 ] * this.dv[ 1 ], v[ 1 ] + pro[ 1 ] * this.dv[ 0 ] + out[ 1 ] * this.dv[ 1 ] ]
        const c = conic(r, w, MU), at = new T.Vector3(r[ 0 ], .4, r[ 1 ])
        this.plan.add(this.handles(at, pro, out))
        if (this.dv[ 0 ] || this.dv[ 1 ]) this.plan.add(this.run = beads(path(c, this.node, Math.sign(r[ 0 ] * w[ 1 ] - r[ 1 ] * w[ 0 ]) || 1), [ this.p.red ], .14))
        else this.run = void 0
        this.pins(c)
        this.card(c)
    }

    // the node ball, and a fat arrow for each handle, along its way
    private handles(at: T.Vector3, pro: Vec, out: Vec) {
        const g = new T.Group, node = ball(.6, toon(this.p.amber))
        node.userData.handle = 'node'
        g.add(node)
        for (const [ kind, [ role, [ a, b ]]] of Object.entries(HANDLES)) {
            const way = new T.Vector3(pro[ 0 ] * a + out[ 0 ] * b, 0, pro[ 1 ] * a + out[ 1 ] * b), arrow = new T.Group, m = toon(this.p[ role ])
            const stick = new T.Mesh(new T.CylinderGeometry(.12, .12, 1.4, 10), m), tip = new T.Mesh(new T.ConeGeometry(.45, .9, 16), m)
            stick.position.y = .7
            tip.position.y = 1.8
            arrow.add(stick, tip)
            arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), way)
            arrow.traverse(o => o.userData.handle = kind)
            g.add(arrow)
            this.label(NAMES[ kind ], kind, at.clone().addScaledVector(way, 4.4).setY(1)).selected = true
        }
        g.position.copy(at)
        g.scale.setScalar(1.6)
        return g
    }

    // periapsis and apoapsis, pinned and labelled; an orbit into the planet says so
    private pins(c: Conic) {
        if (!this.dv[ 0 ] && !this.dv[ 1 ]) return
        const lo = periapsis(c), hi = apoapsis(c)
        if (c.e > .002) this.pin(c.w, lo, lo < R ? 'hits the planet' : `periapsis · ${ km(lo) }`)
        if (c.e > .002 && hi < EDGE) this.pin(c.w + Math.PI, hi, `apoapsis · ${ km(hi) }`)
    }

    private pin(t: number, r: number, name: string) {
        const at = new T.Vector3(Math.cos(t) * Math.max(r, R), 0, Math.sin(t) * Math.max(r, R)), g = new T.Group
        const cone = new T.Mesh(new T.ConeGeometry(.35, .9, 14), toon(this.p.red)), head = ball(.4, toon(this.p.red))
        cone.rotation.x = Math.PI
        cone.position.y = .45
        head.position.y = 1.1
        g.add(cone, head)
        g.position.copy(at)
        this.plan.add(g)
        this.label(name, name, at.clone().setY(1.8)).selected = true
    }

    private label(name: string, value: string, at: T.Vector3) {
        const el = this.kit.mark(name, value)
        this.marks.push({ at: at.multiplyScalar(U), el })
        return el
    }

    // the plan: Δv, the burn's time at our drive's thrust, the new orbit
    private card(c: Conic) {
        const s = this.session, dv = Math.hypot(...this.dv) / Math.sqrt(MU / R0) * MS, thrust = s?.ship?.acceleration ?? 0
        const hi = apoapsis(c), escapes = hi === Infinity || hi > EDGE
        this.kit.card.show('plan burn', html`
            <progress value=${ Math.min(dv, 1500) } max="1500"></progress>
            <dl>
                <dt>Δv</dt>        <dd>${ number(dv) } m/s</dd>
                <dt>burn time</dt> <dd>${ thrust > 0 ? span(dv / thrust * 1000) : '—' }</dd>
                <dt>periapsis</dt> <dd>${ periapsis(c) < R ? 'hits the planet' : km(periapsis(c)) }</dd>
                <dt>apoapsis</dt>  <dd>${ escapes ? 'escapes' : km(hi) }</dd>
                <dt>period</dt>    <dd>${ escapes ? '—' : span(period(c, MU) / (2 * Math.PI * Math.sqrt(R0 ** 3 / MU)) * 5400e3) }</dd>
            </dl>
            <p><small>drag the node round the orbit, and an arrow to burn: green ahead, red back, amber out, pink in. ${ s ? `round ${ station(s, s.ship?.stid)?.name ?? 'here' }` : '' }</small></p>
            <menu><button @click=${ () => this.reset() }>reset</button><button @click=${ () => this.kit.toast.say('the server flies no maneuver yet') }>burn</button></menu>`)
        this.kit.card.at = [ this.stage.host.clientWidth - 24, 240 ]
    }

    private reset() {
        this.dv = [ 0, 0 ]
        this.redraw()
    }

    // ── the drag ─────────────────────────────────────────────

    private readonly press = (e: PointerEvent) => {
        if (!(e.target instanceof HTMLCanvasElement)) return
        const hit = this.stage.pick(e.offsetX, e.offsetY, [ this.plan ]), kind = hit?.userData.handle as string | undefined, from = this.stage.ground(e.offsetX, e.offsetY)
        if (!kind || !from) return
        this.drag = { kind, from, dv: [ ...this.dv ]}
        this.stage.hold(true)
        e.target.setPointerCapture(e.pointerId)
        addEventListener('pointermove', this.move)
        addEventListener('pointerup', this.release)
    }

    // the node follows the pointer round the orbit; a handle adds Δv along its way, as far as the pointer goes
    private readonly move = (e: PointerEvent) => {
        const d = this.drag, box = this.stage.host.getBoundingClientRect(), to = this.stage.ground(e.clientX - box.left, e.clientY - box.top)
        if (!d || !to) return
        if (d.kind === 'node') this.node = Math.atan2(to.z, to.x)
        else this.push(d, to)
        this.redraw()
    }

    // Δv along a handle's way, as far as the pointer went along it
    private push(d: Drag, to: T.Vector3) {
        const [ r, v ] = circular(R0, this.node, MU), [ pro, out ] = frame(r, v), [ a, b ] = HANDLES[ d.kind ][ 1 ]
        const way = [ pro[ 0 ] * a + out[ 0 ] * b, pro[ 1 ] * a + out[ 1 ] * b ], k = ((to.x - d.from.x) * way[ 0 ] + (to.z - d.from.z) * way[ 1 ]) / U * .02
        this.dv = [ d.dv[ 0 ] + a * k, d.dv[ 1 ] + b * k ]
    }

    private readonly release = () => {
        this.drag = void 0
        this.stage.hold(false)
        removeEventListener('pointermove', this.move)
        removeEventListener('pointerup', this.release)
    }

    // our ship rides the station's orbit; the moon goes round slower; the red dots run
    private tick(t: number, dt: number) {
        this.t += dt * .25
        const [ r, v ] = circular(R0, this.t, MU), ship = this.ship
        ship?.group.position.set(r[ 0 ] * U, .6 * U, r[ 1 ] * U)
        ship?.group.rotation.set(0, Math.atan2(-v[ 1 ], v[ 0 ]), 0)
        ship?.tick(t, dt)
        this.moon?.position.set(Math.cos(t * .05) * 30, 1, Math.sin(t * .05) * 30)
        if (this.run) wave(this.run, t)
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    // what a group made on the gpu goes with it; shared materials stay
    private clear(g: T.Group) {
        g.traverse(o => {
            if (o instanceof T.InstancedMesh) o.dispose()
            else if (o instanceof T.Mesh && o.geometry !== BALL) o.geometry.dispose()
            if (o instanceof T.Sprite) o.material.dispose()
        })
        g.clear()
        if (g === this.world) this.ship?.group.removeFromParent()
    }
}

const BALL = new T.SphereGeometry(1, 32, 20)

function ball(r: number, m: T.Material) {
    const b = new T.Mesh(BALL, m)
    b.scale.setScalar(r)
    return b
}

// the prograde and radial-out ways at a state
function frame([ rx, ry ]: Vec, [ vx, vy ]: Vec): [ Vec, Vec ] {
    const v = Math.hypot(vx, vy), r = Math.hypot(rx, ry)
    return [[ vx / v, vy / v ], [ rx / r, ry / r ]]
}

// points round a circle of radius `r`, `gap` apart
function loop(r: number, gap: number) {
    const n = Math.round(Math.PI * 2 * r / gap * 4)
    return Array.from({ length: n }, (_, i) => new T.Vector3(Math.cos(i / n * Math.PI * 2) * r, 0, Math.sin(i / n * Math.PI * 2) * r))
}

// the conic from the node on, the way the ship goes: once round, or until it hits the planet or leaves the view
function path(c: Conic, from: number, way: number) {
    const out: T.Vector3[] = []
    for (let i = 1; i < 160; i++) {
        const t = from + way * i / 160 * Math.PI * 2, r = radius(c, t)
        if (r < R || r > EDGE) break
        out.push(new T.Vector3(Math.cos(t) * r, .1, Math.sin(t) * r))
    }
    return out
}

// a distance from the planet's middle as height over its ground
const km = (r: number) => `${ number((r / R - 1) * KM) } km`
