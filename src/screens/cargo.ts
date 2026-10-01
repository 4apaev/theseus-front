import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button } from '../components/controls.ts'
import { swatch } from '../model.ts'
import { docked, goodName, good, volumeOf, cargoLoad, sellersOf, quoted } from '../session.ts'
import type { CargoRow } from '../transport/types.ts'
import { credits } from '../util.ts'

/** the hold, docked or under way. sell where the station quotes; a module without one names where it does. */
class CargoScreen extends GameScreen {
    static properties = { gid: { state: true }, quantity: { state: true }}
    declare gid: string
    declare quantity: number

    constructor() {
        super()
        this.gid = ''
        this.quantity = 1
    }

    override render() {
        if (!this.active) return nothing
        return html`<div class="cargo-page"><app-panel>${ this.panel() }</app-panel></div>`
    }

    private panel() {
        const { ship, cargo } = this.session
        if (!ship) return html`${ this.panelHeader('the hold', 'no ship', 'sync') }<p class="panel-intro">your ship is on its way from the yards. the hold fills once it arrives.</p>`

        return html`${ this.panelHeader('the hold', ship.name, docked(this.session) ? 'docked' : 'transit') }
            <dl><div><dt>hold</dt><dd>${ cargoLoad(this.session) } / ${ ship.capacity }</dd></div></dl>
            ${ cargo.length
                ? html`<ul class="cargo-list">${ cargo.map(c => this.row(c)) }</ul>`
                : html`<p class="footnote">the hold is empty</p>` }`
    }

    private row(c: CargoRow) {
        const kind = good(this.session, c.gid)?.kind ?? 'commodity'
        const open = this.gid === c.gid
        return html`<li class="cargo-row">
            <div class="cargo-row-top">
                ${ this.item(c, kind) }
                ${ open ? nothing : this.control(c, kind) }
            </div>
            ${ open ? this.sellControl(c) : nothing }
        </li>`
    }

    private item(c: CargoRow, kind: string) {
        const s = swatch(c.gid)
        return html`<span class="cargo-item">
            <span class=${ `commodity-icon ${ kind === 'module' ? 'module' : '' }` } style=${ `--commodity:${ s.tint }` }>${ s.code }</span>
            <span><b>${ goodName(this.session, c.gid) }</b><small>${ kind } · ${ c.quantity } × ${ volumeOf(this.session, c.gid) } vol</small></span>
        </span>`
    }

    private control(c: CargoRow, kind: string) {
        return quoted(this.session, c.gid)
            ? button({ label: 'sell', variant: 'secondary', click: () => { this.gid = c.gid; this.quantity = c.quantity } })
            : html`<small class="cargo-note">${ this.buyers(c.gid, kind) }</small>`
    }

    private buyers(gid: string, kind: string) {
        if (kind !== 'module') return 'sells at any exchange'
        const names = sellersOf(this.session, gid).filter(s => s.stid !== this.session.ship?.stid).map(s => s.name)
        return names.length ? `sells at ${ names.join(', ') }` : 'no exchange trades this'
    }

    private sellControl(c: CargoRow) {
        const price = this.session.market.find(m => m.gid === c.gid)?.price_sell ?? 0
        const invalid = !Number.isSafeInteger(this.quantity) || this.quantity < 1 || this.quantity > c.quantity
        return html`<div class="cargo-sell">
            <div class="cargo-sell-row">
                <div class="stepper">
                    <button aria-label="decrease quantity" ?disabled=${ this.quantity <= 1 } @click=${ () => { this.quantity = Math.max(1, this.quantity - 1) } }>−</button>
                    <input type="number" min="1" max=${ c.quantity } step="1" .value=${ String(this.quantity) } @input=${ (e: Event) => { this.quantity = Number((e.target as HTMLInputElement).value) } }>
                    <button aria-label="increase quantity" ?disabled=${ this.quantity >= c.quantity } @click=${ () => { this.quantity = Math.min(c.quantity, this.quantity + 1) } }>+</button>
                </div>
                <strong>${ credits(price * this.quantity) }</strong>
            </div>
            ${ button({ label: 'confirm sale', variant: 'primary', disabled: invalid, click: () => this.run(() => this.client.trade('sell', c.gid, this.quantity)) }) }
            ${ button({ label: 'cancel', variant: 'text', click: () => { this.gid = '' } }) }
        </div>`
    }
}
customElements.define('cargo-screen', CargoScreen)
