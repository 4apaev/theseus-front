import { html       } from 'lit'
import { AppElement } from './element.ts'
import { emit       } from '../util.ts'
import type { Theme } from '../theme.ts'

class ThemeSwitch extends AppElement {
    static properties = { value: {}}
    declare value: Theme

    constructor() {
        super()
        this.value = 'system'
    }

    override render() {
        return html`
        <label for="theme-preference">
            <select
                id="theme-preference"
                aria-label="color theme"
                @change=${ (e: Event) => emit(this, 'theme-preference', (e.target as HTMLSelectElement).value) }
            >${ ([ 'system', 'dark', 'light' ] as const).map(value => html`
                <option
                    value=${ value }
                    .selected=${ value === this.value }
                >${ value }</option>`) }
            </select></label>`
    }
}
customElements.define('theme-switch', ThemeSwitch)
