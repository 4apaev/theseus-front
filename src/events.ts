import type { Frame, CargoRow, MarketRow, Ship, TrafficRow, MessageRow } from './transport/types.ts'
import { text, maybe, num, numOr, side, fitted as parseFitted, message as parseMessage, texts } from './transport/validate.ts'
import type { Row } from './transport/validate.ts'
import { credits, fmtYears, fmtVel } from './util.ts'
import { goodName, stationName, mine, peerOf } from './session.ts'
import type { Session, LogKind } from './session.ts'

export type Refresh = 'rig' | 'market' | 'traffic'
export interface Fold { session: Session, refresh: Refresh[] }
export interface Flavor { kind: LogKind, text: string }

/**
 * one event in, the next session out. pure: no io, no dom.
 * a payload with a bad shape throws at the first read.
 *
 * our own move reads in the second person. another player's move
 * must not. the gateway strips the pid from a foreign event, so an
 * event with our pid is our own.
 */
export function fold(s: Session, e: Frame): Fold {
    const f = folds[ e.event_type ]
    return f
        ? f(s, e.payload)
        : { session: s, refresh: []}
}

export function flavor(s: Session, e: Frame): Flavor {
    const f = flavors[ e.event_type ]
    return f
        ? f(s, e.payload)
        : { kind: 'dim', text: e.event_type }
}

type FoldFn   = (s: Session, p: Row) => Fold
type FlavorFn = (s: Session, p: Row) => Flavor

const keep = (session: Session, ...refresh: Refresh[]): Fold => ({ session, refresh })

function patchShip(s: Session, patch: Partial<Ship>): Session {
    return s.ship ? { ...s, ship: { ...s.ship, ...patch }} : s
}

function patchTraffic(s: Session, sid: string, patch: Partial<TrafficRow>): Session {
    const row = s.traffic[ sid ]
    return row
        ? { ...s, traffic: { ...s.traffic, [ sid ]: { ...row, ...patch }}}
        : s
}

function mutateCargo(cargo: CargoRow[], gid: string, delta: number): CargoRow[] {
    const found = cargo.some(c => c.gid === gid)
    const next = found
        ? cargo.map(c => c.gid === gid ? { ...c, quantity: c.quantity + delta } : c)
        : [ ...cargo, { gid, quantity: delta }]
    return next.filter(c => c.quantity > 0)
}

function withMessage(s: Session, m: MessageRow): Session {
    const i = s.messages.findIndex(x => x.mid === m.mid)
    const messages = i === -1
        ? [ ...s.messages, m ]
        : s.messages.with(i, { ...s.messages[ i ], ...m })
    return { ...s, messages }
}

// ── folds ────────────────────────────────────────────────────

