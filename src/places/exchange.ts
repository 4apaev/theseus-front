import { html } from 'lit'
import type * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Session, aboard, cargoLoad, goodName, volumeOf } from '../core/session.ts'
import type { MarketRow, Side } from '../core/transport/types.ts'
import { Fail, credits } from '../core/util.ts'
import { PLATE, type PlaceKit, iconOf, placeKit } from '../content/places.ts'
import type { Kit } from '../kit/index.ts'
import { type Stage, VH, VW } from '../world/stage.ts'
import type { Place } from './router.ts'

/**
 * the exchange: the painted room, and a tray of what the station quotes.
 * a pick opens a card to buy or sell. a trade in flight keeps its tile
 * busy until the hold changes, or a refusal lands.
 */
export class Exchange implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly client: GameClient
    private readonly made: T.Mesh[] = []
    private readonly busy = new Map<string, number>
    private session?: Session
    private gid?: string
    private side: Side = 'buy'
    private n = 1
    private visit = 0

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        this.stage  = stage
        this.kit    = kit
        this.client = client
        kit.tray.addEventListener('pick', e => void this.pick((e as CustomEvent<string>).detail))
    }

    async enter(s: Session) {
        const visit = ++this.visit
        this.session = s
        this.stage.sky.show()
        const k = await placeKit('exchange')
        if (visit !== this.visit) return
        this.paint(k)
        this.kit.tray.hidden = false
        this.sync(s)
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
        if (!this.kit.card.hidden && this.gid) this.show()
    }

    leave() {
        this.visit++
        this.kit.tray.hidden = true
        this.kit.card.close()
        for (const m of this.made.splice(0)) {
            m.removeFromParent()
            ;(m.material as T.MeshBasicMaterial).map?.dispose()
        }
    }

    // the plate fills the frame; each part stands on its foot, the lower ones in front
    private paint(k: PlaceKit) {
        const st = this.stage, f = VW / PLATE
        this.made.push(st.sprite(st.back, `${ k.base }/${ k.plate }`, { x: VW / 2, y: VH / 2, w: VW }))
        for (const p of k.placements) {
            const part = k.parts.find(q => q.name === p.name)
            if (part) this.made.push(st.sprite(st.back, `${ k.base }/${ part.file }`, { x: p.x * f, y: p.y * f, w: p.width * f, foot: [ part.foot[ 0 ] / part.w, part.foot[ 1 ] / part.h ], z: 1 + p.y / PLATE }))
        }
    }

    // the card sits above the picked tile
    private async pick(gid: string) {
        this.gid  = gid
        this.side = 'buy'
        this.n    = 1
        this.show()
        await this.kit.card.updateComplete
        const i = this.session?.market.findIndex(m => m.gid === gid) ?? -1
        const tile = this.kit.tray.querySelectorAll('button')[ i ]?.getBoundingClientRect()
        const host = this.stage.host.getBoundingClientRect()
        if (tile) this.kit.card.at = [ tile.left + tile.width / 2 - host.left, tile.top - host.top - 12 - this.kit.card.offsetHeight / 2 ]
    }

    private show() {
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
                    <dt>total</dt> <dd>${ credits(price * this.n) }</dd>
                    <dt>aboard</dt><dd>${ aboard(s, m.gid) }</dd>
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
        this.show()
    }

    private count(n: number) {
        this.n = n
        this.show()
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
