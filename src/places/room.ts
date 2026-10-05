import type { Stage } from '../world/stage.ts'
import type { Place } from './router.ts'

/** a place still to build: the sky only. the hud names it. */
export class Room implements Place {
    private readonly stage: Stage

    constructor(stage: Stage) {
        this.stage = stage
    }

    enter() { this.stage.sky.show() }
    sync() { /* nothing to follow yet */ }
    leave() { /* nothing made */ }
}
