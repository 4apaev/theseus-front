import { html } from 'lit'
import * as T from 'three'
import { AppElement } from './element.ts'
import { buildShip, disposeGroup } from '../render/geometry.ts'
import { configureShipRenderer, shipLighting } from '../render/ship-lighting.ts'
import type { HullId, Category } from '../model.ts'

/** Static procedural thumbnail; one render per size change, no animation loop. */
class HullPreview extends AppElement {
    static properties = { hull: {}, category: {}}
    declare hull: HullId
    declare category: Category
    private renderer?: T.WebGLRenderer
    private scene = new T.Scene
    private camera = new T.OrthographicCamera(-8, 8, 4, -4, 0.1, 80)
    private observer?: ResizeObserver
    private bounds = new T.Box3
    private signature = ''
    private failed = false

    constructor() {
        super()
        this.hull = 'discovery'
        this.category = 'civil'
    }

    override render() {
        return this.failed
            ? html`<span class="preview-fallback">procedural preview unavailable</span>`
            : html`<canvas aria-hidden="true"></canvas>`
    }

    override firstUpdated() {
        try {
            this.renderer = new T.WebGLRenderer({ canvas: this.querySelector('canvas')!, alpha: true, antialias: true })
            this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
            this.renderer.setClearColor(0x000000, 0)
            configureShipRenderer(this.renderer)
            this.observer = new ResizeObserver(this.draw)
            this.observer.observe(this)
            this.rebuild()
        }
        catch {
            this.failed = true
            this.requestUpdate()
        }
    }

    override updated() {
        if (this.renderer && this.signature !== `${ this.hull }/${ this.category }`) this.rebuild()
    }

    private rebuild() {
        disposeGroup(this.scene)
        this.scene.clear()
        const ship = buildShip(this.hull, this.category)
        const bounds = (new T.Box3).setFromObject(ship)
        const center = bounds.getCenter((new T.Vector3))
        ship.position.sub(center)
        this.bounds.copy(bounds).translate(center.negate())
        this.scene.add(ship, shipLighting())
        this.camera.position.set(-5, 6, 11)
        this.camera.lookAt(0, 0, 0)
        this.signature = `${ this.hull }/${ this.category }`
        this.draw()
    }

    private draw = () => {
        if (!this.renderer || !this.clientWidth || !this.clientHeight) return
        const width = this.clientWidth, height = this.clientHeight
        const aspect = width / height
        this.camera.updateMatrixWorld()
        let half = 0.1
        for (const x of [ this.bounds.min.x, this.bounds.max.x ]) {
            for (const y of [ this.bounds.min.y, this.bounds.max.y ]) {
                for (const z of [ this.bounds.min.z, this.bounds.max.z ]) {
                    const point = new T.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse)
                    half = Math.max(half, Math.abs(point.x) / aspect, Math.abs(point.y))
                }
            }
        }
        half *= 1.12
        this.camera.left = -half * aspect
        this.camera.right = half * aspect
        this.camera.top = half
        this.camera.bottom = -half
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(width, height, false)
        this.renderer.render(this.scene, this.camera)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        this.observer?.disconnect()
        disposeGroup(this.scene)
        this.renderer?.dispose()
        this.renderer?.forceContextLoss()
    }
}
customElements.define('hull-preview', HullPreview)
