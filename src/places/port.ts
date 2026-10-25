import * as T from 'three'
import { type Session, dockedAt, station } from '../core/session.ts'
import { type Stage } from '../world/stage.ts'
import { HULLS, fleet, seedOf } from '../content/fleet.ts'
import { mySkin } from '../content/skins.ts'
import { skinOf, toyStationOf } from '../content/stations.ts'
import { model } from '../world/loader.ts'
import { liven } from '../world/paint.ts'
import { tint, toon, toy, wear } from '../world/toy.ts'
import { Ship } from '../world/ship.ts'
import { type Berth, face, inbound } from '../world/visitor.ts'
import type { Effect } from '../core/effects.ts'
import { html } from 'lit'
import { type Kit, shipRows, visitorRows } from '../kit/index.ts'
import type { KitSpot } from '../kit/spot.ts'
import { Anchorage } from './anchorage.ts'
import { spots } from './spots.ts'

type Found = NonNullable<ReturnType<Anchorage[ 'find' ]>>

/*
    the home place: the station in space,
    the ship at its berth,
    other ships at anchor round the station,
    its planet and the dry dock and gas station between them.
    the camera orbits the station. a click on a ship,
    or the s key for ours, opens its card. the t key
    lists the traffic: the players docked here, the npc ships.
    `enter` builds it, `sync` follows the session,
    `leave` takes it down.
*/
export class Port {

    private readonly stage: Stage
    private readonly kit: Kit
    private readonly hull: string
    private readonly made: T.Object3D[] = []

    private untick?: () => void
    private ship?: Ship
    private yard?: Anchorage
    private stid?: string
    private session?: Session
    private focus?: T.Object3D
    private shows?: () => void
    private home?: [ T.Vector3, number ]
    private marks: { at: T.Vector3, el: KitSpot }[] = []
    private down = [ 0, 0 ]
    private landing = false
    private land?: { path: T.CubicBezierCurve3, t0: number, end: T.Quaternion }
    private visit = 0

    constructor(stage: Stage, kit: Kit) {
        this.stage = stage
        this.kit   = kit
        this.hull  = fleet.player
    }

    async enter(s: Session) {
        const st    =   this.stage
        const visit = ++this.visit

        const at    = station(s, s.ship?.stid)
        const hull  = await model(toyStationOf(at?.stid ?? ''), toy).catch(() => model('toy/station', toy))

        if (visit !== this.visit) return // the ship left while the station loaded
        wear(hull, skinOf(at?.stid ?? ''))

        const ship = this.ship = new Ship(this.hull, HULLS[ this.hull ], mySkin())

        hull.updateMatrixWorld(true)
        hull.getObjectByName('berth')?.matrixWorld
            .decompose(
                ship.group.position,
                ship.group.quaternion,
                new T.Vector3,
            )

        if (this.landing) this.approach(ship.group)

        const actors = [ ship ]
        const groups = actors.map(a => a.group)

        st.scene.add(hull, ...groups)
        this.made.push(hull, ...groups)

        const box  = (new T.Box3).setFromObject(hull)
        const yard = this.yard = new Anchorage(box, seedOf(at?.stid ?? ''), pads(hull))

        this.stid = at?.stid
        yard.sync(dockedAt(s, this.stid), false)
        yard.fill(3)
        st.scene.add(yard.group)
        this.made.push(yard.group)
        const world = planet(box, seedOf(at?.stid ?? ''))
        st.scene.add(world)
        this.made.push(world)
        void this.lagrange(box, world.position)
        void this.dress(world, seedOf(at?.stid ?? ''))

        this.home  = [ box.getCenter(new T.Vector3), box.getSize(new T.Vector3).length() / 2 ]
        this.marks = spots(hull, ship.group.position).map(s => ({ at: s.at, el: this.kit.spot(s.place) }))

        st.view(...this.home)

        this.untick = st.tick((t, dt) => {
            actors.forEach(a => a.tick(t, dt))
            yard.tick(t, dt)
            liven(hull, t, dt)
            this.glide(t)
            this.follow()
            this.marks.forEach(m => m.el.at = st.anchor(m.at))
        })
        st.host.addEventListener('pointerdown', this.press)
        st.host.addEventListener('pointerup', this.release)
        addEventListener('keydown', this.key)
        this.sync(s)
    }

