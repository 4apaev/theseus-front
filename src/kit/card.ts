import { html, type TemplateResult } from 'lit'
import { AppElement } from '../components/element.ts'

/**
 * a paper card next to a thing in the scene. the place sets `at`, the
 * thing's screen point, each frame; the card sits right of it, or left
 * near the edge. escape or the × closes it.
 */
export class KitCard extends AppElement {
    static properties = { heading: {}, chip: {}, body: { attribute: false }}
    declare heading?: string
    declare chip?: string
    declare body?: TemplateResult

    show(heading: string, body: TemplateResult, chip?: string) {
        Object.assign(this, { heading, body, chip, hidden: false })
    }

    close() {
        this.hidden = true
        this.body = void 0
    }

    set at([ x, y ]: number[]) {
        const room = (this.parentElement?.clientWidth ?? 0) - x > this.offsetWidth + 24
        this.style.translate = `${ room ? x + 24 : x - this.offsetWidth - 24 }px ${ y - this.offsetHeight / 2 }px`
    }

    override connectedCallback() {
        super.connectedCallback()
        this.hidden = true
        addEventListener('keydown', this.escape)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        removeEventListener('keydown', this.escape)
    }

    override render() {
        return html`
            <header><h4>${ this.heading }</h4>${ this.chip ? html`<small>${ this.chip }</small>` : '' }<button aria-label="close" @click=${ () => this.close() }>×</button></header>
            ${ this.body }`
    }

    private readonly escape = (e: KeyboardEvent) => { if (e.key === 'Escape') this.close() }
}
customElements.define('kit-card', KitCard)
