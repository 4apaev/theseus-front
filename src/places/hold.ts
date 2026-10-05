import type { Session } from '../core/session.ts'
import type { Kit } from '../kit/index.ts'
import { piecesOf } from '../kit/hold.ts'
import type { Stage } from '../world/stage.ts'
import { Painted } from './painted.ts'

/** the hold: the ship's painted cargo bay, and its cells, large. */
export class Hold extends Painted {
    constructor(stage: Stage, kit: Kit) {
        super(stage, kit, [ 'hold', 'far-treasure' ])
    }

    sync(s: Session) {
        this.session = s
        Object.assign(this.kit.hold, { pieces: piecesOf(s), capacity: s.ship?.capacity ?? 0 })
    }

    protected reveal(on: boolean) {
        this.kit.hold.hidden = !on
        this.kit.hold.dataset.place = 'hold'
    }
}
