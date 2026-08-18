/**
 * End-to-end timing confirmations for the deterministic architecture gates.
 * These run in isolated Bun and Node/Vitest processes; latency remains diagnostic,
 * while architecturePerformance.test.ts owns the non-noisy blocking counts.
 */
import { describe, test } from "./test-compat"
import { atom } from "../../src/atom"
import { globalAtom } from "../../src/globalAtom"
import { selector } from "../../src/selector"
import { store } from "../../src/store"
import type { Transaction } from "../../src/types/Transaction"
import { measureOne } from "./bench-utils"
import { uniqueName } from "../utils/uniqueName"

const noop = () => {}

describe("architecture timing confirmations", () => {
    test("atom-only store", async () => {
        const target = store()
        const value = atom(0)
        let next = 0
        target.get(value)
        await measureOne("architecture: atom-only set", () => {
            target.set(value, ++next)
        })
    })

    test("live selector graph", async () => {
        const target = store()
        const source = atom(0)
        const selectors = Array.from({ length: 100 }, (_, i) =>
            selector(get => get(source) + i),
        )
        selectors.forEach(derived => target.sub(derived, noop))
        let next = 0
        await measureOne("architecture: live graph fan-out 100", () => {
            target.set(source, ++next)
        })
    })

    test("unchanged multi-seed closure", async () => {
        const target = store()
        const source = atom(0)
        const left = selector(get => {
            get(source)
            return 0
        })
        const right = selector(get => {
            get(source)
            return 0
        })
        let sink = left
        for (let index = 0; index < 200; index++) {
            const dependency = sink
            sink = selector(get => get(dependency) + 1)
        }
        target.sub(sink, noop)
        target.sub(right, noop)
        let next = 0
        await measureOne(
            "architecture: unchanged multi-seed closure 200",
            () => {
                target.set(source, ++next)
            },
        )
    })

    test("dynamic dependency churn", async () => {
        const target = store()
        const toggle = atom(true)
        const left = atom(1)
        const right = atom(2)
        const selectors = Array.from({ length: 100 }, () =>
            selector(get => (get(toggle) ? get(left) : get(right))),
        )
        selectors.forEach(derived => target.sub(derived, noop))
        let next = true
        await measureOne("architecture: dependency churn 100", () => {
            target.set(toggle, (next = !next))
        })
    })

    test("scope creation and disposal", async () => {
        const root = store()
        await measureOne("architecture: create + dispose scope", () => {
            root.scope("timed-scope").detach()
        })
    })

    test("single-store transaction", async () => {
        const target = store()
        const states = Array.from({ length: 20 }, () => atom(0))
        let next = 0
        await measureOne("architecture: single-store txn 20 writes", () => {
            const value = ++next
            target.txn(txn => {
                for (const state of states) txn.set(state, value)
            })
        })
    })

    test("deep cross-scope transaction", async () => {
        const depth = 8
        const root = store()
        let cursor = root
        for (let level = 1; level < depth; level++) {
            cursor = cursor.scope(`timed-depth-${level}`)
        }
        const states = Array.from({ length: depth }, () => atom(0))
        const aggregate = selector(get =>
            states.reduce((sum, state) => sum + get(state), 0),
        )
        cursor.sub(aggregate, noop)
        let next = 0
        const stage = (
            txn: Transaction,
            level: number,
            value: number,
        ): void => {
            txn.set(states[level]!, value)
            if (level + 1 < depth) {
                txn.scope(`timed-depth-${level + 1}`, child =>
                    stage(child, level + 1, value),
                )
            }
        }
        await measureOne("architecture: cross-scope txn depth 8", () => {
            const value = ++next
            root.txn(txn => stage(txn, 0, value))
        })
    })

    test("global fan-out", async () => {
        const shared = globalAtom(0, { name: uniqueName("shared") })
        const stores = Array.from({ length: 100 }, () => store())
        stores.forEach(target => target.get(shared))
        let next = 0
        await measureOne("architecture: global fan-out 100", () => {
            stores[0]!.set(shared, ++next)
        })
        stores.forEach(target => target.dispose())
    })

    test("store disposal and async cancellation", async () => {
        const source = atom(0)
        const pending = selector((get, _options) => {
            get(source)
            return new Promise<number>(() => {})
        })
        await measureOne("architecture: dispose pending selector", () => {
            const target = store()
            target.get(pending)
            target.dispose()
        })
    })
})
