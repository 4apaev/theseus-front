import { Api } from './transport/api.ts'
import { Feed } from './transport/feed.ts'
import { Pending, type Command } from './transport/pending.ts'
import * as parse from './transport/validate.ts'
import type { Preview, Side } from './transport/types.ts'
import { fold, flavor } from './events.ts'
import { emptySession, withLog, goodName, stationName, docked } from './session.ts'
import type { Session, LogKind } from './session.ts'
import { Fail } from './util.ts'

export type ClientStatus = 'offline' | 'syncing' | 'online'

export const TOKEN_KEY = 'theseus.token'

// the market pays up to 10% over quote on a buy, and accepts 10% under on a sell
const RATE = { buy: 1.1, sell: 0.9 }
const HYDRATE_TRIES = 20
const HYDRATE_WAIT = 500

/**
 * the one owner of transport and session. screens read `session`
 * and call commands. the server owns every rule: a command answers
 * 202, and the result folds in from the feed.
 */
export class GameClient {
    session = emptySession()
    status: ClientStatus = 'offline'

    onChange?: (session: Session) => void
    onStatus?: (status: ClientStatus) => void
    onNotify?: (text: string) => void
    onAuth?  : (authed: boolean) => void

    readonly api = new Api
    private readonly feed = new Feed
    private readonly pending = new Pending
    private alive = false

    constructor() {
        this.api.onUnauthorized = () => this.logout('session expired')
        this.feed.onFrame  = raw => this.receive(raw)
        this.feed.onStatus = st => this.setStatus(st)
        this.feed.onResync = () => this.hydrate()
        this.feed.onError  = e => this.log('err', e.message)
        this.pending.onTimeout = c => this.log('err', `${ c.label } · timed out`)
    }

    // ── auth ─────────────────────────────────────────────────

    boot() {
        const token = read(TOKEN_KEY)
        if (token) void this.enter(token)
        else this.onAuth?.(false)
    }

    async register(handle: string, password: string) {
        const { status } = await this.api.post('/api/auth/register', { handle, password })
        // 202: the reply timed out, the saga still runs. login retries.
        if (status === 202) await new Promise(done => setTimeout(done, 1500))
        return this.login(handle, password)
    }

    async login(handle: string, password: string) {
        const { body } = await this.api.post('/api/auth/login', { handle, password })
        const { token } = parse.login(body)
        write(TOKEN_KEY, token)
        await this.enter(token)
    }

    logout(message?: string) {
        this.alive = false
        this.feed.close()
        this.pending.clear()
        this.api.token = void 0
        write(TOKEN_KEY)
        this.session = emptySession()
        this.setStatus('offline')
        this.onAuth?.(false)
        if (message) this.onNotify?.(message)
    }

    private async enter(token: string) {
        this.alive = true
        this.api.token = token
        this.onAuth?.(true)
        try {
            await this.hydrate()
            if (this.alive) this.feed.open(token)
        }
        catch (e) {
            if (this.alive) this.log('err', `sync failed: ${ Fail.from(e).message }`)
        }
    }

    // ── reads ────────────────────────────────────────────────

    /** the projection lags a fresh registration. `me` waits for it. */
    async hydrate() {
        this.setStatus('syncing')
        const me = await this.waitForMe()
        if (!me) return

        const universe = this.session.universe ?? parse.universe((await this.api.get('/api/universe')).body)
        this.commit({ me, universe })

        await this.refreshRig()
        await Promise.all([ this.refreshMarket(), this.refreshTraffic(), this.refreshMessages(), this.refreshTrades() ])
    }

    private async waitForMe() {
        for (let i = 0; this.alive && i < HYDRATE_TRIES; i++) {
            try {
                return parse.player((await this.api.get('/api/player/me')).body)
            }
            catch (e) {
                if (!this.alive || Fail.from(e).code === '401') return
                await new Promise(done => setTimeout(done, HYDRATE_WAIT))
            }
        }
    }

    /* ship, cargo and rig in one read. a rig change touches all 3,
       and a reload keeps the client out of replaying a saga. */
    async refreshRig() {
        const [ ship ] = parse.ships((await this.api.get('/api/ship')).body)
        if (!ship) return this.commit({ ship: void 0, cargo: [], fitted: []})

        const [ cargo, fitted ] = await Promise.all([
            this.api.get(`/api/ship/${ ship.sid }/cargo`),
            this.api.get(`/api/ship/${ ship.sid }/modules`),
        ])
        this.commit({ ship, cargo: parse.cargo(cargo.body), fitted: parse.fitted(fitted.body) })
    }

    /* the ship may be gone by the time this resolves. a stale reply
       must not overwrite the next dock. */
    async refreshMarket() {
        const stid = this.session.ship?.stid
        if (!stid || !docked(this.session)) return this.commit({ market: []})

        const rows = parse.market((await this.api.get(`/api/station/${ stid }/market`)).body)
        if (this.session.ship?.stid === stid) this.commit({ market: rows })
    }

