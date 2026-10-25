import type { Effect } from '../core/effects.ts'
import { type Session, docked } from '../core/session.ts'

export interface Place {
    enter(s: Session): void | Promise<void>
    sync(s: Session): void
    leave(): void
    effect?(e: Effect): void
}

/**
 * one place at a time on the stage. the url hash names it, `#port` or
 * `#exchange`, so a reload keeps it. a place needs the ship docked: in
 * transit the `transit` place shows. escape goes back to the port.
 */
export class Router {
    onPlace?: (name: string) => void
    private readonly places: Record<string, Place>
    private current?: Place
    private shown = ''
    private session?: Session

    constructor(places: Record<string, Place>) {
        this.places = places
        addEventListener('hashchange', () => this.session && this.sync(this.session))
        addEventListener('keydown', e => {
            if (e.key === 'Escape' && !e.defaultPrevented && this.name() !== 'port') location.hash = 'port'
        })
    }

    // a new place, or the same place at a new station, leaves and enters
    sync(s: Session) {
        this.session = s
        const stid = docked(s) ? s.ship?.stid : void 0
        const name = stid ? this.name() : 'transit'
        if (`${ name } ${ stid }` === this.shown) return this.current?.sync(s)
        this.current?.leave()
        this.shown = `${ name } ${ stid }`
        this.current = this.places[ name ]
        // the stage knows of the arrival before the place sets its view
        this.onPlace?.(name)
        void this.current?.enter(s)
    }

    /** an effect goes to the place on stage. */
    effect(e: Effect) {
        this.current?.effect?.(e)
    }

    private name() {
        const name = location.hash.slice(1)
        return name in this.places ? name : 'port'
    }
}
