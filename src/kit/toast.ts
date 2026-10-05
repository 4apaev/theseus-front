import { html } from 'lit'
import { AppElement } from '../components/element.ts'

interface Line { text: string, bad: boolean }

/** a command's result, for 3 seconds. a refusal is red. */
export class KitToast extends AppElement {
    private lines: Line[] = []

    say(text: string, bad = false) {
        const line = { text, bad }
        this.lines = [ ...this.lines, line ].slice(-3)
        this.requestUpdate()
        setTimeout(() => {
            this.lines = this.lines.filter(l => l !== line)
            this.requestUpdate()
        }, 3000)
    }

    override render() {
        return this.lines.map(l => html`<p ?data-bad=${ l.bad }>${ l.text }</p>`)
    }
}
customElements.define('kit-toast', KitToast)
