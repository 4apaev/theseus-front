import type { GameClient } from '../core/client.ts'
import { type Session, dockedAt, peerOf } from '../core/session.ts'
import type { MessageRow } from '../core/transport/types.ts'
import { Fail } from '../core/util.ts'
import type { Kit } from '../kit/index.ts'

/** the composer sends: to the station channel, or a letter to a peer. */
export function compose(kit: Kit, client: GameClient) {
    kit.comms.addEventListener('send', e => {
        const { body, to } = (e as CustomEvent<{ body: string, to?: string }>).detail
        if (body) client.send(body, to).catch(x => kit.toast.say(Fail.from(x).message, true))
    })
}

/** the comms panel from the session: the channel here and the letters, oldest first, and who is docked here. */
export function fill(kit: Kit, s: Session) {
    const here = s.ship?.stid, now = Date.now()
    const mine = (m: MessageRow) => m.to ? true : m.stid === here
    kit.comms.lines = s.messages.filter(mine).sort((a, b) => a.sent.localeCompare(b.sent)).map(m => ({
        mid   : m.mid,
        who   : nameOf(s, m.from),
        body  : m.body,
        when  : new Date(m.delivered ?? m.deliver).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        letter: !!m.to,
        flying: !!m.to && !m.delivered && Date.parse(m.deliver) > now,
    }))
    kit.comms.peers = dockedAt(s, here).map(t => ({ sid: t.sid, name: t.handle ?? t.name }))
}

// a message names its sender by pid. the traffic has no pids: a peer is
// known once we wrote to them, and the reply named their pid
function nameOf(s: Session, pid: string) {
    if (pid === s.me?.pid) return 'you'
    const t = peerOf(s, pid)
    return t?.handle ?? t?.name ?? 'a pilot'
}
