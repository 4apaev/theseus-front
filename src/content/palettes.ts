/**
 * the toy look's palettes, by role. meadow (soft red on green) is the
 * user's first pick; toybox is sampled from sam's toy frames. the same
 * colours as `assets/concepts/toy/screens/make.py`.
 */
export interface Palette {
    space : string
    deep  : string
    panel : string
    panel2: string
    line  : string
    red   : string
    amber : string
    green : string
    teal  : string
    pink  : string
    cream : string
    glow  : string
    mist  : string
    ink   : string
}

export const PALETTES: Record<string, Palette> = {
    meadow: { space: '#1d2e2a', deep: '#13201d', panel: '#2a403a', panel2: '#34504a', line: '#4d6e65', red: '#ec8f84', amber: '#f2dc9a', green: '#a9dfb2', teal: '#7fbf98', pink: '#f5b3a8', cream: '#fbf6ec', glow: '#d6f5c9', mist: '#b9cfc4', ink: '#13201d' },
    toybox: { space: '#1a0e5c', deep: '#120845', panel: '#2a1d72', panel2: '#35278a', line: '#4d3fa6', red: '#e8664e', amber: '#efb23a', green: '#5fc4a2', teal: '#2da5a0', pink: '#ef7fa8', cream: '#f3e8d0', glow: '#8ff0e6', mist: '#b6a8e6', ink: '#120845' },
    lagoon: { space: '#173238', deep: '#0f2226', panel: '#22454c', panel2: '#2b555d', line: '#437880', red: '#f4a3bd', amber: '#ffd9b3', green: '#9fe6df', teal: '#6cc6c9', pink: '#e98fb0', cream: '#f7fbfa', glow: '#c9f4f0', mist: '#b3d3d4', ink: '#0f2226' },
    postcard: { space: '#1e2638', deep: '#141a28', panel: '#2b354d', panel2: '#35415d', line: '#4f5d80', red: '#e8857f', amber: '#f3dfa4', green: '#9cc6ea', teal: '#6f9fd1', pink: '#f1aaa6', cream: '#fbf5ec', glow: '#cfe3f7', mist: '#b6c0d8', ink: '#141a28' },
}

export const palette = (name?: string | null) => PALETTES[ name ?? '' ] ?? PALETTES.meadow
