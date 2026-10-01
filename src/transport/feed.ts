import { Fail } from '../util.ts'

export type FeedStatus = 'online' | 'offline'

const MAX_WAIT  = 10000
const IDLE_LIMIT = 45000

/**
 * the websocket half of the gateway. push only: one json frame per
 * event. a dropped socket reconnects with exponential backoff, and
 * calls `onResync` first, so the session refills the gap from rest.
 * a socket can also die silently - readyState stays open, no close
 * event ever fires - so an idle timer closes it by hand once too
 * much time passes with no frame at all.
 */
export class Feed {
    onFrame? : (frame: unknown) => void
    onStatus?: (status: FeedStatus) => void
    onResync?: () => Promise<void>
    onError? : (e: Fail) => void

    private socket?: WebSocket
    private abort?: AbortController
    private timer?: ReturnType<typeof setTimeout>
    private idle?: ReturnType<typeof setTimeout>
    private token = ''
    private tries = 0
    private alive = false

    readonly path: string

    constructor(path = '/api/feed') {
        this.path = path
    }

    open(token: string) {
        this.token = token
        this.alive = true
        this.tries = 0
        this.connect()
    }

    close() {
        this.alive = false
        clearTimeout(this.timer)
        this.drop()
    }

    private url() {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws'
        return `${ proto }://${ location.host }${ this.path }?token=${ encodeURIComponent(this.token) }`
    }

    /** a stale socket's own close handler must not race the new one. */
    private drop() {
        clearTimeout(this.idle)
        this.abort?.abort()
        this.socket?.close()
        this.socket = void 0
        this.abort = void 0
    }

    private connect() {
        this.drop()
        const ws = this.socket = new WebSocket(this.url())
        const { signal } = this.abort = new AbortController

        ws.addEventListener('open', () => { this.tries = 0; this.onStatus?.('online'); this.arm() }, { signal })
        ws.addEventListener('message', e => this.receive(e.data), { signal })
        ws.addEventListener('close', () => this.lost(), { signal })
    }

    /** any frame proves the socket is alive, parsed or not - push the idle deadline back out. */
    private arm() {
        clearTimeout(this.idle)
        this.idle = setTimeout(() => this.socket?.close(), IDLE_LIMIT)
    }

    private receive(data: unknown) {
        this.arm()
        if (typeof data !== 'string') return
        try {
            this.onFrame?.(JSON.parse(data))
        }
        catch (e) {
            this.onError?.(Fail.from(e, 'frame'))
        }
    }

    private lost() {
        this.onStatus?.('offline')
        if (!this.alive) return
        const wait = Math.min(1000 * 2 ** this.tries++, MAX_WAIT)
        this.timer = setTimeout(() => void this.retry(), wait)
    }

    private async retry() {
        if (!this.alive) return
        try {
            await this.onResync?.()
        }
        catch (e) {
            this.onError?.(Fail.from(e, 'resync'))
        }
        if (this.alive) this.connect()
    }
}