const folds: Record<string, FoldFn> = {
    'ship.created.v1'(s, p) {
        if (mine(s, p)) return keep(s, 'rig', 'market')
        const row: TrafficRow = { sid: text(p, 'sid'), name: text(p, 'name'), stid: text(p, 'stid'), status: 'docked' }
        return keep({ ...s, traffic: { ...s.traffic, [ row.sid ]: row }})
    },

    'ship.departed.v1'(s, p) {
        const patch = {
            from     : text(p, 'from'),
            to       : text(p, 'to'),
            stid     : void 0,
            status   : 'transit' as const,
            arrives  : text(p, 'arrives'),
            years_abs: num(p, 'years_abs'),
        }
        if (!mine(s, p)) return keep(patchTraffic(s, text(p, 'sid'), patch))
        return keep({ ...patchShip(s, { ...patch, years_rel: numOr(p, 'years_rel') }), market: []})
    },

    // arrival at the course's end closes it. a waypoint keeps it open.
    'ship.arrived.v1'(s, p) {
        const patch = { from: void 0, to: void 0, arrives: void 0, stid: text(p, 'stid'), status: 'docked' as const }
        if (!mine(s, p)) return keep(patchTraffic(s, text(p, 'sid'), patch))
        const next = patchShip(s, patch)
        return keep({ ...next, course: next.course === patch.stid ? void 0 : next.course }, 'market', 'traffic')
    },

    'ship.travel.rejected.v1': (s, p) => keep(mine(s, p) ? { ...s, course: void 0 } : s),

    'ship.renamed.v1'(s, p) {
        const name = text(p, 'name')
        return mine(s, p)
            ? keep(patchShip(s, { name }))
            : keep(patchTraffic(s, text(p, 'sid'), { name }))
    },

    /* a full rig snapshot. a reload would race projection-service,
       which consumes the same event. */
    'ship.rig.changed.v1'(s, p) {
        if (!mine(s, p)) return keep(s)
        const ship = {
            hull        : text(p, 'hull'),
            rig         : num(p, 'rig'),
            capacity    : num(p, 'capacity'),
            velocity    : num(p, 'velocity'),
            acceleration: num(p, 'acceleration'),
            power       : num(p, 'power'),
            power_pool  : num(p, 'power_pool'),
        }
        return keep({ ...patchShip(s, ship), fitted: parseFitted(p.fitted) })
    },

    // the packages move with the rig. incoming leaves the hold, outgoing joins it.
    'cargo.module.exchanged.v1'(s, p) {
        if (!mine(s, p)) return keep(s)
        let cargo = s.cargo
        const incoming = maybe(p, 'incoming'), outgoing = maybe(p, 'outgoing')
        if (incoming) cargo = mutateCargo(cargo, incoming, -1)
        if (outgoing) cargo = mutateCargo(cargo, outgoing, 1)
        return keep({ ...s, cargo })
    },

    'cargo.loaded.v1'  : (s, p) => keep({ ...s, cargo: mutateCargo(s.cargo, text(p, 'gid'), num(p, 'quantity')) }),
    'cargo.unloaded.v1': (s, p) => keep({ ...s, cargo: mutateCargo(s.cargo, text(p, 'gid'), -num(p, 'quantity')) }),

    'market.trade.executed.v1'(s, p) {
        const trade = {
            side       : side(p),
            tid        : text(p, 'tid'),
            gid        : text(p, 'gid'),
            stid       : text(p, 'stid'),
            quantity   : num(p, 'quantity'),
            price_unit : num(p, 'price_unit'),
            price_total: num(p, 'price_total'),
            created    : (new Date).toISOString(),
        }
        return keep({ ...s, trades: [ trade, ...s.trades ]})
    },

    'wallet.debited.v1' : balance,
    'wallet.credited.v1': balance,

    'market.price.changed.v1'(s, p) {
        if (!s.ship || p.stid !== s.ship.stid) return keep(s)
        const row: MarketRow = { gid: text(p, 'gid'), price_buy: num(p, 'price_buy'), price_sell: num(p, 'price_sell') }
        const i = s.market.findIndex(m => m.gid === row.gid)
        return keep({ ...s, market: i === -1 ? [ ...s.market, row ] : s.market.with(i, row) })
    },

    'comms.sent.v1': (s, p) => keep(withMessage(s, parseMessage(p))),

    // the delivered event repeats the message without its sent time. the known row keeps it.
    'comms.delivered.v1'(s, p) {
        const delivered = text(p, 'delivered')
        const old = s.messages.find(m => m.mid === p.mid)
        return keep(withMessage(s, {
            mid    : text(p, 'mid'),
            from   : text(p, 'from'),
            to     : text(p, 'to'),
            body   : text(p, 'body'),
            sent   : old?.sent ?? delivered,
            deliver: old?.deliver ?? delivered,
            delivered,
        }))
    },
}

function balance(s: Session, p: Row): Fold {
    return keep(s.me ? { ...s, me: { ...s.me, balance: num(p, 'balance') }} : s)
}

// ── flavors ──────────────────────────────────────────────────

const ok  = (text: string): Flavor => ({ kind: 'ok', text })
const err = (text: string): Flavor => ({ kind: 'err', text })
const dim = (text: string): Flavor => ({ kind: 'dim', text })

function who(s: Session, p: Row): string {
    const sid = maybe(p, 'sid')
    return (sid && s.traffic[ sid ]?.handle) ?? 'a pilot'
}

function sender(s: Session, p: Row): string {
    const from = text(p, 'from')
    if (from === s.me?.pid) return 'you'
    return peerOf(s, from)?.handle ?? 'a pilot'
}

/* incoming and outgoing say which of the 3 operations ran.
   install carries incoming alone, remove carries outgoing alone,
   and a replace carries both. */
function rigChanged(s: Session, p: Row): Flavor {
    const incoming = maybe(p, 'incoming'), outgoing = maybe(p, 'outgoing')
    const what = incoming
        ? outgoing
            ? `${ goodName(s, outgoing) } → ${ goodName(s, incoming) }`
            : `${ goodName(s, incoming) } fitted`
        : `${ goodName(s, outgoing ?? '') } removed`
    return ok(`${ text(p, 'slot') }: ${ what } · cap ${ num(p, 'capacity') } · v ${ fmtVel(num(p, 'velocity')) }c · pwr ${ num(p, 'power') }/${ num(p, 'power_pool') }`)
}

