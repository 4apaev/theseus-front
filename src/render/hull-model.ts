import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Hull, ModuleId } from '../model.ts'
import { Fail } from '../util.ts'

const loader = new GLTFLoader
const cache = new Map<string, Promise<T.Group>>

function source(path: string): Promise<T.Group> {
    const found = cache.get(path)
    if (found) return found

    const pending = fetch(`${ import.meta.env.BASE_URL }models/${ path }`)
        .then(response => {
            if (!response.ok) throw new Fail(`hull model could not be loaded: ${ path }`, 'hull-load')
            return response.arrayBuffer()
        })
        .then(buffer => loader.parseAsync(buffer, ''))
        .then(asset => asset.scene)

    cache.set(path, pending)
    return pending
}

function independent(source: T.Group): T.Group {
    const result = source.clone(true)
    result.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        object.geometry = object.geometry.clone()
        object.material = Array.isArray(object.material)
            ? object.material.map(material => material.clone())
            : object.material.clone()
        object.castShadow = true
        object.receiveShadow = true
    })
    return result
}

function moduleGroup(ship: T.Group, id: ModuleId): T.Object3D | undefined {
    const names = id === 'ansible' ? [ 'comms', 'comms_1' ] : [ id, `${ id }_1` ]
    return names.map(name => ship.getObjectByName(name)).find(Boolean)
}

/** load, normalize and annotate one exported blender hull for interaction. */
export async function loadHullModel(hull: Hull, selection?: ModuleId): Promise<T.Group> {
    const ship = independent(await source(hull.model))
    ship.name = hull.name

    const bounds = (new T.Box3).setFromObject(ship)
    const center = bounds.getCenter(new T.Vector3)
    const size = bounds.getSize(new T.Vector3)
    const target = hull.kind === 'colony' ? 10 : hull.kind === 'battleship' ? 9 : hull.kind === 'corvette' ? 6.5 : 7.5
    const scale = target / Math.max(size.x, .001)

    ship.position.sub(center)
    ship.scale.setScalar(scale)
    ship.updateMatrixWorld(true)

    for (const id of [ 'cargo', 'drive', 'ansible' ] as ModuleId[]) {
        const group = moduleGroup(ship, id)
        if (group) group.userData.module = id
    }

    if (selection) {
        const selected = moduleGroup(ship, selection)
        if (selected) {
            const selectedBounds = (new T.Box3).setFromObject(selected).expandByScalar(.12)
            ship.add(new T.Box3Helper(selectedBounds, new T.Color('#e6c27b')))
        }
    }
    return ship
}
