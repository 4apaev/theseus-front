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

const settle = (ms = 700) => new Promise(done => setTimeout(done, ms))

test('a fixture buy folds in: the wallet pays, the hold fills', async () => {
    const client = await boot('docked')
    const before = client.session
    const quote = before.market[ 0 ]
    await client.trade('buy', quote.gid, 1)
    await settle()
    const s = client.session
    assert.equal(s.me?.balance, +((before.me?.balance ?? 0) - quote.price_buy).toFixed(2))
    assert.equal(s.cargo.find(c => c.gid === quote.gid)?.quantity, (before.cargo.find(c => c.gid === quote.gid)?.quantity ?? 0) + 1)
    assert.match(s.log.map(l => l.text).join('\n'), /\[buy 1 ×/)
})

test('a fixture rename and a refused sell', async () => {
    const client = await boot('docked')
    await client.rename('test pattern')
    await client.trade('sell', client.session.market[ 0 ].gid, 999)
    await settle()
    assert.equal(client.session.ship?.name, 'test pattern')
    assert.match(client.session.log.map(l => l.text).join('\n'), /sell rejected: not enough in the hold/)
})
