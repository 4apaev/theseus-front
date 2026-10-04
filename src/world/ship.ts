import * as T from 'three'
import type { FittedSlot } from '../core/transport/types.ts'
import { model } from './loader.ts'
import { liven } from './paint.ts'

/**
 * the far treasure. its glb has a socket per slot; the extras name the
 * slot and the family. a module glb sits on its socket, an empty slot
 * shows a bare mount. a fit reloads only the slots that changed.
 */
export class Ship {
    readonly group = new T.Group
    private readonly sockets = new Map<string, T.Object3D>
    private readonly shown = new Map<string, string>
    private readonly ready: Promise<void>

    constructor(scale = .78) {
        this.group.scale.setScalar(scale)
        this.ready = model('painted/far-treasure').then(hull => {
            hull.traverse(o => { if (o.userData.slot) this.sockets.set(o.userData.slot, o) })
            this.group.add(hull)
        })
    }

    async fit(rig: FittedSlot[]) {
        await this.ready
        await Promise.all([ ...this.sockets ].map(([ slot, socket ]) => {
            const gid = rig.find(f => f.slot === slot)?.gid
            return this.mount(slot, socket, gid ? gid.replace('.', '-') : `empty-${ socket.userData.family }`)
        }))
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
