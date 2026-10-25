import * as T from 'three'
import { SUN } from './sky.ts'

/**
 * the painted look of a 3D model, lit like the sprites: a 4-step toon
 * ramp over a grime map (a kit model keeps its own colour map), an inverted hull for the ink outline, a glow
 * on each lamp. a lamp named `tip`, `nav`, `beacon`, `lightbar` or
 * `eye` blinks. an object with `spin` in its extras turns.
 * colours stay raw, as painted: the stage does no colour management.
 */

/** a painted hex, unconverted. */
export const raw = (hex: number) => (new T.Color).setHex(hex, T.LinearSRGBColorSpace)

const RAMP = (() => {
    const t = new T.DataTexture(new Uint8Array([ 52, 52, 52, 255, 112, 112, 112, 255, 172, 172, 172, 255, 222, 222, 222, 255 ]), 4, 1)
    t.minFilter = t.magFilter = T.NearestFilter
    t.needsUpdate = true
    return t
})()

const OUTLINE = new T.ShaderMaterial({
    side          : T.BackSide,
    uniforms      : { uT: { value: .03 }},
    vertexShader  : 'attribute vec3 aOutline; uniform float uT; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aOutline * uT, 1.); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(.08, .066, .05, 1.); }',
})

const toons = new Map<number | string, T.Material>
const lamps = new Map<number, T.Material>
const toon = (c: number) => toons.get(c) ?? toons.set(c, new T.MeshToonMaterial({ color: raw(c), gradientMap: RAMP, map: grime() })).get(c) as T.Material

// a kit model keeps its colour map, read raw like our hex
function mapped(src: T.MeshStandardMaterial) {
    const map = src.map as T.Texture, key = `${ map.uuid } ${ src.color.getHex() }`
    map.colorSpace = T.NoColorSpace
    return toons.get(key) ?? toons.set(key, new T.MeshToonMaterial({ color: raw(src.color.getHex()), gradientMap: RAMP, map })).get(key) as T.Material
}
const lamp = (c: number) => lamps.get(c) ?? lamps.set(c, new T.MeshBasicMaterial({ color: raw(c) })).get(c) as T.Material

export function paint(root: T.Object3D) {
    const meshes: T.Mesh[] = []
    root.traverse(o => { if (o instanceof T.Mesh) meshes.push(o) })

    for (const m of meshes) {
        const src = m.material as T.MeshStandardMaterial
        const lit = src.emissive.r + src.emissive.g + src.emissive.b > .01
        // getHex() gives the painted srgb hex. a convert before it brightens it twice
        const hex = (lit ? src.emissive : src.color).getHex()
        if (lit) {
            m.material = lamp(hex)
            if (/tip|nav|beacon|lightbar|eye/.test(m.name)) m.add(glow(hex, /beacon|lightbar/.test(m.name) ? .9 : .5, !/eye/.test(m.name)))
            continue
        }
        boxUV(m.geometry)
        outlineNormals(m.geometry)
        m.material = src.map ? mapped(src) : toon(hex)
        m.add(new T.Mesh(m.geometry, OUTLINE))
    }
    return root
}

/** one pass over a model: lamps blink, parts spin. */
export function liven(root: T.Object3D, t: number, dt: number) {
    root.traverse(o => {
        const u = o.userData
        if (u.blink && o instanceof T.Sprite) o.material.opacity = Math.sin((t / u.blink + u.phase) * Math.PI * 2) > .2 ? .95 : .05
        if (u.spin) o.rotation.y += u.spin * dt
    })
}

/** the warm key from the sun, a cool rim, a sky and ground fill. */
export function lights(scene: T.Scene) {
    const key = new T.DirectionalLight(raw(0xffe2b8), 2.3)
    const rim = new T.DirectionalLight(raw(0x7fb0ff), .9)
    key.position.copy(SUN).multiplyScalar(10)
    rim.position.set(5, 2, -6)
    scene.add(new T.HemisphereLight(raw(0xa8bde0), raw(0x4a3826), 1.6), key, rim)
}

export function glow(color: number, size: number, blink = false) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: soft(), color: raw(color), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: .6 }))
    s.scale.set(size, size, 1)
    if (blink) s.userData = { blink: 1.3, phase: Math.random() }
    return s
}

// ── textures, made once on first use ─────────────────────────

let grimeMap: T.Texture | undefined,
    softMap: T.Texture | undefined

function grime() {
    return grimeMap ??= canvas(256, (c, n) => {
        const r = rng(31)
        c.fillStyle = '#fff'
        c.fillRect(0, 0, n, n)
        for (let i = 0; i < 900; i++) {
            c.fillStyle = `rgba(90,70,50,${ r() * .07 })`
            c.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 3)
        }
        c.strokeStyle = 'rgba(60,45,30,.22)'
        for (const v of [ 64, 128, 192 ]) c.strokeRect(v, -1, 0, n + 2)
    }, true)
}

function soft() {
    return softMap ??= canvas(64, (c, n) => {
        const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(.25, 'rgba(255,255,255,.55)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        c.fillStyle = g
        c.fillRect(0, 0, n, n)
    })
}

function canvas(n: number, draw: (c: CanvasRenderingContext2D, n: number) => void, repeat = false) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = n
    draw(cv.getContext('2d') as CanvasRenderingContext2D, n)
    const t = new T.CanvasTexture(cv)
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping
    return t
}

// ── geometry ─────────────────────────────────────────────────

// box-projected uv, so the grime lands on every face
function boxUV(g: T.BufferGeometry) {
    if (g.attributes.uv) return
    const { position: p, normal: n } = g.attributes
    const uv = new Float32Array(p.count * 2)
    for (let i = 0; i < p.count; i++) {
        const a = [ Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i)) ]
        const axis = a.indexOf(Math.max(...a))
        const [ u, v ] = axis === 0 ? [ p.getZ(i), p.getY(i) ] : axis === 1 ? [ p.getX(i), p.getZ(i) ] : [ p.getX(i), p.getY(i) ]
        uv.set([ u * .35, v * .35 ], i * 2)
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2))
}

// one normal per corner, so the outline closes over flat bevels
function outlineNormals(g: T.BufferGeometry) {
    if (g.attributes.aOutline) return
    const { position: p, normal: n } = g.attributes
    const sums = new Map<string, number[]>
    const keys: string[] = []
    for (let i = 0; i < p.count; i++) {
        const k = `${ p.getX(i).toFixed(3) },${ p.getY(i).toFixed(3) },${ p.getZ(i).toFixed(3) }`
        const s = sums.get(k) ?? sums.set(k, [ 0, 0, 0 ]).get(k) as number[]
        s[ 0 ] += n.getX(i)
        s[ 1 ] += n.getY(i)
        s[ 2 ] += n.getZ(i)
        keys.push(k)
    }
    const out = new Float32Array(p.count * 3)
    keys.forEach((k, i) => {
        const s = sums.get(k) as number[]
        const l = Math.hypot(...s) || 1
        out.set(s.map(v => v / l), i * 3)
    })
    g.setAttribute('aOutline', new T.BufferAttribute(out, 3))
}

export function rng(seed: number) {
    return () => {
        seed = seed + 0x6D2B79F5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}
