import { describe, expect, test } from "bun:test"
import {
    atom,
    collection,
    store,
    type CollectionEvent,
    type Store,
} from "../../src/index"

/**
 * ShiftX's mutation synchronization, modelled on `createMutationSync`: the
 * sync loop observes the root mutation collection, captures new and locally
 * revised rows in commit order, and drains them outside notification because
 * draining writes sync status. roc-db writes each local draft mutation into the
 * root and into its draft scope.
 */

interface Mutation {
    readonly id: string
    readonly content: string
    readonly debounceCount: number
    readonly persistedAt: number | null
}

const mutation = (
    id: string,
    content: string,
    debounceCount = 0,
    persistedAt: number | null = null,
): Mutation => ({ id, content, debounceCount, persistedAt })

const createSync = (root: Store) => {
    const mutations = collection<string, Mutation>({ name: "mutations" })
    const syncStatus = atom<"idle" | "pending">("idle")
    const queue: Mutation[] = []
    const sent: Mutation[] = []
    let scheduled = false

    // Application code: capture only; Store writes wait for drain().
    const capture = (event: CollectionEvent<string, Mutation>): void => {
        if (event.type === "added" && event.value.persistedAt === null)
            queue.push(event.value)
        else if (
            event.type === "updated" &&
            event.value.debounceCount > event.previous.debounceCount
        )
            queue.push(event.value)
        scheduled = true
    }
    const stop = root.sub(mutations, capture)
    const drain = (): Mutation[] => {
        scheduled = false
        const batch = queue.splice(0)
        if (batch.length) root.set(syncStatus, "pending")
        sent.push(...batch)
        return batch
    }
    return {
        mutations,
        syncStatus,
        queue,
        sent,
        stop,
        drain,
        scheduled: () => scheduled,
    }
}

