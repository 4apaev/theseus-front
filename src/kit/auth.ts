import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { emit } from '../core/util.ts'

/**
 * the way in: a handle and a password, over the sky. login or register
 * emits `auth` with `{ act, handle, password }`. the owner shows a
 * failure in `error`.
 */
export class KitAuth extends AppElement {
    static properties = { error: {}, busy: { type: Boolean }, open: { state: true }}
    declare error?: string
    declare busy: boolean
    declare open: boolean

    override render() {
        return html`
            <form @submit=${ this.submit }>
                <h4>theseus</h4>
                <label>handle <input name="handle" autocomplete="username" required></label>
                <label>password
                    <input name="password" type=${ this.open ? 'text' : 'password' } autocomplete="current-password" required>
                    <button type="button" @click=${ () => this.open = !this.open }>${ this.open ? 'hide' : 'show' }</button>
                </label>
                ${ this.error ? html`<output>${ this.error }</output>` : '' }
                <menu>
                    <button name="act" value="login" ?disabled=${ this.busy }>login</button>
                    <button name="act" value="register" ?disabled=${ this.busy }>register</button>
                </menu>
            </form>`
    }

    private submit(e: SubmitEvent) {
        e.preventDefault()
        const form = new FormData(e.target as HTMLFormElement)
        const act = (e.submitter as HTMLButtonElement | null)?.value ?? 'login'
        emit(this, 'auth', { act, handle: String(form.get('handle')).trim(), password: String(form.get('password')) })
    }
}
customElements.define('kit-auth', KitAuth)
