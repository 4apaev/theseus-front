import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { emit } from '../util.ts'
import { button } from '../components/controls.ts'
import { icon } from '../icons.ts'
import { stationView } from '../components/station.ts'
import { MODULES, fitError, powerOf, toggleModule } from '../model.ts'
import type { ModuleId } from '../model.ts'

class RigScreen extends GameScreen {
    static properties = { selectedModule: { attribute: false }}
    declare selectedModule: ModuleId

    constructor() {
        super()
        this.selectedModule = 'cargo'
    }

    private scene() {
        return stationView({ host: this, game: this.game, mode: 'rig', selected: this.selectedModule, motion: this.motion, toggleMotion: () => { this.motion = !this.motion }, navigate: view => this.navigate(view), selectModule: id => { this.selectedModule = id; emit(this, 'module-selection', id) } })
    }

    override render() {
        if (!this.active) return nothing
        return html`<div class="operations">${ this.scene() }<app-panel>${ this.rigPanel() }</app-panel></div>`
    }

    private rigPanel() {
        const id = this.selectedModule, module = MODULES[ id ], installed = this.game.fitted.includes(id), error = fitError(this.game, id)
        return html`${ this.panelHeader('attachment / ' + module.slot, module.name, installed ? 'fitted' : 'available') }
            <div class="module-art ${ id }"><span></span><span></span><span></span><span data-shape aria-hidden="true">${ icon(id === 'ansible' ? 'comms' : 'rig') }</span></div>
            <p class="panel-intro">${ module.description }</p>
            <dl><div><dt>module designation</dt><dd>${ module.label }</dd></div><div><dt>power draw</dt><dd>${ module.power } <small>units</small></dd></div><div><dt>${ id === 'cargo' ? 'additional capacity' : id === 'drive' ? 'fitted acceleration' : 'transmission mode' }</dt><dd>${ id === 'cargo' ? '+20 units' : id === 'drive' ? '0.14 m/s²' : 'delayed / private' }</dd></div></dl>
            <div class="power-readout"><span>reactor allocation <b>${ powerOf(this.game) } / 8</b></span><div class="power-segments">${ Array.from({ length: 8 }, (_, i) => html`<span data-shape aria-hidden="true" class=${ i < powerOf(this.game) ? 'used' : '' }></span>`) }</div><small>3 core + ${ powerOf(this.game) - 3 } attachments</small></div>
            <p class=${ error ? 'validation error' : 'validation' }>${ error || (installed ? 'attachment online · ready to release' : 'compatible mount · ready to install') }</p>
            ${ button({ label: installed ? 'remove module' : 'install module', variant: installed ? 'secondary' : 'primary', disabled: !!error, icon: installed ? 'minus' : 'plus', click: () => this.act(() => toggleModule(this.game, id), `${ module.name } ${ installed ? 'removed' : 'installed' }`) }) }
            <small class="footnote">prototype workbench · modules are supplied free</small>`
    }
}
customElements.define('rig-screen', RigScreen)
