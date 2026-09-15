import * as T from 'three'
import type { ModuleId } from '../../model.ts'

/** The approved discovery study: a pressure sphere, an open spine and an isolated drive. */
export function buildDiscovery(fitted: ModuleId[] = [], selection?: ModuleId) {
    const ship = new T.Group
    ship.name = 'discovery one'
    const materials = (new Map<string, T.MeshStandardMaterial>)
    const ivory = '#deddd0', panel = '#b4b8af', frame = '#505c61', dark = '#202c34', jade = '#729e97'
    const part = (parent: T.Group, geometry: T.BufferGeometry, position: [number, number, number], color: string) => {
        let material = materials.get(color)
        if (!material) {
            material = new T.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.12, flatShading: true })
            materials.set(color, material)
        }
        const mesh = new T.Mesh(geometry, material)
        mesh.position.set(...position)
        mesh.castShadow = true
        mesh.receiveShadow = true
        parent.add(mesh)
        return mesh
    }
    const module = (id: ModuleId) => {
        const group = new T.Group
        group.name = id
        group.userData.module = id
        ship.add(group)
        return group
    }
    const cargo = module('cargo'), drive = module('drive'), comms = module('ansible')
    const beam = (start: T.Vector3, end: T.Vector3, thickness = 0.045) => {
        const delta = end.clone().sub(start)
        const bar = part(ship, new T.BoxGeometry(thickness, delta.length(), thickness), [ 0, 0, 0 ], frame)
        bar.position.copy(start).add(end).multiplyScalar(0.5)
        bar.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize())
    }
    const collar = (parent: T.Group, x: number, radius: number, color: string) => {
        const ring = part(parent, new T.CylinderGeometry(radius, radius, 0.15, 12), [ x, 0, 0 ], color)
        ring.rotation.z = Math.PI / 2
    }

    // The dark window is a curved skin over the forward hemisphere, not a floating box.
    const command = new T.Group
    command.name = 'command sphere'
    command.position.x = -5.5
    ship.add(command)
    part(command, new T.SphereGeometry(1.16, 24, 16), [ 0, 0, 0 ], ivory)
    part(command, new T.SphereGeometry(1.174, 20, 2, -1.32, 2.64, 1.36, 0.17), [ 0, 0, 0 ], dark)
    const stripe = part(command, new T.SphereGeometry(1.169, 3, 8, 1.56, 0.23, 0.77, 1.35), [ 0, 0, 0 ], jade)
    stripe.name = 'science identification panel'
    for (const z of [ -0.43, 0, 0.43 ]) {
        const hatch = part(command, new T.CylinderGeometry(0.15, 0.15, 0.08, 12), [ -0.97, -0.46, z ], frame)
        hatch.rotation.z = Math.PI / 2
        const inset = part(command, new T.CylinderGeometry(0.112, 0.112, 0.085, 12), [ -1.005, -0.46, z ], panel)
        inset.rotation.z = Math.PI / 2
    }
    const neck = part(ship, new T.CylinderGeometry(0.38, 0.48, 0.85, 12), [ -4.1, 0, 0 ], frame)
    neck.rotation.z = Math.PI / 2
    for (const x of [ -4.43, -4.1, -3.79 ]) collar(ship, x, 0.5, panel)

    // Four rails and open diagonal bays preserve negative space at catalog scale.
    for (const y of [ -0.23, 0.23 ]) {
        for (const z of [ -0.23, 0.23 ]) 
            beam(new T.Vector3(-3.75, y, z), new T.Vector3(4.7, y, z), 0.065)
    }
    for (let i = 0; i < 10; i++) {
        const x = -3.55 + i * 0.8
        for (const z of [ -0.24, 0.24 ]) {
            beam(new T.Vector3(x, -0.23, z), new T.Vector3(x + 0.72, 0.23, z))
            beam(new T.Vector3(x, -0.23, z), new T.Vector3(x, 0.23, z))
            part(cargo, new T.BoxGeometry(0.58, 0.39, 0.32), [ x + 0.25, -0.1, z * 2.25 ], ivory)
            part(cargo, new T.BoxGeometry(0.46, 0.045, 0.24), [ x + 0.25, 0.12, z * 2.25 ], panel)
            part(cargo, new T.BoxGeometry(0.2, 0.13, 0.018), [ x + 0.25, -0.1, z * 2.94 ], frame)
        }
        beam(new T.Vector3(x, 0.23, -0.23), new T.Vector3(x + 0.72, 0.23, 0.23))
    }

    // A stepped shield and equipment block separate the pressure modules from propulsion.
    for (const x of [ 4.6, 4.83 ]) collar(drive, x, 0.83, x === 4.6 ? frame : panel)
    part(drive, new T.BoxGeometry(1.18, 1.05, 1.25), [ 5.38, 0, 0 ], ivory)
    for (const z of [ -0.69, 0.69 ]) {
        part(drive, new T.BoxGeometry(0.86, 0.54, 0.18), [ 5.45, 0, z ], panel)
        for (let x = 5.12; x < 5.85; x += 0.14) 
            part(drive, new T.BoxGeometry(0.065, 0.44, 0.035), [ x, 0, z * 1.15 ], frame)
        
    }
    for (const [ y, z ] of [[ 0.37, -0.43 ], [ 0.37, 0.43 ], [ -0.38, 0 ]]) {
        const housing = part(drive, new T.CylinderGeometry(0.21, 0.25, 0.62, 10), [ 6.15, y, z ], fitted.includes('drive') ? jade : panel)
        housing.rotation.z = Math.PI / 2
        const bell = part(drive, new T.CylinderGeometry(0.36, 0.2, 0.52, 12, 1, true), [ 6.72, y, z ], frame)
        bell.rotation.z = -Math.PI / 2
        bell.material.side = T.DoubleSide
        const throat = part(drive, new T.CircleGeometry(0.2, 12), [ 6.48, y, z ], dark)
        throat.rotation.y = Math.PI / 2
    }
    part(comms, new T.BoxGeometry(0.065, 0.43, 0.065), [ -3.48, 0.5, 0 ], frame)
    const dish = part(comms, new T.ConeGeometry(0.28, 0.13, 12, 1, true), [ -3.48, 0.76, 0 ], fitted.includes('ansible') ? jade : panel)
    dish.rotation.z = -0.4
    dish.material.side = T.DoubleSide
    if (fitted.includes('cargo')) {
        part(cargo, new T.BoxGeometry(0.75, 0.35, 0.75), [ -2.42, -0.56, 0 ], jade)
        for (const z of [ -0.3, 0.3 ]) part(cargo, new T.BoxGeometry(0.82, 0.045, 0.055), [ -2.42, -0.36, z ], frame)
    }
    // Normalize length for the existing berth. Relative proportions stay unchanged.
    ship.scale.setScalar(0.72)
    if (selection) {
        const selected = selection === 'cargo' ? cargo : selection === 'drive' ? drive : comms
        const bounds = (new T.Box3).setFromObject(selected).expandByScalar(0.1)
        const helper = new T.Box3Helper(bounds, '#e6c27b')
        // Bounds were measured in world space; undo the parent scale for the local helper.
        helper.scale.setScalar(1 / 0.72)
        ship.add(helper)
    }
    return ship
}
