import type { Universe, Ship, Route, Constants, Station } from '../transport/types.ts'
import { legTime, realMs } from '../session.ts'
import { clamp } from '../util.ts'

/**
 * the chart model, pure. it turns the server's universe into points,
 * edges and markers for the atlas scene, and finds the shortest-time
 * course the way ship-service does. no lit, no three.
 */
export type Point3 = [ number, number, number ]
export type MapMode = 'sector' | 'system'

/** which chart is on screen: the sector, or one system. */
export interface ChartView { mode: MapMode, sysid: string }

export interface ChartNode {
    id      : string
    kind    : 'system' | 'station'
    name    : string
    sub     : string
    position: Point3
    color   : string
    size    : number
}

export interface ChartEdge { a: Point3, b: Point3, kind: 'route' | 'course' | 'preview' }
export interface Marker { id: string, position: Point3, mine: boolean, heading?: Point3 }

/** a ship or a traffic row: whatever moves on the chart. */
export interface Mover {
    status    : 'docked' | 'transit'
    stid?     : string
    from?     : string
    to?       : string
    arrives?  : string
    years_abs?: number
}

/**
 * real positions from the hipparcos-yale-gliese catalogue, in light
 * years. the universe's route lengths are these straight lines.
 */
const STARS: Record<string, Point3> = {
    sol           : [ 0, 0, 0 ],
    'alpha.centauri': [ -1.615, -1.350, -3.772 ],
    'barnards.star' : [ -0.057, -5.925, 0.486 ],
    'wolf.359'      : [ -7.446, 2.118, 0.953 ],
    sirius        : [ -1.612, 8.078, -2.474 ],
}

/** mean orbit radii in au. the domain measures in-system routes between these. */
const ORBITS: Record<string, number> = {
    'sol.mercury' : 0.387,
    'sol.venus'   : 0.723,
    'sol.outpost' : 1.0,
    'sol.mars'    : 1.524,
    'sol.ganymede': 5.203,
    'sol.titan'   : 9.537,
}

// every station of a system sits on one radial line, as the domain says
const LINE = -0.55
const RING = 6

/**
 * chart radius for an orbit. titan at 9.5 au would crush the inner
 * system into one dot, so the chart compresses radii: mercury and titan
 * stay in order, and every label gets room. distances read from the panel.
 */
export function displayRadius(au: number): number {
    return Math.log1p(au * 4)
}

const SPECTRA: [ RegExp, string ][] = [
    [ /^[OB]/, '#9bb7e8' ], [ /^A/, '#c9d6f0' ], [ /^F/, '#f2eedd' ],
    [ /^G/, '#f0d9a0' ], [ /^K/, '#e8b070' ], [ /^M/, '#d97a5a' ],
]

export function starColor(spectrum: string): string {
    return SPECTRA.find(([ re ]) => re.test(spectrum))?.[ 1 ] ?? '#e0d8c0'
}

// ── positions ────────────────────────────────────────────────

export function systemPosition(u: Universe, sysid: string): Point3 {
    const known = STARS[ sysid ]
    if (known) return known
    const i = u.systems.findIndex(s => s.sysid === sysid)
    const a = i * Math.PI * 2 / Math.max(1, u.systems.length)
    return [ RING * Math.cos(a), RING * Math.sin(a), 0 ]
}

export function orbitRadius(u: Universe, stid: string): number {
    const known = ORBITS[ stid ]
    if (known) return known
    const station = u.stations.find(s => s.stid === stid)
    const siblings = u.stations.filter(s => s.system === station?.system)
    return siblings.findIndex(s => s.stid === stid) + 1
}

function orbitPosition(au: number): Point3 {
    const r = displayRadius(au)
    return [ r * Math.cos(LINE), r * Math.sin(LINE), 0 ]
}

/** where a station shows in the given view. undefined when it is out of frame. */
export function place(u: Universe, view: ChartView, stid?: string): Point3 | undefined {
    const station = u.stations.find(s => s.stid === stid)
    if (!station) return
    if (view.mode === 'sector') return systemPosition(u, station.system)
    return station.system === view.sysid ? orbitPosition(orbitRadius(u, stid!)) : void 0
}

export function gatewayOf(u: Universe, sysid: string): Station | undefined {
    const inside = u.stations.filter(s => s.system === sysid)
    const away = new Set(u.stations.filter(s => s.system !== sysid).map(s => s.stid))
    return inside.find(s => u.routes.some(r => r.from === s.stid && away.has(r.to))) ?? inside[ 0 ]
}

// ── nodes and edges ──────────────────────────────────────────

export function sectorNodes(u: Universe): ChartNode[] {
    return u.systems.map(sys => {
        const count = u.stations.filter(s => s.system === sys.sysid).length
        return {
            id      : sys.sysid,
            kind    : 'system',
            name    : sys.name,
            sub     : `${ count } ${ count === 1 ? 'station' : 'stations' } · ${ sys.star }`,
            position: systemPosition(u, sys.sysid),
            color   : starColor(sys.star),
            size    : count > 1 ? 1.4 : 1,
        }
    })
}

export function systemNodes(u: Universe, sysid: string): ChartNode[] {
    const sys = u.systems.find(s => s.sysid === sysid)
    const star: ChartNode = { id: sysid, kind: 'system', name: sys?.name ?? sysid, sub: sys?.star ?? '', position: [ 0, 0, 0 ], color: starColor(sys?.star ?? ''), size: 2.2 }
    const stations = u.stations.filter(s => s.system === sysid).map((s): ChartNode => ({
        id      : s.stid,
        kind    : 'station',
        name    : s.name,
        sub     : trade(s),
        position: orbitPosition(orbitRadius(u, s.stid)),
        color   : '#d9d2b7',
        size    : 1,
    }))
    return [ star, ...stations ]
}

