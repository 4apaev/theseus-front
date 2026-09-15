import { AppElement } from '../components/element.ts'
import {
    html,
    svg,
    nothing,
    type PropertyValues,
} from 'lit'

import { icon } from '../icons.ts'
import {
    STARS,
    PLANETS,
    starById,
    coastPlan,
    systemPlan,
    freshJourney,
    advanceJourney,
    boundedProgress,
    DEMO_SECONDS,
    MAP_DELTA_V,
    YEAR,
    DAY,

    type MapMode,
    type PlanetId,
    type Journey,
} from './navigation.ts'

// import './atlas-scene.ts'
import { type AtlasScene } from './atlas-scene.ts'

import { decimal as format, emit } from '../util.ts'
import {
    button,
    iconButton,
    rangeField,
    selectField,
    panelHeader,
} from '../components/controls.ts'

import '../components/panel.ts'

class AtlasView extends AppElement {
    static properties = {
        active : { type: Boolean },
        mode   : { state: true },
        star   : { state: true },
        planet : { state: true },
        beta   : { state: true },
        journey: { state: true },
        speed  : { state: true },
    }

    declare journey: Journey
    declare active : boolean
    declare mode   : MapMode
    declare star   : string
    declare planet : PlanetId
    declare beta   : number
    declare speed  : number
    private timer? : ReturnType<typeof setInterval>
    private lastTick = 0

    constructor() {
        super()
        this.active  = false
        this.beta    = 0.6
        this.speed   = 1
        this.mode    = 'sector'
        this.star    = 'cersa'
        this.planet  = 'mars'
        this.journey = freshJourney()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.lastTick = performance.now()
        this.timer = setInterval(this.tick, 40)
        document.addEventListener('visibilitychange', this.visibility)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearInterval(this.timer)
        document.removeEventListener('visibilitychange', this.visibility)
    }

    override updated(changes: PropertyValues) {
        if (changes.has('active') && !this.active && this.journey.running)
            this.journey = { ...this.journey, running: false }
    }

    private visibility = () => {
        if (document.hidden && this.journey.running)
            this.journey = { ...this.journey, running: false }
    }

    private tick = () => {
        const now = performance.now()
        const elapsed = Math.min((now - this.lastTick) / 1000, 0.5)
        this.lastTick = now

        if (!this.active || !this.journey.running || document.hidden) return

        this.journey = advanceJourney(this.journey, elapsed, this.speed)

        if (this.journey.progress === 1) {
            this.dispatchEvent(new CustomEvent('travel-example-complete', {
                detail: this.mode === 'sector'
                    ? `sol → ${ this.star }`
                    : `earth → ${ this.planet }`,
                bubbles: true,
                composed: true,
            }))
        }
    }

    private setMode(mode: MapMode) {
        this.mode = mode
        this.journey = freshJourney()
    }

    private localFocus() {
        emit(this, 'local-orbit-focus', undefined)
    }

    private select(id: string) {
        if (this.mode === 'sector' && id === 'sol')    return this.setMode('system')
        if (this.mode === 'system' && id === 'earth')  return this.localFocus()
        if (this.mode === 'sector')                           this.star = id
        else                                                  this.planet = id as PlanetId
        this.journey = freshJourney()
    }

    private get routeError() {
        if (this.mode === 'sector') {
            return starById(this.star).surveyed
                ? ''
                : 'unsurveyed contact · no travel solution'
        }
        return systemPlan(this.planet).deltaV > MAP_DELTA_V
            ? 'transfer exceeds the demo’s 7.80 km/s budget'
            : ''
    }

    private play() {
        if (this.routeError) return

        this.journey = {
            progress: this.journey.progress === 1 ? 0 : this.journey.progress,
            running: !this.journey.running,
        }
        this.lastTick = performance.now()
    }

    private get stateLabel() {
        if (this.journey.progress === 1) return 'arrived / preview'
        if (this.journey.running)        return 'in transit / preview'

        return this.journey.progress > 0
            ? 'paused / preview'
            : 'departure / preview'
    }

