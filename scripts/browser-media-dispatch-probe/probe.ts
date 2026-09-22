/**
 * Runs inside the probe iframe. Bundled from workspace source by `serve.ts`.
 *
 * The property under test is a platform guarantee, not a package one: when an
 * event listener throws, the DOM standard requires the host to *report* the
 * exception and keep invoking the remaining listeners
 * (<https://dom.spec.whatwg.org/#concept-event-listener-invoke>, step 4).
 * `@valdres/browser-color-scheme` attaches one listener per store tree, so that
 * guarantee is what keeps a second store receiving updates after a first
 * store's subscriber throws.
 *
 * Happy-DOM 20.0.5 does not model it for `MediaQueryList` — its dispatch aborts
 * on the first throwing listener — so the package suites assert this through an
 * explicitly labelled `changeReportingErrors()` path that models the standard.
 * This probe is the real-engine counterpart.
 *
 * Driving a *native* change event needs a media query the page can actually
 * move. `prefers-color-scheme` is owned by the OS, so the query string alone is
 * substituted for a viewport query and the iframe is resized by the parent:
 * `matches`, listener registration and event dispatch all stay native.
 */
import { store } from "../../packages/valdres/src/index"
import { colorSchemeAtom } from "../../packages/@valdres/browser-color-scheme/src/index"

const VIEWPORT_QUERY = "(min-width: 900px)"
const COLOR_QUERY = "(prefers-color-scheme: dark)"

export interface ProbeResult {
    readonly substitutedQuery: string
    readonly healthySeen: string[]
    readonly healthyFinal: string
    readonly failingFinal: string
    readonly errors: { name: string; causes: string[] }[]
    readonly listenerCount: number
}

const nativeMatchMedia = window.matchMedia.bind(window)
let attached = 0
window.matchMedia = ((query: string) => {
    const list = nativeMatchMedia(query === COLOR_QUERY ? VIEWPORT_QUERY : query)
    const add = list.addEventListener.bind(list)
    list.addEventListener = ((type: string, ...rest: unknown[]) => {
        if (type === "change") attached++
        return (add as (...args: unknown[]) => unknown)(type, ...rest)
    }) as typeof list.addEventListener
    return list
}) as typeof window.matchMedia

const errors: { name: string; causes: string[] }[] = []
window.addEventListener("error", event => {
    const error = (event as ErrorEvent).error as
        | { name?: string; causes?: unknown[] }
        | undefined
    errors.push({
        name: String(error?.name ?? "unknown"),
        causes: (error?.causes ?? []).map(String),
    })
    event.preventDefault()
})

const failing = store()
const healthy = store()
const healthySeen: string[] = []

const stopFailing = failing.sub(colorSchemeAtom, () => {
    throw new Error("intentional media probe subscriber failure")
})
const stopHealthy = healthy.sub(colorSchemeAtom, () => {
    healthySeen.push(healthy.get(colorSchemeAtom))
})

Object.assign(window, {
    mediaProbe: {
        result: (): ProbeResult => ({
            substitutedQuery: VIEWPORT_QUERY,
            healthySeen: [...healthySeen],
            healthyFinal: healthy.get(colorSchemeAtom),
            failingFinal: failing.get(colorSchemeAtom),
            errors: [...errors],
            listenerCount: attached,
        }),
        cleanup: () => {
            stopFailing()
            stopHealthy()
            failing.dispose()
            healthy.dispose()
        },
    },
})
