import * as T from 'three'
import { progress } from '../core/chart.ts'
import { type Session, station, systemName } from '../core/session.ts'
import { tripOf } from '../core/trip.ts'
import { fmtVel, fmtYears } from '../core/util.ts'
import { HULLS, fleet } from '../content/fleet.ts'
import { mySkin } from '../content/skins.ts'
import type { Kit } from '../kit/index.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import type { Place } from './router.ts'

/**
 * our ship underway: alone in the sky, on the dashed path of its trip.
 * the drive burns while the ship speeds up and brakes, and burns low
 * while it coasts; an in-system leg burns the whole way. the trip counts
 * down each second. at zero it waits: the arrival event ends the leg.
 */
export class Transit implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly hull: string
    private ship?: Ship
    private session?: Session
    private untick?: () => void
    private shown = 0
    private readonly box = new T.Box3
    private readonly middle = new T.Vector3

    constructor(stage: Stage, kit: Kit) {
        this.stage = stage
        this.kit   = kit
        this.hull  = fleet.player
    }

    enter(s: Session) {
        const ship = this.ship = new Ship(this.hull, HULLS[ this.hull ], mySkin())
        this.session = s
        void ship.fit(s.fitted)
        this.stage.scene.add(ship.group)
        // from the side, a little behind: the tail of bubbles shows; far enough back for the trip round it
        this.stage.view(new T.Vector3(-20, 10, 0), 150)
        this.stage.turn(-1.05)
        this.untick = this.stage.tick((t, dt) => this.fly(t, dt))
        this.sync(s)
    }

    sync(s: Session) {
        this.session = s
        this.show()
    }

    leave() {
        this.untick?.()
        this.ship?.group.removeFromParent()
        this.ship = void 0
        this.kit.trip.hidden = true
    }

    private fly(t: number, dt: number) {
        const ship = this.ship, s = this.session
        if (!ship || !s?.ship || !s.universe) return
        ship.tick(t, dt)
        ship.group.rotation.z = Math.sin(t / 7) * .02
        const f = progress(s.ship, s.universe.constants, Date.now())
        const route = s.universe.routes.find(r => r.from === s.ship?.from && r.to === s.ship?.to)
        // the ship coasts on a thin trail of bubbles
        ship.burn(!route || route.c < 1 || f < .05 || f > .95 ? 1 : .25)
        if (Date.now() - this.shown > 1000) this.show()
        this.aim(ship)
    }

    // the ship's middle on screen, for the trip's path: it moves as the view eases in and as the modules load
    private aim(ship: Ship) {
        const at = this.stage.anchor(this.box.setFromObject(ship.group).getCenter(this.middle)), was = this.kit.trip.at
        if (!was || Math.hypot(at[ 0 ] - was[ 0 ], at[ 1 ] - was[ 1 ]) > 1) this.kit.trip.at = [ at[ 0 ], at[ 1 ] ]
    }

    // the trip from the session, its ends by system, the leg's speed and ship years
    private show() {
        const s = this.session, ship = s?.ship, trip = s && tripOf(s, Date.now())
        if (!s || !ship || !trip || !this.ship) return
        const name = (stid?: string) => systemName(s, station(s, stid)?.system).toLowerCase()
        const route = s.universe?.routes.find(r => r.from === ship.from && r.to === ship.to), c = Math.min(ship.velocity, route?.c ?? 1)
        const facts = `${ fmtVel(c) } c · ${ Math.round(c * 299792.458).toLocaleString() } km/s · ${ fmtYears(ship.years_rel ?? ship.years_abs ?? 0) } ship years`
        this.shown = Date.now()
        Object.assign(this.kit.trip, { trip, facts, ends: [ name(trip.stops[ 0 ]), name(trip.stops.at(-1)) ], calm: this.stage.calm, hidden: false })
    }
}
