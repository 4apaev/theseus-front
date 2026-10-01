import { html } from 'lit'
import { AppElement } from '../components/element.ts'
import { themeColor } from '../theme.ts'
import { EARTH_RADIUS, INITIAL_RADIUS, TARGET_RADIUS, solveOrbit, positionAt, targetAt, closestApproach } from '../simulation/orbit.ts'
import type { Orbit, Vec } from '../simulation/orbit.ts'

type Palette = Record<string, string>

const TOKENS  = [ 'line', 'muted', 'text', 'cream', 'amber', 'cyan', 'mint', 'red', 'panel' ]
const SAMPLES = 400

/**
 * canvas 2d drawing of the flight preview: earth, the current and
 * target orbits, the planned ellipse, the maneuver node, and the
 * closest approach. it draws calculated coordinates only; the math
 * lives in `simulation/orbit.ts`. dragging the node emits `phase-change`.
 */
class OrbitView extends AppElement {
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

    constructor() {
        super()
        this.prograde = 1.05
        this.radial   = 0
        this.phase    = Math.PI
        this.time     = 0
    }

    override render() {
        return html`
        <canvas class="orbit-canvas" aria-label="calculated earth-centered orbital preview. use burn controls and node angle slider to change the trajectory."></canvas>
        <div class="orbit-caption"><span>earth-centered inertial frame</span><span>km · s · instantaneous impulse</span></div>`
    }

    override firstUpdated() {
        document.addEventListener('theme-change', this.themeChanged)
        const canvas = this.querySelector('canvas')!
        this.context = canvas.getContext('2d') ?? void 0
        this.observer = new ResizeObserver(() => this.draw())
        this.observer.observe(this)
        canvas.addEventListener('pointerdown', this.down)
        canvas.addEventListener('pointermove', this.move)
        canvas.addEventListener('pointerup', this.up)
        canvas.addEventListener('pointercancel', this.up)
        this.draw()
    }

    override updated() { this.draw() }

    override disconnectedCallback() {
        super.disconnectedCallback()
        this.observer?.disconnect()
        document.removeEventListener('theme-change', this.themeChanged)
        const canvas = this.querySelector('canvas')
        canvas?.removeEventListener('pointerdown', this.down)
        canvas?.removeEventListener('pointermove', this.move)
        canvas?.removeEventListener('pointerup', this.up)
        canvas?.removeEventListener('pointercancel', this.up)
    }

    private themeChanged = () => this.draw()

    // ── geometry ─────────────────────────────────────────────

    private point(p: Vec): Vec {
        return { x: this.cx + p.x * this.scale, y: this.cy - p.y * this.scale }
    }

    private node(): Vec {
        return this.point({ x: INITIAL_RADIUS * Math.cos(this.phase), y: INITIAL_RADIUS * Math.sin(this.phase) })
    }

    /** solve once per burn. an unbound burn leaves no orbit to draw. */
    private solve() {
        const signature = `${ this.prograde }/${ this.radial }/${ this.phase }`
        if (signature === this.signature) return
        this.signature = signature
        try {
            this.orbit = solveOrbit(this.prograde, this.radial, this.phase)
            this.targetTime = closestApproach(this.orbit).time
        }
        catch {
            this.orbit = void 0
        }
    }

    // ── drawing ──────────────────────────────────────────────

    private draw() {
        const ctx = this.context
        const width = this.clientWidth, height = this.clientHeight
        if (!ctx || !width || !height) return
        this.solve()

        const ratio = Math.min(devicePixelRatio, 2)
        if (ctx.canvas.width !== Math.round(width * ratio) || ctx.canvas.height !== Math.round(height * ratio)) {
            ctx.canvas.width  = width * ratio
            ctx.canvas.height = height * ratio
        }
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, width, height)

        const palette = Object.fromEntries(TOKENS.map(key => [ key, themeColor(key) ]))
        const reach = Math.max(TARGET_RADIUS, Math.min(this.orbit?.apoapsis ?? TARGET_RADIUS, 65000))
        this.cx    = width * 0.5
        this.cy    = height * 0.49
        this.scale = Math.min(width * 0.41, height * 0.39) / reach
        ctx.font = `${ parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.6875 }px ${ themeColor('font-mono') }`

