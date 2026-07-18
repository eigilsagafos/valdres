import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

describe("throwing onSet hooks", () => {
    test("a direct set still propagates and notifies before rethrowing", () => {
        const hookError = new Error("onSet failed")
        const count = atom(0, {
            onSet: () => {
                throw hookError
            },
        })
        const doubled = selector(get => get(count) * 2)
        const s = store()
        const seen: number[] = []
        s.sub(doubled, () => seen.push(s.get(doubled)))

        let thrown: unknown
        try {
            s.set(count, 1)
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(hookError)
        expect(s.get(count)).toBe(1)
        expect(s.get(doubled)).toBe(2)
        expect(seen).toEqual([2])
    })

    test("a transaction applies every write, runs every hook, and notifies before rethrowing the first error", () => {
        const firstError = new Error("first onSet failed")
        const secondError = new Error("second onSet failed")
        const hookOrder: string[] = []
        const a = atom(0, {
            onSet: () => {
                hookOrder.push("a")
                throw firstError
            },
        })
        const b = atom(0, {
            onSet: () => {
                hookOrder.push("b")
                throw secondError
            },
        })
        const sum = selector(get => get(a) + get(b))
        const s = store()
        const seen: number[] = []
        s.sub(sum, () => seen.push(s.get(sum)))

        let thrown: unknown
        try {
            s.txn(txn => {
                txn.set(a, 1)
                txn.set(b, 2)
            })
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(firstError)
        expect(hookOrder).toEqual(["a", "b"])
        expect(s.get(a)).toBe(1)
        expect(s.get(b)).toBe(2)
        expect(s.get(sum)).toBe(3)
        expect(seen).toEqual([3])
    })

    test("a cross-scope transaction finishes hooks and propagation in every store", () => {
        const rootError = new Error("root onSet failed")
        const scopeError = new Error("scope onSet failed")
        const hookOrder: string[] = []
        const root = store()
        const child = root.scope("child")
        const rootValue = atom(0, {
            onSet: () => {
                hookOrder.push("root")
                throw rootError
            },
        })
        const childValue = atom(0, {
            onSet: () => {
                hookOrder.push("child")
                throw scopeError
            },
        })
        child.set(childValue, 0)
        const sum = selector(get => get(rootValue) + get(childValue))
        const seen: number[] = []
        child.sub(sum, () => seen.push(child.get(sum)))

        let thrown: unknown
        try {
            root.txn(txn => {
                txn.set(rootValue, 1)
                txn.scope("child", scoped => scoped.set(childValue, 2))
            })
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(rootError)
        expect(hookOrder).toEqual(["root", "child"])
        expect(root.get(rootValue)).toBe(1)
        expect(child.get(childValue)).toBe(2)
        expect(child.get(sum)).toBe(3)
        expect(seen).toEqual([3])
    })

    test("global fan-out applies and notifies every store before rethrowing the first hook error", () => {
        const hookError = new Error("global onSet failed")
        const subscriberError = new Error("peer subscriber failed")
        const onSet = mock(() => {
            throw hookError
        })
        const value = atom(0, { global: true, onSet })
        const doubled = selector(get => get(value) * 2)
        const source = store()
        const throwingPeer = store()
        const trailingPeer = store()
        const sourceSeen: number[] = []
        const throwingPeerSeen: number[] = []
        const trailingPeerSeen: number[] = []
        const snapshots: Array<[number, number, number]> = []
        const snapshot = () =>
            snapshots.push([
                source.get(doubled),
                throwingPeer.get(doubled),
                trailingPeer.get(doubled),
            ])

        source.sub(doubled, () => {
            sourceSeen.push(source.get(doubled))
            snapshot()
        })
        throwingPeer.sub(doubled, () => {
            throwingPeerSeen.push(throwingPeer.get(doubled))
            snapshot()
            throw subscriberError
        })
        trailingPeer.sub(doubled, () => {
            trailingPeerSeen.push(trailingPeer.get(doubled))
            snapshot()
        })

        let thrown: unknown
        try {
            source.set(value, 1)
        } catch (error) {
            thrown = error
        }

        // Hooks run before propagation, so their first error wins even though a
        // later subscriber also throws. Neither error may interrupt fan-out.
        expect(thrown).toBe(hookError)
        expect(onSet).toHaveBeenCalledTimes(1)
        for (const s of [source, throwingPeer, trailingPeer]) {
            expect(s.get(value)).toBe(1)
            expect(s.get(doubled)).toBe(2)
        }
        expect(sourceSeen).toEqual([2])
        expect(throwingPeerSeen).toEqual([2])
        expect(trailingPeerSeen).toEqual([2])
        expect(snapshots).toEqual([
            [2, 2, 2],
            [2, 2, 2],
            [2, 2, 2],
        ])
    })

    test("the last cross-scope global write converges every store despite a hook error", () => {
        const hookError = new Error("first global hook failed")
        let hookCalls = 0
        const value = atom(0, {
            global: true,
            onSet: () => {
                hookCalls++
                if (hookCalls === 1) throw hookError
            },
        })
        const doubled = selector(get => get(value) * 2)
        const root = store()
        const child = root.scope("global-child")
        const rootSeen: number[] = []
        const childSeen: number[] = []
        root.sub(doubled, () => rootSeen.push(root.get(doubled)))
        child.sub(doubled, () => childSeen.push(child.get(doubled)))

        let thrown: unknown
        try {
            root.txn(txn => {
                txn.set(value, 1)
                txn.scope("global-child", scoped => scoped.set(value, 2))
            })
        } catch (error) {
            thrown = error
        }

        expect(thrown).toBe(hookError)
        expect(hookCalls).toBe(2)
        expect(root.get(value)).toBe(2)
        expect(child.get(value)).toBe(2)
        expect(root.get(doubled)).toBe(4)
        expect(child.get(doubled)).toBe(4)
        expect(rootSeen).toEqual([4])
        expect(childSeen).toEqual([4])
    })
})
