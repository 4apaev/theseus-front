import { html, nothing } from 'lit'
import { AppElement } from './components/element.ts'
import { button } from './components/controls.ts'
import { icon } from './icons.ts'
import { credits, Fail } from './util.ts'
import { HULLS, initialState, hullOf, loadOf, capacityOf, changeHull } from './model.ts'
import type { View, GameState, ModuleId, HullId } from './model.ts'
import type { Navigation, GameChange } from './screens/base.ts'
import { ThemeController } from './theme.ts'
import './components/panel.ts'
import './components/fleet.ts'
import './components/theme-switch.ts'
import './screens/port.ts'
import './screens/rig.ts'
import './screens/market.ts'
import './screens/comms.ts'
import './screens/flight.ts'

const views: { id: View, name: string, title: string, sub: string }[] = [
    { id: 'port', name: 'port', title: 'sol outpost', sub: 'a small foothold in the infinite.' },
    { id: 'rig', name: 'rigging', title: 'ship operations', sub: 'every attachment changes the equation.' },
    { id: 'market', name: 'exchange', title: 'market operations', sub: 'something to carry. somewhere to go.' },
    { id: 'comms', name: 'comms', title: 'the quiet between', sub: 'a signal is a kind of company.' },
    { id: 'map', name: 'map', title: 'navigation atlas', sub: 'a course through the quiet.' },
    { id: 'orbit', name: 'flight', title: 'transfer planning', sub: 'nothing moves without a cost.' },
]

class TheseusApp extends AppElement {
    static properties = { view: { state: true }, game: { state: true }, selectedModule: { state: true }, fleet: { state: true }, toast: { state: true }}
    declare view: View
    declare game: GameState
    declare selectedModule: ModuleId
    declare fleet: boolean
    declare toast: string
    readonly theme = new ThemeController(this)
    private toastTimer?: ReturnType<typeof setTimeout>
    private previousFocus?: HTMLElement

    constructor() {
        super()
        this.view = 'port'
        this.game = initialState()
        this.selectedModule = 'cargo'
        this.fleet = false
        this.toast = ''
    }

    override disconnectedCallback() { super.disconnectedCallback(); clearTimeout(this.toastTimer) }

    private notify(message: string) {
        this.toast = message
        clearTimeout(this.toastTimer)
        this.toastTimer = setTimeout(() => { this.toast = '' }, 4200)
    }

    private navigate(view: View, module?: ModuleId) {
        if (module) this.selectedModule = module
        this.view = view
    }

    private openFleet() { this.previousFocus = document.activeElement as HTMLElement; this.fleet = true }
    private closeFleet() { this.fleet = false; this.previousFocus?.focus() }
    private selectHull(id: HullId) {
        try {
            this.game = changeHull(this.game, id)
            this.closeFleet()
            this.notify(`${ hullOf(this.game).name } selected`)
            this.navigate('rig')
        }
        catch (error) { this.notify(Fail.from(error).message) }
    }

