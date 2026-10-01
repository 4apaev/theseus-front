import './styles/styles.css'
import './render/space-scene.ts'
import './render/orbit-view.ts'
import './maps/atlas-view.ts'

import { html, nothing          } from 'lit'
import { AppElement             } from './components/element.ts'
import { button, iconButton     } from './components/controls.ts'
import { icon                   } from './icons.ts'
import { credits, countdown     } from './util.ts'
import { speak, sound           } from './util.speak.ts'
import { DEFAULT_HULL, hullById } from './model.ts'
import type { View, HullId      } from './model.ts'
import type { Navigation        } from './screens/base.ts'
import type { Session           } from './session.ts'
import { type ClientStatus, GameClient } from './client.ts'
import { emptySession, cargoLoad, stationName, systemName, station, docked, etaMs } from './session.ts'
import { ThemeController, type Theme   } from './theme.ts'

import './components/panel.ts'
import './components/fleet.ts'
import './components/arrival.ts'
import './components/settings.ts'

import './screens/rig.ts'
import './screens/auth.ts'
import './screens/port.ts'
import './screens/cargo.ts'
import './screens/comms.ts'
import './screens/market.ts'
import './screens/flight.ts'

const HULL_KEY = 'theseus.hull'
const SPEECH_KEY = 'theseus.speech'

const views: { id: View, name: string, title: string }[] = [
    { id: 'port'  , name: 'port'    , title: 'port authority'    },
    { id: 'rig'   , name: 'rigging' , title: 'ship operations'   },
    { id: 'market', name: 'exchange', title: 'market operations' },
    { id: 'cargo' , name: 'cargo'   , title: 'the hold'          },
    { id: 'comms' , name: 'comms'   , title: 'the quiet between' },
    { id: 'map'   , name: 'map'     , title: 'navigation atlas'  },
    { id: 'orbit' , name: 'flight'  , title: 'transfer planning' },
]

/**
 * the shell. the client owns the session; the app owns navigation,
 * the visual hull choice, and notifications.
 */
class TheseusApp extends AppElement {
    static properties = {
        view    : { state: true },
        session : { state: true },
        status  : { state: true },
        authed  : { state: true },
        hull    : { state: true },
        navSlot : { state: true },
        fleet   : { state: true },
        toast   : { state: true },
        now     : { state: true },
        arrival : { state: true },
        speech  : { state: true },
        settings: { state: true },
        railCollapsed: { state: true },
    }

    declare view: View
    declare session: Session
    declare status: ClientStatus
    declare hull: HullId
    declare now: number
    declare toast: string
    declare navSlot?: string
    declare authed: boolean
    declare fleet: boolean
    declare speech: boolean
    declare settings: boolean
    declare railCollapsed: boolean
    declare arrival?: { system: string, name: string }

    readonly client = new GameClient
    readonly theme = new ThemeController(this)

    private clock?: ReturnType<typeof setInterval>
    private toastTimer?: ReturnType<typeof setTimeout>
    private previousFocus?: HTMLElement

    constructor() {
        super()
        this.toast    = ''
        this.view     = 'port'
        this.status   = 'offline'
        this.authed   = false
        this.fleet    = false
        this.settings = false
        this.railCollapsed = false
        this.now      = Date.now()
        this.session  = emptySession()
        this.hull     = readHull()
        this.speech   = readSpeech()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.client.onNotify = x => this.notify(x)
        this.client.onChange = x => { this.checkArrival(x); this.session = x }
        this.client.onStatus = x => { this.status = x }
        this.client.onAuth   = x => { this.authed = x; if (!x) this.view = 'port' }
        this.clock = setInterval(() => { this.now = Date.now() }, 1000)
        this.client.boot()
    }

    override disconnectedCallback() {
        super.disconnectedCallback()

        clearTimeout(this.toastTimer)
        clearInterval(this.clock)

        this.client.logout()
    }