function trade(s: Station): string {
    const out = Object.keys(s.produces).join(', ')
    const need = Object.keys(s.consumes).join(', ')
    return `${ out ? `↑ ${ out }` : '' }${ out && need ? ' · ' : '' }${ need ? `↓ ${ need }` : '' }`
}

/** the routes of the view, each once. a course is drawn on top by `courseEdges`. */
export function routeEdges(u: Universe, view: ChartView): ChartEdge[] {
    const seen = (new Set<string>)
    const edges: ChartEdge[] = []
    for (const r of u.routes) {
        const key = [ r.from, r.to ].sort().join('→')
        if (seen.has(key)) continue
        seen.add(key)
        const a = place(u, view, r.from), b = place(u, view, r.to)
        if (a && b && !same(a, b)) edges.push({ a, b, kind: 'route' })
    }
    return edges
}

export function courseEdges(u: Universe, view: ChartView, stops: string[], kind: 'course' | 'preview'): ChartEdge[] {
    const edges: ChartEdge[] = []
    for (let i = 1; i < stops.length; i++) {
        const a = place(u, view, stops[ i - 1 ]), b = place(u, view, stops[ i ])
        if (a && b && !same(a, b)) edges.push({ a, b, kind })
    }
    return edges
}

/** chart radii of the system's orbits, for the rings. */
export function orbitRings(u: Universe, sysid: string): number[] {
    return u.stations.filter(s => s.system === sysid).map(s => displayRadius(orbitRadius(u, s.stid)))
}

function same(a: Point3, b: Point3) {
    return a[ 0 ] === b[ 0 ] && a[ 1 ] === b[ 1 ] && a[ 2 ] === b[ 2 ]
}

// ── movers ───────────────────────────────────────────────────

/** how far along its leg a ship is, 0 to 1. one game year lasts `time_scale` seconds. */
export function progress(m: Mover, k: Constants, now: number): number {
    if (m.status !== 'transit' || !m.arrives || !m.years_abs) return 0
    const arrives = Date.parse(m.arrives)
    const departs = arrives - realMs(m.years_abs, k)
    return arrives > departs ? clamp((now - departs) / (arrives - departs)) : 1
}

export function moverPoint(u: Universe, view: ChartView, m: Mover, now: number): Point3 | undefined {
    if (m.status === 'docked') return place(u, view, m.stid)
    const a = place(u, view, m.from), b = place(u, view, m.to)
    if (!a || !b) return
    const f = progress(m, u.constants, now)
    return [ a[ 0 ] + (b[ 0 ] - a[ 0 ]) * f, a[ 1 ] + (b[ 1 ] - a[ 1 ]) * f, a[ 2 ] + (b[ 2 ] - a[ 2 ]) * f ]
}

export function heading(u: Universe, view: ChartView, m: Mover): Point3 | undefined {
    if (m.status !== 'transit') return
    const a = place(u, view, m.from), b = place(u, view, m.to)
    if (!a || !b || same(a, b)) return
    return [ b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ], b[ 2 ] - a[ 2 ] ]
}

// ── the course ───────────────────────────────────────────────

export interface Leg { route: Route, years_abs: number, years_rel: number, ms: number }
export interface Plan { stops: string[], legs: Leg[], ly: number, years_abs: number, years_rel: number, ms: number }

/**
 * dijkstra by travel time, the same weights as the server's `path()`.
 * a fast route does not help a slow ship, so the best course depends
 * on the ship. returns undefined when no route connects the stations.
 */
export function shortestPath(u: Universe, ship: Ship, from: string, to: string): Plan | undefined {
    if (from === to) return { stops: [ from ], legs: [], ly: 0, years_abs: 0, years_rel: 0, ms: 0 }
    const dist = new Map<string, number>([[ from, 0 ]])
    const prev = (new Map<string, string>)
    const queue = new Set<string>([ from ])
    while (queue.size) {
        const at = [ ...queue ].reduce((a, b) => dist.get(a)! < dist.get(b)! ? a : b)
        queue.delete(at)
        for (const r of u.routes.filter(r => r.from === at)) {
            const cost = dist.get(at)! + legTime(r, ship, u.constants)
            if (cost < (dist.get(r.to) ?? Infinity)) {
                dist.set(r.to, cost)
                prev.set(r.to, at)
                queue.add(r.to)
            }
        }
    }
    if (!prev.has(to)) return
    const stops = [ to ]
    while (stops[ 0 ] !== from) stops.unshift(prev.get(stops[ 0 ])!)
    return plan(u, ship, stops)
}

function plan(u: Universe, ship: Ship, stops: string[]): Plan {
    const legs = stops.slice(1).map((stop, i): Leg => {
        const route = u.routes.find(r => r.from === stops[ i ] && r.to === stop)!
        const years = legTime(route, ship, u.constants)
        const rel = route.c < 1 ? years : years * Math.sqrt(1 - Math.min(ship.velocity, route.c) ** 2)
        return { route, years_abs: years, years_rel: rel, ms: realMs(years, u.constants) }
    })
    const sum = (f: (l: Leg) => number) => legs.reduce((n, l) => n + f(l), 0)
    return { stops, legs, ly: sum(l => l.route.ly), years_abs: sum(l => l.years_abs), years_rel: sum(l => l.years_rel), ms: sum(l => l.ms) }
}
