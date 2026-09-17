import { assert, raise, clamp } from '../util.ts'

import { positionAt } from '../simulation/orbit.ts'
import type { Orbit } from '../simulation/orbit.ts'

export type MapMode = 'sector' | 'system'
export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars'
export type Point3 = [ number, number, number ]

export interface Star {
    id: string
    position: Point3
    color: string
    ports: number
    exports: string
    demand: string
    surveyed: boolean
}

// fictional neighborhood; distances are derived from these light-year coordinates.
export const STARS: Star[] = [
    { id: 'sol'    , position: [ 0, 0, 0 ]         , color: '#eee2ca', ports: 7, exports: 'iron ore'     , demand: 'grain'        , surveyed: true },
    { id: 'cersa'  , position: [ 3.2, 2.4, 1.5 ]   , color: '#e4bc75', ports: 3, exports: 'machine parts', demand: 'grain'        , surveyed: true },
    { id: 'nacre'  , position: [ -2.3, 2.4, 0.7 ]  , color: '#91c8c5', ports: 2, exports: 'water ice'    , demand: 'machine parts', surveyed: true },
    { id: 'vesper' , position: [ 0.3, 5.4, 1.8 ]   , color: '#b8cdd9', ports: 1, exports: 'volatiles'    , demand: 'iron ore'     , surveyed: true },
    { id: 'aster'  , position: [ -4.9, 3.6, 0.4 ]  , color: '#ddd1ec', ports: 2, exports: 'grain'        , demand: 'propellant'   , surveyed: true },
    { id: 'erebus' , position: [ -3.6, -0.8, 0.3 ] , color: '#bba7ca', ports: 1, exports: 'iron ore'     , demand: 'machine parts', surveyed: true },
    { id: 'talos'  , position: [ -4.7, -4.2, -0.4 ], color: '#b7c7cc', ports: 1, exports: 'alloys'       , demand: 'grain'        , surveyed: true },
    { id: 'nyx'    , position: [ -0.8, -4.9, -0.6 ], color: '#bec6da', ports: 1, exports: 'rare earths'  , demand: 'water ice'    , surveyed: true },
    { id: 'thal'   , position: [ 3.6, -3.6, -0.5 ] , color: '#9fbfcb', ports: 2, exports: 'grain'        , demand: 'iron ore'     , surveyed: true },
    { id: 'orionis', position: [ 5.1, -0.6, 0.7 ]  , color: '#d9d2bc', ports: 1, exports: 'propellant'   , demand: 'alloys'       , surveyed: true },
    { id: 'phi-1'  , position: [ 5.8, 4.4, -0.4 ]  , color: '#8e849f', ports: 0, exports: 'unknown'      , demand: 'unknown'      , surveyed: false },
]

export const AU = 149597870.7
export const SUN_MU = 132712440041.27942
export const DAY = 86400
export const YEAR = DAY * 365.25
export const DEPARTURE_ANGLE = -Math.PI / 2
export const DEMO_SECONDS = 24
export const MAP_DELTA_V = 7.8

export const PLANETS: { id: PlanetId, radius: number, phase: number, color: string, size: number, port: string }[] = [
    { id: 'mercury', radius: 0.387, phase: 2.7            , color: '#b8b0c1', size: 0.028, port: 'caloris relay' },
    { id: 'venus'  , radius: 0.723, phase: 0.7            , color: '#d5c18a', size: 0.045, port: 'ishtar aerostat' },
    { id: 'earth'  , radius: 1    , phase: DEPARTURE_ANGLE, color: '#8abec1', size: 0.051, port: 'lem station' },
    { id: 'mars'   , radius: 1.524, phase: 0              , color: '#c67e68', size: 0.042, port: 'mars hub' },
]

export function starById(id: string): Star {
    const star = STARS.find(s => s.id === id)
    assert(star, 'unknown star system', 'navigation')
    return star
}

export function coastPlan(destination: string, beta: number) {
    const target = starById(destination)
    if (!target.surveyed || destination === 'sol') raise('choose a surveyed destination beyond sol')
    if (!Number.isFinite(beta) || beta <= 0 || beta >= 1) raise('cruise speed must be between zero and light speed')
    const distance = Math.hypot(...target.position)
    const years = distance / beta
    return {
        distance,
        years,
        shipYears: years * Math.sqrt(1 - beta * beta),
        seconds: years * YEAR,
    }
}

export interface Transfer {
    orbit        : Orbit
    target       : PlanetId
    seconds      : number
    departureBurn: number
    arrivalBurn  : number
    deltaV       : number
    targetPhase  : number
}

/** circular, coplanar heliocentric transfer. planetary escape/capture is excluded. */
export function systemPlan(target: PlanetId): Transfer {
    const planet = PLANETS.find(p => p.id === target)
    assert(planet && target !== 'earth', 'choose a planet beyond the departure orbit', 'navigation')
    const r1 = AU, r2 = planet.radius * AU
    const a = (r1 + r2) / 2
    const seconds = Math.PI * Math.sqrt(a ** 3 / SUN_MU)
    const departureBurn = Math.abs(Math.sqrt(SUN_MU * (2 / r1 - 1 / a)) - Math.sqrt(SUN_MU / r1))
    const arrivalBurn = Math.abs(Math.sqrt(SUN_MU / r2) - Math.sqrt(SUN_MU * (2 / r2 - 1 / a)))
    return {
        target, seconds, departureBurn, arrivalBurn,
        deltaV: departureBurn + arrivalBurn,
        targetPhase: DEPARTURE_ANGLE + Math.PI - seconds * Math.sqrt(SUN_MU / r2 ** 3),
        orbit: {
            a, e: Math.abs(r2 - r1) / (r1 + r2),
            angle: r2 > r1 ? DEPARTURE_ANGLE : DEPARTURE_ANGLE - Math.PI,
            m0: r2 > r1 ? 0 : Math.PI,
            period: seconds * 2,
            periapsis: Math.min(r1, r2), apoapsis: Math.max(r1, r2),
            deltaV: departureBurn + arrivalBurn,
        },
    }
}

export function transferPoint(plan: Transfer, progress: number): Point3 {
    const p = positionAt(plan.orbit, plan.seconds * boundedProgress(progress))
    return [ p.x / AU, p.y / AU, 0 ]
}

export function planetPoint(id: PlanetId, plan: Transfer, progress: number): Point3 {
    const planet = PLANETS.find(p => p.id === id)!
    const phase = id === plan.target ? plan.targetPhase : planet.phase
    const angle = phase + plan.seconds * boundedProgress(progress) * Math.sqrt(SUN_MU / (planet.radius * AU) ** 3)
    return [ planet.radius * Math.cos(angle), planet.radius * Math.sin(angle), 0 ]
}

export interface Journey { progress: number, running: boolean }
export const freshJourney = (): Journey => ({ progress: 0, running: false })

export function boundedProgress(n: number): number {
    if (!Number.isFinite(n)) raise('progress must be finite')
    return clamp(n)
}

export function advanceJourney(journey: Journey, elapsed: number, speed = 1): Journey {
    if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(speed) || speed <= 0) raise('invalid playback interval')
    if (!journey.running) return journey
    const progress = boundedProgress(journey.progress + elapsed * speed / DEMO_SECONDS)
    return { progress, running: progress < 1 }
}
