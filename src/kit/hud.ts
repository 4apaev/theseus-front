import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { type Session, station } from '../core/session.ts'
import './credits.ts'

/** the top line: where the ship is, the ship, the wallet. */
export class KitHud extends AppElement {
    static properties = { session: { attribute: false }}
    declare session?: Session

    override render() {
        const s = this.session
        if (!s?.ship) return
        const at = station(s, s.ship.stid)
        const sys = s.universe?.systems.find(x => x.sysid === at?.system)
        return html`
            <header>
                <p>${ at ? html`<b>${ at.name }</b> · ${ sys?.name }` : html`<b>in transit</b> → ${ station(s, s.ship.to)?.name }` }</p>
                <p><b>${ s.ship.name }</b> <kit-credits .value=${ s.me?.balance ?? 0 }></kit-credits></p>
            </header>`
    }
}
customElements.define('kit-hud', KitHud)
