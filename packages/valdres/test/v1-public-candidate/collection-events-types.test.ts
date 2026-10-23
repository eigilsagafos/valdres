import { expect, test } from "bun:test"
import {
    atom,
    collection,
    selector,
    store,
    type Collection,
    type CollectionEvent,
    type CollectionKey,
    type CollectionValue,
    type State,
    type Store,
    type SubscribeFn,
} from "../../src/index"

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false

const assertType = <Condition extends true>(): void => {}

interface Mutation {
    readonly id: string
    readonly debounceCount: number
}

test("infers event keys and values from the collection", () => {
    const s = store()
    const mutations = collection<string, Mutation>()
    const users = collection<`user:${string}`, number, { id: string }>({
        encodeKey: input => `user:${input.id}`,
    })
    const indexed = collection<
        number,
        { readonly kind: string },
        number,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })

    s.sub(mutations, event => {
        assertType<Equal<typeof event, CollectionEvent<string, Mutation>>>()
        switch (event.type) {
            case "added":
                assertType<Equal<typeof event.key, string>>()
                assertType<Equal<typeof event.value, Mutation>>()
                break
            case "updated":
                assertType<Equal<typeof event.previous, Mutation>>()
                assertType<Equal<typeof event.value, Mutation>>()
                break
            case "deleted":
                assertType<Equal<typeof event.previous, Mutation>>()
                // @ts-expect-error A deleted row has no value.
                void event.value
                break
            case "reordered":
                // @ts-expect-error A reorder carries no key.
                void event.key
                break
            default:
                assertType<Equal<typeof event, never>>()
        }
    })
    s.sub(users, event => {
        if (event.type !== "reordered")
            assertType<Equal<typeof event.key, `user:${string}`>>()
    })
    s.sub(indexed, event => {
        assertType<
            Equal<typeof event, CollectionEvent<number, { readonly kind: string }>>
        >()
    })
    expect(true).toBe(true)
})

test("keeps event metadata readonly", () => {
    const s = store()
    const rows = collection<string, number>()
    s.sub(rows, event => {
        if (event.type === "updated") {
            // @ts-expect-error Events are readonly.
            event.previous = 1
        }
        // @ts-expect-error Events are readonly.
        event.type = "reordered"
    })
    expect(true).toBe(true)
})

test("keeps every other subscription form and generic caller compatible", () => {
    const s = store()
    const rows = collection<string, number>()
    const count = atom(0)
    const membership = selector(get => get(rows))

    s.sub(rows, () => {})
    s.sub(rows, { notify: () => {} })
    s.sub(rows, { settle: tx => tx.set(count, 1) })
    s.sub(rows("a"), () => {})
    s.sub(membership, () => {})
    s.sub(count, () => {})
    // @ts-expect-error Only collection callbacks receive an event.
    s.sub(count, (event: unknown) => event)
    // @ts-expect-error Rows are not collections.
    s.sub(rows("a"), (event: CollectionEvent<string, number>) => event)
    // @ts-expect-error The event type follows the collection.
    s.sub(rows, (event: CollectionEvent<string, string>) => event)

    const subscribe: SubscribeFn = s.sub
    subscribe(rows, () => {})
    const generic = <Value>(target: Store, state: State<Value>) =>
        target.sub(state, () => {})
    generic(s, rows)
    const anyCollection = <
        Key extends CollectionKey,
        Value extends CollectionValue,
    >(
        target: Store,
        source: Collection<Key, Value>,
    ) => target.sub(source, event => event.type)
    anyCollection(s, rows)

    assertType<
        Equal<
            CollectionEvent<string, number>,
            | { readonly type: "added"; readonly key: string; readonly value: number }
            | {
                  readonly type: "updated"
                  readonly key: string
                  readonly previous: number
                  readonly value: number
              }
            | {
                  readonly type: "deleted"
                  readonly key: string
                  readonly previous: number
              }
            | { readonly type: "reordered" }
        >
    >()
    // @ts-expect-error Values exclude undefined, which marks absence.
    type Rejected = CollectionEvent<string, undefined>
    expect(true).toBe(true)
})
