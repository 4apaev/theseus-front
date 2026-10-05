import { html } from 'lit'
import { AppElement } from '../components/element.ts'

/** a label on a thing in the scene, on a stem. a click goes to its place. */
export class KitSpot extends AppElement {
    static properties = { place: {}}
    declare place: string

    /** the screen point and its depth: past 1 it is behind the camera. */
    set at([ x, y, z ]: number[]) {
        this.hidden = z > 1
        this.style.translate = `${ x }px ${ y }px`
    }

    override render() {
        return html`<a href="#${ this.place }">${ this.place }</a>`
    }
}
customElements.define('kit-spot', KitSpot)
