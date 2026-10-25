import type { FittedSlot } from './transport/types.ts'
import { shortestPath } from './chart.ts'
import { aboard, cargoLoad, volumeOf, type Session } from './session.ts'

/** one frame of the played server, `at` ms after the command. */
export interface Beat { at: number, frame: Record<string, unknown> }

type Body    = Record<string, unknown>
type Handler = (s: Session, b: Body, arg: string) => Beat[]

const REPLY   = 300
const ANSIBLE = 4000

/**
 * the server, played back for fixture mode. a command gets the frames
 * the gateway would send, built from the session alone. it checks what
 * a player meets first: credits, hold space, a route, a module in the
 * hold. every other rule stays with the real server.
 */
export function answer(s: Session, method: string, path: string, body: Body): Beat[] {
    for (const [ route, handle ] of ROUTES) {
        const m = route.exec(`${ method } ${ path }`)
        if (m) return handle(s, body, m[ 1 ])
    }
    return []
}

const ROUTES: [ RegExp, Handler ][] = [
    [ /^post \/api\/market\/(buy|sell)$/, trade ],
    [ /^post \/api\/ship\/[^/]+\/(travel)$/, travel ],
    [ /^put \/api\/ship\/[^/]+\/(name)$/, rename ],
    [ /^put \/api\/ship\/[^/]+\/modules\/([^/]+)$/, install ],
    [ /^del \/api\/ship\/[^/]+\/modules\/([^/]+)$/, remove ],
    [ /^post \/api\/comms\/(messages)$/, send ],
]

function trade(s: Session, b: Body, side: string): Beat[] {
    const gid = String(b.gid), n = Number(b.quantity), buy = side === 'buy'
    const quote = s.market.find(m => m.gid === gid)
    const price = quote ? buy ? quote.price_buy : quote.price_sell : 0
    const total = +(price * n).toFixed(2), balance = s.me?.balance ?? 0
    const reason = first([
        [ !quote, 'the good is not quoted here' ],
        [ buy && total > balance, 'not enough credits' ],
        [ buy && cargoLoad(s) + n * volumeOf(s, gid) > (s.ship?.capacity ?? 0), 'not enough hold space' ],
        [ !buy && aboard(s, gid) < n, 'not enough in the hold' ],
    ])
    if (reason) return [ beat('market.trade.rejected.v1', own(s, { side, reason })) ]
    return [
        beat(`cargo.${ buy ? 'loaded' : 'unloaded' }.v1`, own(s, { gid, quantity: n })),
        beat(`wallet.${ buy ? 'debited' : 'credited' }.v1`, own(s, { amount: total, balance: +(balance + (buy ? -total : total)).toFixed(2) })),
        beat('market.trade.executed.v1', own(s, { side, tid: id('t'), gid, stid: s.ship?.stid, quantity: n, price_unit: price, price_total: total })),
    ]
}

// one departed and one arrived pair per hop, each hop at its real duration
function travel(s: Session, b: Body): Beat[] {
    const { ship, universe } = s
    const plan = ship?.stid && universe ? shortestPath(universe, ship, ship.stid, String(b.to)) : void 0
    if (!plan?.legs.length) return [ beat('ship.travel.rejected.v1', own(s, { reason: plan ? 'the ship is there' : 'no route to destination' })) ]
    let t = REPLY
    return plan.legs.flatMap(leg => {
        const go = t
        t += Math.max(leg.ms, 1500)
        const arrives = new Date(Date.now() + t).toISOString()
        return [
            beat('ship.departed.v1', own(s, { from: leg.route.from, to: leg.route.to, arrives, years_abs: leg.years_abs, years_rel: leg.years_rel }), go),
            beat('ship.arrived.v1', own(s, { stid: leg.route.to }), t),
        ]
    })
}

function rename(s: Session, b: Body): Beat[] {
    const name = String(b.name ?? '').trim()
    return name
        ? [ beat('ship.renamed.v1', own(s, { name })) ]
        : [ beat('ship.rename.rejected.v1', own(s, { reason: 'the name is empty' })) ]
}

function install(s: Session, b: Body, slot: string): Beat[] {
    const gid = String(b.gid)
    if (!aboard(s, gid)) return [ beat('ship.module.operation.rejected.v1', own(s, { reasons: [ 'the module is not in the hold' ]})) ]
    return rig(s, [ ...s.fitted.filter(f => f.slot !== slot), { slot, gid }], slot, gid)
}

function remove(s: Session, _b: Body, slot: string): Beat[] {
    if (!s.fitted.some(f => f.slot === slot)) return [ beat('ship.module.operation.rejected.v1', own(s, { reasons: [ 'the slot is empty' ]})) ]
    return rig(s, s.fitted.filter(f => f.slot !== slot), slot)
}

// the stats stay as they are: the real server computes them
function rig(s: Session, fitted: FittedSlot[], slot: string, incoming?: string): Beat[] {
    const ship = s.ship
    const outgoing = s.fitted.find(f => f.slot === slot)?.gid
    if (!ship) return []
    const stats = { hull: ship.hull, rig: ship.rig + 1, capacity: ship.capacity, velocity: ship.velocity, acceleration: ship.acceleration, power: ship.power, power_pool: ship.power_pool }
    return [
        beat('ship.rig.changed.v1', own(s, { slot, incoming, outgoing, ...stats, fitted })),
        beat('cargo.module.exchanged.v1', own(s, { incoming, outgoing, load: cargoLoad(s), capacity_next: ship.capacity })),
    ]
}

// a signal goes by ansible: it lands a few seconds later
function send(s: Session, b: Body): Beat[] {
    const to = b.to ? String(b.to) : void 0
    const now = Date.now()
    const message = { mid: id('m'), from: s.me?.pid, to, stid: to ? void 0 : s.ship?.stid, body: String(b.body), sent: iso(now), deliver: iso(now + ANSIBLE) }
    return [
        beat('comms.sent.v1', own(s, message)),
        beat('comms.delivered.v1', { ...message, delivered: iso(now + ANSIBLE) }, ANSIBLE),
    ]
}

// ── helpers ──────────────────────────────────────────────────

function beat(type: string, payload: Body, at = REPLY): Beat {
    return { at, frame: { event_type: type, occurred: iso(Date.now() + at), payload }}
}

const own   = (s: Session, payload: Body): Body => ({ pid: s.me?.pid, sid: s.ship?.sid, ...payload })
const first = (rules: [ boolean, string ][]) => rules.find(([ broken ]) => broken)?.[ 1 ]
const iso   = (ms: number) => new Date(ms).toISOString()
const id    = (kind: string) => `${ kind }-${ Math.random().toString(36).slice(2, 10) }`
