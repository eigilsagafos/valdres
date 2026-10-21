import { createRoot } from "react-dom/client"
import { Provider } from "valdres-react"
import { docsStore, countAtom } from "./shared-store"
import { ReactCounter } from "./react-counter"
import { mountKeyboardDemo } from "./landing-keyboard"
import { mountOnlineDemo } from "./landing-online"
import { mountLocationDemo } from "./landing-location"
import { mountV1Unavailable } from "./unavailable"

// The Vue, Svelte, Solid and Angular adapters are not migrated to Valdres v1,
// so their cards show a notice and their islands (vue-counter.ts,
// svelte-counter.ts, solid-counter.ts, angular-counter.ts) stay out of this
// bundle.

// Mount React island
const reactRoot = document.getElementById("react-island")
if (reactRoot) {
    createRoot(reactRoot).render(
        <Provider store={docsStore}>
            <ReactCounter />
        </Provider>,
    )
}

for (const [id, key] of [
    ["vue-island", "valdres-vue"],
    ["svelte-island", "valdres-svelte"],
    ["solid-island", "valdres-solid"],
    ["angular-island", "valdres-angular"],
] as const) {
    const el = document.getElementById(id)
    if (el) mountV1Unavailable(el, key, { compact: true })
}

// Mount keyboard island
const keyboardRoot = document.getElementById("landing-keyboard-island")
if (keyboardRoot) {
    keyboardRoot.innerHTML = ""
    mountKeyboardDemo(keyboardRoot)
}

// Mount online island
const onlineRoot = document.getElementById("landing-online-island")
if (onlineRoot) {
    onlineRoot.innerHTML = ""
    mountOnlineDemo(onlineRoot)
}

// Location island
const locationRoot = document.getElementById("landing-location-island")
if (locationRoot) {
    locationRoot.innerHTML = ""
    mountLocationDemo(locationRoot)
}

// Prevent text selection on rapid clicks
document.querySelectorAll(".island-card").forEach(card => {
    card.addEventListener("mousedown", e => e.preventDefault())
})

// Wire up reset button
document.getElementById("demo-reset")?.addEventListener("click", () => {
    docsStore.set(countAtom, 0)
})
