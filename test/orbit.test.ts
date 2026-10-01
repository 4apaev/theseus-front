import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveOrbit, positionAt, velocityAt, closestApproach, brachistochrone, MU, INITIAL_RADIUS, CIRCULAR_SPEED } from '../src/simulation/orbit.ts'

function near(a: number, b: number, tolerance = 1e-7) { assert.ok(Math.abs(a - b) < tolerance, `${ a } is not near ${ b }`) }

test('zero burn preserves circular orbit and its initial speed', () => {
    const o = solveOrbit(0, 0)
    near(o.e, 0)
    near(o.a, INITIAL_RADIUS)
    for (const t of [ 0, o.period / 4, o.period, o.period * 3.2 ]) {
        const p = positionAt(o, t), v = velocityAt(o, t)
        near(Math.hypot(p.x, p.y), INITIAL_RADIUS)
        near(Math.hypot(v.x, v.y), CIRCULAR_SPEED)
    }
})
test('prograde burn preserves periapsis and raises apoapsis', () => {
    const o = solveOrbit(1.2, 0)
    near(o.periapsis, INITIAL_RADIUS)
    assert.ok(o.apoapsis > INITIAL_RADIUS)
    near(Math.hypot(positionAt(o, o.period / 2).x, positionAt(o, o.period / 2).y), o.apoapsis)
})
test('radial burn starts at the maneuver position with requested velocity', () => {
    for (const phase of [ 0, 0.8, -2.4 ]) {
        const o = solveOrbit(0.6, 0.3, phase)
        const p = positionAt(o, 0), v = velocityAt(o, 0)
        near(p.x, INITIAL_RADIUS * Math.cos(phase))
        near(p.y, INITIAL_RADIUS * Math.sin(phase))
        near(v.x, 0.3 * Math.cos(phase) - (CIRCULAR_SPEED + 0.6) * Math.sin(phase))
        near(v.y, 0.3 * Math.sin(phase) + (CIRCULAR_SPEED + 0.6) * Math.cos(phase))
    }
})
test('propagation preserves orbital energy and angular momentum', () => {
    const o = solveOrbit(0.9, -0.5)
    let momentum: number | undefined
    for (let i = 0; i < 30; i++) {
        const p = positionAt(o, i * o.period / 29), v = velocityAt(o, i * o.period / 29)
        near((v.x ** 2 + v.y ** 2) / 2 - MU / Math.hypot(p.x, p.y), -MU / (2 * o.a))
        const h = p.x * v.y - p.y * v.x
        momentum ??= h
        near(h, momentum)
    }
})
test('rejects escape and invalid inputs and reports finite encounters', () => {
    assert.throws(() => solveOrbit(10, 0), /unbound/)
    assert.throws(() => solveOrbit(NaN, 0), /finite/)
    const encounter = closestApproach(solveOrbit(1.2, 0))
    assert.ok(encounter.time >= 0 && Number.isFinite(encounter.separation) && Number.isFinite(encounter.relativeSpeed))
})
test('brachistochrone sample matches constant-acceleration units', () => {
    const b = brachistochrone(129600, 0.1)
    near(b.seconds, 72000)
    near(b.peakKmS, 3.6)
    near(b.deltaV, 7.2)
    assert.throws(() => brachistochrone(1, 0))
})
