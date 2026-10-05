import * as T from 'three'
import type { FittedSlot } from '../core/transport/types.ts'
import { MODULES } from '../content/fleet.ts'
import { model } from './loader.ts'
import { glow, liven, rng } from './paint.ts'

/**
 * a hull and its rig. the glb has a socket per slot; the extras name the
 * slot and the family. a module glb sits on its socket, an empty slot
 * shows a bare mount. a fit reloads only the slots that changed. the
 * hull scales to its length in metres, whatever unit it was built in.
 */
export class Ship {
    readonly group = new T.Group
    readonly ready: Promise<void>
    worn: FittedSlot[] = []
    private readonly sockets = new Map<string, T.Object3D>
    private readonly shown = new Map<string, string>
    private flame?: T.Sprite

    constructor(name = 'far-treasure', metres = 70) {
        this.ready = model(`painted/${ name }`).then(hull => {
            hull.traverse(o => { if (o.userData.slot) this.sockets.set(o.userData.slot, o) })
            // the belly rests on the group's origin, the middle of the hull above it
            const box = (new T.Box3).setFromObject(hull)
            const size = box.getSize(new T.Vector3)
            hull.position.x -= (box.min.x + box.max.x) / 2
            hull.position.y -= box.min.y
            this.group.scale.setScalar(metres / Math.max(size.x, size.y, size.z))
            this.flame = glow(0xffc27a, size.y * 1.6)
            this.flame.position.set(-size.x / 2, size.y / 2, 0)
            this.flame.material.opacity = 0
            this.group.add(hull, this.flame)
        })
    }

    async fit(rig: FittedSlot[]) {
        await this.ready
        this.worn = rig.filter(f => this.sockets.has(f.slot))
        await Promise.all([ ...this.sockets ].map(([ slot, socket ]) => {
            const gid = rig.find(f => f.slot === slot)?.gid
            return this.mount(slot, socket, gid ? gid.replace('.', '-') : `empty-${ socket.userData.family }`)
        }))
    }

    /** a random rig, the same for the same seed. a slot may stay empty. */
    async dress(seed: number) {
        await this.ready
        const r = rng(seed)
        const pick = (all: string[]) => all[ Math.floor(r() * (all.length + 1)) ]
        const rig = [ ...this.sockets ].map(([ slot, s ]) => ({ slot, gid: pick(MODULES[ s.userData.family ] ?? []) }))
        return this.fit(rig.filter(f => f.gid))
    }

    /** the drive's glow at the stern, 0 to 1. */
    burn(k: number) {
        if (this.flame) this.flame.material.opacity = k * .9
    }

    tick(t: number, dt: number) {
        liven(this.group, t, dt)
    }

    private async mount(slot: string, socket: T.Object3D, id: string) {
        if (this.shown.get(slot) === id) return
        this.shown.set(slot, id)
        const m = await model(`painted/modules/${ id }`)
        // a later fit of the same slot wins
        if (this.shown.get(slot) === id) socket.clear().add(m)
    }
}
