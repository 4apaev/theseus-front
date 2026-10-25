/**
 * skins: a skin paints the roles of a toy model, `toy-red` … `toy-glow`.
 * a role it leaves out keeps the theme's colour. its colours hold in
 * every theme: police and military are skins too. the player picks one
 * for their ship. the colours are sam's, from `assets/concepts/toy/skins/skins.json`.
 */
export type Role = 'red' | 'green' | 'butter' | 'milk' | 'dark' | 'glow'
export type Skin = Partial<Record<Role, string>>

export const SKINS: Record<string, Skin> = {
    theme   : {},
    police  : { red: '#3d6fd8', green: '#f4f6fb', butter: '#ffd23f', milk: '#ffffff', dark: '#1c2a4a', glow: '#fff6a8' },
    military: { red: '#6b7a4b', green: '#8a8f86', butter: '#c9b27c', milk: '#d8d4c4', dark: '#2f3428', glow: '#d8e4a6' },
    candy   : { red: '#ff7eb6', green: '#7ee0ff', butter: '#fff27e', milk: '#ffffff', dark: '#503650', glow: '#c9ffe1' },
    rust    : { red: '#c4622d', green: '#5b6b73', butter: '#e3a857', milk: '#efe3cf', dark: '#352f32', glow: '#ffdd99' },
    navy    : { red: '#1f3b73', green: '#d7dde8', butter: '#e8b04b', milk: '#f5f5f0', dark: '#18243e', glow: '#c8e9ff' },
    mint    : { red: '#3bb594', green: '#e8fff6', butter: '#ffcf70', milk: '#ffffff', dark: '#214740', glow: '#c9ffe1' },
    sunny   : { red: '#ff9f43', green: '#ffe08a', butter: '#ff6b6b', milk: '#fff8e7', dark: '#593f37', glow: '#fff4b0' },
    grape   : { red: '#8e6cd8', green: '#c9b6f2', butter: '#ffd166', milk: '#f6f0ff', dark: '#39304f', glow: '#f2ddb4' },
    ice     : { red: '#5fb3e8', green: '#e6f6ff', butter: '#b8f0e0', milk: '#ffffff', dark: '#244760', glow: '#c7fff5' },
    coral   : { red: '#ff7f6e', green: '#5cc8b8', butter: '#ffd36e', milk: '#fff4ea', dark: '#37494b', glow: '#f4f6ba' },
}

let mine = 'theme'

/** the player's skin, by name. */
export const useSkin = (name: string) => { mine = name in SKINS ? name : 'theme' }
export const mySkin = () => SKINS[ mine ]
export const mySkinName = () => mine

/** the skin a hull wears when no one picked one: the police and the military wear their own. */
export const hullSkin = (hull: string) => SKINS[ /police/.test(hull) ? 'police' : /military/.test(hull) ? 'military' : 'theme' ]
