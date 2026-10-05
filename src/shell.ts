import { fixture } from './content/fixtures.ts'
import { FixtureClient } from './core/fixture.ts'
import { GameClient } from './core/client.ts'
import { Stage } from './world/stage.ts'
import { Chart } from './places/chart.ts'
import { Exchange } from './places/exchange.ts'
import { Hold } from './places/hold.ts'
import { Port } from './places/port.ts'
import { Room } from './places/room.ts'
import { Router } from './places/router.ts'
import { mount } from './kit/index.ts'
import { Fail } from './core/util.ts'

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
const port   = new Port(stage, kit, hull ? `far-treasure-${ hull }` : void 0)
const client = name
    ? new FixtureClient(() => fixture(name))
    : new GameClient

const router = new Router({ port, exchange: new Exchange(stage, kit, client), hold: new Hold(stage, kit), chart: new Chart(stage, kit, client), rigging: new Room(stage), comms: new Room(stage) })

router.onPlace   = place => kit.hud.place = place
client.onNotify  = (text, kind) => kit.toast.say(text, kind === 'err')
client.onAuth    = authed => kit.auth.hidden = authed
client.onEffect  = e => router.effect(e)

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
    router.sync(s)
}
client.boot()