    private get routeSeconds() {
        return this.mode === 'system'
            ? systemPlan(this.planet).seconds
            : starById(this.star).surveyed
                ? coastPlan(this.star, this.beta).seconds
                : 0
    }

    override render() {
        if (!this.active) return nothing
        const sector = this.mode === 'sector'
        return html`
        <div class="atlas-toolbar">

            <div class="segmented atlas-tabs" aria-label="map scale">
                <button class=${  sector ? 'active' : '' } @click=${ () => this.setMode('sector') }>interstellar</button>
                <button class=${ !sector ? 'active' : '' } @click=${ () => this.setMode('system') }>in system</button>
            </div>

            <div class="atlas-breadcrumb">
                <button @click=${ () => this.setMode('sector') }>local sector</button>
                <span>/</span>
                <button @click=${ () => this.setMode('system') }>sol</button>${ sector
                    ? nothing
                    : html`<span>/</span><button @click=${ this.localFocus }>earth orbit ↗</button>`
                }</div>
            </div>

            <div class="atlas-layout">

                <section class="atlas-map-column" aria-label=${ sector ? 'interstellar navigation' : 'in-system navigation' }>
                    <div class="atlas-map-surface">

                        <header class="atlas-map-heading">
                            <small data-kicker>${ sector ? '01 / stellar cartography' : '02 / heliocentric frame' }</small>
                            <h2>${ sector ? 'between the stars' : 'within the well' }</h2>
                            <p>${ sector ? 'projected stellar positions · light-years' : 'circular coplanar orbits · astronomical units' }</p>
                        </header>

                        <atlas-scene
                            .mode=${ this.mode }
                            .star=${ this.star }
                            .planet=${ this.planet }
                            .progress=${ this.journey.progress }
                            @destination-select=${ (e: CustomEvent<string>) => this.select(e.detail) }
                        ></atlas-scene>

                        <div class="atlas-map-caption">

                            <span>${ sector ? 'fictional sector · drag to orbit · scroll to zoom' : 'orbital scale · symbolic bodies · drag to orbit · scroll to zoom' }</span>

                            <div class="atlas-camera">${ ([ 'x', 'y', 'z' ] as const).map(axis => html`

                                <button
                                    data-variant="icon"
                                    aria-label=${ `reset map ${ axis } rotation` }
                                    title=${ `reset ${ axis } rotation to initial view` }
                                    @click=${ () => this.querySelector<AtlasScene>('atlas-scene')?.resetAxis(axis) }
                                >${ axis }</button>`) }${

                                iconButton('minus', 'zoom map out', () => this.querySelector<AtlasScene>('atlas-scene')?.adjustZoom(-0.15)) }${
                                iconButton('plus' , 'zoom map in' , () => this.querySelector<AtlasScene>('atlas-scene')?.adjustZoom(0.15))  }

                                <button
                                    data-variant="icon"
                                    class="atlas-reset"
                                    aria-label="reset map camera"
                                    title="restore initial map view"
                                    @click=${ () => this.querySelector<AtlasScene>('atlas-scene')?.resetCamera() }
                                >${ icon('reset') }
                                    <span>reset</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="atlas-legend">
                        <span><span data-shape aria-hidden="true" class="amber"></span>${ sector ? 'selected course'       : 'transfer orbit'         }</span>
                        <span><span data-shape aria-hidden="true" class="cyan"></span>${  sector ? 'surveyed systems'      : 'earth orbit'            }</span>
                        <span><span data-shape aria-hidden="true" class="mint"></span>${  sector ? 'port / supply signals' : 'destination at arrival' }</span>
                    </div>
                    ${ this.timeline() }
                </section>
            <app-panel class="atlas-inspector">${ sector
                ? this.sectorInspector()
                : this.systemInspector() }
            </app-panel>
        </div>`
    }

