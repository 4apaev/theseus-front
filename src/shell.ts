import { fixture } from './content/fixtures.ts'
import { FixtureClient } from './core/fixture.ts'
import { GameClient } from './core/client.ts'
import { Stage } from './world/stage.ts'
import { Chart } from './places/chart.ts'
import { Comms } from './places/comms.ts'
import { Exchange } from './places/exchange.ts'
import { Hold } from './places/hold.ts'
import { Port } from './places/port.ts'
import { Rigging } from './places/rigging.ts'
import { Router } from './places/router.ts'
import { Transit } from './places/transit.ts'
import { mount } from './kit/index.ts'
import { Fail } from './core/util.ts'
import { stationName } from './core/session.ts'
import { html } from 'lit'
import { save, settings } from './settings.ts'
import { sound, speak, voices } from './util.speak.ts'

/**
 * the new shell, beside the old app until it replaces it: boot the
 * client, mount the stage and the kit, and let the router show one
 * place. in transit only the sky shows, until the flight place exists.
 * `?fixture=docked` needs no gateway. without it the shell logs in on
 * the gateway, or reuses a saved token. `&ship=b` shows a hull variant.
 */
const query  = new URLSearchParams(location.search)
const name   = query.get('fixture')
const hull   = query.get('ship')
const main   = document.querySelector('main') as HTMLElement
const stage  = new Stage(main)
const kit    = mount(main)
const variant = hull ? `far-treasure-${ hull }` : void 0
const port   = new Port(stage, kit, variant)
const client = name
    ? new FixtureClient(() => fixture(name))
    : new GameClient

const router = new Router({ port, exchange: new Exchange(stage, kit, client), hold: new Hold(stage, kit), chart: new Chart(stage, kit, client), transit: new Transit(stage, kit, variant), rigging: new Rigging(stage, kit, client, variant), comms: new Comms(stage, kit, client) })

router.onPlace   = place => kit.hud.place = place
client.onNotify  = (text, kind) => kit.toast.say(text, kind === 'err')
client.onAuth    = authed => kit.auth.hidden = authed

kit.hud.addEventListener('logout', () => client.logout())
kit.auth.addEventListener('auth', async e => {
    const { act, handle, password } = (e as CustomEvent<Record<string, string>>).detail
    Object.assign(kit.auth, { busy: true, error: void 0 })
    try {
        await (act === 'register' ? client.register(handle, password) : client.login(handle, password))
    }
    catch (x) {
        kit.auth.error = Fail.from(x).message
    }
    kit.auth.busy = false
})
client.onChange  = s => {
    kit.hud.session = s
    kit.log.lines   = s.log
    router.sync(s)
}
client.boot()

// ── settings and arrivals ────────────────────────────────────

stage.calm = settings.calm

kit.hud.addEventListener('settings', () => {
    const pick = (patch: Partial<typeof settings>) => {
        save(patch)
        stage.calm = settings.calm
    }
    kit.card.show('settings', html`
        <form @change=${ (e: Event) => { const f = e.currentTarget as HTMLFormElement; pick({ voice: f.voice.value, sound: f.sound.checked, calm: f.calm.checked }) } }>
            <label>voice <select name="voice">${ [ '', ...Object.keys(voices).sort() ].map(v => html`<option value=${ v } ?selected=${ v === settings.voice }>${ v || 'off' }</option>`) }</select></label>
            <label>chime <input type="checkbox" name="sound" ?checked=${ settings.sound }></label>
            <label>calm motion <input type="checkbox" name="calm" ?checked=${ settings.calm }></label>
        </form>`)
    void kit.card.updateComplete.then(() => kit.card.at = [ main.clientWidth, 60 ])
})

// our ship lands: the chime, and a voice says where
client.onEffect = e => {
    router.effect(e)
    if (e.kind !== 'arrive' || !e.mine) return
    if (settings.sound) void sound.play().catch(() => { /* autoplay blocked */ })
    if (settings.voice) speak(`arrived at ${ stationName(client.session, e.stid) }`, voices[ settings.voice ])
}
