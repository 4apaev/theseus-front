import { html, svg, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { icon } from '../icons.ts'
import type { PropertyValues } from 'lit'
import { thrustOf } from '../model.ts'
import { solveOrbit, closestApproach, brachistochrone, EARTH_RADIUS } from '../simulation/orbit.ts'
import { number, duration } from '../util.ts'
import { rangeField, selectField } from '../components/controls.ts'

class FlightScreen extends GameScreen {
    static properties = { flightMode: { state: true }, prograde: { state: true }, radial: { state: true }, phase: { state: true }, previewTime: { state: true }, playing: { state: true }, distance: { state: true }}
    declare flightMode: 'orbital' | 'brachistochrone'
    declare prograde: number
    declare radial: number
    declare phase: number
    declare previewTime: number
    declare playing: boolean
    declare distance: number
    private timer?: ReturnType<typeof setInterval>

    constructor() {
        super()
        this.flightMode = 'orbital'
        this.prograde = 1.05
        this.radial = 0
        this.phase = Math.PI
        this.previewTime = 0
        this.playing = false
        this.distance = 129600
    }

    override connectedCallback() { super.connectedCallback(); this.timer = setInterval(() => { if (this.active && this.playing) this.previewTime = (this.previewTime + 0.008) % 1 }, 250) }
    override disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.timer) }
    override updated(changes: PropertyValues) { if (changes.has('active') && !this.active) this.playing = false }
    override render() {
        if (!this.active) return nothing
        return html`<div class="operations"><section class="viewport" aria-label="flight preview">${ this.renderFlight() }</section><app-panel>${ this.flightPanel() }</app-panel></div>`
    }

    private renderFlight() {
        return html`<div class="flight-workspace"><div class="flight-tabs segmented"><button class=${ this.flightMode === 'orbital' ? 'active' : '' } @click=${ () => { this.flightMode = 'orbital' } }>orbital maneuver</button><button class=${ this.flightMode === 'brachistochrone' ? 'active' : '' } @click=${ () => { this.flightMode = 'brachistochrone'; this.playing = false } }>brachistochrone</button></div>${ this.flightMode === 'orbital'
            ? html`
                <orbit-view .prograde=${ this.prograde } .radial=${ this.radial } .phase=${ this.phase } .time=${ this.previewTime } @phase-change=${ (e: CustomEvent<number>) => { this.phase = e.detail; this.previewTime = 0 } }></orbit-view>
                <div class="timeline"><button data-variant="icon" aria-label=${ this.playing ? 'pause trajectory preview' : 'play trajectory preview' } @click=${ () => { this.playing = !this.playing } }>${ icon(this.playing ? 'pause' : 'play') }</button><div><label for="preview-time">trajectory preview <span>${ Math.round(this.previewTime * 100) }% of one revolution</span></label><input id="preview-time" type="range" min="0" max="1" step="0.001" .value=${ String(this.previewTime) } @input=${ (e: Event) => { this.previewTime = Number((e.target as HTMLInputElement).value); this.playing = false } }></div></div>
            `
            : this.brachChart() }</div>`
    }

    private brachChart() {
        const b = brachistochrone(this.distance, thrustOf(this.game))
        return html`<div class="brach-chart"><div class="brach-route"><div>${ icon('port') }<b>lem station</b><small>0 km</small></div><span class="burn-line"></span><div class="flip">${ icon('orbit') }<b>180° flip</b><small>${ number(this.distance / 2) } km</small></div><span class="burn-line brake"></span><div>${ icon('port') }<b>cersa depot</b><small>${ number(this.distance) } km</small></div></div><div class="chart-label">velocity <span>km/s</span></div>${ svg`<svg class="velocity-chart" viewBox="0 0 650 190" role="img" aria-label="velocity rises linearly to midpoint then falls to zero"><path d="M40 20V155H625" fill="none" stroke="var(--line)"/><path d="M332 20V155" stroke="var(--line)" stroke-dasharray="3 5"/><path d="M40 155 332 30" fill="none" stroke="var(--amber)" stroke-width="2"/><path d="M332 30 625 155" fill="none" stroke="var(--cyan)" stroke-width="2"/><text x="40" y="180">0 h</text><text x="295" y="180">${ number(b.seconds / 7200, 1) } h</text><text x="577" y="180">${ number(b.seconds / 3600, 1) } h</text><text x="345" y="30">${ number(b.peakKmS, 2) }</text></svg>` }<div class="burn-legend"><span><span data-shape aria-hidden="true"></span>accelerate / ${ number(b.deltaV / 2, 2) } km/s</span><span class="brake"><span data-shape aria-hidden="true"></span>brake / ${ number(b.deltaV / 2, 2) } km/s</span></div><div class="idealization"><b>constant thrust. midpoint flip.</b><p>an idealized rest-to-rest transfer. gravity, orbital velocity, and changing mass are omitted here.</p></div></div>`
    }

    private flightPanel() {
        if (this.flightMode === 'brachistochrone') {
            const b = brachistochrone(this.distance, thrustOf(this.game))
            return html`${ this.panelHeader('local transfer', 'burn profile', 'preview') }${ selectField({ id: 'distance', label: 'transfer distance / km', value: String(this.distance), options: [ 64800, 129600, 259200 ].map(value => ({ value: String(value), label: `${ number(value) } km` })), change: value => { this.distance = Number(value) } }) }<dl><div><dt>acceleration</dt><dd>${ thrustOf(this.game) } m/s²</dd></div><div><dt>flight time</dt><dd>${ duration(b.seconds) }</dd></div><div><dt>peak velocity</dt><dd>${ number(b.peakKmS, 2) } km/s</dd></div><div class="total"><dt>total burn δv</dt><dd>${ number(b.deltaV, 2) } km/s</dd></div></dl><div class="delta-budget"><div><span>available δv</span><b>7.80 km/s</b></div><div class="meter"><span data-shape aria-hidden="true" style=${ `width:${ Math.min(100, b.deltaV / 7.8 * 100) }%` } class=${ b.deltaV > 7.8 ? 'over' : '' }></span></div><small>${ b.deltaV > 7.8 ? 'insufficient δv for acceleration and braking' : `${ number(7.8 - b.deltaV, 2) } km/s remaining after transfer` }</small></div><button data-variant="primary" ?disabled=${ b.deltaV > 7.8 } @click=${ () => this.savePlan(`brachistochrone · ${ number(b.deltaV, 2) } km/s`) }>save transfer plan ${ icon('check') }</button><small class="footnote">preview only · fitted drive sets acceleration</small>`
        }
        let orbit
        try { orbit = solveOrbit(this.prograde, this.radial, this.phase) }
        catch { /* surfaced below; keep the burn controls usable */ }
        const approach = orbit ? closestApproach(orbit) : undefined
        const error = !orbit ? 'unbound trajectory · reduce the burn' : orbit.periapsis <= EARTH_RADIUS ? 'trajectory intersects earth · raise periapsis' : orbit.deltaV > 7.8 ? 'insufficient available δv' : ''
        return html`${ this.panelHeader('maneuver node / 01', 'shape your orbit', 'earth') }
            ${ this.burnControl('prograde', 'prograde / retrograde', this.prograde, { min: -1.2, max: 3.2, unit: 'km/s' }) }${ this.burnControl('radial', 'radial out / in', this.radial, { min: -0.8, max: 0.8, unit: 'km/s' }) }${ this.burnControl('phase', 'node position', ((this.phase * 180 / Math.PI) % 360 + 360) % 360, { min: 0, max: 360, unit: '°' }) }
            <div class="orbit-stats"><div><small>periapsis altitude</small><b class=${ orbit && orbit.periapsis <= EARTH_RADIUS ? 'danger' : '' }>${ orbit ? number(orbit.periapsis - EARTH_RADIUS) : '—' } <small>km</small></b></div><div><small>apoapsis altitude</small><b>${ orbit ? number(orbit.apoapsis - EARTH_RADIUS) : '—' } <small>km</small></b></div><div><small>closest approach</small><b>${ approach ? number(approach.separation) : '—' } <small>km</small></b></div><div><small>relative velocity</small><b>${ approach ? number(approach.relativeSpeed, 2) : '—' } <small>km/s</small></b></div></div>
            <div class="delta-budget"><div><span>maneuver δv</span><b>${ number(Math.hypot(this.prograde, this.radial), 2) } <small>/ 7.80 km/s</small></b></div><div class="meter"><span data-shape aria-hidden="true" style=${ `width:${ Math.hypot(this.prograde, this.radial) / 7.8 * 100 }%` }></span></div><small>single impulse · capture burn not included</small></div>
            <p class=${ error ? 'validation error' : 'validation' }>${ error || 'bound trajectory · drag the node to reposition' }</p><button data-variant="primary" ?disabled=${ !!error } @click=${ () => this.savePlan(`orbital maneuver · ${ number(Math.hypot(this.prograde, this.radial), 2) } km/s`) }>save maneuver ${ icon('check') }</button><small class="footnote">two-body, planar preview · distances are to scale<br>closest approach is sampled over one revolution</small>`
    }

    private burnControl(id: 'prograde' | 'radial' | 'phase', label: string, value: number, range: { min: number, max: number, unit: string }) {
        return rangeField({ id, label, value, ...range, signed: id !== 'phase', step: id === 'phase' ? 1 : 0.01, change: value => { this[ id ] = id === 'phase' ? value * Math.PI / 180 : value; this.previewTime = 0 } })
    }

    private savePlan(description: string) {
        this.commit({ ...this.game, log: [ `plan saved · ${ description }`, ...this.game.log ].slice(0, 30) }, 'plan saved locally · vessel remains docked')
    }

}
customElements.define('flight-screen', FlightScreen)
