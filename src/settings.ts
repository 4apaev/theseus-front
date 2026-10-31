/** the player's settings, in this browser only: a voice for arrivals (empty: none), the sounds and their volume (0 to 1), calm motion, the ship's skin, the colour theme. */
export interface Settings { voice: string, sound: boolean, volume: number, calm: boolean, skin: string, theme: string }

const KEY = 'theseus.settings'

export const settings: Settings = { voice: 'kate', sound: true, volume: 1, calm: false, skin: 'theme', theme: 'meadow', ...read() }

export function save(patch: Partial<Settings>) {
    Object.assign(settings, patch)
    try { localStorage.setItem(KEY, JSON.stringify(settings)) }
    catch { /* blocked storage: the settings last this session */ }
}

function read(): Partial<Settings> {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    catch { return {} }
}
