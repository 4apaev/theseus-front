import { html } from 'lit'
import * as T from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { AppElement } from '../components/element.ts'
import { configureShipRenderer, shipLighting } from './ship-lighting.ts'
import { loadHullModel } from './hull-model.ts'
import { buildPort, buildShip, disposeGroup } from './geometry.ts'
import { hullById, type HullId, type ModuleId, type Facility } from '../model.ts'
import { Fail } from '../util.ts'

export type SceneMode = 'rig' | 'market'

const LABELS: { id: Facility, at: [ number, number, number ]}[] = [
    { id: 'exchange', at: [ -4, 2.0, -2.9 ]},
    { id: 'relay', at: [ 1.45, 2.1, -3.3 ]},
    { id: 'drydock', at: [ 3.5, 3.6, 0.65 ]},
]

/**
 * the ship viewport. the rig shows the hull alone under a trackball;
 * the exchange shows it docked at the berth backdrop with a slow orbit
 * of the camera. a hull comes from its glb, or from the schematic
 * reserve when the glb fails. picking emits `facility-select` and
 * `module-select`.
 */
export class SpaceScene extends AppElement {
    static properties = {
        hull     : {},
        mode     : {},
        selection: {},
        fitted   : { attribute: false },
        motion   : { type: Boolean },
        load     : { type: Number },
    }

    declare hull: HullId
    declare mode: SceneMode
    declare fitted: ModuleId[]
    declare selection: ModuleId
    declare motion: boolean
    declare load: number

