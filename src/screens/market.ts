import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button, fieldLabel } from '../components/controls.ts'
import { stationView } from '../components/station.ts'
import { swatch } from '../model.ts'
import { docked, stationName, goodName, good, aboard, cargoLoad, volumeOf, visualFitted } from '../session.ts'
import type { Side, MarketRow } from '../transport/types.ts'
import { number, credits } from '../util.ts'

/** the exchange: real quotes, real hold, one command per trade. */
class MarketScreen extends GameScreen {
    static properties = { gid: { state: true }, side: { state: true }, quantity: { state: true }, hull: {}}
    declare gid: string
    declare side: Side
    declare quantity: number
    declare hull: string

    constructor() {
        super()
        this.gid = ''
        this.side = 'buy'
        this.quantity = 1
        this.hull = 'freighter'
    }

    override render() {
        if (!this.active) return nothing
        const scene = stationView({ host: this, hull: this.hull, fitted: visualFitted(this.session.fitted), load: cargoLoad(this.session), mode: 'market', motion: this.motion, selected: 'cargo', navigate: view => this.navigate(view), toggleMotion: () => { this.motion = !this.motion } })
        return html`<div class="operations">${ scene }<app-panel>${ this.panel() }</app-panel></div>`
    }

    private row(): MarketRow | undefined {
        return this.session.market.find(m => m.gid === this.gid) ?? this.session.market[ 0 ]
    }

    private panel() {
        const { ship } = this.session
        if (!ship || !docked(this.session))
            return html`${ this.panelHeader('exchange', 'market offline', 'transit') }<p class="panel-intro">quotes return at the next dock.</p>`

        const row = this.row()
        if (!row)
            return html`${ this.panelHeader(stationName(this.session, ship.stid), 'no goods quoted', 'open') }<p class="panel-intro">the exchange has posted no prices yet.</p>`

        const q = this.quote(row)
        return html`${ this.panelHeader(`${ stationName(this.session, ship.stid) } exchange`, 'a fair exchange', 'open') }
            <div class="commodity-list">${ this.session.market.map(m => this.commodity(m, m.gid === row.gid)) }</div>
            <div class="segmented">
                <button class=${ this.side === 'buy' ? 'active' : '' } @click=${ () => { this.side = 'buy' } }>buy cargo</button>
                <button class=${ this.side === 'sell' ? 'active' : '' } @click=${ () => { this.side = 'sell' } }>sell cargo</button>
            </div>
            ${ fieldLabel('quantity', 'quantity', `${ volumeOf(this.session, row.gid) } hold ${ volumeOf(this.session, row.gid) === 1 ? 'unit' : 'units' } each`) }
            <div class="stepper">
                <button aria-label="decrease quantity" ?disabled=${ this.quantity <= 1 } @click=${ () => { this.quantity = Math.max(1, this.quantity - 1) } }>−</button>
                <input id="quantity" type="number" min="1" step="1" .value=${ String(this.quantity) } @input=${ (e: Event) => { this.quantity = Number((e.target as HTMLInputElement).value) } }>
                <button aria-label="increase quantity" @click=${ () => { this.quantity += 1 } }>+</button>
            </div>
            <dl>
                <div><dt>unit price</dt><dd>${ credits(q.price) }</dd></div>
                <div><dt>hold after trade</dt><dd class=${ q.load > ship.capacity ? 'danger' : '' }>${ number(q.load) } / ${ ship.capacity }</dd></div>
                <div class="total"><dt>total ${ this.side === 'buy' ? 'cost' : 'return' }</dt><dd>${ credits(q.amount) }</dd></div>
            </dl>
            <p class=${ q.error ? 'validation error' : 'validation' }>${ q.error || 'the market settles at up to 10% off the quote' }</p>
            ${ button({ label: `${ this.side } ${ number(this.quantity) } ${ goodName(this.session, row.gid) }`, variant: 'primary', disabled: !!q.error, icon: 'arrow', click: () => this.run(() => this.client.trade(this.side, row.gid, this.quantity)) }) }
            <small class="footnote">quotes drift with station stock · the server settles every trade</small>`
    }

    private commodity(m: MarketRow, active: boolean) {
        const s = swatch(m.gid)
        const kind = good(this.session, m.gid)?.kind ?? 'commodity'
        return html`<button class=${ active ? 'commodity active' : 'commodity' } @click=${ () => { this.gid = m.gid } }>
            <span class="commodity-icon" style=${ `--commodity:${ s.tint }` }>${ s.code }</span>
            <span><b>${ goodName(this.session, m.gid) }</b><small>${ kind } · ${ aboard(this.session, m.gid) } aboard</small></span>
            <strong>${ credits(m[ `price_${ this.side }` ]) }<small>/ unit</small></strong>
        </button>`
    }

    /* the same checks the buy saga runs, shown before the click.
       the server stays the judge; this only stops an obvious reject. */
    private quote(row: MarketRow) {
        const { ship, me } = this.session
        const buy = this.side === 'buy'
        const price = row[ `price_${ this.side }` ]
        const amount = price * this.quantity
        const load = cargoLoad(this.session) + (buy ? 1 : -1) * this.quantity * volumeOf(this.session, row.gid)
        const have = aboard(this.session, row.gid)

        let error = ''
        /**/ if (!Number.isSafeInteger(this.quantity) || this.quantity < 1) error = 'enter a whole quantity of at least one'
        else if (buy && me && amount > me.balance)                          error = 'insufficient credits'
        else if (buy && ship && load > ship.capacity)                       error = 'not enough space in your hold'
        else if (!buy && this.quantity > have)                              error = 'not enough cargo to sell'
        return { price, amount, load, error }
    }
}
customElements.define('market-screen', MarketScreen)
