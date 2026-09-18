import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fold, flavor } from '../src/events.ts'
import { emptySession } from '../src/session.ts'
import type { Session } from '../src/session.ts'
import type { Frame } from '../src/transport/types.ts'

const ME = 'pid-me'

function session(): Session {
    return {
        ...emptySession(),
        me  : { pid: ME, handle: 'me', balance: 1000 },
        ship: { sid: 'ship-me', name: 'far treasure', status: 'docked', stid: 'sol.outpost', capacity: 20, velocity: 0.6, acceleration: 0.002, hull: 'starter', rig: 1, power: 4, power_pool: 8 },
        cargo  : [{ gid: 'ore', quantity: 5 }],
        market : [{ gid: 'ore', price_buy: 25, price_sell: 20 }],
        traffic: { 'ship-x': { sid: 'ship-x', name: 'stranger', handle: 'alice', status: 'docked', stid: 'sol.outpost' }},
    }
}

function frame(type: string, payload: Record<string, unknown>, coid?: string): Frame {
    return { event_type: type, occurred: '2026-09-18T00:00:00.000Z', correlation_id: coid, payload }
}

test('own departure moves the ship and drops the market; a foreign one only tracks traffic', () => {
    const s = session()
    const departed = { from: 'sol.outpost', to: 'sol.mars', arrives: '2026-09-18T01:00:00.000Z', years_abs: '0.5', years_rel: 0.4 }

    const own = fold(s, frame('ship.departed.v1', { ...departed, pid: ME, sid: 'ship-me' }))
    assert.equal(own.session.ship?.status, 'transit')
    assert.equal(own.session.ship?.stid, undefined)
    assert.equal(own.session.ship?.years_abs, 0.5)
    assert.equal(own.session.ship?.years_rel, 0.4)
    assert.deepEqual(own.session.market, [])
    assert.equal(s.ship?.status, 'docked', 'the previous snapshot is untouched')

    const foreign = fold(s, frame('ship.departed.v1', { ...departed, sid: 'ship-x' }))
    assert.equal(foreign.session.ship?.status, 'docked')
    assert.equal(foreign.session.traffic[ 'ship-x' ]?.status, 'transit')
    assert.equal(foreign.session.traffic[ 'ship-x' ]?.to, 'sol.mars')
})

test('arrival docks the ship and asks for a market refresh', () => {
    const s = fold(session(), frame('ship.departed.v1', { pid: ME, sid: 'ship-me', from: 'sol.outpost', to: 'sol.mars', arrives: 'x', years_abs: 1, years_rel: 1 })).session
    const { session: next, refresh } = fold(s, frame('ship.arrived.v1', { pid: ME, sid: 'ship-me', stid: 'sol.mars', arrived: 'x' }))
    assert.equal(next.ship?.status, 'docked')
    assert.equal(next.ship?.stid, 'sol.mars')
    assert.equal(next.ship?.from, undefined)
    assert.ok(refresh.includes('market'))
})

test('cargo events add, subtract and drop empty rows', () => {
    let s = fold(session(), frame('cargo.loaded.v1', { gid: 'grain', quantity: 3, pid: ME, sid: 'ship-me', stid: 'sol.outpost' })).session
    assert.deepEqual(s.cargo, [{ gid: 'ore', quantity: 5 }, { gid: 'grain', quantity: 3 }])
    s = fold(s, frame('cargo.unloaded.v1', { gid: 'ore', quantity: '5', pid: ME, sid: 'ship-me', stid: 'sol.outpost' })).session
    assert.deepEqual(s.cargo, [{ gid: 'grain', quantity: 3 }])
})

test('a module exchange moves packages between hold and rig', () => {
    const s = fold(session(), frame('cargo.module.exchanged.v1', { pid: ME, sid: 'ship-me', operation: 'replace', incoming: 'ore', outgoing: 'cargo.mk1', load: 12, capacity_next: 20 })).session
    assert.deepEqual(s.cargo, [{ gid: 'ore', quantity: 4 }, { gid: 'cargo.mk1', quantity: 1 }])
})

test('a rig snapshot replaces stats and fitted slots as numbers', () => {
    const s = fold(session(), frame('ship.rig.changed.v1', {
        pid: ME, sid: 'ship-me', slot: 'cargo1', hull: 'starter', rig: 2, operation: 'install',
        capacity: '30', velocity: '0.6', acceleration: '0.002', power: '5', power_pool: '8',
        fitted: [{ slot: 'cargo1', gid: 'cargo.mk2' }],
    })).session
    assert.equal(s.ship?.capacity, 30)
    assert.equal(s.ship?.rig, 2)
    assert.deepEqual(s.fitted, [{ slot: 'cargo1', gid: 'cargo.mk2' }])
})

test('wallet and price events update balance and the local quote only', () => {
    let s = fold(session(), frame('wallet.debited.v1', { pid: ME, rfid: 'r', amount: 100, balance: '900' })).session
    assert.equal(s.me?.balance, 900)
    s = fold(s, frame('market.price.changed.v1', { stid: 'sol.outpost', gid: 'ore', price_buy: '30', price_sell: '24' })).session
    assert.deepEqual(s.market, [{ gid: 'ore', price_buy: 30, price_sell: 24 }])
    s = fold(s, frame('market.price.changed.v1', { stid: 'sol.mars', gid: 'grain', price_buy: 1, price_sell: 1 })).session
    assert.equal(s.market.length, 1, 'a quote from another station is ignored')
})

test('messages append once and delivery marks the known row without losing its sent time', () => {
    const sent = { mid: 'm1', from: ME, to: 'pid-x', body: 'hello', sent: '2026-09-18T00:00:00.000Z', deliver: '2026-09-18T00:00:09.000Z' }
    let s = fold(session(), frame('comms.sent.v1', sent)).session
    s = fold(s, frame('comms.sent.v1', sent)).session
    assert.equal(s.messages.length, 1)
    s = fold(s, frame('comms.delivered.v1', { mid: 'm1', from: ME, to: 'pid-x', body: 'hello', delivered: '2026-09-18T00:00:09.000Z' })).session
    assert.equal(s.messages[ 0 ]?.delivered, '2026-09-18T00:00:09.000Z')
    assert.equal(s.messages[ 0 ]?.sent, sent.sent)
})

test('a malformed payload throws at the boundary instead of folding garbage', () => {
    assert.throws(() => fold(session(), frame('cargo.loaded.v1', { gid: 'ore', quantity: 'many', pid: ME })), { code: 'payload' })
    assert.throws(() => fold(session(), frame('ship.departed.v1', { pid: ME, sid: 'ship-me' })), { code: 'payload' })
})

test('flavor reads own moves in the second person and strangers by handle', () => {
    const s = session()
    assert.match(flavor(s, frame('ship.arrived.v1', { pid: ME, sid: 'ship-me', stid: 'sol.outpost', arrived: 'x' })).text, /^docked at/)
    assert.match(flavor(s, frame('ship.arrived.v1', { sid: 'ship-x', stid: 'sol.outpost', arrived: 'x' })).text, /^alice docked/)
    assert.equal(flavor(s, frame('market.trade.rejected.v1', { side: 'buy', reason: 'no funds', gid: 'ore', pid: ME, sid: 's', stid: 'st', quantity: 1 })).kind, 'err')
    assert.equal(flavor(s, frame('mystery.v1', {})).text, 'mystery.v1')
})
