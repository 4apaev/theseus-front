import test from 'node:test'
import assert from 'node:assert/strict'
import {
    systemPosition, orbitRadius, place, sectorNodes, systemNodes, routeEdges, courseEdges,
    orbitRings, progress, moverPoint, heading, shortestPath, gatewayOf, starColor, displayRadius,
} from '../src/maps/chart.ts'
import type { Universe, Ship } from '../src/transport/types.ts'

const K = { time_scale: 20, light_speed: 299792458, year_seconds: 31557600, currency: '₢' }
const AU = 1 / 63241.077

function link(a: string, b: string, ly: number, c = 1) {
    return [{ from: a, to: b, ly, c }, { from: b, to: a, ly, c }]
}

/** the live universe's shape, trimmed to sol, alpha centauri, barnards star and wolf 359. */
const u: Universe = {
    systems: [
        { sysid: 'sol', name: 'Sol', star: 'G2V yellow dwarf' },
        { sysid: 'alpha.centauri', name: 'Alpha Centauri', star: 'G2V + K1V binary' },
        { sysid: 'barnards.star', name: 'Barnards Star', star: 'M4V red dwarf' },
        { sysid: 'wolf.359', name: 'Wolf 359', star: 'M6V red dwarf' },
    ],
    stations: [
        { stid: 'sol.mercury', system: 'sol', name: 'Mercury Deep', produces: { ore: 10 }, consumes: { grain: 6 }},
        { stid: 'sol.outpost', system: 'sol', name: 'Sol Outpost', produces: { ore: 8 }, consumes: { grain: 5 }},
        { stid: 'sol.mars', system: 'sol', name: 'Mars Hub', produces: { grain: 7 }, consumes: { spice: 5 }},
        { stid: 'sol.titan', system: 'sol', name: 'Titan Ring', produces: { spice: 7 }, consumes: { grain: 5 }},
        { stid: 'alpha.exchange', system: 'alpha.centauri', name: 'Alpha Exchange', produces: { grain: 8 }, consumes: { spice: 5 }},
        { stid: 'barnards.port', system: 'barnards.star', name: 'Barnards Port', produces: { spice: 8 }, consumes: { ore: 5 }},
        { stid: 'wolf.reach', system: 'wolf.359', name: 'Wolf Reach', produces: { grain: 9 }, consumes: { ore: 6 }},
    ],
    routes: [
        ...link('sol.outpost', 'sol.mercury', 0.613 * AU, 0.00008),
        ...link('sol.mars', 'sol.outpost', 0.524 * AU, 0.00008),
        ...link('sol.mars', 'sol.titan', 8.013 * AU, 0.00008),
        ...link('sol.titan', 'sol.outpost', 8.537 * AU, 0.00008),
        ...link('sol.outpost', 'alpha.exchange', 4.32),
        ...link('sol.outpost', 'barnards.port', 5.95),
        ...link('alpha.exchange', 'barnards.port', 6.44),
        ...link('barnards.port', 'wolf.reach', 10.93),
        ...link('alpha.exchange', 'wolf.reach', 8.27),
    ],
    goods: {}, hulls: {}, modules: {}, constants: K,
}

const ship: Ship = { sid: 's', name: 'n', status: 'docked', stid: 'sol.outpost', capacity: 20, velocity: 0.6, acceleration: 0.002, hull: 'starter', rig: 1, power: 4, power_pool: 8 }

const SECTOR = { mode: 'sector' as const, sysid: 'sol' }
const SOL = { mode: 'system' as const, sysid: 'sol' }
const near = (a: number, b: number, tolerance = 0.02) => assert.ok(Math.abs(a - b) < tolerance, `${ a } is not near ${ b }`)

test('catalogue star positions reproduce the universe route lengths', () => {
    const d = (a: string, b: string) => Math.hypot(...systemPosition(u, a).map((v, i) => v - systemPosition(u, b)[ i ]!))
    near(d('sol', 'alpha.centauri'), 4.32)
    near(d('sol', 'barnards.star'), 5.95)
    near(d('alpha.centauri', 'barnards.star'), 6.44)
    near(d('barnards.star', 'wolf.359'), 10.93)
    near(d('alpha.centauri', 'wolf.359'), 8.27)
    assert.deepEqual(systemPosition({ ...u, systems: [ ...u.systems, { sysid: 'nowhere', name: 'x', star: 'K' }]}, 'nowhere').length, 3, 'an unknown system still gets a place')
})