    override render() {
        const active = views.find(v => v.id === this.view)!
        const hull = hullOf(this.game)
        return html`<div class="app-shell"
            @notification=${     (e: CustomEvent<string>)     => this.notify(e.detail) }
            @navigate=${         (e: CustomEvent<Navigation>) => this.navigate(e.detail.view, e.detail.module) }
            @game-change=${      (e: CustomEvent<GameChange>) => { this.game = e.detail.game; this.notify(e.detail.message) } }
            @module-selection=${ (e: CustomEvent<ModuleId>)   => { this.selectedModule = e.detail } }
        >
            <header class="topbar">
                <a class="wordmark" href="#port" @click=${ (e: Event) => { e.preventDefault(); this.navigate('port') } } aria-label="theseus home">${ icon('orbit') }<span>theseus<span class="wordmark-dot">.</span></span></a>
                <p class="session"><span class="status-dot" aria-hidden="true"></span>local prototype <span aria-hidden="true">/</span> sol system</p>
                <div class="account">
                    <theme-switch .value=${ this.theme.preference } @theme-preference=${ (e: CustomEvent<'light' | 'dark' | 'system'>) => this.theme.set(e.detail) }></theme-switch>
                    <span class="account-stat"><small>credits</small><b data-testid="credits">${ credits(this.game.credits) }</b></span>
                    <span class="account-stat"><small>hold</small><b data-testid="hold">${ loadOf(this.game) }<small> / ${ capacityOf(this.game) }</small></b></span>
                    ${ button({ label: 'select ship hull', class: 'avatar', variant: 'text', click: () => this.openFleet() }, 'rr') }
                </div>
            </header>
            <nav class="navrail" aria-label="operations">${ views.map(v => html`<button class="nav-item" aria-current=${ this.view === v.id ? 'page' : nothing } @click=${ () => this.navigate(v.id) } title=${ v.name }>${ icon(v.id) }<span>${ v.name }</span></button>`) }
                <aside class="rail-bottom"><span>sol</span><span data-shape aria-hidden="true"></span><small>04</small></aside>
            </nav>
            <main class="workspace view-${ this.view }">
                <header class="page-heading"><hgroup><small data-kicker>${ String(views.indexOf(active) + 1).padStart(2, '0') } / ${ this.view === 'port' ? 'port authority' : active.name }</small><h1>${ active.title }</h1><p>${ active.sub }</p></hgroup><p class="location"><span class="status-dot" aria-hidden="true"></span>${ this.view === 'map' ? 'map simulation' : 'docked' }<small>${ this.view === 'map' ? 'local preview / sol' : 'sol outpost / berth 04' }</small></p></header>
                <port-screen   .game=${ this.game } .active=${ this.view === 'port' } ?hidden=${ this.view !== 'port' }></port-screen>
                <rig-screen    .game=${ this.game } .selectedModule=${ this.selectedModule } .active=${ this.view === 'rig' } ?hidden=${ this.view !== 'rig' }></rig-screen>
                <market-screen .game=${ this.game } .active=${ this.view === 'market' } ?hidden=${ this.view !== 'market' }></market-screen>
                <comms-screen  .game=${ this.game } .active=${ this.view === 'comms' } ?hidden=${ this.view !== 'comms' }></comms-screen>
                <flight-screen .game=${ this.game } .active=${ this.view === 'orbit' } ?hidden=${ this.view !== 'orbit' }></flight-screen>

                <atlas-view .active=${ this.view === 'map' } ?hidden=${ this.view !== 'map' }
                    @local-orbit-focus=${ () => this.navigate('orbit') }
                    @travel-example-complete=${ (e: CustomEvent<string>) => { this.game = { ...this.game, log: [ `travel example complete · ${ e.detail }`, ...this.game.log ].slice(0, 30) }; this.notify(`arrival preview complete · ${ e.detail }`) } }></atlas-view>
                <footer class="bottom-strip"><div class="ship-signature"><span class="category-mark ${ hull.category }">${ icon('rig') }</span><div><small>${ hull.category } / ${ hull.name }</small><button @click=${ () => this.openFleet() }>restless rumor of instinct <span>↗</span></button></div></div><aside class="recent-event"><small>ship log</small><p>${ this.game.log[ 0 ] }</p></aside>${ button({ label: 'hull catalog', class: 'fleet-trigger', variant: 'text', icon: 'arrow', click: () => this.openFleet() }, html`hull catalog <samp>${ HULLS.length }</samp>`) }</footer>
            </main>
            <output class="toast" role="status" aria-live="polite" ?hidden=${ !this.toast }>${ icon('check') }${ this.toast }</output>
            <fleet-catalog .open=${ this.fleet } .game=${ this.game } @catalog-close=${ () => this.closeFleet() } @hull-select=${ (e: CustomEvent<HullId>) => this.selectHull(e.detail) }></fleet-catalog>
        </div>`
    }
}
customElements.define('theseus-app', TheseusApp)
