const still = matchMedia('(prefers-reduced-motion: reduce)')

/** an icon flies from one box to another over the host, then goes. */
export function fly(host: HTMLElement, src: string, from: DOMRect, to: DOMRect) {
    if (still.matches) return
    const h = host.getBoundingClientRect()
    const at = (r: DOMRect) => `translate(${ r.left + r.width / 2 - h.left }px, ${ r.top + r.height / 2 - h.top }px) translate(-50%, -50%)`
    const img = host.appendChild(Object.assign(document.createElement('img'), { src, alt: '' }))
    img.dataset.fly = ''
    img.animate([{ transform: `${ at(from) } scale(1)` }, { transform: `${ at(to) } scale(.6)` }], { duration: 700, easing: 'cubic-bezier(.5, 0, .3, 1)' })
        .finished.then(() => img.remove())
}
