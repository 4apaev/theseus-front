import { html, nothing } from 'lit'
import { GameScreen } from '../screens/base.ts'
import { icon } from '../icons.ts'
import { button, iconButton, selectField, panelHeader } from '../components/controls.ts'
import { type AtlasScene } from './atlas-scene.ts'
import './atlas-scene.ts'
import {
    sectorNodes, systemNodes, routeEdges, courseEdges, orbitRings,
    moverPoint, heading, progress, shortestPath, gatewayOf,
    type MapMode, type ChartView, type Marker, type ChartEdge, type Plan,
} from './chart.ts'
import { station, stationName, docked, dockedAt, etaMs } from '../session.ts'
import type { Universe, Ship, TrafficRow } from '../transport/types.ts'
import { fmtDist, fmtYears, span, countdown, decimal } from '../util.ts'
import '../components/panel.ts'

/**
 * the navigation atlas: the server's universe as a chart. systems at
 * their real positions, stations on their orbits, every ship in transit,
 * and the shortest course from your ship to any station. depart from here.
 */
class AtlasView extends GameScreen {
    static properties = {
        ...GameScreen.properties,
        mode  : { state: true },
        sysid : { state: true },
        target: { state: true },
        now   : { state: true },
    }

    declare mode: MapMode
    declare sysid: string
    declare target?: string
    declare now: number
    private timer?: ReturnType<typeof setInterval>
    private pinned = false

    constructor() {
        super()
        this.mode = 'sector'
        this.sysid = 'sol'
        this.now = Date.now()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.timer = setInterval(() => { if (this.active && !document.hidden) this.now = Date.now() }, 1000)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearInterval(this.timer)
    }

    // ── model ────────────────────────────────────────────────

    private get universe(): Universe | undefined { return this.session.universe }

    /** the ship's station, or the one it flies to. the course starts here. */
    private get origin(): string | undefined {
        const { ship } = this.session
        return ship?.status === 'docked' ? ship.stid : ship?.to
    }

    /** the system in view follows the ship until the player picks one. */
    private get system(): string {
        if (this.pinned) return this.sysid
        return station(this.session, this.origin)?.system ?? this.sysid
    }

    private get view(): ChartView { return { mode: this.mode, sysid: this.system } }

    private plan(to?: string): Plan | undefined {
        const { ship } = this.session
        const from = this.origin
        return this.universe && ship && from && to ? shortestPath(this.universe, ship, from, to) : void 0
    }

    private markers(u: Universe): Marker[] {
        const { ship, traffic } = this.session
        const movers = [ ...(ship ? [{ id: 'mine', m: ship, mine: true }] : []), ...Object.values(traffic).filter(t => t.status === 'transit').map(t => ({ id: t.sid, m: t, mine: false })) ]
        return movers.flatMap(({ id, m, mine }) => {
            const position = moverPoint(u, this.view, m, this.now)
            return position ? [{ id, position, mine, heading: heading(u, this.view, m) }] : []
        })
    }

    private edges(u: Universe): ChartEdge[] {
        const active = this.plan(this.session.course)
        const preview = this.target && this.target !== this.session.course ? this.plan(this.target) : void 0
        return [
            ...routeEdges(u, this.view),
            ...(preview ? courseEdges(u, this.view, preview.stops, 'preview') : []),
            ...(active ? courseEdges(u, this.view, active.stops, 'course') : []),
        ]
    }

    // ── interaction ──────────────────────────────────────────

    private setMode(mode: MapMode) {
        this.mode = mode
    }

    private pick(id: string) {
        const u = this.universe
        if (!u) return
        if (this.mode === 'system' && id === this.system) return this.setMode('sector')
        const system = u.systems.find(s => s.sysid === id)
        if (system) {
            const inside = u.stations.filter(s => s.system === id)
            if (inside.length > 1) this.focusSystem(id)
            else this.target = gatewayOf(u, id)?.stid
            return
        }
        this.target = id
    }

    private focusSystem(sysid: string) {
        this.sysid = sysid
        this.pinned = true
        this.mode = 'system'
    }

    private depart() {
        const to = this.target
        this.querySelector<HTMLDialogElement>('dialog.confirm-dialog')?.close()
        if (to) void this.run(() => this.client.travel(to))
    }

    private async ask() {
        await this.updateComplete
        this.querySelector<HTMLDialogElement>('dialog.confirm-dialog')?.showModal()
    }

    private openCrew() {
        this.querySelector<HTMLDialogElement>('dialog.crew-dialog')?.showModal()
    }

