import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
import {
    createCommittedStoreTreeDomain,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "../v1-committed-store-tree/collection-test-transaction"

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

test("pins Present and Absent owners until reset", async () => {
    retentionPhase("collection-test", `start platform=${process.platform} arch=${process.arch} bun=${Bun.version}`)
    const domain = createCommittedStoreTreeDomain()
    const sessions = createCollectionDefinition<string, number>(domain)
    const root = domain.createStoreTree()
    const child = root.scope("child")

    const present = (() => {
        let row: ReturnType<typeof sessions> | undefined =
            sessions("present")
        const detector = new LeakDetector(row, "present")
        const reference = new WeakRef(row)
        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.set(row!, 1),
        )
        row = undefined
        return { detector, reference }
    })()
    retentionPhase("present-owned", "ownership-created")
    await expectRetained(present.detector, "present-owned")
    retentionPhase("present-released", "reset-enter")
    ;(() => {
        const row = sessions("present")
        expect(present.reference.deref()).toBe(row)
        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.reset(row),
        )
    })()
    retentionPhase("present-released", "reset-return")
    await expectCollected(present.detector, "present-released")

    const absent = (() => {
        let row: ReturnType<typeof sessions> | undefined =
            sessions("absent")
        const detector = new LeakDetector(row, "absent")
        const reference = new WeakRef(row)
        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).delete(row!),
        )
        row = undefined
        return { detector, reference }
    })()
    retentionPhase("absent-owned", "ownership-created")
    await expectRetained(absent.detector, "absent-owned")
    retentionPhase("absent-released", "reset-enter")
    ;(() => {
        const row = sessions("absent")
        expect(absent.reference.deref()).toBe(row)
        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).reset(row),
        )
    })()
    retentionPhase("absent-released", "reset-return")
    await expectCollected(absent.detector, "absent-released")
    retentionPhase("collection-test", "complete")
}, 15_000)

