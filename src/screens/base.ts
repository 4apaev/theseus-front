import type { PropertyDeclarations } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit, Fail } from '../util.ts'
import { initialState } from '../model.ts'
import type { GameState, View, ModuleId } from '../model.ts'
import { panelHeader } from '../components/controls.ts'

export interface GameChange { game: GameState, message: string }
export interface Navigation { view: View, module?: ModuleId }

export class GameScreen extends AppElement {
    static properties: PropertyDeclarations = { game: { attribute: false }, active: { type: Boolean }, motion: { state: true }}
    declare game: GameState
    declare active: boolean
    declare motion: boolean

    constructor() {
        super()
        this.game = initialState()
        this.active = false
        this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    protected panelHeader = panelHeader
    protected notify(message: string) { emit(this, 'notification', message) }
    protected navigate(view: View, module?: ModuleId) { emit<Navigation>(this, 'navigate', { view, module }) }
    protected commit(game: GameState, message: string) { emit<GameChange>(this, 'game-change', { game, message }) }
    protected act(action: () => GameState, message: string) {
        try { this.commit(action(), message) }
        catch (error) { this.notify(Fail.from(error).message) }
    }
}
