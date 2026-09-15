import { expect, test as bunTest } from "bun:test"
import { collection, store, type Transaction } from "../../src/index"
import { query } from "../../src/query"
import { LeakDetector } from "../../../test/src/LeakDetector"

// Match the family lifecycle retry pattern: JSC can conservatively retain dead
// stack slots under full-suite heap pressure. Keep the leak assertion mandatory.
const test = (name: string, run: () => Promise<void>) =>
    bunTest(name, run, 60_000)
const expectCollected = async (detector: LeakDetector): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++)
        leaking = await detector.isLeaking()
    expect(leaking).toBe(false)
}

const setup = (dispose: boolean) => {
    const entities = collection<
        string,
        { kind: string },
        string,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const root = store(),
        child = root.scope("child")
    let row: ReturnType<typeof entities> | undefined = entities("one")
    const detector = new LeakDetector(row)
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    child.set(row, { kind: "task" })
    child.get(tasks)
    const cleanup = child.sub(tasks, () => {})
    if (dispose) child.dispose()
    else {
        child.delete(row)
        child.reset(row)
        cleanup()
    }
    row = undefined
    return { detector, root, child, tasks, cleanup }
}
for (const dispose of [false, true])
    test(`index releases removed rows (dispose=${dispose})`, async () => {
        const fixture = setup(dispose)
        await expectCollected(fixture.detector)
        // Keep the disposed Store, query and unsubscribe closure alive during GC.
        expect(fixture.tasks).toBeDefined()
        fixture.root.dispose()
    })

test("closed transaction releases scratch query snapshots after rollback", async () => {
    const entities = collection<
        string,
        { kind: string },
        string,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const s = store()
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    let retained: Transaction | undefined
    const probe = (() => {
        const row = entities("scratch")
        const detector = new LeakDetector(row)
        try {
            s.txn(tx => {
                retained = tx
                tx.set(row, { kind: "task" })
                const rows = tx.get(tasks)
                expect(tx.get(tasks)).toBe(rows)
                throw new Error("abort")
            })
        } catch {}
        return detector
    })()
    await expectCollected(probe)
    expect(retained).toBeDefined()
    expect(s.get(tasks)).toEqual([])
    s.dispose()
})

test("unreferenced anonymous index scopes and query handles are collectable", async () => {
    const entities = collection<
        string,
        { kind: string },
        string,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const root = store()
    const make = () => {
        const child = root.scope()
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        child.get(tasks)
        return {
            scope: new LeakDetector(child),
            query: new LeakDetector(tasks),
        }
    }
    const fixture = make()
    await expectCollected(fixture.scope)
    await expectCollected(fixture.query)
    root.set(entities("one"), { kind: "task" })
    root.dispose()
})
