import { describe, expect, test } from "bun:test"
import { atom } from "../../atom"
import { selector } from "../../selector"
import { store } from "../../store"
import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import type { DepsChange } from "../../types/DepsChange"
import { checkStoreInvariants } from "../../../test/invariants/checkStoreInvariants"
import { getStoreData } from "../getStoreData"
import {
    acquireEvaluationOutcome,
    releaseEvaluationOutcome,
} from "./evaluationOutcome"
import { addStateDependent } from "./inheritedDependencyBranches"
import { beginLivenessPass, endLivenessPass } from "./mountAtom"
import {
    applyLiveDependencyDiff,
    installEvaluationDeps,
    installEvaluationDepsLiveOnly,
} from "./runtime"

const names = new Map<State, string>()
const label = (state: State) => names.get(state) ?? "?"

const makeStates = () => {
    const a = atom(1)
    const b = atom(2)
    const c = atom(3)
    const sel = selector(get => get(a) + get(b))
    names.set(a, "a").set(b, "b").set(c, "c").set(sel, "sel")
    return { a, b, c, sel }
}

/** Raw graph-table snapshot for the states under test, for twin comparison. */
const snapshot = (data: StoreData, states: State[]) => ({
    deps: states.map(
        state =>
            `${label(state)}:${[...(data.stateDependencies.get(state) ?? [])]
                .map(label)
                .sort()
                .join(",")}`,
    ),
    dependents: states.map(
        state =>
            `${label(state)}:${[...(data.stateDependents.get(state) ?? [])]
                .map(label)
                .sort()
                .join(",")}`,
    ),
    seeds: [...((data.livenessSeeds as Set<State>) ?? [])].map(label).sort(),
    lazyArmed: !!data.livenessLazyArmed,
    removalArmed: !!data.livenessRemovalArmed,
})

