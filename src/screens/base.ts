import type { PropertyDeclarations } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit, Fail } from '../util.ts'
import { emptySession } from '../session.ts'
import type { Session } from '../session.ts'
import type { GameClient } from '../client.ts'
import type { View } from '../model.ts'
import { panelHeader } from '../components/controls.ts'

export interface Navigation { view: View, slot?: string }

/**
 * a screen renders one session snapshot and calls commands on the
 * client. it never computes the next state: the server does, and
 * the result folds in from the feed.
 */
export class GameScreen extends AppElement {
    static properties: PropertyDeclarations = {
        session: { attribute: false },
        client : { attribute: false },
        active : { type: Boolean },
        motion : { state: true },
    }

    declare session: Session
    declare client: GameClient
    declare active: boolean
    declare motion: boolean

    constructor() {
        super()
        this.session = emptySession()
        this.active = false
        this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    protected panelHeader = panelHeader
    protected notify(message: string) { emit(this, 'notification', message) }
    protected navigate(view: View, slot?: string) { emit<Navigation>(this, 'navigate', { view, slot }) }

    /** a rejected command surfaces as a toast. the feed reports the result. */
    protected async run(action: () => Promise<unknown>) {
        try {
            await action()
        }
        catch (error) {
            this.notify(Fail.from(error).message)
        }
    }
}
