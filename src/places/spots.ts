import * as T from 'three'

const PLACES: Record<string, RegExp> = {
    exchange: /exchange|market|trade|bazaar/,
    rigging : /rig|workshop|yard|chandler|hangar/,
    comms   : /comm|mail|relay|signal|radio/,
}

/**
 * where each place's label stands on a station: its `spot_<place>`
 * empty, else a hall whose name fits the place, else the free hall
 * nearest the berth. world points, on the hall's roof.
 */
export function spots(station: T.Object3D, berth: T.Vector3) {
    const halls: T.Object3D[] = []
    station.updateMatrixWorld(true)
    station.traverse(o => { if (o.userData.hall_size) halls.push(o) })
    const near = (h: T.Object3D) => roof(h).distanceTo(berth)
    halls.sort((a, b) => near(a) - near(b))
    return Object.entries(PLACES).map(([ place, fits ]) => {
        const empty = station.getObjectByName(`spot_${ place }`)
        const hall = halls.find(h => fits.test(h.name)) ?? halls[ 0 ]
        if (hall) halls.splice(halls.indexOf(hall), 1)
        return { place, at: empty ? empty.getWorldPosition(new T.Vector3) : hall && roof(hall) }
    }).filter(s => s.at) as { place: string, at: T.Vector3 }[]
}

function roof(o: T.Object3D) {
    const b = (new T.Box3).setFromObject(o)
    return new T.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)
}
