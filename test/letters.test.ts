import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lines, stamp } from '../src/places/letters.ts'
import { type Session, emptySession, peerName } from '../src/core/session.ts'
import type { MessageRow } from '../src/core/transport/types.ts'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const row = (mid: string, patch: Partial<MessageRow>): MessageRow => ({ mid, from: 'p-a', body: mid, sent: '2026-10-26T11:00:00Z', deliver: '2026-10-26T11:00:00Z', ...patch })

function session(messages: MessageRow[]): Session {
    return { ...emptySession(), me: { pid: 'p-me', handle: 'me', balance: 0 }, ship: { stid: 'sol.outpost' }, messages } as unknown as Session
}

test('a letter to us shows only once it lands; our own shows in flight', () => {
    const s = session([
        row('flying-to-me', { to: 'p-me', deliver: '2026-10-26T13:00:00Z' }),
        row('landed-to-me', { to: 'p-me', delivered: '2026-10-26T11:30:00Z' }),
        row('mine-flying', { from: 'p-me', to: 'p-b', deliver: '2026-10-26T13:00:00Z' }),
        row('channel-here', { stid: 'sol.outpost', delivered: '2026-10-26T11:00:00Z' }),
        row('channel-away', { stid: 'sol.mars', delivered: '2026-10-26T11:00:00Z' }),
    ])
    const shown = lines(s, NOW)
    assert.deepEqual(shown.map(l => l.mid), [ 'landed-to-me', 'mine-flying', 'channel-here' ])
    assert.equal(shown.find(l => l.mid === 'mine-flying')?.flying, true)
})

test('a stamp names the day only when it is not today', () => {
    assert.doesNotMatch(stamp('2026-10-26T09:41:00Z', NOW), /oct/i)
    assert.match(stamp('2026-10-21T21:41:00Z', NOW), /oct/i)
})

test('a stranger shows a tag of their pid; a known peer, their handle', () => {
    const s = { ...session([]), peers: { 'p-b': 's-b' }, traffic: { 's-b': { handle: 'bob' }}} as unknown as Session
    assert.equal(peerName(s, 'p-b'), 'bob')
    assert.equal(peerName(s, '0b1c2d3e-0000-4000-8000-0000000000a7'), 'pilot 00a7')
})
