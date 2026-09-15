import { themeColor } from '../theme.ts'
import { AppElement } from '../components/element.ts'
import { html } from 'lit'
import * as T from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { solid, disposeGroup } from '../render/geometry.ts'
import { STARS, PLANETS, starById, systemPlan, transferPoint, planetPoint } from './navigation.ts'
import type { MapMode, PlanetId, Point3, Transfer } from './navigation.ts'

export class AtlasScene extends AppElement {
    static properties = { mode: {}, star: {}, planet: {}, progress: { type: Number }}
    declare mode: MapMode
    declare star: string
    declare planet: PlanetId
    declare progress: number
    private renderer?: T.WebGLRenderer
    private scene = new T.Scene
    private content = new T.Group
    private camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.01, 150)
    private observer?: ResizeObserver
    private frame = 0
    private initialOrientation = new T.Quaternion
    private controls?: TrackballControls
    private pointers = new Set<number>
    private signature = ''
    private plan = systemPlan('mars')
    private bodies = (new Map<string, T.Object3D>)
    private player = new T.Group
    private arrival = new T.Group
    private pointer?: { id: number, x: number, y: number }
    private moved = false
    private error = ''

    constructor() {
        super()
        this.mode = 'sector'
        this.star = 'cersa'
        this.planet = 'mars'
        this.progress = 0
    }

    override render() {
        const labels = this.mode === 'sector'
            ? STARS.map(s => ({ id: s.id, text: s.id, sub: s.id === 'sol' ? 'departure' : !s.surveyed ? 'unsurveyed' : `${ s.ports } ${ s.ports === 1 ? 'port' : 'ports' }`, selected: s.id === this.star }))
            : PLANETS.map(p => ({ id: p.id, text: p.id, sub: p.id === this.planet ? `${ p.port } / now` : p.id === 'earth' ? 'sol outpost' : '', selected: p.id === this.planet }))
        return html`<canvas aria-label=${ this.mode === 'sector' ? 'interactive interstellar map; choose a system using map labels or the destination selector' : 'solar system orbital map with a calculated transfer and moving planets' }></canvas>
            <div class="atlas-labels">${ labels.map(l => html`<button data-object=${ l.id } class="atlas-label ${ l.selected ? 'selected' : '' }" @click=${ () => this.select(l.id) }><b>${ l.text }</b><small>${ l.sub }</small></button>`) }
                <span class="atlas-arrival" data-object="arrival">${ this.mode === 'system' ? `${ this.planet } at arrival` : '' }</span>
                <span class="atlas-player-label" data-object="player">${ this.progress === 1 ? 'arrived' : this.progress === 0 ? 'your vessel' : 'in transit' }</span>
            </div>
            ${ this.error ? html`<div class="render-error">${ this.error }<small>destination selectors and travel controls remain available.</small></div>` : '' }`
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
            this.scene.add(this.content)
            this.observer = new ResizeObserver(() => this.resize())
            this.observer.observe(this)
            canvas.addEventListener('pointerdown', this.down)
            canvas.addEventListener('pointermove', this.move)
            canvas.addEventListener('pointerup', this.up)
            canvas.addEventListener('pointercancel', this.cancel)
            this.resetCamera()
            this.rebuild()
            this.resize()
            this.drawFrame()
        }
        catch {
            this.error = 'webgl could not start on this device.'
            this.requestUpdate()
        }
    }

    override updated() {
        const signature = `${ this.mode }/${ this.star }/${ this.planet }`
        if (signature !== this.signature && this.renderer) {
            if (!this.signature.startsWith(this.mode)) this.resetCamera()
            this.signature = signature
            this.rebuild()
            this.resize()
        }
    }

    private line(points: Point3[], color: string, dashed = false) {
        const geometry = (new T.BufferGeometry).setFromPoints(points.map(p => new T.Vector3(...p)))
        const material = dashed
            ? new T.LineDashedMaterial({ color, dashSize: this.mode === 'sector' ? 0.12 : 0.025, gapSize: this.mode === 'sector' ? 0.13 : 0.022, transparent: true, opacity: 0.75 })
            : new T.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
        const line = new T.Line(geometry, material)
        if (dashed) line.computeLineDistances()
        this.content.add(line)
        return line
    }

    private ring(radius: number, color: string, position: Point3) {
        const points: Point3[] = Array.from({ length: 129 }, (_, i) => [ radius * Math.cos(i * Math.PI / 64), radius * Math.sin(i * Math.PI / 64), 0 ])
        const line = this.line(points, color)
        line.position.set(...position)
        return line
    }

    private rebuild() {
        disposeGroup(this.content)
        this.content.clear()
        this.bodies.clear()
        this.plan = systemPlan(this.planet === 'earth' ? 'mars' : this.planet)
        if (this.mode === 'sector') this.buildSector()
        else this.buildSystem(this.plan)
        this.player = new T.Group
        const size = this.mode === 'sector' ? 0.16 : 0.034
        const pointer = solid(new T.ConeGeometry(size * 0.65, size * 2, 3), this.amber)
        if (this.mode === 'sector') pointer.rotation.x = Math.PI / 2
        this.player.add(pointer)
        this.content.add(this.player)
        this.bodies.set('player', this.player)
    }

    private buildSector() {
        for (let i = -7; i <= 7; i++) {
            this.line([[ i, -7, -1.9 ], [ i, 7, -1.9 ]], themeColor('line'))
            this.line([[ -7, i, -1.9 ], [ 7, i, -1.9 ]], themeColor('line'))
        }
        for (const star of STARS) {
            const dot = solid(new T.IcosahedronGeometry(star.id === 'sol' || star.id === this.star ? 0.1 : 0.06, 0), star.color)
            dot.position.set(...star.position)
            dot.userData.destination = star.id
            this.content.add(dot)
            this.bodies.set(star.id, dot)
            this.line([ star.position, [ star.position[ 0 ], star.position[ 1 ], -1.9 ]], themeColor('line'))
            this.ring(0.055, themeColor('line'), [ star.position[ 0 ], star.position[ 1 ], -1.9 ])
            if (star.id !== 'sol' && star.surveyed) this.line([[ 0, 0, 0 ], star.position ], star.id === this.star ? this.amber : themeColor('line'), star.id !== this.star)
        }
        this.ring(0.24, '#eee2ca', [ 0, 0, 0 ])
        this.ring(0.25, this.amber, starById(this.star).position)
    }

    private buildSystem(plan: Transfer) {
        const sun = solid(new T.IcosahedronGeometry(0.17, 1), '#e4bc75')
        this.content.add(sun)
        for (const planet of PLANETS) {
            const points: Point3[] = Array.from({ length: 257 }, (_, i) => [ planet.radius * Math.cos(i * Math.PI / 128), planet.radius * Math.sin(i * Math.PI / 128), 0 ])
            this.line(points, planet.id === 'earth' ? '#78aebf' : planet.id === plan.target ? '#876555' : themeColor('line'))
            const body = solid(new T.IcosahedronGeometry(planet.size * 1.35, 1), planet.color)
            body.userData.destination = planet.id
            this.bodies.set(planet.id, body)
            this.content.add(body)
        }
        this.line(Array.from({ length: 201 }, (_, i) => transferPoint(plan, i / 200)), this.amber)
        this.arrival = new T.Group
        const ring = this.ring(0.035, this.mint, [ 0, 0, 0 ])
        this.arrival.add(ring)
        this.arrival.position.set(...planetPoint(plan.target, plan, 1))
        this.content.add(this.arrival)
        this.bodies.set('arrival', this.arrival)
        this.ring(0.029, this.amber, transferPoint(plan, 0))
        this.line(Array.from({ length: 81 }, (_, i) => planetPoint(plan.target, plan, i / 80)), '#699b8a', true)
    }

    private updatePositions() {
        if (this.mode === 'sector') {
            const target = new T.Vector3(...starById(this.star).position)
            this.player.position.copy(target.clone().multiplyScalar(this.progress))
            this.player.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), target.normalize())
            return
        }
        for (const p of PLANETS) this.bodies.get(p.id)?.position.set(...planetPoint(p.id, this.plan, this.progress))
        const p = transferPoint(this.plan, this.progress)
        const next = transferPoint(this.plan, Math.min(1, this.progress + 0.001))
        const previous = transferPoint(this.plan, Math.max(0, this.progress - 0.001))
        this.player.position.set(...p)
        this.player.rotation.z = Math.atan2(next[ 1 ] - previous[ 1 ], next[ 0 ] - previous[ 0 ]) - Math.PI / 2
    }

    private resize() {
        if (!this.renderer || !this.clientWidth || !this.clientHeight) return
        const width = this.clientWidth, height = this.clientHeight
        this.renderer.setSize(width, height, false)
        const aspect = width / height
        const half = this.mode === 'sector' ? Math.max(5.5, 6.7 / aspect) : Math.max(1.83, 1.82 / aspect)
        this.camera.left = -half * aspect
        this.camera.right = half * aspect
        this.camera.top = half
        this.camera.bottom = -half
        this.camera.updateProjectionMatrix()
        if (this.controls) {
            this.controls.handleResize()
            // Orthographic panning otherwise inherits a perspective distance scale.
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
        // XYZ world-axis offsets from the initial view give each reset a stable reference.
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
        this.pointer = undefined
        if (this.mode === 'sector') {
            this.camera.position.set(Math.sin(-0.35) * 13, -Math.cos(-0.35) * 13, 14)
            this.camera.up.set(0, 0, 1)
        }
        else {
            this.camera.position.set(0, 0, 15)
            this.camera.up.set(0, 1, 0)
        }
        this.camera.zoom = 1
        this.camera.lookAt(0, 0, 0)
        this.initialOrientation.copy(this.camera.quaternion)
        if (this.renderer) {
            // Trackball rotation crosses the poles without locking an axis or flipping the view.
            this.controls = new TrackballControls(this.camera, this.renderer.domElement)
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
        this.updatePositions()
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
            label.style.left = `${ Math.max(8, Math.min(this.clientWidth - 105, x + 13)) }px`
            label.style.top = `${ Math.max(8, Math.min(this.clientHeight - 35, y - (label.dataset.object === 'arrival' ? 32 : label.dataset.object === 'player' ? -19 : 12))) }px`
        }
    }

    private select(id: string) { this.dispatchEvent(new CustomEvent('destination-select', { detail: id, bubbles: true, composed: true })) }
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
        this.pointer = undefined
        this.moved = true
    }

    private up = (event: PointerEvent) => {
        if (this.pointer?.id === event.pointerId && this.pointers.size === 1 && !this.moved && this.renderer) {
            const rect = this.renderer.domElement.getBoundingClientRect()
            const ray = new T.Raycaster
            ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera)
            const hit = ray.intersectObjects([ ...this.bodies.values() ], true).find(h => h.object.userData.destination)
            if (hit) this.select(hit.object.userData.destination)
        }
        this.pointers.delete(event.pointerId)
        this.pointer = undefined
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
