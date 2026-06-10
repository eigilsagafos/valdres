import { LitElement, css, html, nothing, type CSSResultGroup } from "lit"
import {
    atom,
    atomFamily,
    selector,
    selectorFamily,
    store as createStore,
} from "valdres"
import { AtomController, ValueController, StoreProvider } from "../src"

// ===========================================================================
// valdres-lit — a capabilities tour.
//
// A documentation-style page: one section per valdres concept, each shown
// through the same small examples the valdres docs use (Counter, Stopwatch,
// UserProfile, RandomDog) — so the library's capabilities are the visible
// star, not a disguised product.
// ===========================================================================

// --- State: the same shapes as the canonical docs snippets -----------------

// Counter / scopes
const countAtom = atom(0, { name: "count" })

// Stopwatch
const timeAtom = atom(0, { name: "time" }) // centiseconds
const isRunningAtom = atom(false, { name: "isRunning" })
const elapsedSelector = selector(get => (get(timeAtom) / 100).toFixed(2), {
    name: "elapsed",
})

// UserProfile (atomFamily + selectorFamily, no network/faker)
type User = {
    id: string
    firstName: string
    lastName: string
    email: string
    hue: number
}
const SAMPLE_USERS: User[] = [
    { id: "u1", firstName: "Ada", lastName: "Lovelace", email: "ada@valdres.dev", hue: 265 },
    { id: "u2", firstName: "Grace", lastName: "Hopper", email: "grace@valdres.dev", hue: 200 },
    { id: "u3", firstName: "Alan", lastName: "Turing", email: "alan@valdres.dev", hue: 330 },
]
const USER_IDS = SAMPLE_USERS.map(u => u.id)
const userAtom = atomFamily<User, [string]>(
    id => SAMPLE_USERS.find(u => u.id === id)!,
    { name: "user" },
)
const userDisplayNameSelector = selectorFamily<string, [string]>(
    id => get => {
        const { firstName, lastName } = get(userAtom(id))
        return `${firstName} ${lastName}`
    },
    { name: "userDisplayName" },
)
const currentUserIdAtom = atom(USER_IDS[0], { name: "currentUserId" })
const currentUserSelector = selector(
    get => get(userAtom(get(currentUserIdAtom))),
    { name: "currentUser" },
)
const currentDisplayNameSelector = selector(
    get => get(userDisplayNameSelector(get(currentUserIdAtom))),
    { name: "currentDisplayName" },
)

// RandomDog (async atom — the canonical valdres async example).
// A small deliberate delay after the response keeps the loading state
// perceptible in the demo; without it a cached/fast reply resolves before the
// spinner ever paints.
const delay = <T>(v: T, ms: number) =>
    new Promise<T>(res => setTimeout(() => res(v), ms))
const randomDogAtom = atom<string>(
    (() =>
        fetch("https://random.dog/woof.json")
            .then(r => r.json())
            .then(b => delay(b.url as string, 650))) as unknown as string,
    { name: "randomDog" },
)

// One batched store, module-scoped so it's easy to drive in tests.
const rootStore = createStore({ batchUpdates: true })

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const base = css`
    :host {
        font-family: var(--vl-font);
        color: var(--vl-ink);
    }
    button {
        font: inherit;
        font-weight: 600;
        padding: 0.45rem 0.85rem;
        border-radius: 9px;
        border: 1px solid var(--vl-line);
        background: var(--vl-surface);
        color: var(--vl-ink);
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease;
    }
    button:hover:not(:disabled) {
        border-color: var(--vl-accent);
        background: var(--vl-accent-soft);
    }
    button.primary {
        background: var(--vl-accent);
        border-color: var(--vl-accent);
        color: #fff;
    }
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .num {
        font-family: var(--vl-mono);
        font-variant-numeric: tabular-nums;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
    }
`

// ---------------------------------------------------------------------------
// §1 Atoms — Counter
// ---------------------------------------------------------------------------

class Counter extends LitElement {
    static styles = base
    private count = new AtomController<number>(this, countAtom)
    render() {
        return html`<div class="row">
            <button @click=${() => this.count.set(c => (c ?? 0) + 1)}>
                Increment
            </button>
            <button @click=${() => this.count.reset()}>Reset</button>
            <span>Current count is <strong class="num">${this.count.value ?? 0}</strong></span>
        </div>`
    }
}
customElements.define("vl-counter", Counter)

