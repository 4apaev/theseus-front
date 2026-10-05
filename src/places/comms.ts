import type { GameClient } from '../core/client.ts'
import { type Session, dockedAt, peerOf } from '../core/session.ts'
import type { MessageRow } from '../core/transport/types.ts'
import { Fail } from '../core/util.ts'
import type { Kit } from '../kit/index.ts'
import type { Stage } from '../world/stage.ts'
import { Painted } from './painted.ts'

/**
 * comms: the painted room, the station channel and the letters. a
 * letter goes by ansible and lands later; the channel reaches the
 * ships docked here. every change of the session renders the panel, so
 * a letter shows the moment it lands.
 */
export class Comms extends Painted {
    private readonly client: GameClient

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        super(stage, kit, [ 'comms', 'outpost' ])
        this.client = client
        kit.comms.addEventListener('send', e => {
            const { body, to } = (e as CustomEvent<{ body: string, to?: string }>).detail
            if (body) this.client.send(body, to).catch(x => kit.toast.say(Fail.from(x).message, true))
        })
    }

    sync(s: Session) {
        this.session = s
        const here = s.ship?.stid, now = Date.now()
        const mine = (m: MessageRow) => m.to ? true : m.stid === here
        this.kit.comms.lines = s.messages.filter(mine).sort((a, b) => a.sent.localeCompare(b.sent)).map(m => ({
            mid   : m.mid,
            who   : this.name(s, m.from),
            body  : m.body,
            when  : new Date(m.delivered ?? m.deliver).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            letter: !!m.to,
            flying: !!m.to && !m.delivered && Date.parse(m.deliver) > now,
        }))
        this.kit.comms.peers = dockedAt(s, here).map(t => ({ sid: t.sid, name: t.handle ?? t.name }))
    }

    protected reveal(on: boolean) {
        this.kit.comms.hidden = !on
    }

    // a message names its sender by pid. the traffic has no pids: a peer is
    // known once we wrote to them, and the reply named their pid
    private name(s: Session, pid: string) {
        if (pid === s.me?.pid) return 'you'
        const t = peerOf(s, pid)
        return t?.handle ?? t?.name ?? 'a pilot'
    }
}
