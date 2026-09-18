export interface Command { label: string, tag?: string }

const TIMEOUT = 15000

/**
 * commands answer 202 with a correlation id. the result arrives on
 * the feed with the same id. this map remembers each sent command
 * until its reply lands, or the clock runs out.
 */
export class Pending {
    onTimeout?: (command: Command) => void

    private readonly map = new Map<string, Command & { timer: ReturnType<typeof setTimeout> }>

    readonly ttl: number

    constructor(ttl = TIMEOUT) {
        this.ttl = ttl
    }

    get size() { return this.map.size }

    track(coid: string, label: string, tag?: string) {
        const timer = setTimeout(() => this.expire(coid), this.ttl)
        this.map.set(coid, { label, tag, timer })
    }

    settle(coid?: string): Command | undefined {
        const p = coid ? this.map.get(coid) : void 0
        if (!p) return
        clearTimeout(p.timer)
        this.map.delete(coid!)
        return { label: p.label, tag: p.tag }
    }

    clear() {
        for (const p of this.map.values()) clearTimeout(p.timer)
        this.map.clear()
    }

    private expire(coid: string) {
        const p = this.map.get(coid)
        if (!p) return
        this.map.delete(coid)
        this.onTimeout?.({ label: p.label, tag: p.tag })
    }
}
