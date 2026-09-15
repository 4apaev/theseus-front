import { raise } from '../util.ts'

/**
 * idealized planar two-body motion.
 *
 * kilometres, seconds, radians throughout.
 *
 * the server remains authoritative.
 * this module only computes local previews.
 * burns are instantaneous impulses.
 * there is no thrust integration or n-body gravity.
 *//*
    ΔV δv τ tau
    */ const TAU            = 2 * Math.PI
export const MU             = 398600.4418
export const EARTH_RADIUS   = 6371
export const INITIAL_RADIUS = 7200
export const TARGET_RADIUS  = 14500
export const TARGET_PHASE   = 1.5
export const CIRCULAR_SPEED = Math.sqrt(MU / INITIAL_RADIUS)

export interface Vec { x: number, y: number }
export interface Orbit {
    a         : number
    e         : number
    angle     : number
    m0        : number
    period    : number
    periapsis : number
    apoapsis  : number
    deltaV    : number
}

/**
 * derive the post-burn ellipse from position and velocity,
 * never from drawn curves.
 */
export function solveOrbit(prograde: number, radial: number, phase = 0): Orbit {

    if (![ prograde, radial, phase ].every(Number.isFinite))
        raise('burn values must be finite')

    const vt = CIRCULAR_SPEED + prograde
    const v2 = vt * vt + radial * radial
    const energy = v2 / 2 - MU / INITIAL_RADIUS

    if (energy >= 0 || vt <= 0)
        raise('unbound trajectory · reduce the burn')

    const a  = -MU / (2 * energy)
    const ex =  INITIAL_RADIUS * vt * vt / MU - 1
    const ey = -INITIAL_RADIUS * radial * vt / MU
    const e  = Math.hypot(ex, ey)

    if (e >= 1)
        raise('unbound trajectory · reduce the burn')

    const localAngle       = e < 1e-10 ? 0 : Math.atan2(ey, ex)
    const trueAnomaly      = -localAngle
    const eccentricAnomaly = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(trueAnomaly), e + Math.cos(trueAnomaly))

    return {
        a, e,
        angle     : phase + localAngle,
        m0        : eccentricAnomaly - e * Math.sin(eccentricAnomaly),
        period    : TAU * Math.sqrt(a * a * a / MU),
        periapsis : a * (1 - e), apoapsis: a * (1 + e),
        deltaV    : Math.hypot(prograde, radial),
    }
}

export function positionAt(orbit: Orbit, seconds: number): Vec {
    const mean = ((orbit.m0 + seconds * TAU / orbit.period + Math.PI) % TAU + TAU) % TAU - Math.PI
    let eccentric = orbit.e > 0.8
        ? Math.sign(mean || 1) * Math.PI
        : mean

    for (let i = 0; i < 24; i++) {
        const delta = (eccentric - orbit.e * Math.sin(eccentric) - mean) / (1 - orbit.e * Math.cos(eccentric))
        eccentric -= delta
        if (Math.abs(delta) < 1e-12) break
    }
    return rotate({ x: orbit.a * (Math.cos(eccentric) - orbit.e), y: orbit.a * Math.sqrt(1 - orbit.e ** 2) * Math.sin(eccentric) }, orbit.angle)
}

export function velocityAt(orbit: Orbit, seconds: number): Vec {
    const pos       = positionAt(orbit, seconds)
    const local     = rotate(pos, -orbit.angle)

    const sqrt = Math.sqrt(1 - orbit.e ** 2)

    const radius    = Math.hypot(pos.x, pos.y)
    const eccentric = Math.atan2(local.y / (orbit.a * sqrt), local.x / orbit.a + orbit.e)
    const rate      = Math.sqrt(MU / orbit.a) / radius
    return rotate({
        x: -orbit.a *        Math.sin(eccentric) * rate,
        y:  orbit.a * sqrt * Math.cos(eccentric) * rate,
    }, orbit.angle)
}

function rotate(p: Vec, angle: number): Vec {
    return {
        x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
        y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
    }
}

export function targetAt(seconds: number): Vec {
    const angle = TARGET_PHASE + seconds * Math.sqrt(MU / TARGET_RADIUS ** 3)
    return {
        x: TARGET_RADIUS * Math.cos(angle),
        y: TARGET_RADIUS * Math.sin(angle),
    }
}

/**
 * approximate closest approach over
 * one planned revolution, refined locally.
 */
export function closestApproach(orbit: Orbit) {

    const distance = (t: number) => {
        const pos = positionAt(orbit, t)
        const trg = targetAt(t)
        return Math.hypot(
            pos.x - trg.x,
            pos.y - trg.y,
        )
    }

    let time = 0
    let separation = Infinity

    const step = orbit.period / 400

    for (let d, i = 0; i <= 400; i++) {
        d = distance(i * step)
        if (d < separation) {
            separation = d
            time = i * step
        }
    }

    let lo = Math.max(0, time - step)
    let hi = Math.min(orbit.period, time + step)

    for (let i = 0; i < 24; i++) {

        const l = lo + (hi - lo) / 3
        const r = hi - (hi - lo) / 3

        if (distance(l) < distance(r))
            hi = r
        else
            lo = l
    }

    time = (lo + hi) / 2

    const v = velocityAt(orbit, time)
    const trg = targetAt(time)
    const speed = Math.sqrt(MU / TARGET_RADIUS)

    return {
        time,
        separation: distance(time),
        relativeSpeed: Math.hypot(
            v.x + trg.y / TARGET_RADIUS * speed,
            v.y - trg.x / TARGET_RADIUS * speed,
        ),
    }
}

export function brachistochrone(km: number, boost: number) { // ac acceleration
    if (![ km, boost ].every(posNum))
        raise('positive distance and acceleration required')

    const halfTime = Math.sqrt(km * 1000 / boost)
    return {
        seconds: 2 * halfTime,
        peakKmS: boost * halfTime / 1000,
        deltaV: 2 * boost * halfTime / 1000,
    }
}

export function posNum(n: number): boolean { return Number.isFinite(n) && n > 0 }
export function posInt(n: number): boolean { return Number.isSafeInteger(n) && n > 0 }
