import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { credits } from '../core/util.ts'

/** the wallet. a change counts to the new value, green up, red down. */
export class KitCredits extends AppElement {
    static properties = { value: { type: Number }}
    declare value: number
    private shown = 0
    private frame = 0

    override willUpdate(changed: Map<string, unknown>) {
        const from = changed.get('value') as number | undefined
        if (!changed.has('value')) return
        if (from === undefined) return void (this.shown = this.value ?? 0)
        this.dataset.trend = this.value > from ? 'up' : 'down'
        this.count(from, performance.now())
    }

    override render() {
        return html`<data value=${ this.value ?? 0 }>${ credits(this.shown, 0) }</data>`
    }

    // 600 ms from the old value to the new, then the colour fades
    private count(from: number, t0: number) {
        cancelAnimationFrame(this.frame)
        const step = (now: number) => {
            const k = Math.min(1, (now - t0) / 600)
            this.shown = from + (this.value - from) * k
            this.requestUpdate()
            if (k < 1) this.frame = requestAnimationFrame(step)
            else setTimeout(() => delete this.dataset.trend, 900)
        }
        this.frame = requestAnimationFrame(step)
    }
}
customElements.define('kit-credits', KitCredits)
