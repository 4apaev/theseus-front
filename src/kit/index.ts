import type { KitAuth } from './auth.ts'
import type { KitCard } from './card.ts'
import type { KitSpot } from './spot.ts'
import type { KitHud } from './hud.ts'
import type { KitToast } from './toast.ts'
import './auth.ts'
import './card.ts'
import './hud.ts'
import './spot.ts'
import './toast.ts'
import './kit.css'

export { shipRows, visitorRows } from './ship.ts'

/** the kit over one stage: the top line, one card, the toasts, and labels for places. */
export interface Kit { hud: KitHud, card: KitCard, toast: KitToast, auth: KitAuth, spot: (place: string) => KitSpot }

export function mount(host: HTMLElement): Kit {
    const kit = {
        hud  : document.createElement('kit-hud') as KitHud,
        card : document.createElement('kit-card') as KitCard,
        toast: document.createElement('kit-toast') as KitToast,
        auth : Object.assign(document.createElement('kit-auth') as KitAuth, { hidden: true }),
        spot : (place: string) => host.appendChild(Object.assign(document.createElement('kit-spot') as KitSpot, { place })),
    }
    host.append(kit.hud, kit.card, kit.toast, kit.auth)
    return kit
}