// ---------------------------------------------------------------------------
// §2 Derived state — Stopwatch (atom driven live + a selector for display)
// ---------------------------------------------------------------------------

class Stopwatch extends LitElement {
    static styles = base
    private time = new AtomController<number>(this, timeAtom)
    private running = new AtomController<boolean>(this, isRunningAtom)
    private elapsed = new ValueController<string>(this, elapsedSelector)
    private _timer?: ReturnType<typeof setInterval>

    private _toggle() {
        const next = !this.running.value
        this.running.set(next)
        if (next)
            this._timer = setInterval(() => this.time.set(t => (t ?? 0) + 1), 10)
        else this._stop()
    }
    private _stop() {
        if (this._timer) clearInterval(this._timer)
        this._timer = undefined
    }
    private _reset() {
        this._stop()
        this.running.set(false)
        this.time.set(0)
    }
    disconnectedCallback() {
        super.disconnectedCallback()
        this._stop()
    }
    render() {
        return html`<div class="row">
            <button class="primary" @click=${this._toggle}>
                ${this.running.value ? "Stop" : "Start"}
            </button>
            <button @click=${this._reset}>Reset</button>
            <span class="num" style="font-size:1.4rem">${this.elapsed.value ?? "0.00"}</span>
        </div>`
    }
}
customElements.define("vl-stopwatch", Stopwatch)

// ---------------------------------------------------------------------------
// §3 Families & selectors — UserProfile
// ---------------------------------------------------------------------------

class UserProfile extends LitElement {
    static styles = [
        base,
        css`
            .card {
                display: flex;
                align-items: center;
                gap: 0.8rem;
            }
            .avatar {
                width: 44px;
                height: 44px;
                border-radius: 999px;
                display: grid;
                place-items: center;
                color: #fff;
                font-weight: 700;
            }
            .name {
                font-weight: 600;
            }
            .email {
                color: var(--vl-muted);
                font-size: 0.85rem;
            }
            .spacer {
                flex: 1;
            }
        `,
    ] as CSSResultGroup
    private current = new AtomController<string>(this, currentUserIdAtom)
    private user = new ValueController<User>(this, currentUserSelector)
    private name = new ValueController<string>(this, currentDisplayNameSelector)

    private _next() {
        const i = USER_IDS.indexOf(this.current.value ?? USER_IDS[0])
        this.current.set(USER_IDS[(i + 1) % USER_IDS.length])
    }
    render() {
        const u = this.user.value
        const initials = u ? u.firstName[0] + u.lastName[0] : "··"
        return html`<div class="card">
            <div
                class="avatar"
                style="background: linear-gradient(135deg, hsl(${u?.hue ?? 0} 70% 55%), hsl(${(u?.hue ?? 0) + 40} 70% 45%))"
            >
                ${initials}
            </div>
            <div>
                <div class="name">${this.name.value ?? "—"}</div>
                <div class="email">${u?.email ?? ""}</div>
            </div>
            <div class="spacer"></div>
            <button @click=${this._next}>Switch user</button>
        </div>`
    }
}
customElements.define("vl-user-profile", UserProfile)

// ---------------------------------------------------------------------------
// §4 Async atoms — RandomDog (status: pending → ready / error)
// ---------------------------------------------------------------------------

class RandomDog extends LitElement {
    static styles = [
        base,
        css`
            .frame {
                min-height: 200px;
                display: grid;
                place-items: center;
                border: 1px solid var(--vl-line);
                border-radius: 10px;
                background: var(--vl-code-bg);
                overflow: hidden;
                margin-top: 0.7rem;
            }
            img,
            video {
                max-width: 100%;
                max-height: 280px;
                display: block;
            }
            .ring {
                width: 1.6rem;
                height: 1.6rem;
                border-radius: 999px;
                border: 3px solid var(--vl-line);
                border-top-color: var(--vl-accent);
                animation: spin 0.7s linear infinite;
            }
            @keyframes spin {
                to {
                    transform: rotate(1turn);
                }
            }
            .err {
                color: var(--vl-err);
                font-size: 0.9rem;
                padding: 1rem;
                text-align: center;
            }
        `,
    ] as CSSResultGroup
    private dog = new AtomController<string>(this, randomDogAtom)

