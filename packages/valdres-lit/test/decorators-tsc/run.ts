// Decorator verification lane.
//
// Bun's transpiler mismaps TC39 accessor-decorator temporaries across classes
// (oven-sh/bun#28316) — including across modules in a bundled test graph — so
// this file is compiled with tsc (whose standard-decorator lowering is
// correct) and the OUTPUT runs under Bun as plain JavaScript:
//
//   bunx tsc -p tsconfig.decorators-test.json && bun <outDir>/.../run.js
//
// Because tsc does the lowering, this file can do what real (Vite/tsc/esbuild)
// consumers do: define MULTIPLE decorated classes in one module.
import { GlobalRegistrator } from "@happy-dom/global-registrator"
GlobalRegistrator.register()
;(globalThis as any).process.env.NODE_ENV = "development"

const { LitElement, html } = await import("lit")
const { atom: defineAtom, selector, store: createStore } = await import(
    "valdres"
)
const { atom, value, provideStore, consumeStore } = await import(
    "../../src/decorators/index"
)
type Store = import("valdres").Store

const countAtom = defineAtom(0)
const doubledSelector = selector(get => get(countAtom) * 2)

class App extends LitElement {
    @provideStore() accessor store!: Store
    render() {
        return html`<slot></slot>`
    }
}
customElements.define("tsc-app", App)

class Counter extends LitElement {
    @atom(countAtom) accessor count!: number | undefined
    @value(doubledSelector) accessor doubled!: number | undefined
    render() {
        return html`<span class="count">${this.count ?? "?"}</span
            ><span class="doubled">${this.doubled ?? "?"}</span>`
    }
}
customElements.define("tsc-counter", Counter)

class Consumer extends LitElement {
    @consumeStore() accessor store: Store | undefined
    render() {
        return html`<span></span>`
    }
}
customElements.define("tsc-consumer", Consumer)

// --- tiny assertion harness -------------------------------------------------
let failures = 0
const check = (name: string, ok: boolean) => {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`)
    if (!ok) failures++
}
const tick = () => new Promise(r => setTimeout(r, 0))
const settle = async (...els: Array<{ updateComplete?: Promise<unknown> }>) => {
    for (let i = 0; i < 4; i++) {
        await tick()
        for (const el of els) if (el?.updateComplete) await el.updateComplete
    }
}

const app = document.createElement("tsc-app") as App
document.body.appendChild(app)
await app.updateComplete

check("@provideStore auto-creates a batched store", !!app.store?.data?.batchUpdates)

const replacement = createStore({ id: "swapped", batchUpdates: true })
app.store = replacement
check("@provideStore assignment swaps the store", app.store.data.id === "swapped")

const counter = document.createElement("tsc-counter") as Counter
app.appendChild(counter)
await settle(app, counter)
check("@atom reads the atom default via context", counter.count === 0)

counter.count = 5
await settle(app, counter)
check("@atom write updates accessor and store",
    counter.count === 5 && app.store.get(countAtom) === 5)

app.store.set(countAtom, 9)
await settle(app, counter)
check("@atom tracks external store updates into the DOM",
    counter.count === 9 &&
        counter.shadowRoot!.querySelector(".count")!.textContent === "9")

counter.count = undefined
await settle(app, counter)
check("@atom undefined write resets to the atom default",
    counter.count === 0 && app.store.get(countAtom) === 0)

app.store.set(countAtom, 9)
await settle(app, counter)
check("@value derives through the selector", counter.doubled === 18)
let valueThrew = false
try {
    ;(counter as any).doubled = 1
} catch {
    valueThrew = true
}
check("@value accessor is read-only", valueThrew)

const consumer = document.createElement("tsc-consumer") as Consumer
app.appendChild(consumer)
await settle(app, consumer)
check("@consumeStore receives the provided store", consumer.store === app.store)
let consumeThrew = false
try {
    ;(consumer as any).store = createStore()
} catch {
    consumeThrew = true
}
check("@consumeStore accessor is read-only", consumeThrew)

console.log(
    failures === 0
        ? "\ndecorators (tsc lane): OK"
        : `\ndecorators (tsc lane): ${failures} FAILED`,
)
if (failures > 0) (globalThis as any).process.exit(1)
