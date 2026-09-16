import { expect, test } from "../performance/test-compat"
import {
    collection,
    family,
    store,
    type CollectionRow,
    type State,
} from "../../src/index"
import { query, type QueryDefinition, type QueryWhere } from "../../src/query"
import {
    collection as v1Collection,
    type CollectionOptions as V1Options,
} from "../../src/v1"
import type { CollectionOptions } from "../../src/index"
import type { CollectionOptions as InternalOptions } from "../../src/v1-internal/committed-store-tree/types"

type EntityRef = `entity:${string}`
type Entity = { kind: "task" | "person"; title: string }
interface EntityIndexes {
    kind: Entity["kind"]
}
const entities = collection<EntityRef, Entity, EntityRef, EntityIndexes>({
    indexes: { kind: entity => entity.kind },
})
const tasks = query(entities, { where: { kind: { eq: "task" } } })
const readable: State<readonly CollectionRow<EntityRef, Entity>[]> = tasks
const taskDefinition = { where: { kind: { eq: "task" as const } } }
const declaredDefinition: QueryDefinition<EntityIndexes> = {
    where: { kind: { eq: "person" } },
}
const declaredWhere: QueryWhere<EntityIndexes> = { kind: { eq: "task" } }
const variableTasks: typeof tasks = query(entities, taskDefinition)
const declaredPeople: typeof tasks = query(entities, declaredDefinition)
const typedTasks: typeof tasks = query(entities, { where: declaredWhere })
if (false) {
    // @ts-expect-error Typed index metadata requires the corresponding declaration.
    collection<string, Entity, string, { kind: Entity["kind"] }>({})
    // @ts-expect-error Rich inputs require encodeKey options.
    collection<string, Entity, { id: string }>()
    // @ts-expect-error Index values retain their literal union.
    query(entities, { where: { kind: { eq: "invalid" } } })
    // @ts-expect-error Undeclared indexes are unavailable.
    query(entities, { where: { title: { eq: "hi" } } })
    // @ts-expect-error Range operators are outside the equality slice.
    query(entities, { where: { kind: { gt: "task" } } })
    // @ts-expect-error Query results are readonly State, never writable atoms.
    store().set(tasks, [])
    // @ts-expect-error family remains its independent Atom/Selector product lane.
    family(() => tasks)
    collection<string, Entity, string, { kind: Entity["kind"] }>({
        // @ts-expect-error Extractors must return the declared synchronous scalar.
        indexes: { kind: async entity => entity.kind },
    })
    // @ts-expect-error Object-valued indexes are not scalar equality indexes.
    collection<string, Entity, string, { kind: Entity }>({
        indexes: { kind: (entity: Entity) => entity },
    })
    collection<string, Entity>({
        // @ts-expect-error Index metadata is required for typed index declarations.
        indexes: { kind: (entity: Entity) => entity.kind },
    })
}
test("indexed collection and query declarations retain their row types", () => {
    const s = store()
    expect(s.get(readable)).toEqual([])
    expect(variableTasks).toBe(tasks)
    expect(typedTasks).toBe(tasks)
    expect(s.get(declaredPeople)).toEqual([])
    s.dispose()
})

interface OptionalIndexes {
    kind?: "task"
}
declare const tag: unique symbol
interface SymbolIndexes {
    [tag]: "task"
}
type BroadIndexes = Record<string, string>
type AliasIndexes = { kind: Entity["kind"]; readonly title: string }
const aliased = collection<EntityRef, Entity, EntityRef, AliasIndexes>({
    indexes: { kind: value => value.kind, title: value => value.title },
})
const v1Named = v1Collection<EntityRef, Entity, EntityRef, EntityIndexes>({
    indexes: { kind: value => value.kind },
})
query(aliased, { where: { title: { eq: "title" } } })
query(v1Named, { where: { kind: { eq: "task" } } })
if (false) {
    // Each variable has valid literal scalar types, isolating its grammar error.
    const topLevelExtra = { ...taskDefinition, limit: 1 }
    // @ts-expect-error Predeclared definitions cannot add a top-level field.
    query(entities, topLevelExtra)
    const unknownIndex = { where: { missing: { eq: "task" as const } } }
    // @ts-expect-error Predeclared definitions must name a declared index.
    query(entities, unknownIndex)
    const unknownOperator = { where: { kind: { gt: "task" as const } } }
    // @ts-expect-error Predeclared definitions must use eq.
    query(entities, unknownOperator)
    const extraOperator = {
        where: { kind: { eq: "task" as const, gt: "person" as const } },
    }
    // @ts-expect-error A valid eq cannot hide another operator in a variable.
    query(entities, extraOperator)
    const multipleIndexes = {
        where: { kind: { eq: "task" as const }, title: { eq: "title" } },
    }
    // @ts-expect-error Both indexes exist, but only one term is supported.
    query(aliased, multipleIndexes)
    const extraIndex = {
        where: { kind: { eq: "task" as const }, missing: { eq: "task" } },
    }
    // @ts-expect-error A valid index cannot hide an extra unknown index.
    query(entities, extraIndex)
    const nestedExtra = {
        where: { kind: { eq: "task" as const, metadata: { label: "task" } } },
    }
    // @ts-expect-error Nested properties are checked even on predeclared terms.
    query(entities, nestedExtra)
    const invalidScalar = { where: { kind: { eq: "invalid" as const } } }
    // @ts-expect-error Predeclared scalar values retain the index's literal union.
    query(entities, invalidScalar)
    // @ts-expect-error Inline definitions still reject top-level extras.
    query(entities, { where: { kind: { eq: "task" } }, limit: 1 })
    // @ts-expect-error Optional declarations cannot describe a runtime index map.
    collection<string, Entity, string, OptionalIndexes>({ indexes: {} })
    // @ts-expect-error Symbol names are not runtime index names.
    collection<string, Entity, string, SymbolIndexes>({
        indexes: { [tag]: (_entity: Entity) => "task" as const },
    })
    // @ts-expect-error A broad signature does not declare finite required names.
    collection<string, Entity, string, BroadIndexes>({ indexes: {} })
    // @ts-expect-error Numeric names are outside the string-named schema.
    collection<string, Entity, string, { 0: string }>({
        indexes: { 0: (entity: Entity) => entity.title },
    })
    // @ts-expect-error A never value cannot hide a broad signature.
    collection<string, Entity, string, Record<string, never>>({ indexes: {} })
    // @ts-expect-error Template-pattern index signatures are not finite declarations.
    collection<string, Entity, string, Record<`by_${string}`, string>>({
        indexes: {},
    })
    // @ts-expect-error The v1 entry applies the same optional-key restriction.
    v1Collection<string, Entity, string, OptionalIndexes>({ indexes: {} })
    // @ts-expect-error The root options alias applies the same schema restriction.
    const rootOptions: CollectionOptions<string, Entity, string, BroadIndexes> =
        {}
    // @ts-expect-error The v1 options alias applies the same schema restriction.
    const v1Options: V1Options<string, Entity, string, SymbolIndexes> = {}
    // @ts-expect-error Internal options cannot admit optional declarations either.
    type Bad = InternalOptions<string, Entity, string, OptionalIndexes>
    const internalOptions: Bad = null as never
    // @ts-expect-error Unknown index names remain rejected in the nested where object.
    query(aliased, { where: { missing: { eq: "task" } } })
    // @ts-expect-error Unknown nested operators are not part of equality queries.
    query(aliased, { where: { kind: { eq: "task", missing: true } } })
    void rootOptions
    void v1Options
    void internalOptions
}
