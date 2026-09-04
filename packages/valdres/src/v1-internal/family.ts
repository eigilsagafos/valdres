export type FamilyKey =
    | string
    | number
    | bigint
    | boolean
    | symbol
    | null
    | undefined

interface FamilyWeakReference<Value extends object> {
    deref(): Value | undefined
}

interface FamilyFinalizationRegistry<Held extends object> {
    register(target: object, held: Held, token: object): void
    unregister(token: object): boolean
}

/** @internal Injectable only so cleanup correctness is deterministic in tests. */
export interface FamilyWeakRuntime {
    ref<Value extends object>(target: Value): FamilyWeakReference<Value>
    registry<Held extends object>(
        cleanup: (held: Held) => void,
    ): FamilyFinalizationRegistry<Held>
}

interface TupleRoute<Value extends object> {
    readonly parent: TupleRoute<Value> | undefined
    readonly parentKey: FamilyKey
    children: Map<FamilyKey, TupleRoute<Value>> | undefined
    entry: FamilyEntry<Value> | undefined
}

interface BuildingEntry<Value extends object> {
    readonly kind: "building"
    readonly route: TupleRoute<Value>
    fault: TypeError | undefined
}

interface ReadyEntry<Value extends object> {
    readonly kind: "ready"
    readonly route: TupleRoute<Value>
    readonly reference: FamilyWeakReference<Value>
}

type FamilyEntry<Value extends object> =
    | BuildingEntry<Value>
    | ReadyEntry<Value>

const nativeWeakRuntime: FamilyWeakRuntime = {
    ref: <Value extends object>(target: Value) => new WeakRef(target),
    registry: <Held extends object>(cleanup: (held: Held) => void) => {
        const registry = new FinalizationRegistry<Held>(cleanup)
        return Object.freeze({
            register: (target: object, held: Held, token: object): void =>
                registry.register(target, held, token),
            unregister: (token: object): boolean => registry.unregister(token),
        })
    },
}

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

const NOT_THENABLE: InspectedThenable = { kind: "not-thenable" }
const NOOP = (): void => {}

const inspectThenable = (value: unknown): InspectedThenable => {
    if (
        (typeof value !== "object" || value === null) &&
        typeof value !== "function"
    ) {
        return NOT_THENABLE
    }
    try {
        const then = (value as { readonly then?: unknown }).then
        return typeof then === "function"
            ? Object.freeze({
                  kind: "thenable" as const,
                  target: value,
                  then: then as (...args: unknown[]) => unknown,
              })
            : NOT_THENABLE
    } catch (error) {
        return Object.freeze({ kind: "inspection-error" as const, error })
    }
}

