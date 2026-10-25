import * as T from 'three'
import type { FittedSlot } from '../core/transport/types.ts'
import { MODULES } from '../content/fleet.ts'
import { type Skin, hullSkin } from '../content/skins.ts'
import { model } from './loader.ts'
import { liven, rng } from './paint.ts'
import { Puffs, puffs } from './puffs.ts'
import { beads, line } from './beads.ts'
import { picture, tint, toy, wear } from './toy.ts'

// a towing ship's load, behind its stern
const TOWS: Record<string, string> = { 'toy/ship-asteroid-barge': 'toy/tow-asteroid', 'toy/ship-iceberg-tug': 'toy/tow-iceberg' }

// sam's toy modules, one per family: a socket shows its family's module, whatever its mark
const TOYS: Record<string, string> = { power: 'reactor', cruise: 'cruise-drive', maneuver: 'maneuver', cargo: 'cargo-pod', utility: 'antenna' }

/**
 * a hull and its rig. the glb has a socket per slot; the extras name the
 * slot and the family. a module glb sits on its socket, an empty slot
 * shows a bare mount. a fit reloads only the slots that changed. the
 * hull scales to its length in metres, whatever unit it was built in.
 * the hull wears a skin, its modules too, and its drive blows bubbles
 * from its `exhaust` empties.
 */
export class Ship {
    readonly group = new T.Group
    readonly ready: Promise<void>
    worn: FittedSlot[] = []
    readonly sockets = new Map<string, T.Object3D>
    private readonly shown = new Map<string, string>
    private skin: Skin
    private puffs?: Puffs
    private thrust = 0

    /** `skin`: the player's pick; none, the hull's own. */
    constructor(name = 'toy/ship-cargo', metres = 70, skin?: Skin) {
        this.skin = skin ?? hullSkin(name)
        this.ready = model(name, toy).then(hull => {
            wear(hull, this.skin)
            const nozzles: T.Object3D[] = []
            hull.traverse(o => {
                if (o.userData.slot) this.sockets.set(o.userData.slot, o)
                if (o.name.startsWith('exhaust')) nozzles.push(o)
            })
            this.puffs = new Puffs(nozzles, tint('glow'), puffs().map(picture))
            // the puffs go with the ship, whichever place takes it off the stage
            this.group.addEventListener('removed', () => this.puffs?.clear())
            // the belly rests on the group's origin, the middle of the hull above it
            const box = (new T.Box3).setFromObject(hull)
            const size = box.getSize(new T.Vector3)
            hull.position.x -= (box.min.x + box.max.x) / 2
            hull.position.y -= box.min.y
            if (TOWS[ name ]) void this.tow(TOWS[ name ], hull, box.min.x)
            this.group.scale.setScalar(metres / Math.max(size.x, size.y, size.z))
            this.group.add(hull)
        })
    }

    async fit(rig: FittedSlot[]) {
        await this.ready
        this.worn = rig.filter(f => this.sockets.has(f.slot))
        await Promise.all([ ...this.sockets ].map(([ slot, socket ]) => {
            const gid = rig.find(f => f.slot === slot)?.gid, family = socket.userData.family
            return this.mount(slot, socket, gid ? `toy/modules/${ TOYS[ family ] }` : '')
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

    // the load a gap behind the stern, a dotted cable from each of its tow points to the stern
    private async tow(id: string, hull: T.Object3D, stern: number) {
        const load = await model(id, toy), box = (new T.Box3).setFromObject(load), gap = (box.max.x - box.min.x) * .25
        load.position.x = stern - gap - box.max.x
        const back = new T.Vector3(stern, (box.min.y + box.max.y) / 2, 0), points: T.Object3D[] = []
        load.traverse(o => { if (/^tow_[a-z]$/.test(o.name)) points.push(o) })
        const cable = points.flatMap(o => line(back, o.position.clone().add(load.position), gap * .12, 0))
        hull.add(load, beads(cable, [ tint('cream'), tint('amber') ], gap * .02))
    }

    /** a new skin, on the hull and its modules. */
    async wear(skin: Skin) {
        this.skin = skin
        await this.ready
        wear(this.group, skin)
    }

    /** the drive at the stern, 0 to 1: the bubbles it blows. */
    burn(k: number) {
        this.thrust = k
    }

    tick(t: number, dt: number) {
        liven(this.group, t, dt)
        this.puffs?.tick(dt, this.thrust, this.group.parent)
    }

    // `id` is the module's model; none leaves the socket bare
    private async mount(slot: string, socket: T.Object3D, id: string) {
        if (this.shown.get(slot) === id) return
        this.shown.set(slot, id)
        const m = id ? await model(id, toy) : void 0
        // a later fit of the same slot wins
        if (this.shown.get(slot) !== id) return
        socket.clear()
        if (m) wear(m, this.skin)
        if (m) socket.add(m)
    }
}
