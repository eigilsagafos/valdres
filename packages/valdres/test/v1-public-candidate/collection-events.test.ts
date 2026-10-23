import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    SubscriberNotificationError,
    atom,
    collection,
    externalAtom,
    selector,
    store,
    type Collection,
    type CollectionEvent,
    type CollectionKey,
    type CollectionValue,
    type Store,
} from "../../src/index"
import { createInspectableStore } from "../../src/inspect"
import { query } from "../../src/query"

/**
 * A direct `Store.sub(collection, callback)` receives each committed
 * transaction's net row changes in the subscribed Store's effective view, then
 * at most one `reordered`. The handler form and selectors keep value
 * (membership) semantics.
 */

type Event = CollectionEvent<CollectionKey, CollectionValue>
type AnyCollection = Collection<any, any, any, any>

const record = (target: Store, rows: AnyCollection) => {
    const events: Event[] = []
    const stop = target.sub(rows, (event: Event) => events.push(event))
    return {
        stop,
        take: (): Event[] => events.splice(0),
    }
}

const keys = (target: Store, rows: AnyCollection): string[] =>
    target.get(rows).map(row => String(row.key))

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("net row events", () => {
    test("classifies each key by its committed and final presence and value", () => {
        const rows = collection<string, string>()
        const s = store()
        s.txn(tx => {
            tx.set(rows("keep"), "k")
            tx.set(rows("change"), "c0")
            tx.set(rows("remove"), "r0")
        })
        const seen = record(s, rows)

        s.txn(tx => {
            tx.set(rows("added"), "a0")
            tx.set(rows("added"), "a1") // add -> update: one added
            tx.set(rows("change"), "c1")
            tx.set(rows("change"), "c2") // update -> update: one updated
            tx.set(rows("ghost"), "g")
            tx.delete(rows("ghost")) // add -> delete: nothing
            tx.set(rows("keep"), "k1")
            tx.set(rows("keep"), "k") // restored by Object.is: nothing
            tx.delete(rows("absent")) // absent -> absent: nothing
            tx.set(rows("remove"), "r1")
            tx.delete(rows("remove")) // update -> delete: one deleted
        })

        expect(seen.take()).toEqual([
            { type: "added", key: "added", value: "a1" },
            { type: "updated", key: "change", previous: "c0", value: "c2" },
            { type: "deleted", key: "remove", previous: "r0" },
        ])
    })

    test("orders rows by first staged change, in one phase for every type", () => {
        const rows = collection<string, number>()
        const s = store()
        s.txn(tx => {
            tx.set(rows("A"), 0)
            tx.set(rows("B"), 0)
            tx.set(rows("C"), 0)
        })
        const seen = record(s, rows)

        s.txn(tx => {
            tx.delete(rows("B"))
            tx.set(rows("X"), 1)
            tx.set(rows("A"), 1)
            tx.delete(rows("C"))
            tx.set(rows("B"), 2) // B returns: classified against its original
            tx.set(rows("A"), 2) // a repeat does not move A
        })

        expect(seen.take()).toEqual([
            { type: "updated", key: "B", previous: 0, value: 2 },
            { type: "added", key: "X", value: 1 },
            { type: "updated", key: "A", previous: 0, value: 2 },
            { type: "deleted", key: "C", previous: 0 },
        ])
        // B moved after X, but A and B keep their relative order.
        expect(keys(s, rows)).toEqual(["A", "X", "B"])
    })

    test("uses Object.is: an equal-looking new object is an update", () => {
        const rows = collection<string, { readonly n: number }>()
        const s = store()
        const first = { n: 1 }
        s.set(rows("a"), first)
        const seen = record(s, rows)

        s.set(rows("a"), first)
        s.update(rows("a"), current => current)
        expect(seen.take()).toEqual([])

        const copy = { n: 1 }
        s.set(rows("a"), copy)
        const [event] = seen.take()
        expect(event).toEqual({
            type: "updated",
            key: "a",
            previous: first,
            value: copy,
        })
        if (event?.type !== "updated") throw new Error("expected an update")
        expect(event.previous).toBe(first)
        expect(event.value).toBe(copy)
    })

    test("passes value references through and freezes event metadata", () => {
        const rows = collection<string, { n: number }>()
        const s = store()
        const value = { n: 1 }
        const received: Event[] = []
        s.sub(rows, event => {
            received.push(event)
            expect(() => {
                ;(event as { type: string }).type = "deleted"
            }).toThrow(TypeError)
        })
        s.sub(rows, event => received.push(event))

        s.set(rows("a"), value)

        expect(received).toHaveLength(2)
        expect(received[0]).toBe(received[1]!)
        expect(Object.isFrozen(received[0])).toBe(true)
        expect(received[0]).toEqual({ type: "added", key: "a", value })
        if (received[0]?.type !== "added") throw new Error("expected added")
        expect(received[0].value).toBe(value)
        expect(Object.isFrozen(value)).toBe(false)
    })

    test("reports canonical and rich-input keys as the collection's Key", () => {
        const rows = collection<string, number, { readonly id: string }>({
            encodeKey: input => `user:${input.id}`,
        })
        const numeric = collection<number, string>()
        const s = store()
        const seen = record(s, rows)
        const numericSeen = record(s, numeric)

        s.set(rows({ id: "7" }), 1)
        s.set(numeric(-0), "zero")

        expect(seen.take()).toEqual([
            { type: "added", key: "user:7", value: 1 },
        ])
        const [zero] = numericSeen.take()
        expect(zero).toEqual({ type: "added", key: 0, value: "zero" })
        expect(Object.is((zero as { key: number }).key, 0)).toBe(true)
    })

    test("publishes nothing for rollback, a failed transaction, or a no-op", () => {
        const rows = collection<string, number>()
        const s = store()
        s.set(rows("a"), 1)
        const seen = record(s, rows)
        const failure = new Error("abort")

        expect(
            thrownBy(() =>
                s.txn(tx => {
                    tx.set(rows("b"), 2)
                    tx.set(rows("a"), 3)
                    throw failure
                }),
            ),
        ).toBe(failure)
        s.set(rows("a"), 1)
        s.delete(rows("missing"))
        s.txn(() => {})

        expect(seen.take()).toEqual([])
        expect(s.get(rows("b"))).toBeUndefined()
    })

    test("keeps separate committed transactions separate, in commit order", () => {
        const rows = collection<string, number>()
        const s = store()
        const batches: Event[][] = []
        let batch: Event[] | undefined
        s.sub(rows, event => {
            if (batch === undefined) {
                batch = []
                batches.push(batch)
                queueMicrotask(() => (batch = undefined))
            }
            batch.push(event)
        })
        const calls: string[] = []
        s.sub(rows, event =>
            calls.push(`${event.type}:${"key" in event ? event.key : ""}`),
        )

        s.set(rows("a"), 1)
        s.set(rows("a"), 2)
        s.txn(tx => tx.set(rows("b"), 1))

        // All three commits ran in one tick; none was merged with another.
        expect(calls).toEqual(["added:a", "updated:a", "added:b"])
        expect(batches).toHaveLength(1)
        expect(batches[0]).toEqual([
            { type: "added", key: "a", value: 1 },
            { type: "updated", key: "a", previous: 1, value: 2 },
            { type: "added", key: "b", value: 1 },
        ])
    })

    test("separates collections and keeps each collection's events on its own subscription", () => {
        const first = collection<string, number>()
        const second = collection<string, number>()
        const s = store()
        const order: string[] = []
        s.sub(second, event => order.push(`second:${event.type}`))
        s.sub(first, event => order.push(`first:${event.type}`))

        s.txn(tx => {
            tx.set(first("a"), 1)
            tx.set(second("b"), 2)
            tx.set(first("c"), 3)
        })

        expect(order).toEqual(["first:added", "first:added", "second:added"])
    })
})

