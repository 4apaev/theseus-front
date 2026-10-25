/** Browser-safe counterpart to garage's Fail helpers. Codes identify recoverable failures. */

export class Fail extends Error {
    override name = 'Fail'
    readonly code: string

    constructor(msg: string, code = 'operation', cause?: unknown) {
        super(msg, { cause })
        this.code = code
    }

    static from(e: unknown, code = 'operation') {
        return e instanceof Fail
            ? e
            : new Fail(e instanceof Error
                ? e.message
                : 'operation failed', code, e)
    }

    static raise(msg: string, code = 'operation', cause?: unknown): never {
        throw new this(msg, code, cause)
    }
}

export class ValidationError extends Fail {
    override name = 'ValidationError'
}

export function raise(msg: string, code = 'validation', cause?: unknown): never {
    return ValidationError.raise(msg, code, cause)
}

/** Narrows a value and rejects invalid domain inputs before any state is changed. */
export function assert(value: unknown, message: string, code = 'validation'): asserts value {
    if (!value) raise(message, code)
}

export function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value))
}

const formats = (new Map<number, Intl.NumberFormat>)

export function number(value: number, places = 0): string {
    if (!formats.has(places))
        formats.set(places, new Intl.NumberFormat('en-US', { minimumFractionDigits: places, maximumFractionDigits: places }))

    return formats.get(places)!.format(value)
}

export function decimal(value: number, places = 2)                 { return number(value, places) }
export function credits(value: number, places = 2)                 { return '₢' + number(value, places) }
export function duration(seconds: number)                          { return `${ Math.floor(seconds / 3600) }h ${ Math.floor(seconds % 3600 / 60) }m` }
export function emit<T>(trg: EventTarget, type: string, detail: T) { return trg.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })) }

// ── game units ───────────────────────────────────────────────

export function fmtYears(n: number) { return n.toFixed(1) }

/** a drive grade moves velocity by a few percent. 2 decimals hide it. */
export function fmtVel(n: number) { return n.toFixed(3) }

/** a drive grade moves acceleration by thousandths of an m/s². */
export function fmtAccel(n: number) { return n.toFixed(4) }

/** a route inside one system is far shorter than a light year. show au there. */
export function fmtDist(ly: number) {
    return ly < 0.01
        ? `${ (ly * 63241.077).toFixed(2) } au`
        : `${ ly.toFixed(2) } ly`
}

/** `T-mm:ss`, or `T-hh:mm:ss` past an hour. */
export function countdown(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60
    const mmss = `${ String(m).padStart(2, '0') }:${ String(s).padStart(2, '0') }`
    return h ? `T-${ h }:${ mmss }` : `T-${ mmss }`
}

/** a real-time span, `12s`, `4m 10s`, `2h 05m`. */
export function span(ms: number) {
    const total = Math.max(0, Math.round(ms / 1000))
    if (total < 60) return `${ total }s`
    if (total < 3600) return `${ Math.floor(total / 60) }m ${ String(total % 60).padStart(2, '0') }s`
    return `${ Math.floor(total / 3600) }h ${ String(Math.floor(total % 3600 / 60)).padStart(2, '0') }m`
}