    async refreshTraffic() {
        const rows = parse.traffic((await this.api.get('/api/ship/traffic')).body)
        const own = this.session.ship?.sid
        this.commit({ traffic: Object.fromEntries(rows.filter(t => t.sid !== own).map(t => [ t.sid, t ])) })
    }

    async refreshMessages() {
        const rows = parse.messages((await this.api.get('/api/comms/messages')).body)
        this.commit({ messages: rows.sort((a, b) => a.sent.localeCompare(b.sent)) })
    }

    async refreshTrades() {
        this.commit({ trades: parse.trades((await this.api.get('/api/market/trades')).body) })
    }

    async preview(slot: string, gid?: string): Promise<Preview> {
        const { sid } = this.needShip()
        return parse.preview((await this.api.post(`/api/ship/${ sid }/modules/preview`, { slot, gid })).body)
    }

    // ── commands ─────────────────────────────────────────────

    travel(to: string) {
        const { sid, stid } = this.needShip()
        return this.command('post', `/api/ship/${ sid }/travel`, { to, from: stid }, { label: `travel → ${ stationName(this.session, to) }` })
    }

    rename(name: string) {
        return this.command('put', `/api/ship/${ this.needShip().sid }/name`, { name }, { label: `rename → ${ name }` })
    }

    install(slot: string, gid: string) {
        return this.command('put', `/api/ship/${ this.needShip().sid }/modules/${ slot }`, { gid }, { label: `fit ${ goodName(this.session, gid) } → ${ slot }` })
    }

    remove(slot: string) {
        return this.command('del', `/api/ship/${ this.needShip().sid }/modules/${ slot }`, void 0, { label: `remove ${ slot }` })
    }

    trade(side: Side, gid: string, quantity: number) {
        const { sid, stid } = this.needShip()
        const row = this.session.market.find(m => m.gid === gid) ?? Fail.raise('good not quoted here', 'trade')

        const limit = side === 'buy' ? 'price_unit_max' : 'price_unit_min'
        const price = +(row[ `price_${ side }` ] * RATE[ side ]).toFixed(4)
        return this.command('post', `/api/market/${ side }`, { gid, sid, stid, quantity, [ limit ]: price }, { label: `${ side } ${ quantity } × ${ goodName(this.session, gid) }` })
    }

    /** `to` is a ship sid. the gateway resolves the pilot. */
    send(body: string, to?: string) {
        const label = to ? `signal → ${ this.session.traffic[ to ]?.handle ?? 'pilot' }` : 'station channel'
        return this.command('post', '/api/comms/messages', { body, to }, { label, tag: to })
    }

    private async command(method: 'post' | 'put' | 'del', path: string, body: unknown, c: Command) {
        this.log('cmd', `→ ${ c.label } …`)
        const reply = method === 'del' ? await this.api.del(path) : await this.api[ method ](path, body)
        this.pending.track(parse.correlation(reply.body), c.label, c.tag)
    }

    // ── feed ─────────────────────────────────────────────────

    private receive(raw: unknown) {
        let frame
        try {
            frame = parse.frame(raw)
        }
        catch (e) {
            return this.log('err', Fail.from(e).message)
        }

        const done = this.pending.settle(frame.correlation_id)
        const line = flavor(this.session, frame)
        if (done) {
            this.onNotify?.(line.text)
            this.learnPeer(done.tag, frame.payload.to)
        }

        this.apply(frame, `${ line.text }${ done ? ` [${ done.label }]` : '' }`, line.kind)
    }

    private apply(frame: ReturnType<typeof parse.frame>, text: string, kind: LogKind) {
        try {
            const { session, refresh } = fold(withLog(this.session, kind, text), frame)
            this.session = session
            this.onChange?.(session)
            if (refresh.includes('rig')) void this.refreshRig().then(() => this.refreshMarket())
            else if (refresh.includes('market')) void this.refreshMarket()
            if (refresh.includes('traffic')) void this.refreshTraffic()
        }
        catch (e) {
            this.log('err', `${ frame.event_type }: ${ Fail.from(e).message }`)
        }
    }

    /** a reply to our own signal names the recipient's pid. */
    private learnPeer(sid?: string, pid?: unknown) {
        if (sid && typeof pid === 'string') this.commit({ peers: { ...this.session.peers, [ pid ]: sid }})
    }

    // ── state ────────────────────────────────────────────────

    private commit(patch: Partial<Session>) {
        this.session = { ...this.session, ...patch }
        this.onChange?.(this.session)
    }

    private log(kind: LogKind, text: string) {
        this.session = withLog(this.session, kind, text)
        this.onChange?.(this.session)
    }

    private setStatus(status: ClientStatus) {
        this.status = status
        this.onStatus?.(status)
    }

    private needShip() {
        return this.session.ship ?? Fail.raise('no ship', 'ship')
    }
}

// blocked storage must not stop the app. a denied token means a fresh login.
function read(key: string): string | undefined {
    try { return localStorage.getItem(key) ?? void 0 }
    catch { return void 0 }
}

function write(key: string, value?: string) {
    try {
        if (value) localStorage.setItem(key, value)
        else localStorage.removeItem(key)
    }
    catch { /* session only */ }
}
