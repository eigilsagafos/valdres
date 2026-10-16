/**
 * Shared Happy-DOM harness for the geometry packages: `@valdres/browser-window`
 * and `@valdres/browser-screen`.
 *
 * Both sources sample live platform metrics (`window.innerWidth`,
 * `screen.availHeight`, `devicePixelRatio`, `screen.orientation.type`, …) and
 * learn about changes from `resize` on `window`, `change` on
 * `screen.orientation` and on `screen`, and `change` on a
 * `(resolution: Xdppx)` media query. Happy-DOM 20.0.5 models only the plain
 * numbers: it has no `screen.orientation`, its `Screen` is not an
 * `EventTarget`, and it never matches a `resolution` query. This harness
 * supplies those pieces, lets a test move every metric without announcing it,
 * fires the events a browser would, and counts the listeners physically
 * attached to each target.
 *
 * Everything here is SIMULATED. It establishes what the packages do with the
 * events; it cannot establish when a real engine fires them. That is what
 * `scripts/browser-geometry-probe/` is for.
 *
 * Consumed by relative path, like `pageHarness` and `mediaHarness`, and never
 * re-exported from a package entry.
 */

type Listener = EventListenerOrEventListenerObject

export type GeometryTarget = "window" | "screen" | "orientation" | "resolution"

/** Every `target:type` pair the two packages listen to. */
export const GEOMETRY_EVENT_TYPES = [
    "window:resize",
    "screen:change",
    "orientation:change",
    "resolution:change",
] as const

export interface WindowMetrics {
    innerWidth: number
    innerHeight: number
    outerWidth: number
    outerHeight: number
}

export interface ScreenMetrics {
    width: number
    height: number
    availWidth: number
    availHeight: number
    colorDepth: number
    pixelDepth: number
}

export interface GeometryHarnessOptions {
    /** Install `screen.orientation`, as every current engine has. Default true. */
    readonly orientation?: boolean
    /** Make `screen` an `EventTarget`, as Chromium's is. Default true. */
    readonly screenEvents?: boolean
}

export interface GeometryHarness {
    /** Move window metrics. Fires nothing on its own. */
    setWindow(metrics: Partial<WindowMetrics>): void
    /** Move screen metrics. Fires nothing on its own. */
    setScreen(metrics: Partial<ScreenMetrics>): void
    /** Move the orientation. Fires nothing on its own. */
    setOrientation(type: OrientationType, angle: number): void
    /** Move `devicePixelRatio` without firing any media query. */
    setDevicePixelRatio(ratio: number): void
    /**
     * Move `devicePixelRatio` the way an engine does: every live
     * `(resolution: Xdppx)` query whose `matches` flips fires `change`.
     * Returns the exceptions listeners threw, dispatching DOM-style (see
     * {@link fireReportingErrors}).
     */
    changeResolution(ratio: number): readonly unknown[]
    /** Dispatch a real Event through the target's own dispatch. */
    fire(target: Exclude<GeometryTarget, "resolution">, type: string): void
    /**
     * Dispatch the way the DOM standard specifies: invoke every registered
     * listener in registration order and, when one throws, report the
     * exception and keep going. Returns the reported exceptions.
     */
    fireReportingErrors(
        target: Exclude<GeometryTarget, "resolution">,
        type: string,
    ): readonly unknown[]
    /** DISTINCT listener functions attached for that target and type. For
     *  `resolution`, summed over every live resolution query. */
    listeners(target: GeometryTarget, type: string): number
    /** Raw `addEventListener` calls for that target and type. */
    attachCalls(target: GeometryTarget, type: string): number
    /** The listener functions currently attached for that target and type,
     *  to model a host that still invokes a listener after its removal. */
    snapshotListeners(target: GeometryTarget, type: string): readonly Listener[]
    /** Resolution queries created through `matchMedia`, in order. */
    resolutionQueries(): readonly string[]
    /** Distinct listeners across every pair in {@link GEOMETRY_EVENT_TYPES}. */
    physical(): number
    /** Non-zero distinct listener counts by `target:type`. */
    attached(): Readonly<Record<string, number>>
    /** Make every later `addEventListener` of `type` on `target` throw. */
    failOnAttach(target: GeometryTarget, type: string, error: unknown): void
    /** Make every later `removeEventListener` of `type` on `target` throw. */
    failOnDetach(target: GeometryTarget, type: string, error: unknown): void
    /** Make `matchMedia` throw for resolution queries. */
    failMatchMedia(error: unknown): void
    restore(): void
}

