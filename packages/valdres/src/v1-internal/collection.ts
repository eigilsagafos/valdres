import {
    assertDefinitionAccessorCallAllowed,
    assertDefinitionConstructionAllowed,
    classifyDefinitionHandleOwner,
    ensureCollectionKernel,
    getDefinitionDomainIdentity,
    registerDefinitionHandle,
    runDefinitionCallback,
    type InternalCommittedStoreTreeDomain,
} from "./committed-store-tree/committed-store-tree"
import {
    containThenable as containRuntimeThenable,
    inspectThenable as inspectRuntimeThenable,
    runGuardedCallback as runRuntimeGuardedCallback,
} from "./committed-store-tree/runtime-domain"
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
import { createCollectionKernel } from "./collection-kernel"

interface WeakCollectionReference<Value extends object> {
    deref(): Value | undefined
}

interface CollectionDefinitionRecord {
    readonly collection: object
    readonly indexes:
        | Readonly<Record<string, (value: unknown) => unknown>>
        | undefined
    readonly name?: unknown
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

const referencePresenceNatively = (
    target: Selector<boolean>,
): WeakCollectionReference<Selector<boolean>> => new WeakRef(target)

// The optional definition module owns this table. Merely constructing the
// eager public domain therefore allocates no collection-specific registry.
let definitionRegistries:
    | WeakMap<object, CollectionDefinitionRegistry>
    | undefined

const registryFor = (
    domain: InternalCommittedStoreTreeDomain,
): CollectionDefinitionRegistry => {
    const identity = getDefinitionDomainIdentity(domain)
    const registries =
        definitionRegistries ??
        (definitionRegistries = new WeakMap<
            object,
            CollectionDefinitionRegistry
        >())
    let registry = registries.get(identity)
    if (registry !== undefined) return registry
    registry = {
        collections: new WeakMap(),
        rows: new WeakMap(),
    }
    registries.set(identity, registry)
    return registry
}

/** @internal Deterministic assertion for the atom-only allocation gate. */
export const hasCollectionDefinitionRegistry = (
    domain: InternalCommittedStoreTreeDomain,
): boolean =>
    definitionRegistries?.has(getDefinitionDomainIdentity(domain)) ?? false

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

const rejectThenableCollectionKey = (
    inspected: Extract<
        ReturnType<typeof inspectRuntimeThenable>,
        { kind: "thenable" }
    >,
): never => {
    containRuntimeThenable(inspected)
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
                const inspected = inspectRuntimeThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                return rejectThenableCollectionKey(inspected)
            }

