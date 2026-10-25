import * as T from 'three'
import type { Palette } from '../content/palettes.ts'
import { raw } from './paint.ts'
import { flat, hex, toon } from './toy.ts'

/**
 * the iso plane of the diagram screens, after the user's star birds
 * reference: a slab with a grid, rounded tiles, flat routes, dots that
 * run along a route, rocks drifting round it. build in cells; the group
 * scales a cell to CELL metres.
 */
export const CELL = 10

export type At = [ number, number ]

interface Run { at: At[], dots: T.Mesh[], length: number, speed: number }

export class Plane {
    readonly group = new T.Group
    private readonly p: Palette
    private readonly runs: Run[] = []
    private readonly rocks: T.Mesh[] = []

    constructor(p: Palette, n: number) {
        this.p = p
        this.group.scale.setScalar(CELL)
        this.group.add(slab(p, n), grid(p, n))
        this.drift(n)
    }

    /** a rounded tile, `[ w, d ]` cells; `on`, its ring is cream and its floor brighter. */
    tile([ x, z ]: At, [ w, d ]: At, color: string, on = false) {
        const e = on ? .16 : .12, r = Math.min(w, d) * .22
        const ring = rounded(w, d, r)
        ring.holes.push(rounded(w - e * 2, d - e * 2, r - e, new T.Path))
        this.lay(new T.Mesh(new T.ShapeGeometry(rounded(w, d, r)), flat(color, on ? .28 : .12)), [ x, z ], .015)
        this.lay(new T.Mesh(new T.ShapeGeometry(ring), flat(on ? this.p.cream : color)), [ x, z ], .02)
    }

    /** a flat route through `at`, shading from its first colour to its last. its dots run to the end, or back when `speed` is below 0. */
    route(at: At[], [ from, to ]: [ string, string ], width = .22, speed = 1) {
        const lengths = at.slice(1).map((b, i) => Math.hypot(b[ 0 ] - at[ i ][ 0 ], b[ 1 ] - at[ i ][ 1 ])), length = lengths.reduce((n, l) => n + l, 0) || 1
        const shade = (k: number) => raw(hex(from)).lerp(raw(hex(to)), k)
        let done = 0
        at.forEach((a, i) => {
            if (i) this.group.add(bar([ at[ i - 1 ], a ], width, [ shade(done / length), shade((done + lengths[ i - 1 ]) / length) ]))
            done += i ? lengths[ i - 1 ] : 0
            this.group.add(joint(a, width / 2, shade(done / length)))
        })
        const dots = Array.from({ length: Math.max(2, Math.round(length / .9)) }, () => disc([ 0, 0 ], width * .3, flat(this.p.cream), .035))
        this.group.add(...dots)
        this.runs.push({ at, dots, length, speed })
    }

    /** frees what this plane made on the gpu: its geometry, a sprite's material. shared materials and pictures stay. */
    dispose() {
        this.group.removeFromParent()
        this.group.traverse(o => {
            if (o instanceof T.Mesh || o instanceof T.LineSegments) o.geometry.dispose()
            if (o instanceof T.Sprite || o instanceof T.LineSegments) (o.material as T.Material).dispose()
        })
    }

    /** a world point over a cell point, `up` cells above the plane. */
    point([ x, z ]: At, up = 0) {
        return new T.Vector3(x, up, z).multiplyScalar(CELL)
    }

    tick(t: number) {
        for (const r of this.runs) {
            r.dots.forEach((d, i) => {
                const s = i * r.length / r.dots.length + t * r.speed * .8
                along(r.at, (s % r.length + r.length) % r.length, d.position)
            })
        }
        this.rocks.forEach((m, i) => m.rotation.set(t * .05 * (i % 3 + 1), t * .07, 0))
    }

    private lay(m: T.Mesh, [ x, z ]: At, y: number) {
        m.rotation.x = -Math.PI / 2
        m.position.set(x, y, z)
        this.group.add(m)
    }

    // rocks drift round the slab, low and high, none on it
    private drift(n: number) {
        for (let i = 0; i < 16; i++) {
            const a = i * 2.4, r = n * (1.15 + i % 4 * .12), m = new T.Mesh(new T.IcosahedronGeometry(.5 + i % 5 * .3, 0), toon(i % 3 ? this.p.panel2 : this.p.line))
            m.position.set(Math.cos(a) * r, i % 4 * 1.2 - 3.5, Math.sin(a) * r)
            this.rocks.push(m)
        }
        this.group.add(...this.rocks)
    }
}

