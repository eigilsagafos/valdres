import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
import {
    createCommittedStoreTreeDomain,
    type CommittedStoreTree,
    type State,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"

const read = (store: CommittedStoreTree, state: State<any>): any =>
    store.get(state)

const expectCollected = async (detector: LeakDetector, label?: string): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        retentionPhase(label, "collection-await-enter", attempt)
        leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", attempt)
    }
    expect(leaking).toBe(false)
}

test("cold RowViews and their inherited route do not retain row definitions", async () => {
    const domain = createCommittedStoreTreeDomain()
    const sessions = createCollectionDefinition<string, number>(domain)
    const root = domain.createStoreTree()
    const child = root.scope("child")
    const detector = (() => {
        let row: ReturnType<typeof sessions> | undefined = sessions("cold")
        const detector = new LeakDetector(row)
        expect(read(child, row)).toBeUndefined()
        row = undefined
        return detector
    })()

    await expectCollected(detector)
    expect(root).toBeDefined()
    expect(child).toBeDefined()
})

