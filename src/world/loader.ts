import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { paint } from './paint.ts'

const gltf = new GLTFLoader
const cache = new Map<string, Promise<T.Object3D>>

/**
 * a painted model by its path in `models/`: `painted/far-treasure`.
 * one fetch each; a failed fetch leaves the cache, so the next call retries.
 * an instance shares geometry and materials. a blinking lamp gets its own.
 */
export function model(id: string): Promise<T.Object3D> {
    let found = cache.get(id)
    if (!found) {
        found = gltf.loadAsync(`${ import.meta.env.BASE_URL }models/${ id }.glb`).then(g => paint(g.scene))
        cache.set(id, found)
        found.catch(() => cache.delete(id))
    }
    return found.then(instance)
}

function instance(src: T.Object3D) {
    const copy = src.clone(true)
    copy.traverse(o => {
        if (o.userData.blink && o instanceof T.Sprite) o.material = o.material.clone()
    })
    return copy
}
