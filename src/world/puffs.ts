import * as T from 'three'
import { raw } from './paint.ts'
import { hex } from './toy.ts'

const LIFE = 2.4

/** sam's bubble clusters, the pictures of a puff. */
export const puffs = () => Array.from({ length: 6 }, (_, i) => `${ import.meta.env.BASE_URL }art/toy/sprites/puff-${ i + 1 }.webp`)

type Puff = { m: T.Sprite, age: number, v: T.Vector3 }

/**
 * bubble exhaust, the toy look's drive: bubble clusters blown from the
 * nozzles while the drive burns. a puff stays where it is blown and
 * drifts back from its nozzle, so a moving ship leaves a tail of them. it
 * swells, holds, then fades. puffs live beside the ship, in its parent,
 * and go when the ship goes.
 */
export class Puffs {
    private readonly nozzles: T.Object3D[]
    private readonly color: T.Color
    private readonly maps: T.Texture[]
    private readonly blown: Puff[] = []
    private due = 0

    /** `maps`: the pictures a puff picks from; none, a plain square. */
    constructor(nozzles: T.Object3D[], color: string, maps: T.Texture[] = []) {
        this.nozzles = nozzles
        this.color   = raw(hex(color))
        this.maps    = maps
    }

    /** `burn` 0 to 1: how hard the drive blows. */
    tick(dt: number, burn: number, parent: T.Object3D | null) {
        this.due += dt * 14 * burn
        for (; this.due >= 1 && parent; this.due--) this.nozzles.forEach(n => this.blow(n, parent))
        for (const b of this.blown) {
            const k = (b.age += dt) / LIFE
            b.m.position.addScaledVector(b.v, dt)
            b.m.scale.setScalar(b.m.userData.size * (.6 + k * 1.4))
            b.m.material.opacity = Math.min(1, (1 - k) * 2.5)
            b.m.material.rotation += dt * b.m.userData.spin
        }
        // the oldest first: they go as they fade out
        while ((this.blown[ 0 ]?.age ?? 0) > LIFE) gone(this.blown.shift())
    }

    /** every puff goes at once: the ship left the scene. */
    clear() {
        this.blown.splice(0).forEach(gone)
        this.due = 0
    }

    private blow(nozzle: T.Object3D, parent: T.Object3D) {
        const map = this.maps[ Math.floor(Math.random() * this.maps.length) ]
        const m = new T.Sprite(new T.SpriteMaterial({ map, color: this.color, transparent: true, depthWrite: false, rotation: Math.random() * Math.PI * 2 }))
        const size = (nozzle.userData.radius ?? 3) * nozzle.getWorldScale(new T.Vector3).x
        const at = nozzle.getWorldPosition(new T.Vector3).add(new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(size * .6))
        m.position.copy(parent.worldToLocal(at))
        m.userData = { size: size * 2.2, spin: Math.random() - .5 }
        parent.add(m)
        // back along the hull, out of the nozzle: the ship's -x
        const back = new T.Vector3(-1, 0, 0).applyQuaternion(nozzle.getWorldQuaternion(new T.Quaternion)).multiplyScalar(size * 6)
        this.blown.push({ m, age: 0, v: back })
    }
}

// a puff off the stage, its own material freed
function gone(b?: Puff) {
    b?.m.removeFromParent()
    b?.m.material.dispose()
}