    private messageCrew(t: TrafficRow) {
        this.querySelector<HTMLDialogElement>('dialog.crew-dialog')?.close()
        this.navigate('comms', t.sid)
    }

    // ── render ───────────────────────────────────────────────

    override render() {
        if (!this.active) return nothing
        const u = this.universe
        if (!u) return html`<app-panel class="atlas-inspector">${ panelHeader('navigation atlas', 'chart loading', 'sync') }<p class="panel-intro">the universe arrives with the session.</p></app-panel>`
        const sector = this.mode === 'sector'
        const sys = u.systems.find(s => s.sysid === this.system)
        const here = this.origin
        return html`
        <div class="atlas-toolbar">
            <div class="segmented atlas-tabs" aria-label="map scale">
                <button class=${ sector ? 'active' : '' } @click=${ () => this.setMode('sector') }>interstellar</button>
                <button class=${ !sector ? 'active' : '' } @click=${ () => this.setMode('system') }>in system</button>
            </div>
            <div class="atlas-breadcrumb">
                <button @click=${ () => this.setMode('sector') }>known space</button>
                <span>/</span>
                <button @click=${ () => this.setMode('system') }>${ sys?.name ?? this.system }</button>
                ${ !sector ? html`<span>/</span>${ selectField({ id: 'atlas-system', label: '', value: this.system, options: u.systems.map(s => ({ value: s.sysid, label: s.name })), change: value => this.focusSystem(value) }) }` : nothing }
            </div>
        </div>
        <div class="atlas-layout">
            <section class="atlas-map-column" aria-label=${ sector ? 'interstellar chart' : 'system chart' }>
                <div class="atlas-map-surface">
                    <header class="atlas-map-heading">
                        <small data-kicker>${ sector ? '01 / stellar cartography' : `02 / ${ sys?.name ?? this.system }` }</small>
                        <h2>${ sector ? 'between the stars' : 'within the well' }</h2>
                        <p>${ sector ? 'catalogue positions · light-years' : `${ sys?.star ?? '' } · mean orbit radii · au` }</p>
                    </header>
                    <atlas-scene
                        .mode=${ this.mode }
                        .nodes=${ sector ? sectorNodes(u) : systemNodes(u, this.system) }
                        .edges=${ this.edges(u) }
                        .rings=${ sector ? [] : orbitRings(u, this.system) }
                        .markers=${ this.markers(u) }
                        .selected=${ sector ? station(this.session, this.target)?.system ?? this.target : this.target }
                        .here=${ sector ? station(this.session, here)?.system : here }
                        @node-select=${ (e: CustomEvent<string>) => this.pick(e.detail) }
                    ></atlas-scene>
                    <div class="atlas-map-caption">
                        <span>drag to orbit · scroll to zoom · click a label to choose</span>
                        ${ this.cameraTools() }
                    </div>
                </div>
                <div class="atlas-legend">
                    <span><span data-shape aria-hidden="true" class="amber"></span>course</span>
                    <span><span data-shape aria-hidden="true" class="cyan"></span>routes</span>
                    <span><span data-shape aria-hidden="true" class="mint"></span>ships in transit</span>
                </div>
            </section>
            <app-panel class="atlas-inspector">${ this.target ? this.targetPanel(u, this.target) : this.overview(u) }</app-panel>
        </div>
        ${ this.confirmDialog() }
        ${ this.crewDialog() }`
    }

    private cameraTools() {
        const scene = () => this.querySelector<AtlasScene>('atlas-scene')
        return html`<div class="atlas-camera">${ ([ 'x', 'y', 'z' ] as const).map(axis => html`
            <button data-variant="icon" aria-label=${ `reset map ${ axis } rotation` } title=${ `reset ${ axis } rotation to initial view` } @click=${ () => scene()?.resetAxis(axis) }>${ axis }</button>`) }
            ${ iconButton('minus', 'zoom map out', () => scene()?.adjustZoom(-0.15)) }
            ${ iconButton('plus', 'zoom map in', () => scene()?.adjustZoom(0.15)) }
            <button data-variant="icon" class="atlas-reset" aria-label="reset map camera" title="restore initial map view" @click=${ () => scene()?.resetCamera() }>${ icon('reset') }<span>reset</span></button>
        </div>`
    }

    private destinationField(u: Universe) {
        const options = [{ value: '', label: 'choose a station' }, ...u.stations.map(s => ({ value: s.stid, label: `${ u.systems.find(x => x.sysid === s.system)?.name ?? s.system } / ${ s.name }` })) ]
        return selectField({ id: 'atlas-destination', label: 'destination', value: this.target ?? '', options, change: value => { this.target = value || void 0 } })
    }