describe("installer twin parity", () => {
    // installEvaluationDepsLiveOnly is a monomorphic twin of
    // installEvaluationDeps with tracksReverseEdges=true on a store that has
    // never built a cold cache. The two must produce identical graph tables
    // for every shape, or the twins have semantically drifted.
    const shapes: {
        name: string
        prev?: (states: ReturnType<typeof makeStates>) => State[]
        next: (states: ReturnType<typeof makeStates>) => State[]
        isAsync: boolean
        livenessPass?: boolean
    }[] = [
        { name: "first materialization", next: s => [s.a, s.b], isAsync: false },
        {
            name: "re-eval add+remove",
            prev: s => [s.a, s.b],
            next: s => [s.b, s.c],
            isAsync: false,
            livenessPass: true,
        },
        {
            name: "async merge-forward keeps previous deps",
            prev: s => [s.a],
            next: s => [s.b],
            isAsync: true,
            livenessPass: true,
        },
        {
            name: "empty re-materialization",
            prev: s => [s.a],
            next: () => [],
            isAsync: false,
            livenessPass: true,
        },
    ]

    for (const shape of shapes) {
        test(shape.name, () => {
            const states = makeStates()
            const all = [states.a, states.b, states.c, states.sel]
            const mixed = getStoreData(store())
            const liveOnly = getStoreData(store())
            for (const data of [mixed, liveOnly]) {
                if (shape.prev) {
                    const prev = new Set(shape.prev(states))
                    data === mixed
                        ? installEvaluationDeps(
                              states.sel,
                              data,
                              prev,
                              undefined,
                              true,
                              false,
                              undefined,
                          )
                        : installEvaluationDepsLiveOnly(
                              states.sel,
                              data,
                              prev,
                              undefined,
                              false,
                          )
                }
                if (shape.livenessPass) beginLivenessPass(data)
                const next = new Set(shape.next(states))
                data === mixed
                    ? installEvaluationDeps(
                          states.sel,
                          data,
                          next,
                          data.stateDependencies.get(states.sel),
                          true,
                          shape.isAsync,
                          undefined,
                      )
                    : installEvaluationDepsLiveOnly(
                          states.sel,
                          data,
                          next,
                          data.stateDependencies.get(states.sel),
                          shape.isAsync,
                      )
            }
            expect(snapshot(mixed, all)).toEqual(snapshot(liveOnly, all))
            if (shape.livenessPass) {
                endLivenessPass(mixed)
                endLivenessPass(liveOnly)
            }
        })
    }

    test("first-materialization install merges an interval-created forward set", () => {
        // A deferred `get` running between capture and install (then-getter)
        // creates the selector's forward set through installLateDependency.
        // Both installer twins must merge it rather than overwrite it.
        const runFor = (liveOnly: boolean) => {
            const states = makeStates()
            const data = getStoreData(store())
            data.stateDependencies.set(states.sel, new Set([states.c]))
            addStateDependent(states.c, states.sel, data)
            liveOnly
                ? installEvaluationDepsLiveOnly(
                      states.sel,
                      data,
                      new Set([states.a]),
                      undefined,
                      true,
                  )
                : installEvaluationDeps(
                      states.sel,
                      data,
                      new Set([states.a]),
                      undefined,
                      true,
                      true,
                      undefined,
                  )
            const forward = [...data.stateDependencies.get(states.sel)!]
                .map(label)
                .sort()
            expect(forward).toEqual(["a", "c"])
            expect(data.stateDependents.get(states.c)?.has(states.sel)).toBe(
                true,
            )
            expect(data.stateDependents.get(states.a)?.has(states.sel)).toBe(
                true,
            )
        }
        runFor(false)
        runFor(true)
    })

    test("the propagation diff suppresses the lazy arm; its absence arms it", () => {
        const states = makeStates()
        const data = getStoreData(store())
        installEvaluationDeps(
            states.sel,
            data,
            new Set([states.a]),
            undefined,
            true,
            false,
            undefined,
        )
        beginLivenessPass(data)
        const depsChange: DepsChange = {}
        installEvaluationDeps(
            states.sel,
            data,
            new Set([states.b]),
            data.stateDependencies.get(states.sel),
            true,
            false,
            depsChange,
        )
        // Loop-driven re-eval: the diff is exported, the lazy arm stays off.
        expect([...depsChange.added!].map(label)).toEqual(["b"])
        expect([...depsChange.removed!].map(label)).toEqual(["a"])
        expect(data.livenessLazyArmed).toBe(false)
        // Removed selector deps would arm removal; a removed ATOM must not.
        expect(data.livenessRemovalArmed).toBe(false)
        endLivenessPass(data)

        beginLivenessPass(data)
        installEvaluationDeps(
            states.sel,
            data,
            new Set([states.c]),
            data.stateDependencies.get(states.sel),
            true,
            false,
            undefined,
        )
        // Lazy re-init (no diff consumer): the reconcile must arm.
        expect(data.livenessLazyArmed).toBe(true)
        endLivenessPass(data)
    })
})

