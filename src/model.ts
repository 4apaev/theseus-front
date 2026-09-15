import { assert, raise } from './util.ts'

/** domain data has no dependency on lit, three.js or browser globals. */
export type Category = 'industrial' | 'civil'   | 'security'
export type Facility = 'exchange'   | 'drydock' | 'relay'
export type ModuleId = 'cargo'      | 'drive'   | 'ansible'
export type GoodId   = 'ore'        | 'grain'   | 'parts'
export type View     = 'port'       | 'rig'     | 'market' | 'comms'  | 'orbit' | 'map'
export type HullId   = 'freighter'  | 'tanker'  | 'tug'    | 'colony' | 'liner' | 'transport' | 'yacht' | 'research' | 'discovery' | 'battleship' | 'frigate' | 'corvette' | 'prison'

export interface Hull {
    id      : HullId
    name    : string
    purpose : string
    capacity: number
    category: Category
    family? : 'research'
}

export const HULLS: Hull[] = [
    { id: 'freighter'  , name: 'freighter'           , category: 'industrial' , purpose: 'modular cargo hauling'            , capacity: 40  },
    { id: 'tanker'     , name: 'tanker'              , category: 'industrial' , purpose: 'bulk propellant delivery'         , capacity: 24  },
    { id: 'tug'        , name: 'salvage tug'         , category: 'industrial' , purpose: 'recovery & towing'                , capacity: 16  },
    { id: 'colony'     , name: 'colony giant'        , category: 'industrial' , purpose: 'a settlement in transit'          , capacity: 120 },
    { id: 'liner'      , name: 'liner'               , category: 'civil'      , purpose: 'scheduled interplanetary passage' , capacity: 48  },
    { id: 'transport'  , name: 'passenger transport' , category: 'civil'      , purpose: 'short-range passenger transfer'   , capacity: 24  },
    { id: 'yacht'      , name: 'yacht'               , category: 'civil'      , purpose: 'private passage'                  , capacity: 16  },
    { id: 'research'   , name: 'research vessel'     , category: 'civil'      , purpose: 'survey & field science'           , capacity: 24, family: 'research' },
    { id: 'discovery', name: 'discovery one', category: 'civil', purpose: 'long-duration research expedition', capacity: 24, family: 'research' },
    { id: 'battleship' , name: 'battleship'          , category: 'security'   , purpose: 'fleet combat'                     , capacity: 48  },
    { id: 'frigate'    , name: 'frigate'             , category: 'security'   , purpose: 'escort & patrol'                  , capacity: 24  },
    { id: 'corvette'   , name: 'corvette'            , category: 'security'   , purpose: 'fast interception'                , capacity: 16  },
    { id: 'prison'     , name: 'prison barge'        , category: 'security'   , purpose: 'secure custody transfer'          , capacity: 48  },
]

export const MODULES = {
    cargo  : { name: 'cargo expansion'    , label: 'cargo pod / mk.02'      , power: 2, capacity: 20 , slot: 'cargo / 02'   , description: 'an additional pressure-rated cargo bay. more room for whatever comes next.'                    },
    drive  : { name: 'maneuver assembly'  , label: 'maneuver drive / mk.02' , power: 3, capacity: 0  , slot: 'drive / 01'   , description: 'a higher-output maneuver assembly. increases local thrust and reduces burn time.'              },
    ansible: { name: 'ansible transceiver', label: 'comms array / mk.01'    , power: 1, capacity: 0  , slot: 'utility / 01' , description: 'opens a delayed private channel between compatible vessels. the stars still take their time.'  },
} satisfies Record<ModuleId, {
    slot       : string,
    name       : string,
    label      : string,
    description: string,
    capacity   : number,
    power      : number,
}>

export const GOODS = {
    ore  : { name: 'iron ore'     , code: 'fe' , buy: 25, sell: 22, volume: 1, stock: 180, tint: '#d6ab61' , description: 'refined ferrous feedstock'       },
    grain: { name: 'grain'        , code: 'gr' , buy: 18, sell: 15, volume: 1, stock: 120, tint: '#9cb39a' , description: 'sealed hydroponic harvest'       },
    parts: { name: 'machine parts', code: 'mp' , buy: 90, sell: 80, volume: 2, stock: 60 , tint: '#8caac2' , description: 'precision industrial components' },
} satisfies Record<GoodId, {
    name        : string,
    code        : string,
    tint        : string,
    description : string,
    volume      : number,
    stock       : number,
    sell        : number,
    buy         : number,
}>

export interface Message {
    id      : number
    created : number
    delivers: number
    contact : string
    from    : string
    text    : string
}

