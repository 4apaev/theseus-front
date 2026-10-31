import { html, svg } from 'lit'
import { AppElement } from '../components/element.ts'
import type { Trip } from '../core/trip.ts'
import { clock } from '../core/util.ts'

type Pt = [ number, number ]

/**
 * a trip under way, over the sky: a dashed path from the start, through
 * the stops passed, under our ship, to the next stop and on to the end.
 * the place sets `at`, the ship's screen point. a bar at the bottom
 * runs from the trip's first system to its last: the share flown, the
 * time to the end, a dot for each stop between, and under it `facts`:
 * the leg's speed and ship years. `calm` stops the dashes.
 */
export class KitTrip extends AppElement {
    static properties = { trip: { attribute: false }, ends: { attribute: false }, facts: {}, at: { attribute: false }, calm: { type: Boolean, reflect: true }}
    declare trip?: Trip
    declare ends?: [ string, string ]
    declare facts?: string
    declare at?: Pt
    declare calm: boolean

    override render() {
        const t = this.trip, w = this.clientWidth, h = this.clientHeight
        if (!t || !w) return html``
        const ship = this.at ?? [ w / 2, h / 2 ], u = Math.min(w / 1920, h / 1200), at = spots(t, w, h)
        const path = [ ...at.slice(0, t.passed), ship, ...at.slice(t.passed) ]
        return html`
            <svg viewBox="0 0 ${ w } ${ h }">
                <mask id="trip-ship"><rect width=${ w } height=${ h } fill="#fff"/><ellipse cx=${ ship[ 0 ] } cy=${ ship[ 1 ] } rx=${ w * .1 } ry=${ h * .13 }/></mask>
                <path d=${ smooth(path) } mask="url(#trip-ship)" style="stroke-width: ${ 9 * u }; stroke-dasharray: ${ 18 * u } ${ 22 * u }"/>
                ${ at.map((p, i) => this.stop(t, i, p, u)) }
            </svg>
            <footer>
                <header><span>${ this.ends?.[ 0 ] }</span><span>${ this.ends?.[ 1 ] }</span></header>
                <div style="--at: ${ t.share }">
                    <b></b><b></b>
                    <time>${ clock(t.toEnd) }</time>
                    ${ t.shares.slice(1, -1).map((x, i) => html`<s style="--at: ${ x }" ?data-passed=${ i + 1 < t.passed }></s>`) }
                </div>
                <p>${ this.facts }</p>
            </footer>`
    }

    // a stop by its part in the trip: the start, the stops passed, the next, the end, and the stops between
    private stop(t: Trip, i: number, [ x, y ]: Pt, u: number) {
        const last = t.stops.length - 1, label = (text: string, dx: number, dy: number, anchor = 'middle') =>
            svg`<text x=${ x + dx * u } y=${ y + dy * u } text-anchor=${ anchor } style="font-size: ${ Math.max(11, 22 * u) }px">${ text }</text>`
        if (!i) return svg`<ellipse data-start cx=${ x } cy=${ y } rx=${ 34 * u } ry=${ 26 * u }/>${ label('start', -48, -10, 'end') }`
        if (i === last) return svg`<circle data-halo data-end cx=${ x } cy=${ y } r=${ 112 * u }/><circle data-end cx=${ x } cy=${ y } r=${ 74 * u }/>${ label(`${ clock(t.toEnd) } time to target`, 60, -60, 'start') }`
        if (i < t.passed) return svg`<polygon data-passed points=${ star(x, y, 58 * u, 34 * u) }/>${ i === t.passed - 1 ? label('completed', -60, -70, 'end') : '' }`
        if (i === t.passed) return svg`<circle data-halo data-next cx=${ x } cy=${ y } r=${ 56 * u }/><circle data-next cx=${ x } cy=${ y } r=${ 38 * u }/>${ label(`${ clock(t.toHop) } time to next hop`, -50, -50, 'end') }`
        return svg`<circle data-next cx=${ x } cy=${ y } r=${ 18 * u }/>`
    }
}
customElements.define('kit-trip', KitTrip)

/*
    the stops on screen, in a w by h frame: the start low at the left,
    the stops passed up from it, the next stop high right of the ship,
    the end beyond it. the stops between share the room evenly.
*/
function spots(t: Trip, w: number, h: number): Pt[] {
    const ahead = t.stops.length - t.passed, lerp = (a: Pt, b: Pt, k: number): Pt => [ a[ 0 ] + (b[ 0 ] - a[ 0 ]) * k, a[ 1 ] + (b[ 1 ] - a[ 1 ]) * k ]
    const [ start, passed, next, end ]: Pt[] = [[ .14 * w, .81 * h ], [ .19 * w, .6 * h ], [ .65 * w, .3 * h ], [ .78 * w, .19 * h ]]
    return t.stops.map((_, i) => i < t.passed
        ? lerp(start, passed, t.passed > 1 ? i / (t.passed - 1) : 0)
        : lerp(next, end, ahead > 1 ? (i - t.passed) / (ahead - 1) : 1))
}

// a smooth line through the points: catmull-rom, as cubic béziers
function smooth(p: Pt[]) {
    return p.map((b, i) => {
        if (!i) return `M${ b }`
        const a = p[ i - 1 ], z = p[ i - 2 ] ?? a, c = p[ i + 1 ] ?? b
        return `C${ [ a[ 0 ] + (b[ 0 ] - z[ 0 ]) / 6, a[ 1 ] + (b[ 1 ] - z[ 1 ]) / 6 ] } ${ [ b[ 0 ] - (c[ 0 ] - a[ 0 ]) / 6, b[ 1 ] - (c[ 1 ] - a[ 1 ]) / 6 ] } ${ b }`
    }).join(' ')
}

// a fat 7 point star round x, y: the mark of a stop passed
function star(x: number, y: number, r: number, q: number) {
    return Array.from({ length: 14 }, (_, i) => {
        const a = i * Math.PI / 7 - Math.PI / 2, k = i % 2 ? q : r
        return `${ x + Math.cos(a) * k },${ y + Math.sin(a) * k }`
    }).join(' ')
}
