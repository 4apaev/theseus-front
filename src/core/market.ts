import { shortestPath } from './chart.ts'
import { type Session, good } from './session.ts'
import type { Station } from './transport/types.ts'

/** a station on a good's market, and how far it is from here. */
export interface Stop { stid: string, years: number, hops: number }

/**
 * the market round one good: the stations that make it (or stock it, a
 * module), and the stations that want it, the nearest first, 5 of each.
 * a station with no route from here is left out.
 */
export function flowOf(s: Session, gid: string): { makers: Stop[], buyers: Stop[] } {
    const u = s.universe, ship = s.ship, here = ship?.stid, g = good(s, gid)
    if (!u || !ship || !here || !g) return { makers: [], buyers: []}
    const stop = (stid: string) => {
        const plan = shortestPath(u, ship, here, stid)
        return plan && { stid, years: plan.years_abs, hops: plan.legs.length }
    }
    const pick = (fits: (st: Station) => boolean) => u.stations
        .filter(st => st.stid !== here && fits(st))
        .map(st => stop(st.stid))
        .filter((x): x is Stop => !!x)
        .sort((a, b) => a.years - b.years)
        .slice(0, 5)
    return {
        makers: pick(st => (st.produces[ gid ] ?? 0) > 0 || (g.kind === 'module' && !!st.stocks?.includes(gid))),
        buyers: pick(st => (st.consumes[ gid ] ?? 0) > 0),
    }
}
