// Transaction.resetAll(): an application draft store's in-place REBASE
// (root version write, clear, seed snapshot + tombstones, replay) at
// application scale, with never-written read-only children subscribed.
import { describe, expect, test } from "bun:test"
import * as V from "../../src/index"
import * as R from "./reset-all-draft-rebase.scenario.mjs"

describe("resetAll draft rebase workload", () => {
    test("root version write, clear, seed with tombstones, replay; read-only children", () => {
        const { results, notifications }: any = R.draftRebase(V)
        expect(results.filter((r: any) => !r.ok)).toEqual([])
        expect(notifications.affected).toBeGreaterThan(50)
    })
    test("clearing restores CURRENT-root inheritance: a missing tombstone shows the late row", () => {
        expect(
            (R.draftRebaseMissingTombstone(V) as any).lateVisibleInDraft,
        ).toBe(true)
    })
    test("failure during replay rolls back everything", () => {
        expect(R.draftRebaseRollback(V)).toEqual({
            errorPropagated: true,
            rootVersionUnchanged: true,
            draftArrayIdentical: true,
            notifications: 0,
        })
    })
})
