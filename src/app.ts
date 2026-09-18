import './styles/styles.css'
import './render/space-scene.ts'
import './render/orbit-view.ts'
import './maps/atlas-view.ts'
import { html, nothing } from 'lit'
import { AppElement } from './components/element.ts'
import { button } from './components/controls.ts'
import { icon } from './icons.ts'
import { credits, countdown } from './util.ts'
import { DEFAULT_HULL, hullById } from './model.ts'
import type { View, HullId } from './model.ts'
import type { Navigation } from './screens/base.ts'
import { ThemeController } from './theme.ts'
import { GameClient, type ClientStatus } from './client.ts'
import { emptySession, cargoLoad, stationName, docked, etaMs } from './session.ts'
import type { Session } from './session.ts'
import './components/panel.ts'
import './components/fleet.ts'
import './components/theme-switch.ts'
import './screens/auth.ts'
import './screens/port.ts'
import './screens/rig.ts'
import './screens/market.ts'
import './screens/comms.ts'
import './screens/flight.ts'

const HULL_KEY = 'theseus.hull'

const views: { id: View, name: string, title: string, sub: string }[] = [
    { id: 'port', name: 'port', title: 'port authority', sub: 'who is here, and where the routes go.' },
    { id: 'rig', name: 'rigging', title: 'ship operations', sub: 'every attachment changes the equation.' },
    { id: 'market', name: 'exchange', title: 'market operations', sub: 'something to carry. somewhere to go.' },
    { id: 'comms', name: 'comms', title: 'the quiet between', sub: 'a signal is a kind of company.' },
    { id: 'map', name: 'map', title: 'navigation atlas', sub: 'a preview. departures leave from the port.' },
    { id: 'orbit', name: 'flight', title: 'transfer planning', sub: 'a preview. the server flies the ship.' },
]

/**
 * the shell. the client owns the session; the app owns navigation,
 * the visual hull choice, and notifications.
 */
class TheseusApp extends AppElement {
    static properties = {
        view   : { state: true },
        session: { state: true },
        status : { state: true },
        authed : { state: true },
        hull   : { state: true },
        slotId : { state: true },
        fleet  : { state: true },
        toast  : { state: true },
        now    : { state: true },
    }

    declare view: View
    declare session: Session
    declare status: ClientStatus
    declare authed: boolean
    declare hull: HullId
    declare slotId?: string
    declare fleet: boolean
    declare toast: string
    declare now: number

    readonly client = new GameClient
    readonly theme = new ThemeController(this)
    private toastTimer?: ReturnType<typeof setTimeout>
    private clock?: ReturnType<typeof setInterval>
    private previousFocus?: HTMLElement

    constructor() {
        super()
        this.view = 'port'
        this.session = emptySession()
        this.status = 'offline'
        this.authed = false
        this.hull = readHull()
        this.fleet = false
        this.toast = ''
        this.now = Date.now()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.client.onChange = s => { this.session = s }
        this.client.onStatus = st => { this.status = st }
        this.client.onNotify = text => this.notify(text)
        this.client.onAuth = authed => { this.authed = authed; if (!authed) this.view = 'port' }
        this.clock = setInterval(() => { this.now = Date.now() }, 1000)
        this.client.boot()
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearTimeout(this.toastTimer)
        clearInterval(this.clock)
        this.client.logout()
    }

    private notify(message: string) {
        this.toast = message
        clearTimeout(this.toastTimer)
        this.toastTimer = setTimeout(() => { this.toast = '' }, 4200)
    }

    private navigate(view: View, slot?: string) {
        if (slot) this.slotId = slot
        this.view = view
    }

