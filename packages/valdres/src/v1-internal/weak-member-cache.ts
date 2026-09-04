/** Primitive cache keys supported by the shared weak member trie. */
export type WeakMemberKey =
    | string
    | number
    | bigint
    | boolean
    | symbol
    | null
    | undefined

interface WeakMemberReference<Value extends object> {
    deref(): Value | undefined
}

interface WeakMemberFinalizationRegistry<Held extends object> {
    register(target: object, held: Held, token: object): void
    unregister(token: object): boolean
}

/** @internal Injectable only so cleanup correctness is deterministic in tests. */
export interface WeakMemberRuntime {
    ref<Value extends object>(target: Value): WeakMemberReference<Value>
    registry<Held extends object>(
        cleanup: (held: Held) => void,
    ): WeakMemberFinalizationRegistry<Held>
}

interface TupleRoute<Value extends object> {
    readonly parent: TupleRoute<Value> | undefined
    readonly parentKey: WeakMemberKey
    children: Map<WeakMemberKey, TupleRoute<Value>> | undefined
    entry: MemberEntry<Value> | undefined
}

interface BuildingEntry<Value extends object> {
    readonly kind: "building"
    readonly route: TupleRoute<Value>
    fault: TypeError | undefined
}

interface ReadyEntry<Value extends object> {
    readonly kind: "ready"
    readonly route: TupleRoute<Value>
    readonly reference: WeakMemberReference<Value>
}

type MemberEntry<Value extends object> =
    | BuildingEntry<Value>
    | ReadyEntry<Value>

const nativeWeakRuntime: WeakMemberRuntime = {
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

/**
 * One owner-local primitive tuple trie with weak terminal values.
 *
 * The terminal lives on the route node itself, so a tuple and its longer
 * prefix remain distinct. Map supplies SameValueZero for every positional key.
 * Empty routes are pruned after a failed build, an observed dead reference, or
 * finalization. Correctness never depends on the finalizer running: lookup
 * repairs a dead reference synchronously, and cleanup removes only the exact
 * entry generation it registered.
 *
 * @internal Exported for family/collection composition and deterministic
 * weak-runtime tests. It has no definition- or Store-domain dependencies.
 */
export class WeakTupleMemberCache<Value extends object> {
    readonly #root: TupleRoute<Value> = {
        parent: undefined,
        parentKey: undefined,
        children: undefined,
        entry: undefined,
    }
    readonly #registry: WeakMemberFinalizationRegistry<ReadyEntry<Value>>
    readonly #createMember: (args: ArrayLike<unknown>) => Value
    readonly #onReady: ((member: Value) => void) | undefined
    readonly #recursionError: () => TypeError

    constructor(
        createMember: (args: ArrayLike<unknown>) => Value,
        recursionError: () => TypeError,
        weakRuntime: WeakMemberRuntime = nativeWeakRuntime,
        onReady?: (member: Value) => void,
    ) {
        this.#createMember = createMember
        this.#onReady = onReady
        this.#recursionError = recursionError
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
    ) => WeakMemberReference<Target>

    getOrCreateOne(key: WeakMemberKey, args: ArrayLike<unknown>): Value {
        return this.#resolve(this.#descend(this.#root, key), args)
    }

    getOrCreateTuple(
        keys: ArrayLike<WeakMemberKey>,
        args: ArrayLike<unknown>,
    ): Value {
        let route = this.#root
        for (let index = 0; index < keys.length; index++) {
            route = this.#descend(route, keys[index])
        }
        return this.#resolve(route, args)
    }

    /** @internal Deterministic cleanup assertion; not exposed by owners. */
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

    /** @internal Deterministic cleanup assertion; not exposed by owners. */
    hasRoute(keys: ArrayLike<WeakMemberKey>): boolean {
        let route = this.#root
        for (let index = 0; index < keys.length; index++) {
            const child = route.children?.get(keys[index])
            if (child === undefined) return false
            route = child
        }
        return true
    }

    #descend(parent: TupleRoute<Value>, key: WeakMemberKey): TupleRoute<Value> {
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
            const fault = current.fault ?? this.#recursionError()
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