        this.frame(ctx, palette, reach)
        this.circle(INITIAL_RADIUS, palette.cyan, false)
        this.circle(TARGET_RADIUS, palette.muted, true)
        if (!this.orbit) {
            ctx.fillStyle = palette.red
            ctx.fillText('unbound trajectory', this.cx, 30)
            return
        }
        this.trajectory(ctx, palette, this.orbit)
        this.legend(ctx, palette)
    }

    /** range rings, the axes, and earth with its night side. */
    private frame(ctx: CanvasRenderingContext2D, palette: Palette, reach: number) {
        const width = this.clientWidth, height = this.clientHeight
        ctx.lineWidth = 1
        ctx.strokeStyle = palette.line
        for (let i = 1; i <= 4; i++) this.stroke(ctx, () => ctx.arc(this.cx, this.cy, i * reach * this.scale / 4, 0, Math.PI * 2))

        ctx.setLineDash([ 2, 7 ])
        this.stroke(ctx, () => {
            ctx.moveTo(this.cx, 38)
            ctx.lineTo(this.cx, height - 50)
            ctx.moveTo(35, this.cy)
            ctx.lineTo(width - 35, this.cy)
        })
        ctx.setLineDash([])

        const earth = EARTH_RADIUS * this.scale
        ctx.fillStyle = palette.panel
        this.fill(ctx, () => ctx.arc(this.cx, this.cy, earth, 0, Math.PI * 2))
        ctx.fillStyle = palette.muted
        this.fill(ctx, () => ctx.arc(this.cx, this.cy, earth, Math.PI / 2, Math.PI * 1.5))
        ctx.strokeStyle = palette.line
        ctx.stroke()
        ctx.fillStyle = palette.text
        ctx.textAlign = 'center'
        ctx.fillText('earth', this.cx, this.cy + earth + 19)
    }

    /** the planned ellipse, the node, the ship, the target now and at arrival, apsides and burn arrows. */
    private trajectory(ctx: CanvasRenderingContext2D, palette: Palette, o: Orbit) {
        const width = this.clientWidth
        ctx.lineWidth = 1.8
        ctx.strokeStyle = o.periapsis < EARTH_RADIUS ? palette.red : palette.amber
        this.stroke(ctx, () => {
            for (let i = 0; i <= SAMPLES; i++) {
                const p = this.point(positionAt(o, o.period * i / SAMPLES))
                if (i === 0) ctx.moveTo(p.x, p.y)
                else ctx.lineTo(p.x, p.y)
            }
        })

        const node = this.node()
        this.marker(node, palette.amber, 7, false)
        ctx.fillStyle = palette.amber
        ctx.textAlign = 'center'
        ctx.fillText(width < 450 ? 'node 01' : 'node 01 · drag to move', Math.max(80, Math.min(width - 100, node.x)), node.y - 21)
        this.marker(this.point(positionAt(o, this.time * o.period)), palette.amber, 5, true)

        const future = this.point(targetAt(this.time * o.period))
        this.diamond(this.point(targetAt(0)), palette.muted, 4, true)
        this.diamond(future, palette.mint, 7, false)
        ctx.fillStyle = palette.mint
        ctx.textAlign = future.x > this.cx ? 'right' : 'left'
        ctx.fillText(width < 450 ? 'relay / preview' : 'relay station / preview', Math.max(145, Math.min(width - 20, future.x)), future.y - 17)

        const ship = this.point(positionAt(o, this.targetTime)), target = this.point(targetAt(this.targetTime))
        ctx.setLineDash([ 3, 5 ])
        ctx.strokeStyle = palette.line
        this.stroke(ctx, () => { ctx.moveTo(ship.x, ship.y); ctx.lineTo(target.x, target.y) })
        ctx.setLineDash([])

        for (const [ label, distance, angle ] of [[ 'pe', o.periapsis, o.angle ], [ 'ap', o.apoapsis, o.angle + Math.PI ]] as const) {
            const p = this.point({ x: distance * Math.cos(angle), y: distance * Math.sin(angle) })
            this.marker(p, palette.cream, 2.5, true)
            ctx.textAlign = 'left'
            ctx.fillStyle = palette.text
            ctx.fillText(label, p.x + 10, p.y + 12)
        }
        const nx = Math.cos(this.phase), ny = -Math.sin(this.phase)
        this.arrow(node, { x: ny * 26, y: nx * -26 }, palette.amber)
        this.arrow(node, { x: nx * 23, y: ny * 23 }, palette.cyan)
    }

    private legend(ctx: CanvasRenderingContext2D, palette: Palette) {
        const width = this.clientWidth, height = this.clientHeight
        ctx.textAlign = 'left'
        const rows = [[ palette.cyan, 'current orbit' ], [ palette.amber, 'planned orbit' ], [ palette.muted, 'target orbit' ]]
        rows.forEach(([ color, text ], i) => {
            const x = 10 + i * width / 3
            ctx.fillStyle = color
            ctx.fillRect(x, height - 30, 12, 2)
            ctx.fillStyle = palette.text
            ctx.fillText(text, x + 18, height - 26)
        })
    }

    // ── primitives ───────────────────────────────────────────

    private stroke(ctx: CanvasRenderingContext2D, path: () => void) {
        ctx.beginPath()
        path()
        ctx.stroke()
    }

    private fill(ctx: CanvasRenderingContext2D, path: () => void) {
        ctx.beginPath()
        path()
        ctx.fill()
    }

    private circle(radius: number, color: string, dashed: boolean) {
        const ctx = this.context!
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.setLineDash(dashed ? [ 3, 6 ] : [])
        this.stroke(ctx, () => ctx.arc(this.cx, this.cy, radius * this.scale, 0, Math.PI * 2))
        ctx.setLineDash([])
    }

    private marker(p: Vec, color: string, r: number, filled: boolean) {
        const ctx = this.context!
        ctx.strokeStyle = ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        if (filled) ctx.fill()
        else ctx.stroke()
    }

    private diamond(p: Vec, color: string, r: number, filled: boolean) {
        const ctx = this.context!
        ctx.strokeStyle = ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(p.x, p.y - r)
        ctx.lineTo(p.x + r, p.y)
        ctx.lineTo(p.x, p.y + r)
        ctx.lineTo(p.x - r, p.y)
        ctx.closePath()
        if (filled) ctx.fill()
        else ctx.stroke()
    }

    private arrow(p: Vec, v: Vec, color: string) {
        const ctx = this.context!
        ctx.strokeStyle = color
        this.stroke(ctx, () => { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + v.x, p.y + v.y) })
    }

    // ── node drag ────────────────────────────────────────────

    private down = (e: PointerEvent) => {
        const rect = this.getBoundingClientRect(), node = this.node()
        if (Math.hypot(e.clientX - rect.left - node.x, e.clientY - rect.top - node.y) > 28) return
        this.dragging = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    private move = (e: PointerEvent) => {
        if (!this.dragging) return
        const rect = this.getBoundingClientRect()
        const phase = Math.atan2(-(e.clientY - rect.top - this.cy), e.clientX - rect.left - this.cx)
        this.dispatchEvent(new CustomEvent('phase-change', { detail: phase, bubbles: true, composed: true }))
    }

    private up = () => { this.dragging = false }
}
customElements.define('orbit-view', OrbitView)
