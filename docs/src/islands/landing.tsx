import { createRoot } from "react-dom/client"
import { Provider } from "valdres-react"
import { docsStore, countAtom } from "./shared-store"
import { ReactCounter } from "./react-counter"
import { mountVueCounter } from "./vue-counter"
import { mountSvelteCounter } from "./svelte-counter"
import { mountSolidCounter } from "./solid-counter"
import { mountAngularCounter } from "./angular-counter"

// Mount React island
const reactRoot = document.getElementById("react-island")
if (reactRoot) {
    createRoot(reactRoot).render(
        <Provider store={docsStore}>
            <ReactCounter />
        </Provider>,
    )
}

// Mount Vue island
const vueRoot = document.getElementById("vue-island")
if (vueRoot) {
    mountVueCounter(vueRoot)
}

// Mount Svelte island
const svelteRoot = document.getElementById("svelte-island")
if (svelteRoot) {
    mountSvelteCounter(svelteRoot)
}

// Mount Solid island
const solidRoot = document.getElementById("solid-island")
if (solidRoot) {
    mountSolidCounter(solidRoot)
}

// Mount Angular island
const angularRoot = document.getElementById("angular-island")
if (angularRoot) {
    mountAngularCounter(angularRoot)
}

// Prevent text selection on rapid clicks
document.querySelectorAll(".island-card").forEach(card => {
    card.addEventListener("mousedown", e => e.preventDefault())
})

// Wire up reset button
document.getElementById("demo-reset")?.addEventListener("click", () => {
    docsStore.set(countAtom, 0)
})

// Also wire up all theme toggles on the page to use the valdres store
import {
    userSelectedColorModeAtom,
    colorModeSelector,
    type UserSelectedColorMode,
} from "@valdres/color-mode"

document.querySelectorAll("#theme-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
        const current = docsStore.get(colorModeSelector)
        const next: UserSelectedColorMode = current === "dark" ? "light" : "dark"
        docsStore.set(userSelectedColorModeAtom, next)
        localStorage.setItem("theme", next)
    })
})
