import * as T from 'three'
import { progress } from '../core/chart.ts'
import type { Session } from '../core/session.ts'
import { HULLS, fleet } from '../content/fleet.ts'
import { mySkin } from '../content/skins.ts'
import { type Kit, voyageRows } from '../kit/index.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import type { Place } from './router.ts'

/**
 * our ship underway: alone in the sky, its card pinned beside it. the
 * drive burns while the ship speeds up and brakes, and is dark while it
 * coasts; an in-system leg burns the whole way. the card counts down
 * each second. at zero it waits: the arrival event ends the leg.
 */
export class Transit implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly hull: string
    private ship?: Ship
    private session?: Session
    private untick?: () => void
    private shown = 0

    constructor(stage: Stage, kit: Kit, hull?: string) {
        this.stage = stage
        this.kit   = kit
        this.hull  = hull ?? fleet.player
    }

    enter(s: Session) {
        const ship = this.ship = new Ship(this.hull, HULLS[ this.hull ], mySkin())
        this.session = s
        void ship.fit(s.fitted)
        this.stage.sky.show()
        this.stage.scene.add(ship.group)
        // from the side, a little behind: the tail of bubbles shows
        this.stage.view(new T.Vector3(-20, 10, 0), 80)
        this.stage.turn(-1.05)
        this.untick = this.stage.tick((t, dt) => this.fly(t, dt))
        this.sync(s)
    }

    sync(s: Session) {
        this.session = s
        this.card()
    }

    leave() {
        this.untick?.()
        this.ship?.group.removeFromParent()
        this.ship = void 0
        this.kit.card.close()
    }

    private fly(t: number, dt: number) {
        const ship = this.ship, s = this.session
        if (!ship || !s?.ship || !s.universe) return
        ship.tick(t, dt)
        ship.group.rotation.z = Math.sin(t / 7) * .02
        const f = progress(s.ship, s.universe.constants, Date.now())
        const route = s.universe.routes.find(r => r.from === s.ship?.from && r.to === s.ship?.to)
        // a toy ship coasts on a thin trail of bubbles; a painted one goes dark
        ship.burn(!route || route.c < 1 || f < .05 || f > .95 ? 1 : this.hull.startsWith('toy/') ? .25 : 0)
        if (Date.now() - this.shown > 1000) this.card()
        this.kit.card.at = this.stage.anchor(ship.group.position)
    }

    private card() {
        const s = this.session
        if (!s?.ship) return
        this.shown = Date.now()
        this.kit.card.show(s.ship.name, voyageRows(s, this.shown), 'underway')
    }
}
