/**
 * Exact collection reachability certification.
 *
 * This uses the repository's Bun/JSC LeakDetector rather than calibrated heap
 * byte ceilings. The focused internal mirrors remain in
 * v1-committed-store-tree/collection-lifecycle.test.ts (owner/reset/disposal,
 * cold rows, two-Store reuse, and closed cursors) and
 * v1-committed-store-tree/collection-draft.test.ts (released retained drafts).
 * These public-runtime cases keep the complete COL-008 matrix visible in one
 * blocking suite.
 */
import { describe, expect, test } from "./test-compat"
import {
    collection,
    presence,
    selector,
    store,
    type CollectionRow,
    type Store,
    type Transaction,
} from "../../src/v1"

interface LeakDetectorLike {
    isLeaking(maxRounds?: number): Promise<boolean>
}

interface LeakDetectorConstructor {
    new (value: object): LeakDetectorLike
}

const leakDetectorSpecifier = "../../../test/src/LeakDetector"
const LeakDetector: LeakDetectorConstructor | undefined =
    typeof Bun === "undefined"
        ? undefined
        : ((await import(leakDetectorSpecifier))
              .LeakDetector as LeakDetectorConstructor)

const collectionDescribe = typeof Bun === "undefined" ? describe.skip : describe

interface Probe<Value extends object> {
    readonly detector: LeakDetectorLike
    readonly reference: WeakRef<Value>
}

type SubscriptionKind = "row" | "presence" | "selector"

const probe = <Value extends object>(value: Value): Probe<Value> => {
    if (LeakDetector === undefined) {
        throw new Error("collection GC certification requires Bun")
    }
    return {
        detector: new LeakDetector(value),
        reference: new WeakRef(value),
    }
}

const releasedSubscriptionProbe = (
    kind: SubscriptionKind,
): { readonly detector: LeakDetectorLike; readonly target: Store } => {
    const rows = collection<string, number>()
    const target = store()
    let row: CollectionRow<string, number> | undefined = rows(kind)
    let selectorDependency: CollectionRow<string, number> | undefined = row
    let state: unknown =
        kind === "row"
            ? row
            : kind === "presence"
              ? presence(row)
              : selector(get => get(selectorDependency!))
    const detector = probe(row).detector
    const cleanup = Reflect.apply(target.sub, target, [
        state,
        () => undefined,
    ]) as () => void
    cleanup()
    row = undefined
    selectorDependency = undefined
    state = undefined
    return { detector, target }
}

const requireRetained = <Value extends object>(
    reference: WeakRef<Value>,
): Value => {
    const value = reference.deref()
    if (value === undefined)
        throw new Error("expected retained collection value")
    return value
}

const expectRetained = async (detector: LeakDetectorLike): Promise<void> => {
    expect(await detector.isLeaking(10)).toBe(true)
}

const expectCollected = async (detector: LeakDetectorLike): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        leaking = await detector.isLeaking()
    }
    expect(leaking).toBe(false)
}

