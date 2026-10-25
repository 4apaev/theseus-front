import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { toy } from './toy.ts'

/** the models in flight: `onLoading` hears the share loaded, 1 when all are in. */
export const loads = new T.LoadingManager
const gltf = new GLTFLoader(loads).setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<string, Promise<T.Object3D>>

/**
 * a model by its path in `models/`: `toy/ship-cargo`. `look` dresses
 * it: the toy look, or the model as built.
 * one fetch each; a failed fetch leaves the cache, so the next call retries.
 * an instance shares geometry and materials. a blinking lamp gets its own.
 */
export function model(id: string, look: (root: T.Object3D) => T.Object3D = toy): Promise<T.Object3D> {
    const key = `${ look.name } ${ id }`
    let found = cache.get(key)
    if (!found) {
        found = gltf.loadAsync(`${ import.meta.env.BASE_URL }models/${ id }.glb`).then(g => look(g.scene))
        cache.set(key, found)
        found.catch(() => cache.delete(key))
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
