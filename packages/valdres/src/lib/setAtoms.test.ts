import { getStoreData } from "./getStoreData"
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    mock,
    test,
} from "bun:test"
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
    // Dev-only: both steps are inert in a production build, where the write
    // path freezes nothing and so runs no user code at all.
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
     * The landing is a bare `values.set`, not `initAtom`, so `initAtom`'s other
     * duties are not reproduced. Under the same mid-commit mutation the
     * comparator call covers, that is observable: these two fields diverge from
     * the established path.
     *
     * Pinned as KNOWN divergences, not as desired behaviour. Both need a value
     * getter to assign an admission-checked field to a later atom in the same
     * batch, which no ordinary code does (`onInit` is not even user-facing —
     * `globalAtom` sets it at construction). If a change closes the window —
     * admitting only primitive values would, since the loop would then call
     * nothing — these tests go red and should be deleted, not repaired.
     */
    describe("known divergences: initAtom duties the landing skips", () => {
        // Assigns `field` to the LAST atom from the FIRST atom's freeze
        // traversal, i.e. after admission and inside the write loop.
        const hijackField = (count: number, field: string, make: () => unknown) => {
            const atoms = Array.from({ length: count }, () => atom<any>(0))
            const store1 = store({ schemaValidation: true })
            let traversals = 0
            try {
                store1.txn(txn =>
                    atoms.forEach((a, i) =>
                        txn.set(
                            a,
                            i === 0
                                ? {
                                      get probe() {
                                          if (++traversals >= 2)
                                              (atoms[count - 1] as any)[field] =
                                                  make()
                                          return 1
                                      },
                                  }
                                : i + 1,
                        ),
                    ),
                )
            } catch {
                // Neither field throws; a future one might.
            }
            return traversals
        }


        test("an onInit assigned mid-loop runs on the established path only", () => {
            let ran = 0
            const traversalsBelow = hijackField(BELOW, "onInit", () => () => {
                ran++
            })
            const onEstablished = ran
            ran = 0
            const traversalsAt = hijackField(AT, "onInit", () => () => {
                ran++
            })
            const onFastPath = ran

            expect(traversalsBelow).toBe(TRAVERSALS)
            expect(traversalsAt).toBe(TRAVERSALS)
            // In production nothing freezes, so neither path ever sees the
            // assignment and both agree at zero.
            expect(onEstablished).toBe(IS_PROD ? 0 : 1)
            expect(onFastPath).toBe(0)
        })

        test("a schema assigned mid-loop validates on the established path only", () => {
            let validations = 0
            const schema = () => ({
                "~standard": {
                    version: 1,
                    vendor: "valdres-test",
                    validate: (value: unknown) => {
                        validations++
                        return { value }
                    },
                },
            })

            hijackField(BELOW, "schema", schema)
            const onEstablished = validations
            validations = 0
            hijackField(AT, "schema", schema)
            const onFastPath = validations

            expect(onEstablished).toBe(IS_PROD ? 0 : 1)
            expect(onFastPath).toBe(0)
        })
    })

})
