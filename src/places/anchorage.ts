import * as T from 'three'
import type { TrafficRow } from '../core/transport/types.ts'
import { NPC, seedOf } from '../content/fleet.ts'
import { rng } from '../world/paint.ts'
import { type Berth, Visitor } from '../world/visitor.ts'

/**
 * the anchorage: a ring of berths round the station, where other ships
 * wait. the players' ships come and go with the traffic; they all fly a
 * far treasure, each with its own rig. npc ships fill the free berths:
 * every half minute or so one arrives or one leaves.
 */
export class Anchorage {
    readonly group = new T.Group
    private readonly berths: Berth[]
    private readonly ships = new Map<string, Visitor>
    private readonly rows  = new Map<string, TrafficRow>
    private readonly r: () => number
    private t = 0
    private next = 0
    private npc = 0

    constructor(box: T.Box3, seed: number) {
        const c = box.getCenter(new T.Vector3)
        const s = box.getSize(new T.Vector3)
        const radius = Math.hypot(s.x, s.z) / 2 + 160
        this.r = rng(seed)
        this.berths = Array.from({ length: 7 }, (_, i) => ring(c, radius, (i + .5) / 7 * Math.PI * 2, (this.r() - .5) * 80))
    }

    /** the players' ships docked here. `fly` false parks them at once. */
    sync(rows: TrafficRow[], fly = true) {
        const here = new Set(rows.map(row => row.sid))
        rows.forEach(row => this.rows.set(row.sid, row))
        for (const [ id, v ] of this.ships)
            if (!id.startsWith('npc') && !here.has(id)) v.depart(this.t)
        for (const row of rows)
            if (!this.ships.has(row.sid)) this.dock(row.sid, 'far-treasure', fly)
    }

    /** the visitor that `o` belongs to, and its traffic row if a player flies it. */
    find(o: T.Object3D) {
        for (const [ id, v ] of this.ships) {
            let p: T.Object3D | null = o
            while (p && p !== v.ship.group) p = p.parent
            if (p) return { visitor: v, row: this.rows.get(id) }
        }
    }

    /** `n` npc ships, parked. */
    fill(n: number) {
        for (let i = 0; i < n; i++) this.dock(`npc${ this.npc++ }`, NPC[ Math.floor(this.r() * NPC.length) ], false)
    }

    tick(t: number, dt: number) {
        this.t = t
        this.next ||= t + 15
        for (const [ id, v ] of this.ships) {
            v.tick(t, dt)
            if (v.gone) this.ships.delete(id) && v.ship.group.removeFromParent()
        }
        if (t >= this.next) this.turn()
    }

    // one npc arrives, or one leaves
    private turn() {
        this.next = this.t + 20 + this.r() * 30
        const npcs = [ ...this.ships ].filter(([ id ]) => id.startsWith('npc'))
        if (this.open().length > 1 && (npcs.length < 3 || this.r() < .5))
            return this.dock(`npc${ this.npc++ }`, NPC[ Math.floor(this.r() * NPC.length) ], true)
        npcs[ Math.floor(this.r() * npcs.length) ]?.[ 1 ].depart(this.t)
    }

    private dock(id: string, hull: string, fly: boolean) {
        const free = this.open()
        if (!free.length) return
        const v = new Visitor(hull, seedOf(id), free[ Math.floor(this.r() * free.length) ])
        if (fly) v.arrive(this.t)
        this.ships.set(id, v)
        this.group.add(v.ship.group)
    }

    private open() {
        const used = new Set([ ...this.ships.values() ].map(v => v.berth))
        return this.berths.filter(b => !used.has(b))
    }
}

// a berth on the ring, its bow along the ring
function ring(c: T.Vector3, radius: number, a: number, dy: number): Berth {
    return {
        at : new T.Vector3(Math.cos(a) * radius, dy, Math.sin(a) * radius).add(c),
        bow: new T.Vector3(-Math.sin(a), 0, Math.cos(a)),
    }
}
