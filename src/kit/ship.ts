import { html } from 'lit'
import type { FittedSlot, Preview, TrafficRow } from '../core/transport/types.ts'
import { progress } from '../core/chart.ts'
import { type Session, cargoLoad, goodName, stationName } from '../core/session.ts'
import { fmtVel, fmtYears, span } from '../core/util.ts'

/** our ship: the hull, the hold, the drive, the rig. */
export function shipRows(s: Session) {
    const ship = s.ship
    return ship && html`
        <dl>
            <dt>hull</dt>  <dd>${ ship.hull }</dd>
            <dt>hold</dt>  <dd>${ cargoLoad(s) } / ${ ship.capacity }</dd>
            <dt>speed</dt> <dd>${ fmtVel(ship.velocity) } c</dd>
            <dt>thrust</dt><dd>${ ship.acceleration } m/s²</dd>
            <dt>power</dt> <dd>${ ship.power } / ${ ship.power_pool }</dd>
        </dl>
        ${ rig(s, s.fitted) }`
}

/** another ship: a player's from the traffic, or an npc hull. */
export function visitorRows(s: Session, hull: string, fitted: FittedSlot[], row?: TrafficRow) {
    return html`
        <dl>
            <dt>pilot</dt><dd>${ row?.handle ?? 'npc' }</dd>
            <dt>hull</dt> <dd>${ hull.replace(/^.*\//, '').replace(/-/g, ' ') }</dd>
        </dl>
        ${ rig(s, fitted) }`
}

function rig(s: Session, fitted: FittedSlot[]) {
    return fitted.length ? html`<ul>${ fitted.map(f => html`<li><b>${ f.slot }</b> ${ goodName(s, f.gid) }</li>`) }</ul>` : ''
}

/** our ship underway: the leg, the speed, the years, the time left. at zero it waits for the arrival. */
export function voyageRows(s: Session, now: number) {
    const ship = s.ship, k = s.universe?.constants
    if (!ship?.arrives || !k) return html``
    const route = s.universe?.routes.find(r => r.from === ship.from && r.to === ship.to)
    const c = Math.min(ship.velocity, route?.c ?? 1), left = Date.parse(ship.arrives) - now
    return html`
        <dl>
            <dt>from</dt>        <dd>${ stationName(s, ship.from) }</dd>
            <dt>to</dt>          <dd>${ stationName(s, ship.to) }</dd>
            ${ s.course && s.course !== ship.to ? html`<dt>course</dt><dd>${ stationName(s, s.course) }</dd>` : '' }
            <dt>speed</dt>       <dd>${ fmtVel(c) } c · ${ Math.round(c * 299792.458).toLocaleString() } km/s</dd>
            <dt>galaxy years</dt><dd>${ fmtYears(ship.years_abs ?? 0) }</dd>
            <dt>ship years</dt>  <dd>${ fmtYears(ship.years_rel ?? ship.years_abs ?? 0) }</dd>
            <dt>arrives in</dt>  <dd>${ left > 0 ? span(left) : 'docking…' }</dd>
        </dl>
        <progress value=${ progress(ship, k, now) } max="1"></progress>`
}

/** a fit, before and after: the stats the server computed, and why it would fail. */
export function previewRows(s: Session, p: Preview) {
    const ship = s.ship
    if (!ship) return html``
    const row = (name: string, a: number, b: number, f = (n: number) => String(n)) => html`
        <dt>${ name }</dt><dd ?data-up=${ b > a } ?data-down=${ b < a }>${ f(a) }${ a === b ? '' : html` → ${ f(b) }` }</dd>`
    return html`
        <dl>
            ${ row('hold', ship.capacity, p.capacity) }
            ${ row('speed', ship.velocity, p.velocity, fmtVel) }
            ${ row('thrust', ship.acceleration, p.acceleration) }
            ${ row('power', ship.power_pool, p.power_pool) }
        </dl>
        ${ p.errors.map(e => html`<p data-error>${ e }</p>`) }`
}
