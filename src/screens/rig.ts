import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button } from '../components/controls.ts'
import { stationView } from '../components/station.ts'
import { hullSpec, fittedAt, goodName, good, cargoLoad, visualFitted, visualModule } from '../session.ts'
import type { Preview, Slot, Design } from '../transport/types.ts'
import { fmtVel, fmtAccel } from '../util.ts'

// the same rule as the contract's field.shipName. a bad name gets an answer with no round trip.
const SHIP_NAME = /^[\p{L}\p{N} '.-]{1,24}$/u

function nameError(name: string) {
    if (!name) return 'a ship needs a name'
    if (name.length > 24) return 'too long · 24 characters or fewer'
    if (!SHIP_NAME.test(name) || name.trim() !== name) return 'letters, digits, space, and - \' . only'
    return ''
}

/**
 * the rig is slot-keyed. a slot holds one packaged module from the
 * hold. install into an occupied slot replaces it. the gateway's
 * preview is advisory; the command is the judge.
 */
class RigScreen extends GameScreen {
    static properties = { slotId: {}, pick: { state: true }, preview: { state: true }, name: { state: true }, hull: {}}
    declare slotId?: string
    declare pick?: string
    declare preview?: Preview
    declare name: string
    declare hull: string

    constructor() {
        super()
        this.name = ''
        this.hull = 'freighter'
    }

    override render() {
        if (!this.active) return nothing
        const selected = visualModule(fittedAt(this.session, this.current()?.id ?? '')) ?? 'cargo'
        const scene = stationView({ host: this, hull: this.hull, fitted: visualFitted(this.session.fitted), load: cargoLoad(this.session), mode: 'rig', motion: this.motion, selected, navigate: view => this.navigate(view), toggleMotion: () => { this.motion = !this.motion } })
        return html`<div class="operations">${ scene }<app-panel>${ this.panel() }</app-panel></div>`
    }

    private current(): Slot | undefined {
        const slots = hullSpec(this.session)?.slots ?? []
        return slots.find(s => s.id === this.slotId) ?? slots[ 0 ]
    }

    private select(slot: string) {
        this.slotId = slot
        this.pick = void 0
        this.preview = void 0
    }

    private panel() {
        const { ship } = this.session
        const hull = hullSpec(this.session)
        const slot = this.current()
        if (!ship || !hull || !slot)
            return html`${ this.panelHeader('rigging', 'no rig', 'sync') }<p class="panel-intro">the ship's rig loads with the session.</p>`

        return html`${ this.panelHeader(`${ ship.hull } hull · rig ${ ship.rig }`, ship.name, ship.status) }
            <dl class="rig-stats">
                <div><dt>capacity</dt><dd>${ ship.capacity }</dd></div>
                <div><dt>velocity</dt><dd>${ fmtVel(ship.velocity) } <small>c</small></dd></div>
                <div><dt>acceleration</dt><dd>${ fmtAccel(ship.acceleration) } <small>m/s²</small></dd></div>
            </dl>
            ${ this.power(ship.power, ship.power_pool) }
            <nav class="slot-list" aria-label="rig slots">${ hull.slots.map(s => this.slotCard(s)) }</nav>
            ${ this.slotDetail(slot) }
            ${ this.rename(ship.name) }`
    }

    private power(used: number, pool: number) {
        return html`<div class="power-readout">
            <span>reactor allocation <b>${ used } / ${ pool }</b></span>
            <div class="power-segments">${ Array.from({ length: pool }, (_, i) => html`<span data-shape aria-hidden="true" class=${ i < used ? 'used' : '' }></span>`) }</div>
        </div>`
    }

    private slotCard(s: Slot) {
        const gid = fittedAt(this.session, s.id)
        return html`<button class="facility-card slot-card" aria-pressed=${ this.current()?.id === s.id } @click=${ () => this.select(s.id) }>
            <span class="facility-number">${ s.family }</span>
            <span><b>${ gid ? goodName(this.session, gid) : 'empty' }</b><small>${ s.id } · ${ s.size } mount</small></span>
        </button>`
    }

    private slotDetail(slot: Slot) {
        const gid = fittedAt(this.session, slot.id)
        const design = gid ? this.session.universe?.modules[ gid ] : void 0
        const carried = this.session.cargo.filter(c => good(this.session, c.gid)?.kind === 'module')
        return html`<section class="facility-detail" aria-label="selected slot" aria-live="polite">
            <small data-kicker>${ slot.id } / ${ slot.family }</small>
            <h3>${ gid ? goodName(this.session, gid) : 'empty slot' }</h3>
            ${ design ? this.designLine(design) : nothing }
            <div class="pick-list">
                ${ gid ? this.pickButton('remove', 'remove') : nothing }
                ${ carried.map(c => this.pickButton(c.gid, `fit ${ goodName(this.session, c.gid) } ×${ c.quantity }`)) }
                ${ !gid && !carried.length ? html`<p class="footnote">no modules in the hold · the exchange sells packaged modules</p>` : nothing }
            </div>
            ${ gid ? html`<p class="footnote">a removed or replaced module packs into the hold. sell it at an exchange that trades it.</p>` : nothing }
            ${ this.previewBlock() }
        </section>`
    }

    private designLine(d: Design) {
        const provides = d.provides.map(r => `${ r.rate } ${ r.rank }`).join(', ')
        const requires = d.requires.map(r => `${ r.rate } ${ r.rank }`).join(', ')
        return html`<p class="panel-intro">${ d.mount } mount · ${ d.power } power · ${ d.context } install${ provides ? ` · provides ${ provides }` : '' }${ requires ? ` · needs ${ requires }` : '' }</p>`
    }

    private pickButton(pick: string, label: string) {
        return button({ label, variant: this.pick === pick ? 'primary' : 'secondary', click: () => this.choose(pick) })
    }

    // every module in the hold shows, compatible or not. the preview says why one does not fit.
    private choose(pick: string) {
        const slot = this.current()!.id
        this.pick = pick
        this.preview = void 0
        void this.run(async () => { this.preview = await this.client.preview(slot, pick === 'remove' ? void 0 : pick) })
    }

    private previewBlock() {
        const p = this.preview
        const { ship } = this.session
        if (!p || !ship || !this.pick) return nothing
        const ok = p.errors.length === 0
        return html`
            <dl>
                <div><dt>capacity</dt><dd>${ ship.capacity } → ${ p.capacity }</dd></div>
                <div><dt>velocity</dt><dd>${ fmtVel(ship.velocity) } → ${ fmtVel(p.velocity) } <small>c</small></dd></div>
                <div><dt>acceleration</dt><dd>${ fmtAccel(ship.acceleration) } → ${ fmtAccel(p.acceleration) } <small>m/s²</small></dd></div>
                <div><dt>power</dt><dd>${ ship.power }/${ ship.power_pool } → ${ p.power }/${ p.power_pool }</dd></div>
                <div><dt>hold</dt><dd class=${ p.load > p.capacity ? 'danger' : '' }>${ p.load } / ${ p.capacity }</dd></div>
            </dl>
            <p class=${ ok ? 'validation' : 'validation error' }>${ ok ? 'preview clean · the command is the final check' : p.errors.join(' · ') }</p>
            ${ button({ label: this.pick === 'remove' ? 'remove module' : 'install module', variant: 'primary', disabled: !ok, icon: this.pick === 'remove' ? 'minus' : 'plus', click: () => this.commit() }) }`
    }

    private commit() {
        const slot = this.current()!.id
        const pick = this.pick
        this.pick = void 0
        this.preview = void 0
        void this.run(() => pick === 'remove' ? this.client.remove(slot) : this.client.install(slot, pick!))
    }

    private rename(current: string) {
        const error = this.name ? nameError(this.name) : ''
        return html`<form class="rename" @submit=${ (e: Event) => { e.preventDefault(); this.submitName() } }>
            <label for="ship-name">ship name<small>${ current }</small></label>
            <input id="ship-name" type="text" maxlength="24" placeholder=${ current } .value=${ this.name } @input=${ (e: Event) => { this.name = (e.target as HTMLInputElement).value } }>
            ${ error ? html`<p class="validation error">${ error }</p>` : nothing }
            ${ button({ label: 'rename', variant: 'secondary', disabled: !this.name || !!error, click: () => this.submitName() }) }
        </form>`
    }

    private submitName() {
        const name = this.name
        if (!name || nameError(name)) return
        this.name = ''
        void this.run(() => this.client.rename(name))
    }
}
customElements.define('rig-screen', RigScreen)