describe("ordering ignores writes that change nothing", () => {
    const writeABA = (
        target: Store,
        rows: AnyCollection,
        first: (tx: Parameters<Parameters<Store["txn"]>[0]>[0]) => void,
        a: unknown = "a",
    ) =>
        target.txn(tx => {
            first(tx)
            tx.set(rows("B"), "b")
            tx.set(rows("A"), a)
        })

    test("a deletion of an already-absent row reserves no position", () => {
        const rows = collection<string, string>()
        const s = store()
        const seen = record(s, rows)

        writeABA(s, rows, tx => tx.delete(rows("A")))

        expect(seen.take()).toEqual([
            { type: "added", key: "B", value: "b" },
            { type: "added", key: "A", value: "a" },
        ])
    })

    test("control: deleting a present row is a change and keeps its position", () => {
        const rows = collection<string, string>()
        const s = store()
        s.set(rows("A"), "a0")
        const seen = record(s, rows)

        writeABA(s, rows, tx => tx.delete(rows("A")), "a2")

        expect(seen.take()).toEqual([
            { type: "updated", key: "A", previous: "a0", value: "a2" },
            { type: "added", key: "B", value: "b" },
        ])
    })

    test("control: repeated writes keep the first position", () => {
        const rows = collection<string, string>()
        const s = store()
        const seen = record(s, rows)

        writeABA(s, rows, tx => tx.set(rows("A"), "a1"), "a2")

        expect(seen.take()).toEqual([
            { type: "added", key: "A", value: "a2" },
            { type: "added", key: "B", value: "b" },
        ])
    })

    test("same-value writes, identity updates and resets of absent rows reserve nothing", () => {
        const rows = collection<string, string>()
        const s = store()
        s.set(rows("A"), "a0")
        const seen = record(s, rows)
        const cases = [
            (tx: Parameters<Parameters<Store["txn"]>[0]>[0]) =>
                tx.set(rows("A"), "a0"),
            (tx: Parameters<Parameters<Store["txn"]>[0]>[0]) =>
                tx.update(rows("A"), value => value),
        ]
        for (const [index, first] of cases.entries()) {
            writeABA(s, rows, first, `a${index + 1}`)
            s.delete(rows("B"))
            expect(seen.take().slice(0, 2)).toEqual([
                { type: "added", key: "B", value: "b" },
                {
                    type: "updated",
                    key: "A",
                    previous: `a${index}`,
                    value: `a${index + 1}`,
                },
            ])
        }
        s.delete(rows("A"))
        seen.take()
        writeABA(s, rows, tx => tx.reset(rows("A")))
        expect(seen.take()).toEqual([
            { type: "added", key: "B", value: "b" },
            { type: "added", key: "A", value: "a" },
        ])
    })

    test("ownership-only child writes reserve no position", () => {
        const rows = collection<string, string>()
        const root = store()
        root.set(rows("Shared"), "inherited")
        const tombstone = root.scope("tombstone")
        const override = root.scope("override")
        const reset = root.scope("reset")
        reset.set(rows("Shared"), "inherited") // an override equal to the parent
        const seen = {
            tombstone: record(tombstone, rows),
            override: record(override, rows),
            reset: record(reset, rows),
            root: record(root, rows),
        }

        root.txn(tx => {
            const deleted = tx.scope(tombstone)
            deleted.delete(rows("A")) // absent everywhere: a tombstone only
            deleted.set(rows("B"), "b")
            deleted.set(rows("A"), "a")

            const pinned = tx.scope(override)
            pinned.set(rows("Shared"), "inherited") // keeps the inherited value
            pinned.set(rows("B"), "b")
            pinned.set(rows("Shared"), "own")

            const released = tx.scope(reset)
            released.reset(rows("Shared")) // inherits the equal value
            released.set(rows("B"), "b")
            released.set(rows("Shared"), "own")
        })

        expect(seen.tombstone.take()).toEqual([
            { type: "added", key: "B", value: "b" },
            { type: "added", key: "A", value: "a" },
        ])
        for (const scopeSeen of [seen.override, seen.reset])
            expect(scopeSeen.take()).toEqual([
                { type: "added", key: "B", value: "b" },
                {
                    type: "updated",
                    key: "Shared",
                    previous: "inherited",
                    value: "own",
                },
            ])
        expect(seen.root.take()).toEqual([])
    })

    test("a root deletion of an absent row reserves no position below it", () => {
        const rows = collection<string, string>()
        const root = store()
        const child = root.scope("child")
        const seen = record(child, rows)

        writeABA(root, rows, tx => tx.delete(rows("A")))

        expect(seen.take()).toEqual([
            { type: "added", key: "B", value: "b" },
            { type: "added", key: "A", value: "a" },
        ])
    })
})

