import { html, nothing, type PropertyValues } from 'lit'
import { AppElement } from './element.ts'
import { emit } from '../util.ts'
import { icon } from '../icons.ts'
import { button } from './controls.ts'
import type { Theme } from '../theme.ts'
import './theme-switch.ts'

/** game preferences, and the account controls that used to crowd the topbar. */
class SettingsDialog extends AppElement {
    static properties = { open: { type: Boolean }, speech: { type: Boolean }, theme: {}}
    declare open: boolean
    declare speech: boolean
    declare theme: Theme

    constructor() {
        super()
        this.open = false
        this.speech = true
        this.theme = 'system'
    }

    override updated(changes: PropertyValues) {
        if (!changes.has('open')) return
        const dialog = this.querySelector('dialog')
        if (this.open) dialog?.showModal()
        else dialog?.close()
    }

    private close() { emit(this, 'settings-close', void 0) }

    override render() {
        return this.open ? this.settingsDialog() : nothing
    }

    private settingsDialog() {
        return html`
        <dialog
            class="settings-dialog"
            @cancel=${ (e: Event) => { e.preventDefault(); this.close() } }
            @click=${ (e: MouseEvent) => { if (e.target === e.currentTarget) this.close() } }
        >
            <div class="settings-content">
                <header>
                    <div>
                        <small data-kicker>preferences</small>
                        <h2>settings</h2>
                    </div>
                    <button data-variant="icon" aria-label="close settings" @click=${ () => this.close() }>${ icon('close') }</button>
                </header>
                <div class="setting-row">
                    <span><b>arrival announcements</b><small>a chime and a spoken cue when your ship docks.</small></span>
                    <div class="segmented setting-toggle" role="group" aria-label="arrival announcements">
                        <button class=${ this.speech ? 'active' : '' } aria-pressed=${ this.speech } @click=${ () => emit(this, 'speech-toggle', true) }>on</button>
                        <button class=${ this.speech ? '' : 'active' } aria-pressed=${ !this.speech } @click=${ () => emit(this, 'speech-toggle', false) }>off</button>
                    </div>
                </div>
                <div class="setting-row">
                    <span><b>theme</b><small>light, dark, or match the system.</small></span>
                    <theme-switch .value=${ this.theme } @theme-preference=${ (e: CustomEvent<Theme>) => emit(this, 'theme-preference', e.detail) }></theme-switch>
                </div>
                <div class="setting-row">
                    <span><b>session</b><small>sign out of this pilot.</small></span>
                    ${ button({ label: 'log out', variant: 'secondary', click: () => emit(this, 'logout', void 0) }) }
                </div>
            </div>
        </dialog>`
    }
}
customElements.define('settings-dialog', SettingsDialog)
