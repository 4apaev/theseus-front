import { html } from 'lit'
import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Session } from '../core/session.ts'
import { credits } from '../core/util.ts'
import type { Palette } from '../content/palettes.ts'
import type { Kit } from '../kit/index.ts'
import { type Piece, piecesOf } from '../kit/hold.ts'
import { type KitMark, beside } from '../kit/mark.ts'
import { rounded } from '../world/plane.ts'
import type { Stage } from '../world/stage.ts'
import { flat, picture, toon } from '../world/toy.ts'
import { Click } from './click.ts'
import type { Place } from './router.ts'

// metres per cell of the hold
const CELL = 6

// a dry good in a crate, a liquid in a barrel, a gas in a tank
const SHAPES: Record<string, T.BufferGeometry> = {
    dry   : new RoundedBoxGeometry(.84, .8, .84, 3, .14),
    liquid: new T.CylinderGeometry(.38, .38, .84, 24),
    gas   : new T.SphereGeometry(.42, 24, 16),
}

/**
 * the hold of the toy look: a toy box, a cell per unit of capacity. each
 * good fills as many cells as its volume asks, a crate, a barrel or a
 * tank per cell in the colour of its kind; its icon floats over its
 * first cell. a new load drops in. a good opens its card: how much, what
 * it sells for here.
 */
