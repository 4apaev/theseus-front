import { html, svg, nothing, type PropertyValues } from 'lit'
import { GameScreen } from './base.ts'
import { icon } from '../icons.ts'
import { solveOrbit, closestApproach, brachistochrone, EARTH_RADIUS } from '../simulation/orbit.ts'
import { rangeField, selectField } from '../components/controls.ts'
import { stationName } from '../session.ts'
import { number, duration } from '../util.ts'
import '../render/orbit-view.ts'

type FlightMode = 'orbital' | 'brachistochrone'
type Burn = 'prograde' | 'radial' | 'phase'

// the preview's fixed maneuver budget, km/s. the server has no counterpart yet.
const BUDGET = 7.8
const DISTANCES = [ 64800, 129600, 259200 ]

/**
 * a local preview of maneuver planning. nothing here reaches the
 * server: the ship stays docked and the burns are a study.
 */
class FlightScreen extends GameScreen {
    static properties = {
        ...GameScreen.properties,
        flightMode : { state: true },
        prograde   : { state: true },
        radial     : { state: true },
        phase      : { state: true },
        previewTime: { state: true },
        playing    : { state: true },
        distance   : { state: true },
    }

    declare flightMode: FlightMode
    declare prograde: number
    declare radial: number
    declare phase: number
    declare previewTime: number
    declare playing: boolean
    declare distance: number
    private timer?: ReturnType<typeof setInterval>

    constructor() {
        super()
        this.flightMode  = 'orbital'
        this.prograde    = 1.05
        this.radial      = 0
        this.phase       = Math.PI
        this.previewTime = 0
        this.playing     = false
        this.distance    = 129600
    }

    override connectedCallback() {
        super.connectedCallback()
        this.timer = setInterval(() => {
            if (this.active && this.playing) this.previewTime = (this.previewTime + 0.008) % 1
        }, 250)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearInterval(this.timer)
    }

    override updated(changes: PropertyValues) {
        if (changes.has('active') && !this.active) this.playing = false
    }

    // the fitted maneuver drive sets acceleration. the starter hull flies at 0.002 m/s².
    private thrust() {
        return this.session.ship?.acceleration ?? 0.002
    }

    private setMode(mode: FlightMode) {
        this.flightMode = mode
        this.playing = false
    }

    private savePlan(description: string) {
        this.notify(`plan noted · ${ description } · a preview, the vessel stays docked`)
    }

    // ── render ───────────────────────────────────────────────

    override render() {
        if (!this.active) return nothing
        return html`<div class="operations">
            <section class="viewport" aria-label="flight preview">${ this.workspace() }</section>
            <app-panel>${ this.flightMode === 'orbital' ? this.orbitalPanel() : this.brachPanel() }</app-panel>
        </div>`
    }

    private workspace() {
        const orbital = this.flightMode === 'orbital'
        return html`<div class="flight-workspace">
            <div class="flight-tabs segmented">
                <button class=${ orbital ? 'active' : '' } @click=${ () => this.setMode('orbital') }>orbital maneuver</button>
                <button class=${ orbital ? '' : 'active' } @click=${ () => this.setMode('brachistochrone') }>brachistochrone</button>
            </div>
            ${ orbital ? this.orbitalView() : this.brachChart() }
        </div>`
    }

    private orbitalView() {
        return html`
            <orbit-view .prograde=${ this.prograde } .radial=${ this.radial } .phase=${ this.phase } .time=${ this.previewTime }
                @phase-change=${ (e: CustomEvent<number>) => { this.phase = e.detail; this.previewTime = 0 } }></orbit-view>
            <div class="timeline">
                <button data-variant="icon" aria-label=${ this.playing ? 'pause trajectory preview' : 'play trajectory preview' } @click=${ () => { this.playing = !this.playing } }>${ icon(this.playing ? 'pause' : 'play') }</button>
                <div>
                    <label for="preview-time">trajectory preview <span>${ Math.round(this.previewTime * 100) }% of one revolution</span></label>
                    <input id="preview-time" type="range" min="0" max="1" step="0.001" .value=${ String(this.previewTime) }
                        @input=${ (e: Event) => { this.previewTime = Number((e.target as HTMLInputElement).value); this.playing = false } }>
                </div>
            </div>`
    }

    private brachChart() {
        const b = brachistochrone(this.distance, this.thrust())
        const here = stationName(this.session, this.session.ship?.stid)
        return html`<div class="brach-chart">
            <div class="brach-route">
                <div>${ icon('port') }<b>${ here }</b><small>0 km</small></div>
                <span class="burn-line"></span>
                <div class="flip">${ icon('orbit') }<b>180° flip</b><small>${ number(this.distance / 2) } km</small></div>
                <span class="burn-line brake"></span>
                <div>${ icon('port') }<b>destination</b><small>${ number(this.distance) } km</small></div>
            </div>
            <div class="chart-label">velocity <span>km/s</span></div>
            ${ svg`<svg class="velocity-chart" viewBox="0 0 650 190" role="img" aria-label="velocity rises linearly to midpoint then falls to zero">
                <path d="M40 20V155H625" fill="none" stroke="var(--line)"/>
                <path d="M332 20V155" stroke="var(--line)" stroke-dasharray="3 5"/>
                <path d="M40 155 332 30" fill="none" stroke="var(--amber)" stroke-width="2"/>
                <path d="M332 30 625 155" fill="none" stroke="var(--cyan)" stroke-width="2"/>
                <text x="40" y="180">0 h</text>
                <text x="295" y="180">${ number(b.seconds / 7200, 1) } h</text>
                <text x="577" y="180">${ number(b.seconds / 3600, 1) } h</text>
                <text x="345" y="30">${ number(b.peakKmS, 2) }</text>
            </svg>` }
            <div class="burn-legend">
                <span><span data-shape aria-hidden="true"></span>accelerate / ${ number(b.deltaV / 2, 2) } km/s</span>
                <span class="brake"><span data-shape aria-hidden="true"></span>brake / ${ number(b.deltaV / 2, 2) } km/s</span>
            </div>
            <div class="idealization"><b>constant thrust. midpoint flip.</b><p>an idealized rest-to-rest transfer. gravity, orbital velocity, and changing mass are omitted here.</p></div>
        </div>`
    }

