import { html } from 'lit'
import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Session, aboard, goodName } from '../core/session.ts'
import { Fail } from '../core/util.ts'
import { HULLS } from '../content/fleet.ts'
import { type Kit, previewRows, shipRows } from '../kit/index.ts'
import type { KitMark } from '../kit/mark.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import { Painted } from './painted.ts'

/**
 * rigging: the painted yard, our ship close up in front of it, a label
 * on each socket. a slot opens its card: what is fitted, and the
 * modules of its family in the hold. a module is previewed first; the
 * server computes the stats. then install, or remove. the ship's own
 * label opens its card, with rename.
 */
export class Rigging extends Painted {
    private readonly client: GameClient
    private readonly hull: string
    private ship?: Ship
    private marks: { at: () => T.Vector3, el: KitMark }[] = []
    private untick?: () => void

    constructor(stage: Stage, kit: Kit, client: GameClient, hull?: string) {
        super(stage, kit, [ 'rigging', 'outpost' ])
        this.client = client
        this.hull   = hull ?? 'far-treasure'
    }

    sync(s: Session) {
        this.session = s
        void this.ship?.fit(s.fitted)
        this.marks.forEach(m => m.el.name = this.label(s, m.el.value))
    }

    protected reveal(on: boolean) {
        if (on) return void this.build()
        this.untick?.()
        this.ship?.group.removeFromParent()
        this.ship = void 0
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }

    // the ship in front of the yard, a label per socket and one on the hull
    private async build() {
        const ship = this.ship = new Ship(this.hull, HULLS[ this.hull ])
        this.stage.scene.add(ship.group)
        this.stage.view(new T.Vector3(0, 10, 0), 60)
        await ship.ready
        if (this.ship !== ship || !this.session) return
        void ship.fit(this.session.fitted)
        for (const [ slot, socket ] of ship.sockets) this.mark(slot, () => socket.getWorldPosition(new T.Vector3), () => this.slot(slot))
        this.mark('ship', () => ship.group.position.clone().add(new T.Vector3(0, 30, 0)), () => this.hullCard())
        this.untick = this.stage.tick(() => this.marks.forEach(m => m.el.at = this.stage.anchor(m.at())))
        this.sync(this.session)
    }

    private mark(value: string, at: () => T.Vector3, pick: () => void) {
        const el = this.kit.mark(value, value)
        el.addEventListener('pick', pick)
        this.marks.push({ at, el })
    }

    private label(s: Session, slot: string) {
        if (slot === 'ship') return s.ship?.name ?? 'ship'
        const gid = s.fitted.find(f => f.slot === slot)?.gid
        return `${ slot } · ${ gid ? goodName(s, gid) : 'empty' }`
    }

    // a slot: what is fitted, and the modules of its family in the hold
    private slot(slot: string) {
        const s = this.session, u = s?.universe, ship = s?.ship
        const family = u?.hulls[ ship?.hull ?? '' ]?.slots.find(x => x.id === slot)?.family
        if (!s || !u || !family) return
        const fitted = s.fitted.find(f => f.slot === slot)?.gid
        const spare = s.cargo.filter(c => u.modules[ c.gid ]?.family === family)
        this.kit.card.show(slot, html`
            <p>${ fitted ? goodName(s, fitted) : 'empty' }</p>
            ${ fitted ? html`<menu><button @click=${ () => this.act(this.client.remove(slot)) }>remove</button></menu>` : '' }
            ${ spare.length
                ? html`<ul>${ spare.map(c => html`<li><button @click=${ () => this.preview(slot, c.gid) }>${ goodName(s, c.gid) } × ${ aboard(s, c.gid) }</button></li>`) }</ul>`
                : html`<p><small>no ${ family } module in the hold: buy one at the <a href="#exchange">exchange</a></small></p>` }`, family)
        this.place(slot)
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

    private hullCard() {
        const s = this.session
        if (!s?.ship) return
        this.kit.card.show(s.ship.name, html`
            ${ shipRows(s) }
            <form @submit=${ this.rename }><input name="name" .value=${ s.ship.name } aria-label="name" required><button>rename</button></form>`, s.ship.hull)
        this.place('ship')
    }

    private readonly rename = (e: SubmitEvent) => {
        e.preventDefault()
        const name = String(new FormData(e.target as HTMLFormElement).get('name')).trim()
        if (name) this.act(this.client.rename(name))
    }

    private act(command: Promise<unknown>) {
        this.kit.card.close()
        command.catch(x => this.kit.toast.say(Fail.from(x).message, true))
    }

    private place(value: string) {
        const m = this.marks.find(x => x.el.value === value)
        if (m) void this.kit.card.updateComplete.then(() => this.kit.card.at = this.stage.anchor(m.at()))
    }
}
