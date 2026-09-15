import { LitElement } from 'lit'

/** Shared document styles and native label/form relationships across composed views. */
export class AppElement extends LitElement {
    override createRenderRoot() { return this }
}
