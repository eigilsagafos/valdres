import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import type { CommitPlan } from "../types/CommitPlan"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import {
    assertPlanLegal,
    forestEntry,
    globalEffects,
    forestSettlement,
    globalWriteQueue,
    NO_ON_SETS,
    NO_SETTLEMENT,
    singleStoreForest,
    updateSettlement,
    workGroup,
} from "./commitPlans"
import { getStoreData } from "./getStoreData"
import { settleCommit, settleCommitForest } from "./propagateUpdatedAtoms"

const data = () => getStoreData(store())

// Every case below is unreachable through the plan types — each one needs a
// cast to build. That is the point: `assertPlanLegal` is the dev-time backstop
// for a plan assembled by a cast or mutated mid-flight, and these pin that the
// backstop actually covers each invariant the types encode.
const illegal = (plan: unknown) =>
    expect(() => assertPlanLegal(plan as CommitPlan)).toThrow(
        /illegal CommitPlan/,
    )

describe("commitPlans", () => {
    describe("constructors", () => {
        test("a single-store forest is one entry with no cleanup groups", () => {
            const store1 = data()
            const a = atom(0)
            const entries = singleStoreForest(store1, [a])

            expect(entries).toHaveLength(1)
            expect(entries[0]).toEqual({
                data: store1,
                updatedAtoms: [a],
                deleted: undefined,
                unsetAtoms: undefined,
                children: undefined,
            })
        })

        test("a global write shares one descriptor between sets and onSets", () => {
            const store1 = data()
            const shared = atom(0, { global: true })
            const queue = globalWriteQueue(shared as any, 3, store1)

            expect(queue).toEqual([[shared, 3, store1] as any])
            // One queue, one triple — the ordered global sets and the deferred
            // onSet queue describe the same write.
            const settlement = forestSettlement(
                store1,
                singleStoreForest(store1, [shared]),
                globalEffects(store1, queue, "set", () => new Map()),
                settleCommitForest,
            )
            expect(settlement.global.sets).toBe(queue)
        })

        test("workGroup collapses an empty group to undefined", () => {
            const a = atom(0)
            expect(workGroup([])).toBeUndefined()
            expect(workGroup([a])).toEqual([a])
        })

        test("the shared no-op settlement and hook queue are frozen", () => {
            expect(Object.isFrozen(NO_SETTLEMENT)).toBe(true)
            expect(Object.isFrozen(NO_ON_SETS)).toBe(true)
        })
    })

    describe("assertPlanLegal", () => {
        const legal = (): CommitPlan => {
            const store1 = data()
            return {
                data: store1,
                settlement: updateSettlement(
                    store1,
                    [atom(0)],
                    settleCommit,
                    SETTLE_DEFAULT,
                ),
                onSets: NO_ON_SETS,
                errors: createCommitErrors(),
                report: undefined,
            }
        }

        test("accepts every shape the constructors produce", () => {
            const store1 = data()
            const a = atom(0)
            const member = atomFamily<number, [string]>(0)("x")

            expect(() => assertPlanLegal(legal())).not.toThrow()
            expect(() =>
                assertPlanLegal({
                    data: store1,
                    settlement: forestSettlement(
                        store1,
                        [
                            forestEntry(
                                store1,
                                [a],
                                workGroup([member]),
                                workGroup([a]),
                                undefined,
                            ),
                        ],
                        undefined,
                        settleCommitForest,
                    ),
                    onSets: NO_ON_SETS,
                    errors: createCommitErrors(),
                    report: "set",
                }),
            ).not.toThrow()
            expect(() =>
                assertPlanLegal({
                    data: store1,
                    settlement: NO_SETTLEMENT,
                    onSets: NO_ON_SETS,
                    errors: createCommitErrors(),
                    report: undefined,
                }),
            ).not.toThrow()
        })

        test("rejects report preparation with no delivery target", () => {
            illegal({ ...legal(), report: undefined, beforeSettle: () => {} })
        })

        test("rejects a boundary that is not a begin/end pair", () => {
            illegal({ ...legal(), boundary: { begin: (d: any) => d.tree } })
            illegal({ ...legal(), boundary: { end: () => {} } })
        })

        test("rejects a missing hook queue or error accumulator", () => {
            illegal({ ...legal(), onSets: undefined })
            illegal({ ...legal(), errors: undefined })
        })

        test("rejects global fan-out outside a forest settlement", () => {
            const plan = legal()
            illegal({
                ...plan,
                settlement: {
                    ...plan.settlement,
                    global: globalEffects(
                        undefined,
                        [],
                        "set",
                        () => new Map(),
                    ),
                },
            })
        })

        test("rejects peer updates with no global effects to produce them", () => {
            const store1 = data()
            const settlement = forestSettlement(
                store1,
                [],
                undefined,
                settleCommitForest,
            )
            illegal({
                ...legal(),
                settlement: { ...settlement, globalUpdates: new Map() },
            })
        })

        test("rejects peer updates already populated before the commit ran", () => {
            const store1 = data()
            const settlement = forestSettlement(
                store1,
                [],
                globalEffects(store1, [], "set", () => new Map()),
                settleCommitForest,
            )
            settlement.globalUpdates = new Map()
            illegal({ ...legal(), settlement })
        })

        test("rejects global effects without an ordered descriptor queue", () => {
            const store1 = data()
            const settlement = forestSettlement(
                store1,
                [],
                globalEffects(store1, [], "set", () => new Map()),
                settleCommitForest,
            )
            settlement.global.sets = undefined as any
            illegal({ ...legal(), settlement })
        })

        test("rejects an empty deleted or unset group anywhere in the forest", () => {
            const store1 = data()
            const forest = (entry: unknown) =>
                illegal({
                    ...legal(),
                    settlement: forestSettlement(
                        store1,
                        [entry as any],
                        undefined,
                        settleCommitForest,
                    ),
                })

            // The asymmetry this replaces: an empty `deleted` used to count as
            // settlement work while an empty `unsetAtoms` did not. Neither is
            // representable now, and both are rejected the same way.
            forest({
                data: store1,
                updatedAtoms: [],
                deleted: [],
                unsetAtoms: undefined,
                children: undefined,
            })
            forest({
                data: store1,
                updatedAtoms: [],
                deleted: undefined,
                unsetAtoms: [],
                children: undefined,
            })
            forest({
                data: store1,
                updatedAtoms: [],
                deleted: undefined,
                unsetAtoms: undefined,
                initAtoms: [],
                children: undefined,
            })
            forest({
                data: store1,
                updatedAtoms: [],
                deleted: undefined,
                unsetAtoms: undefined,
                children: [
                    {
                        data: store1,
                        updatedAtoms: [],
                        deleted: [],
                        unsetAtoms: undefined,
                        children: undefined,
                    },
                ],
            })
        })

        test("rejects an update or delete settlement with no atom list", () => {
            const plan = legal()
            illegal({
                ...plan,
                settlement: { ...plan.settlement, atoms: undefined },
            })
            illegal({
                ...plan,
                settlement: { kind: "delete", atoms: undefined, settle: noop },
            })
        })
    })
})

const noop = () => {}
