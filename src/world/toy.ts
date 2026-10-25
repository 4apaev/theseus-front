import * as T from 'three'
import type { Palette } from '../content/palettes.ts'
import type { Role, Skin } from '../content/skins.ts'
import { raw } from './paint.ts'

/**
 * the toy look of a 3D thing: soft toon tones, no ink, no grime. sam
 * names each material by its role, `toy-red` … `toy-glow`; the palette
 * paints the role, and a `toy-glow` lamp shines. other materials keep
 * their own colour.
 */

const RAMP = (() => {
    const t = new T.DataTexture(new Uint8Array([ 150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255 ]), 3, 1)
    t.minFilter = t.magFilter = T.NearestFilter
    t.needsUpdate = true
    return t
})()

const ROLES: Record<string, keyof Palette> = { red: 'red', green: 'green', butter: 'amber', milk: 'cream', dark: 'deep', glow: 'glow' }

const made = new Map<string, T.Material>

export const hex = (c: string) => parseInt(c.slice(1), 16)

/** a soft toon material of a palette colour, made once. */
export function toon(c: string) {
    return made.get(c) ?? made.set(c, new T.MeshToonMaterial({ color: raw(hex(c)), gradientMap: RAMP })).get(c) as T.Material
}

/** a flat colour, no light on it: the ink of the diagrams. */
export function flat(c: string, opacity = 1) {
    const key = `${ c } ${ opacity }`
    return made.get(key) ?? made.set(key, new T.MeshBasicMaterial({ color: raw(hex(c)), transparent: opacity < 1, opacity, depthWrite: opacity === 1 })).get(key) as T.Material
}

let page: Palette | undefined

/** the page's palette: the toy look paints in it. */
export function usePalette(p: Palette) {
    page = p
}

/** a role's colour in the page's palette. */
export const tint = (role: keyof Palette) => page?.[ role ] ?? '#ffffff'

/** the look for the loader: a model in the page's palette. a mesh keeps its role, for a skin. */
export function toy(root: T.Object3D) {
    const p = page
    root.traverse(o => {
        if (!(o instanceof T.Mesh) || !p) return
        const src = o.material as T.MeshStandardMaterial, name = src.name.replace(/^toy-|\.\d+$/g, ''), role = ROLES[ name ]
        if (role) o.userData.role = name
        o.material = role === 'glow' ? flat(p.glow) : toon(role ? p[ role ] : `#${ src.color.getHexString() }`)
    })
    return root
}

/** a skin on a toy model: each role in the skin's colour, or the page's. */
export function wear(root: T.Object3D, skin: Skin) {
    const p = page
    root.traverse(o => {
        const role = o.userData.role as Role | undefined
        if (!(o instanceof T.Mesh) || !role || !p) return
        const c = skin[ role ] ?? p[ ROLES[ role ] ]
        o.material = role === 'glow' ? flat(c) : toon(c)
    })
}

const loader = new T.TextureLoader
const pictures = new Map<string, T.Texture>

/** a picture for a sprite, loaded once and kept: the screens redraw often. */
export function picture(url: string) {
    return pictures.get(url) ?? pictures.set(url, loader.load(url)).get(url) as T.Texture
}