describe("evaluation outcome pool", () => {
    test("nested acquires get distinct slots; release restores depth", () => {
        const outer = acquireEvaluationOutcome()
        const inner = acquireEvaluationOutcome()
        expect(inner).not.toBe(outer)
        releaseEvaluationOutcome(inner)
        const innerAgain = acquireEvaluationOutcome()
        expect(innerAgain).toBe(inner)
        releaseEvaluationOutcome(innerAgain)
        releaseEvaluationOutcome(outer)
        const outerAgain = acquireEvaluationOutcome()
        expect(outerAgain).toBe(outer)
        releaseEvaluationOutcome(outerAgain)
    })

    test("release clears dep references; acquire resets the install gate", () => {
        const outcome = acquireEvaluationOutcome()
        outcome.deps = new Set([atom(1)])
        outcome.prevDeps = new Set([atom(2)])
        outcome.needsInstall = true
        releaseEvaluationOutcome(outcome)
        // The pooled slot must not pin any state after release (retention).
        expect(outcome.deps).toBeUndefined()
        expect(outcome.prevDeps).toBeUndefined()
        // A throwing evaluator never writes the carrier — the next acquire
        // must present a definite false to the dispatcher's install gate.
        const again = acquireEvaluationOutcome()
        expect(again.needsInstall).toBe(false)
        releaseEvaluationOutcome(again)
    })

    test("deep fresh-selector recursion evaluates through nested carriers", () => {
        const base = atom(1)
        const chain = [selector(get => get(base) + 1)]
        for (let i = 1; i < 24; i++) {
            const previous = chain[i - 1]!
            chain.push(selector(get => get(previous) + 1))
        }
        const s = store()
        const top = chain[chain.length - 1]!
        const seen: number[] = []
        s.sub(top, () => seen.push(s.get(top)))
        expect(s.get(top)).toBe(25)
        s.set(base, 2)
        expect(seen).toEqual([26])
        expect(checkStoreInvariants(s, { states: [base, ...chain] })).toEqual(
            [],
        )
    })

    test("a throwing evaluator releases its carrier for the next evaluation", () => {
        const flag = atom(true)
        const boom = selector(get => {
            if (get(flag)) throw new Error("boom")
            return "ok"
        })
        const s = store()
        expect(() => s.get(boom)).toThrow()
        expect(() => s.get(boom)).toThrow()
        s.set(flag, false)
        expect(s.get(boom)).toBe("ok")
        expect(checkStoreInvariants(s, { states: [flag, boom] })).toEqual([])
    })

    test("steady-state re-evaluation installs nothing", () => {
        const a = atom(1)
        const b = atom(2)
        const sum = selector(get => get(a) + get(b))
        const s = store()
        const data = getStoreData(s)
        s.sub(sum, () => {})
        expect(s.get(sum)).toBe(3)
        const versionAfterInit = data.dependencyGraphVersion
        s.set(a, 10)
        expect(s.get(sum)).toBe(12)
        // Same dep set → needsInstall false → no graph-runtime call, so the
        // topology generation is untouched.
        expect(data.dependencyGraphVersion).toBe(versionAfterInit)
    })

    test("consecutive stores keep independent graphs through one pool", () => {
        const a = atom(1)
        const sel = selector(get => get(a) * 2)
        const s1 = store()
        const s2 = store()
        s1.sub(sel, () => {})
        expect(s1.get(sel)).toBe(2)
        s2.set(a, 5)
        expect(s2.get(sel)).toBe(10)
        expect(s1.get(sel)).toBe(2)
        const d1 = getStoreData(s1)
        const d2 = getStoreData(s2)
        expect(d1.stateDependents.get(a)?.has(sel)).toBe(true)
        expect([...(d2.stateDependencies.get(sel) ?? [])]).toEqual([a])
    })

    test("transaction overlay evaluation leaves the committed graph untouched", () => {
        const a = atom(1)
        const doubled = selector(get => get(a) * 2)
        const s = store()
        const data = getStoreData(s)
        s.txn(tx => {
            tx.set(a, 21)
            expect(tx.get(doubled)).toBe(42)
        })
        // The overlay's private forward map carried the txn read; the
        // committed reverse graph never saw the selector.
        expect(data.stateDependents.get(a)?.has(doubled) ?? false).toBe(false)
        expect(s.get(doubled)).toBe(42)
    })
})

