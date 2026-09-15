import { themeColor } from '../theme.ts'
import { AppElement } from '../components/element.ts'
import { html } from 'lit'
import { EARTH_RADIUS, INITIAL_RADIUS, TARGET_RADIUS, solveOrbit, positionAt, targetAt, closestApproach } from '../simulation/orbit.ts'
import type { Orbit, Vec } from '../simulation/orbit.ts'

export class OrbitView extends AppElement {
    static properties = { prograde: { type: Number }, radial: { type: Number }, phase: { type: Number }, time: { type: Number }}
    declare prograde: number
    declare radial: number
    declare phase: number
    declare time: number
    private observer?: ResizeObserver
    private context?: CanvasRenderingContext2D
    private orbit?: Orbit
    private scale = 1
    private cx = 0
    private cy = 0
    private dragging = false
    private targetTime = 0
    private signature = ''
    constructor() { super(); this.prograde = 1.05; this.radial = 0; this.phase = Math.PI; this.time = 0 }
    override render() { return html`<canvas class="orbit-canvas" aria-label="calculated earth-centered orbital preview. use burn controls and node angle slider to change the trajectory."></canvas><div class="orbit-caption"><span>earth-centered inertial frame</span><span>km · s · instantaneous impulse</span></div>` }
    private themeChanged = () => this.draw()
    override firstUpdated() {
        document.addEventListener('theme-change', this.themeChanged)
        const canvas = this.querySelector('canvas')!
        this.context = canvas.getContext('2d') ?? undefined
        this.observer = new ResizeObserver(() => this.draw())
        this.observer.observe(this)
        canvas.addEventListener('pointerdown', this.down)
        canvas.addEventListener('pointermove', this.move)
        canvas.addEventListener('pointerup', this.up)
        canvas.addEventListener('pointercancel', this.up)
        this.draw()
    }

