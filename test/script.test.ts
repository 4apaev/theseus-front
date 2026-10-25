import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FixtureClient, type Recorded } from '../src/core/fixture.ts'
import { answer } from '../src/core/script.ts'

const read = (name: string): Recorded => JSON.parse(readFileSync(new URL(`../src/content/fixtures/${ name }.json`, import.meta.url), 'utf8'))

async function session(name: string) {
    const client = new FixtureClient(async () => ({ ...read(name), universe: read('universe') }))
    const online = new Promise(done => client.onStatus = done)
    client.boot()
    await online
    return client.session
}

const types = (beats: ReturnType<typeof answer>) => beats.map(b => b.frame.event_type)

test('a buy past the wallet or the hold is rejected', async () => {
    const s = await session('docked')
    const gid = s.market[ 0 ].gid
    assert.deepEqual(types(answer(s, 'post', '/api/market/buy', { gid, quantity: 1e6 })), [ 'market.trade.rejected.v1' ])
    const full = await session('full')
    assert.deepEqual(types(answer(full, 'post', '/api/market/buy', { gid: full.market[ 0 ].gid, quantity: 1 })), [ 'market.trade.rejected.v1' ])
})

test('travel plays one departed and arrived pair per hop, in order', async () => {
    const s = await session('docked')
    const far = s.universe!.stations.find(x => x.system !== 'sol')!.stid
    const beats = answer(s, 'post', `/api/ship/${ s.ship!.sid }/travel`, { to: far })
    assert.ok(beats.length >= 2 && beats.length % 2 === 0)
    assert.equal(beats.at(-1)!.frame.event_type, 'ship.arrived.v1')
    assert.equal((beats.at(-1)!.frame.payload as { stid: string }).stid, far)
    assert.ok(beats.every((b, i) => i === 0 || b.at >= beats[ i - 1 ].at))
})

test('a module must be in the hold to fit; an empty slot cannot be removed', async () => {
    const s = await session('docked')
    const sid = s.ship!.sid
    assert.deepEqual(types(answer(s, 'put', `/api/ship/${ sid }/modules/cargo1`, { gid: 'cargo.mk2' })).slice(0, 1),
        s.cargo.some(c => c.gid === 'cargo.mk2') ? [ 'ship.rig.changed.v1' ] : [ 'ship.module.operation.rejected.v1' ])
    const bare = { ...s, fitted: []}
    assert.deepEqual(types(answer(bare, 'del', `/api/ship/${ sid }/modules/cargo1`, {})), [ 'ship.module.operation.rejected.v1' ])
})

test('a letter is sent, then delivered by ansible', async () => {
    const s = await session('docked')
    const beats = answer(s, 'post', '/api/comms/messages', { body: 'hello' })
    assert.deepEqual(types(beats), [ 'comms.sent.v1', 'comms.delivered.v1' ])
    assert.ok(beats[ 1 ].at > beats[ 0 ].at)
})
