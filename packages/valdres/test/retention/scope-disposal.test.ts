import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
import {
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type CommittedStoreTree,
    type State,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "../v1-committed-store-tree/collection-test-transaction"

const read = (store: CommittedStoreTree, state: State<any>): any =>
    store.get(state)

const expectRetained = async (detector: LeakDetector, label?: string): Promise<void> => {
    retentionPhase(label, "retention-await-enter")
    const leaking = await detector.isLeaking(10, label)
    retentionPhase(label, leaking ? "retention-await-return-live" : "retention-await-return-collected")
    expect(leaking).toBe(true)
}

const expectCollected = async (detector: LeakDetector, label?: string): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        retentionPhase(label, "collection-await-enter", attempt)
        leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", attempt)
    }
    expect(leaking).toBe(false)
}

test("scope disposal releases pins and detaches MembershipRecord routes exactly once", async () => {
    const instrumentation = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(instrumentation)
    const sessions = createCollectionDefinition<string, number>(domain)
    const root = domain.createStoreTree()
    const child = root.scope("child")
    let row: ReturnType<typeof sessions> | undefined = sessions("owned")
    expect(read(child, sessions)).toEqual([])
    const membershipRouteAdds = instrumentation.read("routeAdds")

    runCollectionTransaction(domain, root, (_txn, rows) =>
        rows.scope(child).set(row!, 1),
    )
    expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds)
    expect(read(child, row)).toBe(1)
    expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds)

    runCollectionTransaction(domain, root, (_txn, rows) =>
        rows.scope(child).reset(row!),
    )
    expect(read(child, row)).toBeUndefined()
    expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds + 1)

    runCollectionTransaction(domain, root, (_txn, rows) =>
        rows.scope(child).set(row!, 2),
    )
    const routeRemovesBefore = instrumentation.read("routeRemoves")
    const detector = new LeakDetector(row, "scope-row")
    row = undefined
    await expectRetained(detector, "scope-owned")

    child.dispose()
    expect(instrumentation.read("routeRemoves")).toBe(
        routeRemovesBefore + 1,
    )
    child.dispose()
    expect(instrumentation.read("routeRemoves")).toBe(
        routeRemovesBefore + 1,
    )
    await expectCollected(detector, "scope-released")
}, 15_000)

