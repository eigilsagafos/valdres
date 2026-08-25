import { getStoreData } from "./getStoreData"
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    mock,
    test,
} from "bun:test"
import { selector } from "../selector"
import { store } from "../store"
import { atom } from "../atom"
import { commitAtoms, FRESH_ATOM_FAST_PATH_MIN } from "./setAtoms"
import {
    BULK_NO_EFFECTS_SILENT,
    BULK_WITH_EFFECTS_SILENT,
} from "./commitIntents"
import { equal } from "./equal"
import { IS_PROD } from "./IS_PROD"
import type { Atom } from "../types/Atom"
import { commitEndRegistry } from "./onCommitEnd"
import { changeListenerRegistry } from "./notifyChangeListeners"

describe("commitAtoms", () => {
    test("invokes atom.onSet for each updated atom with a collecting intent", () => {
        const store1 = store()
        const onSetA = mock(() => {})
        const onSetB = mock(() => {})
        const atomA = atom(1, { onSet: onSetA })
        const atomB = atom("a", { onSet: onSetB })
        store1.get(atomA)
        store1.get(atomB)

        const pairs = new Map<any, any>([
            [atomA, 2],
            [atomB, "b"],
        ])
        commitAtoms(
            pairs,
            getStoreData(store1),
            new Set(),
            BULK_WITH_EFFECTS_SILENT,
        )

        expect(onSetA).toHaveBeenCalledTimes(1)
        expect(onSetA).toHaveBeenCalledWith(2, store1)
        expect(onSetB).toHaveBeenCalledTimes(1)
        expect(onSetB).toHaveBeenCalledWith("b", store1)
    })

    test('onSet: "skip" suppresses atom.onSet invocations', () => {
        const store1 = store()
        const onSetA = mock(() => {})
        const onSetB = mock(() => {})
        const atomA = atom(1, { onSet: onSetA })
        const atomB = atom("a", { onSet: onSetB })
        store1.get(atomA)
        store1.get(atomB)

        const pairs = new Map<any, any>([
            [atomA, 2],
            [atomB, "b"],
        ])
        commitAtoms(
            pairs,
            getStoreData(store1),
            new Set(),
            BULK_NO_EFFECTS_SILENT,
        )

        expect(onSetA).toHaveBeenCalledTimes(0)
        expect(onSetB).toHaveBeenCalledTimes(0)
        // Values still get written
        expect(getStoreData(store1).values.get(atomA)).toBe(2)
        expect(getStoreData(store1).values.get(atomB)).toBe("b")
    })
})


/**
 * The seed fast path (`tryWriteFreshSimpleAtoms`) replaces the established
 * write phase for a large batch of fresh, side-effect-free atoms. It runs the
 * same per-atom sequence — land the declared default, run the atom's
 * comparator, write — and these tests pin the two steps before the write,
 * whose results are unused and which exist only for failure fidelity.
 *
 * Every case runs at both `FRESH_ATOM_FAST_PATH_MIN` and one below it, so the
 * specialization is compared against the path it stands in for rather than
 * against an expectation written down by hand. The two hostile cases below
 * hinge on a value getter firing exactly twice — once when the transaction
 * body stages the value, once when the commit writes it — so each asserts that
 * traversal count. Were a third traversal ever added, the hijack would land
 * before admission instead of inside the write loop and these tests would go
 * quietly vacuous; the assertion turns that into a failure instead.
 */
