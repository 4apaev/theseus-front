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
 * the goods on offer, by kind, and the modules in a list of their own.
 * the switch picks the side: a sale shows only what is aboard. each tile
 * shows its price for the side. a pick emits `pick` with the gid; the
 * place reads `side`. a good drags into the hold; a hold piece dropped
 * here emits `sell`. under the pointer the tiles swell, like the dock.
 */
export class KitTray extends AppElement {
    static properties = { tiles: { attribute: false }, side: {}}
    declare tiles?: Tile[]
    declare side: Side
    private readonly rest = new WeakMap<Element, { left: number, width: number }>
    private readonly scrolled = new WeakMap<Element, number>
    private readonly sizer = new ResizeObserver(() => this.updated())

    constructor() {
        super()
        this.side = 'buy'
    }

    override connectedCallback() {
        super.connectedCallback()
        this.sizer.observe(this)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        this.sizer.disconnect()
    }

    override updated() {
        for (const list of this.querySelectorAll<HTMLElement>(':scope > ul')) more(list)
    }

    override render() {
        const shown = (this.tiles ?? []).filter(t => this.side === 'buy' || t.aboard > 0)
        const modules = shown.filter(t => t.group === 'module')
        return html`
            <menu>${ ([ 'buy', 'sell' ] as const).map(side => html`
                <button ?data-on=${ side === this.side } @click=${ () => this.side = side }>${ side }</button>`) }
            </menu>
            ${ this.list(shown.filter(t => t.group !== 'module'), this.side === 'buy' ? 'nothing on offer' : 'nothing aboard') }
            ${ modules.length ? this.list(modules, '') : '' }`
    }

    // a list of groups, each a row of tiles
    private list(tiles: Tile[], none: string) {
        const groups = [ ...new Set(tiles.map(t => t.group)) ]
        return html`
            <ul
                @dragover=${ (e: DragEvent) => e.preventDefault() }
                @drop=${ (e: DragEvent) => this.drop(e) }
                @pointerenter=${ this.measure }
                @pointermove=${ this.swell }
                @pointerleave=${ this.calm }
                @scroll=${ (e: Event) => more(e.currentTarget as HTMLElement) }
                @wheel=${ this.calm }>${ groups.map(g => html`
                <li><b>${ g === 'module' ? 'modules' : g }</b><ul>${ tiles.filter(t => t.group === g).map(t => this.tile(t)) }</ul></li>`) }${ groups.length
                    ? ''
                    : html`<li><b>${ none }</b></li>`
                }
            </ul>`
    }

    private tile(t: Tile) {
        return html`
            <li>
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

    // the tiles at rest, along their list, before they swell, and the list's scroll then
    private readonly measure = (e: Event) => {
        const list = e.currentTarget
        if (!(list instanceof HTMLElement)) return
        rest(list)
        const left = list.getBoundingClientRect().left - list.scrollLeft
        this.scrolled.set(list, list.scrollLeft)
        for (const li of cells(list)) {
            const r = li.getBoundingClientRect()
            this.rest.set(li, { left: r.left - left, width: r.width })
        }
    }

    /*
        like the dock: the tile under the pointer swells, its neighbours less.
        `--zoom` carries it to the css. the tiles left of the pointer grow
        too; the list scrolls by their growth, so the point under the
        pointer stays under it.
    */
    private readonly swell = (e: PointerEvent) => {
        const list = e.currentTarget
        if (!(list instanceof HTMLElement)) return
        if (!this.scrolled.has(list)) this.measure(e)
        const scrolled = this.scrolled.get(list) ?? 0, x = e.clientX - list.getBoundingClientRect().left + scrolled
        let shift = 0
        for (const li of cells(list)) {
            const r = this.rest.get(li) ?? { left: x, width: 0 }
            const z = 1 + .6 * Math.cos(Math.min(1, Math.abs(x - r.left - r.width / 2) / 160) * Math.PI / 2)
            li.style.setProperty('--zoom', String(z))
            shift += (z - 1) * Math.max(0, Math.min(r.width, x - r.left))
        }
        list.scrollLeft = scrolled + shift
    }

    private readonly calm = (e: Event) => {
        if (!(e.currentTarget instanceof HTMLElement)) return
        rest(e.currentTarget)
        this.scrolled.delete(e.currentTarget)
    }

    private drop(e: DragEvent) {
        const [ what, gid ] = (e.dataTransfer?.getData('text/plain') ?? '').split(' ')
        what === 'piece' && emit(this, 'sell', gid)
    }
}
customElements.define('kit-tray', KitTray)

// every tile of a list back to its size at rest
function rest(list: HTMLElement) {
    for (const li of cells(list))
        li.style.removeProperty('--zoom')
}

// marks the edges of a list with tiles past them: the css fades them
function more(list: HTMLElement) {
    const left = list.scrollLeft > 1, right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
    if (left || right) list.dataset.more = left && right ? 'both' : left ? 'left' : 'right'
    else delete list.dataset.more
}

// a list's tiles, in order
function cells(list: HTMLElement) {
    return list.querySelectorAll<HTMLLIElement>('li li')
}

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