const rejectThenable = (
    inspected: Extract<InspectedThenable, { kind: "thenable" }>,
): never => {
    try {
        Reflect.apply(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // Containment never replaces the stable synchronous-boundary failure.
    }
    throw new TypeError("Definition callbacks must complete synchronously")
}

const runSynchronousDefinitionCallback = <Result, Validated = Result>(
    runDefinitionCallback: <CallbackResult, CallbackValidated = CallbackResult>(
        phase: "factory" | "encoder",
        callback: (...args: any[]) => CallbackResult,
        args: ArrayLike<unknown>,
        validate?: (result: CallbackResult) => CallbackValidated,
    ) => CallbackValidated,
    phase: "factory" | "encoder",
    callback: (...args: any[]) => Result,
    args: ArrayLike<unknown>,
    validate?: (result: Result) => Validated,
): Validated =>
    runDefinitionCallback(
        phase,
        (...callbackArgs: any[]): Result => {
            let result: Result
            try {
                result = Reflect.apply(callback, undefined, callbackArgs)
            } catch (thrown) {
                const inspected = inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                return rejectThenable(inspected)
            }
            const inspected = inspectThenable(result)
            if (inspected.kind === "not-thenable") return result
            if (inspected.kind === "inspection-error") throw inspected.error
            return rejectThenable(inspected)
        },
        args,
        validate,
    )

const familyRecursionError = (): TypeError =>
    new TypeError("family cannot recursively construct the same member")

/**
 * One family-local primitive tuple trie with weak terminal values.
 *
 * The terminal lives on the route node itself, so a tuple and its longer
 * prefix remain distinct. Map supplies SameValueZero for every positional key.
 * Empty routes are pruned after a failed build, an observed dead reference, or
 * finalization. Correctness never depends on the finalizer running: lookup
 * repairs a dead reference synchronously, and cleanup removes only the exact
 * entry it registered.
 *
 * @internal The class is exported only for deterministic weak-runtime tests.
 */
export class WeakTupleMemberCache<Value extends object> {
    readonly #root: TupleRoute<Value> = {
        parent: undefined,
        parentKey: undefined,
        children: undefined,
        entry: undefined,
    }
    readonly #registry: FamilyFinalizationRegistry<ReadyEntry<Value>>
    readonly #createMember: (args: ArrayLike<unknown>) => Value
    readonly #onReady: ((member: Value) => void) | undefined

    constructor(
        createMember: (args: ArrayLike<unknown>) => Value,
        weakRuntime: FamilyWeakRuntime = nativeWeakRuntime,
        onReady?: (member: Value) => void,
    ) {
        this.#createMember = createMember
        this.#onReady = onReady
        this.#registry = weakRuntime.registry(entry => {
            const route = entry.route
            if (route.entry !== entry) return
            route.entry = undefined
            this.#prune(route)
        })
        this.#ref = target => weakRuntime.ref(target)
    }

    readonly #ref: <Target extends object>(
        target: Target,
    ) => FamilyWeakReference<Target>

    getOrCreateOne(key: FamilyKey, args: ArrayLike<unknown>): Value {
        return this.#resolve(this.#descend(this.#root, key), args)
    }

    getOrCreateTuple(
        keys: ArrayLike<FamilyKey>,
        args: ArrayLike<unknown>,
    ): Value {
        let route = this.#root
        for (let index = 0; index < keys.length; index++) {
            route = this.#descend(route, keys[index])
        }
        return this.#resolve(route, args)
    }

    /** @internal Deterministic cleanup assertion; never exposed by family(). */
    get routeCount(): number {
        let count = 0
        const visit = (route: TupleRoute<Value>): void => {
            if (route.children === undefined) return
            for (const child of route.children.values()) {
                count++
                visit(child)
            }
        }
        visit(this.#root)
        return count
    }

    /** @internal Deterministic cleanup assertion; never exposed by family(). */
    hasRoute(keys: ArrayLike<FamilyKey>): boolean {
        let route = this.#root
        for (let index = 0; index < keys.length; index++) {
            const child = route.children?.get(keys[index])
            if (child === undefined) return false
            route = child
        }
        return true
    }

    #descend(parent: TupleRoute<Value>, key: FamilyKey): TupleRoute<Value> {
        const children = parent.children ?? (parent.children = new Map())
        let child = children.get(key)
        if (child !== undefined) return child
        child = {
            parent,
            parentKey: key,
            children: undefined,
            entry: undefined,
        }
        children.set(key, child)
        return child
    }

    #resolve(route: TupleRoute<Value>, args: ArrayLike<unknown>): Value {
        const current = route.entry
        if (current?.kind === "ready") {
            const member = current.reference.deref()
            if (member !== undefined) return member
            this.#registry.unregister(current)
            if (route.entry === current) route.entry = undefined
        } else if (current?.kind === "building") {
            const fault = current.fault ?? familyRecursionError()
            current.fault = fault
            throw fault
        }

        const building: BuildingEntry<Value> = {
            kind: "building",
            route,
            fault: undefined,
        }
        route.entry = building

        try {
            const member = this.#createMember(args)
            if (building.fault !== undefined) throw building.fault
            this.#onReady?.(member)
            const ready: ReadyEntry<Value> = {
                kind: "ready",
                route,
                reference: this.#ref(member),
            }
            route.entry = ready
            this.#registry.register(member, ready, ready)
            return member
        } catch (error) {
            if (route.entry === building) route.entry = undefined
            this.#prune(route)
            throw building.fault ?? error
        }
    }

    #prune(start: TupleRoute<Value>): void {
        let route = start
        while (
            route.parent !== undefined &&
            route.entry === undefined &&
            (route.children === undefined || route.children.size === 0)
        ) {
            const parent = route.parent
            const children = parent.children
            if (children?.get(route.parentKey) !== route) return
            children.delete(route.parentKey)
            if (children.size === 0) parent.children = undefined
            route = parent
        }
    }
}

