import { expect, test } from "bun:test"
import {
    createCommittedStoreTreeDomain,
    getExternalDomainRecords,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"

test("transaction and server observations defer the live plane until a committed external reach", () => {
    const domain = createCommittedStoreTreeDomain()
    const external = createInternalExternalAtom(domain, {
        getSnapshot: () => 1,
        getServerSnapshot: () => 2,
        subscribe: () => () => {},
    })
    const records = getExternalDomainRecords(domain)
    const runtime = records.externalRuntime!
    let allocations = 0
    records.externalRuntime = {
        ...runtime,
        createTree(host) {
            allocations++
            return runtime.createTree(host)
        },
    }
    const root = domain.createStoreTree()
    const child = root.scope()
    root.txn(tx => expect(tx.get(external)).toBe(1))
    expect(domain.adapter.readHydrationSnapshot(child, external)).toBe(2)
    expect(allocations).toBe(0)
    const stop = child.sub(external, () => {})
    expect(allocations).toBe(1)
    expect(root.get(external)).toBe(1)
    expect(allocations).toBe(1)
    stop()
    root.dispose()
})

test.each([false, true])(
    "unused external definitions allocate no tree plane (warm=%s)",
    warm => {
        const domain = createCommittedStoreTreeDomain()
        const app = domain.createStoreTree()
        const other = domain.createStoreTree()
        const input = domain.atom(0)
        const selected = domain.selector(get => get(input) + 1)
        if (warm) expect(app.get(selected)).toBe(1)
        let samples = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => ++samples,
            subscribe: () => () => {},
        })
        const records = getExternalDomainRecords(domain)
        const runtime = records.externalRuntime!
        let allocations = 0
        let operations = 0
        records.externalRuntime = {
            ...runtime,
            createTree(host) {
                allocations++
                const plane = runtime.createTree(host)
                const beginHost = plane.beginHost.bind(plane)
                plane.beginHost = (...args) => {
                    operations++
                    beginHost(...args)
                }
                return plane
            },
        }
        for (const target of [app, other]) {
            expect(target.get(selected)).toBe(1)
            const stop = target.sub(selected, () => {})
            target.set(input, 1)
            target.txn(tx => {
                expect(tx.get(selected)).toBe(2)
                tx.set(input, 2)
            })
            expect(target.get(selected)).toBe(3)
            stop()
        }
        expect(allocations).toBe(0)
        expect(operations).toBe(0)
        expect(samples).toBe(0)
        expect(app.get(external)).toBe(1)
        expect(allocations).toBe(1)
        expect(operations).toBe(1)
        other.set(input, 3)
        other.sub(selected, () => {})()
        expect(other.get(selected)).toBe(4)
        expect(allocations).toBe(1)
        expect(operations).toBe(1)
        app.dispose()
        other.dispose()
    },
)
