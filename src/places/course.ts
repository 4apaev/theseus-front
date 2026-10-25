import { html } from 'lit'
import type { GameClient } from '../core/client.ts'
import { type Plan, shortestPath } from '../core/chart.ts'
import { type Session, goodName, stationName } from '../core/session.ts'
import { Fail, credits, fmtDist, fmtYears, span } from '../core/util.ts'
import { iconOf } from '../content/places.ts'
import type { Kit } from '../kit/index.ts'

/**
 * the course card, the manifest of a trip: the cargo, the stops, the
 * distance, galaxy and ship years, the real time, and what the time
 * costs the cargo. then travel. the place puts the card next to the
 * station.
 */
export class Course {
    private readonly kit: Kit
    private readonly client: GameClient
    private session?: Session

    constructor(kit: Kit, client: GameClient) {
        this.kit    = kit
        this.client = client
    }

    sync(s: Session) {
        this.session = s
    }

    /** the card from the ship's station to `stid`, and its plan. no route, a toast. */
    show(stid: string) {
        const s = this.session, u = s?.universe, ship = s?.ship
        const plan = u && ship?.stid ? shortestPath(u, ship, ship.stid, stid) : void 0
        if (!s || !plan?.legs.length) return void this.kit.toast.say(plan ? 'the ship is there' : 'no route from here', true)
        this.kit.card.show(stationName(s, stid), this.manifest(s, plan, stid), `${ plan.legs.length } ${ plan.legs.length > 1 ? 'hops' : 'hop' }`)
        return plan
    }

    // the cargo's cost is what its value earns in the bank meanwhile
    private manifest(s: Session, plan: Plan, stid: string) {
        const value = s.cargo.reduce((n, c) => n + c.quantity * (s.market.find(m => m.gid === c.gid)?.price_sell ?? 0), 0)
        const cost = value * ((1 + (s.universe?.constants.interest ?? .05)) ** plan.years_abs - 1)
        return html`
            ${ s.cargo.length ? html`<ul>${ s.cargo.map(c => html`<li title=${ goodName(s, c.gid) }><img src=${ iconOf(c.gid, s.universe?.goods[ c.gid ]?.kind) } alt=${ goodName(s, c.gid) }><data value=${ c.quantity }>${ c.quantity }</data></li>`) }</ul>` : '' }
            <dl>
                <dt>via</dt>         <dd>${ plan.stops.slice(1, -1).map(x => stationName(s, x)).join(', ') || 'direct' }</dd>
                <dt>distance</dt>    <dd>${ fmtDist(plan.ly) }</dd>
                <dt>galaxy years</dt><dd>${ fmtYears(plan.years_abs) }</dd>
                <dt>ship years</dt>  <dd>${ fmtYears(plan.years_rel) }</dd>
                <dt>real time</dt>   <dd>${ span(plan.ms) }</dd>
                <dt>cargo cost</dt>  <dd>${ credits(cost) }</dd>
            </dl>
            <form @submit=${ (e: SubmitEvent) => this.travel(e, stid) }><button>travel</button></form>`
    }

    private travel(e: SubmitEvent, stid: string) {
        e.preventDefault()
        this.kit.card.close()
        this.client.travel(stid).catch(x => this.kit.toast.say(Fail.from(x).message, true))
    }
}
