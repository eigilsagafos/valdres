/**
 * Shared Happy-DOM harness for the event-signalled `@valdres/browser-*`
 * packages: `browser-online`, `browser-focus`, `browser-visibility` and
 * `browser-presence`.
 *
 * Those sources read live platform state (`navigator.onLine`,
 * `document.hasFocus()`, `document.visibilityState`) and learn about changes
 * from events on `window` and `document`. A test therefore needs three things
 * this provides: control over what the platform currently reports, the ability
 * to fire a real event through Happy-DOM's own `window` / `document`, and an
 * honest count of the listeners physically attached to them.
 *
 * Consumed by relative path (`../../../../test/src/browser/pageHarness`) the
 * same way `mediaHarness` is, and for the same reason it is NOT re-exported from
 * this package's `index.ts`: nothing outside a DOM test should pull in a module
 * whose job is monkey-patching `window` and `document`.
 */

type Listener = EventListenerOrEventListenerObject
export type PageTarget = "window" | "document"

/** Every `target:type` pair the four packages listen to. */
export const PAGE_EVENT_TYPES = [
    "window:online",
    "window:offline",
    "window:focus",
    "window:blur",
    "document:visibilitychange",
] as const

export interface PageHarness {
    /** What `navigator.onLine` reports. Fires nothing on its own. */
    setOnline(online: boolean): void
    /** What `document.hasFocus()` reports. Fires nothing on its own. */
    setHasFocus(focused: boolean): void
    /** What `document.visibilityState` reports. Fires nothing on its own. */
    setVisibility(state: DocumentVisibilityState): void
    /** Dispatch a real Event through Happy-DOM's own target. */
    fire(target: PageTarget, type: string): void
    /**
     * Dispatch the way the DOM standard specifies: invoke every registered
     * listener in registration order and, when one throws, report the exception
     * and keep going. Happy-DOM's own dispatch is not relied on for that
     * guarantee (see `mediaHarness.changeReportingErrors`). Returns the reported
     * exceptions in occurrence order.
     */
    fireReportingErrors(target: PageTarget, type: string): readonly unknown[]
    /** DISTINCT listener functions attached to that target for that type. */
    listeners(target: PageTarget, type: string): number
    /** Raw `addEventListener` calls for that target and type, successful or not. */
    attachCalls(target: PageTarget, type: string): number
    /** Distinct listeners across every pair in {@link PAGE_EVENT_TYPES}. */
    physical(): number
    /** Non-zero distinct listener counts by `target:type`, limited to
     *  {@link PAGE_EVENT_TYPES} so a renderer's own listeners do not count. */
    attached(): Readonly<Record<string, number>>
    /** Make every later `addEventListener` of `type` on `target` throw. Pass
     *  `undefined` to stop failing. */
    failOnAttach(target: PageTarget, type: string, error: unknown): void
    restore(): void
}

export const installPageHarness = (): PageHarness => {
    const registered = new Map<string, Set<Listener>>()
    const attachCalls = new Map<string, number>()
    const failures = new Map<string, unknown>()
    const restorers: (() => void)[] = []

    const override = (object: object, key: string, value: unknown) => {
        const own = Object.getOwnPropertyDescriptor(object, key)
        Object.defineProperty(object, key, {
            configurable: true,
            ...(typeof value === "function"
                ? { value, writable: true }
                : { get: () => value }),
        })
        restorers.push(() => {
            if (own === undefined) delete (object as Record<string, unknown>)[key]
            else Object.defineProperty(object, key, own)
        })
    }

    let online = true
    let focused = true
    let visibility: DocumentVisibilityState = "visible"
    const define = (object: object, key: string, read: () => unknown) => {
        const own = Object.getOwnPropertyDescriptor(object, key)
        Object.defineProperty(object, key, { configurable: true, get: read })
        restorers.push(() => {
            if (own === undefined) delete (object as Record<string, unknown>)[key]
            else Object.defineProperty(object, key, own)
        })
    }
    define(navigator, "onLine", () => online)
    define(document, "visibilityState", () => visibility)
    override(document, "hasFocus", () => focused)

    const track = (name: PageTarget, target: EventTarget) => {
        const add = target.addEventListener
        const remove = target.removeEventListener
        override(target, "addEventListener", function (
            this: EventTarget,
            type: string,
            listener: Listener | null,
            ...rest: unknown[]
        ) {
            const key = `${name}:${type}`
            attachCalls.set(key, (attachCalls.get(key) ?? 0) + 1)
            if (failures.has(key)) throw failures.get(key)
            if (listener !== null) {
                let set = registered.get(key)
                if (set === undefined) registered.set(key, (set = new Set()))
                set.add(listener)
            }
            return (add as (...args: unknown[]) => unknown).call(
                this,
                type,
                listener,
                ...rest,
            )
        })
        override(target, "removeEventListener", function (
            this: EventTarget,
            type: string,
            listener: Listener | null,
            ...rest: unknown[]
        ) {
            if (listener !== null)
                registered.get(`${name}:${type}`)?.delete(listener)
            return (remove as (...args: unknown[]) => unknown).call(
                this,
                type,
                listener,
                ...rest,
            )
        })
    }
    track("window", window)
    track("document", document)

    const targetOf = (name: PageTarget): EventTarget =>
        name === "window" ? window : document
    const count = (name: PageTarget, type: string) =>
        registered.get(`${name}:${type}`)?.size ?? 0

    return {
        setOnline: next => {
            online = next
        },
        setHasFocus: next => {
            focused = next
        },
        setVisibility: next => {
            visibility = next
        },
        fire: (name, type) => {
            targetOf(name).dispatchEvent(new Event(type))
        },
        fireReportingErrors: (name, type) => {
            const event = new Event(type)
            const reported: unknown[] = []
            for (const listener of [
                ...(registered.get(`${name}:${type}`) ?? []),
            ]) {
                try {
                    if (typeof listener === "function") listener(event)
                    else listener.handleEvent(event)
                } catch (error) {
                    reported.push(error)
                }
            }
            return reported
        },
        listeners: count,
        attachCalls: (name, type) => attachCalls.get(`${name}:${type}`) ?? 0,
        physical: () =>
            PAGE_EVENT_TYPES.reduce((sum, pair) => {
                const [name, type] = pair.split(":") as [PageTarget, string]
                return sum + count(name, type)
            }, 0),
        attached: () =>
            Object.fromEntries(
                [...registered]
                    .filter(
                        ([key, set]) =>
                            set.size > 0 &&
                            (PAGE_EVENT_TYPES as readonly string[]).includes(key),
                    )
                    .map(([key, set]) => [key, set.size]),
            ),
        failOnAttach: (name, type, error) => {
            const key = `${name}:${type}`
            if (error === undefined) failures.delete(key)
            else failures.set(key, error)
        },
        restore: () => {
            for (const restore of restorers.splice(0).reverse()) restore()
        },
    }
}
