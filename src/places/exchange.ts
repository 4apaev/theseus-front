import      { fly        } from '../kit/fly.ts'
import      { piecesOf   } from '../kit/hold.ts'
import      { tilesOf    } from '../kit/tray.ts'
import type { Kit        } from '../kit/index.ts'

import type { Stage      } from '../world/stage.ts'
import type { GameClient } from '../core/client.ts'
import type { Effect     } from '../core/effects.ts'
import type { Side       } from '../core/transport/types.ts'
import type { Session } from '../core/session.ts'

import { iconOf  } from '../content/places.ts'
import { Painted } from './painted.ts'
import { Trade   } from './trade.ts'

/**
 * the exchange: the painted room, a tray of what the station quotes,
 * and the hold beside it. a pick opens the trade card; so does a good
 * dragged into the hold, or a piece dragged onto the tray.
 */
export class Exchange extends Painted {
    private readonly trade: Trade

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        super(stage, kit, [ 'exchange', 'outpost' ])
        this.trade = new Trade(kit, client)
        this.trade.onTrade = () => this.session && this.sync(this.session)
        const on = (el: HTMLElement, type: string, side: Side) => el.addEventListener(type, e => void this.pick((e as CustomEvent<string>).detail, side))
        kit.tray.addEventListener('pick', e => void this.pick((e as CustomEvent<string>).detail, kit.tray.side))
        on(kit.hold, 'buy', 'buy')
        on(kit.tray, 'sell', 'sell')
    }

    sync(s: Session) {
        this.session = s
        this.trade.sync(s)
        this.kit.tray.tiles = tilesOf(s, this.trade.busy)
        Object.assign(this.kit.hold, { pieces: piecesOf(s), capacity: s.ship?.capacity ?? 0 })
    }

    // cargo in flies from its tile into the hold, cargo out flies back
    async effect(e: Effect) {
        const s = this.session
        if (e.kind !== 'cargo' || !s) return
        await this.kit.hold.updateComplete
        const tile = this.kit.tray.querySelector(`button[value='${ e.gid }']`)
        const cell = this.kit.hold.querySelector(`li[data-gid='${ e.gid }']`) ?? this.kit.hold.querySelector('li:not([data-gid])')
        if (!tile || !cell) return
        const [ a, b ] = [ tile.getBoundingClientRect(), cell.getBoundingClientRect() ]
        fly(this.stage.host, iconOf(e.gid, s.universe?.goods[ e.gid ]?.kind), e.delta > 0 ? a : b, e.delta > 0 ? b : a)
    }

    protected reveal(on: boolean) {
        this.kit.tray.hidden = !on
        this.kit.hold.hidden = !on
        this.kit.hold.dataset.place = 'exchange'
    }

    // the card sits above the good's tile
    private async pick(gid: string, side: Side) {
        const s = this.session
        if (!s || !this.trade.pick(gid, side)) return
        await this.kit.card.updateComplete
        const tile = this.kit.tray.querySelector(`button[value='${ gid }']`)?.getBoundingClientRect()
        const host = this.stage.host.getBoundingClientRect()
        if (tile) this.kit.card.at = [ tile.left + tile.width / 2 - host.left, tile.top - host.top - 12 - this.kit.card.offsetHeight / 2 ]
    }
}
