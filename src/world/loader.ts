import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { paint } from './paint.ts'

const gltf = new GLTFLoader
const cache = new Map<string, Promise<T.Object3D>>

/**
 * a painted model by its path in `models/`: `painted/far-treasure`, or
 * a kit's `.gltf` by its full name. `look` dresses it: the painted look,
 * or the toy look.
 * one fetch each; a failed fetch leaves the cache, so the next call retries.
 * an instance shares geometry and materials. a blinking lamp gets its own.
 */
export function model(id: string, look: (root: T.Object3D) => T.Object3D = paint): Promise<T.Object3D> {
    const key = `${ look.name } ${ id }`
    let found = cache.get(key)
    if (!found) {
        found = gltf.loadAsync(`${ import.meta.env.BASE_URL }models/${ /\.gltf$/.test(id) ? id : `${ id }.glb` }`).then(g => look(g.scene))
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
