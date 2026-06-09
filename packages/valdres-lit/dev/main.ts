import { LitElement, css, html } from "lit"
import { atom, selector, store as createStore } from "valdres"
import {
    AtomController,
    ValueController,
    ScopeController,
    StoreProvider,
} from "../src"

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const countAtom = atom(0, { name: "count" })
const doubledSelector = selector(get => get(countAtom) * 2, { name: "doubled" })
const paritySelector = selector(
    get => (get(countAtom) % 2 === 0 ? "even" : "odd"),
    { name: "parity" },
)

// A writable atom that holds an async value, so AtomController.status can walk
// pending → ready → error as we re-fetch.
const makeRequest = (label: string) =>
    new Promise<string>((resolve, reject) => {
        setTimeout(() => {
            if (label === "fail") reject(new Error("simulated 500"))
            else resolve(`payload @ ${new Date().toLocaleTimeString()}`)
        }, 700)
    })
const dataAtom = atom<string>(makeRequest("ok") as unknown as string, {
    name: "data",
})

// The root store is module-scoped so demo buttons can mutate it directly
// (e.g. while a component is detached, to prove reconnection re-subscribes).
const rootStore = createStore({ batchUpdates: true })

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const card = css`
    .card {
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        border-radius: 0.5rem;
        padding: 1rem 1.25rem;
        margin: 1rem 0;
    }
    h3 {
        margin: 0 0 0.5rem;
    }
    .sub {
        color: color-mix(in srgb, currentColor 60%, transparent);
        font-size: 0.85rem;
        margin: 0.25rem 0 0.75rem;
    }
    button {
        font: inherit;
        padding: 0.35rem 0.7rem;
        margin-right: 0.35rem;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        border-radius: 0.35rem;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    button:hover {
        background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .value {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 1.4rem;
        display: inline-block;
        min-width: 2.5rem;
        text-align: center;
    }
    .pill {
        display: inline-block;
        padding: 0.1rem 0.55rem;
        border-radius: 999px;
        font-size: 0.8rem;
        background: color-mix(in srgb, currentColor 12%, transparent);
    }
    .pill-ready {
        background: color-mix(in srgb, #22c55e 25%, transparent);
    }
    .pill-error {
        background: color-mix(in srgb, #ef4444 25%, transparent);
    }
    .pill-pending {
        background: color-mix(in srgb, #eab308 25%, transparent);
    }
`

// ---------------------------------------------------------------------------
// <vl-counter> — AtomController (read + write)
// ---------------------------------------------------------------------------

class Counter extends LitElement {
    static styles = card
    private count = new AtomController<number>(this, countAtom)

    render() {
        return html`
            <button @click=${() => this.count.set(n => (n ?? 0) - 1)}>−</button>
            <span class="value">${this.count.value ?? 0}</span>
            <button @click=${() => this.count.set(n => (n ?? 0) + 1)}>+</button>
            <button @click=${() => this.count.reset()}>reset</button>
        `
    }
}
customElements.define("vl-counter", Counter)

// ---------------------------------------------------------------------------
// <vl-derived> — ValueController over selectors
// ---------------------------------------------------------------------------

class Derived extends LitElement {
    static styles = card
    private doubled = new ValueController<number>(this, doubledSelector)
    private parity = new ValueController<string>(this, paritySelector)

    render() {
        return html`
            <div class="card">
                <h3>Derived state — <code>ValueController</code></h3>
                <p class="sub">Two selectors recomputed from the same atom.</p>
                doubled = <span class="value">${this.doubled.value ?? 0}</span>
                <span class="pill">${this.parity.value ?? "—"}</span>
            </div>
        `
    }
}
customElements.define("vl-derived", Derived)

// ---------------------------------------------------------------------------
// <vl-async> — AtomController.status (pending / ready / error)
// ---------------------------------------------------------------------------

class AsyncPanel extends LitElement {
    static styles = card
    private data = new AtomController<string>(this, dataAtom)

    private _reload(label: string) {
        this.data.set(makeRequest(label) as unknown as string)
    }

