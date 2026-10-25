import { html } from 'lit'
import type * as T from 'three'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'
import type { KitCard } from './card.ts'

/**
 * a label on a thing in the scene, on a stem. a click emits `pick` with
 * its value. `here` and `selected`, the thing of the open card, stay
 * shown; in the toy look the rest show on hover.
 */
export class KitMark extends AppElement {
    static properties = { name: {}, value: {}, here: { type: Boolean, reflect: true }, selected: { type: Boolean, reflect: true }}
    declare name: string
    declare value: string
    declare here: boolean
    declare selected: boolean

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

/** the card beside the label of `value`, which stays selected while the card is open. */
export function beside(card: KitCard, marks: { at: T.Vector3, el: KitMark }[], value: string, anchor: (v: T.Vector3) => number[]) {
    for (const m of marks) m.el.selected = m.el.value === value
    const m = marks.find(x => x.el.value === value)
    if (m) void card.updateComplete.then(() => card.at = anchor(m.at))
}
