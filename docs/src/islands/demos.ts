import { mountCounterDemo } from "./demos/counter"
import { mountDerivedDemo } from "./demos/derived"
import { mountResetCounterDemo } from "./demos/reset-counter"
import { mountSetterDemo } from "./demos/setter"
import { mountValueDisplayDemo } from "./demos/value-display"
import { mountTodoListDemo } from "./demos/todo-list"
import { mountFamilyDemo } from "./demos/family"
import { pluginDemos } from "./plugins/registry"
import { mountV1Unavailable, type V1UnavailableKey } from "./unavailable"

/**
 * Mounts a demo into its placeholder. A demo that subscribes or creates a Store
 * returns a cleanup; mountDemos runs every cleanup before the next navigation
 * mounts, so a page you leave keeps no subscriptions or Stores alive.
 */
type MountDemo = (el: HTMLElement) => void | (() => void)

const unavailable =
    (key: V1UnavailableKey): MountDemo =>
    el =>
        mountV1Unavailable(el, key)

// Demos mounted into inline MDX elements (by element ID)
const inlineDemos: Record<string, MountDemo> = {
    // Its async atoms with maxAge/staleWhileRevalidate/staleIfError and
    // cacheMeta are not part of v1; ./demos/cache-demo.tsx keeps the legacy demo.
    "cache-demo": unavailable("valdres/cache"),
}

// Demos mounted into the generic #api-demo at the bottom of the page
const demoMap: Record<string, MountDemo> = {
    selector: mountDerivedDemo,
    atomFamily: mountTodoListDemo,
    selectorFamily: mountFamilyDemo,
    store: mountCounterDemo,

    // React
    useAtom: mountCounterDemo,
    useValue: mountValueDisplayDemo,
    useSetAtom: mountSetterDemo,
    useResetAtom: mountResetCounterDemo,

    // The Vue, Svelte, Solid and Angular adapters are not migrated to v1, so
    // their pages say so instead of running a core-only counter in their place.
    createValdres: unavailable("valdres-vue"),
    fromState: unavailable("valdres-svelte"),
    createAtom: unavailable("valdres-solid"),
    createValue: unavailable("valdres-solid"),
    createSetAtom: unavailable("valdres-solid"),
    createResetAtom: unavailable("valdres-solid"),
    injectAtom: unavailable("valdres-angular"),
    injectValue: unavailable("valdres-angular"),
    injectSetAtom: unavailable("valdres-angular"),
    injectResetAtom: unavailable("valdres-angular"),
}

let cleanups: (() => void)[] = []

function mount(el: HTMLElement, mountFn: MountDemo) {
    const cleanup = mountFn(el)
    if (cleanup) cleanups.push(cleanup)
}

function mountDemos() {
    // Release the previous page's demos first. Navigation has already swapped
    // their DOM out, but their subscriptions and Stores are still live.
    const previous = cleanups
    cleanups = []
    for (const cleanup of previous) {
        try {
            cleanup()
        } catch (error) {
            console.error(error)
        }
    }

    // Mount inline demos by element ID
    for (const [id, mountFn] of Object.entries(inlineDemos)) {
        const el = document.getElementById(id)
        if (el) {
            el.innerHTML = ""
            mount(el, mountFn)
        }
    }

    // Mount plugin demos into <div data-plugin-demo="<plugin>"> placeholders
    for (const el of document.querySelectorAll<HTMLElement>("[data-plugin-demo]")) {
        const name = el.getAttribute("data-plugin-demo")
        const mountFn = name && pluginDemos[name]
        if (mountFn) mount(el, mountFn)
    }

    // Mount generic demo at #api-demo
    const el = document.getElementById("api-demo")
    if (!el) return
    el.innerHTML = ""
    const path = window.location.pathname.replace(/\/$/, "")
    const apiName = path.split("/").pop()
    if (apiName && demoMap[apiName]) {
        mount(el, demoMap[apiName])
    }
}

// Mount on initial load
mountDemos()

// Re-mount after client-side navigation
document.addEventListener("valdres:navigate", mountDemos)