    // ── panels ───────────────────────────────────────────────

    private overview(u: Universe) {
        const { ship } = this.session
        const transit = Object.values(this.session.traffic).filter(t => t.status === 'transit')
        return html`${ panelHeader('navigation atlas', ship ? ship.name : 'no ship', ship?.status ?? 'sync') }
            ${ ship ? this.shipStatus(ship) : nothing }
            ${ this.destinationField(u) }
            <section aria-label="ships in transit">
                <small data-kicker>in transit · ${ transit.length }</small>
                ${ transit.length
                    ? html`<ul class="atlas-transit">${ transit.slice(0, 12).map(t => html`<li><b>${ t.handle ?? 'a pilot' }</b><small>${ stationName(this.session, t.from) } → ${ stationName(this.session, t.to) } · ${ Math.round(progress(t, u.constants, this.now) * 100) }%</small></li>`) }</ul>`
                    : html`<p class="footnote">every ship is docked</p>` }
            </section>
            <p class="atlas-assumption">a course is the shortest travel time for your drive, hop by hop. the server flies it and times each leg.</p>`
    }

    private shipStatus(ship: Ship) {
        if (docked(this.session))
            return html`<dl class="atlas-readouts"><div><dt>docked at</dt><dd>${ stationName(this.session, ship.stid) }</dd></div><div><dt>cruise</dt><dd>${ ship.velocity } <small>c</small></dd></div><div><dt>acceleration</dt><dd>${ ship.acceleration } <small>m/s²</small></dd></div></dl>`
        const f = this.universe ? progress(ship, this.universe.constants, this.now) : 0
        return html`<div class="atlas-route"><span>${ stationName(this.session, ship.from) }</span><span data-shape aria-hidden="true"></span>${ icon('arrow') }<span>${ stationName(this.session, ship.to) }</span></div>
            <div class="atlas-clock-pair"><div><small>arrival</small><b>${ countdown(etaMs(ship, this.now)) }</b></div><div><small>leg</small><b>${ Math.round(f * 100) }<small>%</small></b></div></div>
            <div class="meter"><span data-shape aria-hidden="true" style=${ `width:${ f * 100 }%` }></span></div>
            ${ this.session.course && this.session.course !== ship.to ? html`<p class="footnote">course continues to ${ stationName(this.session, this.session.course) }</p>` : nothing }`
    }

    private targetPanel(u: Universe, stid: string) {
        const target = station(this.session, stid)
        if (!target) { this.target = void 0; return nothing }
        const sys = u.systems.find(s => s.sysid === target.system)
        const crew = dockedAt(this.session, stid)
        const here = this.origin === stid
        const plan = here ? void 0 : this.plan(stid)
        return html`${ panelHeader(sys?.name ?? target.system, target.name, here ? 'here' : 'destination') }
            ${ this.destinationField(u) }
            <dl class="atlas-readouts">
                <div><dt>produces</dt><dd>${ Object.entries(target.produces).map(([ g, n ]) => `${ g } ${ n }`).join(', ') || '—' }</dd></div>
                <div><dt>consumes</dt><dd>${ Object.entries(target.consumes).map(([ g, n ]) => `${ g } ${ n }`).join(', ') || '—' }</dd></div>
                ${ target.stocks?.length ? html`<div><dt>module stock</dt><dd>${ target.stocks.join(', ') }</dd></div>` : nothing }
            </dl>
            ${ crew.length
                ? button({ label: `captains in port · ${ crew.length }`, variant: 'secondary', click: () => this.openCrew() })
                : html`<p class="footnote">no other ships in port</p>` }
            ${ plan ? this.coursePanel(plan) : nothing }
            ${ this.departControl(stid, plan) }
            ${ target.system !== this.system || this.mode === 'sector' ? html`<button class="atlas-link" @click=${ () => this.focusSystem(target.system) }>view ${ sys?.name ?? target.system } system ${ icon('arrow') }</button>` : nothing }`
    }

