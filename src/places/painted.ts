import type * as T from 'three'
import type { Session } from '../core/session.ts'
import { PLATE, type PlaceKit, placeKit } from '../content/places.ts'
import type { Kit } from '../kit/index.ts'
import { type Stage, VH, VW } from '../world/stage.ts'
import type { Place } from './router.ts'

/**
 * a place on a painted plate: sam's room fills the frame, its parts
 * stand on their feet, the lower ones in front. the kit goes on top:
 * a place shows its own parts of the kit in `reveal()`.
 */
export abstract class Painted implements Place {
    protected readonly stage: Stage
    protected readonly kit: Kit
    protected session?: Session
    private readonly made: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>[] = []
    private readonly art: string[]
    private visit = 0

    /** `art`: the place and the kit in `art/places/`, `exchange` and `outpost`. */
    constructor(stage: Stage, kit: Kit, art: string[]) {
        this.stage = stage
        this.kit   = kit
        this.art   = art
    }

    abstract sync(s: Session): void
    protected abstract reveal(on: boolean): void

    async enter(s: Session) {
        const visit = ++this.visit
        this.session = s
        this.stage.sky.show()
        const k = await placeKit(this.art[ 0 ], this.art[ 1 ])
        if (visit !== this.visit) return
        this.paint(k)
        this.reveal(true)
        this.sync(s)
    }

    leave() {
        this.visit++
        this.reveal(false)
        this.kit.card.close()
        for (const m of this.made.splice(0)) {
            m.removeFromParent()
            m.material.map?.dispose()
        }
    }

    private paint(k: PlaceKit) {
        const st = this.stage, f = VW / PLATE
        this.made.push(st.sprite(st.back, `${ k.base }/${ k.plate }`, { x: VW / 2, y: VH / 2, w: VW }))
        for (const p of k.placements) {
            const part = k.parts.find(q => q.name === p.name)
            if (part) this.made.push(st.sprite(st.back, `${ k.base }/${ part.file }`, { x: p.x * f, y: p.y * f, w: p.width * f, foot: [ part.foot[ 0 ] / part.w, part.foot[ 1 ] / part.h ], z: 1 + p.y / PLATE }))
        }
    }
}
