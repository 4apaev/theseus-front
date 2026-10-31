import type { GameClient } from '../core/client.ts'
import { type Session, dockedAt, peerName } from '../core/session.ts'
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
    kit.comms.lines = lines(s, Date.now())
    kit.comms.peers = dockedAt(s, s.ship?.stid).map(t => ({ sid: t.sid, name: t.handle ?? t.name }))
}

/**
 * the panel's rows: the channel of this station, the letters we sent, and
 * the letters to us that have landed. a letter crosses space at ansible
 * speed: its reader sees nothing while it flies.
 */
export function lines(s: Session, now: number) {
    const here = s.ship?.stid, me = s.me?.pid
    const shown = (m: MessageRow) => m.to ? m.from === me || !!m.delivered : m.stid === here
    return s.messages.filter(shown).sort((a, b) => a.sent.localeCompare(b.sent)).map(m => ({
        mid   : m.mid,
        who   : nameOf(s, m.from),
        body  : m.body,
        when  : stamp(m.delivered ?? m.deliver, now),
        letter: !!m.to,
        flying: !!m.to && !m.delivered && Date.parse(m.deliver) > now,
    }))
}

// the time of day; a day before today also names its weekday and date
export function stamp(iso: string, now: number) {
    const t = new Date(iso), time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return t.toDateString() === new Date(now).toDateString()
        ? time
        : `${ t.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) } ${ time }`
}

// a message names its sender by pid. the traffic has no pids: a peer is
// known once we wrote to them, and the reply named their pid
function nameOf(s: Session, pid: string) {
    return pid === s.me?.pid ? 'you' : peerName(s, pid)
}
