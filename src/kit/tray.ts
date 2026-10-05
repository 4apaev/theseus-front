import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { credits, emit } from '../core/util.ts'

export interface Tile { gid: string, name: string, icon: string, price: number, aboard: number, busy: boolean }

/** the goods on offer: icon, name, price, what the hold has. a pick emits `pick` with the gid. */
export class KitTray extends AppElement {
    static properties = { tiles: { attribute: false }}
    declare tiles?: Tile[]

    override render() {
        return html`<ul>${ (this.tiles ?? []).map(t => html`
            <li><button ?data-busy=${ t.busy } @click=${ () => emit(this, 'pick', t.gid) }>
                <img src=${ t.icon } alt="">
                <b>${ t.name }</b>
                <data value=${ t.price }>${ credits(t.price, 0) }</data>
                ${ t.aboard ? html`<small>${ t.aboard } aboard</small>` : '' }
            </button></li>`) }</ul>`
    }
}
customElements.define('kit-tray', KitTray)