    // sam's planet, when it loads, in place of the plain ball and its ring
    private async dress(world: T.Object3D, seed: number) {
        const visit = this.visit, ball = world.children[ 0 ], m = await model(PLANETS[ seed % PLANETS.length ], toy).catch(() => void 0)
        if (!m || visit !== this.visit) return
        m.scale.setScalar(ball.scale.x * 2 * Math.sqrt(3) / (new T.Box3).setFromObject(m).getSize(new T.Vector3).length())
        world.children.forEach(o => o.visible = false)
        world.add(m)
    }

    // the dry dock and the gas station at the points between the station and its planet
    private async lagrange(box: T.Box3, planet: T.Vector3) {
        const visit = this.visit, mid = box.getCenter(new T.Vector3), size = box.getSize(new T.Vector3).length()
        const both = await Promise.all([ 'toy/station-dry-dock', 'toy/station-gas-station' ].map(id => model(id, toy).catch(() => void 0)))
        if (visit !== this.visit) return
        both.forEach((m, i) => {
            if (!m) return
            const fit = size * .35 / (new T.Box3).setFromObject(m).getSize(new T.Vector3).length()
            m.scale.setScalar(fit)
            m.position.lerpVectors(mid, planet, .3 + i * .22).add(new T.Vector3(0, (i ? -1 : 1) * size * .25, 0))
            m.userData.mark = i ? 'gas station' : 'dry dock'
            this.stage.scene.add(m)
            this.made.push(m)
        })
    }

    sync(s: Session) {
        this.session = s
        void this.ship?.fit(s.fitted)
        this.yard?.sync(dockedAt(s, this.stid))
        if (!this.kit.card.hidden) this.shows?.()
    }

    leave() {
        this.visit++
        this.untick?.()
        this.stage.host.removeEventListener('pointerdown', this.press)
        this.stage.host.removeEventListener('pointerup', this.release)
        removeEventListener('keydown', this.key)
        this.kit.card.close()
        this.marks.forEach(m => m.el.remove())
        this.marks = []
        this.made.forEach(o => o.removeFromParent())
        this.made.length = 0
        this.ship = void 0
        this.yard = void 0
    }

    // our ship just arrived: it lands on its berth, from 10 km out
    effect(e: Effect) {
        if (e.kind === 'arrive' && e.mine) this.landing = true
    }

    private approach(g: T.Object3D) {
        this.landing = false
        const bow = new T.Vector3(1, 0, 0).applyQuaternion(g.quaternion)
        const path = inbound({ at: g.position.clone(), bow })
        this.land = { path, t0: -1, end: g.quaternion.clone() }
        g.position.copy(path.getPoint(0))
        face(g, path.getTangent(0))
    }

    private glide(t: number) {
        const l = this.land, g = this.ship?.group
        if (!l || !g) return
        if (l.t0 < 0) l.t0 = t
        const k = Math.min(1, (t - l.t0) / 12), u = 1 - (1 - k) ** 2
        g.position.copy(l.path.getPoint(u))
        face(g, l.path.getTangent(u))
        // the drive brakes all the way in
        this.ship?.burn(k < 1 ? .4 + .6 * (1 - k) : 0)
        if (k < 1) return
        g.quaternion.copy(l.end)
        this.land = void 0
    }

    // the card stays next to its ship. a ship that left takes its card along
    private follow() {
        const card = this.kit.card
        if (card.hidden || !this.focus) return
        if (!this.focus.parent) return card.close()
        card.at = this.stage.anchor(this.focus.getWorldPosition(new T.Vector3))
    }

    private readonly press = (e: PointerEvent) => { this.down = [ e.offsetX, e.offsetY ] }

