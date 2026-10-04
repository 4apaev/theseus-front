import { fixture } from './content/fixtures.ts'
import { FixtureClient } from './core/fixture.ts'
import { GameClient } from './core/client.ts'
import { docked } from './core/session.ts'
import { Stage } from './world/stage.ts'
import { Port } from './places/port.ts'

/**
 * the new shell, beside the old app until it replaces it: boot the
 * client, mount the stage, enter the port while the ship is docked.
 * in transit only the sky shows, until the flight place exists.
 * `?fixture=docked` needs no gateway; without it the shell reuses the
 * old app's login token.
 */
const name   = new URLSearchParams(location.search).get('fixture')
const port   = new Port(new Stage(document.querySelector('main') as HTMLElement))
const client = name
    ? new FixtureClient(() => fixture(name))
    : new GameClient

let at: string | undefined

client.onChange = s => {
    const stid = docked(s)
        ? s.ship?.stid
        : void 0

    if (stid === at)
        return port.sync(s)

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    at && port.leave()

    if (at = stid)
        void port.enter(s)
}
client.boot()
