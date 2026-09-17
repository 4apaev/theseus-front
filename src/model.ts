import { assert, raise } from './util.ts'

/** domain data has no dependency on lit, three.js or browser globals. */
export type Category = 'industrial' | 'civil'   | 'security'
export type Facility = 'exchange'   | 'drydock' | 'relay'
export type ModuleId = 'cargo'      | 'drive'   | 'ansible'
export type GoodId   = 'ore'        | 'grain'   | 'parts'
export type View     = 'port'       | 'rig'     | 'market' | 'comms'  | 'orbit' | 'map'
export type HullKind = 'freighter' | 'tanker' | 'tug' | 'colony' | 'liner' | 'transport' | 'yacht' | 'research' | 'battleship' | 'frigate' | 'corvette' | 'prison'

export interface Hull {
    id      : string
    name    : string
    kind    : HullKind
    model   : string
    purpose : string
    capacity: number
    category: Category
    family? : 'research'
}

const HULL_DATA = [
    { id: 'freighter'  , name: 'honest weight'       , kind: 'freighter'  , model: 'fleet/honest-weight.glb'       , category: 'industrial', purpose: 'modular cargo hauling'            , capacity: 40  },
    { id: 'freighter-2', name: 'general delivery'    , kind: 'freighter'  , model: 'fleet/general-delivery.glb'    , category: 'industrial', purpose: 'container route work'             , capacity: 44  },
    { id: 'freighter-3', name: 'long ton'            , kind: 'freighter'  , model: 'fleet/long-ton.glb'            , category: 'industrial', purpose: 'independent heavy freight'        , capacity: 52  },
    { id: 'tanker'     , name: 'patient cargo'       , kind: 'tanker'     , model: 'industrial/patient-cargo.glb'  , category: 'industrial', purpose: 'bulk propellant delivery'         , capacity: 24  },
    { id: 'tanker-2'   , name: 'amber reserve'       , kind: 'tanker'     , model: 'fleet/amber-reserve.glb'       , category: 'industrial', purpose: 'cryogenic liquid carriage'        , capacity: 28  },
    { id: 'tanker-3'   , name: 'borrowed rain'       , kind: 'tanker'     , model: 'fleet/borrowed-rain.glb'       , category: 'industrial', purpose: 'water and volatile transport'     , capacity: 32  },
    { id: 'tug'        , name: 'small mercy'         , kind: 'tug'        , model: 'fleet/small-mercy.glb'         , category: 'industrial', purpose: 'recovery and towing'              , capacity: 16  },
    { id: 'tug-2'      , name: 'yard dog'            , kind: 'tug'        , model: 'fleet/yard-dog.glb'            , category: 'industrial', purpose: 'dock and construction work'       , capacity: 14  },
    { id: 'tug-3'      , name: 'last purchase'       , kind: 'tug'        , model: 'fleet/last-purchase.glb'       , category: 'industrial', purpose: 'salvage and emergency tow'        , capacity: 18  },
    { id: 'colony'     , name: 'garden debt'         , kind: 'colony'     , model: 'industrial/garden-debt.glb'    , category: 'industrial', purpose: 'terraforming colony ark'          , capacity: 120 },
    { id: 'colony-2'   , name: 'first weather'       , kind: 'colony'     , model: 'fleet/first-weather.glb'       , category: 'industrial', purpose: 'atmosphere works and settlement'  , capacity: 132 },
    { id: 'colony-3'   , name: 'borrowed sea'        , kind: 'colony'     , model: 'fleet/borrowed-sea.glb'        , category: 'industrial', purpose: 'ocean seed and habitat carrier'   , capacity: 144 },
    { id: 'liner'      , name: 'wandering ward vii' , kind: 'liner'      , model: 'civil/wandering-ward.glb'      , category: 'civil'     , purpose: 'inhabited market liner'             , capacity: 48  },
    { id: 'liner-2'    , name: 'evening post'        , kind: 'liner'      , model: 'fleet/evening-post.glb'        , category: 'civil'     , purpose: 'scheduled interplanetary passage' , capacity: 52  },
    { id: 'liner-3'    , name: 'continental service', kind: 'liner'      , model: 'fleet/continental-service.glb' , category: 'civil'     , purpose: 'long-route passenger service'     , capacity: 56  },
    { id: 'transport'  , name: 'short notice'        , kind: 'transport'  , model: 'fleet/short-notice.glb'        , category: 'civil'     , purpose: 'short-range passenger transfer'   , capacity: 24  },
    { id: 'transport-2', name: 'local arrangement'   , kind: 'transport'  , model: 'fleet/local-arrangement.glb'   , category: 'civil'     , purpose: 'orbital taxi and station shuttle' , capacity: 20  },
    { id: 'transport-3', name: 'nine seats'          , kind: 'transport'  , model: 'fleet/nine-seats.glb'          , category: 'civil'     , purpose: 'private commuter service'         , capacity: 12  },
    { id: 'yacht'      , name: 'sunday catch'        , kind: 'yacht'      , model: 'civil/sunday-catch.glb'        , category: 'civil'     , purpose: 'restored fishing yacht'           , capacity: 16  },
    { id: 'yacht-2'    , name: 'blue hour'           , kind: 'yacht'      , model: 'fleet/blue-hour.glb'           , category: 'civil'     , purpose: 'private passage'                  , capacity: 14  },
    { id: 'yacht-3'    , name: 'private weather'     , kind: 'yacht'      , model: 'fleet/private-weather.glb'     , category: 'civil'     , purpose: 'bespoke long-range cruiser'       , capacity: 18  },
    { id: 'research'   , name: 'the hypothesis'      , kind: 'research'   , model: 'research/the-hypothesis.glb'   , category: 'civil'     , purpose: 'survey and field science'         , capacity: 24, family: 'research' },
    { id: 'discovery'  , name: 'discovery one'       , kind: 'research'   , model: 'fleet/discovery-one.glb'       , category: 'civil'     , purpose: 'long-duration expedition'         , capacity: 24, family: 'research' },
    { id: 'research-3' , name: 'useful doubt'        , kind: 'research'   , model: 'fleet/useful-doubt.glb'        , category: 'civil'     , purpose: 'replaceable laboratory platform'  , capacity: 28, family: 'research' },
    { id: 'battleship' , name: 'final authority'     , kind: 'battleship' , model: 'fleet/final-authority.glb'     , category: 'security'  , purpose: 'fleet combat'                     , capacity: 48  },
    { id: 'battleship-2', name: 'long memory'        , kind: 'battleship' , model: 'fleet/long-memory.glb'         , category: 'security'  , purpose: 'endurance and area denial'        , capacity: 52  },
    { id: 'battleship-3', name: 'public reason'      , kind: 'battleship' , model: 'fleet/public-reason.glb'       , category: 'security'  , purpose: 'command and heavy escort'         , capacity: 44  },
    { id: 'frigate'    , name: 'common defense'      , kind: 'frigate'    , model: 'fleet/common-defense.glb'      , category: 'security'  , purpose: 'escort and patrol'                , capacity: 24  },
    { id: 'frigate-2'  , name: 'patient vector'      , kind: 'frigate'    , model: 'fleet/patient-vector.glb'      , category: 'security'  , purpose: 'convoy screen and interception'  , capacity: 22  },
    { id: 'frigate-3'  , name: 'iron clause'         , kind: 'frigate'    , model: 'fleet/iron-clause.glb'         , category: 'security'  , purpose: 'modular patrol combatant'         , capacity: 26  },
    { id: 'corvette'   , name: 'quiet argument'      , kind: 'corvette'   , model: 'military/quiet-argument.glb'   , category: 'security'  , purpose: 'fast interception'                , capacity: 16  },
    { id: 'corvette-2' , name: 'necessary force'     , kind: 'corvette'   , model: 'fleet/necessary-force.glb'     , category: 'security'  , purpose: 'close patrol and customs action' , capacity: 14  },
    { id: 'corvette-3' , name: 'last warning'        , kind: 'corvette'   , model: 'fleet/last-warning.glb'        , category: 'security'  , purpose: 'pursuit and point defense'        , capacity: 12  },
    { id: 'prison'     , name: 'county line'         , kind: 'prison'     , model: 'civil/county-line.glb'         , category: 'security'  , purpose: 'secure custody transfer'          , capacity: 48  },
    { id: 'prison-2'   , name: 'due process'         , kind: 'prison'     , model: 'fleet/due-process.glb'         , category: 'security'  , purpose: 'provincial corrections transport', capacity: 44  },
    { id: 'prison-3'   , name: 'closed circuit'      , kind: 'prison'     , model: 'fleet/closed-circuit.glb'      , category: 'security'  , purpose: 'high-security detention barge'   , capacity: 52  },
] as const satisfies readonly Hull[]

export type HullId = typeof HULL_DATA[ number ][ 'id' ]
export const HULLS: readonly (Hull & { id: HullId })[] = HULL_DATA

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
