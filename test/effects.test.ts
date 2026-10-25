import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effects } from '../src/core/effects.ts'
import { emptySession } from '../src/core/session.ts'

const s = { ...emptySession(), me: { pid: 'p1', handle: 'nobody', balance: 1000 }}
const frame = (type: string, payload: Record<string, unknown>) => ({ event_type: type, occurred: '', payload })

test('a wallet event gives the change, not the balance', () => {
    assert.deepEqual(effects(s, frame('wallet.debited.v1', { pid: 'p1', amount: 220, balance: 780 })), [{ kind: 'wallet', delta: -220 }])
    assert.deepEqual(effects(s, frame('wallet.credited.v1', { pid: 'p1', amount: 36, balance: 1036 })), [{ kind: 'wallet', delta: 36 }])
})

test('cargo in is plus, cargo out is minus; a stranger gives nothing', () => {
    assert.deepEqual(effects(s, frame('cargo.loaded.v1', { pid: 'p1', gid: 'ore', quantity: 5 })), [{ kind: 'cargo', gid: 'ore', delta: 5 }])
    assert.deepEqual(effects(s, frame('cargo.unloaded.v1', { pid: 'p1', gid: 'ore', quantity: 2 })), [{ kind: 'cargo', gid: 'ore', delta: -2 }])
    assert.deepEqual(effects(s, frame('cargo.loaded.v1', { gid: 'ore', quantity: 5 })), [])
})

test('ships come and go, ours or not; other events give nothing', () => {
    assert.deepEqual(effects(s, frame('ship.departed.v1', { sid: 's9', from: 'a', to: 'b' })), [{ kind: 'depart', sid: 's9', mine: false }])
    assert.deepEqual(effects(s, frame('ship.arrived.v1', { pid: 'p1', sid: 's1', stid: 'b' })), [{ kind: 'arrive', sid: 's1', stid: 'b', mine: true }])
    assert.deepEqual(effects(s, frame('comms.sent.v1', { pid: 'p1' })), [])
})
