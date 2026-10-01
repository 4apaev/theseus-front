import { html } from 'lit'
import * as T from 'three'
import { AppElement } from './element.ts'
import { disposeGroup } from '../render/geometry.ts'
import { loadHullModel } from '../render/hull-model.ts'
import { Fail } from '../util.ts'
import { configureShipRenderer, shipLighting } from '../render/ship-lighting.ts'
import { HULLS, type HullId, type Category } from '../model.ts'

/**
 * one webgl renderer for every thumbnail. a browser keeps about 16 live
 * contexts. a catalog of 36 cards, each with its own, loses the oldest,
 * the port and rig viewports among them. so each card owns a plain 2d
 * canvas and copies the shared frame into it.
 */
class Thumbnails {
    private renderer?: T.WebGLRenderer
    private users = 0

    acquire() {
        this.users++
        if (this.renderer) return
        this.renderer = new T.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true, preserveDrawingBuffer: true })
        this.renderer.setClearColor(0x000000, 0)
        configureShipRenderer(this.renderer)
    }

    release() {
        if (--this.users > 0 || !this.renderer) return
        this.renderer.dispose()
        this.renderer.forceContextLoss()
        this.renderer = void 0
    }

    /** render at the target's size, then copy the pixels into it. */
    paint(target: HTMLCanvasElement, scene: T.Scene, camera: T.Camera) {
        const r = this.renderer
        const width = target.clientWidth, height = target.clientHeight
        if (!r || !width || !height) return
        const ratio = Math.min(devicePixelRatio, 2)
        r.setPixelRatio(ratio)
        r.setSize(width, height, false)
        r.render(scene, camera)
        target.width = Math.round(width * ratio)
        target.height = Math.round(height * ratio)
        const ctx = target.getContext('2d')
        ctx?.clearRect(0, 0, target.width, target.height)
        ctx?.drawImage(r.domElement, 0, 0, target.width, target.height)
    }
}

const thumbnails = new Thumbnails

/** Static glb thumbnail; one render per size change, no animation loop. */
class HullPreview extends AppElement {
    static properties = { hull: {}, category: {}}
    declare hull: HullId
    declare category: Category
    private scene = new T.Scene
    private camera = new T.OrthographicCamera(-8, 8, 4, -4, 0.1, 80)
    private observer?: ResizeObserver
    private bounds = new T.Box3
    private signature = ''
    private failed = false
    private ready = false
    private generation = 0

    constructor() {
        super()
        this.hull = 'discovery'
        this.category = 'civil'
    }

    override render() {
        return this.failed
            ? html`<span class="preview-fallback">model preview unavailable</span>`
            : html`<canvas aria-hidden="true"></canvas>`
    }

    override firstUpdated() {
        try {
            thumbnails.acquire()
            this.ready = true
            this.observer = new ResizeObserver(this.draw)
            this.observer.observe(this)
            void this.rebuild()
        }
        catch (error) {
            console.error(Fail.from(error, 'hull-preview'))
            this.failed = true
            this.requestUpdate()
        }
    }

    override updated() {
        if (this.ready && this.signature !== `${ this.hull }/${ this.category }`) void this.rebuild()
    }

    private async rebuild() {
        const generation = ++this.generation
        const hull = HULLS.find(item => item.id === this.hull)
        if (!hull) return
        this.signature = `${ this.hull }/${ this.category }`
        disposeGroup(this.scene)
        this.scene.clear()
        this.scene.add(shipLighting())
        try {
            const ship = await loadHullModel(hull)
            if (generation !== this.generation) { disposeGroup(ship); return }
            const bounds = (new T.Box3).setFromObject(ship)
            const center = bounds.getCenter(new T.Vector3)
            ship.position.sub(center)
            this.bounds.copy(bounds).translate(center.negate())
            this.scene.add(ship)
            this.camera.position.set(-5, 6, 11)
            this.camera.lookAt(0, 0, 0)
            this.failed = false
            this.draw()
        }
        catch (error) {
            if (generation !== this.generation) return
            console.error(Fail.from(error, 'hull-load'))
            this.failed = true
            this.requestUpdate()
        }
    }

    /** fit the hull's box in the frame at the card's aspect, then paint. */
    private draw = () => {
        const canvas = this.querySelector('canvas')
        if (!canvas || !this.clientWidth || !this.clientHeight) return
        const aspect = this.clientWidth / this.clientHeight
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
        thumbnails.paint(canvas, this.scene, this.camera)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        this.observer?.disconnect()
        disposeGroup(this.scene)
        if (this.ready) thumbnails.release()
        this.ready = false
    }
}
customElements.define('hull-preview', HullPreview)
