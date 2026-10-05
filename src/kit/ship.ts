import { html } from 'lit'
import type { FittedSlot, TrafficRow } from '../core/transport/types.ts'
import { type Session, cargoLoad, goodName } from '../core/session.ts'
import { fmtVel } from '../core/util.ts'

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
