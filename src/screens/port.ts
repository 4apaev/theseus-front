import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button } from '../components/controls.ts'
import { icon } from '../icons.ts'
import { stationModel, type StationFacility } from '../render/lem-station.ts'
import '../render/lem-scene.ts'
import { stationName, systemName, station, dockedAt, departures, docked, etaMs } from '../session.ts'
import type { Departure } from '../session.ts'
import type { Ship } from '../transport/types.ts'
import { fmtDist, fmtYears, countdown, span } from '../util.ts'

/** the port: who is here, where the routes go, and the one command that moves the ship. */
class PortScreen extends GameScreen {
    static properties = { selected: { state: true }, now: { state: true }, target: { state: true }}
    declare selected: StationFacility
    declare now: number
    declare target?: Departure
    private timer?: ReturnType<typeof setInterval>

    constructor() {
        super()
        this.selected = 'rig'
        this.now = Date.now()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.timer = setInterval(() => { if (this.active) this.now = Date.now() }, 1000)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearInterval(this.timer)
    }

    override render() {
        if (!this.active) return nothing
        const { ship } = this.session
        const here = station(this.session, ship?.stid)
        const model = stationModel(ship?.stid)
        const name = here ? `${ systemName(this.session, here.system) } - ${ here.name }` : void 0
        return html`<div class="operations lem-port">
            <section class="viewport lem-viewport" aria-label="station" data-motion=${ this.motion }>
                <div class="celestial-ether" aria-hidden="true"></div>
                <lem-scene .selected=${ this.selected } .motion=${ this.motion } .model=${ model } .seed=${ ship?.stid ?? 'sol' }
                    @station-select=${ (e: CustomEvent<StationFacility>) => { this.selected = e.detail } }
                    @motion-toggle=${ () => { this.motion = !this.motion } }></lem-scene>
                <header class="scene-title"><span class="tiny-rule" aria-hidden="true"></span><span>${ name ?? 'open space' }<small>${ here ? model.kind : 'between stations' }</small></span></header>
                <aside class="station-drawing"><b>${ name ?? '—' }</b><small>${ here ? model.kind : 'in transit' }</small><span>${ here?.system ?? '' }</span></aside>
            </section>
            <app-panel>${ this.panel() }</app-panel>
            ${ this.confirmDialog() }
        </div>`
    }

    private panel() {
        const { ship } = this.session
        if (!ship) return this.waiting()
        return docked(this.session)
            ? this.dockedPanel(ship)
            : this.transitPanel(ship)
    }

    private waiting() {
        return html`${ this.panelHeader('port authority', 'awaiting commission', 'sync') }
            <p class="panel-intro">your ship is on its way from the yards. this view fills in a moment.</p>`
    }

    private dockedPanel(ship: Ship) {
        const crew = dockedAt(this.session, ship.stid)
        const here = station(this.session, ship.stid)
        const name = here ? `${ systemName(this.session, here.system) } - ${ here.name }` : stationName(this.session, ship.stid)
        return html`${ this.panelHeader(name, ship.name, 'docked') }
            <nav class="facility-list" aria-label="facility directory">${ stationModel(ship.stid).facilities.map((f, i) => html`
                <button class="facility-card" aria-pressed=${ this.selected === f.id } @click=${ () => { this.selected = f.id; this.navigate(f.id) } }>
                    <span class="facility-number">0${ i + 1 }</span><span><b>${ f.name }</b><small>${ f.note }</small></span>
                </button>`) }
            </nav>
            <section aria-label="ships in port">
                <small data-kicker>in port</small>
                ${ crew.length
                    ? html`<ul class="pilot-list">${ crew.map(t => html`<li><b>${ t.handle ?? 'a pilot' }</b><small>${ t.name }</small></li>`) }</ul>`
                    : html`<p class="footnote">no other ships in port</p>` }
            </section>
            <section aria-label="departures">
                <small data-kicker>departures</small>
                <ul class="departures">${ departures(this.session).map(d => this.departure(d)) }</ul>
            </section>`
    }

    private departure(d: Departure) {
        return html`<li>
            <button class="departure" @click=${ () => this.ask(d) }>
                <span><b>${ d.station.name }</b><small>${ d.station.system } · ${ fmtDist(d.route.ly) }</small></span>
                <span class="departure-eta"><b>${ span(d.ms) }</b><small>you age ${ fmtYears(d.years_rel) }yr</small></span>
                ${ icon('arrow') }
            </button>
        </li>`
    }

    private transitPanel(ship: Ship) {
        return html`${ this.panelHeader('in transit', `${ stationName(this.session, ship.from) } → ${ stationName(this.session, ship.to) }`, 'transit') }
            <p class="eta" aria-live="polite"><b>${ countdown(etaMs(ship, this.now)) }</b><small>to arrival</small></p>
            <dl>
                <div><dt>you age</dt><dd>${ fmtYears(ship.years_rel ?? 0) } <small>yr</small></dd></div>
                <div><dt>the galaxy ages</dt><dd>${ fmtYears(ship.years_abs ?? 0) } <small>yr</small></dd></div>
                <div><dt>cruise velocity</dt><dd>${ ship.velocity } <small>c</small></dd></div>
            </dl>
            <div class="notice"><span class="tiny-rule"></span><p><b>the market is offline.</b><br>trading and refits resume at the next dock. the station channel is quiet until then.</p></div>
            ${ button({ label: 'open comms', icon: 'arrow', click: () => this.navigate('comms') }) }`
    }

    // a click commits the ship to a leg. confirm first, no misclicks.
    private async ask(d: Departure) {
        this.target = d
        await this.updateComplete
        this.querySelector('dialog')?.showModal()
    }

    private confirm() {
        const to = this.target?.route.to
        this.querySelector('dialog')?.close()
        if (to) void this.run(() => this.client.travel(to))
    }

    private confirmDialog() {
        const d = this.target
        return html`<dialog class="confirm-dialog" @cancel=${ (e: Event) => { e.preventDefault(); this.querySelector('dialog')?.close() } }>
            ${ d
                ? html`
                <small data-kicker>departure</small>
                <h2>travel to ${ d.station.name }?</h2>
                <dl>
                    <div><dt>distance</dt><dd>${ fmtDist(d.route.ly) }</dd></div>
                    <div><dt>arrival</dt><dd>${ span(d.ms) }</dd></div>
                    <div><dt>you age</dt><dd>${ fmtYears(d.years_rel) } <small>yr</small></dd></div>
                    <div><dt>the galaxy ages</dt><dd>${ fmtYears(d.years_abs) } <small>yr</small></dd></div>
                </dl>
                <div class="auth-actions">
                    ${ button({ label: 'depart', variant: 'primary', icon: 'arrow', click: () => this.confirm() }) }
                    ${ button({ label: 'stay', variant: 'secondary', click: () => this.querySelector('dialog')?.close() }) }
                </div>`
                : nothing }
        </dialog>`
    }
}
customElements.define('port-screen', PortScreen)