export interface GameState {
    hull    : HullId
    cargo   : Record<GoodId, number>
    stock   : Record<GoodId, number>
    credits : number
    fitted  : ModuleId[]
    messages: Message[]
    log     : string[]
}

export function initialState(): GameState {
    return {
        hull    : 'freighter',
        credits : 12480,
        cargo   : { ore: 6  , grain: 0  , parts: 0  },
        stock   : { ore: 180, grain: 120, parts: 60 },
        fitted  : [ 'ansible' ],
        log     : [ 'docking collar secured · berth 04', 'local simulation ready' ],
        messages: [
            { id: 1, contact: 'station', from: 'mara'  , created: Date.now() - 120000, delivers: 0, text: 'anyone outbound to the outer depots? grain prices are climbing.' },
            { id: 2, contact: 'vesper' , from: 'vesper', created: Date.now() - 60000 , delivers: 0, text: 'ore is scarce out here. let me know what you can carry.'         },
        ],
    }
}

export function hullOf(s: GameState): Hull       { return HULLS.find(h => h.id === s.hull) ?? HULLS[ 0 ] }
export function loadOf(s: GameState): number     { return (Object.keys(GOODS) as GoodId[]).reduce((n, id) => n + s.cargo[ id ] * GOODS[ id ].volume, 0) }
export function capacityOf(s: GameState): number { return hullOf(s).capacity + (s.fitted.includes('cargo') ? 20 : 0) }
export function powerOf(s: GameState): number    { return 3 + s.fitted.reduce((n, id) => n + MODULES[ id ].power, 0) }
export function thrustOf(s: GameState): number   { return s.fitted.includes('drive') ? 0.14 : 0.1 }

export function quote(s: GameState, id: GoodId, side: 'buy' | 'sell', quantity: number) {

    const buy = side === 'buy'
    const buyMod = buy
        ?  1
        : -1

    const item   = GOODS[ id ]
    const amount = item[ side ] * quantity
    const load   = loadOf(s)
        + buyMod
        * quantity
        * item.volume

    let error = ''

    /**/ if (!Number.isSafeInteger(quantity) || quantity < 1) error = 'enter a whole quantity of at least one'
    else if (buy  && quantity > s.stock[ id ])                error = 'not enough stock at this exchange'
    else if (buy  && amount   > s.credits)                    error = 'insufficient credits'
    else if (buy  && load     > capacityOf(s))                error = 'not enough space in your hold'
    else if (!buy && quantity > s.cargo[ id ])                error = 'not enough cargo to sell'
    return {
        load,
        error,
        amount,
        credits: s.credits - (buyMod * amount),
    }
}

export function trade(s: GameState, id: GoodId, side: 'buy' | 'sell', quantity: number): GameState {
    const q = quote(s, id, side, quantity)

    assert(!q.error, q.error, 'trade')

    const delta = side === 'buy'
        ? quantity
        : -quantity

    return {
        ...s,
        credits: q.credits,
        cargo  : { ...s.cargo, [ id ]: s.cargo[ id ] + delta },
        stock  : { ...s.stock, [ id ]: s.stock[ id ] - delta },
        log    : [
            `${ side === 'buy' ? 'loaded' : 'sold' } ${ quantity } ${ GOODS[ id ].name } · ₢${ q.amount }`,
            ...s.log,
        ].slice(0, 30),
    }
}

export function fitError(s: GameState, id: ModuleId): string {
    if (s.fitted.includes(id)) {
        return id === 'cargo' && loadOf(s) > hullOf(s).capacity
            ? 'unload cargo before removing this pod'
            : ''
    }
    return powerOf(s) + MODULES[ id ].power > 8
        ? 'reactor limit exceeded · 8 power available'
        : ''
}

export function toggleModule(s: GameState, id: ModuleId): GameState {
    const e = fitError(s, id)
    assert(!e, e, 'fitting')
    const removing = s.fitted.includes(id)
    return {
        ...s,
        fitted: removing
            ? s.fitted.filter(m => m !== id)
            : [ ...s.fitted, id ],
        log: [
            `${ removing ? 'removed' : 'installed' } ${ MODULES[ id ].label }`,
            ...s.log,
        ].slice(0, 30),
    }
}

export function changeHull(s: GameState, id: HullId): GameState {
    const hull = HULLS.find(h => h.id === id)
    assert(hull, 'unknown hull', 'hull')
    if (loadOf(s) > hull.capacity + (s.fitted.includes('cargo') ? 20 : 0)) raise('unload cargo before selecting a smaller hull')
    return {
        ...s,
        hull: id,
        log: [ `previewing ${ hull.name } hull`, ...s.log ].slice(0, 30),
    }
}
