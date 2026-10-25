import { Fail } from '../core/util.ts'

const files = import.meta.glob<Record<string, unknown>>('./fixtures/*.json', { import: 'default' })

/** a recorded session by name, with the shared universe. */
export async function fixture(name: string) {
    const [ f, universe ] = await Promise.all([ load(name), load('universe') ])
    return { ...f, universe }
}

async function load(name: string) {
    const file = files[ `./fixtures/${ name }.json` ] ?? Fail.raise(`no fixture "${ name }"`, 'fixture')
    return file()
}
