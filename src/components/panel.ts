import { LitElement, html, css } from 'lit'
import { icon } from '../icons.ts'

/**
 * Surface boundary; content uses the same native headings,
 * fields, and forms as the page. Collapses to a handle so the
 * scene behind it can take the room back.
 */
class AppPanel extends LitElement {
    static properties = { collapsed: { type: Boolean, reflect: true }}
    declare collapsed: boolean

    static styles = css`
        :host {
            display: block;
            width: var(--panel-width);
            transition: width 220ms ease;
            position: relative;
        }

        :host([collapsed]) {
            width: 2.5rem;
            overflow: hidden;
        }

        /* below this width .operations stacks to one column; the panel fills it, not a fixed rail width. */
        @media (max-width: 56.25rem) {
            :host {
                width: 100%;
            }

            :host([collapsed]) {
                width: 2.5rem;
            }
        }

        .panel-handle {
            position: absolute;
            top: 50%;
            left: -1.1875rem;
            transform: translateY(-50%);
            width: 1.25rem;
            height: 2.75rem;
            display: grid;
            place-items: center;
            border: var(--stroke) solid var(--line);
            border-right: 0;
            border-radius: 0.5rem 0 0 0.5rem;
            background: var(--panel);
            color: var(--muted);
            cursor: pointer;
            z-index: 1;

            & svg {
                width: 0.75rem;
                height: 0.75rem;
            }

            &:hover {
                color: var(--cream);
            }
        }

        :host([collapsed]) .panel-handle svg {
            transform: rotate(180deg);
        }

        .panel-body {
            display: block;
        }

        :host([collapsed]) .panel-body {
            display: none;
        }
    `

    constructor() {
        super()
        this.collapsed = false
    }

    private toggle() { this.collapsed = !this.collapsed }

    override render() {
        return html`
            <button class="panel-handle" aria-label=${ this.collapsed ? 'expand panel' : 'collapse panel' } @click=${ () => this.toggle() }>${ icon('arrow') }</button>
            <aside class="panel-body"><slot></slot></aside>`
    }
}
customElements.define('app-panel', AppPanel)
