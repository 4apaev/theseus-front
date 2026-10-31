import { progress, shortestPath } from './chart.ts'
import { type Session, realMs } from './session.ts'

/**
 * a trip under way: its stops from the origin to the course's end, how
 * many lie behind the ship, each stop's share of the trip's time, the
 * share flown, and the time to the next stop and to the end. without a
 * course, the trip is the leg.
 */
export interface Trip { stops: string[], passed: number, shares: number[], share: number, toHop: number, toEnd: number }

export function tripOf(s: Session, now: number): Trip | undefined {
    const u = s.universe, ship = s.ship
    if (!u || ship?.status !== 'transit' || !ship.from || !ship.to || !ship.arrives) return
    // a stop off the routes leaves its part of the trip out: just the leg's end
    const path = (a: string, b: string, end: string) => shortestPath(u, ship, a, b) ?? shortestPath(u, ship, end, end)!
    const before = path(s.origin ?? ship.from, ship.from, ship.from), after = path(ship.to, s.course ?? ship.to, ship.to)
    const leg = realMs(ship.years_abs ?? 0, u.constants), ms = [ ...before.legs.map(l => l.ms), leg, ...after.legs.map(l => l.ms) ]
    const total = ms.reduce((n, m) => n + m, 0) || 1, toHop = Math.max(0, Date.parse(ship.arrives) - now)
    return {
        stops : [ ...before.stops, ...after.stops ],
        passed: before.stops.length,
        shares: [ 0, ...ms.map((_, i) => ms.slice(0, i + 1).reduce((n, m) => n + m, 0) / total) ],
        share : (before.ms + progress(ship, u.constants, now) * leg) / total,
        toHop,
        toEnd : toHop + after.ms,
    }
}
