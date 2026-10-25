import { html } from 'lit'
import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Stop, flowOf } from '../core/market.ts'
import { type Session, goodName, stationName } from '../core/session.ts'
import { fmtYears } from '../core/util.ts'
import type { Palette } from '../content/palettes.ts'
import { iconOf } from '../content/places.ts'
import { worldOf } from '../content/stations.ts'
import type { Kit } from '../kit/index.ts'
import { type KitMark, beside } from '../kit/mark.ts'
import { tilesOf } from '../kit/tray.ts'
import { type At, CELL, Plane } from '../world/plane.ts'
import type { Stage } from '../world/stage.ts'
import { picture } from '../world/toy.ts'
import type { Place } from './router.ts'
import { Click } from './click.ts'
import { Trade } from './trade.ts'

/**
 * the market of the toy look: one good at a time, on a plane the player
 * turns and zooms. here in the middle; the stations that make the good
 * on the left, the stations that want it on the right, each on its tile,
 * its route from here, its years from here on its label. the tray picks
 * the good. here opens the trade card; another station opens its own.
 */
export class Market implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly trade: Trade
    private readonly stops = new Map<string, Stop & { makes: boolean }>
    private session?: Session
    private plane?: Plane
    private good?: T.Sprite
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private gid?: string
    private drawn = ''
    private readonly click: Click

    constructor(stage: Stage, kit: Kit, client: GameClient, p: Palette) {
        this.stage = stage
        this.kit   = kit
        this.p     = p
        this.trade = new Trade(kit, client)
        this.trade.onTrade = () => this.session && this.sync(this.session)
        this.click = new Click(stage, () => this.plane ? [ this.plane.group ] : [], hit => hit.userData.stid && this.open(hit.userData.stid))
        kit.tray.addEventListener('pick', e => this.choose((e as CustomEvent<string>).detail))
        kit.view.addEventListener('turn', e => this.plane && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.plane && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.kit.tray.hidden = this.kit.view.hidden = false
        this.untick = this.stage.tick(t => this.tick(t))
        this.click.on()
        this.sync(s)
    }

    sync(s: Session) {
        this.session = s
        this.trade.sync(s)
        if (!s.market.some(m => m.gid === this.gid)) this.gid = s.market[ 0 ]?.gid
        this.kit.tray.tiles = tilesOf(s, this.trade.busy)
        if (`${ s.ship?.stid } ${ this.gid }` !== this.drawn) this.draw(s)
    }

    leave() {
        this.untick?.()
        this.click.off()
        this.clear()
        this.drawn = ''
        this.kit.tray.hidden = this.kit.view.hidden = true
        this.kit.card.close()
    }

    // a new station frames the plane; a new good keeps the player's view
    private draw(s: Session) {
        const here = s.ship?.stid, gid = this.gid, moved = !this.drawn.startsWith(`${ here } `)
        this.clear()
        if (!here || !gid) return
        this.drawn = `${ here } ${ gid }`
        const plane = this.plane = new Plane(this.p, 8), { makers, buyers } = flowOf(s, gid)
        plane.tile([ 0, 0 ], [ 3, 3 ], this.p.green, true)
        this.station(s, here, [ 0, 0 ], 'here')
        makers.forEach((m, i) => this.spoke(s, { ...m, makes: true }, i, makers.length))
        buyers.forEach((b, i) => this.spoke(s, { ...b, makes: false }, i, buyers.length))
        this.good = this.sprite(iconOf(gid, s.universe?.goods[ gid ]?.kind), [ 0, 0 ], 1.2)
        this.stage.scene.add(plane.group)
        if (!moved) return
        this.stage.view(new T.Vector3, 11 * CELL)
        this.stage.tilt(.06, .3)
    }

    // makers on the left flow into here, buyers on the right flow out of it, the nearest first. every route runs on grid lines
    private spoke(s: Session, stop: Stop & { makes: boolean }, i: number, n: number) {
        const side = stop.makes ? -1 : 1, z = (i - (n - 1) / 2) * (n === 2 ? 4 : 3), e = Math.max(-1, Math.min(1, Math.round(z / 3))), x = side * 5
        const at: At[] = [[ side * 1.5, e ], [ side * 3, e ], [ side * 3, z ], [ side * 4, z ]]
        const color = stop.makes ? this.p.green : this.p.red
        this.plane?.route(stop.makes ? at.reverse() : at, stop.makes ? [ color, this.p.cream ] : [ this.p.cream, color ])
        this.plane?.tile([ x, z ], [ 2, 2 ], color)
        this.stops.set(stop.stid, stop)
        this.station(s, stop.stid, [ x, z ], `${ fmtYears(stop.years) } y`)
    }

    // a small world on its tile, and its label above it
    private station(s: Session, stid: string, at: At, note: string) {
        this.sprite(worldOf(stid), at, note === 'here' ? 3.2 : 2.6).userData.stid = stid
        const el = this.kit.mark(`${ stationName(s, stid) } · ${ note }`, stid)
        el.here = note === 'here'
        el.addEventListener('pick', () => this.open(stid))
        this.marks.push({ at: this.plane!.point(at, note === 'here' ? 3 : 2.4), el })
    }

    private sprite(src: string, [ x, z ]: At, size: number) {
        const m = new T.Sprite(new T.SpriteMaterial({ map: picture(src), transparent: true }))
        m.center.set(.5, .14)
        m.scale.setScalar(size)
        m.position.set(x, .05, z)
        this.plane?.group.add(m)
        return m
    }

    // here opens the trade; another station tells what it does with the good, and how far it is
    private open(stid: string) {
        const s = this.session, gid = this.gid, stop = this.stops.get(stid)
        if (!s || !gid) return
        if (stid === s.ship?.stid) this.trade.pick(gid, this.kit.tray.side)
        else if (stop) this.kit.card.show(stationName(s, stid), about(goodName(s, gid), stop), stop.makes ? 'maker' : 'buyer')
        beside(this.kit.card, this.marks, stid, v => this.stage.anchor(v))
    }

    private choose(gid: string) {
        if (!this.plane || !this.session) return
        this.gid = gid
        this.draw(this.session)
        this.open(this.session.ship?.stid ?? '')
    }

    private tick(t: number) {
        this.plane?.tick(t)
        this.good?.position.setY(3.4 + Math.sin(t * 2) * .12)
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    private clear() {
        this.plane?.dispose()
        this.plane = this.good = void 0
        this.marks.forEach(m => m.el.remove())
        this.marks = []
        this.stops.clear()
    }
}

function about(good: string, stop: Stop & { makes: boolean }) {
    return html`
        <dl>
            <dt>${ good }</dt>   <dd>${ stop.makes ? 'made here' : 'wanted here' }</dd>
            <dt>from here</dt><dd>${ fmtYears(stop.years) } y · ${ stop.hops } ${ stop.hops > 1 ? 'hops' : 'hop' }</dd>
        </dl>
        <p><a href="#chart">plan the course on the chart</a></p>`
}
