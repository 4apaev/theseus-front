const art = (path: string) => `${ import.meta.env.BASE_URL }art/${ path }`

/** a good's icon, from sam's set in `art/toy/icons/`. module packages have their own folder. */
export function iconOf(gid: string, kind?: string) {
    return art(`toy/icons/${ kind === 'module' ? 'modules' : 'goods' }/${ gid.replace('.', '-') }.webp`)
}
