/**
 * the visual catalogue. the server owns the game state, see
 * `session.ts`. this file only names what the renderer can draw:
 * hull previews, the 3 visual module groups, and good swatches.
 */
export type Category = 'industrial' | 'civil'   | 'security'
export type Facility = 'exchange'   | 'drydock' | 'relay'
export type ModuleId = 'cargo'      | 'drive'   | 'ansible'
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
export const DEFAULT_HULL: HullId = 'freighter'

export function hullById(id: string): Hull & { id: HullId } {
    return HULLS.find(h => h.id === id) ?? HULLS[ 0 ]
}

/** a swatch per good. an unknown gid gets the module swatch. */
const SWATCHES: Record<string, { code: string, tint: string }> = {
    ore  : { code: 'fe', tint: '#d6ab61' },
    grain: { code: 'gr', tint: '#9cb39a' },
    spice: { code: 'sp', tint: '#c98ad6' },
}

export function swatch(gid: string) {
    return SWATCHES[ gid ] ?? { code: gid.slice(0, 2), tint: '#8caac2' }
}
