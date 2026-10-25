/**
 * a body on its orbit round a planet, in the orbit's plane: the conic
 * that its position and velocity make. the client's toy for maneuvers,
 * not the server's flight: two dimensions, one planet, no moon's pull.
 */

export type Vec = [ number, number ]

/** a conic: semi-latus rectum `p`, eccentricity `e`, the longitude of periapsis `w`, semi-major axis `a` (below 0 for a hyperbola). */
export interface Conic { p: number, e: number, w: number, a: number }

/** the conic of a body at `r` with velocity `v`, round a planet of gravity `mu`. */
export function conic([ rx, ry ]: Vec, [ vx, vy ]: Vec, mu: number): Conic {
    const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, h = rx * vy - ry * vx, rv = rx * vx + ry * vy
    const ex = ((v2 - mu / r) * rx - rv * vx) / mu, ey = ((v2 - mu / r) * ry - rv * vy) / mu
    return { p: h * h / mu, e: Math.hypot(ex, ey), w: Math.atan2(ey, ex), a: 1 / (2 / r - v2 / mu) }
}

/** the distance from the planet at longitude `t`; Infinity where a hyperbola never goes. */
export function radius(c: Conic, t: number) {
    const d = 1 + c.e * Math.cos(t - c.w)
    return d > 1e-6 ? c.p / d : Infinity
}

export const periapsis = (c: Conic) => c.p / (1 + c.e)

/** Infinity when the body escapes. */
export const apoapsis = (c: Conic) => c.e < 1 ? c.p / (1 - c.e) : Infinity

/** Infinity when the body escapes. */
export const period = (c: Conic, mu: number) => c.e < 1 ? 2 * Math.PI * Math.sqrt(c.a ** 3 / mu) : Infinity

/** the state on a circular orbit of radius `r` at longitude `t`, counterclockwise. */
export function circular(r: number, t: number, mu: number): [ Vec, Vec ] {
    const v = Math.sqrt(mu / r)
    return [[ r * Math.cos(t), r * Math.sin(t) ], [ -v * Math.sin(t), v * Math.cos(t) ]]
}