describe("seed fast path", () => {
    const BELOW = FRESH_ATOM_FAST_PATH_MIN - 1
    const AT = FRESH_ATOM_FAST_PATH_MIN
    // Traversal count for the VALUE-CARRIER mechanism specifically: a value
    // getter is reached only through the dev-build deepFreeze, so it fires
    // twice in dev (staging, then commit) and never in production. This is not
    // a claim that the production write path runs no user code — it does, via
    // atom accessors, which the divergence table covers separately.
    const TRAVERSALS = IS_PROD ? 0 : 2

    // Both of this specialization's global gates are process-wide counters, and
    // other test files in this process leave listeners registered: a non-zero
    // change count makes the transaction allocate a sink (which skips the fast
    // path), and a non-zero commit-end count makes admission bail. Left alone,
    // every test here would compare the established path against itself and
    // pass while measuring nothing — the file passes in isolation and goes
    // vacuous in the full suite, which is the worst of both. Zeroed for the
    // duration and restored after; test files run sequentially, so no other
    // file's listeners are missed. The `onInit` divergence test below is the
    // canary: it is the one assertion that fails outright if the fast path was
    // not actually taken.
    let savedCommitEnd = 0
    let savedChange = 0
    beforeAll(() => {
        savedCommitEnd = commitEndRegistry.count
        savedChange = changeListenerRegistry.count
        commitEndRegistry.count = 0
        changeListenerRegistry.count = 0
    })
    afterAll(() => {
        commitEndRegistry.count = savedCommitEnd
        changeListenerRegistry.count = savedChange
    })

    // A root store, no listener, no committed value for any atom in the batch:
    // the full admission shape, so `AT` takes the specialization and `BELOW`
    // does not. `valueFor` receives the atoms so a value can close over a
    // LATER member of its own batch.
    const seed = (
        count: number,
        valueFor: (index: number, atoms: Atom<any>[]) => unknown,
        declaredDefault: unknown = 0,
    ) => {
        const atoms = Array.from({ length: count }, () =>
            atom<any>(declaredDefault),
        )
        const store1 = store()
        let thrown: string | undefined
        try {
            store1.txn(txn =>
                atoms.forEach((a, i) => txn.set(a, valueFor(i, atoms))),
            )
        } catch (error) {
            thrown = (error as Error).message
        }
        return { atoms, store: store1, thrown }
    }

    test("never invokes the incoming value's valueOf or toString", () => {
        // The comparator's first operand is the declared default, so for every
        // admitted shape — a primitive or `null` — it answers from `===` and
        // never reaches the object path that consults those hooks. It is the
        // operand's shape doing that, not a missing branch: widening admission
        // to object defaults would reach it, and so does swapping `defaultValue`
        // for an object mid-loop (which both paths then handle alike, because
        // the loop re-reads it). Pinned rather than left to a reading of
        // `equal`, since reaching it turns a bulk seed into an arbitrary
        // user-code call site.
        let hookCalls = 0
        const hostile = () => ({
            valueOf() {
                hookCalls++
                throw new Error("valueOf must not run during a seed")
            },
            toString() {
                hookCalls++
                throw new Error("toString must not run during a seed")
            },
        })

        for (const count of [BELOW, AT]) {
            for (const declaredDefault of [0, null]) {
                hookCalls = 0
                const written: unknown[] = []
                const { atoms, store: store1, thrown } = seed(
                    count,
                    () => {
                        const value = hostile()
                        written.push(value)
                        return value
                    },
                    declaredDefault,
                )
                expect(thrown).toBeUndefined()
                expect(hookCalls).toBe(0)
                // Identity, not shape: proves the seed wrote the value through
                // rather than leaving the declared default standing.
                expect(store1.get(atoms[0]!)).toBe(written[0])
                expect(store1.get(atoms[count - 1]!)).toBe(written[count - 1])
            }
        }

        // Falsifiability: those hooks ARE live in `equal` — it is the primitive
        // first operand, not a missing branch, that keeps them unreached.
        expect(() => equal(hostile(), hostile())).toThrow(
            "valueOf must not run during a seed",
        )
    })

    test("runs a comparator swapped in mid-commit, leaving the default", () => {
        // The loop's own writes run user code in a dev build: setValueInData
        // deep-freezes the staged value and deepFreeze reads every own
        // property, so a getter in the FIRST atom's value can reassign the LAST
        // atom's comparator — after admission checked it. Dropping the
        // comparator call would silently not run it here while the established
        // path still does.
        const run = (count: number) => {
            let comparatorRan = false
            let traversals = 0
            const { atoms, store: store1, thrown } = seed(count, (index, all) =>
                index === 0
                    ? {
                          get probe() {
                              if (++traversals >= 2)
                                  (all[count - 1] as any).equal = () => {
                                      comparatorRan = true
                                      throw new Error("hijacked comparator")
                                  }
                              return 1
                          },
                      }
                    : index + 1,
            )
            return {
                comparatorRan,
                traversals,
                thrown,
                // A verdict, not the value: the seeded values are derived from
                // the index, so reporting the raw one would differ between the
                // two batch sizes by construction and never compare equal. The
                // comparator throws after the default has landed, so the atom
                // keeps it instead of the value being written.
                lastHoldsDeclaredDefault: store1.get(atoms[count - 1]!) === 0,
            }
        }

        const established = run(BELOW)
        expect(run(AT)).toEqual(established)
        expect(established.traversals).toBe(TRAVERSALS)
        // Non-vacuity, and the boundary of the claim.
        expect(established.comparatorRan).toBe(!IS_PROD)
        expect(established.lastHoldsDeclaredDefault).toBe(!IS_PROD)
        if (!IS_PROD) {
            expect(established.thrown).toBe("hijacked comparator")
        }
    })

    test("leaves the declared default committed when the write throws", () => {
        // What the landing before the comparator buys. A getter returning a
        // freezable object at staging and an unfreezable Map at commit makes
        // setValueInData throw from inside the loop; the atom must still be
        // committed, holding its default, exactly as initAtom plus a failed set
        // leaves it. Only `values.has` sees this — a later read would
        // re-initialize an absent atom to the same default.
        const run = (count: number) => {
            let traversals = 0
            const { atoms, store: store1, thrown } = seed(count, index =>
                index === 0
                    ? {
                          get nested() {
                              return ++traversals >= 2
                                  ? new Map()
                                  : { freezable: 1 }
                          },
                      }
                    : index + 1,
            )
            const values = getStoreData(store1).values
            return {
                traversals,
                thrown,
                committed: values.has(atoms[0]!),
                // Reported as a verdict, not as the value: in a production
                // build the stored value IS the getter-bearing object, and
                // deep-comparing that across the two runs would drive the
                // getter and make the comparison nondeterministic.
                holdsDeclaredDefault: values.get(atoms[0]!) === 0,
            }
        }

        const established = run(BELOW)
        expect(run(AT)).toEqual(established)
        expect(established.traversals).toBe(TRAVERSALS)
        expect(established.committed).toBe(true)
        if (!IS_PROD) {
            expect(established.thrown).toContain(
                "deepFreeze cannot make Map values immutable",
            )
            expect(established.holdsDeclaredDefault).toBe(true)
        }
    })

    /**
     * KNOWN divergences from the established path, table-driven.
     *
     * A prose list of these kept being wrong: three separate reviews found
     * cases a hand-written one had missed, and each time the missing case was
     * the same shape as the ones already there. So the verdict is asserted per
     * mutation instead of described. Every admission-checked atom field gets at
     * least one payload, plus one store-state mutation to show the class is not
     * limited to fields.
     *
     * All of them have one root: the specialization replaces `initAtom` and the
     * settlement list with a bare `values.set` and an unconditional write, so
     * every duty around those — evaluating a default (factory or selector),
     * freezing it, validating it, invoking `onInit`, notifying a subscriber
     * added mid-commit — is skipped.
     *
     * `diverges` is the CURRENT verdict, not the desired one. A new divergence
     * fails here, and so does one that gets closed: admitting only primitive
     * VALUES would close all of them at once (the loop would then run no user
     * code, so nothing could be mutated mid-commit), at the cost of pushing
     * object-valued bulk seeds back onto the established path. Reaching any of
     * these needs a value getter to mutate a later atom in the same batch,
     * which no ordinary code does.
     */
    describe("known divergences", () => {
        type Probe = Record<string, number | undefined>
        /**
         * `value-getter` — reached through the dev-build deepFreeze of a staged
         *   object value, so unreachable in production.
         * `atom-accessor` — an accessor on a field the write path reads before
         *   (or without) consulting IS_PROD: `atom.mutable`
         *   (normalizeStagedValue, setValueInData) and `atom.maxAge`
         *   (setValueInData). Reachable in EVERY build, with primitive values,
         *   and `mutable` is not checked by admission at all.
         */
        type Mechanism = "value-getter" | "atom-accessor"
        type Case = {
            label: string
            diverges: boolean
            mechanism?: Mechanism
            /** atom-accessor only: the field to install the accessor on. */
            accessorField?: "mutable" | "maxAge"
            mutate: (victim: any, probe: Probe, store1: any) => void
        }

        const CASES: Case[] = [
            {
                label: "defaultValue := factory function",
                diverges: true,
                mutate: (v, p) => {
                    v.defaultValue = () => {
                        p.factoryCalls = (p.factoryCalls ?? 0) + 1
                        return 42
                    }
                },
            },
            {
                label: "defaultValue := unfreezable Map",
                diverges: true,
                mutate: v => {
                    v.defaultValue = new Map([["k", 1]])
                },
            },
            {
                label: "defaultValue := selector",
                diverges: true,
                mutate: (v, p) => {
                    v.defaultValue = selector(() => {
                        p.selectorReads = (p.selectorReads ?? 0) + 1
                        return 7
                    })
                },
            },
            {
                label: "onInit := recorder",
                diverges: true,
                mutate: (v, p) => {
                    v.onInit = () => {
                        p.onInitCalls = (p.onInitCalls ?? 0) + 1
                    }
                },
            },
            {
                label: "schema := recorder",
                diverges: true,
                mutate: (v, p) => {
                    v.schema = {
                        "~standard": {
                            version: 1,
                            vendor: "valdres-test",
                            validate: (value: unknown) => {
                                p.validations = (p.validations ?? 0) + 1
                                return { value }
                            },
                        },
                    }
                },
            },
            {
                label: "subscribe(victim) mid-commit (store state, not a field)",
                diverges: true,
                mutate: (v, p, store1) => {
                    store1.sub(v, () => {
                        p.notifications = (p.notifications ?? 0) + 1
                    })
                },
            },
            // Agreeing cases are asserted too: each is a reason the two
            // retained steps, or a deliberate design choice, keeps them in step.
            {
                label: "equal := throwing comparator",
                diverges: false,
                mutate: (v, p) => {
                    v.equal = () => {
                        p.comparatorCalls = (p.comparatorCalls ?? 0) + 1
                        throw new Error("hijacked comparator")
                    }
                },
            },
            {
                label: "defaultValue := object with throwing valueOf",
                diverges: false,
                mutate: (v, p) => {
                    v.defaultValue = {
                        valueOf() {
                            p.coercions = (p.coercions ?? 0) + 1
                            throw new Error("coercion reached")
                        },
                    }
                },
            },
            {
                label: "defaultValue := undefined",
                diverges: false,
                mutate: v => {
                    v.defaultValue = undefined
                },
            },
            {
                label: "onSet := recorder (this arm writes with 'skip')",
                diverges: false,
                mutate: (v, p) => {
                    v.onSet = () => {
                        p.onSetCalls = (p.onSetCalls ?? 0) + 1
                    }
                },
            },
            {
                label: "name := string (registry is the source of truth)",
                diverges: false,
                mutate: v => {
                    v.name = "hijacked-name"
                },
            },
            {
                label: "maxAge := 1000",
                diverges: false,
                mutate: v => {
                    v.maxAge = 1000
                },
            },
            {
                label: "mutable := true",
                diverges: false,
                mutate: v => {
                    v.mutable = true
                },
            },
            {
                label: "family := {}",
                diverges: false,
                mutate: v => {
                    v.family = {}
                },
            },
            // Reachability is NOT bounded by dev freezing. These two need no
            // object value and no freeze: the accessor is on the atom itself,
            // on a field the write path reads before consulting IS_PROD.
            {
                label: "accessor on atom.mutable (production-reachable)",
                diverges: true,
                mechanism: "atom-accessor",
                accessorField: "mutable",
                mutate: (v, p) => {
                    v.onInit = () => {
                        p.onInitCalls = (p.onInitCalls ?? 0) + 1
                    }
                },
            },
            {
                label: "accessor on atom.maxAge (production-reachable)",
                diverges: true,
                mechanism: "atom-accessor",
                accessorField: "maxAge",
                mutate: (v, p) => {
                    v.onInit = () => {
                        p.onInitCalls = (p.onInitCalls ?? 0) + 1
                    }
                },
            },
        ]

        // Every atom is seeded with the SAME value, so nothing in the observed
        // state can depend on the batch size — a count-derived value makes the
        // two runs differ by construction and every case read as divergent.
        const SEEDED = 7

        const observe = (count: number, testCase: Case) => {
            const atoms = Array.from({ length: count }, () => atom<any>(0))
            const store1 = store({ schemaValidation: true })
            const probe: Probe = {}
            let hookRuns = 0
            const fire = () => {
                if (++hookRuns >= 2)
                    testCase.mutate(atoms[count - 1], probe, store1)
            }

            // An atom-accessor case needs no object value at all: the accessor
            // sits on atom 0 itself, on a field the write path reads.
            if (testCase.mechanism === "atom-accessor") {
                Object.defineProperty(atoms[0]!, testCase.accessorField!, {
                    configurable: true,
                    get() {
                        fire()
                        return undefined
                    },
                })
            }

            let thrown: string | undefined
            try {
                store1.txn(txn =>
                    atoms.forEach((a, i) =>
                        txn.set(
                            a,
                            i === 0 && testCase.mechanism !== "atom-accessor"
                                ? {
                                      get carrier() {
                                          fire()
                                          return 1
                                      },
                                  }
                                : SEEDED,
                        ),
                    ),
                )
            } catch (error) {
                thrown = (error as Error).message
            }
            let readBack: string
            try {
                readBack = String(store1.get(atoms[count - 1]!))
            } catch {
                readBack = "<read threw>"
            }
            // The semantic outcome is what the two paths are compared on.
            // `hookRuns` is reported separately: the established path reads an
            // atom field more often than this loop does (it also writes through
            // initAtom), so comparing it would report a divergence for the
            // wrong reason.
            return { outcome: { probe, thrown, readBack }, hookRuns }
        }

        for (const testCase of CASES) {
            const mechanism = testCase.mechanism ?? "value-getter"
            // A value getter rides the dev-only freeze; an atom accessor does
            // not, so only the former goes quiet in production.
            const reachable = mechanism === "atom-accessor" || !IS_PROD

            test(`${testCase.label} — ${testCase.diverges ? "diverges" : "agrees"}`, () => {
                const established = observe(BELOW, testCase)
                const fastPath = observe(AT, testCase)
                const agree =
                    JSON.stringify(established.outcome) ===
                    JSON.stringify(fastPath.outcome)

                expect(agree).toBe(reachable ? !testCase.diverges : true)

                // Non-vacuity: the mechanism actually fired (and, for a value
                // getter, fired the expected twice — once at staging, once in
                // the loop, which is what puts the mutation after admission).
                if (mechanism === "value-getter") {
                    expect(established.hookRuns).toBe(TRAVERSALS)
                    expect(fastPath.hookRuns).toBe(TRAVERSALS)
                } else {
                    expect(established.hookRuns).toBeGreaterThanOrEqual(2)
                    expect(fastPath.hookRuns).toBeGreaterThanOrEqual(2)
                }
            })
        }
    })

})