    /** in transit, the course starts at the leg's end. the lead is what is left of the leg. */
    private coursePanel(plan: Plan) {
        const { ship } = this.session
        const lead = ship && !docked(this.session) ? Math.max(0, etaMs(ship, this.now)) : 0
        return html`<div class="atlas-route"><span>${ stationName(this.session, plan.stops[ 0 ]) }</span><span data-shape aria-hidden="true"></span>${ icon('arrow') }<span>${ stationName(this.session, plan.stops.at(-1)) }</span></div>
            <ol class="atlas-stops">${ plan.legs.map(l => html`<li><b>${ stationName(this.session, l.route.to) }</b><small>${ fmtDist(l.route.ly) } · ${ span(l.ms) }</small></li>`) }</ol>
            <div class="atlas-clock-pair"><div><small>arrival in</small><b>${ span(lead + plan.ms) }</b></div><div><small>${ lead ? 'after this leg, ' : '' }${ plan.legs.length === 1 ? 'one leg' : `${ plan.legs.length } legs` }</small><b>${ fmtDist(plan.ly) }</b></div></div>
            <dl class="atlas-readouts"><div><dt>you age</dt><dd>${ fmtYears(plan.years_rel) } <small>yr</small></dd></div><div><dt>the galaxy ages</dt><dd>${ fmtYears(plan.years_abs) } <small>yr</small></dd></div><div><dt>time saved</dt><dd>${ decimal(plan.years_abs - plan.years_rel, 1) } <small>yr</small></dd></div></dl>`
    }

    private departControl(stid: string, plan?: Plan) {
        const { ship } = this.session
        const here = this.origin === stid
        const reason = !ship ? 'no ship to fly' : here ? 'you are here' : !docked(this.session) ? 'in transit · plot the next course after arrival' : !plan ? 'no route to this station' : ''
        return html`<p class="validation">${ reason || `course plotted · ${ plan!.legs.length } ${ plan!.legs.length === 1 ? 'leg' : 'legs' }` }</p>
            ${ button({ label: 'depart', class: 'atlas-launch', variant: 'primary', icon: 'arrow', disabled: !!reason, click: () => void this.ask() }) }`
    }

    private confirmDialog() {
        const plan = this.target ? this.plan(this.target) : void 0
        return html`<dialog class="confirm-dialog" @cancel=${ (e: Event) => { e.preventDefault(); this.querySelector<HTMLDialogElement>('dialog.confirm-dialog')?.close() } }>
            ${ plan
                ? html`
                <small data-kicker>departure</small>
                <h2>travel to ${ stationName(this.session, plan.stops.at(-1)) }?</h2>
                <dl>
                    <div><dt>course</dt><dd>${ plan.stops.map(s => stationName(this.session, s)).join(' → ') }</dd></div>
                    <div><dt>arrival</dt><dd>${ span(plan.ms) }</dd></div>
                    <div><dt>you age</dt><dd>${ fmtYears(plan.years_rel) } <small>yr</small></dd></div>
                    <div><dt>the galaxy ages</dt><dd>${ fmtYears(plan.years_abs) } <small>yr</small></dd></div>
                </dl>
                <div class="auth-actions">
                    ${ button({ label: 'depart', variant: 'primary', icon: 'arrow', click: () => this.depart() }) }
                    ${ button({ label: 'stay', variant: 'secondary', click: () => this.querySelector<HTMLDialogElement>('dialog.confirm-dialog')?.close() }) }
                </div>`
                : nothing }
        </dialog>`
    }

    /** whoever the target station's crew shows, one click each. picking a pilot opens comms with them. */
    private crewDialog() {
        const stid = this.target
        const crew = stid ? dockedAt(this.session, stid) : []
        return html`<dialog class="crew-dialog" @cancel=${ (e: Event) => { e.preventDefault(); this.querySelector<HTMLDialogElement>('dialog.crew-dialog')?.close() } }>
            ${ stid
                ? html`
                <small data-kicker>in port</small>
                <h2>captains at ${ stationName(this.session, stid) }</h2>
                ${ crew.length
                    ? html`<ul class="crew-list">${ crew.map(t => this.crewRow(t)) }</ul>`
                    : html`<p class="footnote">no other ships in port</p>` }
                <div class="auth-actions">${ button({ label: 'close', variant: 'secondary', click: () => this.querySelector<HTMLDialogElement>('dialog.crew-dialog')?.close() }) }</div>`
                : nothing }
        </dialog>`
    }

    private crewRow(t: TrafficRow) {
        const name = t.handle ?? 'a pilot'
        return html`<li><button class="crew-row" @click=${ () => this.messageCrew(t) }>
            <span class="contact-avatar civil">${ name.slice(0, 1) }</span>
            <span><b>${ name }</b><small>${ t.name }</small></span>
            ${ icon('comms') }
        </button></li>`
    }
}
customElements.define('atlas-view', AtlasView)
