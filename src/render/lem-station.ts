import * as T from 'three'
import type { View } from '../model.ts'
import { assert } from '../util.ts'

export const FACILITIES = [
    { id: 'rig', name: 'repair berth', anchor: 'socket_berth', note: 'berth 04 / available', description: 'fit modules, balance power, and prepare your next departure.', action: 'enter rigging' },
    { id: 'market', name: 'market hall', anchor: 'socket_market', note: 'second orbit / open', description: 'cargo, provisions, and equipment with a previous life.', action: 'visit the market' },
    { id: 'comms', name: 'signals office', anchor: 'socket_comms', note: 'local & private channels', description: 'leave a message, find a trader, or listen to the station channel.', action: 'open comms' },
] as const satisfies readonly { id: View, name: string, anchor: string, note: string, description: string, action: string }[]

export type StationFacility = typeof FACILITIES[ number ][ 'id' ]

export function facilityOf(object: T.Object3D | null): StationFacility | undefined {
    while (object) {
        const id = object.userData.facility
        if (FACILITIES.some(f => f.id === id)) return id
        object = object.parent
    }
}

/** Validate the export contract before exposing an interactive station. */
export function prepareStation(root: T.Group) {
    const facilities = FACILITIES.map(facility => {
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
    return { facilities, lamps }
}
