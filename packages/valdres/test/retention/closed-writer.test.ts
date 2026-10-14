import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
import {
    TransactionClosedError,
    createCommittedStoreTreeDomain,
    type RootTransaction,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "../v1-committed-store-tree/collection-test-transaction"

const expectCollected = async (detector: LeakDetector, label?: string): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        retentionPhase(label, "collection-await-enter", attempt)
        leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", attempt)
    }
    expect(leaking).toBe(false)
}

test("releases a successful row lane retained by its closed cursor and writer", async () => {
    const domain = createCommittedStoreTreeDomain()
    const sessions = createCollectionDefinition<string, object>(domain)
    const row = sessions("retained-draft")
    const store = domain.createStoreTree()
    let transaction: RootTransaction | undefined
    let writer: RootTransaction | undefined
    const detector = (() => {
        let value: object | undefined = Object.freeze({ private: true })
        const detector = new LeakDetector(value)
        runCollectionTransaction(
            domain,
            store,
            (currentTransaction, rows) => {
                transaction = currentTransaction
                writer = rows
                rows.set(row, value!)
            },
        )
        runCollectionTransaction(domain, store, (_txn, rows) =>
            rows.reset(row),
        )
        value = undefined
        return detector
    })()

    expect(transaction).toBeDefined()
    expect(() => writer!.set(row, {})).toThrow(TransactionClosedError)
    await expectCollected(detector)
}, 15_000)

