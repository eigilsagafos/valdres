import { describe, expect, test } from "bun:test"
import {
    createCommittedStoreTreeDomain,
    createInternalExternalAtom,
    createInternalStoreTreeInstrumentation,
    RuntimeMismatchError,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"

function fixture() {
    const counters = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(counters)
    const store = domain.createStoreTree()
    const external = (value = 1) =>
        createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe: () => () => {},
        })
    const counts = () => [
        counters.read("lifecycleRetains"),
        counters.read("lifecycleReleases"),
    ]
    return { counters, domain, store, external, counts }
}

describe("internal external lifecycle", () => {
    test("registrations and scopes aggregate one tree retain and deterministic last release", () => {
        const f = fixture(),
            ext = f.external(),
            child = f.store.scope()
        const a = f.store.sub(ext, () => {}),
            b = f.store.sub(ext, () => {})
        const c = child.sub(ext, () => {})
        expect(f.counts()).toEqual([1, 0])
        a()
        b()
        b()
        expect(f.counts()).toEqual([1, 0])
        c()
        expect(f.counts()).toEqual([1, 1])
        f.store.sub(ext, () => {})()
        expect(f.counts()).toEqual([2, 2])
    })

    test("shared selector branches stop repeated traversal", () => {
        const f = fixture(),
            ext = f.external()
        const shared = f.domain.selector(get => get(ext))
        const left = f.domain.selector(get => get(shared) + 1)
        const right = f.domain.selector(get => get(shared) + 2)
        const top = f.domain.selector(get => get(left) + get(right))
        const stop = f.store.sub(top, () => {})
        expect(f.counters.read("lifecycleEdgeVisits")).toBe(6)
        const before = f.counters.read("lifecycleEdgeVisits")
        const stop2 = f.store.sub(top, () => {})
        expect(f.counters.read("lifecycleEdgeVisits")).toBe(before)
        stop()
        expect(f.counts()).toEqual([1, 0])
        stop2()
        expect(f.counters.read("lifecycleEdgeVisits")).toBe(12)
        expect(f.counts()).toEqual([1, 1])
    })

    test("equal topology acquires replacement branches before old releases", () => {
        const f = fixture(),
            ext = f.external(),
            mode = f.domain.atom(false)
        const branch = f.domain.selector(get => get(ext))
        const top = f.domain.selector(get =>
            get(mode) ? get(ext) : get(branch),
        )
        let calls = 0
        const stop = f.store.sub(top, () => calls++)
        f.store.set(mode, true)
        f.store.set(mode, false)
        expect(calls).toBe(0)
        expect(f.counts()).toEqual([1, 0])
        stop()
        expect(f.counts()).toEqual([1, 1])
    })

    test("a parent's existing external marker does not hide a child's new marked branch", () => {
        const f = fixture(),
            first = f.external(),
            second = f.external()
        const mode = f.domain.atom(false)
        const branch = f.domain.selector(get => (get(mode) ? get(second) : 1))
        const top = f.domain.selector(get => get(first) + get(branch))
        const stop = f.store.sub(top, () => {})
        expect(f.counts()).toEqual([1, 0])
        f.store.set(mode, true)
        expect(f.counts()).toEqual([2, 0])
        f.store.set(mode, false)
        expect(f.counts()).toEqual([2, 1])
        stop()
        expect(f.counts()).toEqual([2, 2])
    })

    test("a preexisting unmarked subscription acquires lifecycle on an equal publication", () => {
        const f = fixture(),
            mode = f.domain.atom(false)
        let ext: ReturnType<typeof f.external>
        const branch = f.domain.selector(get => (get(mode) ? get(ext) : 1))
        const parent = f.domain.selector(get => get(branch))
        let calls = 0
        const stop = f.store.sub(parent, () => calls++)
        expect(f.counters.read("lifecycleEdgeVisits")).toBe(0)
        ext = f.external()
        f.store.set(mode, true)
        expect(f.counts()).toEqual([1, 0])
        expect(calls).toBe(0)
        f.store.set(mode, false)
        expect(f.counts()).toEqual([1, 1])
        stop()
        expect(f.counts()).toEqual([1, 1])
    })

    test("unrelated external definitions add zero lifecycle traversal to ordinary subscriptions", () => {
        const f = fixture()
        f.external()
        const atom = f.domain.atom(0),
            selector = f.domain.selector(get => get(atom))
        const a = f.store.sub(atom, () => {}),
            b = f.store.sub(selector, () => {})
        f.store.set(atom, 1)
        a()
        b()
        f.store.dispose()
        expect(f.counters.read("lifecycleEdgeVisits")).toBe(0)
        expect(f.counts()).toEqual([0, 0])
    })

    test("ancestor disposal releases descendants without releasing another tree", () => {
        const f = fixture(),
            ext = f.external()
        const other = f.domain.createStoreTree(),
            child = f.store.scope(),
            grandchild = child.scope()
        f.store.sub(ext, () => {})
        child.sub(ext, () => {})
        const stop = grandchild.sub(ext, () => {})
        other.sub(ext, () => {})
        expect(f.counts()).toEqual([2, 0])
        child.dispose()
        stop()
        expect(f.counts()).toEqual([2, 0])
        f.store.dispose()
        f.store.dispose()
        expect(f.counts()).toEqual([2, 1])
        other.dispose()
        expect(f.counts()).toEqual([2, 2])
    })

    test("rejected initial proposals admit no subscriber or retain", () => {
        const f = fixture(),
            ext = f.external(),
            foreign = createCommittedStoreTreeDomain().atom(0)
        const selector = f.domain.selector(get => {
            get(ext)
            return get(foreign)
        })
        expect(() => f.store.sub(selector, () => {})).toThrow(
            RuntimeMismatchError,
        )
        expect(f.counts()).toEqual([0, 0])
        expect(f.counters.read("activeSubscriptions")).toBe(0)
    })

    test("retention and release of deep warmed closure avoid recursive graph walks", () => {
        const f = fixture(),
            ext = f.external(),
            mode = f.domain.atom(false)
        let node = f.domain.selector(get => (get(mode) ? get(ext) : 1))
        f.store.get(node)
        for (let index = 0; index < 16000; index++) {
            const previous = node
            node = f.domain.selector(get => get(previous))
            f.store.get(node)
        }
        f.store.set(mode, true)
        const stop = f.store.sub(node, () => {})
        expect(f.counts()).toEqual([1, 0])
        stop()
        expect(f.counts()).toEqual([1, 1])
    }, 30000)
})
