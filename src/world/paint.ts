import * as T from 'three'
import { SUN } from './sky.ts'

/*
    the scene's shared basics: colours as written, the lights, the
    lamps that blink and the parts that spin, a seeded random. colours
    stay raw: the stage does no colour management.
*/

/** a hex as written, unconverted. */
export const raw = (hex: number) => (new T.Color).setHex(hex, T.LinearSRGBColorSpace)

/** one pass over a model: lamps blink, parts spin. */
export function liven(root: T.Object3D, t: number, dt: number) {
    root.traverse(o => {
        const u = o.userData
        if (u.blink && o instanceof T.Sprite) o.material.opacity = Math.sin((t / u.blink + u.phase) * Math.PI * 2) > .2 ? .95 : .05
        if (u.spin) o.rotation.y += u.spin * dt
    })
}

/** the warm key from the sun, a cool rim, a sky and ground fill. */
export function lights(scene: T.Scene) {
    const key = new T.DirectionalLight(raw(0xffe2b8), 2.3)
    const rim = new T.DirectionalLight(raw(0x7fb0ff), .9)
    key.position.copy(SUN).multiplyScalar(10)
    rim.position.set(5, 2, -6)
    scene.add(new T.HemisphereLight(raw(0xa8bde0), raw(0x4a3826), 1.6), key, rim)
}

/** a random from a seed: the same seed, the same numbers. */
export function rng(seed: number) {
    return () => {
        seed = seed + 0x6D2B79F5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}
