import * as T from 'three'
import { raw } from './paint.ts'
import { hex, toon } from './toy.ts'

/**
 * dotted paths of the toy look: routes, orbits, a course, a line from a
 * socket to its tile. a path is its points; the dots are one mesh.
 */

const BEAD = new T.SphereGeometry(1, 10, 8)

/** points on the straight line from `a` to `b`, `gap` apart, none within `cut` of an end. */
export function line(a: T.Vector3, b: T.Vector3, gap: number, cut: number) {
    const n = Math.max(2, Math.round(a.distanceTo(b) / gap))
    return Array.from({ length: n + 1 }, (_, i) => a.clone().lerp(b, i / n)).filter(v => v.distanceTo(a) > cut && v.distanceTo(b) > cut)
}

/** points along a soft arc from `a` to `b`, `gap` apart, none within `cut` of an end: the arc bows up a tenth of its length. */
export function arc(a: T.Vector3, b: T.Vector3, gap: number, cut: number) {
    const d = a.distanceTo(b), n = Math.max(2, Math.round(d / gap))
    const curve = new T.QuadraticBezierCurve3(a, a.clone().lerp(b, .5).add(new T.Vector3(0, d * .1, 0)), b)
    return Array.from({ length: n + 1 }, (_, i) => curve.getPoint(i / n)).filter(v => v.distanceTo(a) > cut && v.distanceTo(b) > cut)
}

/** points round a flat ring of radius `r`, `gap` apart. */
export function round(r: number, gap: number) {
    const n = Math.max(12, Math.round(Math.PI * 2 * r / gap))
    return Array.from({ length: n }, (_, i) => new T.Vector3(Math.cos(i / n * Math.PI * 2) * r, 0, Math.sin(i / n * Math.PI * 2) * r))
}

/** a dot of radius `r` on each point, as one mesh: the dots take the colours in turn. */
export function beads(at: T.Vector3[], colors: string[], r: number) {
    const m = new T.InstancedMesh(BEAD, toon('#ffffff'), Math.max(1, at.length)), q = new T.Quaternion, s = new T.Vector3(r, r, r)
    at.forEach((v, i) => {
        m.setMatrixAt(i, (new T.Matrix4).compose(v, q, s))
        m.setColorAt(i, raw(hex(colors[ i % colors.length ])))
    })
    m.count = at.length
    m.userData = { at, r }
    return m
}

/** a swell that runs along the dots, from the first to the last. */
export function wave(m: T.InstancedMesh, t: number) {
    const { at, r } = m.userData as { at: T.Vector3[], r: number }, q = new T.Quaternion, s = new T.Vector3, x = new T.Matrix4
    at.forEach((v, i) => m.setMatrixAt(i, x.compose(v, q, s.setScalar(r * (1 + .45 * Math.max(0, Math.sin(t * 5 - i * .5)))))))
    m.instanceMatrix.needsUpdate = true
}
