import { html } from 'lit'
import type { GameClient } from '../core/client.ts'
import { type Session, aboard, cargoLoad, goodName, volumeOf } from '../core/session.ts'
import type { MarketRow, Side } from '../core/transport/types.ts'
import { Fail, credits } from '../core/util.ts'
import { iconOf } from '../content/places.ts'
import type { Kit } from '../kit/index.ts'
import { piecesOf } from '../kit/hold.ts'
import type { Stage } from '../world/stage.ts'
import { Painted } from './painted.ts'

/**
 * the exchange: the painted room, a tray of what the station quotes,
 * and the hold beside it. a pick opens a card to buy or sell; so does a
 * good dragged into the hold, or a piece dragged onto the tray. a trade
 * in flight keeps its tile busy until the hold changes, or a refusal lands.
 */
export class Exchange extends Painted {
    private readonly client: GameClient
    private readonly busy = new Map<string, number>
    private gid?: string
    private side: Side = 'buy'
    private n = 1

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        super(stage, kit, [ 'exchange', 'outpost' ])
        this.client = client
        const on = (el: HTMLElement, type: string, side: Side) => el.addEventListener(type, e => void this.pick((e as CustomEvent<string>).detail, side))
        on(kit.tray, 'pick', 'buy')
        on(kit.hold, 'buy', 'buy')
        on(kit.tray, 'sell', 'sell')
    }

    sync(s: Session) {
        this.session = s
        if (s.log[ 0 ]?.kind === 'err') this.busy.clear()
        for (const [ gid, had ] of this.busy) if (aboard(s, gid) !== had) this.busy.delete(gid)
        this.kit.tray.tiles = s.market.map(m => ({
            gid   : m.gid,
            name  : goodName(s, m.gid),
            icon  : iconOf(m.gid, s.universe?.goods[ m.gid ]?.kind),
            price : m.price_buy,
            aboard: aboard(s, m.gid),
            busy  : this.busy.has(m.gid),
        }))
        Object.assign(this.kit.hold, { pieces: piecesOf(s), capacity: s.ship?.capacity ?? 0 })
        if (!this.kit.card.hidden && this.gid) this.open()
    }

    protected reveal(on: boolean) {
        this.kit.tray.hidden = !on
        this.kit.hold.hidden = !on
        this.kit.hold.dataset.place = 'exchange'
    }

    // the card sits above the good's tile. a sell opens with all that is aboard
    private async pick(gid: string, side: Side) {
        const s = this.session
        if (!s?.market.some(m => m.gid === gid)) return this.kit.toast.say(`${ goodName(s!, gid) } is not quoted here`, true)
        Object.assign(this, { gid, side, n: side === 'sell' ? aboard(s, gid) : 1 })
        this.open()
        await this.kit.card.updateComplete
        const tile = this.kit.tray.querySelectorAll('button')[ s.market.findIndex(m => m.gid === gid) ]?.getBoundingClientRect()
        const host = this.stage.host.getBoundingClientRect()
        if (tile) this.kit.card.at = [ tile.left + tile.width / 2 - host.left, tile.top - host.top - 12 - this.kit.card.offsetHeight / 2 ]
    }

    private open() {
        const s = this.session, m = s?.market.find(r => r.gid === this.gid)
        if (!s || !m) return this.kit.card.close()
        this.kit.card.show(goodName(s, m.gid), this.form(s, m), s.universe?.goods[ m.gid ]?.kind)
    }

    private form(s: Session, m: MarketRow) {
        const price = m[ `price_${ this.side }` ], most = this.most(s, m, price)
        return html`
            <form @submit=${ this.send }>
                <menu>${ ([ 'buy', 'sell' ] as const).map(side => html`
                    <button type="button" ?data-on=${ side === this.side } @click=${ () => this.flip(side) }>${ side } ${ credits(m[ `price_${ side }` ]) }</button>`) }
                </menu>
                <label>quantity <input type="number" min="1" max=${ Math.max(1, most) } .value=${ String(this.n) } @input=${ (e: Event) => this.count(+(e.target as HTMLInputElement).value) }></label>
                <dl>
                    <dt>total</dt>  <dd>${ credits(price * this.n) }</dd>
                    <dt>aboard</dt> <dd>${ aboard(s, m.gid) }</dd>
                    <dt>at most</dt><dd>${ most }</dd>
                </dl>
                <button ?disabled=${ this.n < 1 || this.n > most }>${ this.side } ${ this.n }</button>
            </form>`
    }

    // a buy is held by the wallet and the free hold, a sell by what is aboard
    private most(s: Session, m: MarketRow, price: number) {
        if (this.side === 'sell') return aboard(s, m.gid)
        const room = ((s.ship?.capacity ?? 0) - cargoLoad(s)) / volumeOf(s, m.gid)
        return Math.max(0, Math.floor(Math.min((s.me?.balance ?? 0) / price, room)))
    }

    private flip(side: Side) {
        this.side = side
        this.open()
    }

    private count(n: number) {
        this.n = n
        this.open()
    }

    private readonly send = (e: SubmitEvent) => {
        e.preventDefault()
        const s = this.session, gid = this.gid
        if (!s || !gid) return
        this.busy.set(gid, aboard(s, gid))
        this.client.trade(this.side, gid, this.n).catch(x => this.kit.toast.say(Fail.from(x).message, true))
        this.sync(s)
    }
}