    // a click, not a drag, on the scene picks a ship, or a facility opens its place
    private readonly release = (e: PointerEvent) => {
        if (!(e.target instanceof HTMLCanvasElement) || Math.hypot(e.offsetX - this.down[ 0 ], e.offsetY - this.down[ 1 ]) > 4) return
        const hit = this.stage.pick(e.offsetX, e.offsetY, [ ...this.made ])
        const other = hit && this.yard?.find(hit)
        if (other) return this.showVisitor(other)
        if (hit && this.ship && isIn(hit, this.ship.group)) return this.showShip()
        // a merged station has no halls to tell apart: the lit label says which
        const place = placeOf(hit) ?? this.marks.find(m => m.el.hasAttribute('lit'))?.el.place
        if (place) location.hash = place
        this.kit.card.close()
    }

    // s: our ship. escape, with no card open: back to the whole station
    private readonly key = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return
        if (e.key === 's') this.showShip()
        if (e.key === 't') this.traffic()
        if (e.key === 'Escape' && !e.defaultPrevented && this.home) this.stage.focus(...this.home)
    }

    private showShip() {
        if (!this.ship) return
        this.focus = this.ship.group
        this.stage.focus(this.ship.group.position, 70)
        this.shows = () => {
            const s = this.session
            if (s?.ship) this.kit.card.show(s.ship.name, shipRows(s)!, s.ship.status)
        }
        this.shows()
    }

    private traffic() {
        const all = this.yard?.list() ?? []
        if (!this.home) return
        this.focus = void 0
        this.shows = void 0
        this.kit.card.show('traffic', html`<ul>${ all.map(f => html`
            <li><button @click=${ () => this.showVisitor(f) }><b>${ f.row?.handle ?? 'npc' }</b> ${ f.row?.name ?? f.visitor.hull.replace(/^.*\//, '') }</button></li>`) }
        </ul>`, `${ all.length } here`)
        void this.kit.card.updateComplete.then(() => this.home && (this.kit.card.at = this.stage.anchor(this.home[ 0 ])))
    }

    private showVisitor({ visitor, row }: Found) {
        this.focus = visitor.ship.group
        this.shows = () => this.session && this.kit.card.show(row?.name ?? visitor.hull.replace(/^.*\//, ''), visitorRows(this.session, visitor.hull, visitor.ship.worn, row), row ? 'player' : 'npc')
        this.shows()
    }
}

function placeOf(o: T.Object3D | null | undefined) {
    while (o && !o.userData.place) o = o.parent
    return o?.userData.place as string | undefined
}

function isIn(o: T.Object3D | null, root: T.Object3D) {
    while (o && o !== root) o = o.parent
    return !!o
}

// the station's other pads: `berth_b`, `berth_c`… with the extra `size`
// sam's planets, one picked by the station
const PLANETS = [ 'toy/sky/gas-giant', 'toy/sky/rocky-planet', 'toy/sky/ice-world' ]

const BALL = new T.SphereGeometry(1, 48, 32)
const RING = new T.TorusGeometry(1, .02, 8, 128)

// the toy station's planet: a fat ball beyond the station, up and right of it at first look, and its ring, in a colour apart from the station's
function planet(box: T.Box3, seed: number) {
    const size = box.getSize(new T.Vector3).length(), g = new T.Group
    const ball = new T.Mesh(BALL, toon(tint(([ 'teal', 'pink', 'amber', 'mist' ] as const)[ seed % 4 ])))
    const ring = new T.Mesh(RING, toon(tint('cream')))
    ball.scale.setScalar(size * 1.6)
    ring.scale.setScalar(size * 2.6)
    ring.rotation.set(Math.PI / 2 + .35, 0, .3)
    g.add(ball, ring)
    g.position.copy(box.getCenter(new T.Vector3)).addScaledVector(new T.Vector3(-.24, -.01, -.97).normalize(), size * 5)
    return g
}

const SIZES: Record<string, number> = { small: 60, medium: 150, large: 260 }

function pads(hull: T.Object3D) {
    const found: Berth[] = []
    hull.traverse(o => {
        if (!/^berth_[a-z]$/.test(o.name)) return
        const q = o.getWorldQuaternion(new T.Quaternion)
        found.push({ at: o.getWorldPosition(new T.Vector3), bow: new T.Vector3(1, 0, 0).applyQuaternion(q), fits: SIZES[ o.userData.size ] ?? SIZES.medium })
    })
    return found
}
