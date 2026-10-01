/**
 * wire shapes of the gateway. property names mirror the server's
 * columns, so they stay snake_case. numbers arrive as strings from
 * postgres numeric columns. `validate.ts` coerces them.
 */

export type Status = 'docked' | 'transit'
export type Side   = 'buy' | 'sell'

export interface Player {
    pid    : string
    handle : string
    balance: number
}

export interface Ship {
    sid         : string
    name        : string
    status      : Status
    stid?       : string
    from?       : string
    to?         : string
    arrives?    : string
    capacity    : number
    velocity    : number
    acceleration: number
    hull        : string
    rig         : number
    power       : number
    power_pool  : number
    years_abs?  : number
    years_rel?  : number
}

export interface CargoRow   { gid: string, quantity: number }
export interface FittedSlot { slot: string, gid: string }
export interface MarketRow  { gid: string, price_buy: number, price_sell: number }

export interface TradeRow {
    tid        : string
    gid        : string
    stid       : string
    side       : Side
    quantity   : number
    price_unit : number
    price_total: number
    created    : string
}

/** `to` absent means station chat at `stid`. */
export interface MessageRow {
    mid       : string
    from      : string
    to?       : string
    stid?     : string
    body      : string
    sent      : string
    deliver   : string
    delivered?: string
}

/** another player's ship. no pid, by design. */
export interface TrafficRow {
    sid       : string
    name      : string
    status    : Status
    handle?   : string
    stid?     : string
    from?     : string
    to?       : string
    arrives?  : string
    years_abs?: number
}

export interface System  { sysid: string, name: string, star: string }
export interface Route   { from: string, to: string, ly: number, c: number }
export interface Station {
    stid    : string
    system  : string
    name    : string
    produces: Record<string, number>
    consumes: Record<string, number>
    stocks? : string[]
}

export interface Good {
    name      : string
    kind      : 'commodity' | 'module'
    volume    : number
    price_base: number
}

export interface Slot { id: string, family: string, size: string }
export interface Rate { rate: string, rank: number }

export interface HullSpec {
    id           : string
    power_base   : number
    capacity_base: number
    velocity_base: number
    slots        : Slot[]
}

export interface Design {
    family  : string
    mount   : string
    power   : number
    context : string
    requires: Rate[]
    provides: Rate[]
}

export interface Constants {
    time_scale  : number
    light_speed : number
    year_seconds: number
    currency    : string
}

export interface Universe {
    systems  : System[]
    stations : Station[]
    routes   : Route[]
    goods    : Record<string, Good>
    hulls    : Record<string, HullSpec>
    modules  : Record<string, Design>
    constants: Constants
}

/** one websocket frame. a foreign event carries no correlation id. */
export interface Frame {
    event_type     : string
    occurred       : string
    correlation_id?: string
    payload        : Record<string, unknown>
}

export interface Preview {
    proposed    : FittedSlot[]
    capacity    : number
    velocity    : number
    acceleration: number
    power       : number
    power_pool  : number
    load        : number
    errors      : string[]
}

export interface Login {
    pid   : string
    handle: string
    role  : string
    token : string
}
