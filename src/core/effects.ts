import type { Frame } from './transport/types.ts'
import { type Row, num, text } from './transport/validate.ts'
import { type Session, mine } from './session.ts'

/** a thing that happened, for the world to animate. it never changes state. */
export type Effect =
    | { kind: 'wallet', delta: number }
    | { kind: 'cargo', gid: string, delta: number }
    | { kind: 'depart', sid: string, mine: boolean }
    | { kind: 'arrive', sid: string, stid: string, mine: boolean }
    | { kind: 'rig', slot: string }
    | { kind: 'letter', in: boolean }

type EffectFn = (s: Session, p: Row) => Effect[]

/** the effects of one frame, read against the session before it. pure. */
export function effects(s: Session, e: Frame): Effect[] {
    return table[ e.event_type ]?.(s, e.payload) ?? []
}

const own = (s: Session, p: Row, f: () => Effect): Effect[] => mine(s, p) ? [ f() ] : []
const wallet: EffectFn = (s, p) => own(s, p, () => ({ kind: 'wallet', delta: +(num(p, 'balance') - (s.me?.balance ?? 0)).toFixed(2) }))
const cargo = (sign: number): EffectFn => (s, p) => own(s, p, () => ({ kind: 'cargo', gid: text(p, 'gid'), delta: sign * num(p, 'quantity') }))

const table: Record<string, EffectFn> = {
    'wallet.debited.v1'  : wallet,
    'wallet.credited.v1' : wallet,
    'cargo.loaded.v1'    : cargo(1),
    'cargo.unloaded.v1'  : cargo(-1),
    'ship.departed.v1'   : (s, p) => [{ kind: 'depart', sid: text(p, 'sid'), mine: mine(s, p) }],
    'ship.arrived.v1'    : (s, p) => [{ kind: 'arrive', sid: text(p, 'sid'), stid: text(p, 'stid'), mine: mine(s, p) }],
    'ship.rig.changed.v1': (s, p) => own(s, p, () => ({ kind: 'rig', slot: text(p, 'slot') })),
    // a letter we send goes out; one delivered to us comes in. the channel stays quiet
    'comms.sent.v1'      : (s, p) => p.to && p.from === s.me?.pid ? [{ kind: 'letter', in: false }] : [],
    'comms.delivered.v1' : (s, p) => p.to === s.me?.pid ? [{ kind: 'letter', in: true }] : [],
}