    private sectorInspector() {
        const target = starById(this.star)
        const plan = target.surveyed ? coastPlan(this.star, this.beta) : undefined
        return html`${ panelHeader('selected system', target.id, target.surveyed ? 'surveyed' : 'unknown') }
            ${ selectField({ id: 'star-destination', label: 'destination', value: this.star, options: STARS.filter(s => s.id !== 'sol').map(s => ({ value: s.id, label: s.id + (s.surveyed ? '' : ' / unsurveyed') })), change: value => this.select(value) }) }
            <div class="atlas-station-mini" aria-hidden="true"><span data-shape aria-hidden="true"></span><span data-shape aria-hidden="true"></span><span data-shape aria-hidden="true"></span><span></span></div>
            <dl class="atlas-readouts"><div><dt>distance from sol</dt><dd>${ format(Math.hypot(...target.position)) } ly</dd></div><div><dt>known ports</dt><dd>${ target.surveyed ? target.ports : '—' }</dd></div><div><dt>exports ↑</dt><dd>${ target.exports }</dd></div><div><dt>demand ↓</dt><dd>${ target.demand }</dd></div><div><dt>depth / z</dt><dd>${ target.position[ 2 ] >= 0 ? '+' : '' }${ format(target.position[ 2 ], 1) } ly</dd></div></dl>
            ${ rangeField({ id: 'cruise-speed', label: 'cruise speed', value: this.beta, min: 0.2, max: 0.8, step: 0.05, unit: 'c', change: value => { this.beta = value; this.journey = freshJourney() } }) }
            <div class="atlas-clock-pair"><div><small>system-frame time</small><b>${ plan ? format(plan.years) : '—' } <small>yr</small></b></div><div><small>aboard the ship</small><b>${ plan ? format(plan.shipYears) : '—' } <small>yr</small></b></div></div>
            ${ this.launchControl() }
            <p class="atlas-assumption">constant-speed coast only. acceleration, braking and fuel costs are omitted; ship time includes time dilation.</p>
            <button class="atlas-link" @click=${ () => this.setMode('system') }>view sol system ${ icon('arrow') }</button>`
    }

    private systemInspector() {
        const plan = systemPlan(this.planet)
        const target = PLANETS.find(p => p.id === this.planet)!
        return html`${ panelHeader('target / ' + target.id, 'a place to arrive', 'sol') }
            ${ selectField({ id: 'planet-destination', label: 'destination port', value: this.planet, options: PLANETS.filter(p => p.id !== 'earth').map(p => ({ value: p.id, label: `${ p.port } / ${ p.id }` })), change: value => this.select(value) }) }
            <dl class="atlas-readouts"><div><dt>departure</dt><dd>earth / sol outpost</dd></div><div><dt>target orbit</dt><dd>${ format(target.radius, 3) } au</dd></div><div><dt>transfer time</dt><dd>${ format(plan.seconds / DAY, 1) } days</dd></div><div><dt>departure burn</dt><dd>${ format(plan.departureBurn) } km/s</dd></div><div><dt>arrival burn</dt><dd>${ format(plan.arrivalBurn) } km/s</dd></div></dl>
            <div class="delta-budget"><div><span>total maneuver δv</span><b>${ format(plan.deltaV) } <small>/ 7.80 km/s</small></b></div><div class="meter"><span data-shape aria-hidden="true" class=${ this.routeError ? 'over' : '' } style=${ `width:${ Math.min(100, plan.deltaV / MAP_DELTA_V * 100) }%` }></span></div></div>
            ${ this.launchControl() }
            <p class="atlas-assumption">aligned launch window · heliocentric two-impulse transfer. planetary escape and capture are excluded.</p>
            ${ this.localInset() }`
    }

