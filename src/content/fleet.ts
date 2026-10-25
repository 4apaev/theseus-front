/**
 * the ships at a port. a hull is its model in `models/painted/` and its
 * length in metres: the client scales the model to that length, so a
 * hull built in any unit fits. players fly the far treasure; the npc
 * ships fly the rest.
 */
export const HULLS: Record<string, number> = {
    'far-treasure'       : 70,
    'far-treasure-b'     : 70,
    hauler               : 130,
    nobody               : 60,
    'patrol-cutter'      : 40,
    tug                  : 30,
    'hangar/freighter'   : 140,
    'hangar/tanker'      : 150,
    'hangar/liner'       : 170,
    'hangar/transport'   : 90,
    'hangar/colony'      : 200,
    'hangar/research'    : 110,
    'hangar/corvette'    : 60,
    'hangar/frigate'     : 120,
    'hangar/battleship'  : 260,
    'hangar/prison'      : 150,
    'hangar/yacht'       : 40,
    'hangar/tug'         : 35,
    'hangar/police-light': 45,
    'hangar/police-heavy': 90,
    'hangar/police-patrol': 50,
    'hangar/police-inspector': 40,
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

export const NPC = Object.keys(HULLS).filter(h => !/^(far-treasure|toy\/)/.test(h))

/** who flies what: players a far treasure, npc ships the rest. */
export const fleet = { player: 'far-treasure', npc: NPC }

/** the toy look flies sam's 4 toy ships; players fly the cargo ship. */
export function toyFleet() {
    Object.assign(fleet, { player: 'toy/ship-cargo', npc: Object.keys(HULLS).filter(h => h.startsWith('toy/')) })
}

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
