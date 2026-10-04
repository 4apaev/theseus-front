import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Sky } from './sky.ts'
import { lights } from './paint.ts'

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
    readonly camera = new T.PerspectiveCamera(30, 16 / 9, .1, 2000)
    readonly host: HTMLElement

    private readonly gl  = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    private readonly orbit = new OrbitControls(this.camera, this.gl.domElement)
    private readonly art = new T.TextureLoader
    private readonly ticks = new Set<Tick>
    private readonly sizer = new ResizeObserver(() => this.resize())
    private frame = 0
    private last = 0
    private t = 0

    constructor(host: HTMLElement) {
        this.host = host
        this.gl.autoClear = false
        this.gl.outputColorSpace = T.LinearSRGBColorSpace
        this.gl.setClearColor(0x070b14)
        host.prepend(this.gl.domElement)
        Object.assign(this.orbit, { enableDamping: true, enablePan: false, rotateSpeed: .5, minPolarAngle: .08 * Math.PI, maxPolarAngle: .92 * Math.PI })
        this.sizer.observe(host)
        lights(this.scene)
        this.frame = requestAnimationFrame(this.loop)
    }

    /** orbit `target`, a thing `size` metres across. the first look is from 42°, 22° up. */
    view(target: T.Vector3, size: number) {
        const az = 42 * Math.PI / 180
        const el = 22 * Math.PI / 180
        const d = size * 2.4
        this.orbit.target.copy(target)
        this.orbit.minDistance = size * 1.2
        this.orbit.maxDistance = size * 5
        this.camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(target)
        this.orbit.update()
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

    /** a world point on screen, in css px of the host. */
    anchor(v: T.Vector3) {
        const p = v.clone().project(this.camera)
        return [ (p.x + 1) / 2 * this.host.clientWidth, (1 - p.y) / 2 * this.host.clientHeight ]
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

    private readonly loop = (now: number) => {
        const dt = this.last && !still.matches ? Math.min(.05, (now - this.last) / 1000) : 0
        this.last = now
        this.t += dt
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

    private resize() {
        this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5))
        this.gl.setSize(this.host.clientWidth, this.host.clientHeight, false)
        this.camera.aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight)
        this.camera.updateProjectionMatrix()
    }
}
