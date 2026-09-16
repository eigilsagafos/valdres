import type { QueryDefinition } from "../types/QueryDefinition"
import type { ExactQueryDefinition } from "../v1-internal/query-definition"
import { WeakTupleMemberCache } from "../v1-internal/weak-member-cache"
import { v1Domain } from "../v1-internal/public-domain"
import {
    assertDefinitionConstructionAllowed,
    getCollectionKernel,
    registerDefinitionHandle,
} from "../v1-internal/committed-store-tree/committed-store-tree"
import { collectionIndexExtractor } from "../v1-internal/collection"
import type { CollectionDraftKernel } from "../v1-internal/collection-kernel"
import {
    createCollectionQueryRuntime,
    type QueryDefinition as RuntimeQueryDefinition,
} from "../v1-internal/collection-query"
import type {
    Collection,
    CollectionKey,
    CollectionRow,
    CollectionValue,
    State,
} from "../v1-internal/committed-store-tree/types"

const definitions = new WeakMap<object, RuntimeQueryDefinition>()
const queries = new WeakMap<object, WeakTupleMemberCache<object>>()

export const query = <
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
    Indexes,
    const Definition extends QueryDefinition<Indexes>,
>(
    collection: Collection<Key, Value, Input, Indexes>,
    definition: Definition & ExactQueryDefinition<Indexes, Definition>,
): State<readonly CollectionRow<Key, Value>[]> => {
    assertDefinitionConstructionAllowed(v1Domain)
    if (
        typeof definition !== "object" ||
        definition === null ||
        Reflect.ownKeys(definition).length !== 1 ||
        !Object.hasOwn(definition, "where")
    )
        throw new TypeError(
            "query requires { where: { index: { eq: scalar } } }",
        )
    const where = definition.where
    if (
        typeof where !== "object" ||
        where === null ||
        Reflect.ownKeys(where).length !== 1
    )
        throw new TypeError("query requires one equality term")
    const name = Reflect.ownKeys(where)[0]!
    if (typeof name !== "string")
        throw new TypeError("query requires a named index")
    const term = Reflect.get(where, name) as unknown
    if (
        typeof term !== "object" ||
        term === null ||
        Reflect.ownKeys(term).length !== 1 ||
        !Object.hasOwn(term, "eq")
    )
        throw new TypeError("query supports only eq")
    const value = Reflect.get(term, "eq") as unknown
    if (
        !(
            value === null ||
            ["string", "boolean", "bigint"].includes(typeof value) ||
            (typeof value === "number" && Number.isFinite(value))
        )
    )
        throw new TypeError("query equality value must be a finite scalar")
    const extract = collectionIndexExtractor(v1Domain, collection, name)
    let cache = queries.get(collection)
    if (cache === undefined) {
        cache = new WeakTupleMemberCache<object>(
            args => {
                const node = registerDefinitionHandle(v1Domain, {
                    kind: "collection" as const,
                })
                definitions.set(node, args[0] as RuntimeQueryDefinition)
                return node
            },
            () =>
                new TypeError(
                    "query cannot recursively construct the same lookup",
                ),
        )
        queries.set(collection, cache)
    }
    const node = cache.getOrCreateTuple(
        [name, value as CollectionKey],
        [
            {
                collection,
                index: name,
                value: value === 0 ? 0 : (value as CollectionKey),
                extract,
            } satisfies RuntimeQueryDefinition,
        ],
    )
    ;(getCollectionKernel(v1Domain) as CollectionDraftKernel).installIndexes(
        host => createCollectionQueryRuntime(host, definitions),
    )
    return node as unknown as State<readonly CollectionRow<Key, Value>[]>
}