/** a rounded rectangle, `w` by `h`, round the origin. */
export function rounded(w: number, h: number, r: number, path: T.Shape | T.Path = new T.Shape) {
    const [ x, y ] = [ w / 2, h / 2 ]
    path.moveTo(-x + r, -y)
    path.lineTo(x - r, -y)
    path.quadraticCurveTo(x, -y, x, -y + r)
    path.lineTo(x, y - r)
    path.quadraticCurveTo(x, y, x - r, y)
    path.lineTo(-x + r, y)
    path.quadraticCurveTo(-x, y, -x, y - r)
    path.lineTo(-x, -y + r)
    path.quadraticCurveTo(-x, -y, -x + r, -y)
    return path as T.Shape
}

// the slab: a rounded block, its top at the plane
function slab(p: Palette, n: number) {
    const g = new T.ExtrudeGeometry(rounded(n * 2, n * 2, 1.2), { depth: .5, bevelEnabled: false })
    const m = new T.Mesh(g, [ toon(p.panel), toon(p.deep) ])
    m.rotation.x = -Math.PI / 2
    m.position.y = -.5
    return m
}

function grid(p: Palette, n: number) {
    const v: number[] = []
    for (let i = 1 - n; i < n; i++) v.push(i, .01, -n + .6, i, .01, n - .6, -n + .6, .01, i, n - .6, .01, i)
    const g = (new T.BufferGeometry).setAttribute('position', new T.Float32BufferAttribute(v, 3))
    return new T.LineSegments(g, new T.LineBasicMaterial({ color: raw(hex(p.green)), transparent: true, opacity: .3 }))
}

// the routes' ink: each vertex carries its colour along the route
const INK = new T.MeshBasicMaterial({ vertexColors: true })

// a straight piece of a route, its ends in their colours
function bar([ a, b ]: At[], w: number, [ ca, cb ]: T.Color[]) {
    const dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], g = new T.PlaneGeometry(Math.hypot(dx, dz), w), p = g.attributes.position
    g.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: p.count }, (_, i) => (p.getX(i) > 0 ? cb : ca).toArray()).flat(), 3))
    const m = new T.Mesh(g, INK)
    m.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx))
    m.position.set((a[ 0 ] + b[ 0 ]) / 2, .03, (a[ 1 ] + b[ 1 ]) / 2)
    return m
}

// a round joint where 2 pieces meet, so a turn is round
function joint([ x, z ]: At, r: number, c: T.Color) {
    const g = new T.CircleGeometry(r, 20)
    g.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => c.toArray()).flat(), 3))
    const d = new T.Mesh(g, INK)
    d.rotation.x = -Math.PI / 2
    d.position.set(x, .03, z)
    return d
}

function disc([ x, z ]: At, r: number, m: T.Material, y: number) {
    const d = new T.Mesh(new T.CircleGeometry(r, 20), m)
    d.rotation.x = -Math.PI / 2
    d.position.set(x, y, z)
    return d
}

/**
 * a route on grid lines from tile `a` to tile `b`, `half` their half
 * widths: out of `a` on the side that faces `b`, `e` off its middle; a
 * turn on the grid line halfway; into `b` on its facing side.
 */
export function wire(a: At, b: At, e = 0, [ ha, hb ]: At = [ 1, 1 ]): At[] {
    const dx = b[ 0 ] - a[ 0 ], dz = b[ 1 ] - a[ 1 ], across = Math.abs(dx) >= Math.abs(dz), s = Math.sign(across ? dx : dz) || 1
    const mid = Math.round(((across ? a[ 0 ] : a[ 1 ]) + s * ha + (across ? b[ 0 ] : b[ 1 ]) - s * hb) / 2)
    const out: At[] = across
        ? [[ a[ 0 ] + s * ha, a[ 1 ] + e ], [ mid, a[ 1 ] + e ], [ mid, b[ 1 ] ], [ b[ 0 ] - s * hb, b[ 1 ] ]]
        : [[ a[ 0 ] + e, a[ 1 ] + s * ha ], [ a[ 0 ] + e, mid ], [ b[ 0 ], mid ], [ b[ 0 ], b[ 1 ] - s * hb ]]
    return out.filter((p, i) => !i || Math.hypot(p[ 0 ] - out[ i - 1 ][ 0 ], p[ 1 ] - out[ i - 1 ][ 1 ]) > .01)
}

/** the point `s` cells along a path, into `out`: its height stays. */
export function along(at: At[], s: number, out: T.Vector3) {
    for (let i = 1; i < at.length; i++) {
        const [ a, b ] = [ at[ i - 1 ], at[ i ] ], l = Math.hypot(b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ])
        if (s <= l || i === at.length - 1) return void out.set(a[ 0 ] + (b[ 0 ] - a[ 0 ]) * Math.min(1, s / l), out.y, a[ 1 ] + (b[ 1 ] - a[ 1 ]) * Math.min(1, s / l))
        s -= l
    }
}
