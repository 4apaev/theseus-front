import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Session, goodName } from '../core/session.ts'
import type { Slot } from '../core/transport/types.ts'
import { fleet } from '../content/fleet.ts'
import { mySkin } from '../content/skins.ts'
import type { Palette } from '../content/palettes.ts'
import type { Kit } from '../kit/index.ts'
import { type KitMark, beside } from '../kit/mark.ts'
import { beads, line } from '../world/beads.ts'
import { type At, CELL, Plane } from '../world/plane.ts'
import { Ship } from '../world/ship.ts'
import type { Stage } from '../world/stage.ts'
import { picture } from '../world/toy.ts'
import { Click } from './click.ts'
import { Fitting } from './fitting.ts'
import type { Place } from './router.ts'

// where a family's slot stands inside the ship's outline: the stern left, the bow right
const AT: Record<string, At> = { power: [ 0, 0 ], cruise: [ -4, 0 ], maneuver: [ 2, -3 ], cargo: [ 2, 3 ], utility: [ 4, 0 ]}

// the ship floats this high over its diagram, this long
const LIFT   = 7 * CELL
const LENGTH = 8 * CELL

// sam's module sprites, by family
const SPRITE: Record<string, string> = { power: 'reactor', cruise: 'cruise-drive', maneuver: 'maneuver', cargo: 'cargo', utility: 'antenna' }

/**
 * the rigging of the toy look: the ship's slots as tiles on a plane the
 * player turns and zooms, inside the ship's outline. the reactor feeds
 * the rest: a route runs from it to each module, as thick as the module
 * draws, red when the module needs more than the reactor gives. a slot's
 * label or its module opens the slot's card. the ship floats over its
 * diagram, a dotted line from each socket down to its slot's tile; the
 * ship, or its label, opens the ship's card.
 */
