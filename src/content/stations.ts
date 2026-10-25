import { SKINS } from './skins.ts'

/**
 * how a station looks from space: its model, the planet below it, the
 * sun of its system. a model is one of sam's 9 painted kits; it carries
 * its own `berth` for the ship and `walk_*` points for the deck robots.
 * a planet is a map in `art/planets/`, a sun a class in `art/suns/`.
 */
export interface View {
    model : string
    planet: string
    sun   : string
}

const KITS: Record<string, string[]> = {
    outpost: [ 'sol.outpost' ],
    yards  : [ 'sol.ganymede' ],
    hub    : [ 'sol.mars', 'alpha.exchange' ],
    lab    : [ 'sol.venus', 'wolf.solaris' ],
    gate   : [ 'sirius.gate', 'ran.gate', 'procyon.gate', 'lalande.gate' ],
    dock   : [ 'barnards.rama', 'barnards.port', 'procyon.bebop', 'lalande.qeng' ],
    gas    : [ 'sol.titan', 'ran.aegir' ],
    mine   : [ 'sol.mercury', 'procyon.ember', 'sirius.technora' ],
    relay  : [ 'wolf.reach', 'ran.rorschach', 'ross.beacon', 'lacaille.relay' ],
}

// sol's stations orbit their own worlds; elsewhere one world per system
const SOL: Record<string, string> = {
    'sol.mercury' : 'mercury',
    'sol.venus'   : 'venus',
    'sol.outpost' : 'earth',
    'sol.mars'    : 'mars',
    'sol.ganymede': 'jupiter',
    'sol.titan'   : 'saturn',
}

// the toy look's small world for each kit: sam's sprites in `art/toy/sprites/`
const TOY: Record<string, string> = { outpost: 'market', yards: 'ship-yard', hub: 'market', lab: 'lab', gate: 'relay', dock: 'ship-yard', gas: 'gas-skimmer', mine: 'mine', relay: 'relay' }

// each kind of station wears its own skin, after sam's renders, so a port tells at a glance which kind it is
const SKINNED: Record<string, string> = { outpost: 'sunny', hub: 'sunny', yards: 'coral', dock: 'coral', lab: 'ice', gate: 'grape', relay: 'grape', gas: 'mint', mine: 'rust' }

/** the skin of a station's kind. */
export const skinOf = (stid: string) => SKINS[ SKINNED[ kitOf(stid) ] ] ?? {}

export const kitOf = (stid: string) => Object.keys(KITS).find(k => KITS[ k ].includes(stid)) ?? 'outpost'

/** the toy look's model of a station: its kind's own, sam's `station-<kind>`. */
export const toyStationOf = (stid: string) => `toy/station-${ TOY[ kitOf(stid) ] }`

/** the toy look's picture of a station: a small world, seen from above. */
export const worldOf = (stid: string) => `${ import.meta.env.BASE_URL }art/toy/sprites/station-${ TOY[ kitOf(stid) ] }.webp`

/** `star` is the system's spectral type: `G2V yellow dwarf`. */
export function viewOf(stid: string, sysid: string, star: string): View {
    const kit = kitOf(stid)
    return {
        model : `painted/stations/${ kit }`,
        planet: SOL[ stid ] ?? sysid.replace(/\.\d+$/, '').replace('.', '-'),
        sun   : star[ 0 ].toLowerCase(),
    }
}
