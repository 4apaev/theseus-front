import * as T from 'three'
import { displayRadius, orbitRadius, systemPosition } from '../core/chart.ts'
import type { Universe } from '../core/transport/types.ts'
import { seedOf } from '../content/fleet.ts'

// scene metres per light year in the sector, and per chart radius in a system
export const LY = 40
const ORB = 60

// the golden angle: stations in orbit order spread round the star, none on top of another
const GOLDEN = 137.5 * Math.PI / 180

/** the whole sector: its middle, and a size that fits every star in a 30° view. */
export function frame(u: Universe): [ T.Vector3, number ] {
    const points = u.systems.map(x => point(u, x.sysid))
    const middle = points.reduce((m, v) => m.add(v), new T.Vector3).divideScalar(points.length)
    return [ middle, Math.max(...points.map(v => v.distanceTo(middle))) * 1.6 ]
}

/** a system in the sector, in scene metres. */
export function point(u: Universe, sysid: string) {
    return new T.Vector3(...systemPosition(u, sysid)).multiplyScalar(LY)
}

/** a station on its orbit, in scene metres: in orbit order round the star, none on top of another. */
export function onOrbit(u: Universe, stid: string) {
    const sysid = u.stations.find(x => x.stid === stid)?.system ?? '', i = u.stations.filter(x => x.system === sysid).findIndex(x => x.stid === stid)
    const r = displayRadius(orbitRadius(u, stid)) * ORB, a = i * GOLDEN + seedOf(sysid) % 360 * Math.PI / 180
    return new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
}
