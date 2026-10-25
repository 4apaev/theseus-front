import type * as T from 'three'
import type { Stage } from '../world/stage.ts'

/** a click on the stage, not a drag: `pick` gets the first thing hit under `roots`. */
export class Click {
    private readonly stage: Stage
    private readonly roots: () => T.Object3D[]
    private readonly pick: (hit: T.Object3D) => void
    private down = [ 0, 0 ]

    constructor(stage: Stage, roots: () => T.Object3D[], pick: (hit: T.Object3D) => void) {
        this.stage = stage
        this.roots = roots
        this.pick  = pick
    }

    on() {
        this.stage.host.addEventListener('pointerdown', this.press)
        this.stage.host.addEventListener('pointerup', this.release)
    }

    off() {
        this.stage.host.removeEventListener('pointerdown', this.press)
        this.stage.host.removeEventListener('pointerup', this.release)
    }

    private readonly press = (e: PointerEvent) => { this.down = [ e.offsetX, e.offsetY ] }

    private readonly release = (e: PointerEvent) => {
        if (!(e.target instanceof HTMLCanvasElement) || Math.hypot(e.offsetX - this.down[ 0 ], e.offsetY - this.down[ 1 ]) > 4) return
        const hit = this.stage.pick(e.offsetX, e.offsetY, this.roots())
        if (hit) this.pick(hit)
    }
}
