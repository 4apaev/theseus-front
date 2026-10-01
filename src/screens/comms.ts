import { html, nothing, type PropertyValues } from 'lit'
import { GameScreen } from './base.ts'
import { icon } from '../icons.ts'
import { docked, stationName, hasAnsible, pidOf, peerOf } from '../session.ts'
import type { MessageRow, TrafficRow } from '../transport/types.ts'
import { span } from '../util.ts'

interface Contact { id: string, name: string, note: string, pid?: string, sid?: string }

const STATION = 'station'
const UNKNOWN = 'pid:'

/**
 * 2 message kinds. station chat: instant, every pilot docked here.
 * ansible: private, delayed by distance. the feed names a pilot by
 * pid and traffic names a ship by sid. `peers` joins the 2 once a
 * reply lands. an unmatched sender shows as an unknown pilot.
 */
class CommsScreen extends GameScreen {
    static properties = { contact: { state: true }, draft: { state: true }, now: { state: true }, presetContact: {}}
    declare contact: string
    declare draft: string
    declare now: number
    declare presetContact?: string
    private timer?: ReturnType<typeof setInterval>

    constructor() {
        super()
        this.contact = STATION
        this.draft = ''
        this.now = Date.now()
    }

    override connectedCallback() {
        super.connectedCallback()
        this.timer = setInterval(() => { if (this.active) this.now = Date.now() }, 500)
    }

    override disconnectedCallback() {
        super.disconnectedCallback()
        clearInterval(this.timer)
    }

    // a preset arrives once, on the transition into view. it does not fight a later manual pick.
    override updated(changes: PropertyValues) {
        if (changes.has('active') && this.active && this.presetContact) {
            this.contact = this.presetContact
            this.draft = ''
        }
    }

    override render() {
        if (!this.active) return nothing
        const contact = this.contacts().find(c => c.id === this.contact) ?? this.contacts()[ 0 ]!
        return html`<div class="operations">
            <section class="viewport" aria-label="communications">${ this.workspace(contact) }</section>
            <app-panel>${ this.panel(contact) }</app-panel>
        </div>`
    }

    // ── contacts ─────────────────────────────────────────────

    private contacts(): Contact[] {
        const { ship, me } = this.session
        const here = ship?.stid
        const station = { id: STATION, name: 'station channel', note: here ? `public · ${ stationName(this.session, here) }` : 'public · offline in transit' }
        const ships = Object.values(this.session.traffic).map(t => this.shipContact(t))
        const known = new Set(Object.keys(this.session.peers))
        const strangers = [ ...new Set(this.session.messages.flatMap(m => [ m.from, m.to ])) ]
            .filter((pid): pid is string => !!pid && pid !== me?.pid && !known.has(pid))
            .map(pid => ({ id: UNKNOWN + pid, name: 'unknown pilot', note: `signal id ${ pid.slice(0, 8) }`, pid }))
        return [ station, ...ships, ...strangers ]
    }

    private shipContact(t: TrafficRow): Contact {
        const where = t.status === 'docked' ? stationName(this.session, t.stid) : `→ ${ stationName(this.session, t.to) }`
        return { id: t.sid, sid: t.sid, name: t.handle ?? 'a pilot', note: `${ t.name } · ${ where }`, pid: pidOf(this.session, t.sid) }
    }

    private thread(c: Contact): MessageRow[] {
        const { ship, me } = this.session
        if (c.id === STATION)
            return this.session.messages.filter(m => !m.to && !!ship?.stid && m.stid === ship.stid)
        if (!c.pid) return []
        return this.session.messages.filter(m => (m.from === me?.pid && m.to === c.pid) || (m.from === c.pid && m.to === me?.pid))
    }

    private blocked(c: Contact): string {
        if (c.id === STATION) return docked(this.session) ? '' : 'the station channel is out of range in transit'
        if (!c.sid) return 'reply needs the pilot\'s ship in traffic'
        if (!hasAnsible(this.session)) return 'fit an ansible transceiver to open this channel'
        return ''
    }

    // ── viewport ─────────────────────────────────────────────

