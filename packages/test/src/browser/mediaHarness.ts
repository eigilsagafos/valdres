/**
 * Shared Happy-DOM harness for the `@valdres/browser-*` media-query packages.
 *
 * Every such package wraps `window.matchMedia` behind a private, lazily
 * populated cache, so a test needs three things this provides: control over what
 * a query currently matches, the ability to fire a real `change` event on the
 * exact `MediaQueryList` the package is holding, and an honest count of the
 * listeners physically attached to it.
 *
 * Consumed by relative path (`../../../../test/src/browser/mediaHarness`) the
 * same way `packages/valdres` consumes `LeakDetector`. It is deliberately NOT
 * re-exported from this package's `index.ts`: that barrel is imported by
 * `valdres-react` and `valdres-svelte`, and nothing outside a DOM test should
 * pull in a module whose whole job is monkey-patching `window.matchMedia`.
 */

type ChangeListener = (event: Event) => void

export interface MediaHarness {
    /** Set what the query currently matches. Fires nothing on its own — a real
     *  preference change that the host has not yet announced looks exactly like
     *  this, and a dormant read must still observe it. */
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
     * "if this throws an exception, then report the exception" — confirmed for
     * this exact package pair in Chromium 151 by
     * `scripts/browser-media-dispatch-probe/`. Tests that need the standard
     * behaviour use this entry point and say so; the mock cannot establish it.
     *
     * Returns the exceptions that were reported, in occurrence order.
     */
    changeReportingErrors(query: string): readonly unknown[]
    /**
     * How many DISTINCT listener functions are attached to that query's object
     * right now. Two stores that both subscribe register two different closures;
     * a package that accidentally reused one invalidator for both would still
     * make `addEventListener` run twice, so counting calls would not catch it.
     */
    listeners(query: string): number
    /** Raw `addEventListener("change", …)` calls for that query, successful or
     *  not — the number `listeners()` is deliberately not. */
    attachCalls(query: string): number
    /** How many times `window.matchMedia` was called for that query. */
    created(query: string): number
    /**
     * Make `addEventListener("change", …)` throw for one query, to exercise a
     * source that fails partway through attaching to several queries. Pass
     * `undefined` to stop failing.
     */
    failOnAttach(query: string, error: unknown): void
    restore(): void
}

export interface MediaHarnessOptions {
    /**
     * The package's own `resetMediaQueryCache`. The harness calls it on install
     * and on restore so the package re-resolves its cached `MediaQueryList`
     * objects through this harness and releases them afterwards.
     */
    readonly resetCache: () => void
    /** What each query matches when the harness is installed. */
    readonly matching?: Readonly<Record<string, boolean>>
}

/**
 * Wraps `window.matchMedia` so tests drive real Happy-DOM `MediaQueryList`
 * objects: real `EventTarget` registration and dispatch, real listener
 * bookkeeping. Only `matches` is overridden, because Happy-DOM models
 * `prefers-color-scheme` and `prefers-reduced-motion` as device settings but has
 * no equivalent for `prefers-contrast`, `prefers-reduced-data` or
 * `prefers-reduced-transparency` — one harness has to serve all five packages,
 * and a device setting would not fire `change` events anyway.
 */
export const installMediaHarness = ({
    resetCache,
    matching = {},
}: MediaHarnessOptions): MediaHarness => {
    const native = window.matchMedia.bind(window)
    const states = new Map<string, boolean>(Object.entries(matching))
    const instances = new Map<string, MediaQueryList>()
    // Insertion-ordered and identity-keyed: dispatch order is registration
    // order, and a listener registered twice is one listener to the DOM.
    const registered = new Map<string, Set<ChangeListener>>()
    const attachCalls = new Map<string, number>()
    const created = new Map<string, number>()
    const attachFailures = new Map<string, unknown>()

    window.matchMedia = ((query: string) => {
        created.set(query, (created.get(query) ?? 0) + 1)
        const list = native(query)
        Object.defineProperty(list, "matches", {
            configurable: true,
            get: () => states.get(query) ?? false,
        })
        const add = list.addEventListener.bind(list)
        const remove = list.removeEventListener.bind(list)
        const listeners = new Set<ChangeListener>()
        registered.set(query, listeners)
        list.addEventListener = ((
            type: string,
            listener: ChangeListener,
            ...rest: unknown[]
        ) => {
            if (type === "change") {
                attachCalls.set(query, (attachCalls.get(query) ?? 0) + 1)
                if (attachFailures.has(query)) throw attachFailures.get(query)
                listeners.add(listener)
            }
            return (add as (...args: unknown[]) => unknown)(
                type,
                listener,
                ...rest,
            )
        }) as typeof list.addEventListener
        list.removeEventListener = ((
            type: string,
            listener: ChangeListener,
            ...rest: unknown[]
        ) => {
            if (type === "change") listeners.delete(listener)
            return (remove as (...args: unknown[]) => unknown)(
                type,
                listener,
                ...rest,
            )
        }) as typeof list.removeEventListener
        instances.set(query, list)
        return list
    }) as typeof window.matchMedia

    // Force the package to re-resolve its cached objects through this harness.
    resetCache()

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
        listeners: query => (registered.get(query) ?? new Set()).size,
        attachCalls: query => attachCalls.get(query) ?? 0,
        created: query => created.get(query) ?? 0,
        failOnAttach: (query, error) => {
            if (error === undefined) attachFailures.delete(query)
            else attachFailures.set(query, error)
        },
        restore: () => {
            window.matchMedia = native
            resetCache()
        },
    }
}