    render() {
        const status = this.dog.status
        const url = this.dog.value
        const isVideo = url ? /(?:mp4|webm)$/.test(url) : false
        return html`
            <div class="row">
                <button class="primary" @click=${() => this.dog.reset()}>
                    Next dog please!
                </button>
                <span class="num">status: ${status}</span>
            </div>
            <div class="frame">
                ${status === "pending"
                    ? html`<span class="ring"></span>`
                    : status === "error"
                      ? html`<span class="err"
                            >Couldn't fetch a dog (${(this.dog.error as Error)?.message}).
                            The status surface caught it — no crash.</span
                        >`
                      : url
                        ? isVideo
                            ? html`<video src=${url} autoplay loop muted></video>`
                            : html`<img src=${url} alt="a random dog" />`
                        : nothing}
            </div>
        `
    }
}
customElements.define("vl-random-dog", RandomDog)

// ---------------------------------------------------------------------------
// §5 Scoped stores — a root → Team → Project hierarchy over one atom.
// Each level inherits its parent's value (copy-on-write) until it writes its
// own; "unset" (store.del) drops the override and it inherits again.
// ---------------------------------------------------------------------------

const scopeCounter = atom(0, { name: "scopeCounter" })

const cellStyles = css`
    .cell {
        border: 1px solid var(--vl-line);
        border-left: 3px solid
            color-mix(in oklch, var(--vl-accent) 60%, transparent);
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
        background: var(--vl-surface);
    }
    .head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }
    .label {
        font:
            600 0.78rem var(--vl-mono);
        color: var(--vl-muted);
    }
    .val {
        font-family: var(--vl-mono);
        font-size: 1.25rem;
        font-weight: 700;
        margin-left: auto;
    }
    .src {
        font-size: 0.72rem;
        color: var(--vl-muted);
        margin-left: 0.4rem;
    }
    .controls {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.4rem;
    }
    button {
        padding: 0.3rem 0.7rem;
        font-size: 0.85rem;
    }
    .nest {
        margin-top: 0.7rem;
    }
    ::slotted(*) {
        display: block;
    }
`

const renderCell = (opts: {
    label: string
    value: number
    srcText: string
    onInc: () => void
    onUnset?: () => void
    unsetDisabled?: boolean
}) => html`<div class="cell">
    <div class="head">
        <span class="label">${opts.label}</span>
        <span class="val">${opts.value}</span>
        <span class="src">${opts.srcText}</span>
    </div>
    <div class="controls">
        <button @click=${opts.onInc}>increment</button>
        ${opts.onUnset
            ? html`<button @click=${opts.onUnset} ?disabled=${opts.unsetDisabled}>
                  unset
              </button>`
            : nothing}
    </div>
    <div class="nest"><slot></slot></div>
</div>`

// The scope chain, created once. A scope reads its parent's value until it
// writes its own (copy-on-write).
const teamScope = rootStore.scope("team")
const projectScope = teamScope.scope("project")

// One level of the hierarchy, bound to an explicit store and authored as nested
// HTML so the DOM nesting mirrors the store nesting:
//   <vl-scope-cell .store=${rootStore} root>
//     <vl-scope-cell .store=${teamScope}>
//       <vl-scope-cell .store=${projectScope}></vl-scope-cell>
//     </vl-scope-cell>
//   </vl-scope-cell>
class ScopeCell extends LitElement {
    static properties = {
        label: {},
        store: { attribute: false },
        root: { type: Boolean },
    }
    declare label: string
    declare store: ReturnType<typeof createStore>
    declare root: boolean
    static styles = [base, cellStyles] as CSSResultGroup
    private ctrl?: AtomController<number>

    willUpdate() {
        if (!this.ctrl && this.store)
            this.ctrl = new AtomController<number>(
                this,
                scopeCounter,
                this.store,
            )
    }
    render() {
        if (!this.ctrl) return nothing
        const owns = this.store.data.values.has(scopeCounter)
        return renderCell({
            label: this.label,
            value: this.ctrl.value ?? 0,
            srcText: this.root ? "root" : owns ? "own value" : "inherited",
            onInc: () => this.ctrl!.set(c => (c ?? 0) + 1),
            onUnset: this.root
                ? undefined
                : () => {
                      // del drops this scope's own value → it falls back to
                      // shadowing its parent. (reset() returns it to the atom's
                      // default instead.)
                      ;(this.store as any).del(scopeCounter)
                      this.requestUpdate()
                  },
            unsetDisabled: !owns,
        })
    }
}
customElements.define("vl-scope-cell", ScopeCell)