export class Crates implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly p: Palette
    private readonly click: Click
    private readonly group = new T.Group
    private session?: Session
    private pieces: Piece[] = []
    private loads: T.Mesh[] = []
    private icons: T.Sprite[] = []
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private drawn = ''
    private born?: number

    constructor(stage: Stage, kit: Kit, p: Palette) {
        this.stage = stage
        this.kit   = kit
        this.p     = p
        this.group.scale.setScalar(CELL)
        this.click = new Click(stage, () => [ this.group ], hit => hit.userData.gid && this.open(hit.userData.gid))
        kit.view.addEventListener('turn', e => this.group.parent && stage.turn((e as CustomEvent<number>).detail * Math.PI / 8))
        kit.view.addEventListener('zoom', e => this.group.parent && stage.zoom((e as CustomEvent<number>).detail > 0 ? 1.25 : .8))
    }

    enter(s: Session) {
        this.stage.scene.add(this.group)
        this.kit.view.hidden = false
        this.untick = this.stage.tick(t => this.tick(t))
        this.click.on()
        this.sync(s)
    }

    sync(s: Session) {
        this.session = s
        this.pieces = piecesOf(s)
        const key = JSON.stringify([ this.pieces, s.ship?.capacity ])
        if (key !== this.drawn) this.draw(s.ship?.capacity ?? 0, !this.drawn)
        this.drawn = key
    }

    leave() {
        this.untick?.()
        this.click.off()
        this.clear()
        this.drawn = ''
        this.group.removeFromParent()
        this.kit.view.hidden = true
        this.kit.card.close()
    }

    // the box, its cells, a load per used cell. a refit of the hold keeps the player's view
    private draw(capacity: number, first: boolean) {
        this.clear()
        const cols = Math.max(1, Math.ceil(Math.sqrt(capacity * 1.6))), rows = Math.max(1, Math.ceil(capacity / cols))
        // column by column: each good gets its own strip, its label apart from the rest
        const cell = (i: number) => new T.Vector3(Math.floor(i / rows) - (cols - 1) / 2, 0, i % rows - (rows - 1) / 2)
        this.box(cols, rows)
        for (let i = 0; i < capacity; i++) this.lay(new T.Mesh(new T.ShapeGeometry(rounded(.9, .9, .18)), flat(this.p.panel2)), cell(i), .01)
        let i = 0
        for (const piece of this.pieces) {
            const cells = Array.from({ length: Math.max(0, Math.min(piece.cells, capacity - i)) }, () => cell(i++))
            cells.forEach(at => this.load(piece, at))
            this.label(piece, cells.reduce((m, v) => m.add(v), new T.Vector3).divideScalar(cells.length || 1))
        }
        const used = this.pieces.reduce((n, x) => n + x.cells, 0)
        this.mark(`hold · ${ used } / ${ capacity }`, 'hold', new T.Vector3(-cols / 2, 1.2, rows / 2))
        this.born = void 0
        if (!first) return
        this.stage.view(new T.Vector3, Math.max(cols, rows) * CELL * 1.3)
        this.stage.tilt(.06, .32)
    }

    // the toy box: a floor and a fat rounded wall round the cells
    private box(cols: number, rows: number) {
        const [ w, d ] = [ cols + .8, rows + .8 ], wall = rounded(w + .6, d + .6, .7)
        wall.holes.push(rounded(w, d, .4, new T.Path))
        const floor = new T.Mesh(new T.ExtrudeGeometry(rounded(w, d, .4), { depth: .3, bevelEnabled: false }), toon(this.p.panel))
        const rim = new T.Mesh(new T.ExtrudeGeometry(wall, { depth: 1.1, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 3 }), toon(this.p.teal))
        this.lay(floor, new T.Vector3, -.3)
        this.lay(rim, new T.Vector3, -.3)
    }

    // a crate, a barrel or a tank in the colour of the good's kind; it drops in
    private load(piece: Piece, at: T.Vector3) {
        const g = this.session?.universe?.goods[ piece.gid ], m = new T.Mesh(SHAPES[ g?.form ?? '' ] ?? SHAPES.dry, toon(this.tone(g?.kind === 'module' ? 'module' : g?.category)))
        m.position.copy(at).setY(.43)
        m.rotation.y = (this.loads.length % 3 - 1) * .06
        m.userData = { gid: piece.gid, y: .43, delay: this.loads.length * .035 }
        this.group.add(m)
        this.loads.push(m)
    }

    // the good's icon over the middle of its cells, and its label
    private label(piece: Piece, at: T.Vector3) {
        const icon = new T.Sprite(new T.SpriteMaterial({ map: picture(piece.icon), transparent: true }))
        icon.scale.setScalar(1.1)
        icon.position.copy(at).setY(1.6)
        icon.userData.gid = piece.gid
        this.group.add(icon)
        this.icons.push(icon)
        this.mark(`${ piece.name } × ${ piece.quantity }`, piece.gid, at.clone().setY(2.3))
    }

    private mark(name: string, value: string, at: T.Vector3) {
        const el = this.kit.mark(name, value)
        if (value !== 'hold') el.addEventListener('pick', () => this.open(value))
        this.marks.push({ at: at.multiplyScalar(CELL), el })
    }

    // how much is aboard, and what it sells for here
    private open(gid: string) {
        const s = this.session, piece = this.pieces.find(x => x.gid === gid), price = s?.market.find(m => m.gid === gid)?.price_sell
        if (!s || !piece) return
        this.kit.card.show(piece.name, html`
            <dl>
                <dt>aboard</dt><dd>${ piece.quantity }</dd>
                <dt>cells</dt> <dd>${ piece.cells }</dd>
                ${ price ? html`<dt>sells here</dt><dd>${ credits(price) } · all ${ credits(price * piece.quantity) }</dd>` : '' }
            </dl>
            <p><a href="#exchange">sell at the market</a></p>`, s.universe?.goods[ gid ]?.category)
        beside(this.kit.card, this.marks, gid, v => this.stage.anchor(v))
    }

    private tone(kind?: string) {
        const p = this.p
        return { food: p.green, metal: p.mist, chemical: p.teal, tech: p.amber, consumer: p.pink, luxury: p.red, module: p.cream }[ kind ?? '' ] ?? p.cream
    }

    private lay(m: T.Mesh, at: T.Vector3, y: number) {
        m.rotation.x = -Math.PI / 2
        m.position.copy(at).setY(y)
        this.group.add(m)
    }

    // the drop runs on real time, so reduced motion still lands it
    private tick(t: number) {
        const now = performance.now() / 1000
        this.born ??= now
        for (const m of this.loads) m.position.y = m.userData.y + drop(Math.min(1, Math.max(0, (now - this.born - m.userData.delay) / .5))) * 4
        this.icons.forEach((m, i) => m.position.y = 1.6 + Math.sin(t * 2 + i) * .08)
        this.marks.forEach(m => m.el.at = this.stage.anchor(m.at))
    }

    // the loads share their shapes and colours: only the floor's own shapes and the icons' materials go
    private clear() {
        this.group.traverse(o => {
            if (o instanceof T.Mesh && !Object.values(SHAPES).includes(o.geometry)) o.geometry.dispose()
            if (o instanceof T.Sprite) o.material.dispose()
        })
        this.group.clear()
        this.loads = []
        this.icons = []
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }
}

// how high a dropped load still is, 1 to 0, with a bounce at the end
function drop(k: number) {
    return k < .7 ? 1 - (k / .7) ** 2 : Math.sin((k - .7) / .3 * Math.PI) * .12
}