    render() {
        const status = this.data.status
        return html`
            <div class="card">
                <h3>Async state — <code>AtomController.status</code></h3>
                <p class="sub">
                    Setting the atom to a Promise drives status through
                    <code>pending → ready</code> (or <code>error</code>) without
                    throwing on first render.
                </p>
                <div>
                    <span class="pill pill-${status}">${status}</span>
                    ${status === "ready"
                        ? html`<code>${this.data.value}</code>`
                        : status === "error"
                          ? html`<code>${(this.data.error as Error)?.message}</code>`
                          : html`<code>loading…</code>`}
                </div>
                <div style="margin-top:0.75rem">
                    <button @click=${() => this._reload("ok")}>reload</button>
                    <button @click=${() => this._reload("fail")}>
                        reload (fail)
                    </button>
                </div>
            </div>
        `
    }
}
customElements.define("vl-async", AsyncPanel)

// ---------------------------------------------------------------------------
// <vl-scope> — ScopeController isolates the same atom per subtree
// ---------------------------------------------------------------------------

class ScopedPanel extends LitElement {
    static styles = card
    static properties = { scopeId: {} }
    declare scopeId: string
    private scope?: ScopeController

    connectedCallback() {
        super.connectedCallback()
        if (!this.scope) this.scope = new ScopeController(this, this.scopeId)
    }

    render() {
        return html`
            <div class="card">
                <h3>scope: <code>${this.scopeId}</code></h3>
                <vl-counter></vl-counter>
            </div>
        `
    }
}
customElements.define("vl-scoped-panel", ScopedPanel)

class ScopeDemo extends LitElement {
    static styles = card
    render() {
        return html`
            <div class="card">
                <h3>Scoped stores — <code>ScopeController</code></h3>
                <p class="sub">
                    Each panel scopes the <em>same</em> <code>countAtom</code>,
                    so they count independently of each other and of the root
                    counter above.
                </p>
                <vl-scoped-panel scopeId="panel-a"></vl-scoped-panel>
                <vl-scoped-panel scopeId="panel-b"></vl-scoped-panel>
            </div>
        `
    }
}
customElements.define("vl-scope-demo", ScopeDemo)

// ---------------------------------------------------------------------------
// <vl-reconnect> — proves the controller re-subscribes after re-parenting
// ---------------------------------------------------------------------------

class ReconnectDemo extends LitElement {
    static styles = card
    static properties = { _attached: { state: true } }
    private _counter = document.createElement("vl-counter")
    declare _attached: boolean

    constructor() {
        super()
        this._attached = true
    }

    firstUpdated() {
        this.renderRoot.querySelector(".slot")!.appendChild(this._counter)
    }

    private _toggle() {
        const slot = this.renderRoot.querySelector(".slot")!
        if (this._attached) this._counter.remove()
        else slot.appendChild(this._counter)
        this._attached = !this._attached
    }

    render() {
        return html`
            <div class="card">
                <h3>Reconnect — re-parenting keeps reacting</h3>
                <p class="sub">
                    Detach the counter, bump the store while it's gone, then
                    re-attach: it shows the current value and keeps updating —
                    the controller re-subscribes on <code>hostConnected</code>.
                </p>
                <button @click=${this._toggle}>
                    ${this._attached ? "Detach" : "Re-attach"} counter
                </button>
                <button @click=${() => rootStore.set(countAtom, n => n + 1)}>
                    increment store
                </button>
                <div class="slot" style="margin-top:0.75rem"></div>
            </div>
        `
    }
}
customElements.define("vl-reconnect", ReconnectDemo)

// ---------------------------------------------------------------------------
// <vl-app> — StoreProvider at the root
// ---------------------------------------------------------------------------

class App extends LitElement {
    static styles = card
    // Provide the module-scoped store to every descendant via context.
    private _provider = new StoreProvider(this, rootStore)

    render() {
        return html`
            <div class="card">
                <h3>Root counter — <code>AtomController</code></h3>
                <p class="sub">
                    <code>.set(updater)</code> / <code>.reset()</code>, shared by
                    every root-level component below.
                </p>
                <vl-counter></vl-counter>
            </div>
            <vl-derived></vl-derived>
            <vl-async></vl-async>
            <vl-scope-demo></vl-scope-demo>
            <vl-reconnect></vl-reconnect>
        `
    }
}
customElements.define("vl-app", App)
