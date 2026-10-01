import { themeColor } from '../theme.ts'
import { AppElement } from '../components/element.ts'
import { html, type PropertyValues } from 'lit'
import * as T from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { solid, disposeGroup } from '../render/geometry.ts'
import type { MapMode, Point3, ChartNode, ChartEdge, Marker } from './chart.ts'

/**
 * the chart renderer. it draws whatever nodes, edges, rings and markers
 * the view hands it, in an orthographic frame with trackball rotation.
 * nodes and edges rebuild when they change. markers move every frame.
 */
export class AtlasScene extends AppElement {
    static properties = {
        mode    : {},
        nodes   : { attribute: false },
        edges   : { attribute: false },
        rings   : { attribute: false },
        markers : { attribute: false },
        selected: {},
        here    : {},
    }

    declare mode: MapMode
    declare nodes: ChartNode[]
    declare edges: ChartEdge[]
    declare rings: number[]
    declare markers: Marker[]
    declare selected?: string
    declare here?: string

    private renderer?: T.WebGLRenderer
    private scene = new T.Scene
    private content = new T.Group
    private fleet = new T.Group
    private camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.01, 300)
    private observer?: ResizeObserver
    private frame = 0
    private initialOrientation = new T.Quaternion
    private controls?: TrackballControls
    private pointers = new Set<number>
    private signature = ''
    private bodies = new Map<string, T.Object3D>
    private ships = new Map<string, T.Object3D>
    private center = new T.Vector3
    private extent = 6
    private pointer?: { id: number, x: number, y: number }
    private moved = false
    private error = ''

    constructor() {
        super()
        this.mode = 'sector'
        this.nodes = []
        this.edges = []
        this.rings = []
        this.markers = []
    }

    override render() {
        return html`<canvas aria-label=${ this.mode === 'sector' ? 'interstellar chart; choose a system with the labels or the destination selector' : 'system chart; choose a station with the labels or the destination selector' }></canvas>
            <div class="atlas-labels">${ this.nodes.map((n, i) => html`
                <button data-object=${ n.id } data-side=${ this.mode === 'system' && i % 2 ? 'below' : 'above' } class="atlas-label ${ n.id === this.selected ? 'selected' : '' } ${ n.id === this.here ? 'here' : '' }" title=${ n.id === this.here ? 'you are here' : n.sub } @click=${ () => this.select(n.id) }>
                    <b>${ n.name }</b>
                </button>`) }
                <span class="atlas-player-label" data-object="mine">${ this.markers.find(m => m.mine)?.heading ? 'in transit' : 'your vessel' }</span>
            </div>
            ${ this.error ? html`<div class="render-error">${ this.error }<small>the destination selector and travel controls remain available.</small></div>` : '' }`
    }

    private get amber() { return themeColor('amber') }
    private get mint() { return themeColor('mint') }
    private themeChanged = () => { if (this.renderer) this.rebuild() }

    override firstUpdated() {
        document.addEventListener('theme-change', this.themeChanged)
        try {
            const canvas = this.querySelector('canvas')!
            this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true })
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
            this.renderer.setClearColor(0, 0)
            this.scene.add(this.content, this.fleet)
            this.observer = new ResizeObserver(() => this.resize())
            this.observer.observe(this)
            canvas.addEventListener('pointerdown', this.down)
            canvas.addEventListener('pointermove', this.move)
            canvas.addEventListener('pointerup', this.up)
            canvas.addEventListener('pointercancel', this.cancel)
            this.frameContent()
            this.resetCamera()
            this.rebuild()
            this.drawFrame()
        }
        catch {
            this.error = 'webgl could not start on this device.'
            this.requestUpdate()
        }
    }

    override updated(changes: PropertyValues) {
        if (!this.renderer) return
        const signature = `${ this.mode }/${ this.selected }/${ this.here }/${ this.nodes.map(n => n.id + n.position.join()).join('|') }/${ this.edges.map(e => e.kind + e.a.join() + e.b.join()).join('|') }/${ this.rings.join() }`
        if (signature !== this.signature) {
            const modeChanged = !this.signature.startsWith(this.mode + '/')
            this.signature = signature
            this.frameContent()
            if (modeChanged || changes.has('mode')) this.resetCamera()
            this.rebuild()
            this.resize()
        }
    }

    // ── content ──────────────────────────────────────────────

    /** fit the frame to the nodes: their center and half extent. */
    private frameContent() {
        const box = new T.Box3
        for (const n of this.nodes) box.expandByPoint(new T.Vector3(...n.position))
        if (this.mode === 'system') box.expandByPoint(new T.Vector3(0, 0, 0))
        if (box.isEmpty()) { this.center.set(0, 0, 0); this.extent = 6; return }
        box.getCenter(this.center)
        const size = box.getSize(new T.Vector3)
        this.extent = Math.max(1.6, Math.max(size.x, size.y, size.z) / 2 * 1.3)
    }

    private unit() { return this.extent / 6 }

    private line(points: Point3[], color: string, dashed = false, opacity = 0.8) {
        const geometry = (new T.BufferGeometry).setFromPoints(points.map(p => new T.Vector3(...p)))
        const material = dashed
            ? new T.LineDashedMaterial({ color, dashSize: 0.12 * this.unit(), gapSize: 0.13 * this.unit(), transparent: true, opacity })
            : new T.LineBasicMaterial({ color, transparent: true, opacity })
        const line = new T.Line(geometry, material)
        if (dashed) line.computeLineDistances()
        this.content.add(line)
        return line
    }

    private ring(radius: number, color: string, position: Point3, opacity = 0.8) {
        const points: Point3[] = Array.from({ length: 129 }, (_, i) => [ radius * Math.cos(i * Math.PI / 64), radius * Math.sin(i * Math.PI / 64), 0 ])
        const line = this.line(points, color, false, opacity)
        line.position.set(...position)
        return line
    }

    private rebuild() {
        disposeGroup(this.content)
        this.content.clear()
        this.bodies.clear()
        const u = this.unit()
        if (this.mode === 'sector') this.grid()
        for (const r of this.rings) this.ring(r, themeColor('line'), [ 0, 0, 0 ], 0.6)
        for (const e of this.edges.filter(e => e.kind === 'route')) this.line([ e.a, e.b ], themeColor('line'), false, 0.7)
        for (const e of this.edges.filter(e => e.kind !== 'route')) this.line([ e.a, e.b ], this.amber, e.kind === 'preview', 0.95)
        for (const n of this.nodes) {
            const active = n.id === this.selected || n.id === this.here
            const radius = (n.kind === 'system' && this.mode === 'system' ? 0.17 : 0.07) * n.size * u * (active ? 1.35 : 1)
            const dot = solid(new T.IcosahedronGeometry(radius, n.kind === 'system' ? 1 : 0), n.color)
            dot.position.set(...n.position)
            dot.userData.node = n.id
            this.content.add(dot)
            this.bodies.set(n.id, dot)
            if (this.mode === 'sector') {
                const floor = this.center.z - this.extent * 0.32
                this.line([ n.position, [ n.position[ 0 ], n.position[ 1 ], floor ]], themeColor('line'), false, 0.5)
                this.ring(0.055 * u, themeColor('line'), [ n.position[ 0 ], n.position[ 1 ], floor ])
            }
            if (n.id === this.selected) this.ring(0.25 * u, this.amber, n.position)
            if (n.id === this.here) this.ring(0.19 * u, this.mint, n.position)
        }
        this.placeMarkers()
    }

    private grid() {
        const z = this.center.z - this.extent * 0.32
        const step = Math.ceil(this.extent / 6)
        const span = Math.ceil(this.extent * 1.1 / step) * step
        for (let i = -span; i <= span; i += step) {
            this.line([[ this.center.x + i, this.center.y - span, z ], [ this.center.x + i, this.center.y + span, z ]], themeColor('line'), false, 0.35)
            this.line([[ this.center.x - span, this.center.y + i, z ], [ this.center.x + span, this.center.y + i, z ]], themeColor('line'), false, 0.35)
        }
    }

    /** one cone per mover. ours is amber, the rest a dim mint. */
    private placeMarkers() {
        const seen = (new Set<string>)
        const u = this.unit()
        for (const m of this.markers) {
            seen.add(m.id)
            let cone = this.ships.get(m.id)
            if (!cone) {
                const size = (m.mine ? 0.16 : 0.1) * u
                cone = solid(new T.ConeGeometry(size * 0.65, size * 2, 3), m.mine ? this.amber : this.mint)
                this.ships.set(m.id, cone)
                this.fleet.add(cone)
            }
            cone.position.set(...m.position)
            if (m.heading) cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...m.heading).normalize())
            else cone.quaternion.identity()
            if (m.mine) this.bodies.set('mine', cone)
        }
        for (const [ id, cone ] of this.ships) {
            if (seen.has(id)) continue
            this.fleet.remove(cone)
            disposeGroup(cone)
            this.ships.delete(id)
        }
        if (!this.markers.some(m => m.mine)) this.bodies.delete('mine')
    }

    // ── camera ───────────────────────────────────────────────

    private resize() {
        if (!this.renderer || !this.clientWidth || !this.clientHeight) return
        const width = this.clientWidth, height = this.clientHeight
        this.renderer.setSize(width, height, false)
        const aspect = width / height
        const half = Math.max(this.extent, this.extent * 1.15 / aspect)
        this.camera.left = -half * aspect
        this.camera.right = half * aspect
        this.camera.top = half
        this.camera.bottom = -half
        this.camera.updateProjectionMatrix()
        if (this.controls) {
            this.controls.handleResize()
            // orthographic panning otherwise inherits a perspective distance scale.
            this.controls.panSpeed = width / this.camera.position.distanceTo(this.controls.target)
        }
    }

    adjustZoom(delta: number) {
        this.camera.zoom = Math.min(2.5, Math.max(0.65, this.camera.zoom + delta))
        this.camera.updateProjectionMatrix()
    }

    resetAxis(axis: 'x' | 'y' | 'z') {
        if (!this.controls) return
        this.controls.update()
        // xyz world-axis offsets from the initial view give each reset a stable reference.
        const delta = this.camera.quaternion.clone().multiply(this.initialOrientation.clone().invert())
        const angles = (new T.Euler).setFromQuaternion(delta, 'XYZ')
        angles[ axis ] = 0
        const correction = (new T.Quaternion).setFromEuler(angles).multiply(delta.invert())
        this.camera.position.sub(this.controls.target).applyQuaternion(correction).add(this.controls.target)
        this.camera.up.applyQuaternion(correction)
        this.camera.lookAt(this.controls.target)
        this.controls.update()
    }

    resetCamera() {
        this.controls?.dispose()
        this.pointers.clear()
        this.pointer = void 0
        const c = this.center
        const d = this.extent * 2.4
        if (this.mode === 'sector') {
            this.camera.position.set(c.x + Math.sin(-0.35) * d, c.y - Math.cos(-0.35) * d, c.z + d * 1.05)
            this.camera.up.set(0, 0, 1)
        }
        else {
            this.camera.position.set(c.x, c.y, c.z + d)
            this.camera.up.set(0, 1, 0)
        }
        this.camera.zoom = 1
        this.camera.lookAt(c)
        this.initialOrientation.copy(this.camera.quaternion)
        if (this.renderer) {
            // trackball rotation crosses the poles without locking an axis or flipping the view.
            this.controls = new TrackballControls(this.camera, this.renderer.domElement)
            this.controls.target.copy(c)
            this.controls.staticMoving = true
            this.controls.rotateSpeed = 1.6
            this.controls.minZoom = 0.65
            this.controls.maxZoom = 2.5
            this.controls.keys = [ '', '', '' ]
        }
        this.resize()
    }

    private drawFrame = () => {
        if (!this.isConnected || !this.renderer) return
        this.frame = requestAnimationFrame(this.drawFrame)
        this.controls?.update()
        this.placeMarkers()
        this.renderer.render(this.scene, this.camera)
        this.placeLabels()
    }

    private placeLabels() {
        for (const label of this.querySelectorAll<HTMLElement>('[data-object]')) {
            const body = this.bodies.get(label.dataset.object!)
            label.hidden = !body
            if (!body) continue
            const p = body.getWorldPosition(new T.Vector3).project(this.camera)
            const x = (p.x + 1) * this.clientWidth / 2
            const y = (1 - p.y) * this.clientHeight / 2
            // labels alternate sides along a system's line. the vessel label sits below left.
            const mine = label.dataset.object === 'mine'
            const below = mine || label.dataset.side === 'below'
            label.style.left = `${ Math.max(8, Math.min(this.clientWidth - 105, mine ? x - 84 : x + 13)) }px`
            label.style.top = `${ Math.max(8, Math.min(this.clientHeight - 35, below ? y + 10 : y - 30)) }px`
        }
    }

    // ── picking ──────────────────────────────────────────────

    private select(id: string) { this.dispatchEvent(new CustomEvent('node-select', { detail: id, bubbles: true, composed: true })) }

    private down = (event: PointerEvent) => {
        this.controls?.handleResize()
        this.pointers.add(event.pointerId)
        if (this.pointers.size > 1) { this.moved = true; return }
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
        this.moved = event.button !== 0
    }

    private move = (event: PointerEvent) => {
        if (!this.pointer || event.pointerId !== this.pointer.id) return
        if (Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) > 5) this.moved = true
    }

    private cancel = (event: PointerEvent) => {
        this.pointers.delete(event.pointerId)
        this.pointer = void 0
        this.moved = true
    }

    private up = (event: PointerEvent) => {
        if (this.pointer?.id === event.pointerId && this.pointers.size === 1 && !this.moved && this.renderer) {
            const rect = this.renderer.domElement.getBoundingClientRect()
            const ray = new T.Raycaster
            ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera)
            const hit = ray.intersectObjects([ ...this.bodies.values() ], true).find(h => h.object.userData.node)
            if (hit) this.select(hit.object.userData.node)
        }
        this.pointers.delete(event.pointerId)
        this.pointer = void 0
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        cancelAnimationFrame(this.frame)
        this.observer?.disconnect()
        document.removeEventListener('theme-change', this.themeChanged)
        this.controls?.dispose()
        this.pointers.clear()
        const canvas = this.renderer?.domElement
        canvas?.removeEventListener('pointerdown', this.down)
        canvas?.removeEventListener('pointermove', this.move)
        canvas?.removeEventListener('pointerup', this.up)
        canvas?.removeEventListener('pointercancel', this.cancel)
        disposeGroup(this.scene)
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
    }
}
customElements.define('atlas-scene', AtlasScene)
