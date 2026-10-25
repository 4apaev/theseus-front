import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Sky } from './sky.ts'
import { lights, raw } from './paint.ts'

/** the virtual frame. painted parts and anchors use its pixels. */
export const VW = 1280
export const VH = 720

export interface Sprite { x: number, y: number, w: number, foot?: [ number, number ], z?: number }

type Tick = (t: number, dt: number) => void

const still = matchMedia('(prefers-reduced-motion: reduce)')

/**
 * one renderer, one clock, 4 layers back to front: the sky, the back
 * sprites, the 3D scene, the front sprites. the kit (dom) sits on top.
 * the camera orbits a target; the sky turns with it and never moves.
 * the sprite layers hold the painted interiors, in the virtual frame.
 * with reduced motion the clock stops; flows still run on their own time.
 * colours stay raw, as painted: no colour management.
 */
export class Stage {
    readonly sky    = new Sky
    readonly back   = new T.Scene
    readonly scene  = new T.Scene
    readonly front  = new T.Scene
    readonly flat   = new T.OrthographicCamera(0, VW, 0, -VH, -10, 10)
    readonly camera = new T.PerspectiveCamera(30, 16 / 9, 1, 20000)
    readonly host: HTMLElement

    private readonly gl  = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    private readonly orbit = new OrbitControls(this.camera, this.gl.domElement)
    private readonly ray   = new T.Raycaster
    private readonly art = new T.TextureLoader
    private readonly ticks = new Set<Tick>
    private readonly sizer = new ResizeObserver(() => this.resize())
    private frame = 0
    /** calm: ambient motion stops, as with the system's reduced motion. flights keep their time. */
    calm = false
    private last = 0
    private t = 0
    private flight?: { from: T.Vector3[], to: T.Vector3[], t0: number, size?: number }
    private arrived = -Infinity

    constructor(host: HTMLElement) {
        this.host = host
        this.gl.autoClear = false
        this.gl.outputColorSpace = T.LinearSRGBColorSpace
        this.gl.setClearColor(0x070b14)
        host.prepend(this.gl.domElement)
        Object.assign(this.orbit, { enableDamping: true, enablePan: false, rotateSpeed: .5 })
        this.orbit.addEventListener('change', this.depth)
        this.sizer.observe(host)
        lights(this.scene)
        this.frame = requestAnimationFrame(this.loop)
    }

