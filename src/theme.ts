import type {
    ReactiveController,
    ReactiveControllerHost,
} from 'lit'

export type Theme = 'light' | 'dark' | 'system'
const THEME_KEY = 'theseus.theme'
export function themePreference(value: unknown): Theme {
    return value === 'light'
        || value === 'dark'
        ? value
        : 'system'
}

/** Persistence is optional: blocked storage must not prevent the app from starting. */
export class ThemeController implements ReactiveController {
    preference: Theme = 'system'
    private readonly host: ReactiveControllerHost
    private media?: MediaQueryList

    constructor(host: ReactiveControllerHost) { this.host = host; host.addController(this) }
    hostConnected() {
        try { this.preference = themePreference(localStorage.getItem(THEME_KEY)) }
        catch { this.preference = 'system' }
        this.media = matchMedia('(prefers-color-scheme: dark)')
        this.media.addEventListener('change', this.apply)
        addEventListener('storage', this.storage)
        this.apply()
    }

    hostDisconnected() {
        this.media?.removeEventListener('change', this.apply)
        removeEventListener('storage', this.storage)
    }

    set(value: Theme) {
        this.preference = themePreference(value)
        try {
            localStorage.setItem(THEME_KEY, this.preference)
        }
        catch {
            /* The selected theme still works for this session. */
        }
        this.apply()
    }

    private storage = (e: StorageEvent) => {
        if (e.key === THEME_KEY || e.key == null) {
            this.preference = themePreference(e.newValue)
            this.apply()
        }
    }

    private apply = () => {
        document.documentElement.dataset.theme = this.preference === 'system'
            ? this.media?.matches
                ? 'dark'
                : 'light'
            : this.preference
        document.dispatchEvent(new Event('theme-change'))
        this.host.requestUpdate()
    }
}

/** CSS tokens also drive canvas annotations; geometry retains its material palette. */
export function themeColor(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${ name }`).trim()
}
