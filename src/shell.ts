import { fixture  } from './content/fixtures.ts'
import { palette  } from './content/palettes.ts'
import { toyIcons } from './content/places.ts'
import { toyFleet } from './content/fleet.ts'
import { useSkin  } from './content/skins.ts'

import { Fail          } from './core/util.ts'
import { GameClient    } from './core/client.ts'
import { stationName   } from './core/session.ts'
import { FixtureClient } from './core/fixture.ts'

import { Stage           } from './world/stage.ts'
import { hex, usePalette } from './world/toy.ts'

import { Bay      } from './places/bay.ts'
import { Net      } from './places/net.ts'
import { Hold     } from './places/hold.ts'
import { Port     } from './places/port.ts'
import { Atlas    } from './places/atlas.ts'
import { Chart    } from './places/chart.ts'
import { Comms    } from './places/comms.ts'
import { Exchange } from './places/exchange.ts'
import { Transit  } from './places/transit.ts'
import { Market   } from './places/market.ts'
import { Crates   } from './places/crates.ts'
import { Orbit    } from './places/orbit.ts'
import { Router   } from './places/router.ts'
import { hover    } from './places/hover.ts'

import { mount, theme         } from './kit/index.ts'

import { html                 } from 'lit'
import { save, settings       } from './settings.ts'
import { sound, speak, voices } from './util.speak.ts'

/**
 * the new shell, beside the old app until it replaces it: boot the
 * client, mount the stage and the kit, and let the router show one
 * place. in transit only the sky shows, until the flight place exists.
 * `?fixture=docked` needs no gateway. without it the shell logs in on
 * the gateway, or reuses a saved token. `&ship=b` shows a hull variant,
 * `&globe` the station as a small world. `&toy` is the toy look, in
 * `&theme=meadow` (the first), `toybox`, `lagoon` or `postcard`.
 */
const query  = new URLSearchParams(location.search)
const name   = query.get('fixture')
const hull   = query.get('ship')
const main   = document.querySelector('main') as HTMLElement
const stage  = new Stage(main)
const kit    = mount(main)
const toy    = query.has('toy') ? palette(query.get('theme')) : void 0

useSkin(settings.skin)

// the toy look, before the places: they read the fleet and the icons
if (toy) {
    theme(main, query.get('theme') ?? 'meadow', toy)
    stage.backdrop(hex(toy.space))
    usePalette(toy)
    toyFleet()
    toyIcons()
}

const variant = hull ? `far-treasure-${ hull }` : void 0
const port   = new Port(stage, kit, variant, query.has('globe'))
const client = name
    ? new FixtureClient(() => fixture(name))
    : new GameClient

const router = new Router({
    port,
    transit : new Transit(stage, kit, variant),
    exchange: toy ? new Market(stage, kit, client, toy) : new Exchange(stage, kit, client),
    rigging : new Bay(stage, kit, client, toy ?? palette()),
    chart   : toy ? new Atlas(stage, kit, client, toy)  : new Chart(stage, kit, client),
    comms   : toy ? new Net(stage, kit, client, toy)    : new Comms(stage, kit, client),
    hold    : toy ? new Crates(stage, kit, toy)         : new Hold(stage, kit),
    orbit   : new Orbit(stage, kit, toy ?? palette()),
})

// a label lights under the pointer; a closed card lets go of its thing
hover(stage, main)
kit.card.addEventListener('close', () => main.querySelectorAll('kit-mark[selected]').forEach(m => m.removeAttribute('selected')))

router.onPlace   = place => {
    kit.hud.place = place
    stage.arrive()
}
client.onNotify  = (text, kind) => kit.toast.say(text, kind === 'err')
client.onAuth    = authed => kit.auth.hidden = authed

kit.hud.addEventListener('logout', () => client.logout())
kit.auth.addEventListener('auth', async e => {
    const { act, handle, password } = (e as CustomEvent<Record<string, string>>).detail
    Object.assign(kit.auth, { busy: true, error: void 0 })
    try {
        await client[ act === 'register' ? act : 'login' ](handle, password)
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

    const onChange = (e: Event) => {
        const f = e.currentTarget as HTMLFormElement
        pick({ voice: f.voice.value, sound: f.sound.checked, calm: f.calm.checked })
    }

    const voice = [ '', ...Object.keys(voices).sort() ].map(v => ({ value: v, label: v || 'off' }))

    kit.card.show('settings', html`
        <form @change=${ onChange }>
            <label>voice <kit-select name="voice" .choices=${ voice } .value=${ settings.voice }></kit-select></label>
            <label>chime       <input type="checkbox" name="sound" ?checked=${ settings.sound }></label>
            <label>calm motion <input type="checkbox" name="calm"  ?checked=${ settings.calm  }></label>
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
