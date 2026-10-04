import * as T from 'three'
import { station, type Session } from '../core/session.ts'
import { viewOf } from '../content/stations.ts'
import type { Stage } from '../world/stage.ts'
import { model } from '../world/loader.ts'
import { liven } from '../world/paint.ts'
import { Ship } from '../world/ship.ts'

/**
 * the home place: the station in space, the ship at its berth, the
 * planet below, the sun of the system. the camera orbits the station.
 * `enter` builds it, `sync` follows the session, `leave` takes it down.
 */
export class Port {
    private readonly stage: Stage
    private readonly made: T.Object3D[] = []
    private ship?: Ship
    private untick?: () => void
    private visit = 0

    constructor(stage: Stage) {
        this.stage = stage
    }

    async enter(s: Session) {
        const st = this.stage
        const at = station(s, s.ship?.stid)
        const sys = s.universe?.systems.find(x => x.sysid === at?.system)
        const v = viewOf(at?.stid ?? '', sys?.sysid ?? 'sol', sys?.star ?? 'G')
        const visit = ++this.visit
        const hull = await model(v.model)
        // the ship left while the station loaded
        if (visit !== this.visit) return

        const ship = this.ship = new Ship
        hull.scale.setScalar(v.scale)
        ship.group.position.set(...v.berth)
        ship.group.rotation.y = -Math.PI / 2
        st.scene.add(hull, ship.group)
        this.made.push(hull, ship.group)
        st.sky.show(v.planet, v.sun)
        st.view(new T.Vector3, v.size)
        this.untick = st.tick((t, dt) => {
            ship.tick(t, dt)
            liven(hull, t, dt)
        })
        this.sync(s)
    }

    sync(s: Session) {
        void this.ship?.fit(s.fitted)
    }

    leave() {
        this.visit++
        this.untick?.()
        this.made.forEach(o => o.removeFromParent())
        this.made.length = 0
        this.ship = void 0
        this.stage.sky.show()
    }
}
