import {
    assertDefinitionAccessorCallAllowed,
    assertDefinitionConstructionAllowed,
    classifyDefinitionHandleOwner,
    registerDefinitionHandle,
    runDefinitionCallback,
    type InternalCommittedStoreTreeDomain,
} from "./committed-store-tree/committed-store-tree"
import type {
    Collection,
    CollectionKey,
    CollectionOptions,
    CollectionRow,
    CollectionValue,
    Selector,
    State,
} from "./committed-store-tree/types"
import {
    WeakTupleMemberCache,
    type WeakMemberRuntime,
} from "./weak-member-cache"

interface WeakCollectionReference<Value extends object> {
    deref(): Value | undefined
}

interface CollectionDefinitionRecord {
    readonly collection: object
    readonly rows: WeakTupleMemberCache<object>
    readonly referencePresence: (
        target: Selector<boolean>,
    ) => WeakCollectionReference<Selector<boolean>>
}

interface CollectionRowRecord {
    readonly definition: CollectionDefinitionRecord
    presence: WeakCollectionReference<Selector<boolean>> | undefined
}

interface CollectionDefinitionRegistry {
    readonly collections: WeakMap<object, CollectionDefinitionRecord>
    readonly rows: WeakMap<object, CollectionRowRecord>
}

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

const NOT_THENABLE = Object.freeze({ kind: "not-thenable" as const })
const NOOP = (): void => {}
const referencePresenceNatively = (
    target: Selector<boolean>,
): WeakCollectionReference<Selector<boolean>> => new WeakRef(target)

// The optional definition module owns this table. Merely constructing the
// eager public domain therefore allocates no collection-specific registry.
let definitionRegistries:
    | WeakMap<InternalCommittedStoreTreeDomain, CollectionDefinitionRegistry>
    | undefined

const registryFor = (
    domain: InternalCommittedStoreTreeDomain,
): CollectionDefinitionRegistry => {
    const registries =
        definitionRegistries ??
        (definitionRegistries = new WeakMap<
            InternalCommittedStoreTreeDomain,
            CollectionDefinitionRegistry
        >())
    let registry = registries.get(domain)
    if (registry !== undefined) return registry
    registry = {
        collections: new WeakMap(),
        rows: new WeakMap(),
    }
    registries.set(domain, registry)
    return registry
}

/** @internal Deterministic assertion for the atom-only allocation gate. */
export const hasCollectionDefinitionRegistry = (
    domain: InternalCommittedStoreTreeDomain,
): boolean => definitionRegistries?.has(domain) ?? false

/** Stable diagnostic for a rejected direct or encoded collection key. */
export class InvalidCollectionKeyError extends Error {
    readonly code = "VALDRES_INVALID_COLLECTION_KEY"

    constructor() {
        super(
            "Collection keys must be strings, finite numbers, bigints, booleans, or null",
        )
        this.name = "InvalidCollectionKeyError"
        Object.freeze(this)
    }
}

const invalidCollectionKey = (): InvalidCollectionKeyError =>
    new InvalidCollectionKeyError()

const canonicalizeCollectionKey = (value: unknown): CollectionKey => {
    if (value === null) return null
    switch (typeof value) {
        case "string":
        case "bigint":
        case "boolean":
            return value
        case "number":
            if (!Number.isFinite(value)) throw invalidCollectionKey()
            return Object.is(value, -0) ? 0 : value
        default:
            throw invalidCollectionKey()
    }
}

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

const rejectThenableCollectionKey = (
    inspected: Extract<InspectedThenable, { kind: "thenable" }>,
): never => {
    try {
        Reflect.apply(inspected.then, inspected.target, [undefined, NOOP])
    } catch {
        // Containment never replaces the stable synchronous key failure.
    }
    throw invalidCollectionKey()
}

const runCollectionEncoder = (
    domain: InternalCommittedStoreTreeDomain,
    encodeKey: (input: unknown) => unknown,
    input: unknown,
): CollectionKey =>
    runDefinitionCallback(
        domain,
        "collection-encoder",
        (callbackInput: unknown): unknown => {
            let result: unknown
            try {
                result = Reflect.apply(encodeKey, undefined, [callbackInput])
            } catch (thrown) {
                const inspected = inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                return rejectThenableCollectionKey(inspected)
            }

            const inspected = inspectThenable(result)
            if (inspected.kind === "not-thenable") return result
            if (inspected.kind === "inspection-error") throw inspected.error
            return rejectThenableCollectionKey(inspected)
        },
        [input],
        canonicalizeCollectionKey,
        () =>
            new TypeError(
                "collection encodeKey cannot call family or collection accessors",
            ),
    )