export class Bay implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly fitting: Fitting
    private readonly click: Click
    private plane?: Plane
    private ship?: Ship
    private wires?: T.InstancedMesh
    private readonly tiles = new Map<string, At>
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private drawn = ''

    constructor(stage: Stage, kit: Kit, client: GameClient, p: Palette) {
        this.stage   = stage
        this.kit     = kit
        this.p       = p
        this.fitting = new Fitting(kit, client, value => this.near(value))
        this.fitting.onSkin = () => void this.ship?.wear(mySkin())
        this.click   = new Click(stage, () => [ this.plane?.group, this.ship?.group ].filter(x => !!x), hit => this.pick(hit))
        kit.view.addEventListener('turn', e => this.plane && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.plane && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.kit.view.hidden = false
        this.untick = this.stage.tick((t, dt) => this.tick(t, dt))
        this.click.on()
        this.sync(s)
    }

    sync(s: Session) {
        this.fitting.sync(s)
        if (JSON.stringify(s.fitted) !== this.drawn) this.draw(s)
    }

    leave() {
        this.untick?.()
        this.click.off()
        this.clear()
        this.drawn = ''
        this.kit.view.hidden = true
        this.kit.card.close()
    }

    // a refit redraws the plane and keeps the player's view
    private draw(s: Session) {
        const u = s.universe, slots = u?.hulls[ s.ship?.hull ?? '' ]?.slots ?? [], first = !this.drawn
        this.clear()
        this.drawn = JSON.stringify(s.fitted)
        this.plane = new Plane(this.p, 7)
        this.plane.tile([ 0, 0 ], [ 12, 8 ], this.p.cream)
        // the best power the fitted reactors give
        const given = Math.max(0, ...s.fitted.flatMap(f => u?.modules[ f.gid ]?.provides.filter(r => r.rate === 'power').map(r => r.rank) ?? []))
        slots.forEach((slot, i) => this.slot(s, slot, AT[ slot.family ] ?? [ i * 3 - 6, 6 ], given))
        this.mark(s.ship?.name ?? 'ship', 'ship', new T.Vector3(0, LIFT + LENGTH * .55, 0))
        this.stage.scene.add(this.plane.group)
        this.hull(s)
        if (!first) return
        this.stage.view(new T.Vector3(0, LIFT * .7, 0), 14 * CELL)
        this.stage.tilt(.06, .3)
    }

    // a slot's tile, its module, its route from the reactor, its label. the reactor's label holds the power budget
    private slot(s: Session, slot: Slot, at: At, given: number) {
        const plane = this.plane as Plane, gid = s.fitted.find(f => f.slot === slot.id)?.gid, d = gid ? s.universe?.modules[ gid ] : void 0
        this.tiles.set(slot.id, at)
        const short = !!d?.requires.some(r => r.rate === 'power' && r.rank > given)
        const end = !d ? this.p.line : short ? this.p.red : this.color(slot.family)
        if (slot.family !== 'power') plane.route(feed(at), [ d ? this.p.amber : end, end ], .1 + (d?.power ?? 0) * .07, d?.power ? 1 : 0)
        plane.tile(at, [ 2, 2 ], d ? this.color(slot.family) : this.p.line)
        if (d) this.sprite(`module-${ SPRITE[ slot.family ] }`, at).userData.slot = slot.id
        const watts = slot.family === 'power' ? ` · ${ s.ship?.power ?? 0 } of ${ s.ship?.power_pool ?? 0 } ⚡` : d?.power ? ` · −${ d.power } ⚡` : ''
        const name = gid ? `${ goodName(s, gid) }${ watts }${ short ? ' · needs a better reactor' : '' }` : 'empty'
        this.mark(`${ slot.id } · ${ name }`, slot.id, plane.point(at, 2.2))
    }

    // the player's ship, its modules on, over the diagram
    private hull(s: Session) {
        const ship = this.ship ??= new Ship(fleet.player, LENGTH, mySkin())
        ship.group.userData.mark = 'ship'
        ship.group.position.set(0, LIFT, 0)
        ship.burn(.08)
        this.stage.scene.add(ship.group)
        void ship.fit(s.fitted).then(() => this.drop())
    }

    // a dotted line from each socket down to its slot's tile
    private drop() {
        const plane = this.plane, ship = this.ship
        if (!plane || !ship?.group.parent) return
        ship.group.updateMatrixWorld(true)
        const at = [ ...this.tiles ].flatMap(([ slot, tile ]) => {
            const socket = ship.sockets.get(slot)
            return socket ? line(socket.getWorldPosition(new T.Vector3), plane.point(tile, .4), CELL * .3, CELL * .2) : []
        })
        this.unwire()
        this.stage.scene.add(this.wires = beads(at, [ this.p.cream, this.p.mist ], CELL * .05))
    }

    private unwire() {
        this.wires?.removeFromParent()
        this.wires?.dispose()
        this.wires = void 0
    }

    // a module opens its slot's card, the ship its own
    private pick(hit: T.Object3D) {
        if (hit.userData.slot) return this.fitting.slot(hit.userData.slot)
        for (let o: T.Object3D | null = hit; o; o = o.parent) if (o === this.ship?.group) return this.fitting.ship()
    }

    private color(family: string) {
        const p = this.p
        return { power: p.amber, cruise: p.red, maneuver: p.teal, cargo: p.pink, utility: p.green }[ family ] ?? p.mist
    }

    private sprite(name: string, [ x, z ]: At) {
        const m = new T.Sprite(new T.SpriteMaterial({ map: picture(`${ import.meta.env.BASE_URL }art/toy/sprites/${ name }.webp`), transparent: true }))
        m.center.set(.5, .14)
        m.scale.setScalar(2.2)
        m.position.set(x, .05, z)
        this.plane?.group.add(m)
        return m
    }

    private mark(name: string, value: string, at: T.Vector3) {
        const el = this.kit.mark(name, value)
        el.addEventListener('pick', () => value === 'ship' ? this.fitting.ship() : this.fitting.slot(value))
        this.marks.push({ at, el })
    }

    private near(value: string) {
        beside(this.kit.card, this.marks, value, v => this.stage.anchor(v))
    }

    private tick(t: number, dt: number) {
        this.plane?.tick(t)
        this.ship?.tick(t, dt)
        this.ship?.group.position.setY(LIFT + Math.sin(t * 1.2) * CELL * .1)
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    private clear() {
        this.plane?.dispose()
        this.plane = void 0
        this.ship?.group.removeFromParent()
        this.unwire()
        this.tiles.clear()
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }
}

// the route from the reactor's tile to a slot's tile, on grid lines
function feed([ x, z ]: At): At[] {
    if (!z) return [[ Math.sign(x), 0 ], [ x - Math.sign(x), 0 ]]
    return [[ 0, Math.sign(z) ], [ 0, z ], [ x - 1, z ]]
}
