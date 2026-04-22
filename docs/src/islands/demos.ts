import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { mountCounterDemo } from "./demos/counter"
import { mountDerivedDemo } from "./demos/derived"
import { mountResetCounterDemo } from "./demos/reset-counter"
import { mountSetterDemo } from "./demos/setter"
import { mountValueDisplayDemo } from "./demos/value-display"
import { mountTodoListDemo } from "./demos/todo-list"
import { mountFamilyDemo } from "./demos/family"
import { CacheDemo } from "./demos/cache-demo"

// Demos mounted into inline MDX elements (by element ID)
const inlineDemos: Record<string, (el: HTMLElement) => void> = {
    "cache-demo": (el) => {
        createRoot(el).render(createElement(CacheDemo))
    },
}

// Demos mounted into the generic #api-demo at the bottom of the page
const demoMap: Record<string, (el: HTMLElement) => void> = {
    selector: mountDerivedDemo,
    atomFamily: mountTodoListDemo,
    selectorFamily: mountFamilyDemo,
    store: mountCounterDemo,

    // React
    useAtom: mountCounterDemo,
    useValue: mountValueDisplayDemo,
    useSetAtom: mountSetterDemo,
    useResetAtom: mountResetCounterDemo,

    // Vue
    createValdres: mountCounterDemo,

    // Svelte
    readable: mountValueDisplayDemo,
    watch: mountValueDisplayDemo,

    // Solid
    createAtom: mountCounterDemo,
    createValue: mountValueDisplayDemo,
    createSetAtom: mountSetterDemo,
    createResetAtom: mountResetCounterDemo,

    // Angular
    injectAtom: mountCounterDemo,
    injectValue: mountValueDisplayDemo,
    injectSetAtom: mountSetterDemo,
    injectResetAtom: mountResetCounterDemo,
}

function mountDemos() {
    // Mount inline demos by element ID
    for (const [id, mountFn] of Object.entries(inlineDemos)) {
        const el = document.getElementById(id)
        if (el) {
            el.innerHTML = ""
            mountFn(el)
        }
    }

    // Mount generic demo at #api-demo
    const el = document.getElementById("api-demo")
    if (!el) return
    el.innerHTML = ""
    const path = window.location.pathname.replace(/\/$/, "")
    const apiName = path.split("/").pop()
    if (apiName && demoMap[apiName]) {
        demoMap[apiName](el)
    }
}

// Mount on initial load
mountDemos()

// Re-mount after client-side navigation
document.addEventListener("valdres:navigate", mountDemos)
