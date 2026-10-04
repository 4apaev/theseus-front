import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FixtureClient, type Recorded } from '../src/core/fixture.ts'
import { cargoLoad, docked, station } from '../src/core/session.ts'

const read = (name: string): Recorded => JSON.parse(readFileSync(new URL(`../src/content/fixtures/${ name }.json`, import.meta.url), 'utf8'))
const universe = read('universe')

async function boot(name: string) {
    const client = new FixtureClient(async () => ({ ...read(name), universe }))
    const online = new Promise(done => client.onStatus = done)
    client.boot()
    await online
    return client
}

test('each fixture passes the wire parsers and boots online', async () => {
    for (const name of [ 'docked', 'transit', 'full' ]) {
        const { session: s, status } = await boot(name)
        assert.equal(status, 'online', name)
        assert.ok(s.me && s.ship && s.universe, name)
        assert.ok(cargoLoad(s) <= s.ship.capacity, `${ name }: the hold fits`)
        assert.ok(s.fitted.every(f => s.universe?.goods[ f.gid ]), `${ name }: fitted modules are goods`)
        assert.ok(s.market.every(m => s.universe?.goods[ m.gid ]), `${ name }: quoted goods exist`)
    }
})

test('docked and full sit at a known station with a market; full fills the hold', async () => {
    const d = (await boot('docked')).session
    const f = (await boot('full')).session
    for (const s of [ d, f ]) {
        assert.ok(docked(s) && station(s, s.ship?.stid))
        assert.ok(s.market.length > 0)
    }
    assert.equal(cargoLoad(f), f.ship?.capacity)
})

test('a recorded arrival counts from boot', async () => {
    const before = Date.now()
    const { session: s } = await boot('transit')
    const eta = Date.parse(s.ship?.arrives ?? '') - before
    assert.equal(s.ship?.status, 'transit')
    assert.ok(eta >= 89_000 && eta <= 91_000, `eta ${ eta }`)
    assert.ok(Object.values(s.traffic).some(t => t.arrives && Date.parse(t.arrives) > before))
})

test('a fixture command logs and sends nothing', async () => {
    const client = await boot('docked')
    await client.rename('test pattern')
    assert.match(client.session.log[ 0 ]?.text ?? '', /rename → test pattern · fixture/)
})