const DEFAULT_WINDOW: WindowMetrics = {
    innerWidth: 1024,
    innerHeight: 768,
    outerWidth: 1024,
    outerHeight: 768,
}

const DEFAULT_SCREEN: ScreenMetrics = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1050,
    colorDepth: 24,
    pixelDepth: 24,
}

const RESOLUTION = /^\(resolution:\s*([0-9.eE+-]+)dppx\)$/

export const installGeometryHarness = (
    options: GeometryHarnessOptions = {},
): GeometryHarness => {
    const restorers: (() => void)[] = []
    // Distinct listeners per physical target: several resolution queries share
    // one name but are separate EventTargets.
    const targets: {
        name: GeometryTarget
        target: EventTarget
        listeners: Map<string, Set<Listener>>
    }[] = []
    const attachCalls = new Map<string, number>()
    const attachFailures = new Map<string, unknown>()
    const detachFailures = new Map<string, unknown>()
    let matchMediaFailure: { error: unknown } | undefined

    const replace = (
        object: object,
        key: string,
        descriptor: PropertyDescriptor,
    ) => {
        const own = Object.getOwnPropertyDescriptor(object, key)
        Object.defineProperty(object, key, {
            configurable: true,
            ...descriptor,
        })
        restorers.push(() => {
            if (own === undefined)
                delete (object as Record<string, unknown>)[key]
            else Object.defineProperty(object, key, own)
        })
    }

    const win: WindowMetrics = { ...DEFAULT_WINDOW }
    const scr: ScreenMetrics = { ...DEFAULT_SCREEN }
    let ratio = 1
    let orientationType: OrientationType = "landscape-primary"
    let orientationAngle = 0

    for (const key of Object.keys(win) as (keyof WindowMetrics)[])
        replace(window, key, { get: () => win[key] })
    replace(window, "devicePixelRatio", { get: () => ratio })
    const screen = window.screen
    for (const key of Object.keys(scr) as (keyof ScreenMetrics)[])
        replace(screen, key, { get: () => scr[key] })

    /** Records registrations for `target` under `name`, honouring injected failures. */
    const instrument = (name: GeometryTarget, target: EventTarget) => {
        const record = {
            name,
            target,
            listeners: new Map<string, Set<Listener>>(),
        }
        targets.push(record)
        const add = target.addEventListener
        const remove = target.removeEventListener
        replace(target, "addEventListener", {
            writable: true,
            value(
                this: EventTarget,
                type: string,
                listener: Listener | null,
                ...rest: unknown[]
            ) {
                const key = `${name}:${type}`
                attachCalls.set(key, (attachCalls.get(key) ?? 0) + 1)
                if (attachFailures.has(key)) throw attachFailures.get(key)
                const result = (add as (...args: unknown[]) => unknown).call(
                    this,
                    type,
                    listener,
                    ...rest,
                )
                if (listener !== null) {
                    let set = record.listeners.get(type)
                    if (set === undefined)
                        record.listeners.set(type, (set = new Set()))
                    set.add(listener)
                }
                return result
            },
        })
        replace(target, "removeEventListener", {
            writable: true,
            value(
                this: EventTarget,
                type: string,
                listener: Listener | null,
                ...rest: unknown[]
            ) {
                const key = `${name}:${type}`
                if (detachFailures.has(key)) throw detachFailures.get(key)
                const result = (remove as (...args: unknown[]) => unknown).call(
                    this,
                    type,
                    listener,
                    ...rest,
                )
                if (listener !== null)
                    record.listeners.get(type)?.delete(listener)
                return result
            },
        })
        return record
    }

    instrument("window", window)

    let orientation: EventTarget | undefined
    if (options.orientation !== false) {
        orientation = new EventTarget()
        Object.defineProperties(orientation, {
            type: { configurable: true, get: () => orientationType },
            angle: { configurable: true, get: () => orientationAngle },
        })
        instrument("orientation", orientation)
        replace(screen, "orientation", { get: () => orientation })
    } else {
        replace(screen, "orientation", { get: () => undefined })
    }

    if (options.screenEvents !== false) {
        // Chromium's Screen is an EventTarget; Happy-DOM's is not. Graft an
        // EventTarget's methods onto the real `screen` object so the packages
        // read metrics from and listen on one and the same object.
        const events = new EventTarget()
        for (const key of [
            "addEventListener",
            "removeEventListener",
            "dispatchEvent",
        ] as const)
            replace(screen, key, {
                writable: true,
                value: (events[key] as (...args: unknown[]) => unknown).bind(
                    events,
                ),
            })
        instrument("screen", screen as unknown as EventTarget)
    }

    // Live resolution queries: one EventTarget per `matchMedia` call, whose
    // `matches` follows `devicePixelRatio`. Every other query goes to Happy-DOM.
    type ResolutionQuery = EventTarget & {
        readonly media: string
        readonly matches: boolean
    }
    const queries: ResolutionQuery[] = []
    const nativeMatchMedia = window.matchMedia
    replace(window, "matchMedia", {
        writable: true,
        value(query: string) {
            const match = RESOLUTION.exec(query.trim())
            if (match === null) return nativeMatchMedia.call(window, query)
            if (matchMediaFailure !== undefined) throw matchMediaFailure.error
            const at = Number(match[1])
            const list = new EventTarget() as ResolutionQuery
            Object.defineProperties(list, {
                media: { value: query },
                matches: { get: () => ratio === at },
            })
            instrument("resolution", list)
            queries.push(list)
            return list
        },
    })

    const recordsOf = (name: GeometryTarget) =>
        targets.filter(record => record.name === name)

    const targetOf = (
        name: Exclude<GeometryTarget, "resolution">,
    ): EventTarget => {
        const [record] = recordsOf(name)
        if (record === undefined)
            throw new Error(`${name} events are not installed`)
        return record.target
    }

    const invoke = (listeners: Iterable<Listener>, event: Event) => {
        const reported: unknown[] = []
        for (const listener of [...listeners]) {
            try {
                if (typeof listener === "function")
                    listener.call(undefined, event)
                else listener.handleEvent(event)
            } catch (error) {
                reported.push(error)
            }
        }
        return reported
    }

    const count = (name: GeometryTarget, type: string) =>
        recordsOf(name).reduce(
            (sum, record) => sum + (record.listeners.get(type)?.size ?? 0),
            0,
        )

    return {
        setWindow: metrics => {
            Object.assign(win, metrics)
        },
        setScreen: metrics => {
            Object.assign(scr, metrics)
        },
        setOrientation: (type, angle) => {
            orientationType = type
            orientationAngle = angle
        },
        setDevicePixelRatio: next => {
            ratio = next
        },
        changeResolution: next => {
            const before = queries.map(list => list.matches)
            ratio = next
            const reported: unknown[] = []
            queries.forEach((list, index) => {
                if (before[index] === list.matches) return
                const record = targets.find(entry => entry.target === list)!
                reported.push(
                    ...invoke(
                        record.listeners.get("change") ?? [],
                        new Event("change"),
                    ),
                )
            })
            return reported
        },
        fire: (name, type) => {
            targetOf(name).dispatchEvent(new Event(type))
        },
        fireReportingErrors: (name, type) =>
            invoke(
                recordsOf(name).flatMap(record => [
                    ...(record.listeners.get(type) ?? []),
                ]),
                new Event(type),
            ),
        listeners: count,
        attachCalls: (name, type) => attachCalls.get(`${name}:${type}`) ?? 0,
        snapshotListeners: (name, type) =>
            recordsOf(name).flatMap(record => [
                ...(record.listeners.get(type) ?? []),
            ]),
        resolutionQueries: () => queries.map(list => list.media),
        physical: () =>
            GEOMETRY_EVENT_TYPES.reduce((sum, pair) => {
                const [name, type] = pair.split(":") as [GeometryTarget, string]
                return sum + count(name, type)
            }, 0),
        attached: () =>
            Object.fromEntries(
                GEOMETRY_EVENT_TYPES.map(pair => {
                    const [name, type] = pair.split(":") as [
                        GeometryTarget,
                        string,
                    ]
                    return [pair, count(name, type)] as const
                }).filter(([, n]) => n > 0),
            ),
        failOnAttach: (name, type, error) => {
            const key = `${name}:${type}`
            if (error === undefined) attachFailures.delete(key)
            else attachFailures.set(key, error)
        },
        failOnDetach: (name, type, error) => {
            const key = `${name}:${type}`
            if (error === undefined) detachFailures.delete(key)
            else detachFailures.set(key, error)
        },
        failMatchMedia: error => {
            matchMediaFailure = error === undefined ? undefined : { error }
        },
        restore: () => {
            for (const restore of restorers.splice(0).reverse()) restore()
        },
    }
}
