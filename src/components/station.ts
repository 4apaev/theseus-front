import { html, nothing } from 'lit'
import {
    MODULES,
    hullOf,
    loadOf,
    type View,
    type Facility,
    type ModuleId,
    type GameState,
} from '../model.ts'

import type { SpaceScene } from '../render/space-scene.ts'
import { iconButton } from './controls.ts'

interface StationOptions {
    host: HTMLElement
    game: GameState
    mode: 'port' | 'rig' | 'market'
    motion: boolean
    selected?: ModuleId
    navigate: (view: View) => void
    toggleMotion: () => void
    selectModule: (id: ModuleId) => void
}

export function stationView(options: StationOptions) {
    const { host, game, mode, motion, selected, toggleMotion, navigate, selectModule } = options

    const scene = () => host.querySelector<SpaceScene>('space-scene')

    const hull = hullOf(game)

    return html`
    <section class=viewport aria-label="ship and port view">

        <space-scene
            .hull=${ game.hull }
            .mode=${ mode }
            .motion=${ motion }
            .fitted=${ game.fitted }
            .selection=${ selected ?? 'cargo' }
            .load=${ loadOf(game) }

            @facility-select=${ (e: CustomEvent<Facility>) => navigate(({ exchange: 'market', drydock: 'rig', relay: 'comms' } as const)[ e.detail ]) }
            @module-select=${   (e: CustomEvent<ModuleId>) => selectModule(e.detail) }
        ></space-scene>

        <header class="scene-title">
            <span class="tiny-rule" aria-hidden="true"></span>
            <span>${ mode === 'rig' ? 'restless rumor of instinct' : 'sol / orbital facilities' }
                <small>${ mode === 'rig' ? `${ hull.name } · ${ hull.category } hull` : 'earth high orbit · independent station' }</small>
            </span>
        </header>

        <nav class="scene-tools" aria-label="scene camera"><small>drag to rotate</small>
            ${ iconButton('minus', 'zoom out'    , () => scene()?.adjustZoom(-0.15)) }
            ${ iconButton('plus' , 'zoom in'     , () => scene()?.adjustZoom(0.15)) }
            ${ iconButton('reset', 'reset camera', () => scene()?.resetCamera()) }
            ${ iconButton(motion ? 'pause' : 'play', motion ? 'pause ambient motion' : 'resume ambient motion', toggleMotion) }
        </nav>
        ${ mode === 'rig'
            ? html`
                <nav class="mount-selector" aria-label="module mounts">${ (
                    Object.keys(MODULES) as ModuleId[]).map(id => html`
                        <button class="mount" aria-pressed=${ selected === id } @click=${ () => selectModule(id) }>
                            <small>${ MODULES[ id ].slot }</small>
                            <span>${ MODULES[ id ].name }</span>
                            <samp data-fitted=${ game.fitted.includes(id) }>${ game.fitted.includes(id) ? 'fitted' : 'empty' }</samp>
                        </button>`) }
                </nav>`
            : nothing }
    </section>`
}
