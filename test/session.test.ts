import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legTime, realMs, departures, cargoLoad, visualFitted, emptySession, dockedAt, withLog, sellersOf, quoted } from '../src/session.ts'
import type { Session } from '../src/session.ts'
import type { Ship, Constants } from '../src/transport/types.ts'

const LIGHT = 299792458
const YEAR = 31557600
const K: Constants = { time_scale: 20, light_speed: LIGHT, year_seconds: YEAR, currency: '₢' }
const AU = 1 / 63241.077

const ship: Ship = { sid: 's', name: 'n', status: 'docked', stid: 'sol.outpost', capacity: 20, velocity: 0.6, acceleration: 0.002, hull: 'starter', rig: 1, power: 4, power_pool: 8 }

test('legTime matches the server model: coast between stars, accelerate-flip-brake in system', () => {
    // a 4.32 ly star hop at 0.6c
    assert.ok(Math.abs(legTime({ from: 'a', to: 'b', ly: 4.32, c: 1 }, ship, K) - 7.2) < 1e-9)

    // sol.outpost → sol.mars: 0.524 au under the 0.00008c cap. the ship never reaches the cap.
    const d = 0.524 * AU * LIGHT * YEAR
    const expected = 2 * Math.sqrt(d / 0.002) / YEAR
    assert.ok(Math.abs(legTime({ from: 'a', to: 'b', ly: 0.524 * AU, c: 0.00008 }, ship, K) - expected) < 1e-12)

    // a long in-system leg hits the cap, and cruises the rest
    const far = { from: 'a', to: 'b', ly: 8.5 * AU, c: 0.00008 }
    const dist = far.ly * LIGHT * YEAR, v = far.c * LIGHT
    assert.ok(Math.sqrt(0.002 * dist) > v)
    assert.ok(Math.abs(legTime(far, ship, K) - (dist / v + v / 0.002) / YEAR) < 1e-12)

    // one game year lasts time_scale real seconds
    assert.equal(realMs(0.5, K), 10000)
})

test('departures list only routes from the current dock, closest first', () => {
    const s: Session = {
        ...emptySession(),
        ship,
        universe: {
            systems : [],
            stations: [
                { stid: 'sol.outpost', system: 'sol', name: 'Sol Outpost', produces: {}, consumes: {}},
                { stid: 'sol.mars', system: 'sol', name: 'Mars Hub', produces: {}, consumes: {}},
                { stid: 'alpha.exchange', system: 'alpha', name: 'Alpha Exchange', produces: {}, consumes: {}},
            ],
            routes: [
                { from: 'sol.outpost', to: 'alpha.exchange', ly: 4.32, c: 1 },
                { from: 'sol.outpost', to: 'sol.mars', ly: 0.524 * AU, c: 0.00008 },
                { from: 'sol.mars', to: 'sol.outpost', ly: 0.524 * AU, c: 0.00008 },
                { from: 'sol.outpost', to: 'ghost', ly: 1, c: 1 },
            ],
            goods: {}, hulls: {}, modules: {}, constants: K,
        },
    }
    const list = departures(s)
    assert.deepEqual(list.map(d => d.station.stid), [ 'sol.mars', 'alpha.exchange' ])
    assert.ok(list[ 1 ]!.years_rel < list[ 1 ]!.years_abs, 'a relativistic hop ages the pilot less')
    assert.equal(list[ 0 ]!.years_rel, list[ 0 ]!.years_abs, 'an in-system hop has no dilation')
    assert.deepEqual(departures({ ...s, ship: { ...ship, status: 'transit', stid: undefined }}), [])
})

test('a commodity sells at every exchange, a module only where a station stocks it', () => {
    const s: Session = {
        ...emptySession(),
        ship  : { ...ship, stid: 'sol.venus' },
        market: [{ gid: 'ore', price_buy: 25, price_sell: 20 }],
        universe: { systems: [], routes: [], hulls: {}, modules: {}, constants: K, goods: {
            ore        : { name: 'ore', kind: 'commodity', volume: 1, price_base: 1 },
            'cargo.mk1': { name: 'pod', kind: 'module', volume: 8, price_base: 1 },
        }, stations: [
            { stid: 'sol.venus', system: 'sol', name: 'Venus Lab', produces: {}, consumes: {}},
            { stid: 'sol.outpost', system: 'sol', name: 'Sol Outpost', produces: {}, consumes: {}, stocks: [ 'cargo.mk1' ]},
            { stid: 'sol.ganymede', system: 'sol', name: 'Ganymede Yards', produces: {}, consumes: {}, stocks: [ 'cargo.mk2' ]},
        ]},
    }
    assert.deepEqual(sellersOf(s, 'ore').map(x => x.stid), [ 'sol.venus', 'sol.outpost', 'sol.ganymede' ])
    assert.deepEqual(sellersOf(s, 'cargo.mk1').map(x => x.stid), [ 'sol.outpost' ])
    assert.deepEqual(sellersOf(s, 'mystery'), [])
    assert.equal(quoted(s, 'ore'), true)
    assert.equal(quoted(s, 'cargo.mk1'), false, 'venus posts no module quote')
    assert.equal(quoted({ ...s, ship: { ...ship, status: 'transit', stid: undefined }}, 'ore'), false, 'no quotes in transit')
})

test('cargo load weighs quantity by good volume', () => {
    const s: Session = {
        ...emptySession(),
        cargo: [{ gid: 'ore', quantity: 3 }, { gid: 'cargo.mk2', quantity: 1 }, { gid: 'mystery', quantity: 2 }],
        universe: { systems: [], stations: [], routes: [], hulls: {}, modules: {}, constants: K, goods: {
            ore        : { name: 'ore', kind: 'commodity', volume: 1, price_base: 1 },
            'cargo.mk2': { name: 'pod', kind: 'module', volume: 8, price_base: 1 },
        }},
    }
    assert.equal(cargoLoad(s), 3 + 8 + 2)
})

test('the renderer sees upgrades and the transceiver, never mk1 placeholders', () => {
    assert.deepEqual(visualFitted([
        { slot: 'power1', gid: 'reactor.mk1' },
        { slot: 'cargo1', gid: 'cargo.mk2' },
        { slot: 'cruise1', gid: 'cruise.mk2' },
        { slot: 'maneuver1', gid: 'maneuver.mk2' },
        { slot: 'utility1', gid: 'ansible.mk1' },
    ]), [ 'cargo', 'drive', 'ansible' ])
    assert.deepEqual(visualFitted([{ slot: 'cargo1', gid: 'cargo.mk1' }]), [])
})

test('traffic lookups and the log cap keep snapshots immutable', () => {
    const s: Session = { ...emptySession(), traffic: {
        a: { sid: 'a', name: 'a', status: 'docked', stid: 'sol.outpost' },
        b: { sid: 'b', name: 'b', status: 'transit', to: 'sol.outpost' },
    }}
    assert.deepEqual(dockedAt(s, 'sol.outpost').map(t => t.sid), [ 'a' ])
    assert.deepEqual(dockedAt(s), [])

    let logged = s
    for (let i = 0; i < 70; i++) logged = withLog(logged, 'dim', `line ${ i }`)
    assert.equal(logged.log.length, 60)
    assert.equal(logged.log[ 0 ]?.text, 'line 69')
    assert.equal(s.log.length, 0)
})
