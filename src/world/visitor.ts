import * as T from 'three'
import { HULLS } from '../content/fleet.ts'
import { Ship } from './ship.ts'

/** where a visitor waits: a point, and the way its bow points. */
export interface Berth { at: T.Vector3, bow: T.Vector3 }

const UP = new T.Vector3(0, 1, 0)
const BASIS = new T.Matrix4

/**
 * a ship that is not ours. it parks at its berth, or it flies in on a
 * curve and slows down to it. later it flies out along its bow and
 * speeds up. the drive glows on the way out; on the way in it coasts.
 * both ends lie 10 km out or more, where a hull is a dot.
 */
export class Visitor {
    readonly ship: Ship
    readonly hull: string
    readonly berth: Berth
    gone = false
    private move?: { path: T.CubicBezierCurve3, t0: number, time: number, out: boolean }

    constructor(hull: string, seed: number, berth: Berth) {
        this.ship = new Ship(hull, HULLS[ hull ])
        this.hull = hull
        this.berth = berth
        void this.ship.dress(seed)
        this.place(berth.at, berth.bow)
    }

    arrive(t: number) {
        const p = along(this.berth)
        this.move = { path: new T.CubicBezierCurve3(p(-10000, 2500, 1500), p(-2500, 600, 300), p(-400, 0, 0), p(0, 0, 0)), t0: t, time: 45, out: false }
        this.tick(t, 0)
    }

    depart(t: number) {
        const p = along(this.berth)
        this.move = { path: new T.CubicBezierCurve3(p(0, 0, 0), p(500, 0, 0), p(3000, -200, 200), p(12000, -1500, 2000)), t0: t, time: 40, out: true }
    }

    tick(t: number, dt: number) {
        this.ship.tick(t, dt)
        const m = this.move
        if (!m) return
        const k = Math.min(1, (t - m.t0) / m.time)
        const u = m.out ? k * k : 1 - (1 - k) ** 2
        this.place(m.path.getPoint(u), m.path.getTangent(u))
        this.ship.burn(m.out ? Math.min(1, k * 4) : 0)
        if (k < 1) return
        this.move = void 0
        this.gone = m.out
    }

    // the bow along `dir`, the deck kept level
    private place(at: T.Vector3, dir: T.Vector3) {
        const x = dir.clone().normalize()
        const z = x.clone().cross(UP).normalize()
        this.ship.group.position.copy(at)
        this.ship.group.quaternion.setFromRotationMatrix(BASIS.makeBasis(x, z.clone().cross(x), z))
    }
}

// a point of the berth's frame: metres ahead of the bow, to starboard, up
function along({ at, bow }: Berth) {
    const side = bow.clone().cross(UP).normalize()
    return (ahead: number, right: number, up: number) => at.clone().addScaledVector(bow, ahead).addScaledVector(side, right).addScaledVector(UP, up)
}
