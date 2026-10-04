import { assert } from '../util.ts'
import type {
    Player, Ship, CargoRow, FittedSlot, MarketRow, TradeRow, MessageRow,
    TrafficRow, Universe, Frame, Preview, Login, Status, Side,
} from './types.ts'

/**
 * the boundary between the wire and the session. typescript types
 * do not check a value that arrived over a socket. every parser
 * throws a `Fail` with code `payload` on a bad shape, and coerces
 * postgres numeric strings to numbers.
 */

export type Row = Record<string, unknown>

export function row(x: unknown): Row {
    assert(x !== null && typeof x === 'object' && !Array.isArray(x), 'expected an object', 'payload')
    return x as Row
}

export function list<T>(x: unknown, parse: (item: unknown) => T): T[] {
    assert(Array.isArray(x), 'expected a list', 'payload')
    return x.map(parse)
}

export function text(r: Row, key: string): string {
    const v = r[ key ]
    assert(typeof v === 'string' && v.length > 0, `${ key } must be text`, 'payload')
    return v
}

/** an absent, null or empty string reads as undefined. */
export function maybe(r: Row, key: string): string | undefined {
    const v = r[ key ]
    return typeof v === 'string' && v ? v : void 0
}

export function num(r: Row, key: string): number {
    const n = Number(r[ key ])
    assert(r[ key ] != null && r[ key ] !== '' && Number.isFinite(n), `${ key } must be a number`, 'payload')
    return n
}

export function numOr(r: Row, key: string): number | undefined {
    return r[ key ] == null ? void 0 : num(r, key)
}

export function texts(r: Row, key: string): string[] {
    return list(r[ key ] ?? [], item => {
        assert(typeof item === 'string', `${ key } must hold text`, 'payload')
        return item
    })
}

function status(r: Row): Status {
    const s = text(r, 'status')
    assert(s === 'docked' || s === 'transit', 'unknown ship status', 'payload')
    return s
}

export function side(r: Row): Side {
    const s = text(r, 'side')
    assert(s === 'buy' || s === 'sell', 'unknown trade side', 'payload')
    return s
}

function record<T>(x: unknown, parse: (item: unknown) => T): Record<string, T> {
    const r = row(x)
    return Object.fromEntries(Object.keys(r).map(k => [ k, parse(r[ k ]) ]))
}

// ── rows ─────────────────────────────────────────────────────

export function player(x: unknown): Player {
    const r = row(x)
    return { pid: text(r, 'pid'), handle: text(r, 'handle'), balance: num(r, 'balance') }
}

export function ship(x: unknown): Ship {
    const r = row(x)
    return {
        sid         : text(r, 'sid'),
        name        : text(r, 'name'),
        status      : status(r),
        stid        : maybe(r, 'stid'),
        from        : maybe(r, 'from'),
        to          : maybe(r, 'to'),
        arrives     : maybe(r, 'arrives'),
        capacity    : num(r, 'capacity'),
        velocity    : num(r, 'velocity'),
        acceleration: num(r, 'acceleration'),
        hull        : text(r, 'hull'),
        rig         : num(r, 'rig'),
        power       : num(r, 'power'),
        power_pool  : num(r, 'power_pool'),
        years_abs   : numOr(r, 'years_abs'),
        years_rel   : numOr(r, 'years_rel'),
    }
}

export const ships = (x: unknown) => list(x, ship)

export const cargo = (x: unknown) => list(x, (item): CargoRow => {
    const r = row(item)
    return { gid: text(r, 'gid'), quantity: num(r, 'quantity') }
})

export const fitted = (x: unknown) => list(x, (item): FittedSlot => {
    const r = row(item)
    return { slot: text(r, 'slot'), gid: text(r, 'gid') }
})

export const market = (x: unknown) => list(x, (item): MarketRow => {
    const r = row(item)
    return { gid: text(r, 'gid'), price_buy: num(r, 'price_buy'), price_sell: num(r, 'price_sell') }
})

export const trades = (x: unknown) => list(x, (item): TradeRow => {
    const r = row(item)
    return {
        tid        : text(r, 'tid'),
        gid        : text(r, 'gid'),
        stid       : text(r, 'stid'),
        side       : side(r),
        quantity   : num(r, 'quantity'),
        price_unit : num(r, 'price_unit'),
        price_total: num(r, 'price_total'),
        created    : text(r, 'created'),
    }
})