const flavors: Record<string, FlavorFn> = {
    'ship.created.v1': (s, p) => mine(s, p)
        ? ok(`ship "${ text(p, 'name') }" commissioned at ${ stationName(s, text(p, 'stid')) }`)
        : dim(`new ship "${ text(p, 'name') }" at ${ stationName(s, text(p, 'stid')) }`),

    'ship.departed.v1': (s, p) => mine(s, p)
        ? ok(`departed ${ stationName(s, text(p, 'from')) } → ${ stationName(s, text(p, 'to')) } · you age ${ fmtYears(num(p, 'years_rel')) }yr, the galaxy ages ${ fmtYears(num(p, 'years_abs')) }yr`)
        : dim(`${ who(s, p) } departed ${ stationName(s, text(p, 'from')) } → ${ stationName(s, text(p, 'to')) }`),

    'ship.arrived.v1': (s, p) => mine(s, p)
        ? ok(`docked at ${ stationName(s, text(p, 'stid')) }`)
        : dim(`${ who(s, p) } docked at ${ stationName(s, text(p, 'stid')) }`),

    'ship.renamed.v1': (s, p) => mine(s, p)
        ? ok(`ship renamed to "${ text(p, 'name') }"`)
        : dim(`a ship is now called "${ text(p, 'name') }"`),

    'ship.rename.rejected.v1'    : (_s, p) => err(`rename rejected: ${ text(p, 'reason') }`),
    'ship.travel.rejected.v1'    : (_s, p) => err(`travel rejected: ${ text(p, 'reason') }`),
    'cargo.loaded.v1'            : (s, p) => ok(`+${ num(p, 'quantity') } ${ goodName(s, text(p, 'gid')) } loaded`),
    'cargo.unloaded.v1'          : (s, p) => ok(`-${ num(p, 'quantity') } ${ goodName(s, text(p, 'gid')) } unloaded`),
    'cargo.operation.rejected.v1': (_s, p) => err(text(p, 'reason')),

    'ship.rig.changed.v1'              : rigChanged,
    'ship.module.operation.rejected.v1': (_s, p) => err(`rig rejected: ${ texts(p, 'reasons').join(' · ') }`),
    'cargo.module.exchanged.v1'        : (_s, p) => dim(`hold ${ num(p, 'load') }/${ num(p, 'capacity_next') }`),
    'cargo.module.exchange.rejected.v1': (_s, p) => err(`exchange rejected: ${ texts(p, 'reasons').join(' · ') }`),

    'market.trade.executed.v1'     : (s, p) => ok(`${ text(p, 'side') } ${ num(p, 'quantity') } × ${ goodName(s, text(p, 'gid')) } @ ${ credits(num(p, 'price_unit')) } = ${ credits(num(p, 'price_total')) }`),
    'market.trade.rejected.v1'     : (_s, p) => err(`${ text(p, 'side') } rejected: ${ text(p, 'reason') }`),
    'wallet.debited.v1'            : (_s, p) => ok(`-${ credits(num(p, 'amount')) } → ${ credits(num(p, 'balance')) }`),
    'wallet.credited.v1'           : (_s, p) => ok(`+${ credits(num(p, 'amount')) } → ${ credits(num(p, 'balance')) }`),
    'wallet.transaction.rejected.v1': (_s, p) => err(text(p, 'reason')),
    'market.price.changed.v1'      : (s, p) => dim(`${ stationName(s, text(p, 'stid')) } quotes ${ goodName(s, text(p, 'gid')) } buy ${ credits(num(p, 'price_buy')) } sell ${ credits(num(p, 'price_sell')) }`),

    'comms.sent.v1': (s, p) => maybe(p, 'to')
        ? ok(`signal ${ sender(s, p) === 'you' ? 'sent' : `from ${ sender(s, p) }` } · in transit`)
        : dim(`${ sender(s, p) }: ${ text(p, 'body').slice(0, 40) }`),
    'comms.delivered.v1'   : (s, p) => dim(`signal ${ sender(s, p) === 'you' ? 'delivered' : `from ${ sender(s, p) } arrived` }`),
    'comms.send.rejected.v1': (_s, p) => err(`signal rejected: ${ text(p, 'reason') }`),
}
