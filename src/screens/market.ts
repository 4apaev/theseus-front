import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button, fieldLabel } from '../components/controls.ts'
import { stationView } from '../components/station.ts'
import { GOODS, quote, capacityOf, trade } from '../model.ts'
import type { GoodId } from '../model.ts'
import { number, credits } from '../util.ts'

class MarketScreen extends GameScreen {
    static properties = { good: { state: true }, side: { state: true }, quantity: { state: true }}
    declare good: GoodId
    declare side: 'buy' | 'sell'
    declare quantity: number

    constructor() {
        super()
        this.good = 'ore'
        this.side = 'buy'
        this.quantity = 5
    }

    private scene() {
        return stationView({ host: this, game: this.game, mode: 'market', selected: 'cargo', motion: this.motion, toggleMotion: () => { this.motion = !this.motion }, navigate: view => this.navigate(view), selectModule: id => { this.navigate('rig', id) } })
    }

    override render() {
        if (!this.active) return nothing
        return html`<div class="operations">${ this.scene() }<app-panel>${ this.marketPanel() }</app-panel></div>`
    }

    private marketPanel() {
        const good = GOODS[ this.good ], q = quote(this.game, this.good, this.side, this.quantity)
        return html`${ this.panelHeader('sol commodity exchange', 'a fair exchange', 'local') }
            <div class="commodity-list">${ (Object.keys(GOODS) as GoodId[]).map(id => html`<button class=${ this.good === id ? 'commodity active' : 'commodity' } @click=${ () => { this.good = id } }><span class="commodity-icon" style=${ `--commodity:${ GOODS[ id ].tint }` }>${ GOODS[ id ].code }</span><span><b>${ GOODS[ id ].name }</b><small>${ this.game.stock[ id ] } available · ${ this.game.cargo[ id ] } aboard</small></span><strong>${ credits(GOODS[ id ][ this.side ]) }<small>/ unit</small></strong></button>`) }</div>
            <div class="segmented"><button class=${ this.side === 'buy' ? 'active' : '' } @click=${ () => { this.side = 'buy' } }>buy cargo</button><button class=${ this.side === 'sell' ? 'active' : '' } @click=${ () => { this.side = 'sell' } }>sell cargo</button></div>
            ${ fieldLabel('quantity', 'quantity', `${ good.volume } hold ${ good.volume === 1 ? 'unit' : 'units' } each`) }<div class="stepper"><button aria-label="decrease quantity" ?disabled=${ this.quantity <= 1 } @click=${ () => { this.quantity = Math.max(1, this.quantity - 1) } }>−</button><input id="quantity" type="number" min="1" step="1" .value=${ String(this.quantity) } @input=${ (e: Event) => { this.quantity = Number((e.target as HTMLInputElement).value) } }><button aria-label="increase quantity" @click=${ () => { this.quantity += 1 } }>+</button></div>
            <dl><div><dt>unit price</dt><dd>${ credits(good[ this.side ]) }</dd></div><div><dt>hold after trade</dt><dd class=${ q.load > capacityOf(this.game) ? 'danger' : '' }>${ number(q.load) } / ${ capacityOf(this.game) }</dd></div><div class="total"><dt>total ${ this.side === 'buy' ? 'cost' : 'return' }</dt><dd>${ credits(q.amount) }</dd></div></dl>
            <p class=${ q.error ? 'validation error' : 'validation' }>${ q.error || 'cargo transfer ready · no station fee' }</p>${ button({ label: `${ this.side } ${ number(this.quantity) } ${ good.name }`, variant: 'primary', disabled: !!q.error, icon: 'arrow', click: () => this.act(() => trade(this.game, this.good, this.side, this.quantity), `${ this.quantity } ${ good.name } ${ this.side === 'buy' ? 'loaded' : 'sold' }`) }) }<small class="footnote">fixed demo prices · shared hold across all hulls</small>`
    }
}
customElements.define('market-screen', MarketScreen)
