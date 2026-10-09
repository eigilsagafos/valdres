/**
 * Shared Happy-DOM harness for the permission-gated `@valdres/browser-*`
 * packages: `browser-device-motion`, `browser-device-orientation`,
 * `browser-geolocation` and `browser-screen-details`.
 *
 * Those packages reach hardware and permission prompts no test may touch, so
 * every outcome here is scripted: the secure-context flag, the event
 * constructors and their `requestPermission`, the Permissions API (answers,
 * `change` events, slow or rejected queries) and a model of transient user
 * activation. Listener counts are honest: distinct functions attached to
 * Happy-DOM's own `window`.
 *
 * Consumed by relative path, like `pageHarness`, and NOT re-exported from this
 * package's `index.ts`: nothing outside a DOM test should load a module whose
 * job is monkey-patching `window` and `navigator`.
 */

type Listener = EventListenerOrEventListenerObject

export interface Deferred<Value> {
    readonly promise: Promise<Value>
    resolve(value: Value): void
    reject(error: unknown): void
}

export const deferred = <Value>(): Deferred<Value> => {
    let resolve!: (value: Value) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<Value>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

/** Lets queued promise reactions run. */
export const flush = async (rounds = 3): Promise<void> => {
    for (let round = 0; round < rounds; round++)
        await new Promise(resolve => setTimeout(resolve, 0))
}

export class FakePermissionStatus extends EventTarget {
    #state: PermissionState
    readonly name: string
    constructor(name: string, state: PermissionState) {
        super()
        this.name = name
        this.#state = state
    }
    get state(): PermissionState {
        return this.#state
    }
    /** What the user changed in the browser's settings: fires `change`. */
    change(next: PermissionState): void {
        this.#state = next
        this.dispatchEvent(new Event("change"))
    }
    /** Changes what `state` reports without firing `change`. */
    setSilently(next: PermissionState): void {
        this.#state = next
    }
    /** Distinct `change` listeners currently attached. */
    listeners = 0
    override addEventListener(
        type: string,
        listener: Listener | null,
        options?: AddEventListenerOptions | boolean,
    ): void {
        if (type === "change" && listener !== null) this.listeners++
        super.addEventListener(type, listener, options)
    }
    override removeEventListener(
        type: string,
        listener: Listener | null,
        options?: EventListenerOptions | boolean,
    ): void {
        if (type === "change" && listener !== null)
            this.listeners = Math.max(0, this.listeners - 1)
        super.removeEventListener(type, listener, options)
    }
}

export interface FakePermissions {
    /** The status objects the API hands out, by name (one per name). */
    readonly statuses: Map<string, FakePermissionStatus>
    /** Names whose `query` rejects with a TypeError, as engines do for names
     *  they do not know. */
    readonly unknown: Set<string>
    /** `query({ name })` calls, in order. */
    readonly queries: string[]
    /** When set, queries wait for `release()` instead of answering at once. */
    hold: boolean
    /** Answers every held query, in order. */
    release(): void
    /** Sets the state the next query reports (and the status's, silently). */
    set(name: string, state: PermissionState): FakePermissionStatus
    /** Total `change` listeners across every handed-out status. */
    changeListeners(): number
}

export interface DeviceHarness {
    /** `window.isSecureContext`: `undefined` restores Happy-DOM's own. */
    setSecure(secure: boolean | undefined): void
    /** Installs (or, with `undefined`, removes) a global on `window` and `globalThis`. */
    setGlobal(name: string, value: unknown): void
    /** Installs a scripted `navigator.permissions`, or removes it. */
    installPermissions(): FakePermissions
    removePermissions(): void
    /** Distinct listeners on `window` for `type`. */
    listeners(type: string): number
    /** Dispatches `event` on `window` through Happy-DOM. */
    fire(event: Event): void
    /**
     * Invoke every `window` listener of `event.type` the way the DOM standard
     * does: in order, reporting a throw and continuing. Returns what threw.
     */
    fireReportingErrors(event: Event): readonly unknown[]
    /** Runs `callback` with transient user activation, as a click handler does. */
    withActivation<Result>(callback: () => Result): Result
    /** Whether the current synchronous call stack has transient activation. */
    hasActivation(): boolean
    restore(): void
}

export const installDeviceHarness = (): DeviceHarness => {
    const restorers: (() => void)[] = []
    const remember = (object: object, key: PropertyKey) => {
        const own = Object.getOwnPropertyDescriptor(object, key)
        restorers.push(() => {
            if (own === undefined) delete (object as Record<PropertyKey, unknown>)[key]
            else Object.defineProperty(object, key, own)
        })
    }
    const touched = new Set<string>()
    const define = (object: object, key: PropertyKey, value: unknown) => {
        const tag = `${object === window ? "window" : object === navigator ? "navigator" : "global"}:${String(key)}`
        if (!touched.has(tag)) {
            touched.add(tag)
            remember(object, key)
        }
        if (value === undefined) {
            delete (object as Record<PropertyKey, unknown>)[key]
            // A prototype getter (Happy-DOM's own) would otherwise show through.
            if (key in object)
                Object.defineProperty(object, key, {
                    configurable: true,
                    value: undefined,
                    writable: true,
                })
            return
        }
        Object.defineProperty(object, key, {
            configurable: true,
            value,
            writable: true,
        })
    }

    const registered = new Map<string, Set<Listener>>()
    const add = window.addEventListener
    const remove = window.removeEventListener
    remember(window, "addEventListener")
    remember(window, "removeEventListener")
    Object.defineProperty(window, "addEventListener", {
        configurable: true,
        writable: true,
        value(this: EventTarget, type: string, listener: Listener | null, ...rest: unknown[]) {
            if (listener !== null) {
                let set = registered.get(type)
                if (set === undefined) registered.set(type, (set = new Set()))
                set.add(listener)
            }
            return (add as (...args: unknown[]) => unknown).call(this, type, listener, ...rest)
        },
    })
    Object.defineProperty(window, "removeEventListener", {
        configurable: true,
        writable: true,
        value(this: EventTarget, type: string, listener: Listener | null, ...rest: unknown[]) {
            if (listener !== null) registered.get(type)?.delete(listener)
            return (remove as (...args: unknown[]) => unknown).call(this, type, listener, ...rest)
        },
    })

    let activation = 0

    return {
        setSecure: secure => {
            if (secure === undefined) {
                if (!touched.has("window:isSecureContext")) return
                define(window, "isSecureContext", undefined)
                return
            }
            define(window, "isSecureContext", secure)
        },
        setGlobal: (name, value) => {
            define(window, name, value)
            if ((globalThis as unknown) !== window) define(globalThis, name, value)
        },
        installPermissions: () => {
            const statuses = new Map<string, FakePermissionStatus>()
            const unknown = new Set<string>()
            const queries: string[] = []
            const held: (() => void)[] = []
            const permissions: FakePermissions = {
                statuses,
                unknown,
                queries,
                hold: false,
                release: () => {
                    for (const answer of held.splice(0)) answer()
                },
                set: (name, state) => {
                    let status = statuses.get(name)
                    if (status === undefined) {
                        status = new FakePermissionStatus(name, state)
                        statuses.set(name, status)
                    } else status.setSilently(state)
                    return status
                },
                changeListeners: () =>
                    [...statuses.values()].reduce((sum, status) => sum + status.listeners, 0),
            }
            const query = (descriptor: { name: string }) => {
                queries.push(descriptor.name)
                return new Promise<PermissionStatus>((resolve, reject) => {
                    const answer = () => {
                        if (unknown.has(descriptor.name)) {
                            reject(new TypeError(`'${descriptor.name}' is not a valid PermissionName`))
                            return
                        }
                        let status = statuses.get(descriptor.name)
                        if (status === undefined) {
                            status = new FakePermissionStatus(descriptor.name, "prompt")
                            statuses.set(descriptor.name, status)
                        }
                        resolve(status as unknown as PermissionStatus)
                    }
                    if (permissions.hold) held.push(answer)
                    else answer()
                })
            }
            define(navigator, "permissions", { query })
            return permissions
        },
        removePermissions: () => define(navigator, "permissions", undefined),
        listeners: type => registered.get(type)?.size ?? 0,
        fire: event => {
            window.dispatchEvent(event)
        },
        fireReportingErrors: event => {
            const reported: unknown[] = []
            for (const listener of [...(registered.get(event.type) ?? [])]) {
                try {
                    if (typeof listener === "function") listener(event)
                    else listener.handleEvent(event)
                } catch (error) {
                    reported.push(error)
                }
            }
            return reported
        },
        withActivation: callback => {
            activation++
            try {
                return callback()
            } finally {
                activation--
            }
        },
        hasActivation: () => activation > 0,
        restore: () => {
            for (const restore of restorers.splice(0).reverse()) restore()
        },
    }
}

/**
 * A scripted `requestPermission` that models the spec: called without
 * transient activation while the state is `"prompt"`, it rejects with a
 * NotAllowedError; otherwise each call waits for the test to answer it.
 */
export interface ScriptedRequest {
    readonly fn: (absolute?: boolean) => Promise<PermissionState>
    /** Calls that reached the fake, with whether they had activation. */
    readonly calls: { activated: boolean }[]
    /** Pending answers, oldest first. */
    readonly pending: Deferred<PermissionState>[]
    /** The state an activation-less call checks against. */
    state: PermissionState
}

export const scriptedRequest = (harness: DeviceHarness): ScriptedRequest => {
    const script: ScriptedRequest = {
        calls: [],
        pending: [],
        state: "prompt",
        fn: () => {
            const activated = harness.hasActivation()
            script.calls.push({ activated })
            if (!activated && script.state === "prompt")
                return Promise.reject(
                    new DOMException("Requires transient activation", "NotAllowedError"),
                )
            const answer = deferred<PermissionState>()
            script.pending.push(answer)
            return answer.promise
        },
    }
    return script
}
