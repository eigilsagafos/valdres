import { expect, test } from "bun:test"
import {
    collection,
    store,
    type CollectionEvent,
    type CollectionValue,
    type Store,
} from "../../src/index"

/**
 * Seeded differential: random transactions over a scope tree, compared with an
 * independent model of staged locals. For every subscribed scope the delivered
 * events must equal the model's net changes, ordered by each row's first
 * staged change in that scope or an ancestor (a write that leaves the written
 * scope's draft local and effective value unchanged is not a change), then at
 * most one `reordered` when rows present before and after changed relative
 * order. Rows first changed by `resetAll` are compared as a set; their order is
 * pinned by focused tests.
 */

type Local =
    | { readonly kind: "present"; readonly value: CollectionValue }
    | { readonly kind: "absent" }
type Locals = Map<string, Map<string, Local>>
type Op =
    | { kind: "set"; scope: string; key: string; value: CollectionValue }
    | { kind: "update"; scope: string; key: string; value: CollectionValue }
    | { kind: "delete" | "reset"; scope: string; key: string }
    | { kind: "resetAll"; scope: string }

const KEYS = ["a", "b", "c", "d", "e"]
const PARENT: Record<string, string | undefined> = {
    root: undefined,
    left: "root",
    leaf: "left",
    right: "root",
}
const SCOPES = Object.keys(PARENT)
const SHARED = [{ id: 1 }, { id: 2 }, { id: 3 }]

const rng = (seed: number) => {
    let state = seed >>> 0 || 1
    return (limit: number): number => {
        state = (Math.imul(state, 1103515245) + 12345) >>> 0
        return (state >>> 8) % limit
    }
}

const route = (scope: string): string[] => {
    const scopes: string[] = []
    for (
        let current: string | undefined = scope;
        current;
        current = PARENT[current]
    )
        scopes.push(current)
    return scopes
}

const effective = (
    locals: Locals,
    scope: string,
    key: string,
): CollectionValue | undefined => {
    for (const current of route(scope)) {
        const local = locals.get(current)?.get(key)
        if (local?.kind === "present") return local.value
        if (local?.kind === "absent") return undefined
    }
    return undefined
}

const sameLocal = (left: Local | undefined, right: Local | undefined) =>
    left?.kind === right?.kind &&
    (left?.kind !== "present" ||
        Object.is(left.value, (right as { value: unknown }).value))

const copy = (locals: Locals): Locals =>
    new Map([...locals].map(([scope, rows]) => [scope, new Map(rows)]))

const survivorsReordered = (before: string[], after: string[]): boolean => {
    const kept = before.filter(key => after.includes(key))
    const now = after.filter(key => before.includes(key))
    return kept.join() !== now.join()
}

