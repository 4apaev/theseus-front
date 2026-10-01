import { html, nothing, type PropertyValues } from 'lit'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { AppElement } from '../components/element.ts'
import { iconButton } from '../components/controls.ts'
import { emit, clamp, Fail } from '../util.ts'
import { disposeGroup } from './geometry.ts'
import { buildPlanet, type Planet } from './planet.ts'
import { configureShipRenderer, shipLighting } from './ship-lighting.ts'
import { STATIONS, facilityOf, prepareStation, type StationFacility, type StationModel } from './lem-station.ts'

class LemScene extends AppElement {
    static properties = { selected: {}, motion: { type: Boolean }, model: { attribute: false }, seed: {}, status: { state: true }}
    declare selected: StationFacility
    declare model: StationModel
    declare motion: boolean
    declare seed: string
    declare status: string
    private renderer?: T.WebGLRenderer
    private scene = new T.Scene
    private camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 100)
    // half extents of the loaded model, glb axes. the frame fits them at any aspect.
    private extent = new T.Vector2(6.8, 6.8)
    private center = new T.Vector3(0, 0.85, 0)
    private controls?: OrbitControls
    private observer?: ResizeObserver
    private request?: AbortController
    private station?: T.Group
    private parts?: ReturnType<typeof prepareStation>
    private mixer?: T.AnimationMixer
    private planet?: Planet
    private planetSeed = ''
    private hover?: StationFacility
    private frame = 0
    private time = 0
    private previous = 0
    private pointers = new Set<number>
    private gesture?: { id: number, x: number, y: number, moved: boolean }
    private reduced = matchMedia('(prefers-reduced-motion: reduce)')

    constructor() {
        super()
        this.selected = 'rig'
        this.model = STATIONS.lem
        this.motion = !this.reduced.matches
        this.seed = 'sol'
        this.status = 'loading station…'
    }

    override render() {
        return html`
        <div class="scene-frame">
            <canvas aria-label="the station. drag to rotate, scroll or pinch to zoom. facility buttons provide keyboard access."
                @pointerdown=${ this.onDown } @pointermove=${ this.onMove } @pointerup=${ this.onUp }
                @pointercancel=${ this.onCancel } @pointerleave=${ () => { this.hover = void 0 } }></canvas>
            ${ this.status ? html`<p class="station-status" role="status">${ this.status }</p>` : nothing }
            <nav class="scene-labels" aria-label="station facilities" ?hidden=${ !!this.status }>
                ${ this.model.facilities.map(f => html`<button class="world-label" data-label=${ f.id } aria-pressed=${ this.selected === f.id } title=${ f.note }
                    @focus=${ () => { this.hover = f.id } } @blur=${ () => { this.hover = void 0 } }
                    @pointerenter=${ () => { this.hover = f.id } } @pointerleave=${ () => { this.hover = void 0 } }
                    @click=${ () => this.select(f.id) }>${ f.name }</button>`) }
            </nav>
            <nav class="scene-tools" aria-label="station camera">
                <small>drag to rotate</small>
                ${ iconButton('minus', 'zoom out', () => this.zoom(-0.15)) }
                ${ iconButton('plus', 'zoom in', () => this.zoom(0.15)) }
                ${ iconButton('reset', 'reset station camera', this.resetCamera) }
                ${ iconButton(this.motion ? 'pause' : 'play', this.motion ? 'pause ambient motion' : 'resume ambient motion', () => emit(this, 'motion-toggle', void 0)) }
            </nav>
        </div>`
    }

    override firstUpdated() { void this.start() }

    // a new station id may name another model, or just another planet.
    override updated(changes: PropertyValues) {
        if (changes.has('model') && changes.get('model') !== undefined && this.renderer) void this.load()
        if (changes.has('seed') && this.renderer) this.setPlanet()
    }

    private async start() {
        const request = this.request = new AbortController
        try {
            const canvas = this.querySelector('canvas')!
            this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true })
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
            this.renderer.setClearColor(0, 0)
            this.renderer.toneMapping = T.ACESFilmicToneMapping
            configureShipRenderer(this.renderer)
            this.scene.add(shipLighting())
            // orbit, not trackball: the station reads top-down, so pitch stops short of level and never dips below it.
            this.controls = new OrbitControls(this.camera, canvas)
            this.controls.enablePan = false
            this.controls.enableDamping = false
            this.controls.rotateSpeed = 1.4
            this.controls.minZoom = 0.65
            this.controls.maxZoom = 1.8
            this.controls.minPolarAngle = Math.PI * 0.15
            this.controls.maxPolarAngle = Math.PI * 0.48
            this.resetCamera()
            this.observer = new ResizeObserver(this.resize)
            this.observer.observe(this)
            this.reduced.addEventListener('change', this.onReducedMotion)
            this.frame = requestAnimationFrame(this.draw)
            this.setPlanet()
            await this.load()
        }
        catch (error) {
            if (request.signal.aborted) return
            this.status = 'station preview unavailable. use the facility controls beside it.'
            console.error(Fail.from(error, 'station-load'))
            this.release()
        }
    }

    /** fetch the model of `this.model`, replace the station in the scene. */
    private async load() {
        this.request?.abort()
        const request = this.request = new AbortController
        this.unload()
        this.status = 'loading station…'
        try {
            const response = await fetch(`${ import.meta.env.BASE_URL }models/${ this.model.file }`, { signal: request.signal })
            if (!response.ok) throw new Fail('station model could not be loaded.', 'station-load')
            const asset = await (new GLTFLoader).parseAsync(await response.arrayBuffer(), '')
            if (request.signal.aborted) { disposeGroup(asset.scene); return }
            this.station = asset.scene
            this.parts = prepareStation(asset.scene, this.model.facilities)
            this.frameModel(asset.scene)
            this.scene.add(asset.scene)
            this.mixer = new T.AnimationMixer(asset.scene)
            asset.animations.forEach(clip => this.mixer!.clipAction(clip).play())
            this.status = ''
            this.resize()
        }
        catch (error) {
            if (request.signal.aborted) return
            this.status = 'station preview unavailable. use the facility controls beside it.'
            console.error(Fail.from(error, 'station-load'))
        }
    }

    private unload() {
        this.mixer?.stopAllAction()
        if (this.station) {
            this.mixer?.uncacheRoot(this.station)
            this.scene.remove(this.station)
            disposeGroup(this.station)
        }
        this.station = void 0
        this.parts = void 0
        this.mixer = void 0
        this.hover = void 0
    }

    private onReducedMotion = () => {
        if (this.reduced.matches && this.motion) emit(this, 'motion-toggle', void 0)
    }

    /** a planet for this station's system, low in one corner. the seed keeps it the same on every visit. */
    private setPlanet() {
        if (this.seed === this.planetSeed) return
        this.planetSeed = this.seed
        if (this.planet) { this.scene.remove(this.planet.group); disposeGroup(this.planet.group) }
        this.planet = buildPlanet(this.seed)
        this.scene.add(this.planet.group)
        this.placePlanet()
    }

    /**
     * the planet sits on a wide, fixed-radius orbit around the station.
     * its angle follows only a slice of the camera's own azimuth, so
     * dragging the station barely nudges it — a distant body, not a
     * prop bolted to the same turntable.
     */
    private placePlanet() {
        const planet = this.planet
        if (!planet || !this.controls) return
        const rel = this.camera.position.clone().sub(this.controls.target)
        const azimuth = Math.atan2(rel.x, rel.z)
        const angle = planet.orbit.phase + azimuth * 0.18
        planet.group.position.set(
            this.center.x + Math.sin(angle) * planet.orbit.radius,
            this.center.y + planet.orbit.height,
            this.center.z + Math.cos(angle) * planet.orbit.radius,
        )
    }

    /** fit the model box with a margin. labels and the dish need the room. */
    private frameModel(root: T.Object3D) {
        const box = (new T.Box3).setFromObject(root)
        const size = box.getSize(new T.Vector3)
        this.extent.set(size.x / 2 * 1.12, size.y / 2 * 1.12)
        box.getCenter(this.center)
        this.resetCamera()
    }

    private resize = () => {
        const { clientWidth: width, clientHeight: height } = this
        if (!width || !height || !this.renderer) return
        const half = Math.max(this.extent.y, this.extent.x * height / width)
        this.camera.left = -half * width / height
        this.camera.right = half * width / height
        this.camera.top = half
        this.camera.bottom = -half
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(width, height, false)
    }

    private resetCamera = () => {
        this.controls?.reset()
        const c = this.center
        this.camera.position.set(c.x + 12, c.y + 12, c.z + 20)
        this.camera.up.set(0, 1, 0)
        this.camera.zoom = 1
        this.controls?.target.copy(c)
        this.camera.lookAt(c)
        this.resize()
    }

    private zoom(delta: number) {
        this.camera.zoom = clamp(this.camera.zoom + delta, 0.65, 1.8)
        this.camera.updateProjectionMatrix()
    }

    private draw = (now: number) => {
        if (!this.isConnected || !this.renderer) return
        this.frame = requestAnimationFrame(this.draw)
        const dt = this.previous ? Math.min((now - this.previous) / 1000, 0.05) : 0
        this.previous = now
        if (this.motion && !document.hidden) {
            this.time += dt
            this.mixer?.update(dt)
            if (this.planet) this.planet.group.rotation.y += dt * this.planet.spin
        }
        this.parts?.lamps.forEach((lamp, i) => { lamp.emissiveIntensity = this.motion ? 1.5 + 0.9 * Math.sin(this.time * 2 + i * Math.PI) : 1.5 })
        this.controls?.update()
        this.placePlanet()
        const active = this.hover ?? this.selected
        this.parts?.facilities.forEach(f => f.outlines.forEach(line => { line.visible = f.id === active }))
        this.renderer.render(this.scene, this.camera)
        this.placeLabels()
    }

    private placeLabels() {
        this.parts?.facilities.forEach(f => {
            const label = this.querySelector<HTMLElement>(`[data-label="${ f.id }"]`)
            if (!label) return
            const pos = f.anchor.getWorldPosition(new T.Vector3).project(this.camera)
            label.hidden = Math.abs(pos.x) > 1.1 || Math.abs(pos.y) > 1.1 || Math.abs(pos.z) > 1
            const x = clamp((pos.x + 1) * this.clientWidth / 2, label.offsetWidth / 2, this.clientWidth - label.offsetWidth / 2)
            const y = clamp((1 - pos.y) * this.clientHeight / 2, 80, this.clientHeight - 90)
            label.style.transform = `translate(${ x }px, ${ y }px) translate(-50%, -100%)`
        })
    }

    private pick(event: PointerEvent) {
        if (!this.station || !this.renderer) return
        const rect = this.renderer.domElement.getBoundingClientRect()
        const point = new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
        const ray = new T.Raycaster
        ray.setFromCamera(point, this.camera)
        const hit = ray.intersectObject(this.station, true).find(hit => hit.object instanceof T.Mesh)
        return facilityOf(hit?.object)
    }

    private select(id: StationFacility) { emit(this, 'station-select', id) }

    private onDown = (event: PointerEvent) => {
        this.pointers.add(event.pointerId)
        if (this.pointers.size > 1) { if (this.gesture) this.gesture.moved = true; return }
        this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: event.button !== 0 }
        this.renderer?.domElement.setPointerCapture(event.pointerId)
    }

    private onMove = (event: PointerEvent) => {
        if (this.gesture && Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 5) this.gesture.moved = true
        if (!this.gesture) {
            this.hover = this.pick(event)
            if (this.renderer) this.renderer.domElement.style.cursor = this.hover ? 'pointer' : 'grab'
        }
    }

    private onUp = (event: PointerEvent) => {
        if (this.gesture?.id === event.pointerId && !this.gesture.moved && this.pointers.size === 1) {
            const id = this.pick(event)
            if (id) this.select(id)
        }
        this.onCancel(event)
    }

    private onCancel = (event: PointerEvent) => {
        this.pointers.delete(event.pointerId)
        this.gesture = void 0
    }

    private release() {
        cancelAnimationFrame(this.frame)
        this.request?.abort()
        this.observer?.disconnect()
        this.controls?.dispose()
        this.reduced.removeEventListener('change', this.onReducedMotion)
        this.unload()
        this.planet = void 0
        disposeGroup(this.scene)
        this.scene.clear()
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
        this.renderer = void 0
        this.pointers.clear()
    }

    override disconnectedCallback() { super.disconnectedCallback(); this.release() }
}
customElements.define('lem-scene', LemScene)