// ---------------------------------------------------------------------------
// <valdres-lit-docs> — the page shell (StoreProvider + sections)
// ---------------------------------------------------------------------------

const CODE = {
    atom: `const countAtom = atom(0)

class Counter extends LitElement {
  #count = new AtomController(this, countAtom)
  render() {
    return html\`<button
      @click=\${() => this.#count.set(c => c + 1)}
    >\${this.#count.value}</button>\`
  }
}`,
    derived: `const timeAtom = atom(0)
const elapsed = selector(get => (get(timeAtom) / 100).toFixed(2))

// ValueController re-renders only when the selector's result changes.
#elapsed = new ValueController(this, elapsed)`,
    family: `const userAtom = atomFamily(id => USERS[id])
const userName = selectorFamily(id => get => {
  const { firstName, lastName } = get(userAtom(id))
  return \`\${firstName} \${lastName}\`
})

// a selector keyed by another atom:
const currentName = selector(get =>
  get(userName(get(currentUserIdAtom))))`,
    async: `const randomDog = atom(() =>
  fetch("https://random.dog/woof.json")
    .then(r => r.json()).then(b => b.url))

#dog = new AtomController(this, randomDog)
// .status walks "pending" → "ready" | "error"; .reset() refetches`,
    scope: `// A scope forks a child store; it reads its parent's value
// until it writes its own (copy-on-write). Nest them freely:
const team = rootStore.scope("team")
const project = team.scope("project")

project.get(counter)    // inherited: root → team → project
project.set(counter, n) // copy-on-write: shadows for this subtree only
project.del(counter)    // unset → inherit from the parent again

// (In components, ScopeController provides a scope to a subtree via
//  @lit/context; here the chain is explicit so the nesting is clear.)`,
}

class Docs extends LitElement {
    private _provider = new StoreProvider(this, rootStore)

    static styles = [
        base,
        css`
            main {
                max-width: 48rem;
                margin: 0 auto;
                padding: 0 1.25rem 5rem;
            }
            header {
                padding: 3.5rem 0 1.5rem;
                border-bottom: 1px solid var(--vl-line);
            }
            .kicker {
                font:
                    600 0.78rem var(--vl-mono);
                color: var(--vl-accent);
                letter-spacing: 0.04em;
            }
            h1 {
                font-size: 2.3rem;
                margin: 0.4rem 0 0.5rem;
                letter-spacing: -0.01em;
            }
            .lede {
                color: var(--vl-muted);
                font-size: 1.05rem;
                margin: 0;
            }
            .install {
                margin-top: 1.1rem;
                font:
                    0.85rem var(--vl-mono);
                background: var(--vl-code-bg);
                border: 1px solid var(--vl-line);
                border-radius: 8px;
                padding: 0.5rem 0.8rem;
                display: inline-block;
            }
            section {
                padding: 2.2rem 0;
                border-bottom: 1px solid var(--vl-line);
            }
            h2 {
                font-size: 1.25rem;
                margin: 0 0 0.3rem;
            }
            h2 .pill {
                font:
                    600 0.68rem var(--vl-mono);
                color: var(--vl-accent);
                background: var(--vl-accent-soft);
                padding: 0.12rem 0.5rem;
                border-radius: 999px;
                vertical-align: middle;
                margin-left: 0.5rem;
            }
            .desc {
                color: var(--vl-muted);
                margin: 0 0 1rem;
            }
            pre {
                background: var(--vl-code-bg);
                border: 1px solid var(--vl-line);
                border-radius: 10px;
                padding: 0.9rem 1rem;
                overflow: auto;
                font:
                    0.82rem/1.55 var(--vl-mono);
                margin: 0 0 1rem;
            }
            .example {
                border: 1px solid var(--vl-line);
                border-left: 3px solid var(--vl-accent);
                border-radius: 10px;
                padding: 1.1rem 1.2rem;
                background: var(--vl-surface);
                position: relative;
            }
            .example::before {
                content: "LIVE";
                position: absolute;
                top: 0.6rem;
                right: 0.8rem;
                font:
                    700 0.62rem var(--vl-mono);
                letter-spacing: 0.12em;
                color: var(--vl-muted);
            }
            .grid2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.8rem;
            }
            @media (max-width: 560px) {
                .grid2 {
                    grid-template-columns: 1fr;
                }
            }
            footer {
                padding: 2rem 0;
                color: var(--vl-muted);
                font-size: 0.85rem;
            }
            a {
                color: var(--vl-accent);
            }
        `,
    ] as CSSResultGroup