    override updated() { this.draw() }
    private point(p: Vec) { return { x: this.cx + p.x * this.scale, y: this.cy - p.y * this.scale } }
    private draw() {
        const palette = Object.fromEntries([ 'line', 'muted', 'text', 'cream', 'amber', 'cyan', 'mint', 'red', 'panel' ].map(key => [ key, themeColor(key) ]))
        const font = `${ parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.6875 }px ${ themeColor('font-mono') }`
        const ctx = this.context
        if (!ctx) return
        const signature = `${ this.prograde }/${ this.radial }/${ this.phase }`
        if (signature !== this.signature) {
            this.signature = signature
            try { this.orbit = solveOrbit(this.prograde, this.radial, this.phase); this.targetTime = closestApproach(this.orbit).time }
            catch { this.orbit = undefined }
        }
        const width = this.clientWidth, height = this.clientHeight
        if (!width || !height) return
        const ratio = Math.min(devicePixelRatio, 2)
        const canvas = ctx.canvas
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = width * ratio; canvas.height = height * ratio }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, width, height)
        this.cx = width * 0.5
        this.cy = height * 0.49
        const reach = Math.max(TARGET_RADIUS, Math.min(this.orbit?.apoapsis ?? TARGET_RADIUS, 65000))
        this.scale = Math.min(width * 0.41, height * 0.39) / reach
        ctx.font = font
        ctx.lineWidth = 1
        ctx.strokeStyle = palette.line
        for (let i = 0; i < 4; i++) {
            const r = (i + 1) * reach * this.scale / 4
            ctx.beginPath(); ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2); ctx.stroke()
        }
        ctx.setLineDash([ 2, 7 ])
        ctx.beginPath(); ctx.moveTo(this.cx, 38); ctx.lineTo(this.cx, height - 50); ctx.moveTo(35, this.cy); ctx.lineTo(width - 35, this.cy); ctx.stroke()
        ctx.setLineDash([])
        const earth = EARTH_RADIUS * this.scale
        ctx.fillStyle = palette.panel
        ctx.beginPath(); ctx.arc(this.cx, this.cy, earth, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = palette.muted
        ctx.beginPath(); ctx.arc(this.cx, this.cy, earth, Math.PI / 2, Math.PI * 1.5); ctx.fill()
        ctx.strokeStyle = palette.line; ctx.stroke()
        ctx.fillStyle = palette.text; ctx.textAlign = 'center'; ctx.fillText('earth', this.cx, this.cy + earth + 19)
        this.circle(INITIAL_RADIUS, palette.cyan, false)
        this.circle(TARGET_RADIUS, palette.muted, true)
        if (!this.orbit) { ctx.fillStyle = palette.red; ctx.fillText('unbound trajectory', this.cx, 30); return }
        const o = this.orbit
        ctx.lineWidth = 1.8; ctx.strokeStyle = o.periapsis < EARTH_RADIUS ? palette.red : palette.amber
        ctx.beginPath()
        for (let i = 0; i <= 400; i++) {
            const p = this.point(positionAt(o, o.period * i / 400))
            if (i === 0) ctx.moveTo(p.x, p.y)
            else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        const node = this.point({ x: INITIAL_RADIUS * Math.cos(this.phase), y: INITIAL_RADIUS * Math.sin(this.phase) })
        this.marker(node, palette.amber, 7, false)
        const labelX = Math.max(80, Math.min(width - 100, node.x))
        ctx.fillStyle = palette.amber; ctx.textAlign = 'center'; ctx.fillText(width < 450 ? 'node 01' : 'node 01 · drag to move', labelX, node.y - 21)
        const p = this.point(positionAt(o, this.time * o.period))
        this.marker(p, palette.amber, 5, true)
        const currentTarget = this.point(targetAt(0)), futureTarget = this.point(targetAt(this.time * o.period))
        this.diamond(currentTarget, palette.muted, 4, true)
        this.diamond(futureTarget, palette.mint, 7, false)
        ctx.fillStyle = palette.mint; ctx.textAlign = futureTarget.x > this.cx ? 'right' : 'left'; ctx.fillText(width < 450 ? 'relay / preview' : 'relay station / preview', Math.max(145, Math.min(width - 20, futureTarget.x)), futureTarget.y - 17)
        const encounterShip = this.point(positionAt(o, this.targetTime)), encounterTarget = this.point(targetAt(this.targetTime))
        ctx.setLineDash([ 3, 5 ]); ctx.strokeStyle = palette.line; ctx.beginPath(); ctx.moveTo(encounterShip.x, encounterShip.y); ctx.lineTo(encounterTarget.x, encounterTarget.y); ctx.stroke(); ctx.setLineDash([])
        for (const [ label, distance, angle ] of [[ 'pe', o.periapsis, o.angle ], [ 'ap', o.apoapsis, o.angle + Math.PI ]] as const) {
            const point = this.point({ x: distance * Math.cos(angle), y: distance * Math.sin(angle) })
            this.marker(point, palette.cream, 2.5, true)
            ctx.textAlign = 'left'; ctx.fillStyle = palette.text; ctx.fillText(label, point.x + 10, point.y + 12)
        }
        const nx = Math.cos(this.phase), ny = -Math.sin(this.phase)
        this.arrow(node, { x: ny * 26, y: nx * -26 }, palette.amber)
        this.arrow(node, { x: nx * 23, y: ny * 23 }, palette.cyan)
        ctx.textAlign = 'left'
        const legend = [[ palette.cyan, 'current orbit' ], [ palette.amber, 'planned orbit' ], [ palette.muted, 'target orbit' ]]
        legend.forEach(([ color, text ], i) => { const x = 10 + i * width / 3; ctx.fillStyle = color; ctx.fillRect(x, height - 30, 12, 2); ctx.fillStyle = palette.text; ctx.font = font; ctx.fillText(text, x + 18, height - 26) })
    }

    private circle(radius: number, color: string, dashed: boolean) {
        const c = this.context!; c.strokeStyle = color; c.lineWidth = 1; c.setLineDash(dashed ? [ 3, 6 ] : [])
        c.beginPath(); c.arc(this.cx, this.cy, radius * this.scale, 0, Math.PI * 2); c.stroke(); c.setLineDash([])
    }

    private marker(p: Vec, color: string, r: number, fill: boolean) { const c = this.context!; c.strokeStyle = color; c.fillStyle = color; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); if (fill) c.fill(); else c.stroke() }
    private diamond(p: Vec, color: string, r: number, fill: boolean) { const c = this.context!; c.strokeStyle = color; c.fillStyle = color; c.beginPath(); c.moveTo(p.x, p.y - r); c.lineTo(p.x + r, p.y); c.lineTo(p.x, p.y + r); c.lineTo(p.x - r, p.y); c.closePath(); if (fill) c.fill(); else c.stroke() }
    private arrow(p: Vec, v: Vec, color: string) {
        const c = this.context!; c.strokeStyle = color; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + v.x, p.y + v.y); c.stroke()
    }

    private down = (e: PointerEvent) => {
        const rect = this.getBoundingClientRect(), node = this.point({ x: INITIAL_RADIUS * Math.cos(this.phase), y: INITIAL_RADIUS * Math.sin(this.phase) })
        if (Math.hypot(e.clientX - rect.left - node.x, e.clientY - rect.top - node.y) > 28) return
        this.dragging = true
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    private move = (e: PointerEvent) => {
        if (!this.dragging) return
        const rect = this.getBoundingClientRect()
        const phase = Math.atan2(-(e.clientY - rect.top - this.cy), e.clientX - rect.left - this.cx)
        this.dispatchEvent(new CustomEvent('phase-change', { detail: phase, bubbles: true, composed: true }))
    }

    private up = () => { this.dragging = false }
    override disconnectedCallback() {
        super.disconnectedCallback(); this.observer?.disconnect()
        document.removeEventListener('theme-change', this.themeChanged)
        const c = this.querySelector('canvas')
        c?.removeEventListener('pointerdown', this.down); c?.removeEventListener('pointermove', this.move); c?.removeEventListener('pointerup', this.up); c?.removeEventListener('pointercancel', this.up)
    }
}
customElements.define('orbit-view', OrbitView)
