import { test } from 'node:test'
import assert from 'node:assert/strict'
import universe from '../src/content/fixtures/universe.json' with { type: 'json' }
import * as parse from '../src/core/transport/validate.ts'
import { type Session, emptySession, realMs } from '../src/core/session.ts'
import { tripOf } from '../src/core/trip.ts'

const NOW = Date.parse('2026-10-31T12:00:00Z')

function session(patch: Partial<Session>): Session {
    const u = parse.universe(universe)
    const ship = { sid: 's', name: 'x', status: 'transit', from: 'sol.outpost', to: 'alpha.exchange', years_abs: 4.4, velocity: .6, acceleration: .002, arrives: new Date(NOW + 60_000).toISOString() }
    return { ...emptySession(), universe: u, ship, ...patch } as unknown as Session
}

test('a trip runs from its origin through the leg to the course end', () => {
    const t = tripOf(session({ origin: 'sol.mars', course: 'barnards.port' }), NOW)!
    assert.deepEqual(t.stops, [ 'sol.mars', 'sol.outpost', 'alpha.exchange', 'barnards.port' ])
    assert.equal(t.passed, 2)
    assert.equal(t.toHop, 60_000)
    assert.ok(t.toEnd > t.toHop)
    assert.ok(t.share > t.shares[ 1 ] && t.share < t.shares[ 2 ])
})

test('without a course the trip is the leg', () => {
    const s = session({}), t = tripOf(s, NOW)!
    assert.deepEqual(t.stops, [ 'sol.outpost', 'alpha.exchange' ])
    assert.equal(t.toEnd, t.toHop)
    assert.ok(Math.abs(t.share - (1 - 60_000 / realMs(4.4, s.universe!.constants))) < 1e-9)
})
