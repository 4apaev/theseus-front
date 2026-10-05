import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { credits, emit } from '../core/util.ts'

export interface Tile { gid: string, name: string, icon: string, price: number, aboard: number, busy: boolean }

/**
 * the goods on offer: icon, name, price, what the hold has. a pick emits
 * `pick` with the gid. a good drags into the hold; a hold piece dropped
 * here emits `sell`.
 */
export class KitTray extends AppElement {
    static properties = { tiles: { attribute: false }}
    declare tiles?: Tile[]

    override render() {
        return html`<ul @dragover=${ (e: DragEvent) => e.preventDefault() } @drop=${ (e: DragEvent) => this.drop(e) }>${ (this.tiles ?? []).map(t => html`
            <li><button draggable="true" ?data-busy=${ t.busy } @click=${ () => emit(this, 'pick', t.gid) } @dragstart=${ (e: DragEvent) => e.dataTransfer?.setData('text/plain', `good ${ t.gid }`) }>
                <img src=${ t.icon } alt="">
                <b>${ t.name }</b>
                <data value=${ t.price }>${ credits(t.price, 0) }</data>
                ${ t.aboard ? html`<small>${ t.aboard } aboard</small>` : '' }
            </button></li>`) }</ul>`
    }

    private drop(e: DragEvent) {
        const [ what, gid ] = (e.dataTransfer?.getData('text/plain') ?? '').split(' ')
        if (what === 'piece') emit(this, 'sell', gid)
    }
}
customElements.define('kit-tray', KitTray)
