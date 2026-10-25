import * as T from 'three'

/**
 * the sky, all around: the stars over the stage's backdrop colour. it
 * renders with the camera's rotation and none of its position, so the
 * sky does not move as the camera orbits the station. colours stay raw.
 */

/** where the sun is. the key light of the scene comes from here. */
export const SUN = new T.Vector3(-4, 7, 5).normalize()

const FAR = 3000

// the milky way: the normal of its plane. most stars crowd round it
const BAND = new T.Vector3(.3, .9, -.2).normalize()

const STAR_VS = /* glsl */`
attribute float aSize; attribute float aPhase; attribute vec3 aTint; uniform float uTime; uniform float uDpr; varying vec3 vLit;
void main(){
    vLit = aTint * (.8 + .2 * sin(uTime * (.7 + aPhase * 2.6) + aPhase * 60.)) * (.25 + aSize / 3.);
    gl_PointSize = aSize * uDpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`

const STAR_FS = /* glsl */`
varying vec3 vLit;
void main(){ float r = length(gl_PointCoord - .5); gl_FragColor = vec4(vLit * smoothstep(.5, 0., r), 1.); }`

export class Sky {
    readonly scene  = new T.Scene
    readonly camera = new T.PerspectiveCamera(30, 16 / 9, 1, FAR * 2)
    private readonly time   = { value: 0 }

    constructor() {
        this.scene.add(stars(this.time))
    }

    /** follow the view's rotation and lens, not its position. */
    tick(t: number, view: T.PerspectiveCamera) {
        this.time.value = t
        this.camera.quaternion.copy(view.quaternion)
        if (this.camera.aspect !== view.aspect || this.camera.fov !== view.fov) {
            this.camera.aspect = view.aspect
            this.camera.fov = view.fov
            this.camera.updateProjectionMatrix()
        }
    }
}

// the star tints: blue white, white, warm, orange
const TINTS = [[ .8, .88, 1 ], [ 1, .97, .92 ], [ 1, .86, .66 ], [ 1, .7, .45 ]]

// 20000 stars on the far sphere, each on its own blink. 4 in 10 crowd the milky way
function stars(time: { value: number }) {
    const n = 20000
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const phase = new Float32Array(n)
    const tint = new Float32Array(n * 3)
    const v = new T.Vector3
    for (let i = 0; i < n; i++) {
        v.randomDirection()
        if (i % 5 < 2) v.addScaledVector(BAND, -v.dot(BAND) * .85).normalize()
        v.multiplyScalar(FAR * .9).toArray(pos, i * 3)
        size[ i ] = .7 + Math.random() ** 10 * 3.6
        phase[ i ] = Math.random()
        tint.set(TINTS[ Math.floor(Math.random() ** 2 * 4) ], i * 3)
    }
    const g = new T.BufferGeometry
    g.setAttribute('position', new T.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new T.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new T.BufferAttribute(phase, 1))
    g.setAttribute('aTint', new T.BufferAttribute(tint, 3))
    const p = new T.Points(g, new T.ShaderMaterial({ uniforms: { uTime: time, uDpr: { value: Math.min(devicePixelRatio, 1.5) }}, vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, blending: T.AdditiveBlending, depthTest: false }))
    p.renderOrder = 1
    return p
}
