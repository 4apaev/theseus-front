import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Plan, routeEdges } from '../core/chart.ts'
import { type Session, station } from '../core/session.ts'
import { fleet, seedOf } from '../content/fleet.ts'
import { mySkin } from '../content/skins.ts'
import type { Palette } from '../content/palettes.ts'
import { worldOf } from '../content/stations.ts'
import type { Kit } from '../kit/index.ts'
import { type KitMark, beside } from '../kit/mark.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import { arc, beads, round, wave } from '../world/beads.ts'
import { picture, toon } from '../world/toy.ts'
import { LY, frame, onOrbit, point } from './chart.ts'
import { Click } from './click.ts'
import { Course } from './course.ts'
import type { Place } from './router.ts'

const BALL = new T.SphereGeometry(1, 32, 20)
const RING = new T.TorusGeometry(1, .05, 8, 64)

// the size of things in each view, metres: a star, a station, the ship, a dot of a route, the gap between dots
const SECTOR = { star: 20, ship: 52, dot: 1.5, gap: 16 }
const SYSTEM = { star: 30, world: 46, ship: 24, dot: 1, gap: 10 }

/**
 * the chart of the toy look: 3D like the old chart, no plane under it.
 * the sector: each star a fat toy ball where the catalogue puts it, a
 * binary with its small twin; dotted arcs for the routes. a star opens
 * its system: the star, a dotted ring per orbit, each station a small
 * world on its ring. a station opens the course card, the manifest; the
 * course runs in red dots from the ship to a pin. escape, or the star,
 * goes back to the sector. the player's ship waits by its station.
 */