    /** orbit `target`, a thing `size` metres across. the first look is from 42°, 22° up. a flight under way stops. */
    view(target: T.Vector3, size: number) {
        const az = 42 * Math.PI / 180
        const el = 22 * Math.PI / 180
        const d = size * 2.4
        this.flight = void 0
        this.orbit.target.copy(target)
        this.tilt(.08, .92)
        this.limit(size * 1.2, size * 5)
        this.camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target)
        this.orbit.update()
        if (performance.now() - this.arrived < 2000) this.settle()
    }

    /** a new place arrives: the picture fades in, and its first view eases in from farther out. */
    arrive() {
        this.arrived = performance.now()
        this.gl.domElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' })
    }

    // from a quarter farther out to the view just set
    private settle() {
        this.arrived = -Infinity
        const to = this.camera.position.clone(), far = to.clone().sub(this.orbit.target).multiplyScalar(1.25).add(this.orbit.target)
        this.flight = { from: [ this.orbit.target.clone(), far ], to: [ this.orbit.target.clone(), to ], t0: performance.now() }
    }

    /** the orbit's limits, as parts of a half turn from straight down. */
    tilt(min: number, max: number) {
        this.orbit.minPolarAngle = min * Math.PI
        this.orbit.maxPolarAngle = max * Math.PI
    }

    /** turn the orbit round its target by `rad`, as a drag would. */
    turn(rad: number) {
        const y = new T.Vector3(0, 1, 0), spin = (v: T.Vector3, about: T.Vector3) => v.sub(about).applyAxisAngle(y, rad).add(about)
        spin(this.camera.position, this.orbit.target)
        // a flight under way turns with it
        if (this.flight) for (const [ target, camera ] of [ this.flight.from, this.flight.to ]) spin(camera, target)
        this.orbit.update()
    }

    /** come `k` times nearer, inside the orbit's limits. */
    zoom(k: number) {
        const d = this.camera.position.distanceTo(this.orbit.target)
        const to = Math.min(this.orbit.maxDistance, Math.max(this.orbit.minDistance, d / k))
        this.camera.position.sub(this.orbit.target).setLength(to).add(this.orbit.target)
        this.orbit.update()
    }

    /** the backdrop: one colour behind the stars. */
    backdrop(color: number) {
        this.gl.setClearColor(raw(color))
    }

    /** fly in 0.8 s to orbit `target`, `size` metres across, from the same side. */
    focus(target: T.Vector3, size: number) {
        const side = this.camera.position.clone().sub(this.orbit.target).normalize()
        this.flight = {
            from: [ this.orbit.target.clone(), this.camera.position.clone() ],
            to  : [ target.clone(), target.clone().addScaledVector(side, size * 2.4) ],
            t0  : performance.now(),
            size,
        }
        this.limit(0, Infinity)
    }

    private limit(min: number, max: number) {
        this.orbit.minDistance = min
        this.orbit.maxDistance = max
    }

    // real time, so reduced motion still lands the flight
    private fly(now: number) {
        const f = this.flight
        if (!f) return
        const k = Math.min(1, (now - f.t0) / 800), e = k * k * (3 - 2 * k)
        this.orbit.target.lerpVectors(f.from[ 0 ], f.to[ 0 ], e)
        this.camera.position.lerpVectors(f.from[ 1 ], f.to[ 1 ], e)
        if (k < 1) return
        this.flight = void 0
        if (f.size) this.limit(f.size * 1.2, f.size * 5)
    }

    /** a painted sprite from `art/`. `foot` is the fraction where it stands. */
    sprite(layer: T.Scene, src: string, { x, y, w, foot = [ .5, .5 ], z = 0 }: Sprite) {
        const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }))
        m.renderOrder = z
        this.art.load(`${ import.meta.env.BASE_URL }art/${ src }`, t => {
            const img = t.image as HTMLImageElement
            const h = w * img.height / img.width
            m.material.map = t
            m.material.needsUpdate = true
            m.scale.set(w, h, 1)
            m.position.set(x + (.5 - foot[ 0 ]) * w, -(y + (.5 - foot[ 1 ]) * h), z)
        })
        layer.add(m)
        return m
    }

    /** the first thing under a host point, among `roots` and their children. */
    pick(x: number, y: number, roots: T.Object3D[]) {
        this.ray.setFromCamera(new T.Vector2(x / this.host.clientWidth * 2 - 1, 1 - y / this.host.clientHeight * 2), this.camera)
        return this.ray.intersectObjects(roots, true)[ 0 ]?.object
    }

    /** the point under a host point on the level plane at `height`; none when the ray misses it. */
    ground(x: number, y: number, height = 0) {
        this.ray.setFromCamera(new T.Vector2(x / this.host.clientWidth * 2 - 1, 1 - y / this.host.clientHeight * 2), this.camera)
        return this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -height), new T.Vector3) ?? void 0
    }

    /** `true`: the camera stays put while the player drags a thing. */
    hold(on: boolean) {
        this.orbit.enabled = !on
    }

    /** a world point on screen, in css px of the host. */
    anchor(v: T.Vector3) {
        const p = v.clone().project(this.camera)
        return [ (p.x + 1) / 2 * this.host.clientWidth, (1 - p.y) / 2 * this.host.clientHeight, p.z ]
    }

    tick(f: Tick) {
        this.ticks.add(f)
        return () => this.ticks.delete(f)
    }

    dispose() {
        cancelAnimationFrame(this.frame)
        this.sizer.disconnect()
        this.orbit.dispose()
        this.gl.dispose()
        this.gl.domElement.remove()
    }

    /*
        the depth precision follows the near plane. the camera stays a sixth
        of its distance away from the model at least, so 5% is a safe near.
    */
    private readonly depth = () => {
        this.camera.near = Math.max(.5, this.camera.position.distanceTo(this.orbit.target) * .05)
        this.camera.updateProjectionMatrix()
    }

    private readonly loop = (now: number) => {
        const dt = this.last && !still.matches && !this.calm ? Math.min(.05, (now - this.last) / 1000) : 0
        this.last = now
        this.t += dt
        this.fly(now)
        this.orbit.update()
        this.sky.tick(this.t, this.camera)
        this.ticks.forEach(f => f(this.t, dt))

        const gl = this.gl
        gl.clear()
        gl.render(this.sky.scene, this.sky.camera)
        gl.render(this.back, this.flat)
        gl.clearDepth()
        gl.render(this.scene, this.camera)
        gl.render(this.front, this.flat)
        this.frame = requestAnimationFrame(this.loop)
    }

    /*
        the stage fills its host, whatever its shape. the 3D lens keeps at
        least the width a 16:9 frame shows; the painted frame stays 16:9 in
        the middle, with more of the sky round it.
    */
    private resize() {
        const w = this.host.clientWidth, h = Math.max(1, this.host.clientHeight), a = w / h, k = VW / VH
        this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5))
        this.gl.setSize(w, h, false)
        this.camera.aspect = a
        this.camera.fov = a < k ? 2 * Math.atan(Math.tan(15 * Math.PI / 180) * k / a) * 180 / Math.PI : 30
        this.camera.updateProjectionMatrix()
        const [ x, y ] = a > k ? [ (VH * a - VW) / 2, 0 ] : [ 0, (VW / a - VH) / 2 ]
        Object.assign(this.flat, { left: -x, right: VW + x, top: y, bottom: -VH - y })
        this.flat.updateProjectionMatrix()
    }
}
