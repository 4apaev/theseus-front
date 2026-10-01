import { Fail } from '../util.ts'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
export interface Reply { status: number, body: unknown }

/**
 * a thin fetch wrapper. it adds the bearer token, parses json,
 * and rejects a bad status with a `Fail` whose code is the status.
 * a 401 also fires `onUnauthorized`, so the session can log out.
 */
export class Api {
    token?: string
    onUnauthorized?: () => void

    readonly base: string

    constructor(base = '') {
        this.base = base
    }

    get(path: string)                { return this.send('GET', path) }
    post(path: string, body?: unknown) { return this.send('POST', path, body) }
    put(path: string, body?: unknown)  { return this.send('PUT', path, body) }
    del(path: string)                { return this.send('DELETE', path) }

    private async send(method: Method, path: string, body?: unknown): Promise<Reply> {
        const headers: Record<string, string> = {}
        if (body !== void 0) headers[ 'content-type' ] = 'application/json'
        if (this.token) headers.authorization = `Bearer ${ this.token }`

        const rs = await fetch(this.base + path, {
            method,
            headers,
            body: body === void 0 ? void 0 : JSON.stringify(body),
        })
        const reply = { status: rs.status, body: await parse(rs) }
        if (rs.ok) return reply

        if (rs.status === 401) this.onUnauthorized?.()
        throw new Fail(errorText(reply.body, rs), String(rs.status))
    }
}

async function parse(rs: Response): Promise<unknown> {
    const type = rs.headers.get('content-type') ?? ''
    return type.includes('application/json')
        ? rs.json()
        : rs.text()
}

function errorText(body: unknown, rs: Response): string {
    const error = typeof body === 'object' && body !== null && 'error' in body
        ? body.error
        : void 0
    return typeof error === 'string' && error
        ? error
        : rs.statusText || `http ${ rs.status }`
}
