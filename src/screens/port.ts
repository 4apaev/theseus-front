import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button } from '../components/controls.ts'
import { FACILITIES, type StationFacility } from '../render/lem-station.ts'
import '../render/lem-scene.ts'

class PortScreen extends GameScreen {
    static properties = { selected: { state: true }}
    declare selected: StationFacility

    constructor() { super(); this.selected = 'rig' }

    override render() {
        if (!this.active) return nothing
        const facility = FACILITIES.find(f => f.id === this.selected)!
        return html`<div class="operations lem-port">
            <section class="viewport lem-viewport" aria-label="lem station" data-motion=${ this.motion }>
                <div class="celestial-ether" aria-hidden="true"></div>
                <div class="port-planet" aria-hidden="true"></div>
                <lem-scene .selected=${ this.selected } .motion=${ this.motion }
                    @station-select=${ (event: CustomEvent<StationFacility>) => { this.selected = event.detail } }
                    @motion-toggle=${ () => { this.motion = !this.motion } }></lem-scene>
                <header class="scene-title"><span class="tiny-rule" aria-hidden="true"></span><span>stanisław lem orbital observatory<small>earth high orbit / independent trading port</small></span></header>
                <aside class="station-drawing"><b>lem station</b><small>observatory / trading port</small><span>sol system <span>berth 04</span></span></aside>
            </section>
            <app-panel>
                ${ this.panelHeader('station directory', 'a port of many hands', 'open') }
                <p class="panel-intro">an observatory, a trading hall, and generations of repairs. the listening array is still at work.</p>
                <nav class="facility-list" aria-label="facility directory">${ FACILITIES.map((f, i) => html`<button class="facility-card" aria-pressed=${ this.selected === f.id } @click=${ () => { this.selected = f.id } }><span class="facility-number">0${ i + 1 }</span><span><b>${ f.name }</b><small>${ f.note }</small></span></button>`) }</nav>
                <section class="facility-detail" aria-label="selected facility" aria-live="polite">
                    <small data-kicker>selected facility</small><h3>${ facility.name }</h3>
                    <p>${ facility.description }</p>
                    ${ button({ label: facility.action, variant: 'primary', icon: 'arrow', click: () => this.navigate(facility.id) }) }
                </section>
                <p class="listening-status"><span class="status-dot" aria-hidden="true"></span>listening array active<small>no confirmed contact</small></p>
                ${ button({ label: 'plot a departure', icon: 'arrow', click: () => this.navigate('map') }) }
                <small class="footnote">local sandbox · operations reset on reload</small>
            </app-panel>
        </div>`
    }
}
customElements.define('port-screen', PortScreen)