    // ── panels ───────────────────────────────────────────────

    private brachPanel() {
        const b = brachistochrone(this.distance, this.thrust())
        const over = b.deltaV > BUDGET
        return html`${ this.panelHeader('local transfer', 'burn profile', 'preview') }
            ${ selectField({ id: 'distance', label: 'transfer distance / km', value: String(this.distance), options: DISTANCES.map(value => ({ value: String(value), label: `${ number(value) } km` })), change: value => { this.distance = Number(value) } }) }
            <dl>
                <div><dt>acceleration</dt><dd>${ this.thrust() } m/s²</dd></div>
                <div><dt>flight time</dt><dd>${ duration(b.seconds) }</dd></div>
                <div><dt>peak velocity</dt><dd>${ number(b.peakKmS, 2) } km/s</dd></div>
                <div class="total"><dt>total burn δv</dt><dd>${ number(b.deltaV, 2) } km/s</dd></div>
            </dl>
            ${ this.budget(b.deltaV, 'available δv', over ? 'insufficient δv for acceleration and braking' : `${ number(BUDGET - b.deltaV, 2) } km/s remaining after transfer`) }
            <button data-variant="primary" ?disabled=${ over } @click=${ () => this.savePlan(`brachistochrone · ${ number(b.deltaV, 2) } km/s`) }>save transfer plan ${ icon('check') }</button>
            <small class="footnote">preview only · fitted drive sets acceleration</small>`
    }

    private orbitalPanel() {
        let orbit
        try { orbit = solveOrbit(this.prograde, this.radial, this.phase) }
        catch { /* the error line below explains; the burn controls stay usable */ }
        const approach = orbit ? closestApproach(orbit) : void 0
        const dv       = Math.hypot(this.prograde, this.radial)
        const error    = !orbit
            ? 'unbound trajectory · reduce the burn'
            : orbit.periapsis <= EARTH_RADIUS
                ? 'trajectory intersects earth · raise periapsis'
                : dv > BUDGET ? 'insufficient available δv' : ''
        const degrees = ((this.phase * 180 / Math.PI) % 360 + 360) % 360

        return html`${ this.panelHeader('maneuver node / 01', 'shape your orbit', 'earth') }
            ${ this.burnControl('prograde', 'prograde / retrograde', this.prograde, [ -1.2, 3.2 ]) }
            ${ this.burnControl('radial', 'radial out / in', this.radial, [ -0.8, 0.8 ]) }
            ${ this.burnControl('phase', 'node position', degrees, [ 0, 360 ]) }
            <div class="orbit-stats">
                <div><small>periapsis altitude</small><b class=${ orbit && orbit.periapsis <= EARTH_RADIUS ? 'danger' : '' }>${ orbit ? number(orbit.periapsis - EARTH_RADIUS) : '—' } <small>km</small></b></div>
                <div><small>apoapsis altitude</small><b>${ orbit ? number(orbit.apoapsis - EARTH_RADIUS) : '—' } <small>km</small></b></div>
                <div><small>closest approach</small><b>${ approach ? number(approach.separation) : '—' } <small>km</small></b></div>
                <div><small>relative velocity</small><b>${ approach ? number(approach.relativeSpeed, 2) : '—' } <small>km/s</small></b></div>
            </div>
            ${ this.budget(dv, 'maneuver δv', 'single impulse · capture burn not included') }
            <p class=${ error ? 'validation error' : 'validation' }>${ error || 'bound trajectory · drag the node to reposition' }</p>
            <button data-variant="primary" ?disabled=${ !!error } @click=${ () => this.savePlan(`orbital maneuver · ${ number(dv, 2) } km/s`) }>save maneuver ${ icon('check') }</button>
            <small class="footnote">two-body, planar preview · distances are to scale<br>closest approach is sampled over one revolution</small>`
    }

    private budget(dv: number, label: string, note: string) {
        return html`<div class="delta-budget">
            <div><span>${ label }</span><b>${ number(dv, 2) } <small>/ ${ number(BUDGET, 2) } km/s</small></b></div>
            <div class="meter"><span data-shape aria-hidden="true" class=${ dv > BUDGET ? 'over' : '' } style=${ `width:${ Math.min(100, dv / BUDGET * 100) }%` }></span></div>
            <small>${ note }</small>
        </div>`
    }

    private burnControl(id: Burn, label: string, value: number, [ min, max ]: [ number, number ]) {
        const phase = id === 'phase'
        return rangeField({
            id, label, value, min, max,
            unit  : phase ? '°' : 'km/s',
            step  : phase ? 1 : 0.01,
            signed: !phase,
            change: v => { this[ id ] = phase ? v * Math.PI / 180 : v; this.previewTime = 0 },
        })
    }
}
customElements.define('flight-screen', FlightScreen)
