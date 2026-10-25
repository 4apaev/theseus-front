import { html } from 'lit'
import type { GameClient } from '../core/client.ts'
import { type Session, aboard, goodName } from '../core/session.ts'
import { Fail } from '../core/util.ts'
import { iconOf } from '../content/places.ts'
import { SKINS, mySkinName, useSkin } from '../content/skins.ts'
import { type Kit, previewRows, shipRows } from '../kit/index.ts'
import { save } from '../settings.ts'

/**
 * the rigging's cards. a slot: what is fitted, and the modules of its
 * family in the hold. a module is previewed first; the server computes
 * the stats. then install, or remove. the ship's card renames it and
 * picks its skin: a new skin shows at once, `onSkin`, and this browser
 * keeps it. the place puts each card next to its thing: `near` gets the
 * slot, or `ship`.
 */
export class Fitting {
    private readonly kit: Kit
    private readonly client: GameClient
    private readonly near: (value: string) => void
    /** the place shows the player's new skin. */
    onSkin?: () => void
    private session?: Session

    constructor(kit: Kit, client: GameClient, near: (value: string) => void) {
        this.kit    = kit
        this.client = client
        this.near   = near
    }

    sync(s: Session) {
        this.session = s
    }

    slot(slot: string) {
        const s = this.session, u = s?.universe, ship = s?.ship
        const family = u?.hulls[ ship?.hull ?? '' ]?.slots.find(x => x.id === slot)?.family
        if (!s || !u || !family) return
        const fitted = s.fitted.find(f => f.slot === slot)?.gid
        const spare = s.cargo.filter(c => u.modules[ c.gid ]?.family === family)
        this.kit.card.show(slot, html`
            <p>${ fitted ? goodName(s, fitted) : 'empty' }</p>
            ${ fitted ? html`<menu><button @click=${ () => this.act(this.client.remove(slot)) }>remove</button></menu>` : '' }
            ${ spare.length
                ? html`<ul>${ spare.map(c => html`<li><button @click=${ () => this.preview(slot, c.gid) }><img src=${ iconOf(c.gid, 'module') } alt="">${ goodName(s, c.gid) } × ${ aboard(s, c.gid) }</button></li>`) }</ul>`
                : html`<p><small>no ${ family } module in the hold: buy one at the <a href="#exchange">exchange</a></small></p>` }`, family)
        this.near(slot)
    }

    ship() {
        const s = this.session
        if (!s?.ship) return
        const skins = Object.keys(SKINS).map(k => ({ value: k, label: k }))
        this.kit.card.show(s.ship.name, html`
            ${ shipRows(s) }
            <form @submit=${ this.rename }>
                <input name="name" .value=${ s.ship.name } aria-label="name" required>
                <label>skin <kit-select name="skin" .choices=${ skins } .value=${ mySkinName() } @change=${ (e: CustomEvent<string>) => this.skin(e.detail) }></kit-select></label>
                <button>save</button>
            </form>`, s.ship.hull)
        this.near('ship')
    }

    // the server's preview of one fit, then install
    private async preview(slot: string, gid: string) {
        const s = this.session
        if (!s) return
        try {
            const p = await this.client.preview(slot, gid)
            this.kit.card.show(`${ slot } ← ${ goodName(s, gid) }`, html`
                ${ previewRows(s, p) }
                <menu><button ?disabled=${ p.errors.length > 0 } @click=${ () => this.act(this.client.install(slot, gid)) }>install</button></menu>`, 'preview')
        }
        catch (x) {
            this.kit.toast.say(Fail.from(x).message, true)
        }
    }

    private readonly rename = (e: SubmitEvent) => {
        e.preventDefault()
        const name = String(new FormData(e.target as HTMLFormElement).get('name')).trim()
        if (name) this.act(this.client.rename(name, mySkinName()))
    }

    private skin(name: string) {
        useSkin(name)
        save({ skin: name })
        this.onSkin?.()
    }

    private act(command: Promise<unknown>) {
        this.kit.card.close()
        command.catch(x => this.kit.toast.say(Fail.from(x).message, true))
    }
}
