import { getStoreData } from "./getStoreData"
import { describe, test, expect, mock } from "bun:test"
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
    // Dev-only: both steps are inert in a production build, where the write
    // path freezes nothing and so runs no user code at all.
    const TRAVERSALS = IS_PROD ? 0 : 2

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
        // never reaches the object path that consults those hooks. Widening
        // admission to object defaults would reach it, turning a bulk seed into
        // an arbitrary user-code call site, so this is pinned rather than left
        // to a reading of `equal`.
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
})