describe("relative order", () => {
    test("reports a pure reorder once, after row events", () => {
        const rows = collection<string, number>()
        const s = store()
        s.txn(tx => {
            for (const key of ["a", "b", "c"]) tx.set(rows(key), 1)
        })
        const seen = record(s, rows)

        s.txn(tx => {
            tx.delete(rows("a"))
            tx.set(rows("a"), 1) // same value: no row event
            tx.delete(rows("b"))
            tx.set(rows("b"), 1)
        })
        expect(seen.take()).toEqual([{ type: "reordered" }])
        expect(keys(s, rows)).toEqual(["c", "a", "b"])

        s.txn(tx => {
            tx.delete(rows("a"))
            tx.set(rows("a"), 2)
            tx.set(rows("d"), 1)
        })
        expect(seen.take()).toEqual([
            { type: "updated", key: "a", previous: 1, value: 2 },
            { type: "added", key: "d", value: 1 },
            { type: "reordered" },
        ])
    })

    test("does not report shifted positions from additions and deletions", () => {
        const rows = collection<string, number>()
        const s = store()
        s.txn(tx => {
            for (const key of ["a", "b", "c"]) tx.set(rows(key), 1)
        })
        const seen = record(s, rows)

        s.txn(tx => {
            tx.delete(rows("a"))
            tx.set(rows("z"), 1)
        })
        // z returns to the end, where it already was: order is unchanged.
        s.txn(tx => {
            tx.delete(rows("z"))
            tx.set(rows("z"), 2)
        })

        expect(seen.take()).toEqual([
            { type: "deleted", key: "a", previous: 1 },
            { type: "added", key: "z", value: 1 },
            { type: "updated", key: "z", previous: 1, value: 2 },
        ])
    })

    test("detects a reorder in an indexed membership", () => {
        const rows = collection<
            string,
            { kind: string },
            string,
            { kind: string }
        >({ indexes: { kind: value => value.kind } })
        const s = store()
        s.txn(tx => {
            for (const key of ["a", "b", "c"]) tx.set(rows(key), { kind: "t" })
        })
        const tasks = query(rows, { where: { kind: { eq: "t" } } })
        expect(s.get(tasks)).toHaveLength(3)
        const seen = record(s, rows)
        const b = s.get(rows("b"))!

        s.txn(tx => {
            tx.delete(rows("b"))
            tx.set(rows("b"), b)
        })
        expect(seen.take()).toEqual([{ type: "reordered" }])
        s.txn(tx => {
            tx.delete(rows("b"))
            tx.set(rows("b"), b)
            tx.set(rows("d"), { kind: "t" })
        })
        expect(seen.take()).toEqual([
            { type: "added", key: "d", value: { kind: "t" } },
        ])
        expect(s.get(tasks).map(row => row.key)).toEqual(["a", "c", "b", "d"])
    })

    test("reports order restored by resetAll without row events", () => {
        const rows = collection<string, number>()
        const root = store()
        root.txn(tx => {
            for (const key of ["a", "b", "c"]) tx.set(rows(key), 1)
        })
        const draft = root.scope("draft")
        draft.delete(rows("a"))
        draft.reset(rows("a")) // order residue: b, c, a
        const rootSeen = record(root, rows)
        const draftSeen = record(draft, rows)

        root.txn(tx => tx.scope(draft).resetAll())

        expect(keys(draft, rows)).toEqual(["a", "b", "c"])
        expect(draftSeen.take()).toEqual([{ type: "reordered" }])
        expect(rootSeen.take()).toEqual([])
    })
})

