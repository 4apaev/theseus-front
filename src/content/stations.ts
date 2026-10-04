/**
 * how a station looks from space: its model, the planet below it, the
 * sun of its system. `size` is the station's span in metres, for the
 * camera; the ship waits at `berth`. every station shows the lem station
 * until the painted station models land.
 * a planet is a map in `art/planets/`, a sun a class in `art/suns/`.
 */
export interface View {
    model : string
    scale : number
    size  : number
    berth : [ number, number, number ]
    planet: string
    sun   : string
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
    return {
        model : 'stations/lem-station',
        scale : 2.5,
        size  : 34,
        berth : [ 0, -1, 15 ],
        planet: SOL[ stid ] ?? sysid.replace(/\.\d+$/, '').replace('.', '-'),
        sun   : star[ 0 ].toLowerCase(),
    }
}
