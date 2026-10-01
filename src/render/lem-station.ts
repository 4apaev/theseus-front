import * as T from 'three'
import type { View } from '../model.ts'
import { assert } from '../util.ts'

/**
 * the station models and their runtime contract. every export carries
 * `rig`, `market` and `comms` groups, one label socket per group,
 * a `beacons` group of emissive lamps, and a `dish_pivot` with one
 * scan clip. the game's station ids map onto the 2 models here.
 */
export type StationFacility = 'rig' | 'market' | 'comms'
type StationModelId = 'lem' | 'many-hands'

export interface Facility {
    id         : StationFacility
    name       : string
    anchor     : string
    note       : string
    description: string
    action     : string
}

export interface StationModel {
    id        : StationModelId
    file      : string
    kind      : string
    facilities: readonly Facility[]
}

const LEM_FACILITIES = [
    { id: 'rig', name: 'repair berth', anchor: 'socket_berth', note: 'berth 04 / available', description: 'fit modules, balance power, and prepare your next departure.', action: 'enter rigging' },
    { id: 'market', name: 'market hall', anchor: 'socket_market', note: 'hall 02 / open', description: 'cargo, provisions, and equipment with a previous life.', action: 'visit the market' },
    { id: 'comms', name: 'signals office', anchor: 'socket_comms', note: 'local & private channels', description: 'leave a message, find a trader, or listen to the station channel.', action: 'open comms' },
] as const satisfies readonly (Facility & { id: View })[]

const MANY_HANDS_FACILITIES = [
    { id: 'rig', name: 'arrivals berth', anchor: 'socket_berth', note: 'docking ring / clear', description: 'the arrivals arm takes visiting hulls. refit, rename, and depart from here.', action: 'enter rigging' },
    { id: 'market', name: 'freight exchange', anchor: 'socket_market', note: 'spine deck / open', description: 'containers, fuel, and packaged modules move along the freight spine.', action: 'visit the exchange' },
    { id: 'comms', name: 'research relay', anchor: 'socket_comms', note: 'lab array / listening', description: 'the laboratory array relays private signals and carries the station channel.', action: 'open comms' },
] as const satisfies readonly Facility[]

export const STATIONS: Record<StationModelId, StationModel> = {
    lem         : { id: 'lem', file: 'stations/lem-station.glb', kind: 'observatory / trading port', facilities: LEM_FACILITIES },
    'many-hands': { id: 'many-hands', file: 'stations/port-of-many-hands.glb', kind: 'system gateway / trading port', facilities: MANY_HANDS_FACILITIES },
}

// the gateway of each system, and the sol hub, are large ports. the rest are lem-class outposts.
const HUBS = new Set([ 'sol.mars', 'alpha.exchange', 'barnards.port', 'wolf.reach', 'sirius.gate' ])

export function stationModel(stid?: string): StationModel {
    return stid && HUBS.has(stid)
        ? STATIONS[ 'many-hands' ]
        : STATIONS.lem
}

const FACILITY_IDS = new Set<string>([ 'rig', 'market', 'comms' ])

function isFacility(id: unknown): id is StationFacility {
    return typeof id === 'string' && FACILITY_IDS.has(id)
}

/** the facility a picked mesh belongs to, walking up to the group that names it. */
export function facilityOf(object?: T.Object3D | null): StationFacility | undefined {
    while (object) {
        const id = object.userData.facility
        if (isFacility(id)) return id
        object = object.parent
    }
}

/** Validate the export contract before exposing an interactive station. */
export function prepareStation(root: T.Group, facilities: readonly Facility[] = LEM_FACILITIES) {
    const prepared = facilities.map(facility => {
        const group = root.getObjectByName(facility.id)
        const anchor = root.getObjectByName(facility.anchor)
        assert(group && anchor, `station asset is missing ${ facility.id }`, 'station-asset')
        group.userData.facility = facility.id
        const outlines: T.LineSegments[] = []
        const meshes: T.Mesh[] = []
        group.traverse(object => { if (object instanceof T.Mesh) meshes.push(object) })
        meshes.forEach(mesh => {
            const line = new T.LineSegments(new T.EdgesGeometry(mesh.geometry, 32), new T.LineBasicMaterial({ color: '#e4bc75', transparent: true, opacity: 0.85 }))
            line.visible = false
            line.raycast = () => {}
            mesh.add(line)
            outlines.push(line)
        })
        return { ...facility, group, anchor, outlines }
    })
    root.traverse(object => {
        if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true
    })
    const beacons = root.getObjectByName('beacons')
    assert(beacons && root.getObjectByName('dish_pivot'), 'station asset is missing moving parts', 'station-asset')
    const lamps: T.MeshStandardMaterial[] = []
    beacons.traverse(object => {
        if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial) {
            if (lamps.includes(object.material)) object.material = object.material.clone()
            lamps.push(object.material)
        }
    })
    return { facilities: prepared, lamps }
}
