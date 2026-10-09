import { expect, test } from "bun:test"
import {
    atom,
    store,
    StoreDisposedError,
    type Store,
    type Transaction,
} from "../../src/index"
const tick = () => new Promise(r => setTimeout(r, 5))
test("latest-only channel: aborted newer intent leaves older, disposed latest does not fall back", async () => {
    const root = store(),
        first = root.scope(),
        second = root.scope(),
        probe = atom(0)
    const requests = atom<{ url: string; origin: Store } | null>(null),
        log: string[] = []
    let handled: object | null = null,
        stopped = false
    const stage = (tx: Transaction, origin: Store, url: string) => {
        tx.scope(root).set(requests, { url, origin })
        tx.scope(root).onCommit(() => {
            if (stopped) return
            const req = root.get(requests)
            if (req === null || req === handled) return
            handled = req
            try {
                req.origin.get(probe)
            } catch (e) {
                if (e instanceof StoreDisposedError) return
                throw e
            }
            log.push(req.url)
        })
    }
    first.txn(tx => stage(tx, first, "old"))
    expect(() =>
        second.txn(tx => {
            stage(tx, second, "aborted")
            throw new Error()
        }),
    ).toThrow()
    await tick()
    expect(log).toEqual(["old"])
    first.txn(tx => stage(tx, first, "older"))
    second.txn(tx => stage(tx, second, "latest"))
    second.dispose()
    await tick()
    expect(log).toEqual(["old"])
    first.txn(tx => stage(tx, first, "cancelled"))
    stopped = true
    await tick()
    expect(log).toEqual(["old"])
    root.dispose()
})
test("async lane preserves completion order and continues after a failed request", async () => {
    const root = store(),
        editor = root.scope(),
        log: string[] = []
    let tail = Promise.resolve(),
        release!: () => void
    const block = new Promise<void>(r => (release = r)),
        reported: unknown[] = [],
        old = globalThis.reportError
    globalThis.reportError = e => {
        reported.push(e)
    }
    const serial = (step: () => Promise<void>) => {
        const run = tail.then(step)
        tail = run.catch(() => {})
        return run
    }
    try {
        editor.txn(tx => {
            tx.scope(root).onCommit(() =>
                serial(async () => {
                    log.push("first")
                    await block
                    throw new Error("copy failed")
                }),
            )
            tx.scope(root).onCommit(() =>
                serial(async () => {
                    log.push("second")
                    log.push("toast")
                }),
            )
        })
        editor.dispose()
        await tick()
        expect(log).toEqual(["first"])
        release()
        await tick()
        expect(log).toEqual(["first", "second", "toast"])
        expect(reported).toHaveLength(1)
    } finally {
        globalThis.reportError = old
        root.dispose()
    }
})