describe("scopes", () => {
    test("observes the subscribed Store's effective collection", () => {
        const rows = collection<string, string>()
        const root = store()
        const child = root.scope("child")
        const grand = child.scope("grand")
        root.set(rows("shared"), "root-0")
        const rootSeen = record(root, rows)
        const childSeen = record(child, rows)
        const grandSeen = record(grand, rows)

        child.set(rows("private"), "child")
        expect(rootSeen.take()).toEqual([])
        expect(childSeen.take()).toEqual([
            { type: "added", key: "private", value: "child" },
        ])
        expect(grandSeen.take()).toEqual([
            { type: "added", key: "private", value: "child" },
        ])

        root.set(rows("shared"), "root-1")
        const inherited = {
            type: "updated",
            key: "shared",
            previous: "root-0",
            value: "root-1",
        } as const
        expect(rootSeen.take()).toEqual([inherited])
        expect(childSeen.take()).toEqual([inherited])
        expect(grandSeen.take()).toEqual([inherited])

        child.set(rows("shared"), "child-override")
        root.set(rows("shared"), "root-2") // hidden below child
        expect(rootSeen.take()).toEqual([
            {
                type: "updated",
                key: "shared",
                previous: "root-1",
                value: "root-2",
            },
        ])
        expect(childSeen.take()).toEqual([
            {
                type: "updated",
                key: "shared",
                previous: "root-1",
                value: "child-override",
            },
        ])
        expect(grandSeen.take()).toEqual([
            {
                type: "updated",
                key: "shared",
                previous: "root-1",
                value: "child-override",
            },
        ])

        child.delete(rows("only-root"))
        root.set(rows("only-root"), "x")
        expect(rootSeen.take()).toEqual([
            { type: "added", key: "only-root", value: "x" },
        ])
        expect(childSeen.take()).toEqual([])
        expect(grandSeen.take()).toEqual([])
    })

    test("classifies reset and resetAll by net effect, not by method", () => {
        const rows = collection<string, string>()
        const root = store()
        root.set(rows("a"), "root")
        const child = root.scope("child")
        child.set(rows("a"), "root") // same value as the parent
        child.set(rows("b"), "child")
        const seen = record(child, rows)

        child.reset(rows("a")) // ownership changes, the value does not
        expect(seen.take()).toEqual([])

        child.set(rows("a"), "child")
        seen.take()
        root.txn(tx => tx.scope(child).resetAll())
        expect(seen.take()).toEqual([
            { type: "updated", key: "a", previous: "child", value: "root" },
            { type: "deleted", key: "b", previous: "child" },
        ])
    })

    test("orders an inherited row by its first staged change in any ancestor", () => {
        const rows = collection<string, number>()
        const root = store()
        const child = root.scope("child")
        child.set(rows("hidden"), 0)
        const seen = record(child, rows)

        root.txn(tx => {
            tx.set(rows("hidden"), 1) // hidden in child until the reset
            tx.set(rows("b"), 1)
            tx.scope(child).reset(rows("hidden"))
        })

        expect(seen.take()).toEqual([
            { type: "updated", key: "hidden", previous: 0, value: 1 },
            { type: "added", key: "b", value: 1 },
        ])
    })

    test("orders bulk reset rows by the parent's current order, independent of child scopes", async () => {
        const rows = collection<string, number>()
        const root = store()
        root.txn(tx => {
            for (const key of ["a", "b", "c"]) tx.set(rows(key), 0)
        })
        const leaf = root.scope("leaf")
        const parent = root.scope("parent")
        const held = parent.scope("kid")
        const dropped = root.scope("dropped")
        ;(() => dropped.scope())() // an unnamed child the application drops
        for (const scope of [leaf, parent, dropped]) {
            scope.set(rows("c"), 3) // acquired first
            scope.set(rows("x"), 9) // absent from the parent
            scope.set(rows("a"), 1)
        }
        for (let round = 0; round < 5; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
        }
        const seen = [leaf, parent, dropped].map(scope => record(scope, rows))

        root.txn(tx => {
            for (const scope of [leaf, parent, dropped])
                tx.scope(scope).resetAll()
        })

        // Parent order first; rows the parent lacks follow in ownership order.
        for (const scopeSeen of seen)
            expect(scopeSeen.take()).toEqual([
                { type: "updated", key: "a", previous: 1, value: 0 },
                { type: "updated", key: "c", previous: 3, value: 0 },
                { type: "deleted", key: "x", previous: 9 },
            ])
        void held
    })

    test("orders sibling scopes by when their current subscription began", () => {
        const rows = collection<string, number>()
        const root = store()
        const x = root.scope("x")
        const y = root.scope("y")
        for (const writeBetween of [false, true]) {
            const order: string[] = []
            const stopX = x.sub(rows, () => order.push("x"))
            const stopY = y.sub(rows, () => order.push("y"))
            stopX()
            if (writeBetween) root.set(rows("w"), 1)
            const stopAgain = x.sub(rows, () => order.push("x"))
            order.length = 0
            root.set(rows(`a${writeBetween}`), 1)
            expect(order).toEqual(["y", "x"])
            stopAgain()
            stopY()
        }
    })

    test("notifies ancestors before descendants, then first-subscription order", () => {
        const rows = collection<string, number>()
        const root = store()
        const first = root.scope("first")
        const second = root.scope("second")
        const leaf = second.scope("leaf")
        const order: string[] = []
        leaf.sub(rows, () => order.push("leaf"))
        second.sub(rows, () => order.push("second"))
        first.sub(rows, () => order.push("first"))
        root.sub(rows, () => order.push("root"))

        root.set(rows("a"), 1)

        expect(order).toEqual(["root", "second", "first", "leaf"])
    })
})