    private _section(
        n: number,
        title: string,
        primitive: string,
        desc: unknown,
        code: string,
        example: unknown,
    ) {
        return html`<section>
            <h2>${n}. ${title} <span class="pill">${primitive}</span></h2>
            <p class="desc">${desc}</p>
            <pre><code>${code}</code></pre>
            <div class="example">${example}</div>
        </section>`
    }

    render() {
        return html`
            <main>
                <header>
                    <div class="kicker">valdres-lit</div>
                    <h1>Reactive valdres state for Lit</h1>
                    <p class="lede">
                        valdres-lit binds valdres atoms and selectors to Lit
                        through <code>ReactiveController</code>s — the same
                        primitive <code>@lit/task</code> uses. Each section below
                        is one capability, shown with the example from the
                        valdres docs, running live.
                    </p>
                    <div class="install">npm i valdres-lit lit @lit/context</div>
                </header>

                ${this._section(
                    1,
                    "Atoms",
                    "AtomController",
                    html`An atom is a unit of state.
                    <code>AtomController</code> binds one to a host and gives you
                    <code>.value</code>, <code>.set(value | updater)</code> and
                    <code>.reset()</code>.`,
                    CODE.atom,
                    html`<vl-counter></vl-counter>`,
                )}
                ${this._section(
                    2,
                    "Derived state",
                    "ValueController + selector",
                    html`A selector derives from atoms (and other selectors) and
                    recomputes automatically. Here a 10ms timer drives
                    <code>timeAtom</code>; <code>elapsed</code> formats it, and
                    <code>ValueController</code> re-renders only when the
                    formatted value changes.`,
                    CODE.derived,
                    html`<vl-stopwatch></vl-stopwatch>`,
                )}
                ${this._section(
                    3,
                    "Families & composed selectors",
                    "atomFamily · selectorFamily",
                    html`<code>atomFamily</code> makes per-key atoms;
                    <code>selectorFamily</code> derives per key. A plain selector
                    keyed by <code>currentUserIdAtom</code> looks up the right
                    family member — switch the user and the derived name + avatar
                    follow.`,
                    CODE.family,
                    html`<vl-user-profile></vl-user-profile>`,
                )}
                ${this._section(
                    4,
                    "Async atoms",
                    "AtomController.status",
                    html`An atom can resolve a Promise. <code>.status</code>
                    reports <code>pending → ready</code> (or
                    <code>error</code>) with no first-render throw, and
                    <code>.reset()</code> refetches. (Needs network; offline it
                    lands in the error state — which is the point.)`,
                    CODE.async,
                    html`<vl-random-dog></vl-random-dog>`,
                )}
                ${this._section(
                    5,
                    "Scoped stores",
                    "store.scope()",
                    html`<code>store.scope(id)</code> forks a child store, nested
                    here as <code>root → Team → Project</code> over one
                    <code>scopeCounter</code>. A level shows its parent's value
                    until you write its own (copy-on-write), and
                    <code>unset</code> drops that override so it
                    <em>inherits again</em>. Increment <strong>Root</strong> and
                    the inherited levels follow; increment a child and it breaks
                    away; unset it to re-join. (In components,
                    <code>ScopeController</code> provides a scope to a subtree via
                    context.)`,
                    CODE.scope,
                    html`<vl-scope-cell label="Root store" .store=${rootStore} root>
                        <vl-scope-cell label="Team scope" .store=${teamScope}>
                            <vl-scope-cell
                                label="Project scope"
                                .store=${projectScope}
                            ></vl-scope-cell>
                        </vl-scope-cell>
                    </vl-scope-cell>`,
                )}

                <footer>
                    One store, a handful of controllers, zero prop-drilling.
                    More at <a href="https://valdres.dev">valdres.dev</a>.
                </footer>
            </main>
        `
    }
}
customElements.define("valdres-lit-docs", Docs)
