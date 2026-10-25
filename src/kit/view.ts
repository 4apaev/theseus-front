import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'

/** the keys of a diagram plane: `turn` and `zoom`, each with 1 or -1. */
export class KitView extends AppElement {
    override render() {
        return html`<menu>
            <button aria-label="turn left" @click=${ () => emit(this, 'turn', 1) }>⟲</button>
            <button aria-label="turn right" @click=${ () => emit(this, 'turn', -1) }>⟳</button>
            <button aria-label="zoom in" @click=${ () => emit(this, 'zoom', 1) }>+</button>
            <button aria-label="zoom out" @click=${ () => emit(this, 'zoom', -1) }>−</button>
        </menu>`
    }
}
customElements.define('kit-view', KitView)