    private ship?: T.Group
    private renderer?: T.WebGLRenderer
    private observer?: ResizeObserver
    private controls?: TrackballControls
    private pointerStart?: { id: number, x: number, y: number, yaw: number }
    private pointers = new Set<number>
    private scene    = new T.Scene
    private camera   = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 150)
    private content  = new T.Group

    private yaw        = 0.74
    private frame      = 0
    private moved      = false
    private ready      = false
    private startTime  = performance.now()
    private signature  = ''
    private error      = ''
    private lastMode   = ''
    private lastHull   = ''
    private generation = 0

    constructor() {
        super()
        this.hull      = 'freighter'
        this.mode      = 'market'
        this.fitted    = []
        this.selection = 'cargo'
        this.motion    = !matchMedia('(prefers-reduced-motion: reduce)').matches
        this.load      = 0
    }

    override render() {
        const rig = this.mode === 'rig'
        return html`
        <div class="scene-frame">
            <canvas aria-label=${ rig
                ? 'interactive ship view. drag in any direction to rotate, scroll or pinch to zoom. module buttons provide keyboard access.'
                : 'interactive spaceport. use facility buttons or the ship module selector for keyboard access.' }></canvas>
            ${ this.error ? html`<div class="render-error">${ this.error }<br><small>all operations remain available in the panel.</small></div>` : '' }
            <div class="scene-labels" ?hidden=${ rig }>
                <button class="world-label" data-label="exchange" title="cargo & commodities" @click=${ () => this.selectFacility('exchange') }><span data-shape aria-hidden="true"></span><span>exchange</span></button>
                <button class="world-label" data-label="relay"    title="local & ansible"     @click=${ () => this.selectFacility('relay')    }><span data-shape aria-hidden="true"></span><span>relay array</span></button>
                <button class="world-label" data-label="drydock"  title="rig & refit"         @click=${ () => this.selectFacility('drydock')  }><span data-shape aria-hidden="true"></span><span>drydock</span></button>
            </div>
            <div class="scene-coordinate">${ rig ? 'vessel schematic / attachment view' : 'orbital berth / 04' }<span>orthographic projection</span></div>
        </div>`
    }

    // ── lifecycle ────────────────────────────────────────────

    override firstUpdated() {
        try {
            const canvas = this.querySelector('canvas')!
            this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
            this.renderer.setClearColor(0x000000, 0)
            configureShipRenderer(this.renderer)
            this.scene.add(this.content, shipLighting())

            this.observer = new ResizeObserver(this.resize)
            this.observer.observe(this)
            canvas.addEventListener('pointerdown', this.onDown)
            canvas.addEventListener('pointermove', this.onMove)
            canvas.addEventListener('pointerup', this.onUp)
            canvas.addEventListener('pointercancel', this.onCancel)

            this.ready = true
            void this.rebuild()
            this.resize()
            this.renderFrame()
        }
        catch {
            this.error = 'webgl could not start on this device.'
            this.requestUpdate()
        }
    }

    override updated() {
        if (!this.ready) return
        const signature = `${ this.hull }/${ this.mode }/${ this.fitted.join(',') }/${ this.selection }/${ this.load }`
        if (signature !== this.signature) {
            this.signature = signature
            void this.rebuild()
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        cancelAnimationFrame(this.frame)
        this.observer?.disconnect()
        this.controls?.dispose()
        this.pointers.clear()
        const canvas = this.renderer?.domElement
        canvas?.removeEventListener('pointerdown', this.onDown)
        canvas?.removeEventListener('pointermove', this.onMove)
        canvas?.removeEventListener('pointerup', this.onUp)
        canvas?.removeEventListener('pointercancel', this.onCancel)
        disposeGroup(this.scene)
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
    }

    // ── content ──────────────────────────────────────────────

    private async rebuild() {
        const generation = ++this.generation
        disposeGroup(this.content)
        this.content.clear()

        const rig  = this.mode === 'rig'
        const hull = hullById(this.hull)
        const cameraChanged = this.hull !== this.lastHull || this.mode !== this.lastMode
        this.lastHull = this.hull
        this.lastMode = this.mode
        this.ship = void 0
        if (!rig) this.content.add(buildPort())

        const ship = await this.loadShip(hull.id, rig ? this.selection : void 0)
        if (generation !== this.generation) return disposeGroup(ship)
        this.ship = ship

        if (rig) {
            ship.scale.multiplyScalar(1.3)
            ship.position.set(0, 1, 0)
        }
        else {
            ship.scale.multiplyScalar(0.85)
            ship.position.set(-0.1, 0.3, 5.3)
            const visitor = buildShip('transport', 'civil')
            visitor.scale.setScalar(0.26)
            visitor.position.set(-5, 0.2, -0.1)
            this.content.add(visitor)
        }
        this.content.add(ship)
        if (cameraChanged) this.resetCamera()
        else this.resize()
    }

    /** the glb, or the schematic reserve. a failed load retries on the next rebuild. */
    private async loadShip(id: HullId, selection?: ModuleId) {
        const hull = hullById(id)
        try {
            const ship = await loadHullModel(hull, this.fitted, selection)
            this.error = ''
            return ship
        }
        catch (error) {
            console.error(Fail.from(error, 'hull-load'))
            this.error = 'the selected hull model could not be loaded; showing its schematic reserve. it retries on the next view change.'
            this.requestUpdate()
            return buildShip(hull.kind, hull.category, this.fitted, selection)
        }
    }

    // ── camera ───────────────────────────────────────────────

    private resize = () => {
        const width = this.clientWidth, height = this.clientHeight
        if (!this.renderer || !width || !height) return
        this.renderer.setSize(width, height, false)

        let half = this.mode === 'rig' ? 6.1 : 8.9
        if (this.mode === 'rig' && this.ship) {
            const radius = (new T.Box3).setFromObject(this.ship).getBoundingSphere(new T.Sphere).radius
            half = Math.max(half, radius * 1.12, radius * 1.12 * height / width)
        }
        this.camera.left   = -half * width / height
        this.camera.right  =  half * width / height
        this.camera.top    =  half
        this.camera.bottom = -half
        this.camera.updateProjectionMatrix()
        this.controls?.handleResize()
    }

    adjustZoom(delta: number) {
        this.camera.zoom = Math.min(1.8, Math.max(0.65, this.camera.zoom + delta))
        this.resize()
    }

    resetCamera() {
        this.controls?.dispose()
        this.controls = void 0
        this.pointers.clear()
        this.pointerStart = void 0
        this.yaw = 0.74
        this.camera.zoom = 1
        this.camera.up.set(0, 1, 0)
        this.positionCamera()
        if (this.mode === 'rig' && this.renderer) {
            // a trackball crosses the poles without constraining pitch or roll, as the maps do
            this.controls = new TrackballControls(this.camera, this.renderer.domElement)
            this.controls.target.set(0, 1, 0)
            this.controls.staticMoving = true
            this.controls.rotateSpeed  = 1.6
            this.controls.minZoom      = 0.65
            this.controls.maxZoom      = 1.8
            this.controls.noPan        = true
            this.controls.keys         = [ '', '', '' ]
        }
        this.resize()
    }

    private positionCamera() {
        const rig = this.mode === 'rig'
        this.camera.position.set(Math.sin(this.yaw) * 26, 22, Math.cos(this.yaw) * 26)
        this.camera.lookAt(0, rig ? 1 : 0, rig ? 0 : 0.5)
    }

    private renderFrame = () => {
        if (!this.isConnected || !this.renderer) return
        this.frame = requestAnimationFrame(this.renderFrame)
        const t = (performance.now() - this.startTime) / 1000

        if (this.controls) this.controls.update()
        else this.positionCamera()
        if (this.ship) this.ship.position.y = (this.mode === 'rig' ? 1 : 0.3) + (this.motion ? Math.sin(t * 0.6) * 0.045 : 0)

        this.renderer.render(this.scene, this.camera)
        this.placeLabels()
    }

    private placeLabels() {
        for (const { id, at } of LABELS) {
            const label = this.querySelector<HTMLElement>(`[data-label="${ id }"]`)
            if (!label) continue
            const pos = new T.Vector3(...at).project(this.camera)
            label.style.transform = `translate(${ (pos.x + 1) * this.clientWidth / 2 }px,${ (1 - pos.y) * this.clientHeight / 2 }px) translate(-50%,-100%)`
        }
    }

    // ── picking ──────────────────────────────────────────────

    private selectFacility(detail: Facility) {
        this.dispatchEvent(new CustomEvent('facility-select', { detail, bubbles: true, composed: true }))
    }

    private selectModule(detail: ModuleId) {
        this.dispatchEvent(new CustomEvent('module-select', { detail, bubbles: true, composed: true }))
    }

    /** the first ancestor of a hit that names a facility or a module. */
    private pick(e: PointerEvent) {
        const rect = this.renderer!.domElement.getBoundingClientRect()
        const ray  = new T.Raycaster
        ray.setFromCamera(new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), this.camera)
        let object: T.Object3D | undefined = ray.intersectObjects(this.content.children, true)[ 0 ]?.object
        while (object) {
            if (object.userData.facility) return this.selectFacility(object.userData.facility)
            if (object.userData.module) return this.selectModule(object.userData.module)
            object = object.parent ?? void 0
        }
    }

    private onDown = (e: PointerEvent) => {
        this.controls?.handleResize()
        this.pointers.add(e.pointerId)
        if (this.pointers.size > 1) { this.moved = true; return }
        this.pointerStart = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.yaw }
        this.moved = e.button !== 0;
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    private onMove = (e: PointerEvent) => {
        if (!this.pointerStart || e.pointerId !== this.pointerStart.id) return
        const dx = e.clientX - this.pointerStart.x
        if (Math.abs(dx) > 5 || Math.abs(e.clientY - this.pointerStart.y) > 5) this.moved = true
        if (this.moved && !this.controls) this.yaw = this.pointerStart.yaw - dx * 0.006
    }

    private onUp = (e: PointerEvent) => {
        if (this.pointerStart?.id === e.pointerId && this.pointers.size === 1 && !this.moved && this.renderer) this.pick(e)
        this.pointers.delete(e.pointerId)
        this.pointerStart = void 0
    }

    private onCancel = (e: PointerEvent) => {
        this.pointers.delete(e.pointerId)
        this.pointerStart = void 0
        this.moved = true
    }
}
customElements.define('space-scene', SpaceScene)