collectionDescribe("collection exact weak-liveness gates", () => {
    test("cold lookup and absent reads retain no row handle", async () => {
        const rows = collection<string, number>()
        const target = store()
        const lookup = (() => {
            let row: CollectionRow<string, number> | undefined = rows("lookup")
            const current = probe(row)
            row = undefined
            return current.detector
        })()
        const absentRead = (() => {
            let row: CollectionRow<string, number> | undefined = rows("read")
            const current = probe(row)
            expect(target.get(row)).toBeUndefined()
            row = undefined
            return current.detector
        })()

        await expectCollected(lookup)
        await expectCollected(absentRead)
        target.dispose()
    })

    test("Present membership and child Absent tombstones retain rows until release", async () => {
        const rows = collection<string, number>()
        const root = store()
        const child = root.scope("gc-tombstone")
        const present = (() => {
            let row: CollectionRow<string, number> | undefined = rows("present")
            const current = probe(row)
            root.set(row, 1)
            expect(root.get(rows)).toEqual([row])
            row = undefined
            return current
        })()
        const tombstone = (() => {
            let row: CollectionRow<string, number> | undefined =
                rows("tombstone")
            const current = probe(row)
            child.delete(row)
            row = undefined
            return current
        })()

        await expectRetained(present.detector)
        await expectRetained(tombstone.detector)
        ;(() => {
            root.reset(requireRetained(present.reference))
            child.reset(requireRetained(tombstone.reference))
        })()
        await expectCollected(present.detector)
        await expectCollected(tombstone.detector)
        root.dispose()
    })

    test("root delete, reset, and Store disposal each release Present owner pins", async () => {
        const rows = collection<string, number>()
        const target = store()
        const deleted = (() => {
            let row: CollectionRow<string, number> | undefined = rows("delete")
            const current = probe(row)
            target.set(row, 1)
            target.delete(row)
            row = undefined
            return current.detector
        })()
        const reset = (() => {
            let row: CollectionRow<string, number> | undefined = rows("reset")
            const current = probe(row)
            target.set(row, 1)
            target.reset(row)
            row = undefined
            return current.detector
        })()
        const disposed = (() => {
            let row: CollectionRow<string, number> | undefined = rows("dispose")
            const current = probe(row)
            target.set(row, 1)
            row = undefined
            return current
        })()

        await expectCollected(deleted)
        await expectCollected(reset)
        await expectRetained(disposed.detector)
        target.dispose()
        await expectCollected(disposed.detector)
    })

    test("row, presence, and selector dependencies release after unsubscribe", async () => {
        for (const kind of ["row", "presence", "selector"] as const) {
            const current = releasedSubscriptionProbe(kind)
            await expectCollected(current.detector)
            current.target.dispose()
        }
    })

    test("live subscriptions retain row, presence, and selector dependencies", async () => {
        const rows = collection<string, number>()
        const target = store()
        let cleanups: (() => void)[] = []
        const detectors = (() => {
            let directRow: CollectionRow<string, number> | undefined = rows(
                "live-row-subscription",
            )
            let presenceRow: CollectionRow<string, number> | undefined = rows(
                "live-presence-subscription",
            )
            let selectorRow: CollectionRow<string, number> | undefined = rows(
                "live-selector-subscription",
            )
            const direct = probe(directRow).detector
            const present = probe(presenceRow).detector
            const derived = probe(selectorRow).detector
            const presentState = presence(presenceRow)
            const derivedState = selector(get => get(selectorRow!))
            cleanups = [
                target.sub(directRow, () => undefined),
                target.sub(presentState, () => undefined),
                target.sub(derivedState, () => undefined),
            ]
            directRow = undefined
            presenceRow = undefined
            selectorRow = undefined
            return [direct, present, derived] as const
        })()

        for (const detector of detectors) await expectRetained(detector)
        for (const cleanup of cleanups) cleanup()
        cleanups = []
        target.dispose()
    })

    test("named and anonymous scope disposal releases independent pins", async () => {
        const rows = collection<string, number>()
        const root = store()
        let named: Store | undefined = root.scope("gc-named")
        let anonymous: Store | undefined = root.scope()
        const namedRow = (() => {
            let row: CollectionRow<string, number> | undefined = rows("named")
            const current = probe(row)
            named!.set(row, 1)
            row = undefined
            return current.detector
        })()
        const anonymousRow = (() => {
            let row: CollectionRow<string, number> | undefined =
                rows("anonymous")
            const current = probe(row)
            anonymous!.delete(row)
            row = undefined
            return current.detector
        })()

        await expectRetained(namedRow)
        await expectRetained(anonymousRow)
        named.dispose()
        anonymous.dispose()
        named = undefined
        anonymous = undefined
        await expectCollected(namedRow)
        await expectCollected(anonymousRow)
        root.dispose()
    })

    test("two Stores retain and release the same definition independently", async () => {
        const rows = collection<string, number>()
        const first = store()
        const second = store()
        const current = (() => {
            let row: CollectionRow<string, number> | undefined = rows("shared")
            const current = probe(row)
            first.set(row, 1)
            second.set(row, 2)
            row = undefined
            return current
        })()

        first.dispose()
        await expectRetained(current.detector)
        ;(() => second.reset(requireRetained(current.reference)))()
        await expectCollected(current.detector)
        expect(second.get(rows("shared"))).toBeUndefined()
        second.dispose()
    })

    test("retained closed transaction artifacts release staged row values", async () => {
        const rows = collection<string, object>()
        const row = rows("transaction")
        const target = store()
        let retained: Transaction | undefined
        const value = (() => {
            let staged: object | undefined = Object.freeze({ private: true })
            const current = probe(staged)
            target.txn(transaction => {
                retained = transaction
                transaction.set(row, staged!)
            })
            target.reset(row)
            staged = undefined
            return current.detector
        })()

        expect(retained).toBeDefined()
        expect(() => retained!.get(row)).toThrow()
        await expectCollected(value)
        retained = undefined
        target.dispose()
    })

    test("application-held membership snapshots retain rows until released", async () => {
        const rows = collection<string, number>()
        const target = store()
        let snapshot: readonly CollectionRow<string, number>[] = []
        const current = (() => {
            let row: CollectionRow<string, number> | undefined =
                rows("snapshot")
            const current = probe(row)
            target.set(row, 1)
            snapshot = target.get(rows)
            target.delete(row)
            row = undefined
            return current.detector
        })()

        await expectRetained(current)
        expect(snapshot).toHaveLength(1)
        snapshot = []
        await expectCollected(current)
        target.dispose()
    })
})