const inspectCollectionOptions = (
    options: unknown,
): ((input: unknown) => unknown) | undefined => {
    if (options === undefined) return undefined
    if (typeof options !== "object" || options === null) {
        throw new TypeError("collection options must be an object")
    }

    for (const key of Reflect.ownKeys(options)) {
        if (key === "indexes") {
            throw new TypeError(
                "collection indexes are not available in this beta",
            )
        }
        if (key !== "encodeKey") {
            throw new TypeError("collection options contain an unknown option")
        }
    }

    if (!Object.prototype.hasOwnProperty.call(options, "encodeKey")) {
        return undefined
    }
    const encodeKey = Reflect.get(options, "encodeKey") as unknown
    if (typeof encodeKey !== "function") {
        throw new TypeError("collection encodeKey must be a function")
    }
    return encodeKey as (input: unknown) => unknown
}

const collectionRowRecursionError = (): TypeError =>
    new TypeError("collection cannot recursively construct the same row")

const invalidCollectionRow = (): TypeError =>
    new TypeError("presence requires a same-domain CollectionRow")

const rowRecordFor = (
    domain: InternalCommittedStoreTreeDomain,
    value: unknown,
): CollectionRowRecord => {
    const registry = definitionRegistries?.get(domain)
    if (
        (typeof value === "object" && value !== null) ||
        typeof value === "function"
    ) {
        const record = registry?.rows.get(value)
        if (record !== undefined) return record
    }
    // The owner walk is intentionally miss-only. It distinguishes a foreign
    // branded handle from an unbranded fake without taxing the hot presence
    // identity path.
    classifyDefinitionHandleOwner(domain, value)
    throw invalidCollectionRow()
}

export function createCollectionDefinition<
    Key extends CollectionKey,
    Value extends CollectionValue,
>(
    domain: InternalCommittedStoreTreeDomain,
    options?: CollectionOptions<Key, Value>,
    weakRuntime?: WeakMemberRuntime,
): Collection<Key, Value>
export function createCollectionDefinition<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
>(
    domain: InternalCommittedStoreTreeDomain,
    options: CollectionOptions<Key, Value, Input>,
    weakRuntime?: WeakMemberRuntime,
): Collection<Key, Value, Input>
/** @internal Store-free collection definition composed by the future root API. */
export function createCollectionDefinition(
    domain: InternalCommittedStoreTreeDomain,
    options?: unknown,
    weakRuntime?: WeakMemberRuntime,
): Collection<CollectionKey, CollectionValue, unknown> {
    assertDefinitionConstructionAllowed(domain)
    const encodeKey = inspectCollectionOptions(options)
    const rowFactoryArguments: CollectionKey[] = []
    let definition: CollectionDefinitionRecord

    const mutableCollection = Object.assign(
        function collection(input: unknown): object {
            assertDefinitionAccessorCallAllowed(domain)
            const key =
                encodeKey === undefined
                    ? canonicalizeCollectionKey(input)
                    : runCollectionEncoder(domain, encodeKey, input)
            // Only the canonical scalar reaches the cache. Rich lookup inputs
            // are never captured by a row factory or retained in metadata.
            rowFactoryArguments[0] = key
            try {
                return definition.rows.getOrCreateOne(key, rowFactoryArguments)
            } finally {
                rowFactoryArguments.pop()
            }
        },
        { kind: "collection" as const },
    )
    const collection = registerDefinitionHandle(
        domain,
        mutableCollection,
    ) as Collection<CollectionKey, CollectionValue, unknown>
    const registry = registryFor(domain)
    const rows = new WeakTupleMemberCache<object>(
        args => {
            const key = args[0] as CollectionKey
            return registerDefinitionHandle(domain, {
                kind: "collection-row" as const,
                key,
            })
        },
        collectionRowRecursionError,
        weakRuntime,
        row => {
            registry.rows.set(row, {
                definition,
                presence: undefined,
            })
        },
    )
    definition = Object.freeze({
        collection,
        rows,
        referencePresence:
            weakRuntime === undefined
                ? referencePresenceNatively
                : (target: Selector<boolean>) => weakRuntime.ref(target),
    })
    registry.collections.set(collection, definition)
    return collection
}

/** @internal Weakly memoizes the ordinary Selector used by public presence(). */
export const getCollectionPresence = <
    Key extends CollectionKey,
    Value extends CollectionValue,
>(
    domain: InternalCommittedStoreTreeDomain,
    row: CollectionRow<Key, Value>,
): Selector<boolean> => {
    assertDefinitionAccessorCallAllowed(domain)
    const record = rowRecordFor(domain, row)
    const current = record.presence?.deref()
    if (current !== undefined) return current

    const presence = domain.selector(
        get => get(row as unknown as State<Value | undefined>) !== undefined,
    )
    record.presence = record.definition.referencePresence(presence)
    return presence
}
