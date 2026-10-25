import type * as T from 'three'
import { KitMark } from '../kit/mark.ts'
import { KitSpot } from '../kit/spot.ts'
import type { Stage } from '../world/stage.ts'

// what a thing in the scene carries to name its label; the first found wins
const KEYS = [ 'mark', 'place', 'stid', 'slot', 'gid', 'value' ]

/**
 * labels on hover: the pointer over a thing in the scene lights its
 * label, as the pointer over the label does. a thing with no key, a
 * hall of a merged station, lights the nearest label above the pointer.
 * one look a frame at most.
 */
export function hover(stage: Stage, labels: HTMLElement) {
    let due = 0
    stage.host.addEventListener('pointermove', e => {
        if (due || !(e.target instanceof HTMLCanvasElement)) return
        due = requestAnimationFrame(() => {
            due = 0
            const hit = stage.pick(e.offsetX, e.offsetY, [ stage.scene ])
            light(labels, hit && (key(hit) ?? near(labels, e.offsetX, e.offsetY)))
        })
    })
}

// the label's key of a thing, or of the nearest thing it is part of
function key(o?: T.Object3D | null) {
    for (; o; o = o.parent) for (const k of KEYS) if (o.userData[ k ]) return String(o.userData[ k ])
}

// the label whose stem ends nearest the pointer, within reach
function near(labels: HTMLElement, x: number, y: number) {
    let best: string | undefined, reach = 110
    for (const el of labels.querySelectorAll<HTMLElement>('kit-mark, kit-spot')) {
        const [ lx, ly ] = el.style.translate.split(' ').map(parseFloat), d = Math.hypot(lx - x, ly - y)
        if (d < reach) [ best, reach ] = [ of(el), d ]
    }
    return best
}

function light(labels: HTMLElement, value?: string | null) {
    for (const el of labels.querySelectorAll('kit-mark, kit-spot')) el.toggleAttribute('lit', !!value && of(el) === value)
}

function of(el: Element) {
    return el instanceof KitMark ? el.value : el instanceof KitSpot ? el.place : void 0
}
