import {
    html,
    nothing,
    type PropertyValues,
} from 'lit'

import { AppElement } from './element.ts'
import './hull-preview.ts'

import {
    HULLS,
    DEFAULT_HULL,
    type HullId,
    type Hull,
} from '../model.ts'

import { emit } from '../util.ts'
import { icon } from '../icons.ts'

/** the hull catalogue is a visual preview. the server knows one hull today. */
class FleetCatalog extends AppElement {
    static properties = {
        hull: {},
        open: { type: Boolean },
    }

    declare hull: HullId
    declare open: boolean

    constructor() {
        super()
        this.hull = DEFAULT_HULL
        this.open = false
    }

    override updated(changes: PropertyValues) {
        if (changes.has('open')) {
            const dialog = this.querySelector('dialog')
            if (this.open)
                dialog?.showModal()
            else
                dialog?.close()
        }
    }

    private closeFleet() {
        emit(this, 'catalog-close', undefined)
    }

    private selectHull(id: HullId) {
        emit(this, 'hull-select', id)
    }

    override render() {
        return this.open
            ? this.fleetDialog()
            : nothing
    }

    private hullGrid(hulls: readonly (Hull & { id: HullId })[]) {
        return html`<div class="hull-grid">${ hulls.map(h => html`
            <button class=${ this.hull === h.id ? 'hull-card selected' : 'hull-card' } @click=${ () => this.selectHull(h.id) }>
                <hull-preview hull=${ h.id } category=${ h.category }></hull-preview>
                <b>${ h.name }</b>
                <small>${ h.kind } · ${ h.purpose }</small>
                <small>${ h.capacity } hold units ${ this.hull === h.id ? '· selected' : '' }</small>
            </button>`) }</div>`
    }

    private fleetDialog() {
        return html`
        <dialog
            class="fleet-dialog"
            @cancel=${ (e: Event) => { e.preventDefault(); this.closeFleet() } }
            @click=${ (e: MouseEvent) => { if (e.target === e.currentTarget) this.closeFleet() } }
        >
            <div class="fleet-content">
                <header>
                    <div>
                        <small data-kicker>vessel architecture / ${ HULLS.length } hulls</small>
                        <h2>form follows purpose.</h2>
                        <p>select a hull to preview its geometry in drydock. more hulls are coming to the yards.</p>
                    </div>
                    <button
                        data-variant="icon"
                        aria-label="close hull catalog"
                        @click=${ this.closeFleet }
                    >${ icon('close') }</button>
                </header>${ ([ 'industrial', 'civil', 'security' ] as const).map(category => html`

                <section class="fleet-category ${ category }">
                    <h3>
                        <span data-shape aria-hidden="true"></span>
                        ${ category }
                        <span>${
                            category === 'industrial'
                                ? 'ochre / graphite / stone'
                                : category === 'civil'
                                    ? 'ivory / teal / slate'
                                    : 'gunmetal / oxide / cold gray'
                        }</span>
                    </h3>
                    ${ this.hullGrid(HULLS.filter(h => h.category === category && !h.family)) }
                    ${ category === 'civil'
                        ? html`
                        <section class="research-hulls" aria-labelledby="research-hulls-title">
                            <h4 id="research-hulls-title">research vessels</h4>
                            ${ this.hullGrid(HULLS.filter(h => h.family === 'research')) }
                        </section>`
                        : nothing }

                </section>`) }
                <p class="footnote">blender hull models · categories set the palette · a visual preview, the starter hull flies</p>
            </div>
        </dialog>`
    }
}
customElements.define('fleet-catalog', FleetCatalog)