describe("late dependency install", () => {
    test("a dependency read twice after await settles liveness exactly once", async () => {
        const dep = atom(2)
        const sel = selector(get =>
            (async () => {
                await Promise.resolve()
                const first = get(dep)
                await Promise.resolve()
                const second = get(dep)
                return first + second
            })(),
        )
        const s = store()
        const data = getStoreData(s)
        s.sub(sel, () => {})
        await s.get(sel)
        // Second read is an existing edge: install returns false and the
        // settle half must not run again — a double settle would count the
        // same edge twice.
        expect(data.graphNodes.get(dep)?.live).toBe(1)
        expect(checkStoreInvariants(s, { quiescent: true })).toEqual([])
    })

    test("a genuinely new post-await dependency mounts and counts once", async () => {
        let mounts = 0
        let cleanups = 0
        const dep = atom(7, {
            onMount: () => {
                mounts++
                return () => {
                    cleanups++
                }
            },
        })
        const sel = selector(get =>
            (async () => {
                await Promise.resolve()
                return get(dep) * 3
            })(),
        )
        const s = store()
        const data = getStoreData(s)
        const unsub = s.sub(sel, () => {})
        expect(await s.get(sel)).toBe(21)
        expect(data.graphNodes.get(dep)?.live).toBe(1)
        expect(mounts).toBe(1)
        unsub()
        await Promise.resolve()
        expect(cleanups).toBe(1)
        expect(
            checkStoreInvariants(s, { states: [dep, sel], quiescent: true }),
        ).toEqual([])
    })

    test("a then-getter's deferred get cannot strand asymmetric edges", async () => {
        // A returned promise's user-visible `then` is probed on the way to
        // settlement. A getter there can run the captured `get` in the
        // capture-to-install window; the installed dependency set must not
        // overwrite (and thereby orphan) the reverse edge lateGet created.
        const dep = atom(1)
        let capturedGet: ((state: State) => unknown) | undefined
        let thenReads = 0
        const sel = selector((get: any) => {
            capturedGet = get
            const promise = Promise.resolve(41)
            const realThen = promise.then.bind(promise)
            Object.defineProperty(promise, "then", {
                get() {
                    thenReads++
                    if (thenReads === 2) capturedGet!(dep)
                    return realThen
                },
            })
            return promise
        })
        const s = store()
        const data = getStoreData(s)
        const unsub = s.sub(sel, () => {})
        await s.get(sel)
        await Promise.resolve()
        expect(thenReads).toBeGreaterThanOrEqual(2)
        // Symmetry: any reverse edge must have its forward twin.
        const forward = data.stateDependencies.get(sel)
        const reverse = data.stateDependents.get(dep)
        if (reverse?.has(sel)) {
            expect(forward?.has(dep)).toBe(true)
        }
        expect(
            checkStoreInvariants(s, { states: [dep, sel], quiescent: true }),
        ).toEqual([])
        unsub()
        await Promise.resolve()
        expect(data.stateDependents.get(dep)?.has(sel) ?? false).toBe(false)
        expect(
            checkStoreInvariants(s, { quiescent: true }),
        ).toEqual([])
    })

    test("a throwing dependency read still records the new edge", async () => {
        const boom = selector((): number => {
            throw new Error("late boom")
        })
        const sel = selector(get =>
            (async () => {
                await Promise.resolve()
                return get(boom)
            })(),
        )
        const s = store()
        const data = getStoreData(s)
        s.sub(sel, () => {})
        await expect(s.get(sel)).rejects.toThrow()
        expect(data.stateDependencies.get(sel)?.has(boom)).toBe(true)
    })
})

describe("invariant phase boundaries", () => {
    test("topology-only install settles fully after the dependency diff", () => {
        const a = atom(1)
        const b = atom(2)
        const sum = selector(get => get(a) + get(b))
        const s = store()
        const data = getStoreData(s)
        s.sub(sum, () => {})
        expect(s.get(sum)).toBe(3)

        // Simulate a propagation-loop re-evaluation that discovered a new
        // dependency: install the topology first, exactly as the dispatcher
        // does, with the liveness diff still pending.
        const c = atom(5)
        beginLivenessPass(data)
        const depsChange: DepsChange = {}
        installEvaluationDeps(
            sum,
            data,
            new Set<State>([a, b, c]),
            data.stateDependencies.get(sum),
            true,
            false,
            depsChange,
        )

        // Phase 2 — topology installed: symmetric edges and ownership hold;
        // liveness settlement is honestly still pending.
        const topologyOnly = checkStoreInvariants(s, {
            states: [a, b, c, sum],
            skip: ["liveness-counts", "mount-state"],
        })
        expect(topologyOnly).toEqual([])
        const beforeDiff = checkStoreInvariants(s, { states: [a, b, c, sum] })
        expect(
            beforeDiff.some(violation =>
                violation.startsWith("[liveness-counts]"),
            ),
        ).toBe(true)

        // Phase 3 — the diff is applied: full invariants hold again.
        applyLiveDependencyDiff(
            sum,
            depsChange.added,
            depsChange.removed,
            data,
        )
        endLivenessPass(data)
        expect(checkStoreInvariants(s, { states: [a, b, c, sum] })).toEqual([])
        expect(s.get(sum)).toBe(3)
        s.set(c, 6)
        expect(s.get(sum)).toBe(3)
    })

    test("full invariants hold after disposal", () => {
        const a = atom(1)
        const sel = selector(get => get(a) + 1)
        const s = store()
        s.sub(sel, () => {})
        expect(s.get(sel)).toBe(2)
        s.dispose()
        // No explicit `states` seed: disposal deliberately leaves weak graph
        // entries to be collected with the store; the checker audits the
        // terminal state through the store's own iterable anchors.
        expect(checkStoreInvariants(s)).toEqual([])
    })
})
