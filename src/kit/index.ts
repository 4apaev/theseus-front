import type { KitCard } from './card.ts'
import type { KitHud } from './hud.ts'
import type { KitToast } from './toast.ts'
import './card.ts'
import './hud.ts'
import './toast.ts'
import './kit.css'

export { shipRows, visitorRows } from './ship.ts'

/** the kit over one stage: the top line, one card, the toasts. */
export interface Kit { hud: KitHud, card: KitCard, toast: KitToast }

export function mount(host: HTMLElement): Kit {
    const kit = {
        hud  : document.createElement('kit-hud') as KitHud,
        card : document.createElement('kit-card') as KitCard,
        toast: document.createElement('kit-toast') as KitToast,
    }
    host.append(kit.hud, kit.card, kit.toast)
    return kit
}
