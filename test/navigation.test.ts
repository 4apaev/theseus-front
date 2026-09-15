import test from 'node:test'
import assert from 'node:assert/strict'
import { coastPlan, systemPlan, transferPoint, planetPoint, advanceJourney, freshJourney, DEMO_SECONDS, DAY, AU, SUN_MU } from '../src/maps/navigation.ts'
import { positionAt } from '../src/simulation/orbit.ts'

const close = (a: number, b: number, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${ a } differs from ${ b }`)

test('sector distance and both clocks derive from the same cruise speed', () => {
    const p = coastPlan('cersa', 0.6)
    close(p.distance, Math.hypot(3.2, 2.4, 1.5))
    close(p.years, p.distance / 0.6)
    close(p.shipYears, p.years * 0.8)
    for (const beta of [ 0, -1, 1, NaN ]) assert.throws(() => coastPlan('cersa', beta))
    for (const id of [ 'sol', 'phi-1', 'missing' ]) assert.throws(() => coastPlan(id, 0.6))
})

test('earth to mars transfer has expected time and two-burn budget', () => {
    const plan = systemPlan('mars')
    close(plan.seconds / DAY, 258.915, 0.1)
    close(plan.departureBurn, 2.946, 0.01)
    close(plan.arrivalBurn, 2.650, 0.01)
    close(plan.deltaV, plan.departureBurn + plan.arrivalBurn)
})

test('inward and outward transfers meet the moving destination exactly', () => {
    for (const id of [ 'mercury', 'venus', 'mars' ] as const) {
        const plan = systemPlan(id)
        const departure = transferPoint(plan, 0)
        const earth = planetPoint('earth', plan, 0)
        const arrival = transferPoint(plan, 1)
        const target = planetPoint(id, plan, 1)
        close(Math.hypot(...departure), 1)
        departure.forEach((p, i) => close(p, earth[ i ]))
        arrival.forEach((p, i) => close(p, target[ i ]))
        const initialTarget = planetPoint(id, plan, 0)
        assert.ok(Math.hypot(initialTarget[ 0 ] - target[ 0 ], initialTarget[ 1 ] - target[ 1 ]) > 0.1)
    }
})

test('propagation is keplerian rather than a linear angular interpolation', () => {
    const plan = systemPlan('mars')
    const middle = transferPoint(plan, 0.5)
    const before = positionAt(plan.orbit, plan.seconds * 0.5 - 1)
    const after = positionAt(plan.orbit, plan.seconds * 0.5 + 1)
    const speed2 = ((after.x - before.x) / 2) ** 2 + ((after.y - before.y) / 2) ** 2
    const radius = Math.hypot(...middle) * AU
    close(speed2 / 2 - SUN_MU / radius, -SUN_MU / (2 * plan.orbit.a), 0.001)
})

test('journey handles pause, variable speed and arrival without overshoot', () => {
    const initial = freshJourney()
    assert.equal(advanceJourney(initial, 10), initial)
    const cruising = advanceJourney({ ...initial, running: true }, 6)
    close(cruising.progress, 6 / DEMO_SECONDS)
    const arrived = advanceJourney(cruising, 100, 4)
    assert.deepEqual(arrived, { progress: 1, running: false })
    assert.deepEqual(initial, { progress: 0, running: false })
    assert.throws(() => advanceJourney(initial, NaN))
    assert.throws(() => advanceJourney(initial, 1, 0))
})
