import { describe, expect, test } from "./test-compat"
import { atom } from "../../src/atom"
import { globalAtom } from "../../src/globalAtom"
import { selector } from "../../src/selector"
import { store } from "../../src/store"
import type { Store } from "../../src/types/Store"
import type { Transaction } from "../../src/types/Transaction"
import { uniqueName } from "../utils/uniqueName"

const runtime = typeof Bun !== "undefined" ? "bun" : "node"
const bunJscSpecifier = "bun:jsc"
const bunJsc: any =
    typeof Bun !== "undefined" ? await import(bunJscSpecifier) : undefined

type RetainedScenario = {
    units: number
    release(): void
    verify?(): void
}

type MemoryLimit = {
    retainedBytesPerUnit: number
    releasedBytes: number
}

// Structural ceilings are intentionally expressed per retained unit, not as
// engine object-layout assertions. Runtime-specific baselines and
// the rationale for these ceilings live in ARCHITECTURE_PERFORMANCE.md.
const limits: Record<string, Record<typeof runtime, MemoryLimit>> = {
    "atom-only stores": {
        bun: { retainedBytesPerUnit: 160, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 120, releasedBytes: 256 * 1024 },
    },
    "live selector graphs": {
        bun: { retainedBytesPerUnit: 2_400, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 1_500, releasedBytes: 256 * 1024 },
    },
    "dynamic dependency churn": {
        bun: { retainedBytesPerUnit: 2_100, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 1_400, releasedBytes: 256 * 1024 },
    },
    "scope creation and disposal": {
        bun: { retainedBytesPerUnit: 3_200, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 3_400, releasedBytes: 256 * 1024 },
    },
    // Bun ceiling recalibrated with the cross-scope tree-commit change: JSC's
    // heapSize+extraMemorySize is sensitive to the byte layout of the commit
    // engine module — adding a NEVER-CALLED function to a pristine
    // commitEngine.ts moved this scenario 157 → 229 B/unit while the Node/V8
    // lane stayed at 85 B/unit, so the shift is measurement layout, not
    // retention. 360 keeps a real per-transaction pin (e.g. a retained
    // MutationDraft, ~+220 B/unit here) detectable.
    "single-store transactions": {
        bun: { retainedBytesPerUnit: 360, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 120, releasedBytes: 256 * 1024 },
    },
    "deep cross-scope transactions": {
        bun: { retainedBytesPerUnit: 30_000, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 14_000, releasedBytes: 256 * 1024 },
    },
    "global fan-out": {
        bun: { retainedBytesPerUnit: 3_700, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 3_400, releasedBytes: 256 * 1024 },
    },
    "store disposal and async cancellation": {
        bun: { retainedBytesPerUnit: 7_500, releasedBytes: 512 * 1024 },
        node: { retainedBytesPerUnit: 7_500, releasedBytes: 256 * 1024 },
    },
}

const heapUsed = () => {
    if (bunJsc) {
        const stats = bunJsc.heapStats()
        return stats.heapSize + stats.extraMemorySize
    }
    return process.memoryUsage().heapUsed
}

const explicitGC = () => {
    if (typeof Bun !== "undefined") {
        bunJsc.fullGC()
        return
    }
    const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc
    if (!gc) {
        throw new Error(
            "Node memory gates require --expose-gc (use test:memory:node)",
        )
    }
    gc()
}

const settleAndCollect = async () => {
    // Drain promise continuations, queued transaction/orphan work, and timers
    // before three full collections. A macrotask between collections gives
    // finalization/weak-processing work a chance to become observable.
    await Promise.resolve()
    await Promise.resolve()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    explicitGC()
    await Promise.resolve()
    explicitGC()
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    explicitGC()
}

const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

const measureRetained = async (
    name: keyof typeof limits,
    create: () => RetainedScenario,
) => {
    const retainedSamples: number[] = []
    const releasedSamples: number[] = []
    let units = 0

    // Three independent samples; median rejects one GC/JIT/runtime outlier.
    for (let sample = 0; sample < 3; sample++) {
        await settleAndCollect()
        const before = heapUsed()
        let scenario: RetainedScenario | undefined = create()
        units = scenario.units
        await settleAndCollect()
        scenario.verify?.()
        retainedSamples.push(Math.max(0, heapUsed() - before))

        scenario.release()
        scenario = undefined
        await settleAndCollect()
        releasedSamples.push(Math.max(0, heapUsed() - before))
    }

    const retainedBytes = median(retainedSamples)
    const releasedBytes = median(releasedSamples)
    const retainedBytesPerUnit = retainedBytes / units
    const limit = limits[name][runtime]

    console.log(
        JSON.stringify({
            scenario: name,
            runtime,
            units,
            retainedBytes,
            retainedBytesPerUnit: Math.round(retainedBytesPerUnit),
            releasedBytes,
        }),
    )

    expect(retainedBytesPerUnit).toBeLessThanOrEqual(limit.retainedBytesPerUnit)
    expect(releasedBytes).toBeLessThanOrEqual(limit.releasedBytes)
}

