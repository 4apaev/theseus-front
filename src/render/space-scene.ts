import { AppElement } from '../components/element.ts'
import { html } from 'lit'
import * as T from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { configureShipRenderer, shipLighting } from './ship-lighting.ts'
import { loadHullModel } from './hull-model.ts'
import {
    HULLS,
    type HullId,
    type ModuleId,
    type View,
} from '../model.ts'

import {
    buildPort,
    buildShip,
    disposeGroup,
} from './geometry.ts'

export class SpaceScene extends AppElement {
    static properties = {
        hull     : {},
        mode     : {},
        selection: {},
        fitted   : { attribute: false },
        motion   : { type: Boolean },
        load     : { type: Number },
    }

    declare hull     : HullId
    declare mode     : View
    declare fitted   : ModuleId[]
    declare selection: ModuleId
    declare motion   : boolean
    declare load     : number

    private ship?: T.Group
    private renderer?: T.WebGLRenderer
    private observer?: ResizeObserver
    private pointerStart?: { id: number, x: number, y: number, yaw: number }
    private controls?: TrackballControls
    private pointers = (new Set<number>)

    private scene = (new T.Scene)
    private camera = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 150)
    private content = (new T.Group)

    private yaw       = 0.74
    private frame     = 0
    private moved     = false
    private ready     = false
    private startTime = performance.now()
    private signature = ''
    private error     = ''
    private lastMode  = ''
    private lastHull = ''
    private generation = 0

    constructor() {
        super()
        this.hull = 'freighter'
        this.mode = 'port'
        this.fitted = []
        this.selection = 'cargo'
        this.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches
        this.load = 6
    }

    override render() {

        const label = this.mode === 'rig'
            ? 'interactive ship view. drag in any direction to rotate, scroll or pinch to zoom. module buttons provide keyboard access.'
            : 'interactive spaceport. use facility buttons or the ship module selector for keyboard access.'
        return html`
        <div class="scene-frame">
            <canvas
                aria-label="${ label }">
            </canvas>
            ${
                this.error
                    ? html`<div class="render-error">${ this.error }<br><small>all operations remain available in the panel.</small></div>`
                    : ''
            }
            <div class="scene-labels" ?hidden=${ this.mode !== 'port' && this.mode !== 'market' }>
                <button class="world-label" data-label="exchange" @click=${ () => this.selectFacility('exchange') }><span data-shape aria-hidden="true"></span><span>exchange    <small> cargo & commodities </small></span></button>
                <button class="world-label" data-label="relay"    @click=${ () => this.selectFacility('relay')    }><span data-shape aria-hidden="true"></span><span>relay array <small> local & ansible     </small></span></button>
                <button class="world-label" data-label="drydock"  @click=${ () => this.selectFacility('drydock')  }><span data-shape aria-hidden="true"></span><span>drydock     <small> rig & refit         </small></span></button>
            </div>
            <div class="scene-coordinate">${ this.mode === 'rig' ? 'vessel schematic / attachment view' : 'orbital berth / 04' }<span>orthographic projection</span></div>
        </div>`
    }

    override firstUpdated() {
        try {
            const canvas  = this.querySelector('canvas')!

            this.renderer = new T.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: true,
                powerPreference: 'high-performance',
            })

            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
            this.renderer.setClearColor(0x000000, 0)

            configureShipRenderer(this.renderer)
            this.scene.add(this.content, shipLighting())

            this.observer = new ResizeObserver(this.resize)
            this.observer.observe(this)

            canvas.addEventListener('pointerdown'  , this.onDown)
            canvas.addEventListener('pointermove'  , this.onMove)
            canvas.addEventListener('pointerup'    , this.onUp)
            canvas.addEventListener('pointercancel', this.onCancel)

            this.ready = true

            this.rebuild()
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
        if (signature !== this.signature) { this.signature = signature; this.rebuild() }
    }

    private async rebuild() {
        const generation = ++this.generation
        disposeGroup(this.content)

        this.content.clear()

        const cameraChanged = this.hull !== this.lastHull || this.mode !== this.lastMode
        this.lastHull = this.hull
        this.lastMode = this.mode
        const hull = HULLS.find(h => h.id === this.hull)!

        const isRig = this.mode === 'rig'

        this.ship = undefined

        if (!isRig) this.content.add(buildPort())

        try {
            const ship = await loadHullModel(hull, isRig ? this.selection : void 0)
            if (generation !== this.generation) {
                disposeGroup(ship)
                return
            }
            this.ship = ship
            this.error = ''
        }
        catch {
            if (generation !== this.generation) return
            this.ship = buildShip(hull.kind, hull.category, this.fitted, isRig ? this.selection : void 0)
            this.error = 'the selected hull model could not be loaded; showing its schematic reserve.'
            this.requestUpdate()
        }

        if (isRig) {
            this.ship.scale.multiplyScalar(1.3)
            this.ship.position.set(0, 1, 0)

        }
        else {
            this.ship.scale.multiplyScalar(0.85)
            this.ship.position.set(-0.1, 0.3, 5.3)

            const miniShip = buildShip('transport', 'civil')

            miniShip.scale.setScalar(0.26)
            miniShip.position.set(-5, 0.2, -0.1)

            this.content.add(miniShip)
        }
        this.content.add(this.ship)
        if (cameraChanged) this.resetCamera()
        else this.resize()
    }

    private resize = () => {
        if (!this.renderer) return

        const width  = this.clientWidth
        const height = this.clientHeight

        if (!width || !height) return

        this.renderer.setSize(width, height, false)

        let half = this.mode === 'rig' ? 6.1 : 8.9
        if (this.mode === 'rig' && this.ship) {
            const radius = (new T.Box3).setFromObject(this.ship).getBoundingSphere((new T.Sphere)).radius
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
        this.controls = undefined
        this.pointers.clear()
        this.pointerStart = undefined
        this.yaw = this.hull === 'discovery' ? -0.74 : 0.74
        this.camera.zoom = 1
        this.camera.up.set(0, 1, 0)
        this.positionCamera()
        if (this.mode === 'rig' && this.renderer) {
            // Match the maps: a trackball crosses poles without constraining pitch or roll.
            this.controls = new TrackballControls(this.camera, this.renderer.domElement)
            this.controls.target.set(0, 1, 0)
            this.controls.staticMoving = true
            this.controls.rotateSpeed = 1.6
            this.controls.minZoom = 0.65
            this.controls.maxZoom = 1.8
            this.controls.noPan = true
            this.controls.keys = [ '', '', '' ]
        }
        this.resize()
    }

    private positionCamera() {
        this.camera.position.set(Math.sin(this.yaw) * 26, 22, Math.cos(this.yaw) * 26)
        this.camera.lookAt(0, this.mode === 'rig' ? 1 : 0, this.mode === 'rig' ? 0 : 0.5)
    }

    private renderFrame = () => {
        if (!this.isConnected || !this.renderer) return

        this.frame = requestAnimationFrame(this.renderFrame)

        const t = (performance.now() - this.startTime) / 1000

        if (this.controls) this.controls.update()
        else this.positionCamera()

        if (this.ship)
            this.ship.position.y = (this.mode === 'rig' ? 1 : 0.3) + (this.motion ? Math.sin(t * 0.6) * 0.045 : 0)

        this.renderer.render(this.scene, this.camera)
        this.placeLabels()
    }

    private placeLabel(name: string, ...a: number[]): void {
        const label = this.querySelector<HTMLElement>(`[data-label="${ name }"]`)
        const pos = new T.Vector3(...a).project(this.camera)

        if (label) label.style.transform = `translate(${ (pos.x + 1) * this.clientWidth / 2 }px,${ (1 - pos.y) * this.clientHeight / 2 }px) translate(-50%,-100%)`
    }

    private placeLabels() {
        this.placeLabel('exchange',   -4, 2.0, -2.9)
        this.placeLabel('relay'   , 1.45, 2.1, -3.3)
        this.placeLabel('drydock' ,  3.5, 3.6, 0.65)
    }

    private selectFacility(detail: string) {
        this.dispatchEvent(new CustomEvent('facility-select', {
            detail,
            bubbles: true,
            composed: true,
        }))
    }

    private onDown = (e: PointerEvent) => {
        this.controls?.handleResize()
        this.pointers.add(e.pointerId)
        if (this.pointers.size > 1) { this.moved = true; return }
        this.pointerStart = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            yaw: this.yaw,
        }
        this.moved = e.button !== 0;
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    private onMove = (e: PointerEvent) => {
        if (!this.pointerStart || e.pointerId !== this.pointerStart.id) return

        const dx = e.clientX - this.pointerStart.x
        if (Math.abs(dx) > 5 || Math.abs(e.clientY - this.pointerStart.y) > 5) this.moved = true
        if (this.moved && !this.controls) this.yaw = this.pointerStart.yaw - dx * 0.006
    }

    private onCancel = (e: PointerEvent) => {
        this.pointers.delete(e.pointerId)
        this.pointerStart = undefined
        this.moved = true
    }

    private onUp = (e: PointerEvent) => {

        if (this.pointerStart?.id === e.pointerId && this.pointers.size === 1 && !this.moved && this.renderer) {
            const rect = this.renderer.domElement.getBoundingClientRect()

            const pointer = new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1)
            const ray = (new T.Raycaster)

            ray.setFromCamera(pointer, this.camera)

            const [ hit ] = ray.intersectObjects(this.content.children, true)

            let object: T.Object3D | null = hit?.object ?? null

            while (object) {
                if (object.userData.facility) {
                    this.selectFacility(object.userData.facility)
                    break
                }

                if (object.userData.module) {
                    this.dispatchEvent(new CustomEvent('module-select', {
                        detail: object.userData.module,
                        bubbles: true,
                        composed: true,
                    }))
                    break
                }
                object = object.parent
            }
        }
        this.pointers.delete(e.pointerId)
        this.pointerStart = undefined
    }

    override disconnectedCallback() {
        super.disconnectedCallback()

        cancelAnimationFrame(this.frame)

        this.observer?.disconnect()
        this.controls?.dispose()
        this.pointers.clear()

        const canvas = this.renderer?.domElement
        canvas?.removeEventListener('pointerdown'  , this.onDown)
        canvas?.removeEventListener('pointermove'  , this.onMove)
        canvas?.removeEventListener('pointerup'    , this.onUp)
        canvas?.removeEventListener('pointercancel', this.onCancel)

        disposeGroup(this.scene)

        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
    }
}
customElements.define('space-scene', SpaceScene)