describe("other Store kinds", () => {
    test("isolates Stores that share a collection definition", () => {
        const rows = collection<string, number>()
        const first = store()
        const second = store()
        const firstSeen = record(first, rows)
        const secondSeen = record(second, rows)

        first.set(rows("a"), 1)
        second.set(rows("b"), 2)

        expect(firstSeen.take()).toEqual([{ type: "added", key: "a", value: 1 }])
        expect(secondSeen.take()).toEqual([
            { type: "added", key: "b", value: 2 },
        ])
    })

    test("delivers on a Store whose external plane is active", () => {
        const rows = collection<string, number>()
        let value = 0
        let notify = (): void => {}
        const source = externalAtom({
            getSnapshot: () => value,
            getServerSnapshot: () => 0,
            subscribe: invalidate => {
                notify = invalidate
                return () => {}
            },
        })
        const s = store()
        const external: number[] = []
        s.sub(source, () => external.push(s.get(source)))
        const seen = record(s, rows)

        s.set(rows("a"), 1)
        value = 1
        notify()
        s.txn(tx => tx.set(rows("a"), 2))

        expect(external).toEqual([1])
        expect(seen.take()).toEqual([
            { type: "added", key: "a", value: 1 },
            { type: "updated", key: "a", previous: 1, value: 2 },
        ])
    })

    test("delivers on an inspectable Store without counting event sources", () => {
        const changedSources = (subscribers: number): unknown => {
            const rows = collection<string, number>({ name: "inspected" })
            const { store: s, inspect } = createInspectableStore()
            const scopes = [s, s.scope("a"), s.scope("b")]
            s.set(rows("a"), 1)
            const seen = scopes
                .slice(0, subscribers)
                .map(scope => record(scope, rows))
            inspect.reset()
            s.set(rows("a"), 2)
            for (const scopeSeen of seen)
                expect(scopeSeen.take()).toEqual([
                    { type: "updated", key: "a", previous: 1, value: 2 },
                ])
            const exported = inspect.export() as {
                readonly summaries?: readonly {
                    type?: string
                    changedSources?: number
                }[]
            }
            return exported.summaries?.find(entry => entry.type === "commit")
                ?.changedSources
        }

        expect(typeof changedSources(0)).toBe("number")
        expect(changedSources(1)).toBe(changedSources(0))
        expect(changedSources(3)).toBe(changedSources(0))
    })
})