    private workspace(c: Contact) {
        const direct = c.id !== STATION
        const blocked = this.blocked(c)
        return html`<div class="comms-workspace">
            <div class="signal-diagram">
                <div class="signal-node">${ icon('rig') }<span>your vessel<small>${ stationName(this.session, this.session.ship?.stid) }</small></span></div>
                <div class="signal-line"><span data-shape aria-hidden="true"></span><span>${ direct ? 'ansible / delayed by distance' : 'station relay / immediate' }</span></div>
                <div class="signal-node distant">${ icon(direct ? 'orbit' : 'comms') }<span>${ c.name }<small>${ c.note }</small></span></div>
            </div>
            <section class="conversation">
                <header class="conversation-heading"><h2>${ c.name } / ${ direct ? 'private channel' : 'public channel' }</h2><mark>${ direct ? 'ansible' : 'relay' }</mark></header>
                <div class="message-list" role="log" aria-label="channel messages">${ this.thread(c).map(m => this.message(m)) }</div>
                <form class="composer" @submit=${ (e: Event) => this.send(e, c) }>
                    <label class="sr-only" for="message">message</label>
                    <textarea id="message" rows="2" maxlength="500" placeholder=${ blocked || 'send a signal into the ether…' } .value=${ this.draft } ?disabled=${ !!blocked }
                        @input=${ (e: Event) => { this.draft = (e.target as HTMLTextAreaElement).value } }
                        @keydown=${ (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(e, c) } } }></textarea>
                    <button class="send-button" aria-label="send message" ?disabled=${ !!blocked || !this.draft.trim() } type="submit">${ icon('arrow') }</button>
                </form>
                <small class="composer-note">enter to send · shift + enter for a new line</small>
            </section>
        </div>`
    }

    private message(m: MessageRow) {
        const own = m.from === this.session.me?.pid
        const from = own ? 'you' : peerOf(this.session, m.from)?.handle ?? 'a pilot'
        const wait = Date.parse(m.deliver) - this.now
        const status = !m.to
            ? 'station relay'
            : m.delivered || wait <= 0
                ? 'delivered'
                : `in transit · ${ span(wait) }`
        return html`<article class=${ own ? 'message outgoing' : 'message' }>
            <header class="message-meta"><b>${ from }</b><span>${ status }</span></header>
            <p>${ m.body }</p>
        </article>`
    }

    private send(event: Event, c: Contact) {
        event.preventDefault()
        const body = this.draft.trim()
        if (!body || this.blocked(c)) return
        this.draft = ''
        void this.run(() => this.client.send(body.slice(0, 500), c.sid))
        void this.updateComplete.then(() => {
            const list = this.querySelector('.message-list')
            list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
        })
    }

    // ── panel ────────────────────────────────────────────────

    private panel(active: Contact) {
        return html`${ this.panelHeader('communications', 'open channels') }
            <div class="contact-list">${ this.contacts().map(c => html`
                <button class=${ c.id === active.id ? 'contact active' : 'contact' } @click=${ () => { this.contact = c.id; this.draft = '' } }>
                    <span class="contact-avatar ${ c.id === STATION ? '' : 'civil' }">${ c.id === STATION ? icon('comms') : c.name.slice(0, 1) }</span>
                    <span><b>${ c.name }</b><small>${ c.note }</small></span>
                    ${ c.id === STATION ? html`<span data-shape aria-hidden="true" class="status-dot"></span>` : icon('arrow') }
                </button>`) }
            </div>
            <dl>
                <div><dt>fitted transceiver</dt><dd>${ hasAnsible(this.session) ? 'ansible / mk.01' : 'none' }</dd></div>
                <div><dt>station relay</dt><dd class=${ docked(this.session) ? 'mint' : '' }>${ docked(this.session) ? 'available' : 'out of range' }</dd></div>
                <div><dt>private link</dt><dd>${ hasAnsible(this.session) ? 'available' : 'requires module' }</dd></div>
            </dl>
            <div class="notice"><span class="tiny-rule"></span><p><b>messages have a journey.</b><br>a private signal crosses the same distance a ship would, far faster, never instantly.</p></div>
            <button data-variant="secondary" @click=${ () => this.navigate('rig', this.session.fitted.find(f => f.gid.startsWith('ansible.'))?.slot) }>inspect transceiver ${ icon('arrow') }</button>`
    }
}
customElements.define('comms-screen', CommsScreen)