            const inspected = inspectRuntimeThenable(result)
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

interface InspectedCollectionOptions {
    readonly encodeKey?: (input: unknown) => unknown
    readonly name?: unknown
}

const inspectCollectionOptions = (
    options: unknown,
): InspectedCollectionOptions => {
    if (options === undefined) return {}
    if (typeof options !== "object" || options === null) {
        throw new TypeError("collection options must be an object")
    }

    for (const key of Reflect.ownKeys(options)) {
        if (key !== "encodeKey" && key !== "indexes" && key !== "name") {
            throw new TypeError("collection options contain an unknown option")
        }
    }

    let encodeKey: ((input: unknown) => unknown) | undefined
    if (Object.prototype.hasOwnProperty.call(options, "encodeKey")) {
        const candidate = Reflect.get(options, "encodeKey") as unknown
        if (typeof candidate !== "function") {
            throw new TypeError("collection encodeKey must be a function")
        }
        encodeKey = candidate as (input: unknown) => unknown
    }
    const name = Reflect.get(options, "name") as unknown
    return {
        ...(encodeKey === undefined ? {} : { encodeKey }),
        ...(name === undefined ? {} : { name }),
    }
}

const collectionRowRecursionError = (): TypeError =>
    new TypeError("collection cannot recursively construct the same row")

const invalidCollectionRow = (): TypeError =>
    new TypeError("presence requires a same-domain CollectionRow")

const rowRecordFor = (
    domain: InternalCommittedStoreTreeDomain,
    value: unknown,
): CollectionRowRecord => {
    const registry = definitionRegistries?.get(
        getDefinitionDomainIdentity(domain),
    )
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
/** @internal Store-free collection definition composed by the root API. */
export function createCollectionDefinition(
    domain: InternalCommittedStoreTreeDomain,
    options?: unknown,
    weakRuntime?: WeakMemberRuntime,
): Collection<CollectionKey, CollectionValue, unknown> {
    assertDefinitionConstructionAllowed(domain)
    const { encodeKey, name } = inspectCollectionOptions(options)
    let indexes:
        | Readonly<Record<string, (value: unknown) => unknown>>
        | undefined
    if (
        options !== undefined &&
        Object.prototype.hasOwnProperty.call(options, "indexes")
    ) {
        const input = Reflect.get(options as object, "indexes") as unknown
        if (typeof input !== "object" || input === null || Array.isArray(input))
            throw new TypeError("collection indexes must be an extractor map")
        const entries = Reflect.ownKeys(input).map(key => {
            const extract = Reflect.get(input, key) as unknown
            if (typeof key !== "string" || typeof extract !== "function")
                throw new TypeError(
                    "collection indexes must be named scalar extractors",
                )
            return [key, extract as (value: unknown) => unknown] as const
        })
        if (entries.length) indexes = Object.freeze(Object.fromEntries(entries))
    }
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
    let registry: CollectionDefinitionRegistry | undefined
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
            if (registry === undefined) {
                throw new Error("Collection definition registry is not ready")
            }
            registry.rows.set(row, {
                definition,
                presence: undefined,
            })
        },
    )
    definition = Object.freeze({
        collection,
        indexes,
        ...(name === undefined ? {} : { name }),
        rows,
        referencePresence:
            weakRuntime === undefined
                ? referencePresenceNatively
                : (target: Selector<boolean>) => weakRuntime.ref(target),
    })
    registry = registryFor(domain)
    registry.collections.set(collection, definition)
    ensureCollectionKernel(domain, records =>
        createCollectionKernel({
            lookupRow: row =>
                registry.rows.get(row as object)?.definition.collection,
            lookupCollection: candidate =>
                registry.collections.has(candidate as object),
            lookupDiagnosticName: node => {
                const rowDefinition = registry.rows.get(node)?.definition
                return (
                    rowDefinition?.name ?? registry.collections.get(node)?.name
                )
            },
            runGuarded: (session, operation) =>
                runRuntimeGuardedCallback(records, session, operation),
            inspectThenable: inspectRuntimeThenable,
            containThenable: containRuntimeThenable,
        }),
    )
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

/** @internal Query registration stays in its separately reachable module. */
export const collectionIndexExtractor = (
    domain: InternalCommittedStoreTreeDomain,
    collection: object,
    name: string,
): ((value: unknown) => CollectionKey) => {
    const definition = definitionRegistries
        ?.get(getDefinitionDomainIdentity(domain))
        ?.collections.get(collection)
    if (definition === undefined) {
        classifyDefinitionHandleOwner(domain, collection)
        throw new TypeError("query requires a same-domain Collection")
    }
    const extract =
        definition.indexes !== undefined &&
        Object.prototype.hasOwnProperty.call(definition.indexes, name)
            ? definition.indexes[name]
            : undefined
    if (extract === undefined)
        throw new TypeError("query requires a declared equality index")
    return value =>
        runDefinitionCallback(
            domain,
            "collection-encoder",
            (input: unknown) => {
                let result: unknown
                try {
                    result = extract(input)
                } catch (error) {
                    const inspected = inspectRuntimeThenable(error)
                    if (inspected.kind === "thenable") {
                        containRuntimeThenable(inspected)
                        throw new TypeError(
                            "Index extractors must return a synchronous scalar",
                        )
                    }
                    if (inspected.kind === "inspection-error")
                        throw inspected.error
                    throw error
                }
                const inspected = inspectRuntimeThenable(result)
                if (inspected.kind === "thenable") {
                    containRuntimeThenable(inspected)
                    throw new TypeError(
                        "Index extractors must return a synchronous scalar",
                    )
                }
                if (inspected.kind === "inspection-error") throw inspected.error
                return canonicalizeCollectionKey(result)
            },
            [value],
        )
}
