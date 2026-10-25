import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { type Session, goodName, volumeOf } from '../core/session.ts'
import { emit } from '../core/util.ts'
import { iconOf } from '../content/places.ts'

export interface Piece { gid: string, name: string, icon: string, quantity: number, cells: number }

/**
 * the hold as cells, one per unit of capacity. a good is one piece of as
 * many cells as its volume asks; its first cell shows the icon. drag a
 * piece out to sell it, drop a good in to buy it: `sell` or `buy` with
 * the gid. the place asks with a card.
 */
export class KitHold extends AppElement {
    static properties = { pieces: { attribute: false }, capacity: { type: Number }}
    declare pieces?: Piece[]
    declare capacity: number

    override render() {
        const pieces = this.pieces ?? [], used = pieces.reduce((n, p) => n + p.cells, 0)
        return html`
            <header><b>hold</b> <data value=${ used }>${ used } / ${ this.capacity }</data></header>
            <ol @dragover=${ (e: DragEvent) => e.preventDefault() } @drop=${ (e: DragEvent) => this.drop(e) }>
                ${ pieces.flatMap(p => Array.from({ length: p.cells }, (_, i) => html`
                    <li draggable="true" title=${ p.name } data-gid=${ p.gid } @dragstart=${ (e: DragEvent) => e.dataTransfer?.setData('text/plain', `piece ${ p.gid }`) }>
                        ${ i ? '' : html`<img src=${ p.icon } alt=${ p.name }><small>${ p.quantity }</small>` }
                    </li>`)) }
                ${ Array.from({ length: Math.max(0, this.capacity - used) }, () => html`<li></li>`) }
            </ol>`
    }

    private drop(e: DragEvent) {
        const [ what, gid ] = (e.dataTransfer?.getData('text/plain') ?? '').split(' ')
        if (what === 'good') emit(this, 'buy', gid)
    }
}
customElements.define('kit-hold', KitHold)

/** the session's cargo as pieces of the hold. */
export function piecesOf(s: Session): Piece[] {
    return s.cargo.map(c => ({
        gid     : c.gid,
        name    : goodName(s, c.gid),
        icon    : iconOf(c.gid, s.universe?.goods[ c.gid ]?.kind),
        quantity: c.quantity,
        cells   : Math.ceil(c.quantity * volumeOf(s, c.gid)),
    }))
}
