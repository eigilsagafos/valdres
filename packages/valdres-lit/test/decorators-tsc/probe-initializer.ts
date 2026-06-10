// Throwaway probe: what happens when an accessor decorated with @atom /
// @provideStore is given an initializer (which the docs forbid)?
import { GlobalRegistrator } from "@happy-dom/global-registrator"
GlobalRegistrator.register()
;(globalThis as any).process.env.NODE_ENV = "development"

const { LitElement, html } = await import("lit")
const { atom: defineAtom, store: createStore } = await import("valdres")
const { atom, provideStore, value, consumeStore } = await import(
    "../../src/decorators/index"
)
type Store = import("valdres").Store

const countAtom = defineAtom(0)
const myStore = createStore({ id: "explicit" })

const warnings: string[] = []
const origWarn = console.warn
console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "))
    origWarn(...args)
}

class App extends LitElement {
    // Forbidden initializer: looks like it provides myStore
    @provideStore() accessor store: Store = myStore
    @atom(countAtom) accessor count: number | undefined = 42
    render() {
        return html`<span>${this.count}</span>`
    }
}
customElements.define("probe-app", App)

// Do @value / @consumeStore initializers throw via their throwing setters?
let valueInitThrew = false
class V extends LitElement {
    @value(countAtom) accessor v: number | undefined = 7
}
let consumeInitThrew = false
class CS extends LitElement {
    @consumeStore() accessor store: Store = myStore
}
customElements.define("probe-v", V)
customElements.define("probe-cs", CS)

const app = document.createElement("probe-app") as App
document.body.appendChild(app)
await app.updateComplete

console.log("provided store id:", (app.store as any)?.data?.id)
console.log("store === myStore:", app.store === myStore)
console.log("count accessor:", app.count)
console.log("atom value in provided store:", app.store.get(countAtom))
console.log("warnings emitted:", warnings.length)

try {
    const v = document.createElement("probe-v") as V
    document.body.appendChild(v)
    await (v as any).updateComplete
    console.log("@value with initializer: no throw, v =", v.v)
} catch (e) {
    valueInitThrew = true
    console.log("@value with initializer threw:", (e as Error).message)
}
try {
    const cs = document.createElement("probe-cs") as CS
    document.body.appendChild(cs)
    await (cs as any).updateComplete
    console.log("@consumeStore with initializer: no throw, store =", cs.store)
} catch (e) {
    consumeInitThrew = true
    console.log("@consumeStore with initializer threw:", (e as Error).message)
}
console.log("valueInitThrew:", valueInitThrew, "consumeInitThrew:", consumeInitThrew)
