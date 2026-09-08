import { expect, test } from "bun:test"
import {
    atom,
    selector,
    store,
    SelectorCircularDependencyError,
    type Selector,
} from "../../src/index"

test("uncertainty stops at equal outcomes and leaves unrelated bodies current", () => {
    const source = atom(0)
    const unrelated = atom(10)
    let leafCalls = 0
    let parentCalls = 0
    let unrelatedCalls = 0
    const parity = selector(get => {
        leafCalls++
        return get(source) % 2
    })
    const stable = selector(get => {
        unrelatedCalls++
        return get(unrelated)
    })
    const parent = selector(get => {
        parentCalls++
        return get(parity) + get(stable)
    })
    const target = store()
    let notifications = 0
    target.sub(parent, () => notifications++)
    expect(target.get(parent)).toBe(10)
    target.set(source, 2)
    expect(target.get(parent)).toBe(10)
    expect([leafCalls, parentCalls, unrelatedCalls, notifications]).toEqual([
        2, 1, 1, 0,
    ])
    target.set(source, 3)
    expect(target.get(parent)).toBe(11)
    expect([leafCalls, parentCalls, unrelatedCalls, notifications]).toEqual([
        3, 2, 1, 1,
    ])
    target.dispose()
})

test("caught recursive reads remain failed and later supplied reads do no work", () => {
    const target = store()
    let laterCalls = 0
    const later = selector(() => ++laterCalls)
    let self: Selector<number>
    self = selector(get => {
        try {
            get(self)
        } catch {}
        try {
            get(later)
        } catch {}
        return 1
    })
    expect(() => target.get(self)).toThrow(SelectorCircularDependencyError)
    expect(laterCalls).toBe(0)
    target.dispose()
})

test("a transaction abort discards scratch currentness and notifications", () => {
    const source = atom(2)
    const derived = selector(get => get(source) * 3)
    const target = store()
    let notifications = 0
    target.sub(derived, () => notifications++)
    expect(() =>
        target.txn(tx => {
            tx.set(source, 4)
            expect(tx.get(derived)).toBe(12)
            throw new Error("abort")
        }),
    ).toThrow("abort")
    expect(target.get(derived)).toBe(6)
    expect(notifications).toBe(0)
    target.dispose()
})

test("uncertainty and canonical values are qualified by Store", () => {
    const source = atom(1)
    const derived = selector(get => get(source) * 2)
    const first = store()
    const second = store()
    expect(first.get(derived)).toBe(2)
    expect(second.get(derived)).toBe(2)
    first.set(source, 5)
    expect(first.get(derived)).toBe(10)
    expect(second.get(derived)).toBe(2)
    first.dispose()
    second.dispose()
})
