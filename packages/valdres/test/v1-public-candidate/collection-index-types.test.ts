import { expect, test } from "../performance/test-compat"
import {
    collection,
    family,
    store,
    type CollectionRow,
    type State,
} from "../../src/index"
import { query } from "../../src/query"
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
    s.dispose()
})
