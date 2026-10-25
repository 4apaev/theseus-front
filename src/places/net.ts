import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { type Session, peerOf, stationName } from '../core/session.ts'
import type { MessageRow } from '../core/transport/types.ts'
import { span } from '../core/util.ts'
import type { Palette } from '../content/palettes.ts'
import { worldOf } from '../content/stations.ts'
import type { Kit } from '../kit/index.ts'
import type { KitMark } from '../kit/mark.ts'
import { type At, CELL, Plane, along, wire } from '../world/plane.ts'
import type { Stage } from '../world/stage.ts'
import { toon, picture } from '../world/toy.ts'
import { compose, fill } from './comms.ts'
import type { Place } from './router.ts'

interface Node { at: At, up?: string }
interface Letter { m: MessageRow, way: At[], length: number, mesh: T.Object3D, el: KitMark }

/**
 * comms in the toy look: the ansible net on a plane the player turns and
 * zooms. here in the middle, the stations a hop away on a ring round
 * it, 2 hops on a wider ring, each joined to the station it is reached
 * through. a letter in flight rides its way to the peer's station and
 * shows when it lands; a letter to an unknown place waits over here. the
 * comms panel lists the channel and the letters, and sends.
 */
export class Net implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly nodes = new Map<string, Node>
    private plane?: Plane
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private letters: Letter[] = []
    private untick?: () => void
    private drawn = ''
    private told = 0

    constructor(stage: Stage, kit: Kit, client: GameClient, p: Palette) {
        this.stage = stage
        this.kit   = kit
        this.p     = p
        compose(kit, client)
        kit.view.addEventListener('turn', e => this.plane && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.plane && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.kit.comms.hidden = this.kit.view.hidden = false
        this.untick = this.stage.tick(t => this.tick(t))
        this.sync(s)
    }

    sync(s: Session) {
        fill(this.kit, s)
        if (s.ship?.stid !== this.drawn) this.draw(s)
        this.post(s)
    }

    leave() {
        this.untick?.()
        this.clear()
        this.drawn = ''
        this.kit.comms.hidden = this.kit.view.hidden = true
    }

    private draw(s: Session) {
        const here = s.ship?.stid
        this.clear()
        if (!here || !s.universe) return
        this.drawn = here
        this.plane = new Plane(this.p, 9)
        this.lay(s, here)
        this.wires()
        for (const [ stid, n ] of this.nodes) {
            this.plane.tile(n.at, stid === here ? [ 3, 3 ] : [ 2, 2 ], stid === here ? this.p.green : this.p.teal, stid === here)
            this.world(stid, n.at, stid === here ? 2.8 : 2.1)
            this.mark(stationName(s, stid), stid, this.plane.point(n.at, stid === here ? 2.6 : 2))
        }
        this.stage.scene.add(this.plane.group)
        this.stage.view(new T.Vector3, 11 * CELL)
        this.stage.tilt(.06, .3)
    }

    // a route on grid lines from each station into its parent's facing side; routes into one side share its lines out
    private wires() {
        const sides = new Map<string, string[]>
        for (const [ stid, n ] of this.nodes) {
            const up = n.up && this.nodes.get(n.up)
            if (!up) continue
            const [ dx, dz ] = [ n.at[ 0 ] - up.at[ 0 ], n.at[ 1 ] - up.at[ 1 ] ], across = Math.abs(dx) >= Math.abs(dz)
            const key = `${ n.up } ${ across ? 1 : 0 } ${ Math.sign(across ? dx : dz) }`
            sides.set(key, [ ...sides.get(key) ?? [], stid ])
        }
        for (const [ key, kids ] of sides) {
            const [ up, minor ] = key.split(' '), at = this.nodes.get(up)?.at ?? [ 0, 0 ], h = up === this.drawn ? 1 : 0, m = +minor
            kids.sort((a, b) => (this.nodes.get(a)?.at[ m ] ?? 0) - (this.nodes.get(b)?.at[ m ] ?? 0))
            kids.forEach((stid, i) => {
                const kid = this.nodes.get(stid)?.at ?? at
                const e = Math.round(kids.length > 1 ? -h + 2 * h * i / (kids.length - 1) : Math.max(-h, Math.min(h, kid[ m ] - at[ m ])))
                this.plane?.route(wire(at, kid, e, [ up === this.drawn ? 1.5 : 1, 1 ]), [ up === this.drawn ? this.p.cream : this.p.teal, this.p.teal ], .12, 0)
            })
        }
    }

    // here in the middle; a hop away on a ring of 4.2, 2 hops on a ring of 7.4 near the station they come through
    private lay(s: Session, here: string) {
        const routes = s.universe?.routes ?? [], next = (stid: string) => routes.filter(r => r.from === stid).map(r => r.to)
        this.nodes.set(here, { at: [ 0, 0 ]})
        const near = next(here).filter((x, i, all) => x !== here && all.indexOf(x) === i).slice(0, 10)
        near.forEach((stid, i) => this.nodes.set(stid, { at: polar(4.2, (i + .5) / near.length), up: here }))
        const far = near.flatMap(up => next(up).filter(x => !this.nodes.has(x)).map(stid => ({ stid, up })))
            .filter((x, i, all) => all.findIndex(y => y.stid === x.stid) === i).slice(0, 8)
        far.forEach(({ stid, up }, i) => this.nodes.set(stid, { at: polar(7.4, (near.indexOf(up) + .5) / near.length + (i % 2 ? .04 : -.04)), up }))
    }

    // letters in flight: each rides from its sender's station to its reader's, through here
    private post(s: Session) {
        const now = Date.now(), flying = s.messages.filter(m => m.to && !m.delivered && Date.parse(m.deliver) > now)
        if (flying.map(m => m.mid).join() === this.letters.map(l => l.m.mid).join() || !this.plane) return
        for (const l of this.letters) {
            l.mesh.removeFromParent()
            l.el.remove()
        }
        this.letters = flying.map(m => {
            const way = [ ...this.way(s, m.from).reverse(), ...this.way(s, m.to as string).slice(1) ]
            const mesh = envelope(this.p)
            this.plane?.group.add(mesh)
            return { m, way, length: way.slice(1).reduce((n, b, i) => n + Math.hypot(b[ 0 ] - way[ i ][ 0 ], b[ 1 ] - way[ i ][ 1 ]), 0), mesh, el: this.kit.mark('', m.mid) }
        })
        this.told = 0
    }

    // the way from here to a pilot's station, along the net: just here when the pilot is here, or not on the plane
    private way(s: Session, pid: string): At[] {
        const stid = pid === s.me?.pid ? s.ship?.stid : peerOf(s, pid)?.stid
        const out: At[] = []
        for (let n = stid ? this.nodes.get(stid) : void 0; n; n = n.up ? this.nodes.get(n.up) : void 0) out.unshift(n.at)
        return out.length ? out : [[ 0, 0 ]]
    }

    private tick(t: number) {
        this.plane?.tick(t)
        const now = Date.now(), tell = now - this.told > 1000
        for (const l of this.letters) {
            const sent = Date.parse(l.m.sent), f = Math.min(1, Math.max(0, (now - sent) / (Date.parse(l.m.deliver) - sent)))
            along(l.way, f * l.length, l.mesh.position)
            l.mesh.position.y = 1.2 + Math.sin(t * 3) * .1
            l.mesh.rotation.y = t
            l.el.at = this.stage.anchor(l.mesh.getWorldPosition(new T.Vector3).add(new T.Vector3(0, CELL * .6, 0)))
            if (tell) l.el.name = `lands in ${ span(Date.parse(l.m.deliver) - now) }`
        }
        if (tell) this.told = now
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    private world(stid: string, [ x, z ]: At, size: number) {
        const m = new T.Sprite(new T.SpriteMaterial({ map: picture(worldOf(stid)), transparent: true }))
        m.center.set(.5, .14)
        m.scale.setScalar(size)
        m.position.set(x, .05, z)
        m.userData.stid = stid
        this.plane?.group.add(m)
    }

    private mark(name: string, value: string, at: T.Vector3) {
        const el = this.kit.mark(name, value)
        el.here = value === this.drawn
        this.marks.push({ at, el })
    }

    private clear() {
        this.plane?.dispose()
        this.plane = void 0
        this.nodes.clear()
        this.letters.forEach(l => l.el.remove())
        this.letters = []
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }
}

// a point on a ring of radius `r`, `k` of the way round, the first at the back
function polar(r: number, k: number): At {
    const a = k * Math.PI * 2 + Math.PI * .75
    return [ Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r) ]
}

// a toy letter: a fat envelope with a coloured flap
function envelope(p: Palette) {
    const g = new T.Group, body = new T.Mesh(new T.BoxGeometry(.9, .14, .62), toon(p.cream))
    const flap = new T.Mesh(new T.ConeGeometry(.46, .3, 3), toon(p.red))
    flap.rotation.set(Math.PI / 2, 0, 0)
    flap.scale.set(1, 1, .25)
    flap.position.set(0, .1, -.06)
    g.add(body, flap)
    return g
}