describe("ShiftX mutation sync", () => {
    test("1. actor added, then narrative revised in the same tick: two events in commit order", () => {
        const root = store()
        const sync = createSync(root)
        root.set(sync.mutations("narrative"), mutation("narrative", "v0", 0, 1))
        sync.drain()

        root.set(sync.mutations("actor"), mutation("actor", "Ada"))
        root.set(sync.mutations("narrative"), mutation("narrative", "v1", 1, 1))

        expect(sync.drain().map(m => `${m.id}:${m.content}`)).toEqual([
            "actor:Ada",
            "narrative:v1",
        ])
    })

    test("2. revision, actor, revision before drain: three events with both payloads", () => {
        const root = store()
        const sync = createSync(root)
        root.set(sync.mutations("narrative"), mutation("narrative", "v0", 0, 1))
        sync.drain()

        root.set(sync.mutations("narrative"), mutation("narrative", "v1", 1, 1))
        root.set(sync.mutations("actor"), mutation("actor", "Ada"))
        root.set(sync.mutations("narrative"), mutation("narrative", "v2", 2, 1))

        expect(sync.drain().map(m => `${m.id}:${m.content}`)).toEqual([
            "narrative:v1",
            "actor:Ada",
            "narrative:v2",
        ])
    })

    test("3. a root row written twice in one commit reports its final value once", () => {
        const root = store()
        const sync = createSync(root)
        const events: CollectionEvent<string, Mutation>[] = []
        root.sub(sync.mutations, event => events.push(event))

        root.txn(tx => {
            // saveMutation writes the same root row twice.
            tx.set(sync.mutations("m"), mutation("m", "draft"))
            tx.set(sync.mutations("m"), mutation("m", "final"))
        })

        expect(events).toEqual([
            { type: "added", key: "m", value: mutation("m", "final") },
        ])
        expect(sync.drain()).toEqual([mutation("m", "final")])
    })

    test("4. an acknowledgement is an update with an unchanged debounceCount; a stale one writes nothing", () => {
        const root = store()
        const sync = createSync(root)
        const events: CollectionEvent<string, Mutation>[] = []
        root.sub(sync.mutations, event => events.push(event))
        root.set(sync.mutations("m"), mutation("m", "v1", 1))
        sync.drain()
        events.length = 0

        const acknowledge = (id: string, persistedAt: number): void =>
            root.update(sync.mutations(id), current =>
                current.persistedAt !== null &&
                current.persistedAt >= persistedAt
                    ? current // stale: keep the same reference
                    : { ...current, persistedAt },
            )

        acknowledge("m", 10)
        expect(events).toEqual([
            {
                type: "updated",
                key: "m",
                previous: mutation("m", "v1", 1),
                value: mutation("m", "v1", 1, 10),
            },
        ])
        expect(sync.drain()).toEqual([]) // filtered: debounceCount unchanged

        events.length = 0
        acknowledge("m", 5)
        expect(events).toEqual([])
    })

    test("5. loading N persisted drafts adds N root rows in staging order; draft-private writes stay silent", () => {
        const root = store()
        const sync = createSync(root)
        const initialized = collection<string, boolean>()
        const rootEvents: string[] = []
        root.sub(sync.mutations, event =>
            rootEvents.push(`${event.type}:${"key" in event ? event.key : ""}`),
        )
        const draft = root.scope("draft")
        const persisted = ["m3", "m1", "m2"].map(id =>
            mutation(id, id, 0, null),
        )

        root.txn(tx => {
            for (const value of persisted) {
                tx.set(sync.mutations(value.id), value)
                tx.scope(draft).set(sync.mutations(value.id), value)
                tx.scope(draft).set(initialized(value.id), true)
            }
            tx.scope(draft).set(sync.mutations("m1"), mutation("m1", "local"))
        })

        expect(rootEvents).toEqual(["added:m3", "added:m1", "added:m2"])
        expect(sync.drain().map(m => m.id)).toEqual(["m3", "m1", "m2"])
    })

    test("6. a transaction that throws after staging a mutation reports nothing", () => {
        const root = store()
        const sync = createSync(root)
        expect(() =>
            root.txn(tx => {
                tx.set(sync.mutations("m"), mutation("m", "lost"))
                throw new Error("validation failed")
            }),
        ).toThrow("validation failed")
        expect(sync.scheduled()).toBe(false)
        expect(sync.drain()).toEqual([])
    })

    test("7. a child rebase and reset produce no root events", () => {
        const root = store()
        const sync = createSync(root)
        root.set(sync.mutations("m"), mutation("m", "root"))
        sync.drain()
        const draft = root.scope("draft")
        draft.set(sync.mutations("m"), mutation("m", "draft"))
        draft.set(sync.mutations("draft-only"), mutation("draft-only", "x"))
        const draftEvents: string[] = []
        draft.sub(sync.mutations, event => draftEvents.push(event.type))

        root.txn(tx => {
            const cursor = tx.scope(draft)
            cursor.resetAll()
            cursor.set(sync.mutations("rebuilt"), mutation("rebuilt", "y"))
        })
        draft.reset(sync.mutations("rebuilt"))

        expect(sync.scheduled()).toBe(false)
        expect(sync.drain()).toEqual([])
        expect(draftEvents).toEqual(["updated", "deleted", "added", "deleted"])
    })

    test("captures before a later synchronous call drains (waitFor)", () => {
        const root = store()
        const sync = createSync(root)
        const waitFor = (id: string): boolean =>
            sync.drain().some(value => value.id === id)

        root.set(sync.mutations("m"), mutation("m", "v"))
        expect(waitFor("m")).toBe(true)
        expect(root.get(sync.syncStatus)).toBe("pending")
    })

    test("a server revision with a higher debounceCount looks like a local revision (application concern)", () => {
        const root = store()
        const sync = createSync(root)
        root.set(sync.mutations("m"), mutation("m", "v1", 1, 10))
        sync.drain()

        // Loading a newer server copy into the existing row passes the
        // `debounceCount > previous.debounceCount` filter. ShiftX owns the fix.
        root.set(sync.mutations("m"), mutation("m", "server", 3, 20))
        expect(sync.drain().map(m => m.content)).toEqual(["server"])
    })
})
