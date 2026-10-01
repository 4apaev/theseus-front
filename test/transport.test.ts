import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import * as parse from '../src/transport/validate.ts'
import { Pending } from '../src/transport/pending.ts'

test('rows coerce postgres numeric strings and normalize nulls', () => {
    const ship = parse.ship({
        sid: 'ship_1', name: 'n', status: 'docked', stid: 'sol.outpost', from: null, to: null, arrives: null,
        capacity: 20, velocity: '0.6', acceleration: '0.002', hull: 'starter', rig: 1, power: 4, power_pool: 8, years_abs: null, years_rel: null,
    })
    assert.equal(ship.velocity, 0.6)
    assert.equal(ship.from, undefined)
    assert.equal(ship.years_abs, undefined)

    assert.equal(parse.player({ pid: 'p', handle: 'h', balance: '1000' }).balance, 1000)
    assert.deepEqual(parse.market([{ gid: 'ore', price_buy: '25.5', price_sell: '20', updated: null }]), [{ gid: 'ore', price_buy: 25.5, price_sell: 20 }])
    assert.equal(parse.traffic([{ sid: 's', handle: 'alice', name: 'n', status: 'transit', stid: null, from: 'a', to: 'b', arrives: 'x', arrived: null, years_abs: '0.8' }])[ 0 ]?.years_abs, 0.8)
})

test('bad shapes fail with the payload code, never a typed lie', () => {
    assert.throws(() => parse.ship({ sid: 'x' }), { code: 'payload' })
    assert.throws(() => parse.ship({ sid: 'x', name: 'n', status: 'lost' }), { code: 'payload' })
    assert.throws(() => parse.player({ pid: 'p', handle: 'h', balance: 'lots' }), { code: 'payload' })
    assert.throws(() => parse.ships({ not: 'a list' }), { code: 'payload' })
    assert.throws(() => parse.frame({ event_type: 'x' }), { code: 'payload' })
    assert.throws(() => parse.frame(null), { code: 'payload' })
    assert.throws(() => parse.correlation({ cmd: 'c' }), { code: 'payload' })
    assert.throws(() => parse.login({ token: '' }), { code: 'payload' })
})

test('a frame keeps its payload as data and drops an empty correlation id', () => {
    const f = parse.frame({ event_type: 'ship.arrived.v1', occurred: 't', correlation_id: '', payload: { sid: 's' }})
    assert.equal(f.correlation_id, undefined)
    assert.deepEqual(f.payload, { sid: 's' })
})

test('the universe parses the live catalogue shape', () => {
    const u = parse.universe({
        systems  : [{ sysid: 'sol', name: 'Sol', star: 'G2V' }],
        stations : [{ stid: 'sol.outpost', system: 'sol', name: 'Sol Outpost', produces: { ore: 8 }, consumes: { grain: 5 }, stocks: [ 'cargo.mk1' ]}],
        routes   : [{ from: 'sol.outpost', to: 'sol.mars', ly: 0.00000828, c: 0.00008 }],
        goods    : { ore: { name: 'iron ore', price_base: 40, elasticity: 1.2, kind: 'commodity', volume: 1 }},
        hulls    : { starter: { id: 'starter', power_base: 3, capacity_base: 20, velocity_base: 0.6, acceleration_base: 0.002, slots: [{ id: 'power1', family: 'power', size: 'light' }]}},
        modules  : { 'reactor.mk1': { family: 'power', mount: 'light', power: 1, context: 'port', requires: [], conflicts: [], provides: [{ rate: 'power', rank: 1 }], effects: []}},
        starter  : { name: 'x' },
        constants: { time_scale: 20, ansible_speed: 100, light_speed: 299792458, year_seconds: 31557600, currency: '₢' },
    })
    assert.equal(u.stations[ 0 ]?.produces.ore, 8)
    assert.deepEqual(u.hulls.starter?.slots, [{ id: 'power1', family: 'power', size: 'light' }])
    assert.deepEqual(u.modules[ 'reactor.mk1' ]?.provides, [{ rate: 'power', rank: 1 }])
    assert.equal(u.constants.time_scale, 20)
    assert.throws(() => parse.universe({ systems: [], stations: [], routes: [], goods: { ore: { name: 'ore', kind: 'liquid', volume: 1, price_base: 1 }}, hulls: {}, modules: {}, constants: {}}), { code: 'payload' })
})

test('pending commands settle once by correlation id and time out otherwise', () => {
    mock.timers.enable({ apis: [ 'setTimeout' ]})
    const expired: string[] = []
    const pending = new Pending(1000)
    pending.onTimeout = c => expired.push(c.label)

    pending.track('a', 'travel → mars')
    pending.track('b', 'signal → alice', 'ship-x')
    assert.equal(pending.size, 2)

    assert.deepEqual(pending.settle('b'), { label: 'signal → alice', tag: 'ship-x' })
    assert.equal(pending.settle('b'), undefined)
    assert.equal(pending.settle(undefined), undefined)

    mock.timers.tick(1001)
    assert.deepEqual(expired, [ 'travel → mars' ])
    assert.equal(pending.size, 0)

    pending.track('c', 'later')
    pending.clear()
    mock.timers.tick(5000)
    assert.deepEqual(expired, [ 'travel → mars' ], 'a cleared command never times out')
    mock.timers.reset()
})
