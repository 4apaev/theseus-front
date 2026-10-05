import type { KitAuth } from './auth.ts'
import type { KitCard } from './card.ts'
import type { KitSpot } from './spot.ts'
import type { KitHud } from './hud.ts'
import type { KitToast } from './toast.ts'
import type { KitTray } from './tray.ts'
import './auth.ts'
import './card.ts'
import './hud.ts'
import './spot.ts'
import './toast.ts'
import './tray.ts'
import './kit.css'

export { shipRows, visitorRows } from './ship.ts'

/** the kit over one stage: the top line, one card, the toasts, the way in, a tray of goods, labels for places. */
export interface Kit { hud: KitHud, card: KitCard, toast: KitToast, auth: KitAuth, tray: KitTray, spot: (place: string) => KitSpot }

export function mount(host: HTMLElement): Kit {
    const kit = {
        hud  : document.createElement('kit-hud') as KitHud,
        card : document.createElement('kit-card') as KitCard,
        toast: document.createElement('kit-toast') as KitToast,
        auth : Object.assign(document.createElement('kit-auth') as KitAuth, { hidden: true }),
        tray : Object.assign(document.createElement('kit-tray') as KitTray, { hidden: true }),
        spot : (place: string) => host.appendChild(Object.assign(document.createElement('kit-spot') as KitSpot, { place })),
    }
    host.append(kit.hud, kit.tray, kit.card, kit.toast, kit.auth)
    return kit
}
