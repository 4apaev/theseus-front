import { html } from 'lit'
import type { GameClient } from '../core/client.ts'
import { type Session, aboard, cargoLoad, goodName, volumeOf } from '../core/session.ts'
import type { MarketRow, Side } from '../core/transport/types.ts'
import { Fail, credits } from '../core/util.ts'
import type { Kit } from '../kit/index.ts'

/**
 * the trade card: buy or sell one good at the station's quote. a sell
 * opens with all that is aboard. a trade in flight keeps its good busy
 * until the hold changes, or a refusal lands. the place puts the card
 * next to its thing.
 */
export class Trade {
    readonly busy = new Map<string, number>
    gid?: string
    /** the place redraws: the trade's good is busy now. */
    onTrade?: () => void
    private readonly kit: Kit
    private readonly client: GameClient
    private session?: Session
    private side: Side = 'buy'
    private n = 1

    constructor(kit: Kit, client: GameClient) {
        this.kit    = kit
        this.client = client
    }

    sync(s: Session) {
        this.session = s
        if (s.log[ 0 ]?.kind === 'err') this.busy.clear()
        for (const [ gid, had ] of this.busy) if (aboard(s, gid) !== had) this.busy.delete(gid)
        if (!this.kit.card.hidden && this.gid) this.open()
    }

    /** opens the card; false when the station does not quote the good. */
    pick(gid: string, side: Side) {
        const s = this.session
        if (!s?.market.some(m => m.gid === gid)) {
            this.kit.toast.say(`${ s ? goodName(s, gid) : gid } is not quoted here`, true)
            return false
        }
        Object.assign(this, { gid, side, n: side === 'sell' ? aboard(s, gid) : 1 })
        this.open()
        return true
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
                    <dt>at most</dt><dd>${ most || `0 · ${ this.why(s, m, price) }` }</dd>
                </dl>
                <button ?disabled=${ this.n < 1 || this.n > most }>${ this.side } ${ this.n }</button>
            </form>`
    }

    // a buy is held by the wallet and the free hold, a sell by what is aboard
    private most(s: Session, m: MarketRow, price: number) {
        if (this.side === 'sell') return aboard(s, m.gid)
        return Math.max(0, Math.floor(Math.min((s.me?.balance ?? 0) / price, room(s, m.gid))))
    }

    // what holds a trade at 0
    private why(s: Session, m: MarketRow, price: number) {
        if (this.side === 'sell') return 'none aboard'
        return room(s, m.gid) < 1 ? 'the hold is full' : (s.me?.balance ?? 0) < price ? 'not enough credits' : ''
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
        this.onTrade?.()
    }
}

// the units of a good the free hold takes
function room(s: Session, gid: string) {
    return ((s.ship?.capacity ?? 0) - cargoLoad(s)) / volumeOf(s, gid)
}
