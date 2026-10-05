import { html } from 'lit'
import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Plan, routeEdges, shortestPath, starColor, systemPosition } from '../core/chart.ts'
import { type Session, station, stationName } from '../core/session.ts'
import type { Universe } from '../core/transport/types.ts'
import { Fail, credits, fmtDist, fmtYears, span } from '../core/util.ts'
import type { Kit } from '../kit/index.ts'
import type { KitMark } from '../kit/mark.ts'
import { glow } from '../world/paint.ts'
import type { Stage } from '../world/stage.ts'
import type { Place } from './router.ts'

// scene metres per light year: the 10 ly sector spans about 400
const LY = 40

/**
 * the chart: the stars where the catalogue puts them, and the routes
 * between them. a star's label opens its stations; a station opens the
 * course: the hops, light years, galaxy years and ship years, the real
 * time, and what the time costs the cargo. then travel.
 */
export class Chart implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly client: GameClient
    private readonly group = new T.Group
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private session?: Session

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        this.stage  = stage
        this.kit    = kit
        this.client = client
    }

    enter(s: Session) {
        const u = s.universe
        if (!u) return
        this.session = s
        this.stage.sky.show()
        this.draw(u)
        this.stage.scene.add(this.group)
        this.stage.view(...frame(u))
        this.untick = this.stage.tick(() => this.marks.forEach(m => m.el.at = this.stage.anchor(m.at)))
        this.sync(s)
    }

    sync(s: Session) {
        this.session = s
        const here = station(s, s.ship?.stid)?.system
        this.marks.forEach(m => m.el.here = m.el.value === here)
    }

    leave() {
        this.untick?.()
        this.group.removeFromParent()
        this.group.clear()
        this.marks.forEach(m => m.el.remove())
        this.marks = []
        this.kit.card.close()
    }

    // a glowing star and its label per system; a faint line per route
    private draw(u: Universe) {
        for (const sys of u.systems) {
            const at = point(u, sys.sysid)
            const star = glow(parseInt(starColor(sys.star).slice(1), 16), 36)
            star.position.copy(at)
            this.group.add(star)
            const el = this.kit.mark(sys.name, sys.sysid)
            el.addEventListener('pick', () => this.system(sys.sysid))
            this.marks.push({ at, el })
        }
        const lines = routeEdges(u, { mode: 'sector', sysid: '' }).flatMap(e => [ ...e.a, ...e.b ].map(v => v * LY))
        const geometry = (new T.BufferGeometry).setAttribute('position', new T.Float32BufferAttribute(lines, 3))
        this.group.add(new T.LineSegments(geometry, new T.LineBasicMaterial({ color: 0xe8dfcb, transparent: true, opacity: .3 })))
    }

    // a star's card: its stations, each a course to plot
    private system(sysid: string) {
        const s = this.session, u = s?.universe, sys = u?.systems.find(x => x.sysid === sysid)
        if (!s || !u || !sys) return
        this.kit.card.show(sys.name, html`
            <ul>${ u.stations.filter(x => x.system === sysid).map(x => html`
                <li><button @click=${ () => this.course(x.stid) }>${ x.name }</button>${ x.stid === s.ship?.stid ? html` <small>here</small>` : '' }</li>`) }
            </ul>`, sys.star)
        this.place(point(u, sysid))
    }

    // the course card. the cargo's cost is what its value earns in the bank meanwhile
    private course(stid: string) {
        const s = this.session, u = s?.universe, ship = s?.ship
        const plan = u && ship?.stid ? shortestPath(u, ship, ship.stid, stid) : void 0
        if (!s || !plan?.legs.length) return this.kit.toast.say(plan ? 'the ship is there' : 'no route from here', true)
        const value = s.cargo.reduce((n, c) => n + c.quantity * (s.market.find(m => m.gid === c.gid)?.price_sell ?? 0), 0)
        const cost = value * ((1 + (u?.constants.interest ?? .05)) ** plan.years_abs - 1)
        this.kit.card.show(stationName(s, stid), this.plan(s, plan, cost, stid), `${ plan.legs.length } ${ plan.legs.length > 1 ? 'hops' : 'hop' }`)
    }

    private plan(s: Session, plan: Plan, cost: number, stid: string) {
        return html`
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

    private place(at: T.Vector3) {
        void this.kit.card.updateComplete.then(() => this.kit.card.at = this.stage.anchor(at))
    }
}

// the whole sector: its middle, and a size that fits every star in a 30° view
function frame(u: Universe): [ T.Vector3, number ] {
    const points = u.systems.map(x => point(u, x.sysid))
    const middle = points.reduce((m, v) => m.add(v), new T.Vector3).divideScalar(points.length)
    return [ middle, Math.max(...points.map(v => v.distanceTo(middle))) * 1.6 ]
}

function point(u: Universe, sysid: string) {
    return new T.Vector3(...systemPosition(u, sysid)).multiplyScalar(LY)
}
