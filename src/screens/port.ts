import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { button } from '../components/controls.ts'
import { icon } from '../icons.ts'
import { stationView } from '../components/station.ts'

class PortScreen extends GameScreen {
    private scene() {
        return stationView({ host: this, game: this.game, mode: 'port', selected: 'cargo', motion: this.motion, toggleMotion: () => { this.motion = !this.motion }, navigate: view => this.navigate(view), selectModule: id => { this.navigate('rig', id) } })
    }

    override render() {
        if (!this.active) return nothing
        return html`<div class="operations">${ this.scene() }<app-panel>${ this.portPanel() }</app-panel></div>`
    }

    private portPanel() {
        return html`${ this.panelHeader('station manifest', 'welcome to the outpost', 'open') }
            <p class="panel-intro">a little steel between you and the ether. refit, trade, and find your next departure.</p>
            <div class="station-metrics"><div><small>population</small><b>1,284</b></div><div><small>local traffic</small><b>07 <small>vessels</small></b></div></div>
            <div class="facility-list">${ [
                { id: 'rig' as const, number: '01', name: 'drydock', sub: 'modules, power & capacity', note: '3 mounts' },
                { id: 'market' as const, number: '02', name: 'commodity exchange', sub: 'ore produced · grain wanted', note: 'trading' },
                { id: 'comms' as const, number: '03', name: 'relay array', sub: 'station channel & private signals', note: '2 channels' },
            ].map(f => html`<button class="facility-card" @click=${ () => this.navigate(f.id) }><span class="facility-number">${ f.number }</span><span><b>${ f.name }</b><small>${ f.sub }</small></span>${ icon('arrow') }</button>`) }</div>
            <div class="notice"><span class="tiny-rule"></span><p><b>outbound bulletin</b><br>outer depots are requesting grain.<br>check your hold before you burn.</p></div>
            ${ button({ label: 'plot a departure', variant: 'primary', icon: 'arrow', click: () => this.navigate('map') }) }<small class="footnote">local sandbox · operations reset on reload</small>`
    }
}
customElements.define('port-screen', PortScreen)
