/**
 * a painted place, from sam's `kit.json`: the plate, and the parts
 * placed on it in plate pixels. a plate may hold its furniture and
 * have no parts. only the outpost has kits yet, so every station shows
 * the outpost's.
 */
export interface Part      { name: string, file: string, w: number, h: number, foot: [ number, number ]}
export interface Placement { name: string, x: number, y: number, width: number }
export interface PlaceKit  { base: string, plate: string, parts: Part[], placements: Placement[] }

/** the plate's width in pixels: every placement is in its frame. */
export const PLATE = 2048

const art = (path: string) => `${ import.meta.env.BASE_URL }art/${ path }`

export async function placeKit(place: string, kit = 'outpost'): Promise<PlaceKit> {
    const base = `places/${ place }/${ kit }`
    return { parts: [], placements: [], ...await (await fetch(art(`${ base }/kit.json`))).json(), base }
}

let icons = 'icons'

/** the toy look has its own icons, sam's set in `art/toy/icons/`. */
export const toyIcons = () => { icons = 'toy/icons' }

/** a good's icon. module packages have their own folder. */
export function iconOf(gid: string, kind?: string) {
    return art(`${ icons }/${ kind === 'module' ? 'modules' : 'goods' }/${ gid.replace('.', '-') }.webp`)
}
