import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'

export interface Line { mid: string, who: string, body: string, when: string, letter: boolean, flying: boolean }
export interface Peer { sid: string, name: string }

/**
 * the comms panel: the station channel and the letters, oldest first,
 * then the composer. a letter in flight says so until it lands. send
 * emits `send` with `{ body, to }`; no `to` is the station channel.
 */
export class KitComms extends AppElement {
    static properties = { lines: { attribute: false }, peers: { attribute: false }}
    declare lines?: Line[]
    declare peers?: Peer[]

    override render() {
        return html`
            <ol>${ (this.lines ?? []).map(l => html`
                <li ?data-letter=${ l.letter }><b>${ l.who }</b> <q>${ l.body }</q> <small>${ l.flying ? 'in flight' : l.when }</small></li>`) }
            </ol>
            <form @submit=${ this.send }>
                <select name="to" aria-label="to">
                    <option value="">station channel</option>
                    ${ (this.peers ?? []).map(p => html`<option value=${ p.sid }>letter → ${ p.name }</option>`) }
                </select>
                <textarea name="body" rows="2" required placeholder="a message"></textarea>
                <button>send</button>
            </form>`
    }

    override updated() {
        this.querySelector('ol')?.scrollTo({ top: 1e6 })
    }

    private send(e: SubmitEvent) {
        e.preventDefault()
        const form = e.target as HTMLFormElement, data = new FormData(form)
        emit(this, 'send', { body: String(data.get('body')).trim(), to: String(data.get('to')) || void 0 })
        form.body.value = ''
    }
}
customElements.define('kit-comms', KitComms)