describe("delivery", () => {
    test("delivers synchronously, before set and txn return", () => {
        const rows = collection<string, number>()
        const s = store()
        const queue: Event[] = []
        s.sub(rows, event => queue.push(event))

        s.set(rows("a"), 1)
        expect(queue).toHaveLength(1)
        const result = s.txn(tx => {
            tx.set(rows("b"), 2)
            expect(queue).toHaveLength(1)
            return "done"
        })
        expect(result).toBe("done")
        expect(queue).toHaveLength(2)
    })

    test("allows committed reads but no Store writes in the callback", () => {
        const rows = collection<string, number>()
        const s = store()
        const reads: unknown[] = []
        s.sub(rows, event => {
            reads.push(s.get(rows("a")))
            if (event.type === "updated") s.set(rows("b"), 1)
        })

        s.set(rows("a"), 1)
        const error = thrownBy(() => s.set(rows("a"), 2))

        expect(reads).toEqual([1, 2])
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        const notification = error as SubscriberNotificationError
        expect(notification.committed).toBe(true)
        expect(notification.causes[0]).toBeInstanceOf(CallbackCapabilityError)
        expect(s.get(rows("a"))).toBe(2)
        expect(s.get(rows("b"))).toBeUndefined()
    })

    test("attempts every subscriber and every event when one throws", () => {
        const rows = collection<string, number>()
        const s = store()
        const failures = [new Error("first"), new Error("second")]
        const attempts: string[] = []
        s.sub(rows, event => {
            attempts.push(`throwing:${event.type}`)
            throw failures[attempts.length - 1]
        })
        s.sub(rows, event => attempts.push(`calm:${event.type}`))

        const error = thrownBy(() =>
            s.txn(tx => {
                tx.set(rows("a"), 1)
                tx.set(rows("b"), 1)
            }),
        )

        expect(attempts).toEqual([
            "throwing:added",
            "throwing:added",
            "calm:added",
            "calm:added",
        ])
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes).toEqual(failures)
        expect(s.get(rows("b"))).toBe(1)

        // No retry: the next commit delivers only its own events.
        attempts.length = 0
        expect(() => s.set(rows("c"), 1)).toThrow(SubscriberNotificationError)
        expect(attempts).toEqual(["throwing:added", "calm:added"])
    })

    test("stops after unsubscribe, including mid-delivery, and unsubscribe is idempotent", () => {
        const rows = collection<string, number>()
        const s = store()
        const seen: string[] = []
        let stopSecond = (): void => {}
        const stopFirst = s.sub(rows, event => {
            seen.push(`first:${"key" in event ? event.key : event.type}`)
            if ("key" in event && event.key === "a") stopSecond()
        })
        stopSecond = s.sub(rows, event =>
            seen.push(`second:${"key" in event ? event.key : event.type}`),
        )
        const stopSelf: { stop: () => void } = { stop: () => {} }
        stopSelf.stop = s.sub(rows, event => {
            seen.push(`self:${"key" in event ? event.key : event.type}`)
            stopSelf.stop()
        })

        s.txn(tx => {
            tx.set(rows("a"), 1)
            tx.set(rows("b"), 1)
        })

        expect(seen).toEqual(["first:a", "first:b", "self:a"])
        stopSecond()
        stopFirst()
        stopFirst()
        seen.length = 0
        s.set(rows("c"), 1)
        expect(seen).toEqual([])
    })

    test("stops after disposal and rejects disposal from a callback", () => {
        const rows = collection<string, number>()
        const root = store()
        const child = root.scope("child")
        const seen: string[] = []
        child.sub(rows, event => {
            seen.push(event.type)
            child.dispose()
        })

        const error = thrownBy(() => root.set(rows("a"), 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes[0]).toBeInstanceOf(
            CallbackCapabilityError,
        )

        child.dispose()
        root.set(rows("b"), 1)
        expect(seen).toEqual(["added"])
    })

    test("does not replay history to a new subscriber", () => {
        const rows = collection<string, number>()
        const s = store()
        s.set(rows("a"), 1)
        const seen = record(s, rows)
        expect(seen.take()).toEqual([])
        s.set(rows("b"), 1)
        expect(seen.take()).toEqual([{ type: "added", key: "b", value: 1 }])
    })
})

