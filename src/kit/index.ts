import type { KitAuth } from './auth.ts'
import type { KitCard } from './card.ts'
import type { KitComms } from './comms.ts'
import type { KitHold } from './hold.ts'
import type { KitSpot } from './spot.ts'
import type { KitHud } from './hud.ts'
import type { KitLog } from './log.ts'
import type { KitMark } from './mark.ts'
import type { KitToast } from './toast.ts'
import type { KitTray } from './tray.ts'
import type { KitView } from './view.ts'
import type { Palette } from '../content/palettes.ts'
import './auth.ts'
import './card.ts'
import './comms.ts'
import './hold.ts'
import './hud.ts'
import './log.ts'
import './mark.ts'
import './select.ts'
import './spot.ts'
import './toast.ts'
import './tray.ts'
import './view.ts'
import './kit.css'
import './toy.css'

export { previewRows, shipRows, visitorRows, voyageRows } from './ship.ts'

/** the kit over one stage: the top line, one card, the toasts, the way in, a tray of goods, the hold, comms, the feed and its console, the keys of a plane, labels for places. */
export interface Kit { hud: KitHud, card: KitCard, toast: KitToast, auth: KitAuth, tray: KitTray, hold: KitHold, comms: KitComms, log: KitLog, view: KitView, spot: (place: string) => KitSpot, mark: (name: string, value: string) => KitMark }

export function mount(host: HTMLElement): Kit {
    const kit = {
        hud  : document.createElement('kit-hud') as KitHud,
        card : document.createElement('kit-card') as KitCard,
        toast: document.createElement('kit-toast') as KitToast,
        auth : Object.assign(document.createElement('kit-auth') as KitAuth, { hidden: true }),
        tray : Object.assign(document.createElement('kit-tray') as KitTray, { hidden: true }),
        hold : Object.assign(document.createElement('kit-hold') as KitHold, { hidden: true }),
        comms: Object.assign(document.createElement('kit-comms') as KitComms, { hidden: true }),
        log  : document.createElement('kit-log') as KitLog,
        view : Object.assign(document.createElement('kit-view') as KitView, { hidden: true }),
        spot : (place: string) => host.appendChild(Object.assign(document.createElement('kit-spot') as KitSpot, { place })),
        mark : (name: string, value: string) => host.appendChild(Object.assign(document.createElement('kit-mark') as KitMark, { name, value })),
    }
    host.append(kit.hud, kit.tray, kit.hold, kit.comms, kit.view, kit.card, kit.toast, kit.log, kit.auth)
    return kit
}

/** the toy look on the kit: the host's `data-toy` names the palette, css variables carry it. */
export function theme(host: HTMLElement, name: string, p: Palette) {
    host.dataset.toy = name
    for (const [ role, color ] of Object.entries(p)) host.style.setProperty(`--toy-${ role }`, color)
}
