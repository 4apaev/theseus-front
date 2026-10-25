import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'

export interface Choice { value: string, label: string }

/**
 * a dropdown: a button shows the chosen option, a click opens the list
 * of options, a pick closes it. it joins its form as a select does,
 * by `name` and `value`, and a pick emits `change`. `up` opens the list
 * above the button. escape, or a click elsewhere, closes it.
 */
export class KitSelect extends AppElement {
    static formAssociated = true
    static properties = { choices: { attribute: false }, value: {}, name: {}, open: { type: Boolean, reflect: true }}
    declare choices: Choice[]
    declare value: string
    declare name: string
    declare open: boolean
    private readonly internals = this.attachInternals()

    constructor() {
        super()
        this.choices = []
        this.value = ''
        this.open = false
    }

    override connectedCallback() {
        super.connectedCallback()
        addEventListener('pointerdown', this.away, true)
        addEventListener('keydown', this.escape, true)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        removeEventListener('pointerdown', this.away, true)
        removeEventListener('keydown', this.escape, true)
    }

    override render() {
        const shown = this.choices.find(c => c.value === this.value) ?? this.choices[ 0 ]
        return html`
            <button type="button" aria-haspopup="listbox" aria-expanded=${ this.open } @click=${ () => this.open = !this.open }>${ shown?.label ?? '' }</button>
            ${ this.open
                ? html`<menu role="listbox">${ this.choices.map(c => html`
                <li><button type="button" role="option" aria-selected=${ c.value === this.value } @click=${ () => this.pick(c.value) }>${ c.label }</button></li>`) }</menu>`
                : '' }`
    }

    override updated() {
        this.internals.setFormValue(this.value)
        if (this.open) this.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    }

    private pick(value: string) {
        this.value = value
        this.open = false
        emit(this, 'change', value)
    }

    private readonly away = (e: PointerEvent) => {
        if (this.open && !e.composedPath().includes(this)) this.open = false
    }

    private readonly escape = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || !this.open) return
        e.preventDefault()
        e.stopPropagation()
        this.open = false
    }
}
customElements.define('kit-select', KitSelect)