describe("architecture retained-memory gates", () => {
    test("atom-only stores", async () => {
        await measureRetained("atom-only stores", () => {
            let target: Store | undefined = store()
            let states = Array.from({ length: 4_000 }, (_, i) => atom(i))
            for (const state of states) target.set(state, state.defaultValue)
            return {
                units: states.length,
                release: () => {
                    target?.dispose()
                    target = undefined
                    states = []
                },
            }
        })
    })

    test("live selector graphs", async () => {
        await measureRetained("live selector graphs", () => {
            let target: Store | undefined = store()
            let source: ReturnType<typeof atom<number>> | undefined = atom(0)
            let selectors = Array.from({ length: 1_500 }, (_, i) =>
                selector(get => get(source!) + i),
            )
            let cleanups = selectors.map(derived =>
                target!.sub(derived, () => {}),
            )
            return {
                units: selectors.length,
                release: () => {
                    target?.dispose()
                    cleanups = []
                    selectors = []
                    source = undefined
                    target = undefined
                },
            }
        })
    })

    test("dynamic dependency churn", async () => {
        await measureRetained("dynamic dependency churn", () => {
            let target: Store | undefined = store()
            let toggle: ReturnType<typeof atom<boolean>> | undefined =
                atom(true)
            let left: ReturnType<typeof atom<number>> | undefined = atom(1)
            let right: ReturnType<typeof atom<number>> | undefined = atom(2)
            let selectors = Array.from({ length: 1_000 }, () =>
                selector(get => (get(toggle!) ? get(left!) : get(right!))),
            )
            let cleanups = selectors.map(derived =>
                target!.sub(derived, () => {}),
            )
            for (let i = 0; i < 12; i++) target.set(toggle, i % 2 === 0)
            return {
                units: selectors.length,
                release: () => {
                    target?.dispose()
                    cleanups = []
                    selectors = []
                    toggle = undefined
                    left = undefined
                    right = undefined
                    target = undefined
                },
            }
        })
    })

    test("scope creation and disposal", async () => {
        await measureRetained("scope creation and disposal", () => {
            let root: Store | undefined = store()
            let scopes = Array.from({ length: 1_500 }, (_, i) =>
                root!.scope(`memory-scope-${i}`),
            )
            return {
                units: scopes.length,
                release: () => {
                    for (const scope of scopes) scope.detach()
                    root?.dispose()
                    scopes = []
                    root = undefined
                },
            }
        })
    })

    test("single-store transactions", async () => {
        await measureRetained("single-store transactions", () => {
            let target: Store | undefined = store()
            let states = Array.from({ length: 2_500 }, () => atom(0))
            target.txn(txn => {
                for (let i = 0; i < states.length; i++) txn.set(states[i]!, i)
            })
            return {
                units: states.length,
                release: () => {
                    target?.dispose()
                    states = []
                    target = undefined
                },
            }
        })
    })

    test("deep cross-scope transactions", async () => {
        await measureRetained("deep cross-scope transactions", () => {
            const depth = 64
            let root: Store | undefined = store()
            let scopes = [] as ReturnType<Store["scope"]>[]
            let cursor = root
            for (let i = 1; i < depth; i++) {
                const scope = cursor.scope(`memory-depth-${i}`)
                scopes.push(scope)
                cursor = scope
            }
            let states = Array.from({ length: depth }, () => atom(0))
            const stage = (txn: Transaction, level: number): void => {
                txn.set(states[level]!, level + 1)
                if (level + 1 < depth) {
                    txn.scope(`memory-depth-${level + 1}`, child =>
                        stage(child, level + 1),
                    )
                }
            }
            root.txn(txn => stage(txn, 0))
            let aggregate = selector(get =>
                states.reduce((sum, state) => sum + get(state), 0),
            )
            let cleanup: (() => void) | undefined = cursor.sub(
                aggregate,
                () => {},
            )
            return {
                units: depth,
                release: () => {
                    cleanup = undefined
                    root?.dispose()
                    scopes = []
                    states = []
                    aggregate = undefined as any
                    root = undefined
                },
            }
        })
    })

    test("global fan-out", async () => {
        await measureRetained("global fan-out", () => {
            let shared: ReturnType<typeof globalAtom<number>> | undefined =
                globalAtom(0, { name: uniqueName("shared") })
            let stores = Array.from({ length: 1_000 }, () => store())
            for (const target of stores) target.get(shared)
            stores[0]!.set(shared, 1)
            return {
                units: stores.length,
                release: () => {
                    for (const target of stores) target.dispose()
                    stores = []
                    shared = undefined
                },
            }
        })
    })

    test("store disposal and async cancellation", async () => {
        await measureRetained("store disposal and async cancellation", () => {
            let source: ReturnType<typeof atom<number>> | undefined = atom(0)
            let signals: AbortSignal[] = []
            let pending = selector((get, { signal }) => {
                get(source!)
                signals.push(signal)
                return new Promise<number>(() => {})
            })
            let stores = Array.from({ length: 500 }, () => store())
            for (const target of stores) target.get(pending)
            const verify = () => {
                expect(signals).toHaveLength(stores.length)
                expect(signals.every(signal => !signal.aborted)).toBe(true)
            }
            return {
                units: stores.length,
                verify,
                release: () => {
                    for (const target of stores) target.dispose()
                    expect(signals.every(signal => signal.aborted)).toBe(true)
                    stores = []
                    signals = []
                    source = undefined
                    pending = undefined as any
                },
            }
        })
    })
})