    private launchControl() {
        const sector = this.mode === 'sector'
        return html`<div class="atlas-route"><span>${ sector ? 'sol' : 'earth' }</span><span data-shape aria-hidden="true"></span>${ icon('arrow') }<span>${ sector ? this.star : this.planet }</span></div>
            <p class=${ this.routeError ? 'validation error' : 'validation' }>${ this.routeError || this.stateLabel }</p>
            ${ button({ label: this.journey.running ? 'pause travel example' : this.journey.progress === 1 ? 'replay travel example' : this.journey.progress > 0 ? 'resume travel example' : 'run travel example', class: 'atlas-launch', variant: 'primary', disabled: !!this.routeError, click: () => this.play(), icon: this.journey.running ? 'pause' : 'play' }) }
            <small class="footnote">${ DEMO_SECONDS }s playback at 1× · local simulation</small>`
    }

    private timeline() {
        const sector = this.mode === 'sector'
        const elapsed = this.routeSeconds * this.journey.progress
        const unit = sector ? YEAR : DAY
        const suffix = sector ? 'yr' : 'days'
        return html`<div class="atlas-timeline"><div class="atlas-time-heading"><span class="atlas-status"><span data-shape aria-hidden="true" class=${ this.journey.running ? 'running' : '' }></span>${ this.stateLabel }</span><b data-testid="map-elapsed">t + ${ format(elapsed / unit, sector ? 2 : 1) } ${ suffix }</b></div>
            <div class="atlas-time-controls"><button class="atlas-play-inline" ?disabled=${ !!this.routeError } @click=${ this.play } aria-label=${ this.journey.running ? 'pause map playback' : 'play map travel example' }>${ icon(this.journey.running ? 'pause' : 'play') }</button><button data-variant="icon" aria-label="restart travel example" @click=${ () => { this.journey = freshJourney() } }>${ icon('reset') }</button><div class="atlas-scrubber"><label class="sr-only" for="map-progress">travel progress</label><input id="map-progress" type="range" min="0" max="1" step="0.001" .value=${ String(this.journey.progress) } ?disabled=${ !!this.routeError } @input=${ (e: Event) => { this.journey = { progress: boundedProgress(Number((e.target as HTMLInputElement).value)), running: false } } }><div><span>departure</span><span>${ sector ? 'constant-speed coast' : 'keplerian coast' }</span><span>arrival</span></div></div><label class="sr-only" for="map-speed">playback speed</label><select id="map-speed" .value=${ String(this.speed) } @change=${ (e: Event) => { this.speed = Number((e.target as HTMLSelectElement).value) } }><option value="0.5">0.5×</option><option value="1">1×</option><option value="4">4×</option></select></div>
            <div class="atlas-travel-note" role="status">${ this.journey.progress === 1 ? `arrival preview complete · ${ sector ? this.star : PLANETS.find(p => p.id === this.planet)!.port }` : 'scrub the route or run the example. leaving maps pauses playback.' }<small>your trading vessel remains docked · cargo and credits are unchanged</small></div></div>`
    }

    private localInset() {
        return html`<section class="atlas-local-inset"><div><small data-kicker>earth / local frame</small><button class="atlas-link" @click=${ this.localFocus }>focus orbit ↗</button></div>${ svg`<svg viewBox="0 0 300 170" role="img" aria-label="schematic earth orbit and sol outpost; open focus orbit for the calculated local planner"><ellipse cx="142" cy="84" rx="112" ry="67" fill="none" stroke="var(--line)" stroke-dasharray="3 5"/><ellipse cx="142" cy="84" rx="76" ry="48" fill="none" stroke="var(--cyan)"/><path d="M142 50 172 65 176 99 144 120 113 103 108 69Z" fill="#658d9c"/><path d="M142 50 144 120 113 103 108 69Z" fill="#a0c8c7"/><path d="M142 50 172 65 176 99 144 120 155 82Z" fill="#425c78"/><rect x="209" y="65" width="8" height="8" fill="#d9d0bd" transform="rotate(45 213 69)"/><path d="m76 106 10 7-12 3Z" fill="var(--amber)"/><text x="188" y="49">sol outpost</text><text x="126" y="146">earth</text></svg>` }<small>local distances use their own scale</small></section>`
    }
}
customElements.define('atlas-view', AtlasView)
