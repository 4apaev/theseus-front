/** the player's settings, in this browser only: a voice for arrivals (empty: none), the chime, calm motion. */
export interface Settings { voice: string, sound: boolean, calm: boolean }

const KEY = 'theseus.settings'

export const settings: Settings = { voice: 'kate', sound: true, calm: false, ...read() }

export function save(patch: Partial<Settings>) {
    Object.assign(settings, patch)
    try { localStorage.setItem(KEY, JSON.stringify(settings)) }
    catch { /* blocked storage: the settings last this session */ }
}

function read(): Partial<Settings> {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    catch { return {} }
}
