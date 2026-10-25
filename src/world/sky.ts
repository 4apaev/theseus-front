import * as T from 'three'

/**
 * the sky, all around: the ether, the stars, the sun, one huge planet.
 * it renders with the camera's rotation and none of its position, so
 * the sky does not move as the camera orbits the station. a planet in
 * the back of the camera is out of view. colours stay raw, as painted.
 */

/** where the sun is. the key light of the scene comes from here. */
export const SUN = new T.Vector3(-4, 7, 5).normalize()

const FAR = 3000

// the milky way: the normal of its plane. the ether and most stars crowd round it
const BAND = new T.Vector3(.3, .9, -.2).normalize()
const GLSL_BAND = `const vec3 BAND = vec3(${ BAND.toArray().join(', ') });`

const NOISE = /* glsl */`
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p){
    vec3 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float fbm(vec3 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 1.7; a *= .5; } return v; }`

const ETHER = /* glsl */`${ NOISE }
${ GLSL_BAND }
uniform float uTime; varying vec3 vDir;
void main(){
    vec3 d = normalize(vDir);
    float band = exp(-pow(dot(d, BAND) * 3.2, 2.));
    vec3 q = d * 2.2 + vec3(uTime * .004, 0., -uTime * .003);
    vec3 col = mix(vec3(.012, .018, .035), vec3(.024, .036, .07), d.y * .35 + .5);
    col += vec3(.18, .5, .53) * pow(fbm(q + 1.4 * fbm(q * 1.2)), 3.2) * band * .22;
    col += vec3(.42, .31, .63) * pow(fbm(q * 2.4 - 4.), 3.6) * band * .16;
    gl_FragColor = vec4(col + vec3(.95, .9, .85) * band * .02, 1.);
}`

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

const PLANET_VS = /* glsl */`
varying vec3 vNormal; varying vec3 vWorld; varying vec3 vObj;
void main(){
    vObj = normalize(position);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vWorld = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
}`

const PLANET_FS = /* glsl */`
uniform sampler2D uMap; uniform float uRot; uniform vec3 uSun; varying vec3 vNormal; varying vec3 vWorld; varying vec3 vObj;
const vec3 RIM = vec3(.56, .77, 1.), NIGHT = vec3(.06, .1, .2);
void main(){
    vec2 uv = vec2(fract((atan(vObj.x, vObj.z) + uRot) / 6.2831853 + .5), asin(clamp(vObj.y, -1., 1.)) / 3.14159265 + .5);
    vec3 base = texture2D(uMap, uv).rgb, n = normalize(vNormal);
    float lit = smoothstep(-.2, .45, dot(n, uSun));
    lit = floor(lit * 3. + .5) / 3. * .35 + lit * .65;
    float fres = pow(1. - abs(dot(n, normalize(-vWorld))), 2.6);
    gl_FragColor = vec4(mix(NIGHT * (.25 + base * .25), base, lit) + RIM * fres * (.55 * lit + .12), 1.);
}`

export class Sky {
    readonly scene  = new T.Scene
    readonly camera = new T.PerspectiveCamera(30, 16 / 9, 1, FAR * 2)
    private readonly time   = { value: 0 }
    private readonly spin   = { value: 0 }
    private readonly art    = new T.TextureLoader
    private readonly planet = new T.Mesh(new T.SphereGeometry(1, 96, 48), new T.ShaderMaterial({
        uniforms      : { uMap: { value: null }, uRot: this.spin, uSun: { value: SUN }},
        vertexShader  : PLANET_VS,
        fragmentShader: PLANET_FS,
        depthTest     : false,
    }))

    private readonly sun = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthTest: false }))
    private readonly ether: T.Mesh

    constructor() {
        const ether = this.ether = new T.Mesh(new T.SphereGeometry(FAR, 32, 16), new T.ShaderMaterial({
            uniforms      : { uTime: this.time },
            vertexShader  : 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
            fragmentShader: ETHER,
            side          : T.BackSide,
            depthTest     : false,
        }))
        this.sun.position.copy(SUN).multiplyScalar(FAR * .8)
        this.sun.scale.setScalar(FAR * .2)
        ether.renderOrder = 0
        this.sun.renderOrder = 2
        this.planet.renderOrder = 3
        this.scene.add(ether, stars(this.time), this.sun, this.planet)
        this.show()
    }

    /**
     * `planet` is a map in `art/planets/`, `sun` a class in `art/suns/`.
     * the planet sits towards `dir`, `size` degrees across its radius.
     */
    show(planet?: string, sun?: string, dir = new T.Vector3(-.55, -.75, -.4), size = 30) {
        this.planet.visible = !!planet
        this.sun.visible = !!sun
        if (planet) {
            const m = this.planet.material as T.ShaderMaterial
            m.uniforms.uMap.value?.dispose()
            m.uniforms.uMap.value = this.texture(`planets/${ planet }`)
            // no mipmaps: they draw a seam where the map wraps
            m.uniforms.uMap.value.generateMipmaps = false
            m.uniforms.uMap.value.minFilter = T.LinearFilter
            this.planet.position.copy(dir).normalize().multiplyScalar(FAR * .6)
            this.planet.scale.setScalar(FAR * .6 * Math.sin(size * Math.PI / 180))
            // the poles turn to the horizon, the equator to the station
            this.planet.rotation.set(-1.25, 0, .35)
        }
        if (sun) {
            this.sun.material.map?.dispose()
            this.sun.material.map = this.texture(`suns/${ sun }`)
            this.sun.material.needsUpdate = true
        }
    }

    /** no ether: the stage's clear colour shows behind the stars. */
    plain() {
        this.ether.visible = false
    }

    /** follow the view's rotation and lens, not its position. */
    tick(t: number, view: T.PerspectiveCamera) {
        this.time.value = t
        this.spin.value = t * Math.PI * 2 / 1200
        this.camera.quaternion.copy(view.quaternion)
        if (this.camera.aspect !== view.aspect || this.camera.fov !== view.fov) {
            this.camera.aspect = view.aspect
            this.camera.fov = view.fov
            this.camera.updateProjectionMatrix()
        }
    }

    private texture(name: string) {
        const t = this.art.load(`${ import.meta.env.BASE_URL }art/${ name }.webp`)
        t.wrapS = T.RepeatWrapping
        return t
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
