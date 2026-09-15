import {
    html,
    nothing,
    type TemplateResult,
} from 'lit'

import { icon } from '../icons.ts'
import { number } from '../util.ts'

type Content = TemplateResult | string | number

export interface ButtonOptions {
    label: string
    icon?: string
    title?: string
    class?: string
    variant?: 'primary' | 'secondary' | 'icon' | 'text'
    disabled?: boolean
    click: (event: MouseEvent) => void
}

// Template components retain native button behavior, focus, and accessible names.
export function button(options: ButtonOptions, content: Content = options.label) {
    const { click, label, disabled, title, variant = 'secondary' } = options
    return html`
    <button
        type=button
        class=${ options.class ?? nothing }
        data-variant=${ variant }
        aria-label=${ label }
        title=${ title ?? nothing }
       ?disabled=${ disabled }
       @click=${ click }
    >${ variant === 'icon'
        ? nothing
        : content }${
        options.icon
            ? icon(options.icon)
            : nothing }
    </button>`
}

export function iconButton(name: string, label: string, click: () => void) {
    return button({ label, icon: name, variant: 'icon', click })
}

export function panelHeader(kicker: string, title: string, badge = '') {
    return html`
    <header class="panel-heading">
        <small data-kicker>${ kicker }</small>${
            badge
                ? html`<mark>${ badge }</mark>`
                : nothing }
        <h2>${ title }</h2>
    </header>`
}

export interface RangeOptions {
    id: string
    label: string
    unit?: string
    step?: number
    min: number
    max: number
    value: number
    signed?: boolean
    change: (value: number) => void
}

export function rangeField(options: RangeOptions) {
    const { id, label, value, min, max, step = 0.01, unit = '', signed, change } = options
    return html`
    <div class="burn-control">
        <label for=${ id }>${ label }
            <output for=${ id }>${ signed && value > 0 ? '+' : '' }${ number(value, step >= 1 ? 0 : 2) }
                <small>${ unit }</small>
            </output>
        </label>
        <input
            id=${ id }
            type="range"
            min=${ min }
            max=${ max }
            step=${ step }
            .value=${ String(value) }
            @input=${ (e: Event) => change((e.target as HTMLInputElement).valueAsNumber) }
        >
    </div>`
}

export function fieldLabel(id: string, label: string, hint = '') {
    return html`
        <label for=${ id }>${ label }${ hint ? html`<small>${ hint }</small>` : nothing }</label>`
}

export interface SelectOptions {
    id: string
    label: string
    value: string
    options: { value: string, label: string }[]
    change: (value: string) => void
}

export function selectField(options: SelectOptions) {
    const { id, label, value, change } = options
    return html`${ fieldLabel(id, label) }
    <select
        id=${ id }
        @change=${ (e: Event) => change((e.target as HTMLSelectElement).value) }
    >${ options.options.map(option => html`
        <option
            value=${ option.value }
            .selected=${ value === option.value }
        >${ option.label }</option>`) }
    </select>`
}
