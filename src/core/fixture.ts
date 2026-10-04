import { GameClient } from './client.ts'
import type { Command } from './transport/pending.ts'
import * as parse from './transport/validate.ts'
import { Fail } from './util.ts'

/** the wire bodies of one hydrate, by name: `me`, `ship`, `universe`… */
export type Recorded = Record<string, unknown>

/**
 * boots on a recorded session, with no gateway. the bodies pass the
 * same parsers as `hydrate()`. a command only logs.
 * an `arrives` of `+90s` counts from boot.
 */
export class FixtureClient extends GameClient {
    private readonly load: () => Promise<Recorded>

    constructor(load: () => Promise<Recorded>) {
        super()
        this.load = load
    }

    override boot() {
        this.load()
            .then(r => this.enterFixture(r))
            .catch(e => this.onNotify?.(`fixture: ${ Fail.from(e).message }`))
    }

    private enterFixture(r: Recorded) {
        this.onAuth?.(true)
        this.commit({
            me      : parse.player(r.me),
            ship    : parse.ship(rebase(r.ship)),
            universe: parse.universe(r.universe),
            cargo   : parse.cargo(r.cargo),
            fitted  : parse.fitted(r.fitted),
            market  : parse.market(r.market),
            traffic : Object.fromEntries(parse.traffic(parse.list(r.traffic, rebase)).map(t => [ t.sid, t ])),
            messages: parse.messages(r.messages),
            trades  : parse.trades(r.trades),
        })
        this.setStatus('online')
    }

    protected override async command(_method: string, _path: string, _body: unknown, c: Command) {
        this.log('cmd', `→ ${ c.label } · fixture, no gateway`)
    }
}

function rebase(x: unknown) {
    const r = parse.row(x)
    const m = /^\+(\d+)s$/.exec(String(r.arrives))
    return m ? { ...r, arrives: new Date(Date.now() + +m[ 1 ] * 1000).toISOString() } : r
}
