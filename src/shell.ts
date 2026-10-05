import { fixture } from './content/fixtures.ts'
import { FixtureClient } from './core/fixture.ts'
import { GameClient } from './core/client.ts'
import { Stage } from './world/stage.ts'
import { Port } from './places/port.ts'
import { Room } from './places/room.ts'
import { Router } from './places/router.ts'
import { mount } from './kit/index.ts'

/**
 * the new shell, beside the old app until it replaces it: boot the
 * client, mount the stage and the kit, and let the router show one
 * place. in transit only the sky shows, until the flight place exists.
 * `?fixture=docked` needs no gateway; without it the shell reuses the
 * old app's login token. `&ship=b` shows a hull variant to compare.
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

const router = new Router({ port, exchange: new Room(stage), rigging: new Room(stage), comms: new Room(stage) })

router.onPlace   = place => kit.hud.place = place
client.onNotify  = (text, kind) => kit.toast.say(text, kind === 'err')
client.onChange  = s => {
    kit.hud.session = s
    router.sync(s)
}
client.boot()
