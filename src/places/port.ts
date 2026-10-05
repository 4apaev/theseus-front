import * as T from 'three'
import { type Session, dockedAt, station } from '../core/session.ts'
import { type Stage } from '../world/stage.ts'
import { HULLS, seedOf } from '../content/fleet.ts'
import { viewOf } from '../content/stations.ts'
import { model } from '../world/loader.ts'
import { liven } from '../world/paint.ts'
import { Robot } from '../world/robot.ts'
import { Ship } from '../world/ship.ts'
import { type Kit, shipRows, visitorRows } from '../kit/index.ts'
import { Anchorage } from './anchorage.ts'

type Found = NonNullable<ReturnType<Anchorage[ 'find' ]>>

/*
    the home place: the station in space,
    the ship at its berth, robots on the deck,
    other ships at anchor round the station,
    the planet below, the sun of the system.
    the camera orbits the station. a click on a ship,
    or the s key for ours, opens its card.
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
    private down = [ 0, 0 ]
    private visit = 0

    /** `hull`: a far treasure variant to compare, `far-treasure-b`. */
    constructor(stage: Stage, kit: Kit, hull?: string) {
        this.stage = stage
        this.kit   = kit
        this.hull  = hull ?? 'far-treasure'
    }

    async enter(s: Session) {
        const st    =   this.stage
        const visit = ++this.visit

        const at    = station(s, s.ship?.stid)
        const sys   = s.universe?.systems.find(x => x.sysid === at?.system)
        const v     = viewOf(at?.stid ?? '', sys?.sysid ?? 'sol', sys?.star ?? 'G')
        const hull  = await model(v.model)

        if (visit !== this.visit) return // the ship left while the station loaded

        const ship = this.ship = new Ship(this.hull, HULLS[ this.hull ])

        hull.updateMatrixWorld(true)
        hull.getObjectByName('berth')?.matrixWorld
            .decompose(
                ship.group.position,
                ship.group.quaternion,
                new T.Vector3,
            )

        const actors = [ ship, ...robots(hull) ]
        const groups = actors.map(a => a.group)

        st.scene.add(hull, ...groups)
        this.made.push(hull, ...groups)

        const box  = (new T.Box3).setFromObject(hull)
        const yard = this.yard = new Anchorage(box, seedOf(at?.stid ?? ''))

        this.stid = at?.stid
        yard.sync(dockedAt(s, this.stid), false)
        yard.fill(3)
        st.scene.add(yard.group)
        this.made.push(yard.group)

        st.sky.show(v.planet, v.sun)
        st.view(
            box.getCenter(new T.Vector3),
            box.getSize(new T.Vector3).length() / 2,
        )

        this.untick = st.tick((t, dt) => {
            actors.forEach(a => a.tick(t, dt))
            yard.tick(t, dt)
            liven(hull, t, dt)
            this.follow()
        })
        st.host.addEventListener('pointerdown', this.press)
        st.host.addEventListener('pointerup', this.release)
        addEventListener('keydown', this.key)
        this.sync(s)
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
        this.made.forEach(o => o.removeFromParent())
        this.made.length = 0
        this.ship = void 0
        this.yard = void 0
        this.stage.sky.show()
    }

    // the card stays next to its ship. a ship that left takes its card along
    private follow() {
        const card = this.kit.card
        if (card.hidden || !this.focus) return
        if (!this.focus.parent) return card.close()
        card.at = this.stage.anchor(this.focus.getWorldPosition(new T.Vector3))
    }

    private readonly press = (e: PointerEvent) => { this.down = [ e.offsetX, e.offsetY ] }

    // a click, not a drag, on the scene picks a ship
    private readonly release = (e: PointerEvent) => {
        if (!(e.target instanceof HTMLCanvasElement) || Math.hypot(e.offsetX - this.down[ 0 ], e.offsetY - this.down[ 1 ]) > 4) return
        const hit = this.stage.pick(e.offsetX, e.offsetY, [ ...this.made ])
        const other = hit && this.yard?.find(hit)
        if (other) return this.showVisitor(other)
        if (hit && this.ship && isIn(hit, this.ship.group)) return this.showShip()
        this.kit.card.close()
    }

    private readonly key = (e: KeyboardEvent) => {
        if (e.key === 's' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) this.showShip()
    }

    private showShip() {
        if (!this.ship) return
        this.focus = this.ship.group
        this.shows = () => {
            const s = this.session
            if (s?.ship) this.kit.card.show(s.ship.name, shipRows(s)!, s.ship.status)
        }
        this.shows()
    }

    private showVisitor({ visitor, row }: Found) {
        this.focus = visitor.ship.group
        this.shows = () => this.session && this.kit.card.show(row?.name ?? visitor.hull.replace(/^.*\//, ''), visitorRows(this.session, visitor.hull, visitor.ship.worn, row), row ? 'player' : 'npc')
        this.shows()
    }
}

function isIn(o: T.Object3D | null, root: T.Object3D) {
    while (o && o !== root) o = o.parent
    return !!o
}

// a deckhand walks the first half
// of the walk points, a porter the rest
function robots(hull: T.Object3D) {

    const walk: T.Vector3[] = []
    hull.traverse(o => {
        if (/^walk_[a-z]$/.test(o.name))
            walk[ o.name.charCodeAt(5) - 97 ] = o.getWorldPosition(new T.Vector3)
    })
    const n = walk.length
    return n < 2
        ? []
        : [
            walker('deckhand', walk[ 0 ], walk[ Math.floor(n / 2) ]),
            walker('porter', walk[ Math.floor(n / 2) ], walk[ n - 1 ]),
        ]
}

// a robot walks about 1.25 m/s; its period is the way there and back
function walker(name: string, a: T.Vector3, b: T.Vector3) {
    return new Robot(name, a, b, a.distanceTo(b) * 1.6)
}