    // a fresh dock, not just a docked ship on the first frame. the overlay is the strong cue; the view swap follows it.
    private checkArrival(next: Session) {
        if (this.session.ship?.status !== 'transit' || next.ship?.status !== 'docked') return

        const here = station(next, next.ship.stid)
        if (!here) return

        this.arrival = { system: systemName(next, here.system), name: here.name }
        if (this.speech) {
            sound.currentTime = 0
            void sound.play().catch(() => { /* autoplay blocked, the visual overlay still lands */ })
            speak(`arrived at ${ here.name }`)
        }
    }

    private notify(message: string) {
        this.toast = message
        clearTimeout(this.toastTimer)
        this.toastTimer = setTimeout(() => { this.toast = '' }, 4200)
    }

    private navigate(view: View, slot?: string) {
        if (slot) this.navSlot = slot
        this.view = view
    }

    private openFleet() { this.previousFocus = document.activeElement as HTMLElement; this.fleet = true }
    private closeFleet() { this.fleet = false; this.previousFocus?.focus() }

    private openSettings() { this.previousFocus = document.activeElement as HTMLElement; this.settings = true }
    private closeSettings() { this.settings = false; this.previousFocus?.focus() }

    private setSpeech(on: boolean) {
        this.speech = on
        writeSpeech(on)
    }

    private selectHull(id: HullId) {
        this.hull = id
        writeHull(id)
        this.closeFleet()
        this.notify(`${ hullById(id).name } preview selected`)
        this.navigate('rig')
    }

    override render() {
        return this.authed
            ? this.shell()
            : html`<auth-screen .client=${ this.client }></auth-screen>${ this.toastOutput() }`
    }

    private toastOutput() {
        return html`<output class="toast" role="status" aria-live="polite" ?hidden=${ !this.toast }>${ icon('check') }${ this.toast }</output>`
    }

    private location() {
        const { ship } = this.session
        if (!ship) return { text: 'no ship', note: 'awaiting commission' }
        if (docked(this.session)) return { text: 'docked', note: stationName(this.session, ship.stid) }
        return { text: `in transit · ${ countdown(etaMs(ship, this.now)) }`, note: `${ stationName(this.session, ship.from) } → ${ stationName(this.session, ship.to) }` }
    }

