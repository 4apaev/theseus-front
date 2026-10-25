import { GameClient } from './client.ts'
import { answer } from './script.ts'
import { docked } from './session.ts'
import type { MarketRow, Preview } from './transport/types.ts'
import type { Command } from './transport/pending.ts'
import * as parse from './transport/validate.ts'
import { Fail } from './util.ts'

/** the wire bodies of one hydrate, by name: `me`, `ship`, `universe`… */
export type Recorded = Record<string, unknown>

/**
 * boots on a recorded session, with no gateway. the bodies pass the
 * same parsers as `hydrate()`. a command gets its frames from the
 * played server (`script.ts`), and they pass the same feed path: the
 * parsers, the pending commands, the fold. a refresh reads the record.
 * an `arrives` of `+90s` counts from boot.
 */
export class FixtureClient extends GameClient {
    private readonly load: () => Promise<Recorded>
    private quotes: MarketRow[] = []
    private sent = 0

    constructor(load: () => Promise<Recorded>) {
        super()
        this.load = load
    }

    override boot() {
        this.load()
            .then(r => this.enterFixture(r))
            .catch(e => this.onNotify?.(`fixture: ${ Fail.from(e).message }`))
    }

    // every station quotes the recorded market, its prices moved by the station
    override async refreshMarket() {
        const s = this.session, stid = s.ship?.stid ?? ''
        this.commit({ market: docked(s) ? this.quotes.map(m => shift(m, hash(stid + m.gid))) : []})
    }

    override async refreshRig() { /* the rig event carries the rig */ }

    // the stats stay: the real server computes them. a module of the wrong family is an error
    override async preview(slot: string, gid?: string): Promise<Preview> {
        const s = this.session, ship = s.ship ?? Fail.raise('no ship', 'ship')
        const family = s.universe?.hulls[ ship.hull ]?.slots.find(x => x.id === slot)?.family
        const wrong = gid && s.universe?.modules[ gid ]?.family !== family
        const proposed = [ ...s.fitted.filter(f => f.slot !== slot), ...gid ? [{ slot, gid }] : [] ]
        const stats = { capacity: ship.capacity, velocity: ship.velocity, acceleration: ship.acceleration, power: ship.power, power_pool: ship.power_pool }
        return { proposed, ...stats, load: 0, errors: wrong ? [ `${ gid } does not fit ${ slot }` ] : []}
    }

    override async refreshTraffic() { /* the record holds the traffic */ }
    override async refreshMessages() { /* the comms events carry the letters */ }
    override async refreshTrades() { /* the trade events carry the trades */ }

    protected override async command(method: string, path: string, body: unknown, c: Command) {
        this.log('cmd', `→ ${ c.label } · fixture`)
        const coid = `fixture-${ ++this.sent }`
        this.pending.track(coid, c.label, c.tag)
        for (const { at, frame } of answer(this.session, method, path, (body ?? {}) as Record<string, unknown>))
            setTimeout(() => this.receive({ ...frame, correlation_id: coid }), at)
    }

    private enterFixture(r: Recorded) {
        this.quotes = parse.market(r.market)
        this.onAuth?.(true)
        this.commit({
            me      : parse.player(r.me),
            ship    : parse.ship(rebase(r.ship)),
            universe: parse.universe(r.universe),
            cargo   : parse.cargo(r.cargo),
            fitted  : parse.fitted(r.fitted),
            market  : this.quotes,
            traffic : Object.fromEntries(parse.traffic(parse.list(r.traffic, rebase)).map(t => [ t.sid, t ])),
            messages: parse.messages(r.messages),
            trades  : parse.trades(r.trades),
        })
        this.setStatus('online')
        this.land()
    }

    // a recorded ship in transit lands at its time, as the server would land it
    private land() {
        const ship = this.session.ship
        if (ship?.status !== 'transit' || !ship.arrives || !ship.to) return
        const frame = { event_type: 'ship.arrived.v1', occurred: ship.arrives, payload: { pid: this.session.me?.pid, sid: ship.sid, stid: ship.to }}
        const timer = setTimeout(() => this.receive(frame), Math.max(0, Date.parse(ship.arrives) - Date.now()))
        // in node a test run must not wait for the landing
        Object(timer).unref?.()
    }
}

function rebase(x: unknown) {
    const r = parse.row(x)
    const m = /^\+(\d+)s$/.exec(String(r.arrives))
    return m ? { ...r, arrives: new Date(Date.now() + +m[ 1 ] * 1000).toISOString() } : r
}

// a price 15% up or down, the same for the same station and good
function shift(m: MarketRow, h: number): MarketRow {
    const k = .85 + (h % 1000) / 1000 * .3
    return { gid: m.gid, price_buy: +(m.price_buy * k).toFixed(2), price_sell: +(m.price_sell * k).toFixed(2) }
}

function hash(text: string) {
    let h = 0x811c9dc5
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
    return h >>> 0
}
