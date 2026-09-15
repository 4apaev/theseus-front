import { LitElement, html } from 'lit'

/**
 * Surface boundary;
 * content uses the same native headings,
 * fields, and forms as the page.
 */
class AppPanel extends LitElement {
    override render() {
        return html`<aside><slot></slot></aside>`
    }
}
customElements.define('app-panel', AppPanel)
