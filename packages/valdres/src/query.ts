import { v1Domain } from "./v1-internal/public-domain"
import {
    assertDefinitionConstructionAllowed,
    getCollectionKernel,
    registerDefinitionHandle,
} from "./v1-internal/committed-store-tree/committed-store-tree"
import { collectionIndexExtractor } from "./v1-internal/collection"
import type { CollectionDraftKernel } from "./v1-internal/collection-kernel"
import {
    createCollectionQueryRuntime,
    type QueryDefinition as RuntimeQueryDefinition,
} from "./v1-internal/collection-query"
import type {
    Collection,
    CollectionKey,
    CollectionRow,
    CollectionValue,
    State,
} from "./v1-internal/committed-store-tree/types"

/** This slice supports exactly one equality term from the object grammar. */
export type QueryWhere<Indexes> = {
    [Name in keyof Indexes]: {
        readonly [Key in Name]: { readonly eq: Indexes[Name] }
    } & { readonly [Other in Exclude<keyof Indexes, Name>]?: never }
}[keyof Indexes]
export interface QueryDefinition<Indexes> {
    readonly where: QueryWhere<Indexes>
}
const definitions = new WeakMap<object, RuntimeQueryDefinition>()

export const query = <
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
    Indexes,
>(
    collection: Collection<Key, Value, Input, Indexes>,
    definition: QueryDefinition<Indexes>,
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
    const node = registerDefinitionHandle(v1Domain, {
        kind: "collection" as const,
    })
    definitions.set(node, {
        collection,
        index: name,
        value: value as CollectionKey,
        extract,
    })
    ;(getCollectionKernel(v1Domain) as CollectionDraftKernel).installIndexes(
        host => createCollectionQueryRuntime(host, definitions),
    )
    return node as unknown as State<readonly CollectionRow<Key, Value>[]>
}
