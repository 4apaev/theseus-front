import * as T from 'three'
import { type Session, dockedAt, station } from '../core/session.ts'
import { type Stage } from '../world/stage.ts'
import { HULLS, seedOf } from '../content/fleet.ts'
import { viewOf } from '../content/stations.ts'
import { model } from '../world/loader.ts'
import { liven } from '../world/paint.ts'
import { Robot } from '../world/robot.ts'
import { Ship } from '../world/ship.ts'
import { Anchorage } from './anchorage.ts'

/*
    the home place: the station in space,
    the ship at its berth, robots on the deck,
    other ships at anchor round the station,
    the planet below, the sun of the system.
    the camera orbits the station. `enter` builds it,
    `sync` follows the session, `leave` takes it down.
*/
export class Port {

    private readonly stage: Stage
    private readonly hull: string
    private readonly made: T.Object3D[] = []

    private untick?: () => void
    private ship?: Ship
    private yard?: Anchorage
    private stid?: string
    private visit = 0

    /** `hull`: a far treasure variant to compare, `far-treasure-b`. */
    constructor(stage: Stage, hull?: string) {
        this.stage = stage
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
        })
        this.sync(s)
    }

    sync(s: Session) {
        void this.ship?.fit(s.fitted)
        this.yard?.sync(dockedAt(s, this.stid))
    }

    leave() {
        this.visit++
        this.untick?.()
        this.made.forEach(o => o.removeFromParent())
        this.made.length = 0
        this.ship = void 0
        this.yard = void 0
        this.stage.sky.show()
    }
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
