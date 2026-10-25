import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { flowOf } from '../src/core/market.ts'
import { type Session, emptySession } from '../src/core/session.ts'

const json = async (name: string) => JSON.parse(await readFile(new URL(`../src/content/fixtures/${ name }.json`, import.meta.url), 'utf8'))

test('a good\'s market: its makers and buyers, the nearest first, never here', async () => {
    const s = { ...emptySession(), ...await json('docked'), universe: await json('universe') } as Session
    const { makers, buyers } = flowOf(s, 'protein')
    assert.deepEqual(makers.map(m => m.stid).sort(), [ 'lalande.gate', 'sol.mars' ])
    assert.deepEqual(buyers.map(b => b.stid).sort(), [ 'sirius.gate', 'sol.venus' ])
    for (const side of [ makers, buyers ]) assert.ok(side.every((x, i) => i === 0 || side[ i - 1 ].years <= x.years))
    assert.ok([ ...makers, ...buyers ].every(x => x.stid !== s.ship?.stid && x.hops > 0))
})
