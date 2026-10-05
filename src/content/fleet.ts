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
}

export const NPC = Object.keys(HULLS).filter(h => !h.startsWith('far-treasure'))

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
