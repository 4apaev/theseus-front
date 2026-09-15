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
export function credits(value: number)                             { return '₢' + number(value) }
export function duration(seconds: number)                          { return `${ Math.floor(seconds / 3600) }h ${ Math.floor(seconds % 3600 / 60) }m` }
export function emit<T>(trg: EventTarget, type: string, detail: T) { return trg.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })) }
