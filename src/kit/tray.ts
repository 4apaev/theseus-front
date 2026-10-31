import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { type Session, aboard, goodName } from '../core/session.ts'
import type { Side } from '../core/transport/types.ts'
import { credits, emit } from '../core/util.ts'
import { iconOf } from '../content/places.ts'

export interface Tile {
    gid   : string,
    name  : string,
    icon  : string,
    group : string,
    price : Record<Side, number>,
    aboard: number,
    busy  : boolean,
}

/**
 * the goods on offer as decks, one closed deck per kind, the modules
 * last. a deck names its kind, its count and its lowest price. a hover,
 * or a tap, fans it out; a card from the fan emits `pick` with the gid,
 * and the place reads `side`. the switch picks the side: a sale shows
 * only what is aboard. a card drags into the hold; a hold piece dropped
 * here emits `sell`.
 */
export class KitTray extends AppElement {
    static properties = { tiles: { attribute: false }, side: {}, open: { state: true }}
    declare tiles?: Tile[]
    declare side: Side
    declare open: string

    constructor() {
        super()
        this.side = 'buy'
        this.open = ''
    }

    // the open fan's half width, as the css lays it, kept inside the row of decks, and clear of the view's keys over its left end
    override updated() {
        const row = this.querySelector(':scope > ul'), li = row?.querySelector<HTMLElement>(':scope > li[data-open]'), fan = li?.querySelector('ol')
        if (!row || !li || !fan) return
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize), n = fan.children.length, half = ((n - 1) * Math.min(4.75, 28 / n) / 2 + 3.25) * rem
        const box = row.getBoundingClientRect(), r = li.getBoundingClientRect(), mid = r.left + r.width / 2
        const left = box.left + rem + half - mid, right = mid + half - box.right
        fan.style.setProperty('--shift', `${ left > 0 ? left : right > 0 ? -right : 0 }px`)
    }

    override render() {
        const shown = (this.tiles ?? []).filter(t => this.side === 'buy' || t.aboard > 0)
        const groups = [ ...new Set(shown.map(t => t.group)) ].sort((a, b) => +(a === 'module') - +(b === 'module'))
        return html`
            <menu>${ ([ 'buy', 'sell' ] as const).map(side => html`
                <button ?data-on=${ side === this.side } @click=${ () => this.side = side }>${ side }</button>`) }
            </menu>
            <ul @dragover=${ (e: DragEvent) => e.preventDefault() } @drop=${ (e: DragEvent) => this.drop(e) }>${ groups.map(g => this.deck(g, shown.filter(t => t.group === g))) }${ groups.length
                ? ''
                : html`<li><b>${ this.side === 'buy' ? 'nothing on offer' : 'nothing aboard' }</b></li>` }
            </ul>`
    }

    // a closed deck: its kind, its count, its lowest price, a stack of its first icons; its fan over it
    private deck(group: string, tiles: Tile[]) {
        const from = Math.min(...tiles.map(t => t.price[ this.side ]))
        return html`
            <li style="--n: ${ tiles.length }" ?data-open=${ this.open === group } @pointerenter=${ (e: PointerEvent) => this.hover(e, group) } @pointerleave=${ (e: PointerEvent) => this.hover(e, '') }>
                <button @click=${ (e: PointerEvent) => this.open = e.pointerType === 'mouse' || this.open !== group ? group : '' }>
                    <b>${ group === 'module' ? 'modules' : group }</b>
                    <small>${ tiles.length } ${ tiles.length > 1 ? 'goods' : 'good' } · from ${ credits(from, 0) }</small>
                    <i>${ tiles.slice(0, 4).map(t => html`<img src=${ t.icon } alt="">`) }</i>
                </button>
                <ol>${ tiles.map((t, i) => this.card(t, i)) }</ol>
            </li>`
    }

    private card(t: Tile, i: number) {
        return html`
            <li style="--i: ${ i }">
                <button
                    value=${ t.gid }
                    draggable="true"
                    ?data-busy=${ t.busy }
                    @click=${ () => emit(this, 'pick', t.gid) }
                    @dragstart=${ (e: DragEvent) => e.dataTransfer?.setData('text/plain', `good ${ t.gid }`) }
                >
                <img src=${ t.icon } alt="">
                <b>${ t.name }</b>
                <data value=${ t.price[ this.side ] }>${ credits(t.price[ this.side ], 0) }</data>
                ${ t.aboard
                        ? html`<s>${ t.aboard } aboard</s>`
                        : ''
                }</button>
            </li>`
    }

    // a mouse fans a deck as it comes over it, and closes it as it goes; a touch waits for the tap
    private hover(e: PointerEvent, group: string) {
        if (e.pointerType === 'mouse') this.open = group
    }

    private drop(e: DragEvent) {
        const [ what, gid ] = (e.dataTransfer?.getData('text/plain') ?? '').split(' ')
        what === 'piece' && emit(this, 'sell', gid)
    }
}
customElements.define('kit-tray', KitTray)

/** the station's quotes as tiles: a module apart, a good by its kind. */
export function tilesOf(s: Session, busy: Map<string, number>): Tile[] {
    return s.market.map(m => {
        const g = s.universe?.goods[ m.gid ]
        return {
            gid   : m.gid,
            name  : goodName(s, m.gid),
            icon  : iconOf(m.gid, g?.kind),
            group : g?.kind === 'module' ? 'module' : g?.category ?? 'goods',
            price : { buy: m.price_buy, sell: m.price_sell },
            aboard: aboard(s, m.gid),
            busy  : busy.has(m.gid),
        }
    })
}