const isFamilyKey = (value: unknown): value is FamilyKey =>
    value === null ||
    value === undefined ||
    (typeof value !== "object" && typeof value !== "function")

const structuredFamilyKeyError = (): TypeError =>
    new TypeError(
        "family keys must be primitive; use encodeKey for structured arguments",
    )

const encodedFamilyKeyError = (): TypeError =>
    new TypeError("family encodeKey must return one primitive FamilyKey")

const familyArgumentCountError = (): TypeError =>
    new TypeError("family members require at least one key")

interface EncodingFrame {
    fault: TypeError | undefined
}

/** @internal Store-free identity implementation composed by the public root. */
export const createFamilyAccessor = <Value extends object>(
    createNode: (...args: any[]) => unknown,
    encodeKey: ((...args: any[]) => unknown) | undefined,
    runDefinitionCallback: <Result, Validated = Result>(
        phase: "factory" | "encoder",
        callback: (...args: any[]) => Result,
        args: ArrayLike<unknown>,
        validate?: (result: Result) => Validated,
    ) => Validated,
    assertMember: (value: unknown) => Value,
    markReady: (member: Value) => void,
    assertCallAllowed: () => void,
): ((...args: any[]) => Value) => {
    let encodingFrame: EncodingFrame | undefined
    const cache = new WeakTupleMemberCache<Value>(
        args =>
            runSynchronousDefinitionCallback(
                runDefinitionCallback,
                "factory",
                createNode,
                args,
                assertMember,
            ),
        undefined,
        markReady,
    )

    const callable = {
        family(first?: unknown): Value {
            const args = arguments
            const activeEncoding = encodingFrame
            if (activeEncoding !== undefined) {
                const fault =
                    activeEncoding.fault ??
                    new TypeError("family encodeKey cannot call its own family")
                activeEncoding.fault = fault
                throw fault
            }
            assertCallAllowed()
            if (args.length === 0) throw familyArgumentCountError()

            if (encodeKey !== undefined) {
                const frame: EncodingFrame = { fault: undefined }
                encodingFrame = frame
                let key: unknown
                try {
                    key = runSynchronousDefinitionCallback(
                        runDefinitionCallback,
                        "encoder",
                        encodeKey,
                        args,
                    )
                } catch (error) {
                    throw frame.fault ?? error
                } finally {
                    encodingFrame = undefined
                }
                if (frame.fault !== undefined) throw frame.fault
                if (!isFamilyKey(key)) throw encodedFamilyKeyError()
                return cache.getOrCreateOne(key, args)
            }

            if (args.length === 1) {
                if (!isFamilyKey(first)) throw structuredFamilyKeyError()
                return cache.getOrCreateOne(first, args)
            }

            for (let index = 0; index < args.length; index++) {
                if (!isFamilyKey(args[index])) {
                    throw structuredFamilyKeyError()
                }
            }
            return cache.getOrCreateTuple(
                args as unknown as ArrayLike<FamilyKey>,
                args,
            )
        },
    }.family

    return Object.freeze(callable)
}