    private shell() {
        const active = views.find(v => v.id === this.view)!
        const { me, ship } = this.session
        const where = this.location()
        return html`<div class="app-shell ${ this.railCollapsed ? 'rail-collapsed' : '' }"
            @notification=${ (e: CustomEvent<string>)     => this.notify(e.detail) }
            @navigate=${     (e: CustomEvent<Navigation>) => this.navigate(e.detail.view, e.detail.slot) }
        >
            <header class="topbar">
                <a class="wordmark" href="#port" @click=${ (e: Event) => { e.preventDefault(); this.navigate('port') } } aria-label="theseus home">${ icon('orbit') }<span>theseus<span class="wordmark-dot">.</span></span></a>
                <p class="session"><span class="status-dot" data-status=${ this.status } aria-hidden="true"></span>${ this.status } <span aria-hidden="true">/</span> ${ me?.handle ?? '…' }</p>
                <div class="account">
                    <span class="account-stat"><small>credits</small><b data-testid="credits">${ me ? credits(me.balance) : '—' }</b></span>
                    <span class="account-stat"><small>hold</small><b data-testid="hold">${ cargoLoad(this.session) }<small> / ${ ship?.capacity ?? '—' }</small></b></span>
                    ${ button({ label: 'select hull preview', class: 'avatar', variant: 'text', click: () => this.openFleet() }, (me?.handle ?? 'rr').slice(0, 2)) }
                    ${ iconButton('settings', 'settings', () => this.openSettings()) }
                </div>
            </header>
            <nav class="navrail ${ this.railCollapsed ? 'collapsed' : '' }" aria-label="operations">
                <button class="rail-handle" aria-label=${ this.railCollapsed ? 'expand sidebar' : 'collapse sidebar' } @click=${ () => { this.railCollapsed = !this.railCollapsed } }>${ icon('arrow') }</button>
                ${ views.map(v => html`<button class="nav-item" aria-current=${ this.view === v.id ? 'page' : nothing } @click=${ () => this.navigate(v.id) } title=${ v.name }>${ icon(v.id) }<span class="sr-only">${ v.name }</span></button>`) }
                <span class="rail-divider" aria-hidden="true"></span>
                <button class="nav-item" title="hull catalog" @click=${ () => this.openFleet() }>${ icon('rig') }<span class="sr-only">hull catalog</span></button>
                <aside class="rail-bottom"><span>${ ship?.stid?.split('.')[ 0 ] ?? '—' }</span><span data-shape aria-hidden="true"></span><small>${ ship?.rig ?? '' }</small></aside>
            </nav>
            <main class="workspace view-${ this.view }">
                <header class="page-heading">
                    <p class="page-title"><span class="page-index">${ String(views.indexOf(active) + 1).padStart(2, '0') } /</span> ${ active.title }</p>
                    <p class="location"><span class="status-dot" aria-hidden="true"></span>${ where.text } · ${ where.note }</p>
                </header>
                <port-screen   .session=${ this.session } .client=${ this.client } .active=${ this.view === 'port' } ?hidden=${ this.view !== 'port' }></port-screen>
                <rig-screen    .session=${ this.session } .client=${ this.client } .hull=${ this.hull } .slotId=${ this.navSlot } .active=${ this.view === 'rig' } ?hidden=${ this.view !== 'rig' }></rig-screen>
                <market-screen .session=${ this.session } .client=${ this.client } .hull=${ this.hull } .active=${ this.view === 'market' } ?hidden=${ this.view !== 'market' }></market-screen>
                <cargo-screen  .session=${ this.session } .client=${ this.client } .active=${ this.view === 'cargo' } ?hidden=${ this.view !== 'cargo' }></cargo-screen>
                <comms-screen  .session=${ this.session } .client=${ this.client } .presetContact=${ this.navSlot } .active=${ this.view === 'comms' } ?hidden=${ this.view !== 'comms' }></comms-screen>
                <flight-screen .session=${ this.session } .client=${ this.client } .active=${ this.view === 'orbit' } ?hidden=${ this.view !== 'orbit' }></flight-screen>

                <atlas-view    .session=${ this.session } .client=${ this.client } .active=${ this.view === 'map' } ?hidden=${ this.view !== 'map' }></atlas-view>
            </main>
            ${ this.toastOutput() }
            <fleet-catalog .open=${ this.fleet } .hull=${ this.hull } @catalog-close=${ () => this.closeFleet() } @hull-select=${ (e: CustomEvent<HullId>) => this.selectHull(e.detail) }></fleet-catalog>
            <settings-dialog .open=${ this.settings } .speech=${ this.speech } .theme=${ this.theme.preference }
                @settings-close=${ () => this.closeSettings() }
                @speech-toggle=${ (e: CustomEvent<boolean>) => this.setSpeech(e.detail) }
                @theme-preference=${ (e: CustomEvent<Theme>) => this.theme.set(e.detail) }
                @logout=${ () => this.client.logout('logged out') }
            ></settings-dialog>
            <arrival-overlay .active=${ !!this.arrival } .system=${ this.arrival?.system ?? '' } .name=${ this.arrival?.name ?? '' }
                @arrival-done=${ () => { this.arrival = void 0; this.navigate('port') } }></arrival-overlay>
        </div>`
    }
}
customElements.define('theseus-app', TheseusApp)

// the hull preview is a browser preference. blocked storage falls back to the default.
function readHull(): HullId {
    try {
        const id = localStorage.getItem(HULL_KEY)
        return id && hullById(id).id === id ? id as HullId : DEFAULT_HULL
    }
    catch { return DEFAULT_HULL }
}

function writeHull(id: HullId) {
    try { localStorage.setItem(HULL_KEY, id) }
    catch { /* session only */ }
}

// arrival announcements default on. blocked storage falls back to that default.
function readSpeech(): boolean {
    try {
        const value = localStorage.getItem(SPEECH_KEY)
        return value === null ? true : value === '1'
    }
    catch { return true }
}

function writeSpeech(on: boolean) {
    try { localStorage.setItem(SPEECH_KEY, on ? '1' : '0') }
    catch { /* session only */ }
}
