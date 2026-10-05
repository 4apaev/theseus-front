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

/** `star` is the system's spectral type: `G2V yellow dwarf`. */
export function viewOf(stid: string, sysid: string, star: string): View {
    const kit = Object.keys(KITS).find(k => KITS[ k ].includes(stid)) ?? 'outpost'
    return {
        model : `painted/stations/${ kit }`,
        planet: SOL[ stid ] ?? sysid.replace(/\.\d+$/, '').replace('.', '-'),
        sun   : star[ 0 ].toLowerCase(),
    }
}
