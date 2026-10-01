import { html } from 'lit'
import type { View, ModuleId, Facility } from '../model.ts'
import { hullById } from '../model.ts'
import type { SpaceScene, SceneMode } from '../render/space-scene.ts'
import { iconButton } from './controls.ts'

export interface StationOptions {
    host        : HTMLElement
    hull        : string
    fitted      : ModuleId[]
    load        : number
    mode        : SceneMode
    motion      : boolean
    selected    : ModuleId
    navigate    : (view: View) => void
    toggleMotion: () => void
}

/**
 * the shared ship-and-port viewport. the hull is a visual preview
 * the player picks; the fitted groups mirror the server rig.
 */
export function stationView(options: StationOptions) {
    const { host, fitted, load, mode, motion, selected, navigate, toggleMotion } = options
    const scene = () => host.querySelector<SpaceScene>('space-scene')
    const hull = hullById(options.hull)

    return html`
    <section class=viewport aria-label="ship and port view">

        <space-scene
            .hull=${ hull.id }
            .mode=${ mode }
            .motion=${ motion }
            .fitted=${ fitted }
            .selection=${ selected }
            .load=${ load }

            @facility-select=${ (e: CustomEvent<Facility>) => navigate(({ exchange: 'market', drydock: 'rig', relay: 'comms' } as const)[ e.detail ]) }
            @module-select=${ () => navigate('rig') }
        ></space-scene>

        <header class="scene-title">
            <span class="tiny-rule" aria-hidden="true"></span>
            <span>${ mode === 'rig' ? 'repair berth' : 'orbital facilities' }
                <small>${ mode === 'rig' ? `${ hull.name } · ${ hull.category } hull preview` : 'independent station' }</small>
            </span>
        </header>

        <nav class="scene-tools" aria-label="scene camera"><small>drag to rotate</small>
            ${ iconButton('minus', 'zoom out'    , () => scene()?.adjustZoom(-0.15)) }
            ${ iconButton('plus' , 'zoom in'     , () => scene()?.adjustZoom(0.15)) }
            ${ iconButton('reset', 'reset camera', () => scene()?.resetCamera()) }
            ${ iconButton(motion ? 'pause' : 'play', motion ? 'pause ambient motion' : 'resume ambient motion', toggleMotion) }
        </nav>
    </section>`
}
