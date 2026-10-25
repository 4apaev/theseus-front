import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apoapsis, circular, conic, periapsis, period, radius } from '../src/core/kepler.ts'

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${ a } ≈ ${ b }`)

test('a circular orbit keeps its radius all round', () => {
    const [ r, v ] = circular(10, .7, 4), c = conic(r, v, 4)
    near(c.e, 0)
    near(radius(c, 2), 10)
    near(period(c, 4), 2 * Math.PI * Math.sqrt(1000 / 4))
})

test('a prograde burn raises the far side; the burn point is the periapsis', () => {
    const [ r, v ] = circular(10, 0, 1), c = conic(r, [ v[ 0 ], v[ 1 ] * 1.1 ], 1)
    near(periapsis(c), 10)
    assert.ok(apoapsis(c) > 10)
    near(radius(c, Math.PI), apoapsis(c))
})

test('escape speed and more makes no apoapsis', () => {
    const [ r, v ] = circular(10, 0, 1), c = conic(r, [ 0, v[ 1 ] * Math.SQRT2 * 1.01 ], 1)
    assert.ok(c.e > 1)
    assert.equal(apoapsis(c), Infinity)
    assert.equal(radius(c, Math.PI), Infinity)
})