describe("settlement", () => {
    test("keeps each settle commit separate, in commit order, with its own payloads", () => {
        const rows = collection<string, number>()
        const trigger = atom(0)
        const s = store()
        s.sub(trigger, {
            settle: tx => {
                tx.set(rows("derived"), tx.get(trigger) * 10)
                tx.update(rows("a"), value => value + 1)
            },
        })
        const seen: { event: Event; live: unknown }[] = []
        s.sub(rows, event => seen.push({ event, live: s.get(rows("a")) }))

        s.txn(tx => {
            tx.set(rows("a"), 1)
            tx.set(trigger, 1)
        })

        expect(seen.map(entry => entry.event)).toEqual([
            { type: "added", key: "a", value: 1 },
            { type: "added", key: "derived", value: 10 },
            { type: "updated", key: "a", previous: 1, value: 2 },
        ])
        // Payloads describe their own commit; live reads see the settled state.
        expect(seen.map(entry => entry.live)).toEqual([2, 2, 2])
    })

    test("a failed settle transaction contributes no events", () => {
        const rows = collection<string, number>()
        const trigger = atom(0)
        const s = store()
        const failure = new Error("settle failed")
        s.sub(trigger, {
            settle: tx => {
                tx.set(rows("never"), 1)
                throw failure
            },
        })
        const seen = record(s, rows)

        const error = thrownBy(() =>
            s.txn(tx => {
                tx.set(rows("a"), 1)
                tx.set(trigger, 1)
            }),
        )

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).causes).toEqual([failure])
        expect(seen.take()).toEqual([{ type: "added", key: "a", value: 1 }])
    })

    test("collection settle handlers keep membership triggers", () => {
        const rows = collection<string, number>()
        const s = store()
        let settles = 0
        let notifies = 0
        s.sub(rows, {
            settle: () => {
                settles++
            },
            notify: () => notifies++,
        })

        s.set(rows("a"), 1)
        s.set(rows("a"), 2) // value only: membership unchanged
        s.set(rows("b"), 1)

        expect([settles, notifies]).toEqual([2, 2])
    })
})

