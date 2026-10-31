/** the cues, each a few toy notes: [ hz, seconds after the start, length, wave ]. */
type Note = [ number, number, number, OscillatorType ]

const CUES: Record<string, Note[]> = {
    buy      : [[ 1320, 0, .08, 'triangle' ], [ 1760, .07, .14, 'triangle' ]],
    sell     : [[ 1760, 0, .08, 'triangle' ], [ 1175, .07, .14, 'triangle' ]],
    install  : [[ 196, 0, .06, 'square' ], [ 392, .06, .1, 'triangle' ]],
    remove   : [[ 392, 0, .06, 'triangle' ], [ 147, .06, .12, 'square' ]],
    depart   : [[ 330, 0, .12, 'sine' ], [ 440, .1, .12, 'sine' ], [ 660, .2, .3, 'sine' ]],
    arrive   : [[ 784, 0, .18, 'sine' ], [ 1047, .14, .4, 'sine' ]],
    letterOut: [[ 523, 0, .07, 'sine' ], [ 784, .06, .12, 'sine' ]],
    letterIn : [[ 659, 0, .07, 'sine' ], [ 659, .12, .07, 'sine' ], [ 988, .24, .2, 'sine' ]],
}

// the bed of each place: the cutoff of its noise, hz. a low hum at the port, a hiss on the chart
const BEDS: Record<string, number> = { port: 220, transit: 140, exchange: 420, hold: 180, chart: 900, orbit: 300, rigging: 260, comms: 600 }

/**
 * the sounds of the client, made in the browser: no files. a cue plays
 * its notes; a place hums its bed of filtered noise, and the bed fades
 * to the next place's. the browser lets audio start only after the
 * player's first click: until then nothing plays. `on` mutes it all,
 * `volume` (0 to 1) sets the level of it all.
 */
export class Sounds {
    on = true
    volume = 1
    private ctx?: AudioContext
    private out?: GainNode
    private bed?: { filter: BiquadFilterNode, gain: GainNode }
    private place = ''

    constructor() {
        addEventListener('pointerdown', () => this.wake(), { once: true })
    }

    cue(name: keyof typeof CUES) {
        const ctx = this.ctx
        if (!this.on || !ctx) return
        for (const n of CUES[ name ]) this.note(ctx, n, ctx.currentTime)
    }

    /** the bed of a place; the old one fades out as it fades in. */
    hum(place: string) {
        this.place = place
        const bed = this.bed, ctx = this.ctx
        if (!bed || !ctx) return
        const t = ctx.currentTime
        this.out!.gain.setTargetAtTime(this.volume, t, .1)
        bed.filter.frequency.setTargetAtTime(BEDS[ place ] ?? 300, t, .6)
        bed.gain.gain.setTargetAtTime(this.on ? .035 : 0, t, .4)
    }

    private wake() {
        const ctx = this.ctx = new AudioContext
        this.out = ctx.createGain()
        this.out.connect(ctx.destination)
        const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
        noise.buffer = brown(ctx)
        noise.loop = true
        gain.gain.value = 0
        noise.connect(filter).connect(gain).connect(this.out)
        noise.start()
        this.bed = { filter, gain }
        this.hum(this.place)
    }

    // one note: a quick rise, then a soft fall to silence
    private note(ctx: AudioContext, [ hz, after, length, wave ]: Note, t0: number) {
        const osc = ctx.createOscillator(), gain = ctx.createGain(), at = t0 + after
        Object.assign(osc, { type: wave })
        osc.frequency.value = hz
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(.12, at + .01)
        gain.gain.exponentialRampToValueAtTime(.001, at + length)
        osc.connect(gain).connect(this.out!)
        osc.start(at)
        osc.stop(at + length + .05)
    }
}

// 4 s of brown noise: soft and low, it loops without a seam you hear
function brown(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) data[ i ] = (last = (last + .02 * (Math.random() * 2 - 1)) / 1.02) * 3.5
    return buffer
}