const runProgram = (seed: number) => {
    const rand = rng(seed)
    const rows = collection<string, CollectionValue>()
    const root = store()
    const stores: Record<string, Store> = { root }
    stores.left = root.scope("left")
    stores.leaf = stores.left.scope("leaf")
    stores.right = root.scope("right")
    let committed: Locals = new Map(SCOPES.map(scope => [scope, new Map()]))
    const received = new Map<
        string,
        CollectionEvent<string, CollectionValue>[]
    >()
    for (const scope of SCOPES) {
        received.set(scope, [])
        stores[scope]!.sub(rows, event => received.get(scope)!.push(event))
    }
    const value = (): CollectionValue =>
        rand(3) === 0 ? rand(4) : SHARED[rand(SHARED.length)]
    const checks: string[] = []

    for (let step = 0; step < 12; step++) {
        const ops: Op[] = []
        for (let count = 1 + rand(6); count > 0; count--) {
            const scope = SCOPES[rand(SCOPES.length)]!
            const key = KEYS[rand(KEYS.length)]!
            const roll = rand(20)
            if (roll === 0 && scope !== "root")
                ops.push({ kind: "resetAll", scope })
            else if (roll < 9)
                ops.push({ kind: "set", scope, key, value: value() })
            else if (roll < 12)
                ops.push({ kind: "update", scope, key, value: value() })
            else if (roll < 16) ops.push({ kind: "delete", scope, key })
            else ops.push({ kind: "reset", scope, key })
        }
        const abort = rand(8) === 0
        const before = Object.fromEntries(
            SCOPES.map(scope => [
                scope,
                stores[scope]!.get(rows).map(row => row.key),
            ]),
        )

        // Model staging.
        const draft = copy(committed)
        const planOrder: { scope: string; key: string; bulk: boolean }[] = []
        const planned = new Set<string>()
        const stage = (
            scope: string,
            key: string,
            next: Local | undefined,
            bulk: boolean,
        ) => {
            const local = draft.get(scope)!.get(key)
            const was = effective(draft, scope, key)
            if (next === undefined) draft.get(scope)!.delete(key)
            else draft.get(scope)!.set(key, next)
            const changed =
                !sameLocal(local, next) ||
                !Object.is(was, effective(draft, scope, key))
            if (!changed || planned.has(`${scope}:${key}`)) return
            planned.add(`${scope}:${key}`)
            planOrder.push({ scope, key, bulk })
        }
        const runnable: Op[] = []
        for (const op of ops) {
            if (
                op.kind === "update" &&
                effective(draft, op.scope, op.key) === undefined
            )
                continue // updating an absent row throws; leave it out
            runnable.push(op)
            if (op.kind === "set" || op.kind === "update")
                stage(
                    op.scope,
                    op.key,
                    { kind: "present", value: op.value },
                    false,
                )
            else if (op.kind === "delete")
                stage(op.scope, op.key, { kind: "absent" }, false)
            else if (op.kind === "reset")
                stage(op.scope, op.key, undefined, false)
            else
                for (const key of KEYS)
                    if (draft.get(op.scope)!.has(key))
                        stage(op.scope, key, undefined, true)
        }

        let thrown: unknown
        try {
            root.txn(tx => {
                for (const op of runnable) {
                    const cursor =
                        op.scope === "root" ? tx : tx.scope(stores[op.scope]!)
                    if (op.kind === "resetAll") cursor.resetAll()
                    else if (op.kind === "set")
                        cursor.set(rows(op.key), op.value)
                    else if (op.kind === "update")
                        cursor.update(rows(op.key), () => op.value)
                    else if (op.kind === "delete") cursor.delete(rows(op.key))
                    else cursor.reset(rows(op.key))
                }
                if (abort) throw new Error("abort")
            })
        } catch (error) {
            thrown = error
        }
        expect(thrown === undefined).toBe(!abort)

        for (const scope of SCOPES) {
            const events = received.get(scope)!.splice(0)
            if (abort) {
                expect(events).toEqual([])
                continue
            }
            const scopes = route(scope)
            const seen = new Set<string>()
            const expected: {
                event: CollectionEvent<string, CollectionValue>
                bulk: boolean
            }[] = []
            for (const entry of planOrder) {
                if (!scopes.includes(entry.scope) || seen.has(entry.key))
                    continue
                seen.add(entry.key)
                const previous = effective(committed, scope, entry.key)
                const next = effective(draft, scope, entry.key)
                if (Object.is(previous, next)) continue
                expected.push({
                    bulk: entry.bulk,
                    event:
                        previous === undefined
                            ? { type: "added", key: entry.key, value: next! }
                            : next === undefined
                              ? { type: "deleted", key: entry.key, previous }
                              : {
                                    type: "updated",
                                    key: entry.key,
                                    previous,
                                    value: next,
                                },
                })
            }
            const after = stores[scope]!.get(rows).map(row => row.key)
            const reordered = survivorsReordered(before[scope]!, after)
            const rowEvents: CollectionEvent<string, CollectionValue>[] =
                events.filter(event => event.type !== "reordered")
            // Ordered rows keep their relative order; bulk rows match as a set.
            const sortKey = (
                event: CollectionEvent<string, CollectionValue>,
            ) => ("key" in event ? event.key : "")
            expect(rowEvents.length).toBe(expected.length)
            expect(
                [...rowEvents].sort((l, r) =>
                    sortKey(l).localeCompare(sortKey(r)),
                ),
            ).toEqual(
                expected
                    .map(entry => entry.event)
                    .sort((l, r) => sortKey(l).localeCompare(sortKey(r))),
            )
            const bulkKeys = new Set(
                expected
                    .filter(entry => entry.bulk)
                    .map(entry => sortKey(entry.event)),
            )
            expect(
                rowEvents.filter(event => !bulkKeys.has(sortKey(event))),
            ).toEqual(
                expected.filter(entry => !entry.bulk).map(entry => entry.event),
            )
            expect(
                events.filter(event => event.type === "reordered").length,
            ).toBe(reordered ? 1 : 0)
            if (reordered) expect(events.at(-1)).toEqual({ type: "reordered" })
            for (const key of KEYS)
                expect(stores[scope]!.get(rows(key))).toBe(
                    effective(draft, scope, key) as never,
                )
            if (expected.length || reordered) checks.push(scope)
        }
        if (!abort) {
            // Root absence needs no marker once committed.
            for (const [key, local] of draft.get("root")!)
                if (local.kind === "absent") draft.get("root")!.delete(key)
            committed = draft
        }
    }
    return checks.length
}

test("seeded differential: delivered events equal the modelled net changes", () => {
    let exercised = 0
    for (let seed = 1; seed <= 300; seed++) exercised += runProgram(seed)
    // The programs must produce real events, not only no-ops.
    expect(exercised).toBeGreaterThan(3000)
})
