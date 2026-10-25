/**
 * the ships at a port. a hull is sam's toy model in `models/toy/` and
 * its length in metres: the client scales the model to that length, so
 * a hull built in any unit fits. players fly the cargo ship; the npc
 * ships fly every hull.
 */
export const HULLS: Record<string, number> = {
    'toy/ship-cargo'     : 70,
    'toy/ship-military'  : 90,
    'toy/ship-industrial': 80,
    'toy/ship-research'  : 75,
    'toy/ship-tanker'    : 110,
    'toy/ship-liner'     : 130,
    'toy/ship-tug'       : 45,
    'toy/ship-police-cutter': 55,
    'toy/ship-raider'    : 65,
    'toy/ship-courier'   : 50,
    'toy/ship-cold-storage': 100,
    'toy/ship-livestock' : 100,
    'toy/ship-gas-carrier': 110,
    'toy/ship-liquid-tanker': 120,
    'toy/ship-container-ship': 130,
    'toy/ship-ore-carrier': 120,
    'toy/ship-asteroid-barge': 110,
    'toy/ship-iceberg-tug': 90,
    'toy/ship-refueller' : 70,
    'toy/ship-repair-tender': 70,
}

/** who flies what: players the cargo ship, npc ships every hull. */
export const fleet = { player: 'toy/ship-cargo', npc: Object.keys(HULLS) }

/** the modules of each socket family. an empty mount is a choice too. */
export const MODULES: Record<string, string[]> = {
    power   : [ 'reactor.mk1', 'reactor.mk2' ],
    cruise  : [ 'cruise.mk1', 'cruise.mk2' ],
    maneuver: [ 'maneuver.mk1', 'maneuver.mk2' ],
    cargo   : [ 'cargo.mk1', 'cargo.mk2', 'cargo.tank', 'cargo.reefer', 'cargo.pen' ],
    utility : [ 'ansible.mk1', 'radar.mk1', 'driver.mk1' ],
}

/** a seed from a text: the same sid gives the same ship every visit. */
export function seedOf(text: string) {
    let h = 0x811c9dc5
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
    return h >>> 0
}