    private openFleet() { this.previousFocus = document.activeElement as HTMLElement; this.fleet = true }
    private closeFleet() { this.fleet = false; this.previousFocus?.focus() }

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
        const hull = hullById(this.hull)
        const { me, ship, log } = this.session
        const where = this.location()
        return html`<div class="app-shell"
            @notification=${ (e: CustomEvent<string>)     => this.notify(e.detail) }
            @navigate=${     (e: CustomEvent<Navigation>) => this.navigate(e.detail.view, e.detail.slot) }
        >
            <header class="topbar">
                <a class="wordmark" href="#port" @click=${ (e: Event) => { e.preventDefault(); this.navigate('port') } } aria-label="theseus home">${ icon('orbit') }<span>theseus<span class="wordmark-dot">.</span></span></a>
                <p class="session"><span class="status-dot" data-status=${ this.status } aria-hidden="true"></span>${ this.status } <span aria-hidden="true">/</span> ${ me?.handle ?? '…' }</p>
                <div class="account">
                    <theme-switch .value=${ this.theme.preference } @theme-preference=${ (e: CustomEvent<'light' | 'dark' | 'system'>) => this.theme.set(e.detail) }></theme-switch>
                    <span class="account-stat"><small>credits</small><b data-testid="credits">${ me ? credits(me.balance) : '—' }</b></span>
                    <span class="account-stat"><small>hold</small><b data-testid="hold">${ cargoLoad(this.session) }<small> / ${ ship?.capacity ?? '—' }</small></b></span>
                    ${ button({ label: 'select hull preview', class: 'avatar', variant: 'text', click: () => this.openFleet() }, (me?.handle ?? 'rr').slice(0, 2)) }
                    ${ button({ label: 'log out', variant: 'text', click: () => this.client.logout('logged out') }) }
                </div>
            </header>
            <nav class="navrail" aria-label="operations">${ views.map(v => html`<button class="nav-item" aria-current=${ this.view === v.id ? 'page' : nothing } @click=${ () => this.navigate(v.id) } title=${ v.name }>${ icon(v.id) }<span>${ v.name }</span></button>`) }
                <aside class="rail-bottom"><span>${ ship?.stid?.split('.')[ 0 ] ?? '—' }</span><span data-shape aria-hidden="true"></span><small>${ ship?.rig ?? '' }</small></aside>
            </nav>
            <main class="workspace view-${ this.view }">
                <header class="page-heading"><hgroup><small data-kicker>${ String(views.indexOf(active) + 1).padStart(2, '0') } / ${ active.name }</small><h1>${ active.title }</h1><p>${ active.sub }</p></hgroup><p class="location"><span class="status-dot" aria-hidden="true"></span>${ where.text }<small>${ where.note }</small></p></header>
                <port-screen   .session=${ this.session } .client=${ this.client } .active=${ this.view === 'port' } ?hidden=${ this.view !== 'port' }></port-screen>
                <rig-screen    .session=${ this.session } .client=${ this.client } .hull=${ this.hull } .slotId=${ this.slotId } .active=${ this.view === 'rig' } ?hidden=${ this.view !== 'rig' }></rig-screen>
                <market-screen .session=${ this.session } .client=${ this.client } .hull=${ this.hull } .active=${ this.view === 'market' } ?hidden=${ this.view !== 'market' }></market-screen>
                <comms-screen  .session=${ this.session } .client=${ this.client } .active=${ this.view === 'comms' } ?hidden=${ this.view !== 'comms' }></comms-screen>
                <flight-screen .session=${ this.session } .client=${ this.client } .active=${ this.view === 'orbit' } ?hidden=${ this.view !== 'orbit' }></flight-screen>

                <atlas-view .active=${ this.view === 'map' } ?hidden=${ this.view !== 'map' }
                    @local-orbit-focus=${ () => this.navigate('orbit') }
                    @travel-example-complete=${ (e: CustomEvent<string>) => this.notify(`arrival preview complete · ${ e.detail }`) }></atlas-view>
                <footer class="bottom-strip">
                    <div class="ship-signature"><span class="category-mark ${ hull.category }">${ icon('rig') }</span><div><small>${ ship?.hull ?? 'hull' } / ${ hull.name } preview</small><button @click=${ () => this.openFleet() }>${ ship?.name ?? 'awaiting ship' } <span>↗</span></button></div></div>
                    <aside class="recent-event"><small>ship log</small><p class=${ `log-${ log[ 0 ]?.kind ?? 'dim' }` }>${ log[ 0 ]?.text ?? 'terminal ready' }</p></aside>
                    ${ button({ label: 'hull catalog', class: 'fleet-trigger', variant: 'text', icon: 'arrow', click: () => this.openFleet() }, html`hull catalog`) }
                </footer>
            </main>
            ${ this.toastOutput() }
            <fleet-catalog .open=${ this.fleet } .hull=${ this.hull } @catalog-close=${ () => this.closeFleet() } @hull-select=${ (e: CustomEvent<HullId>) => this.selectHull(e.detail) }></fleet-catalog>
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
