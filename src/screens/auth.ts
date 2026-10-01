import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { button } from '../components/controls.ts'
import { icon } from '../icons.ts'
import { Fail } from '../util.ts'
import type { GameClient } from '../client.ts'

type Kind = 'login' | 'register'

/** docking clearance: one form, 2 verbs. a new handle also commissions a ship. */
class AuthScreen extends AppElement {
    static properties = { client: { attribute: false }, busy: { state: true }, error: { state: true }}
    declare client: GameClient
    declare busy: boolean
    declare error: string

    constructor() {
        super()
        this.busy = false
        this.error = ''
    }

    override render() {
        return html`
        <main class="auth">
            <form class="auth-card" @submit=${ (e: Event) => { e.preventDefault(); void this.submit('login') } }>
                <header>
                    <small data-kicker>docking clearance</small>
                    <h1>${ icon('orbit') } theseus<span class="wordmark-dot">.</span></h1>
                    <p>a small vessel in an indifferent universe.</p>
                </header>
                <label for="handle">handle</label>
                <input id="handle" name="handle" type="text" required autocomplete="username" maxlength="32" ?disabled=${ this.busy }>
                <label for="password">password</label>
                <input id="password" name="password" type="password" required autocomplete="current-password" ?disabled=${ this.busy }>
                <p class=${ this.error ? 'validation error' : 'validation' }>${ this.error || 'a new handle registers a pilot and commissions a starter ship.' }</p>
                <div class="auth-actions">
                    ${ button({ label: 'login', variant: 'primary', icon: 'arrow', disabled: this.busy, click: () => void this.submit('login') }) }
                    ${ button({ label: 'register', variant: 'secondary', disabled: this.busy, click: () => void this.submit('register') }) }
                </div>
                <small class="footnote">the session token stays in this browser</small>
            </form>
        </main>`
    }

    private fields() {
        const data = new FormData(this.querySelector('form')!)
        return { handle: String(data.get('handle') ?? '').trim(), password: String(data.get('password') ?? '') }
    }

    private async submit(kind: Kind) {
        const { handle, password } = this.fields()
        if (!handle || !password) return this.error = 'handle and password required'

        this.busy = true
        this.error = ''
        try {
            await this.client[ kind ](handle, password)
        }
        catch (e) {
            this.error = Fail.from(e).message
        }
        finally {
            this.busy = false
        }
    }
}
customElements.define('auth-screen', AuthScreen)
