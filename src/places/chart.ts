import * as T from 'three'
import type { GameClient } from '../core/client.ts'
import { displayRadius, orbitRadius, routeEdges, starColor, systemPosition } from '../core/chart.ts'
import { type Session, station } from '../core/session.ts'
import type { Universe } from '../core/transport/types.ts'
import { seedOf } from '../content/fleet.ts'
import type { Kit } from '../kit/index.ts'
import type { KitMark } from '../kit/mark.ts'
import { glow } from '../world/paint.ts'
import type { Stage } from '../world/stage.ts'
import { Course } from './course.ts'
import type { Place } from './router.ts'

// scene metres per light year in the sector, and per chart radius in a system
export const LY = 40
const ORB = 60

// the golden angle: stations in orbit order spread round the star, none on top of another
const GOLDEN = 137.5 * Math.PI / 180

/**
 * the chart, in 2 levels. the sector: the stars where the catalogue puts
 * them, and the routes between them. a star opens its system: the star,
 * an orbit ring per station, each station on its ring. a station opens
 * the course: the hops, the distance, galaxy and ship years, the real
 * time, and what the time costs the cargo. then travel. escape, or the
 * star, goes back to the sector.
 */
export class Chart implements Place {
    private readonly stage: Stage
    private readonly kit: Kit
    private readonly course: Course
    private readonly group = new T.Group
    private marks: { at: T.Vector3, el: KitMark }[] = []
    private untick?: () => void
    private session?: Session
    private sysid?: string

    constructor(stage: Stage, kit: Kit, client: GameClient) {
        this.stage  = stage
        this.kit    = kit
        this.course = new Course(kit, client)
    }

    enter(s: Session) {
        this.session = s
        this.course.sync(s)
        this.stage.sky.show()
        this.stage.scene.add(this.group)
        this.untick = this.stage.tick(() => this.marks.forEach(m => m.el.at = this.stage.anchor(m.at)))
        addEventListener('keydown', this.escape, true)
        this.sector()
    }

    sync(s: Session) {
        this.session = s
        this.course.sync(s)
        const here = this.sysid ? s.ship?.stid : station(s, s.ship?.stid)?.system
        this.marks.forEach(m => m.el.here = m.el.value === here)
    }

    leave() {
        this.untick?.()
        removeEventListener('keydown', this.escape, true)
        this.clear()
        this.group.removeFromParent()
        this.kit.card.close()
    }

    // a glowing star and its label per system; a faint line per route
    private sector() {
        const u = this.session?.universe
        if (!u) return
        this.clear()
        this.sysid = void 0
        for (const sys of u.systems) this.dot(point(u, sys.sysid), starColor(sys.star), 36).mark(sys.name, sys.sysid, () => this.system(sys.sysid))
        this.lines(routeEdges(u, { mode: 'sector', sysid: '' }).flatMap(e => [ ...e.a, ...e.b ].map(v => v * LY)))
        this.stage.view(...frame(u))
        this.sync(this.session!)
    }

    // the star in the middle, a ring per station, each station on its ring
    private system(sysid: string) {
        const s = this.session, u = s?.universe, sys = u?.systems.find(x => x.sysid === sysid)
        if (!s || !u || !sys) return
        this.clear()
        this.sysid = sysid
        this.kit.card.close()
        this.dot(new T.Vector3, starColor(sys.star), 60).mark(sys.name, sysid, () => this.sector())
        let far = 0
        for (const x of u.stations.filter(y => y.system === sysid)) {
            const at = onOrbit(u, x.stid)
            this.lines(ring(at.length()))
            this.dot(at, '#d9d2b7', 16).mark(x.name, x.stid, () => this.plot(x.stid))
            far = Math.max(far, at.length())
        }
        this.stage.view(new T.Vector3, far * 1.6)
        this.sync(s)
    }

    private plot(stid: string) {
        if (!this.course.show(stid)) return
        const at = this.marks.find(m => m.el.value === stid)?.at
        if (at) void this.kit.card.updateComplete.then(() => this.kit.card.at = this.stage.anchor(at))
    }

    // ── the scene ────────────────────────────────────────────

    // a glow, and a way to give it a label
    private dot(at: T.Vector3, color: string, size: number) {
        const g = glow(parseInt(color.slice(1), 16), size)
        g.position.copy(at)
        this.group.add(g)
        return {
            mark: (name: string, value: string, pick: () => void) => {
                const el = this.kit.mark(name, value)
                el.addEventListener('pick', pick)
                this.marks.push({ at, el })
            },
        }
    }

    private lines(points: number[]) {
        const geometry = (new T.BufferGeometry).setAttribute('position', new T.Float32BufferAttribute(points, 3))
        this.group.add(new T.LineSegments(geometry, new T.LineBasicMaterial({ color: 0xe8dfcb, transparent: true, opacity: .3 })))
    }

    private clear() {
        this.group.clear()
        this.marks.forEach(m => m.el.remove())
        this.marks = []
    }

    // in a system, escape goes back to the sector before the router sees it
    private readonly escape = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || !this.sysid || !this.kit.card.hidden) return
        e.preventDefault()
        this.sector()
    }
}

/** the whole sector: its middle, and a size that fits every star in a 30° view. */
export function frame(u: Universe): [ T.Vector3, number ] {
    const points = u.systems.map(x => point(u, x.sysid))
    const middle = points.reduce((m, v) => m.add(v), new T.Vector3).divideScalar(points.length)
    return [ middle, Math.max(...points.map(v => v.distanceTo(middle))) * 1.6 ]
}

/** a system in the sector, in scene metres. */
export function point(u: Universe, sysid: string) {
    return new T.Vector3(...systemPosition(u, sysid)).multiplyScalar(LY)
}

/** a station on its orbit, in scene metres: in orbit order round the star, none on top of another. */
export function onOrbit(u: Universe, stid: string) {
    const sysid = u.stations.find(x => x.stid === stid)?.system ?? '', i = u.stations.filter(x => x.system === sysid).findIndex(x => x.stid === stid)
    const r = displayRadius(orbitRadius(u, stid)) * ORB, a = i * GOLDEN + seedOf(sysid) % 360 * Math.PI / 180
    return new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)
}

// a circle as line segments, in the plane of the orbits
function ring(r: number) {
    const n = 96
    return Array.from({ length: n }, (_, i) => [ i, i + 1 ].flatMap(k => [ Math.cos(k / n * Math.PI * 2) * r, 0, Math.sin(k / n * Math.PI * 2) * r ])).flat()
}