describe("membership-only observers keep their semantics", () => {
    test("a membership selector, presence, and row subscribers", () => {
        const rows = collection<string, number>()
        const s = store()
        const membership = selector(get => get(rows))
        const counts = { membership: 0, notify: 0, row: 0, events: 0 }
        s.sub(membership, () => counts.membership++)
        s.sub(rows, { notify: () => counts.notify++ })
        s.sub(rows("a"), () => counts.row++)
        s.sub(rows, () => counts.events++)

        s.set(rows("a"), 1)
        const array = s.get(rows)
        s.set(rows("a"), 2)
        s.set(rows("a"), 3)

        expect(s.get(rows)).toBe(array)
        expect(counts).toEqual({ membership: 1, notify: 1, row: 3, events: 3 })
    })

    test("a query observes its matching rows, not every value change", () => {
        const rows = collection<
            string,
            { kind: string; n: number },
            string,
            { kind: string }
        >({ indexes: { kind: value => value.kind } })
        const s = store()
        const tasks = query(rows, { where: { kind: { eq: "t" } } })
        let queryCalls = 0
        s.sub(tasks, () => queryCalls++)
        const seen = record(s, rows)

        s.set(rows("a"), { kind: "t", n: 1 })
        s.set(rows("a"), { kind: "t", n: 2 })
        s.set(rows("b"), { kind: "other", n: 1 })

        expect(queryCalls).toBe(1)
        expect(seen.take().map(event => event.type)).toEqual([
            "added",
            "updated",
            "added",
        ])
    })
})

describe("retention", () => {
    // Bun's collector scans the stack conservatively; overwrite stale slots so
    // a dead local cannot keep a payload alive.
    const clobberStack = (depth = 200): number => {
        const slots = [depth, depth + 1, depth + 2, depth + 3]
        return depth === 0 ? 0 : clobberStack(depth - 1) + slots.length
    }
    const collected = async (
        references: readonly WeakRef<object>[],
    ): Promise<number> => {
        let retained = references.length
        for (let round = 0; round < 20 && retained !== 0; round++) {
            clobberStack()
            await Bun.sleep(0)
            Bun.gc(true)
            retained = references.filter(
                reference => reference.deref() !== undefined,
            ).length
        }
        return retained
    }

    test("releases delivered payloads", async () => {
        const rows = collection<string, object>()
        const s = store()
        let delivered = 0
        s.sub(rows, () => delivered++)
        const commitAndDelete = (): WeakRef<object> => {
            const value = { payload: "large" }
            s.set(rows("a"), value)
            s.delete(rows("a"))
            return new WeakRef(value)
        }
        const reference = commitAndDelete()

        expect(delivered).toBe(2)
        expect(await collected([reference])).toBe(0)
    })

    test("releases a disposed scope and its subscription", async () => {
        const rows = collection<string, number>()
        const root = store()
        const references = (() => {
            const child = root.scope()
            const callback = (): void => {}
            child.sub(rows, callback)
            root.set(rows("a"), 1)
            child.dispose()
            return [new WeakRef(child as object), new WeakRef(callback)]
        })()

        expect(await collected(references)).toBe(0)
        root.set(rows("b"), 1)
    })

    test("releases an unsubscribed scope's registration", async () => {
        const rows = collection<string, number>()
        const root = store()
        const references = (() => {
            const child = root.scope()
            const callback = (): void => {}
            const stop = child.sub(rows, callback)
            child.set(rows("a"), 1)
            stop()
            return [new WeakRef(child as object), new WeakRef(callback)]
        })()

        // No later write is needed to release it.
        expect(await collected(references)).toBe(0)
        root.set(rows("b"), 1)
    })
})

describe("docs: collection observing changes", () => {
    test("the capture-then-drain example runs as written", () => {
        interface Mutation {
            readonly debounceCount: number
            readonly persistedAt: number | null
        }

        const mutations = collection<string, Mutation>({ name: "mutations" })
        const app = store()
        const queue: Mutation[] = []
        let drains = 0
        const scheduleDrain = (): void => {
            drains++
        }

        const unsubscribe = app.sub(mutations, event => {
            switch (event.type) {
                case "added":
                    if (event.value.persistedAt === null)
                        queue.push(event.value)
                    break
                case "updated":
                    if (event.value.debounceCount > event.previous.debounceCount)
                        queue.push(event.value)
                    break
                case "deleted":
                case "reordered":
                    break
            }
            scheduleDrain()
        })

        const created = { debounceCount: 0, persistedAt: null }
        const revised = { debounceCount: 1, persistedAt: null }
        const acknowledged = { debounceCount: 1, persistedAt: 5 }
        app.set(mutations("m"), created)
        app.set(mutations("m"), revised)
        app.set(mutations("m"), acknowledged)
        expect(queue).toEqual([created, revised])
        expect(drains).toBe(3)

        const mutationMembership = selector(get => get(mutations))
        let membershipChanges = 0
        app.sub(mutationMembership, () => membershipChanges++)
        app.set(mutations("m"), created)
        app.set(mutations("n"), created)
        expect(membershipChanges).toBe(1)
        unsubscribe()
    })
})
