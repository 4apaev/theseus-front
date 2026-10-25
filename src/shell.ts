import { fixture  } from './content/fixtures.ts'
import { palette  } from './content/palettes.ts'
import { useSkin  } from './content/skins.ts'

import { Fail          } from './core/util.ts'
import { GameClient    } from './core/client.ts'
import { type Session, stationName } from './core/session.ts'
import { FixtureClient } from './core/fixture.ts'

import { Stage           } from './world/stage.ts'
import { loads           } from './world/loader.ts'
import { hex, usePalette } from './world/toy.ts'

import { Bay      } from './places/bay.ts'
import { Net      } from './places/net.ts'
import { Port     } from './places/port.ts'
import { Atlas    } from './places/atlas.ts'
import { Transit  } from './places/transit.ts'
import { Market   } from './places/market.ts'
import { Crates   } from './places/crates.ts'
import { Orbit    } from './places/orbit.ts'
import { Router   } from './places/router.ts'
import { hover    } from './places/hover.ts'

import { mount, theme         } from './kit/index.ts'

import { html                 } from 'lit'
import { save, settings       } from './settings.ts'
import { speak, voices        } from './util.speak.ts'
import { Sounds               } from './sound.ts'

/**
 * the client: boot it, mount the stage and the kit, and let the router
 * show one place. in transit only the sky shows, until the flight place
 * exists. `?fixture=docked` needs no gateway. without it the client logs
 * in on the gateway, or reuses a saved token. `?theme=` picks the
 * palette: meadow (the first), toybox, lagoon or postcard.
 */
const query  = new URLSearchParams(location.search)
const name   = query.get('fixture')
const main   = document.querySelector('main') as HTMLElement
const stage  = new Stage(main)
const kit    = mount(main)
const toy    = palette(query.get('theme'))
const sounds = new Sounds

useSkin(settings.skin)

// the dev server lets a test, or the console, reach the stage
if (import.meta.env.DEV) Object.assign(globalThis, { stage })

// the palette, before the places: they read its colours
theme(main, query.get('theme') ?? 'meadow', toy)
stage.backdrop(hex(toy.space))
usePalette(toy)

const client = name
    ? new FixtureClient(() => fixture(name))
    : new GameClient

const router = new Router({
    port    : new Port(stage, kit),
    transit : new Transit(stage, kit),
    exchange: new Market(stage, kit, client, toy),
    rigging : new Bay(stage, kit, client, toy),
    chart   : new Atlas(stage, kit, client, toy),
    comms   : new Net(stage, kit, client, toy),
    hold    : new Crates(stage, kit, toy),
    orbit   : new Orbit(stage, kit, toy),
})

// a line at the top grows while models load, and goes when all are in
loads.onProgress = (_, done, total) => main.style.setProperty('--loaded', String(done / total))
loads.onStart    = () => main.toggleAttribute('data-loading', true)
loads.onLoad     = () => main.toggleAttribute('data-loading', false)

// a label lights under the pointer; a closed card lets go of its thing
hover(stage, main)
kit.card.addEventListener('close', () => main.querySelectorAll('kit-mark[selected]').forEach(m => m.removeAttribute('selected')))

router.onPlace   = place => {
    kit.hud.place = place
    stage.arrive()
    sounds.hum(place)
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
    if (rigged === void 0 || filled(s) === rigged) return
    sounds.cue(filled(s) > rigged ? 'install' : 'remove')
    rigged = void 0
}
client.boot()

// ── settings and arrivals ────────────────────────────────────

stage.calm = settings.calm
sounds.on  = settings.sound

kit.hud.addEventListener('settings', () => {

    const pick = (patch: Partial<typeof settings>) => {
        save(patch)
        stage.calm = settings.calm
        sounds.on  = settings.sound
        sounds.hum(kit.hud.place ?? '')
    }

    const onChange = (e: Event) => {
        const f = e.currentTarget as HTMLFormElement
        pick({ voice: f.voice.value, sound: f.sound.checked, calm: f.calm.checked })
    }

    const voice = [ '', ...Object.keys(voices).sort() ].map(v => ({ value: v, label: v || 'off' }))

    kit.card.show('settings', html`
        <form @change=${ onChange }>
            <label>voice <kit-select name="voice" .choices=${ voice } .value=${ settings.voice }></kit-select></label>
            <label>sounds      <input type="checkbox" name="sound" ?checked=${ settings.sound }></label>
            <label>calm motion <input type="checkbox" name="calm"  ?checked=${ settings.calm  }></label>
        </form>`)
    void kit.card.updateComplete.then(() => kit.card.at = [ main.clientWidth, 60 ])
})

// the cues: a trade, a flight, a letter. a rig change waits for the new rig, then hears a module on or off
let rigged: number | undefined
const filled = (s: Session) => s.fitted.filter(f => f.gid).length

client.onEffect = e => {
    router.effect(e)
    if (e.kind === 'cargo') sounds.cue(e.delta > 0 ? 'buy' : 'sell')
    if (e.kind === 'letter') sounds.cue(e.in ? 'letterIn' : 'letterOut')
    if (e.kind === 'rig') rigged ??= filled(client.session)
    if ((e.kind === 'depart' || e.kind === 'arrive') && e.mine) sounds.cue(e.kind)
    if (e.kind === 'arrive' && e.mine && settings.voice) speak(`arrived at ${ stationName(client.session, e.stid) }`, voices[ settings.voice ])
}
