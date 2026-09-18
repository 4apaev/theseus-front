import type { ModuleId } from './model.ts'
import type {
    Player, Ship, CargoRow, FittedSlot, MarketRow, TradeRow, MessageRow,
    TrafficRow, Universe, Route, Station, Good, HullSpec, Constants,
} from './transport/types.ts'

export type LogKind = 'ok' | 'err' | 'dim' | 'cmd'
export interface LogLine { kind: LogKind, text: string, time: string }

/**
 * the authoritative game snapshot, as the server tells it.
 * immutable: every change produces a new object, so lit re-renders.
 * `peers` maps a pid to a sid. the feed names players by pid and
 * traffic names ships by sid. a sent message teaches one pair.
 */
export interface Session {
    me?      : Player
    ship?    : Ship
    universe?: Universe
    cargo    : CargoRow[]
    fitted   : FittedSlot[]
    market   : MarketRow[]
    trades   : TradeRow[]
    messages : MessageRow[]
    traffic  : Record<string, TrafficRow>
    peers    : Record<string, string>
    log      : LogLine[]
}

const LOG_SIZE = 60

export function emptySession(): Session {
    return { cargo: [], fitted: [], market: [], trades: [], messages: [], traffic: {}, peers: {}, log: []}
}

export function withLog(s: Session, kind: LogKind, text: string): Session {
    const line = { kind, text, time: (new Date).toISOString() }
    return { ...s, log: [ line, ...s.log ].slice(0, LOG_SIZE) }
}

// ── lookups ──────────────────────────────────────────────────

export function station(s: Session, stid?: string): Station | undefined {
    return s.universe?.stations.find(st => st.stid === stid)
}

export function stationName(s: Session, stid?: string): string {
    return station(s, stid)?.name ?? stid ?? '—'
}

export function good(s: Session, gid: string): Good | undefined {
    return s.universe?.goods[ gid ]
}

export function goodName(s: Session, gid: string): string {
    return good(s, gid)?.name ?? gid
}

export function volumeOf(s: Session, gid: string): number {
    return good(s, gid)?.volume ?? 1
}

/** the same arithmetic market-service runs before a buy. */
export function cargoLoad(s: Session): number {
    return s.cargo.reduce((n, c) => n + c.quantity * volumeOf(s, c.gid), 0)
}

export function aboard(s: Session, gid: string): number {
    return s.cargo.find(c => c.gid === gid)?.quantity ?? 0
}

export function hullSpec(s: Session): HullSpec | undefined {
    return s.ship && s.universe?.hulls[ s.ship.hull ]
}

export function fittedAt(s: Session, slot: string): string | undefined {
    return s.fitted.find(f => f.slot === slot)?.gid
}

export function docked(s: Session): boolean {
    return s.ship?.status === 'docked'
}

export function mine(s: Session, payload: Record<string, unknown>): boolean {
    return !!s.me && payload.pid === s.me.pid
}

/** other players' ships docked at one station. */
export function dockedAt(s: Session, stid?: string): TrafficRow[] {
    return stid
        ? Object.values(s.traffic).filter(t => t.status === 'docked' && t.stid === stid)
        : []
}

export function peerOf(s: Session, pid: string): TrafficRow | undefined {
    const sid = s.peers[ pid ]
    return sid ? s.traffic[ sid ] : void 0
}

export function pidOf(s: Session, sid: string): string | undefined {
    return Object.keys(s.peers).find(pid => s.peers[ pid ] === sid)
}

export function hasAnsible(s: Session): boolean {
    return s.fitted.some(f => f.gid.startsWith('ansible.'))
}

// ── travel ───────────────────────────────────────────────────

export interface Departure {
    route    : Route
    station  : Station
    years_abs: number
    years_rel: number
    ms       : number
}

/**
 * the time of one leg, in years. the same model as the server's
 * `legTime()`. keep the 2 in step, or the preview shows a false eta.
 * a route between stars holds one speed. an in-system route
 * accelerates to the midpoint, flips, then brakes.
 */
export function legTime(route: Route, ship: Ship, k: Constants): number {
    if (route.c >= 1) return route.ly / Math.min(ship.velocity, route.c)

    const d = route.ly * k.light_speed * k.year_seconds
    const v = route.c * k.light_speed
    const a = ship.acceleration

    const seconds = Math.sqrt(a * d) <= v
        ? 2 * Math.sqrt(d / a)
        : d / v + v / a

    return seconds / k.year_seconds
}

/** one game year lasts `time_scale` real seconds. */
export function realMs(years: number, k: Constants): number {
    return years * k.time_scale * 1000
}

export function departures(s: Session): Departure[] {
    const { ship, universe } = s
    if (!ship?.stid || !universe) return []

    return universe.routes
        .filter(r => r.from === ship.stid)
        .flatMap(route => {
            const to = station(s, route.to)
            if (!to) return []
            const years = legTime(route, ship, universe.constants)
            const rel = route.c < 1 ? years : years * Math.sqrt(1 - Math.min(ship.velocity, route.c) ** 2)
            return [{ route, station: to, years_abs: years, years_rel: rel, ms: realMs(years, universe.constants) }]
        })
        .sort((a, b) => a.years_abs - b.years_abs)
}

export function etaMs(ship: Ship, now = Date.now()): number {
    return ship.arrives ? Date.parse(ship.arrives) - now : 0
}

// ── rendering ────────────────────────────────────────────────

/**
 * the renderer knows 3 visual modules. mk1 modules are net-zero
 * placeholders, so only an upgrade or a transceiver shows.
 */
const VISUAL: Record<string, ModuleId> = {
    'cargo.mk2'   : 'cargo',
    'cruise.mk2'  : 'drive',
    'maneuver.mk2': 'drive',
    'ansible.mk1' : 'ansible',
}

export function visualModule(gid?: string): ModuleId | undefined {
    return gid ? VISUAL[ gid ] : void 0
}

export function visualFitted(fitted: FittedSlot[]): ModuleId[] {
    return [ ...new Set(fitted.flatMap(f => visualModule(f.gid) ?? [])) ]
}
