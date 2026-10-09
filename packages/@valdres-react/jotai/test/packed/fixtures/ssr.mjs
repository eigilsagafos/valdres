// Server rendering without a DOM.
import { strict as assert } from "node:assert"
import { createElement as h } from "react"
import { renderToString } from "react-dom/server"
import { atom, createStore, Provider, useAtom, useAtomValue } from "@valdres-react/jotai"

assert.equal(typeof globalThis.document, "undefined")
const count = atom(1)
const label = atom(get => `count ${get(count)}`)
let mounted = 0
count.onMount = () => {
    mounted++
}
const View = () => {
    const [value] = useAtom(count)
    return h("p", null, `${useAtomValue(label)} / ${value}`)
}
const store = createStore()
store.set(count, 3)
assert.equal(renderToString(h(Provider, { store }, h(View))), "<p>count 3 / 3</p>")
assert.equal(renderToString(h(Provider, null, h(View))), "<p>count 1 / 1</p>")
assert.equal(mounted, 0, "server rendering does not mount atoms")
console.log("SSR_OK")