export class Atlas implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly course: Course
    private readonly click: Click
    private readonly group = new T.Group
    private picks: T.Object3D[] = []
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private spin: T.Object3D[] = []
    private ship?: { ship: Ship, y: number, len: number }
    private pin?: T.Object3D
    private run?: T.InstancedMesh
    private plan?: Plan
    private untick?: () => void
    private session?: Session
    private sysid?: string

    constructor(stage: Stage, kit: Kit, client: GameClient, p: Palette) {
        this.stage  = stage
        this.kit    = kit
        this.p      = p
        this.course = new Course(kit, client)
        this.click  = new Click(stage, () => this.picks, hit => hit.userData.value && this.choose(hit.userData.value))
        kit.view.addEventListener('turn', e => this.group.parent && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.group.parent && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.sync(s)
        this.stage.sky.show()
        this.stage.scene.add(this.group)
        this.kit.view.hidden = false
        this.untick = this.stage.tick((t, dt) => this.tick(t, dt))
        this.click.on()
        addEventListener('keydown', this.escape, true)
        this.sector()
    }

    sync(s: Session) {
        this.session = s
        this.course.sync(s)
        const here = this.sysid ? s.ship?.stid : station(s, s.ship?.stid)?.system
        this.marks.forEach(m => m.el.here = m.el.value === here)
    }

    leave() {
        this.untick?.()
        this.click.off()
        removeEventListener('keydown', this.escape, true)
        this.clear()
        this.plan = void 0
        this.group.removeFromParent()
        this.kit.view.hidden = true
        this.kit.card.close()
    }

    // a star opens its system; in a system, its star goes back, a station opens the course
    private choose(value: string) {
        if (!this.sysid) return this.system(value)
        if (value === this.sysid) return this.sector()
        const plan = this.course.show(value)
        if (!plan) return
        this.plan = plan
        this.system(this.sysid)
        beside(this.kit.card, this.marks, value, v => this.stage.anchor(v))
    }

    // every star, the routes between them, the course from system to system
    private sector() {
        const s = this.session, u = s?.universe
        if (!s || !u) return
        this.clear()
        this.sysid = void 0
        this.kit.card.close()
        const here = station(s, s.ship?.stid)?.system ?? '', r = SECTOR.star
        u.systems.forEach(x => this.star(point(u, x.sysid), x.star, r, x.sysid).mark(x.name, x.sysid))
        const arcs = routeEdges(u, { mode: 'sector', sysid: '' }).map(e => [ e.a, e.b ].map(v => new T.Vector3(...v).multiplyScalar(LY)))
        this.group.add(beads(arcs.flatMap(([ a, b ]) => arc(a, b, SECTOR.gap, r * 1.3)), [ this.p.green, this.p.cream ], SECTOR.dot))
        const stops = this.plan?.stops.map(x => u.stations.find(y => y.stid === x)?.system ?? '').filter((x, i, all) => x !== all[ i - 1 ]) ?? []
        const course = stops.slice(1).flatMap((x, i) => arc(point(u, stops[ i ]), point(u, x), SECTOR.gap * .7, r * 1.3))
        if (here) this.moor(point(u, here), r, course[ 0 ])
        this.plot(course, SECTOR.dot * 1.3, stops.length > 1 ? point(u, stops[ stops.length - 1 ]).add(new T.Vector3(0, r * 2.2, 0)) : void 0)
        this.stage.view(...frame(u))
        this.stage.turn(spread(u.systems.map(x => point(u, x.sysid))))
        this.sync(s)
    }

    // the star in the middle, a dotted ring per orbit, the routes between its stations, each station on its ring
    private system(sysid: string) {
        const s = this.session, u = s?.universe, sys = u?.systems.find(x => x.sysid === sysid)
        if (!s || !u || !sys) return
        const first = this.sysid !== sysid
        this.clear()
        this.sysid = sysid
        this.star(new T.Vector3, sys.star, SYSTEM.star, sysid).mark(sys.name, sysid)
        const all = u.stations.filter(x => x.system === sysid), at = (stid: string) => onOrbit(u, stid)
        all.forEach(x => this.world(at(x.stid), x.stid).mark(x.name, x.stid))
        this.group.add(beads(all.flatMap(x => round(at(x.stid).length(), SYSTEM.gap)), [ this.p.mist, this.p.teal ], SYSTEM.dot * .3))
        const pairs = u.routes.filter(r => r.from < r.to && all.some(x => x.stid === r.from) && all.some(x => x.stid === r.to))
        this.group.add(beads(pairs.flatMap(r => arc(at(r.from), at(r.to), SYSTEM.gap, SYSTEM.world * .5)), [ this.p.green, this.p.cream ], SYSTEM.dot))
        const stops = this.plan?.stops.filter(x => all.some(y => y.stid === x)) ?? [], target = this.plan?.stops.at(-1) ?? ''
        const course = stops.slice(1).flatMap((x, i) => arc(at(stops[ i ]), at(x), SYSTEM.gap * .7, SYSTEM.world * .5))
        if (station(s, s.ship?.stid)?.system === sysid) this.moor(at(s.ship?.stid ?? ''), SYSTEM.world * .5, course[ 0 ])
        this.plot(course, SYSTEM.dot * 1.3, stops.includes(target) ? at(target).add(new T.Vector3(0, SYSTEM.world * 1.3, 0)) : void 0)
        if (first) this.stage.view(new T.Vector3, Math.max(...all.map(x => at(x.stid).length())) * 1.5)
        this.sync(s)
    }

    // ── the scene ────────────────────────────────────────────

    // a fat toy ball in the star's colour. a binary has its small twin; some stars wear a ring
    private star(at: T.Vector3, spectrum: string, r: number, value: string) {
        const g = new T.Group, ball = new T.Mesh(BALL, toon(this.tone(spectrum)))
        ball.scale.setScalar(r)
        g.add(ball)
        if (spectrum.includes('+') || /binary/.test(spectrum)) g.add(this.twin(r))
        if (seedOf(value) % 3 === 0) g.add(this.loop(r * 1.6, this.p.mist, .35))
        g.position.copy(at)
        return this.thing(g, value, at.clone().setY(at.y + r * 1.5))
    }

    private world(at: T.Vector3, stid: string) {
        const m = new T.Sprite(new T.SpriteMaterial({ map: picture(worldOf(stid)), transparent: true }))
        m.center.set(.5, .14)
        m.scale.setScalar(SYSTEM.world)
        m.position.copy(at)
        return this.thing(m, stid, at.clone().setY(SYSTEM.world * .95))
    }

    // a thing to pick, and a way to give it a label
    private thing(o: T.Object3D, value: string, top: T.Vector3) {
        o.traverse(x => x.userData.value = value)
        this.group.add(o)
        this.picks.push(o)
        return {
            mark: (name: string, v: string) => {
                const el = this.kit.mark(name, v)
                el.addEventListener('pick', () => this.choose(v))
                this.marks.push({ at: top, el })
            },
        }
    }

    // a small twin on its own slow orbit
    private twin(r: number) {
        const pivot = new T.Group, twin = new T.Mesh(BALL, toon(this.p.cream))
        twin.scale.setScalar(r * .38)
        twin.position.set(r * 1.8, r * .4, 0)
        pivot.add(twin)
        this.spin.push(pivot)
        return pivot
    }

    private loop(r: number, color: string, tilt: number) {
        const m = new T.Mesh(RING, toon(color))
        m.scale.setScalar(r)
        m.rotation.set(Math.PI / 2 + tilt, 0, tilt)
        return m
    }

    /** here: a cream ring round it, and the ship beside it, nose to the course. */
    private moor(at: T.Vector3, r: number, to?: T.Vector3) {
        const ring = this.loop(r * 1.9, this.p.cream, 0)
        ring.position.copy(at)
        this.group.add(ring)
        const len = this.sysid ? SYSTEM.ship : SECTOR.ship, ship = new Ship(fleet.player, len, mySkin()), side = at.clone().add(new T.Vector3(r * 2.3, r * .4, -r * 2))
        ship.group.position.copy(side)
        ship.group.rotation.y = to ? Math.atan2(-(to.z - side.z), to.x - side.x) : Math.PI / 4
        ship.burn(to ? .5 : .15)
        void ship.fit(this.session?.fitted ?? [])
        this.group.add(ship.group)
        this.ship = { ship, y: side.y, len }
    }

    // the course in red dots that run to the pin
    private plot(at: T.Vector3[], r: number, pin?: T.Vector3) {
        if (at.length) this.group.add(this.run = beads(at, [ this.p.red ], r))
        if (!pin) return
        const g = new T.Group, cone = new T.Mesh(new T.ConeGeometry(.55, 1.4, 20), toon(this.p.red)), head = new T.Mesh(BALL, toon(this.p.red)), eye = new T.Mesh(BALL, toon(this.p.cream))
        cone.rotation.x = Math.PI
        head.scale.setScalar(.6)
        head.position.y = .8
        eye.scale.setScalar(.26)
        eye.position.set(0, .85, .42)
        g.add(cone, head, eye)
        g.scale.setScalar(this.sysid ? 9 : 12)
        g.position.copy(pin)
        g.userData.y = pin.y
        this.group.add(this.pin = g)
    }

    private tone(spectrum: string) {
        const p = this.p
        return { O: p.teal, B: p.teal, A: p.mist, F: p.cream, G: p.amber, K: p.pink, M: p.red }[ spectrum[ 0 ] ] ?? p.cream
    }

    private tick(t: number, dt: number) {
        this.spin.forEach(o => o.rotation.y = t * .4)
        if (this.ship) {
            this.ship.ship.tick(t, dt)
            this.ship.ship.group.position.y = this.ship.y + Math.sin(t * 1.6) * this.ship.len * .06
        }
        if (this.pin) this.pin.position.y = this.pin.userData.y + Math.abs(Math.sin(t * 2.4)) * this.pin.scale.x * .4
        if (this.run) wave(this.run, t)
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    // the ship and the pin go with the view; what the view made on the gpu goes too
    private clear() {
        this.group.traverse(o => {
            if (o instanceof T.InstancedMesh) o.dispose()
            if (o instanceof T.Sprite) o.material.dispose()
        })
        this.pin?.traverse(o => o instanceof T.Mesh && o.geometry !== BALL && o.geometry.dispose())
        this.group.clear()
        this.picks = []
        this.spin = []
        this.ship = this.pin = this.run = void 0
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }

    // in a system, escape goes back to the sector before the router sees it
    private readonly escape = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || !this.sysid || !this.kit.card.hidden) return
        e.preventDefault()
        this.sector()
    }
}

// the turn from the first look that spreads the stars most on screen: the 2 closest the furthest apart
function spread(at: T.Vector3[]) {
    const el = 22 * Math.PI / 180, first = 42 * Math.PI / 180
    const gap = (az: number) => {
        const right = new T.Vector3(Math.cos(az), 0, -Math.sin(az)), up = new T.Vector3(-Math.sin(az) * Math.sin(el), Math.cos(el), -Math.cos(az) * Math.sin(el))
        const flat = at.map(v => [ v.dot(right), v.dot(up) ])
        return Math.min(...flat.flatMap((a, i) => flat.slice(i + 1).map(b => Math.hypot(a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ]))))
    }
    return Array.from({ length: 32 }, (_, i) => i * Math.PI / 16).reduce((best, a) => gap(first + a) > gap(first + best) ? a : best, 0)
}
