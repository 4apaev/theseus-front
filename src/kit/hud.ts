import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { type Session, station } from '../core/session.ts'
import { emit } from '../core/util.ts'
import './credits.ts'

const PLACES = [ 'port', 'exchange', 'hold', 'chart', 'orbit', 'rigging', 'comms' ]

/** the top line: where the ship is, the places, the ship, the wallet. */
export class KitHud extends AppElement {
    static properties = { session: { attribute: false }, place: {}}
    declare session?: Session
    declare place?: string

    override render() {
        const s = this.session
        if (!s?.ship) return
        const at = station(s, s.ship.stid)
        const sys = s.universe?.systems.find(x => x.sysid === at?.system)
        return html`
            <header>
                <p>${ at ? html`<b>${ at.name }</b> · ${ sys?.name }` : html`<b>in transit</b> → ${ station(s, s.ship.to)?.name }` }</p>
                ${ at ? html`<nav>${ PLACES.map(p => html`<a href="#${ p }" ?data-on=${ p === this.place }>${ p }</a>`) }</nav>` : '' }
                <p><b>${ s.ship.name }</b> <kit-credits .value=${ s.me?.balance ?? 0 }></kit-credits> <button @click=${ () => emit(this, 'settings', void 0) }>settings</button> <button @click=${ () => emit(this, 'logout', void 0) }>logout</button></p>
            </header>`
    }
}
customElements.define('kit-hud', KitHud)