export function message(x: unknown): MessageRow {
    const r = row(x)
    return {
        mid      : text(r, 'mid'),
        from     : text(r, 'from'),
        to       : maybe(r, 'to'),
        stid     : maybe(r, 'stid'),
        body     : text(r, 'body'),
        sent     : text(r, 'sent'),
        deliver  : text(r, 'deliver'),
        delivered: maybe(r, 'delivered'),
    }
}

export const messages = (x: unknown) => list(x, message)

export const traffic = (x: unknown) => list(x, (item): TrafficRow => {
    const r = row(item)
    return {
        sid      : text(r, 'sid'),
        name     : text(r, 'name'),
        status   : status(r),
        handle   : maybe(r, 'handle'),
        stid     : maybe(r, 'stid'),
        from     : maybe(r, 'from'),
        to       : maybe(r, 'to'),
        arrives  : maybe(r, 'arrives'),
        years_abs: numOr(r, 'years_abs'),
    }
})

// ── catalogue ────────────────────────────────────────────────

export function universe(x: unknown): Universe {
    const r = row(x)
    const constants = row(r.constants)
    return {
        systems : list(r.systems, item => {
            const s = row(item)
            return { sysid: text(s, 'sysid'), name: text(s, 'name'), star: text(s, 'star') }
        }),
        stations: list(r.stations, item => {
            const s = row(item)
            return {
                stid    : text(s, 'stid'),
                system  : text(s, 'system'),
                name    : text(s, 'name'),
                produces: record(s.produces ?? {}, Number),
                consumes: record(s.consumes ?? {}, Number),
                stocks  : s.stocks ? texts(s, 'stocks') : void 0,
            }
        }),
        routes: list(r.routes, item => {
            const e = row(item)
            return { from: text(e, 'from'), to: text(e, 'to'), ly: num(e, 'ly'), c: num(e, 'c') }
        }),
        goods: record(r.goods, item => {
            const g = row(item)
            const kind = text(g, 'kind')
            assert(kind === 'commodity' || kind === 'module', 'unknown good kind', 'payload')
            return { name: text(g, 'name'), kind, volume: num(g, 'volume'), price_base: num(g, 'price_base') }
        }),
        hulls: record(r.hulls, item => {
            const h = row(item)
            return {
                id           : text(h, 'id'),
                power_base   : num(h, 'power_base'),
                capacity_base: num(h, 'capacity_base'),
                velocity_base: num(h, 'velocity_base'),
                slots        : list(h.slots, slot => {
                    const s = row(slot)
                    return { id: text(s, 'id'), family: text(s, 'family'), size: text(s, 'size') }
                }),
            }
        }),
        modules: record(r.modules, item => {
            const d = row(item)
            return {
                family  : text(d, 'family'),
                mount   : text(d, 'mount'),
                power   : num(d, 'power'),
                context : text(d, 'context'),
                requires: rates(d.requires),
                provides: rates(d.provides),
            }
        }),
        constants: {
            time_scale  : num(constants, 'time_scale'),
            light_speed : num(constants, 'light_speed'),
            year_seconds: num(constants, 'year_seconds'),
            currency    : text(constants, 'currency'),
        },
    }
}

function rates(x: unknown) {
    return list(x ?? [], item => {
        const r = row(item)
        return { rate: text(r, 'rate'), rank: num(r, 'rank') }
    })
}

// ── replies ──────────────────────────────────────────────────

export function frame(x: unknown): Frame {
    const r = row(x)
    return {
        event_type    : text(r, 'event_type'),
        occurred      : text(r, 'occurred'),
        correlation_id: maybe(r, 'correlation_id'),
        payload       : row(r.payload),
    }
}

export function preview(x: unknown): Preview {
    const r = row(x)
    return {
        proposed    : fitted(r.proposed),
        capacity    : num(r, 'capacity'),
        velocity    : num(r, 'velocity'),
        acceleration: num(r, 'acceleration'),
        power       : num(r, 'power'),
        power_pool  : num(r, 'power_pool'),
        load        : num(r, 'load'),
        errors      : texts(r, 'errors'),
    }
}

export function login(x: unknown): Login {
    const r = row(x)
    return { pid: text(r, 'pid'), handle: text(r, 'handle'), role: text(r, 'role'), token: text(r, 'token') }
}

/** a 202 reply: `{ cmd, correlation_id }`. */
export function correlation(x: unknown): string {
    return text(row(x), 'correlation_id')
}