test('stations sit on their orbits, unknown ones in declaration order', () => {
    assert.equal(orbitRadius(u, 'sol.mars'), 1.524)
    assert.equal(orbitRadius(u, 'sol.outpost'), 1)
    assert.equal(orbitRadius(u, 'alpha.exchange'), 1)
    assert.deepEqual(orbitRings(u, 'sol'), [ 0.387, 1, 1.524, 9.537 ].map(displayRadius))
    assert.ok(displayRadius(0.387) < displayRadius(1) && displayRadius(1) < displayRadius(9.537), 'compression keeps the order')
    assert.ok(displayRadius(9.537) / displayRadius(0.387) < 5, 'and pulls the outer system in')
    assert.deepEqual(place(u, SECTOR, 'sol.mars'), [ 0, 0, 0 ])
    assert.equal(place(u, SOL, 'alpha.exchange'), undefined, 'a station of another system is out of frame')
    assert.equal(place(u, SOL, 'missing'), undefined)
    near(Math.hypot(...place(u, SOL, 'sol.titan')!), displayRadius(9.537), 1e-9)
})

test('sector nodes name systems, system nodes name stations and the star', () => {
    const sector = sectorNodes(u)
    assert.deepEqual(sector.map(n => n.id), [ 'sol', 'alpha.centauri', 'barnards.star', 'wolf.359' ])
    assert.match(sector[ 0 ]!.sub, /4 stations/)
    assert.equal(starColor('M4V red dwarf'), '#d97a5a')
    const system = systemNodes(u, 'sol')
    assert.equal(system[ 0 ]!.kind, 'system')
    assert.deepEqual(system.slice(1).map(n => n.id), [ 'sol.mercury', 'sol.outpost', 'sol.mars', 'sol.titan' ])
    assert.equal(system[ 3 ]!.sub, '↑ grain · ↓ spice')
    assert.equal(gatewayOf(u, 'sol')?.stid, 'sol.outpost')
    assert.equal(gatewayOf(u, 'wolf.359')?.stid, 'wolf.reach')
})

test('route edges appear once per pair and only when both ends are in frame', () => {
    const sector = routeEdges(u, SECTOR)
    assert.equal(sector.length, 5, 'in-system routes collapse to a point and vanish')
    const system = routeEdges(u, SOL)
    assert.equal(system.length, 4)
    const course = courseEdges(u, SECTOR, [ 'sol.mars', 'sol.outpost', 'alpha.exchange', 'wolf.reach' ], 'course')
    assert.deepEqual(course.map(e => e.kind), [ 'course', 'course' ])
})

test('the shortest course weighs travel time, not distance', () => {
    const plan = shortestPath(u, ship, 'sol.outpost', 'wolf.reach')!
    assert.deepEqual(plan.stops, [ 'sol.outpost', 'alpha.exchange', 'wolf.reach' ])
    near(plan.years_abs, (4.32 + 8.27) / 0.6, 1e-9)
    assert.ok(plan.years_rel < plan.years_abs)
    near(plan.ms, plan.years_abs * 20 * 1000, 1e-6)
    near(plan.ly, 12.59, 1e-9)

    const direct = shortestPath(u, ship, 'sol.outpost', 'sol.titan')!
    assert.deepEqual(direct.stops, [ 'sol.outpost', 'sol.titan' ], 'a square-root leg time makes the direct link win')
    assert.equal(direct.years_rel, direct.years_abs, 'an in-system hop has no dilation')

    assert.deepEqual(shortestPath(u, ship, 'sol.mars', 'sol.mars')!.stops, [ 'sol.mars' ])
    assert.equal(shortestPath({ ...u, routes: u.routes.filter(r => !r.from.startsWith('wolf') && !r.to.startsWith('wolf')) }, ship, 'sol.outpost', 'wolf.reach'), undefined)
})

test('a ship in transit moves along its leg on the server clock', () => {
    const arrives = Date.parse('2026-09-18T00:00:20.000Z')
    const m = { status: 'transit' as const, from: 'sol.outpost', to: 'alpha.exchange', arrives: '2026-09-18T00:00:20.000Z', years_abs: 1 }
    assert.equal(progress(m, K, arrives - 20000), 0)
    near(progress(m, K, arrives - 10000), 0.5, 1e-9)
    assert.equal(progress(m, K, arrives + 5000), 1)
    assert.equal(progress({ status: 'docked', stid: 'sol.mars' }, K, arrives), 0)

    const half = moverPoint(u, SECTOR, m, arrives - 10000)!
    const alpha = systemPosition(u, 'alpha.centauri')
    near(half[ 0 ], alpha[ 0 ] / 2, 1e-9)
    near(half[ 2 ], alpha[ 2 ] / 2, 1e-9)
    assert.deepEqual(heading(u, SECTOR, m), alpha)
    assert.equal(moverPoint(u, SOL, m, arrives), undefined, 'a ship leaving the system is out of the system frame')
    assert.deepEqual(moverPoint(u, SOL, { status: 'docked', stid: 'sol.outpost' }, arrives), place(u, SOL, 'sol.outpost'))
})
