import { html, nothing, type PropertyValues } from 'lit'
import { AppElement } from './element.ts'
import { emit } from '../util.ts'

const HOLD_MS = 2200
const STREAKS = 18

/** a brief warp-in burst, then the destination's name. the strong cue the docked event alone did not give. */
class ArrivalOverlay extends AppElement {
    static properties = { active: { type: Boolean }, system: {}, name: {}}
    declare active: boolean
    declare system: string
    declare name: string
    private streaks: { angle: number, delay: number }[] = []
    private timer?: ReturnType<typeof setTimeout>

    constructor() {
        super()
        this.active = false
        this.system = ''
        this.name = ''
    }

    override updated(changes: PropertyValues) {
        if (!changes.has('active') || !this.active) return
        this.streaks = Array.from({ length: STREAKS }, (_, i) => ({
            angle: i / STREAKS * 360 + (Math.random() * 10 - 5),
            delay: Math.random() * 0.15,
        }))
        clearTimeout(this.timer)
        this.timer = setTimeout(() => emit(this, 'arrival-done', void 0), HOLD_MS)
        this.requestUpdate()
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearTimeout(this.timer)
    }

    override render() {
        if (!this.active) return nothing
        return html`<div class="arrival" role="status" aria-live="polite">
            <div class="arrival-field" aria-hidden="true">${ this.streaks.map(s => html`<span style=${ `--angle:${ s.angle }deg; --delay:${ s.delay }s` }></span>`) }</div>
            <div class="arrival-focus">
                <div class="arrival-body" aria-hidden="true"></div>
                <div class="arrival-card">
                    <small data-kicker>arrived</small>
                    <h2>${ this.system } - ${ this.name }</h2>
                </div>
            </div>
        </div>`
    }
}
customElements.define('arrival-overlay', ArrivalOverlay)
