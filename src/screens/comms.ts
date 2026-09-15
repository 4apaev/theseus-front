import { html, nothing } from 'lit'
import { GameScreen } from './base.ts'
import { icon } from '../icons.ts'

class CommsScreen extends GameScreen {
    static properties = { contact: { state: true }, draft: { state: true }, now: { state: true }}
    declare contact: string
    declare draft: string
    declare now: number
    private timer?: ReturnType<typeof setInterval>

    constructor() { super(); this.contact = 'station'; this.draft = ''; this.now = Date.now() }
    override connectedCallback() { super.connectedCallback(); this.timer = setInterval(() => { if (this.active) this.now = Date.now() }, 250) }
    override disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.timer) }
    override render() {
        if (!this.active) return nothing
        return html`<div class="operations"><section class="viewport" aria-label="communications">${ this.renderComms() }</section><app-panel>${ this.commsPanel() }</app-panel></div>`
    }

    private renderComms() {
        const privateChannel = this.contact === 'vesper'
        const blocked = privateChannel && !this.game.fitted.includes('ansible')
        const messages = this.game.messages.filter(m => m.contact === this.contact)
        return html`<div class="comms-workspace"><div class="signal-diagram"><div class="signal-node">${ icon('rig') }<span>your vessel<small>sol outpost</small></span></div><div class="signal-line"><span data-shape aria-hidden="true"></span><span>${ privateChannel ? 'ansible / simulated 8s transit' : 'station relay / immediate' }</span></div><div class="signal-node distant">${ icon(privateChannel ? 'orbit' : 'comms') }<span>${ privateChannel ? 'vesper' : 'station relay' }<small>${ privateChannel ? 'outer depot' : 'local broadcast' }</small></span></div></div>
            <section class="conversation"><header class="conversation-heading"><h2>${ privateChannel ? 'vesper / private channel' : 'sol outpost / public channel' }</h2><mark>simulated</mark></header><div class="message-list" role="log" aria-label="channel messages">${ messages.map(m => html`<article class=${ m.from === 'you' ? 'message outgoing' : 'message' }><header class="message-meta"><b>${ m.from }</b><span>${ m.from === 'you' && m.delivers > this.now ? `in transit · ${ Math.ceil((m.delivers - this.now) / 1000) }s` : m.from === 'you' ? 'delivered locally' : 'received' }</span></header><p>${ m.text }</p></article>`) }</div>
            <form class="composer" @submit=${ this.sendMessage }><label class="sr-only" for="message">message</label><textarea id="message" rows="2" maxlength="500" placeholder=${ blocked ? 'fit an ansible transceiver to open this channel' : 'send a signal into the ether…' } .value=${ this.draft } ?disabled=${ blocked } @input=${ (e: Event) => { this.draft = (e.target as HTMLTextAreaElement).value } } @keydown=${ (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(e) } } }></textarea><button class="send-button" aria-label="send message" ?disabled=${ blocked || !this.draft.trim() } type="submit">${ icon('arrow') }</button></form><small class="composer-note">enter to send · shift + enter for a new line · no network messages are sent</small></section></div>`
    }

    private sendMessage(event: Event) {
        event.preventDefault()
        const text = this.draft.trim()
        if (!text || (this.contact === 'vesper' && !this.game.fitted.includes('ansible'))) return
        const now = Date.now()
        this.now = now
        this.commit({ ...this.game, messages: [ ...this.game.messages, { id: now, contact: this.contact, from: 'you', text: text.slice(0, 500), created: now, delivers: this.contact === 'vesper' ? now + 8000 : now }], log: [ `signal sent · ${ this.contact === 'vesper' ? 'private / in transit' : 'station channel' }`, ...this.game.log ].slice(0, 30) }, 'signal sent locally')
        this.draft = ''
        void this.updateComplete.then(() => { const list = this.querySelector('.message-list'); list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }) })
    }

    private commsPanel() {
        return html`${ this.panelHeader('communications', 'open channels') }
            <div class="contact-list"><button class=${ this.contact === 'station' ? 'contact active' : 'contact' } @click=${ () => { this.contact = 'station'; this.draft = '' } }><span class="contact-avatar">${ icon('comms') }</span><span><b>station channel</b><small>public · local relay</small></span><span data-shape aria-hidden="true" class="status-dot"></span></button><button class=${ this.contact === 'vesper' ? 'contact active' : 'contact' } @click=${ () => { this.contact = 'vesper'; this.draft = '' } }><span class="contact-avatar civil">v</span><span><b>vesper</b><small>private · outer depot</small></span>${ icon('arrow') }</button></div>
            <dl><div><dt>fitted transceiver</dt><dd>${ this.game.fitted.includes('ansible') ? 'ansible / mk.01' : 'none' }</dd></div><div><dt>station relay</dt><dd class="mint">available</dd></div><div><dt>private link</dt><dd>${ this.game.fitted.includes('ansible') ? 'available' : 'requires module' }</dd></div></dl>
            <div class="notice"><span class="tiny-rule"></span><p><b>messages have a journey.</b><br>private signals remain in transit before delivery. this preview compresses that delay to eight seconds.</p></div><button data-variant="secondary" @click=${ () => { this.navigate('rig', 'ansible') } }>inspect transceiver ${ icon('arrow') }</button><small class="footnote">fictional contacts · delivery is simulated locally</small>`
    }
}
customElements.define('comms-screen', CommsScreen)
