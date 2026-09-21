import { resetMediaQueryCache } from "../../src/lib/mediaQuery"

type ChangeListener = (event: Event) => void

export interface MediaHarness {
    /** Set what the query currently matches. Does not notify on its own. */
    set(query: string, matches: boolean): void
    /** Dispatch a real `change` Event through Happy-DOM's own EventTarget. */
    change(query: string): void
    /**
     * Dispatch a `change` the way the DOM standard specifies: invoke every
     * registered listener in registration order, and when one throws, *report*
     * the exception and keep going.
     *
     * Happy-DOM 20.0.5 does not model this for `MediaQueryList` — its dispatch
     * aborts on the first throwing listener because the object is not
     * window-associated, so its `errorCapture` guard never applies (verified:
     * a two-listener dispatch runs only the first). Real browsers follow
     * <https://dom.spec.whatwg.org/#concept-event-listener-invoke> step 4,
     * "if this throws an exception, then report the exception". Tests that need
     * the standard behaviour use this entry point and say so; the mock cannot
     * establish it.
     */
    changeReportingErrors(query: string): readonly unknown[]
    /** Physical `change` listeners currently attached to that query's object. */
    listeners(query: string): number
    /** How many times `window.matchMedia` was called for that query. */
    created(query: string): number
    restore(): void
}

/**
 * Wraps `window.matchMedia` so tests drive real Happy-DOM `MediaQueryList`
 * objects: real `EventTarget` registration and dispatch, real listener
 * bookkeeping. Only `matches` is overridden, because Happy-DOM models
 * `prefers-color-scheme` and `prefers-reduced-motion` as device settings but
 * has no equivalent for `prefers-contrast`, `prefers-reduced-data` or
 * `prefers-reduced-transparency` — the same harness has to serve all five
 * packages, and a device setting would not fire `change` events anyway.
 */
export const installMediaHarness = (
    initial: Readonly<Record<string, boolean>> = {},
): MediaHarness => {
    const native = window.matchMedia.bind(window)
    const states = new Map<string, boolean>(Object.entries(initial))
    const instances = new Map<string, MediaQueryList>()
    const registered = new Map<string, ChangeListener[]>()
    const created = new Map<string, number>()

    window.matchMedia = ((query: string) => {
        created.set(query, (created.get(query) ?? 0) + 1)
        const list = native(query)
        Object.defineProperty(list, "matches", {
            configurable: true,
            get: () => states.get(query) ?? false,
        })
        const add = list.addEventListener.bind(list)
        const remove = list.removeEventListener.bind(list)
        const listeners: ChangeListener[] = []
        registered.set(query, listeners)
        list.addEventListener = ((type: string, listener: ChangeListener, ...rest: unknown[]) => {
            if (type === "change") listeners.push(listener)
            return (add as (...args: unknown[]) => unknown)(type, listener, ...rest)
        }) as typeof list.addEventListener
        list.removeEventListener = ((type: string, listener: ChangeListener, ...rest: unknown[]) => {
            if (type === "change") {
                const at = listeners.indexOf(listener)
                if (at !== -1) listeners.splice(at, 1)
            }
            return (remove as (...args: unknown[]) => unknown)(type, listener, ...rest)
        }) as typeof list.removeEventListener
        instances.set(query, list)
        return list
    }) as typeof window.matchMedia

    // Force the package to re-resolve its cached objects through this harness.
    resetMediaQueryCache()

    return {
        set: (query, matches) => states.set(query, matches),
        change: query => {
            instances.get(query)?.dispatchEvent(new Event("change"))
        },
        changeReportingErrors: query => {
            const event = new Event("change")
            const reported: unknown[] = []
            for (const listener of [...(registered.get(query) ?? [])]) {
                try {
                    listener(event)
                } catch (error) {
                    reported.push(error)
                }
            }
            return reported
        },
        listeners: query => (registered.get(query) ?? []).length,
        created: query => created.get(query) ?? 0,
        restore: () => {
            window.matchMedia = native
            resetMediaQueryCache()
        },
    }
}
