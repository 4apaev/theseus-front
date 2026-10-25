import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import type { LogLine } from '../core/session.ts'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * the feed: one line with the last event. a click on it, or the
 * backtick key, opens the console: every line, newest first, with its
 * time and kind.
 */
export class KitLog extends AppElement {
    static properties = { lines: { attribute: false }, open: { type: Boolean, reflect: true }}
    declare lines?: LogLine[]
    declare open: boolean

    override connectedCallback() {
        super.connectedCallback()
        addEventListener('keydown', this.key)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        removeEventListener('keydown', this.key)
    }

    override render() {
        const [ last ] = this.lines ?? []
        return html`
            <button data-kind=${ last?.kind ?? 'dim' } @click=${ () => this.open = !this.open }>${ last?.text ?? 'no events yet' }</button>
            ${ this.open && this.lines?.length
                ? html`<ol>${ (this.lines ?? []).map(l => html`
                <li data-kind=${ l.kind }><time datetime=${ l.time }>${ time(l.time) }</time> <b>${ l.kind }</b> ${ l.text }</li>`) }</ol>`
                : '' }`
    }

    private readonly key = (e: KeyboardEvent) => {
        if (e.key !== '`' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        e.preventDefault()
        this.open = !this.open
    }
}
customElements.define('kit-log', KitLog)
