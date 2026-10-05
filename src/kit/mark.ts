import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'

/** a label on a thing in the scene, on a stem. a click emits `pick` with its value. */
export class KitMark extends AppElement {
    static properties = { name: {}, value: {}, here: { type: Boolean, reflect: true }}
    declare name: string
    declare value: string
    declare here: boolean

    /** the screen point and its depth: past 1 it is behind the camera. */
    set at([ x, y, z ]: number[]) {
        this.hidden = z > 1
        this.style.translate = `${ x }px ${ y }px`
    }

    override render() {
        return html`<button @click=${ () => emit(this, 'pick', this.value) }>${ this.name }</button>`
    }
}
customElements.define('kit-mark', KitMark)
