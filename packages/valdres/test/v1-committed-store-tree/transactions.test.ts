import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    createCommittedStoreTreeDomain,
    type RootTransaction,
    type Selector,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    InvalidSynchronousSelectorResultError,
    SelectorCircularDependencyError,
    SelectorReadRevokedError,
} from "../../src/v1-internal/selector-evaluator/errors"
import type { AnyAtom } from "../../src/v1-internal/committed-store-tree/runtime-domain"
import type { StoreScopeNode } from "../../src/v1-internal/committed-store-tree/scope-node"
import {
    TreeDraft,
    type AtomDraftBaseline,
    type AtomIntent,
} from "../../src/v1-internal/committed-store-tree/tree-transaction"
import { createReferenceModel, value } from "../v1-model"
import type { TransactionStep, ValueToken } from "../v1-model/protocol"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 root-only TreeTransaction", () => {
    test("keeps two same-scope draft coordinates inline and preserves order through promotion and release", () => {
        const scopeA = Object.freeze({ id: "A" }) as unknown as StoreScopeNode
        const scopeB = Object.freeze({ id: "B" }) as unknown as StoreScopeNode
        const atomX = Object.freeze({ id: "x" }) as unknown as AnyAtom
        const atomY = Object.freeze({ id: "y" }) as unknown as AnyAtom
        const atomZ = Object.freeze({ id: "z" }) as unknown as AnyAtom
        const valueOutcome = Object.freeze({
            kind: "value" as const,
            value: undefined,
        })
        const error = Object.freeze({ fault: "fallback" })
        const errorOutcome = Object.freeze({
            kind: "error" as const,
            error,
        })
        const baseline: AtomDraftBaseline = Object.freeze({
            owned: false,
            outcome: valueOutcome,
            reachesFallback: true,
        })
        const replacementBaseline: AtomDraftBaseline = Object.freeze({
            owned: true,
            outcome: errorOutcome,
            reachesFallback: false,
        })
        const setIntent = (atom: AnyAtom, value: unknown): AtomIntent =>
            Object.freeze({
                kind: "set" as const,
                atom,
                value,
                publishDraftFallback: false,
            })
        let storageAllocations = 0
        const draft = new TreeDraft(() => storageAllocations++)

        draft.setAtomBaseline(scopeA, atomX, baseline)
        draft.stage(scopeA, setIntent(atomX, "first"))
        draft.setAtomBaseline(scopeA, atomX, replacementBaseline)
        draft.stage(scopeA, setIntent(atomX, "replacement"))
        expect(storageAllocations).toBe(0)
        expect(draft.singleIntentScope).toBe(scopeA)
        const scalarIntent = draft.singleIntent
        expect(scalarIntent?.kind).toBe("set")
        expect(scalarIntent?.kind === "set" && scalarIntent.value).toBe(
            "replacement",
        )
        expect(draft.getAtomBaseline(scopeA, atomX)).toBe(baseline)

        draft.setAtomBaseline(scopeB, atomY, baseline)
        draft.stage(scopeB, setIntent(atomY, "second-scope"))
        draft.setAtomBaseline(scopeA, atomZ, baseline)
        draft.stage(scopeA, setIntent(atomZ, "later-first-scope"))
        draft.setAtomBaseline(scopeA, atomX, replacementBaseline)
        draft.stage(scopeA, setIntent(atomX, "final"))

        const order: readonly [StoreScopeNode, AnyAtom, unknown][] = []
        draft.forEachIntent((scope, intent) => {
            ;(order as [StoreScopeNode, AnyAtom, unknown][]).push([
                scope,
                intent.atom,
                intent.kind === "set" ? intent.value : undefined,
            ])
        })
        expect(order).toEqual([
            [scopeA, atomX, "final"],
            [scopeA, atomZ, "later-first-scope"],
            [scopeB, atomY, "second-scope"],
        ])
        expect(draft.getAtomBaseline(scopeA, atomX)).toBe(baseline)
        expect(storageAllocations).toBe(6)

        draft.setFallback(atomX, valueOutcome)
        expect(draft.getFallback(atomX)).toBe(valueOutcome)
        expect(storageAllocations).toBe(6)
        draft.setFallback(atomY, errorOutcome)
        expect(draft.getFallback(atomX)).toBe(valueOutcome)
        expect(draft.getFallback(atomY)).toBe(errorOutcome)
        expect(storageAllocations).toBe(7)

        draft.release()
        expect(draft.hasIntents).toBe(false)
        expect(draft.getIntent(scopeA, atomX)).toBeUndefined()
        expect(draft.getAtomBaseline(scopeA, atomX)).toBeUndefined()
        expect(draft.getFallback(atomX)).toBeUndefined()
        expect(draft.getFallback(atomY)).toBeUndefined()

        let sameScopeAllocations = 0
        const sameScopeDraft = new TreeDraft(() => sameScopeAllocations++)
        sameScopeDraft.setAtomBaseline(scopeA, atomX, baseline)
        sameScopeDraft.stage(scopeA, setIntent(atomX, "first"))
        sameScopeDraft.setAtomBaseline(scopeA, atomZ, replacementBaseline)
        sameScopeDraft.stage(scopeA, setIntent(atomZ, "second"))
        sameScopeDraft.setAtomBaseline(scopeA, atomZ, baseline)
        expect(sameScopeAllocations).toBe(0)
        expect(sameScopeDraft.singleIntent).toBeUndefined()
        expect(sameScopeDraft.getAtomBaseline(scopeA, atomX)).toBe(baseline)
        expect(sameScopeDraft.getAtomBaseline(scopeA, atomZ)).toBe(
            replacementBaseline,
        )
        const inlineOrder: [StoreScopeNode, AnyAtom, unknown][] = []
        sameScopeDraft.forEachIntent((scope, intent) => {
            inlineOrder.push([
                scope,
                intent.atom,
                intent.kind === "set" ? intent.value : undefined,
            ])
        })
        expect(inlineOrder).toEqual([
            [scopeA, atomX, "first"],
            [scopeA, atomZ, "second"],
        ])
        sameScopeDraft.setAtomBaseline(scopeB, atomY, baseline)
        sameScopeDraft.stage(scopeB, setIntent(atomY, "third"))
        sameScopeDraft.setAtomBaseline(scopeA, atomX, replacementBaseline)
        sameScopeDraft.stage(scopeA, setIntent(atomX, "replacement"))
        const promotedOrder: [StoreScopeNode, AnyAtom, unknown][] = []
        sameScopeDraft.forEachIntent((scope, intent) => {
            promotedOrder.push([
                scope,
                intent.atom,
                intent.kind === "set" ? intent.value : undefined,
            ])
        })
        expect(promotedOrder).toEqual([
            [scopeA, atomX, "replacement"],
            [scopeA, atomZ, "second"],
            [scopeB, atomY, "third"],
        ])
        expect(sameScopeAllocations).toBe(6)
        expect(sameScopeDraft.getAtomBaseline(scopeA, atomX)).toBe(baseline)
        sameScopeDraft.release()
        expect(sameScopeDraft.hasIntents).toBe(false)
        expect(sameScopeDraft.getIntent(scopeA, atomX)).toBeUndefined()
        expect(sameScopeDraft.getIntent(scopeA, atomZ)).toBeUndefined()
        expect(sameScopeDraft.getIntent(scopeB, atomY)).toBeUndefined()
        expect(sameScopeDraft.getAtomBaseline(scopeA, atomX)).toBeUndefined()
        expect(sameScopeDraft.getAtomBaseline(scopeA, atomZ)).toBeUndefined()
        expect(sameScopeDraft.getAtomBaseline(scopeB, atomY)).toBeUndefined()

        let thirdSameScopeAllocations = 0
        const thirdSameScopeDraft = new TreeDraft(
            () => thirdSameScopeAllocations++,
        )
        thirdSameScopeDraft.setAtomBaseline(scopeA, atomX, baseline)
        thirdSameScopeDraft.stage(scopeA, setIntent(atomX, "first"))
        thirdSameScopeDraft.setAtomBaseline(scopeA, atomZ, replacementBaseline)
        thirdSameScopeDraft.stage(scopeA, setIntent(atomZ, "second"))
        expect(thirdSameScopeAllocations).toBe(0)
        thirdSameScopeDraft.setAtomBaseline(scopeA, atomY, baseline)
        thirdSameScopeDraft.stage(scopeA, setIntent(atomY, "third"))
        thirdSameScopeDraft.setAtomBaseline(scopeA, atomZ, baseline)
        thirdSameScopeDraft.stage(
            scopeA,
            setIntent(atomZ, "second-replacement"),
        )
        const thirdSameScopeOrder: [StoreScopeNode, AnyAtom, unknown][] = []
        thirdSameScopeDraft.forEachIntent((scope, intent) => {
            thirdSameScopeOrder.push([
                scope,
                intent.atom,
                intent.kind === "set" ? intent.value : undefined,
            ])
        })
        expect(thirdSameScopeOrder).toEqual([
            [scopeA, atomX, "first"],
            [scopeA, atomZ, "second-replacement"],
            [scopeA, atomY, "third"],
        ])
        expect(thirdSameScopeAllocations).toBe(2)
        expect(thirdSameScopeDraft.getAtomBaseline(scopeA, atomZ)).toBe(
            replacementBaseline,
        )
        thirdSameScopeDraft.release()
        expect(thirdSameScopeDraft.hasIntents).toBe(false)
        expect(thirdSameScopeDraft.getIntent(scopeA, atomZ)).toBeUndefined()
        expect(
            thirdSameScopeDraft.getAtomBaseline(scopeA, atomZ),
        ).toBeUndefined()

        const scalarDraft = new TreeDraft()
        scalarDraft.setAtomBaseline(scopeA, atomX, baseline)
        scalarDraft.stage(scopeA, setIntent(atomX, "scalar"))
        scalarDraft.setFallback(atomX, valueOutcome)
        scalarDraft.release()
        expect(scalarDraft.hasIntents).toBe(false)
        expect(scalarDraft.getIntent(scopeA, atomX)).toBeUndefined()
        expect(scalarDraft.getAtomBaseline(scopeA, atomX)).toBeUndefined()
        expect(scalarDraft.getFallback(atomX)).toBeUndefined()
    })

    test("reads canonical prior intents and preserves exact Atom values", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const optional = domain.atom<number | undefined>(undefined)
        const fallbackHandler = (): string => "fallback"
        const replacementHandler = (): string => "replacement"
        const handler = domain.atom(fallbackHandler)
        const nan = domain.atom(Number.NaN)
        const tree = domain.createStoreTree()
        let updaterCalls = 0

        const result = tree.txn(transaction => {
            expect(transaction.get(count)).toBe(0)
            transaction.set(count, -0)
            expect(Object.is(transaction.get(count), -0)).toBe(true)
            transaction.update(count, current => {
                updaterCalls++
                expect(Object.is(current, -0)).toBe(true)
                return 4
            })
            expect(transaction.get(count)).toBe(4)
            transaction.set(optional, undefined)
            transaction.set(handler, replacementHandler)
            transaction.set(nan, Number.NaN)
            return Object.freeze({ result: "committed" })
        })

        expect(result).toEqual({ result: "committed" })
        expect(updaterCalls).toBe(1)
        expect(tree.get(count)).toBe(4)
        expect(tree.get(optional)).toBeUndefined()
        expect(tree.get(handler)).toBe(replacementHandler)
        expect(Number.isNaN(tree.get(nan))).toBe(true)

        tree.txn(transaction => {
            transaction.reset(count)
            transaction.reset(optional)
            transaction.reset(handler)
            expect(transaction.get(count)).toBe(0)
            expect(transaction.get(optional)).toBeUndefined()
            expect(transaction.get(handler)).toBe(fallbackHandler)
        })
        expect(tree.get(count)).toBe(0)
        expect(tree.get(handler)).toBe(fallbackHandler)

        if (false) {
            // @ts-expect-error Transaction Atom values are invariant.
            tree.txn(transaction => transaction.set(count, "wrong"))
            // @ts-expect-error Transaction callbacks are statically synchronous.
            tree.txn(async () => 1)
        }
    })

    test("uses one fixed entry baseline for Atom comparators and never compares reset", () => {
        const domain = createCommittedStoreTreeDomain()
        const calls: [number, number][] = []
        const count = domain.atom(0, {
            equal: (baseline, candidate) => {
                calls.push([baseline, candidate])
                return Math.abs(baseline - candidate) <= 1
            },
        })
        const tree = domain.createStoreTree()

        tree.txn(transaction => {
            transaction.set(count, 2)
            expect(transaction.get(count)).toBe(2)
            transaction.set(count, 1)
            expect(transaction.get(count)).toBe(0)
        })
        expect(tree.get(count)).toBe(0)
        expect(calls).toEqual([
            [0, 2],
            [0, 1],
        ])

        tree.set(count, 3)
        expect(tree.get(count)).toBe(3)
        const beforeReset = calls.length
        tree.txn(transaction => transaction.reset(count))
        expect(tree.get(count)).toBe(0)
        expect(calls).toHaveLength(beforeReset)
    })

    test("rejects invalid comparator outcomes atomically and contains thenables", () => {
        const domain = createCommittedStoreTreeDomain()
        let containCalls = 0
        const invalid = domain.atom<number>(0, {
            equal: (() => 1) as unknown as (
                previous: number,
                next: number,
            ) => boolean,
        })
        const thenable = domain.atom<number>(0, {
            equal: (() => ({
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    containCalls++
                    reject(new Error("contained"))
                },
            })) as unknown as (previous: number, next: number) => boolean,
        })
        const tree = domain.createStoreTree()

        expect(thrownBy(() => tree.set(invalid, 1))).toMatchObject({
            name: "InvalidAtomComparatorResultError",
            code: "VALDRES_INVALID_ATOM_COMPARATOR_RESULT",
        })
        expect(thrownBy(() => tree.set(thenable, 1))).toMatchObject({
            name: "InvalidAtomComparatorResultError",
            code: "VALDRES_INVALID_ATOM_COMPARATOR_RESULT",
        })
        expect(tree.get(invalid)).toBe(0)
        expect(tree.get(thenable)).toBe(0)
        expect(containCalls).toBe(1)
    })

    test("applies every Atom source before one selector propagation settlement", () => {
        const domain = createCommittedStoreTreeDomain()
        const left = domain.atom(0)
        const right = domain.atom(0)
        const observations: [number, number][] = []
        let evaluations = 0
        const total = domain.selector(get => {
            evaluations++
            const pair: [number, number] = [get(left), get(right)]
            observations.push(pair)
            return pair[0] + pair[1]
        })
        const tree = domain.createStoreTree()

        expect(tree.get(total)).toBe(0)
        tree.txn(transaction => {
            transaction.set(left, 1)
            transaction.set(right, 2)
        })

        expect(tree.get(total)).toBe(3)
        expect(tree.get(left)).toBe(1)
        expect(tree.get(right)).toBe(2)
        expect(evaluations).toBe(2)
        expect(observations).toEqual([
            [0, 0],
            [1, 2],
        ])
    })

    test("discards aborts and read-only fallback work while publishing relevant successful fallback work", () => {
        const domain = createCommittedStoreTreeDomain()
        const target = domain.atom(0)
        let readOnlyCalls = 0
        const readOnly = domain.atomLazy(() =>
            Object.freeze({ call: ++readOnlyCalls }),
        )
        let publishedCalls = 0
        const published = domain.atomLazy(() =>
            Object.freeze({ call: ++publishedCalls }),
        )
        const tree = domain.createStoreTree()

        const speculative = tree.txn(transaction => transaction.get(readOnly))
        expect(speculative.call).toBe(1)
        const committed = tree.get(readOnly)
        expect(committed.call).toBe(2)
        expect(committed).not.toBe(speculative)

        const cause = new Error("abort")
        expect(
            thrownBy(() =>
                tree.txn(transaction => {
                    transaction.set(target, 9)
                    transaction.get(published)
                    throw cause
                }),
            ),
        ).toBe(cause)
        expect(tree.get(target)).toBe(0)
        expect(tree.get(published).call).toBe(2)

        let fallback!: Readonly<{ call: number }>
        const override = Object.freeze({ call: 99 })
        tree.txn(transaction => {
            fallback = transaction.get(published)
            transaction.set(published, override)
        })
        expect(tree.get(published)).toBe(override)
        tree.txn(transaction => transaction.reset(published))
        expect(tree.get(published)).toBe(fallback)
        expect(publishedCalls).toBe(2)
    })

    test("contains returned thenables, aborts their prefix, and revokes retained cursors", async () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        let retained!: RootTransaction
        let thenGets = 0
        let containCalls = 0
        const containedStoreErrors: unknown[] = []
        const containedCursorErrors: unknown[] = []
        const attemptReentry = (): void => {
            try {
                tree.set(count, 8)
            } catch (error) {
                containedStoreErrors.push(error)
            }
            try {
                retained.set(count, 9)
            } catch (error) {
                containedCursorErrors.push(error)
            }
        }
        const thenable = {
            get then() {
                thenGets++
                attemptReentry()
                return (
                    _resolve: unknown,
                    reject: (error: unknown) => void,
                ): void => {
                    containCalls++
                    attemptReentry()
                    reject(new Error("contained"))
                }
            },
        }

        expect(
            thrownBy(() =>
                tree.txn((transaction): unknown => {
                    retained = transaction
                    transaction.set(count, 1)
                    return thenable
                }),
            ),
        ).toMatchObject({
            name: "InvalidTransactionCallbackResultError",
            code: "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT",
        })
        expect(tree.get(count)).toBe(0)
        expect(thenGets).toBe(1)
        expect(containCalls).toBe(1)
        expect(containedStoreErrors).toEqual([
            expect.objectContaining({ code: "VALDRES_TRANSACTION_PHASE" }),
            expect.objectContaining({ code: "VALDRES_TRANSACTION_PHASE" }),
        ])
        expect(containedCursorErrors).toEqual([
            expect.objectContaining({ code: "VALDRES_TRANSACTION_CLOSED" }),
            expect.objectContaining({ code: "VALDRES_TRANSACTION_CLOSED" }),
        ])
        expect(thrownBy(() => retained.get(count))).toMatchObject({
            name: "TransactionClosedError",
            code: "VALDRES_TRANSACTION_CLOSED",
        })

        let afterAwaitError: unknown
        let asynchronous!: Promise<void>
        expect(
            thrownBy(() =>
                tree.txn((transaction): unknown => {
                    asynchronous = (async () => {
                        await Promise.resolve()
                        try {
                            transaction.set(count, 7)
                        } catch (error) {
                            afterAwaitError = error
                        }
                    })()
                    return asynchronous
                }),
            ),
        ).toMatchObject({ code: "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT" })
        await asynchronous
        expect(afterAwaitError).toMatchObject({
            code: "VALDRES_TRANSACTION_CLOSED",
        })
        expect(tree.get(count)).toBe(0)
    })

    test("enforces owner-first and phase guards without losing caught earlier intents", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const other = local.atom(0)
        const foreignAtom = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const foreignTree = foreign.createStoreTree()
        const errors: unknown[] = []

        tree.txn(transaction => {
            transaction.set(count, 1)
            for (const operation of [
                () => tree.get(count),
                () => sibling.set(other, 2),
                () => tree.txn(() => undefined),
            ]) {
                try {
                    operation()
                } catch (error) {
                    errors.push(error)
                }
            }
            try {
                transaction.get(foreignAtom)
            } catch (error) {
                errors.push(error)
            }
            try {
                tree.get(foreignAtom)
            } catch (error) {
                errors.push(error)
            }
            foreignTree.set(foreignAtom, 3)
            transaction.set(other, 4)
        })

        expect(errors.slice(0, 3)).toEqual([
            expect.objectContaining({ code: "VALDRES_TRANSACTION_PHASE" }),
            expect.objectContaining({ code: "VALDRES_TRANSACTION_PHASE" }),
            expect.objectContaining({ code: "VALDRES_TRANSACTION_PHASE" }),
        ])
        expect(errors[3]).toBeInstanceOf(RuntimeMismatchError)
        expect(errors[4]).toBeInstanceOf(RuntimeMismatchError)
        expect(tree.get(count)).toBe(1)
        expect(tree.get(other)).toBe(4)
        expect(foreignTree.get(foreignAtom)).toBe(3)
    })

    test("quarantines updater and comparator callbacks with sticky owner faults", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const foreignAtom = foreign.atom(0)
        const count = local.atom(0)
        const guarded = local.atom(0, {
            equal: () => {
                try {
                    localTree.set(count, 8)
                } catch (error) {
                    callbackErrors.push(error)
                }
                return false
            },
        })
        const contaminated = local.atom(0, {
            equal: () => {
                try {
                    localTree.get(foreignAtom)
                } catch {}
                return false
            },
        })
        const localTree = local.createStoreTree()
        const callbackErrors: unknown[] = []

        localTree.txn(transaction => {
            transaction.update(count, current => {
                try {
                    transaction.set(count, 99)
                } catch (error) {
                    callbackErrors.push(error)
                }
                return current + 1
            })
            transaction.set(guarded, 2)
        })
        expect(callbackErrors).toEqual([
            expect.objectContaining({ code: "VALDRES_CALLBACK_CAPABILITY" }),
            expect.objectContaining({ code: "VALDRES_CALLBACK_CAPABILITY" }),
        ])
        expect(localTree.get(count)).toBe(1)
        expect(localTree.get(guarded)).toBe(2)

        expect(thrownBy(() => localTree.set(contaminated, 1))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(localTree.get(contaminated)).toBe(0)
    })

    test("matches the unchanged ReferenceModel across deterministic root-Atom traces", () => {
        const domain = createCommittedStoreTreeDomain()
        const actualAtoms = {
            count: domain.atom(0),
            offset: domain.atom(5),
        }
        const tree = domain.createStoreTree()
        const model = createReferenceModel()
        for (const [id, fallback] of [
            ["count", 0],
            ["offset", 5],
        ] as const) {
            expect(
                model.execute({
                    kind: "define-atom",
                    atom: {
                        id,
                        fallback: {
                            kind: "eager",
                            value: value.number(fallback),
                        },
                    },
                }).ok,
            ).toBe(true)
        }
        expect(
            model.execute({ kind: "create-tree", tree: "tree", root: "root" })
                .ok,
        ).toBe(true)

        let random = 0x51f15e
        const next = (): number => {
            random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0
            return random
        }

        for (let trace = 0; trace < 240; trace++) {
            const steps: TransactionStep[] = []
            const actual: ((transaction: RootTransaction) => void)[] = []
            const width = (next() % 4) + 1
            for (let index = 0; index < width; index++) {
                const atom = next() % 2 === 0 ? "count" : "offset"
                const operation = next() % 3
                if (operation === 0) {
                    const candidate =
                        ((next() % 17) - 8) * (next() % 9 === 0 ? -0 : 1)
                    steps.push({
                        kind: "mutate",
                        cursor: "entry",
                        mutation: {
                            kind: "set-atom",
                            atom,
                            value: value.number(candidate),
                        },
                    })
                    actual.push(transaction =>
                        transaction.set(actualAtoms[atom], candidate),
                    )
                } else if (operation === 1) {
                    const amount = (next() % 7) - 3
                    steps.push({
                        kind: "mutate",
                        cursor: "entry",
                        mutation: {
                            kind: "update-atom",
                            atom,
                            updater: { kind: "number-add", amount },
                        },
                    })
                    actual.push(transaction =>
                        transaction.update(
                            actualAtoms[atom],
                            current => current + amount,
                        ),
                    )
                } else {
                    steps.push({
                        kind: "mutate",
                        cursor: "entry",
                        mutation: { kind: "reset-atom", atom },
                    })
                    actual.push(transaction =>
                        transaction.reset(actualAtoms[atom]),
                    )
                }
            }

            tree.txn(transaction => {
                for (const operation of actual) operation(transaction)
            })
            expect(
                model.execute({
                    kind: "transact",
                    tree: "tree",
                    entryScope: "root",
                    steps,
                }),
            ).toMatchObject({ ok: true, committed: true })

            for (const atom of ["count", "offset"] as const) {
                const read = model.execute({
                    kind: "read",
                    tree: "tree",
                    scope: "root",
                    target: { kind: "atom", atom },
                    as: `${trace}-${atom}`,
                })
                expect(read.ok).toBe(true)
                const token = (
                    read.outcome as Readonly<{
                        kind: "value"
                        value: ValueToken
                    }>
                ).value
                expect(token.kind).toBe("number")
                expect(
                    Object.is(
                        tree.get(actualAtoms[atom]),
                        (token as Extract<ValueToken, { kind: "number" }>)
                            .value,
                    ),
                ).toBe(true)
            }
        }
    })

    test("memoizes scratch values and errors only within the current successful-intent generation", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const source = local.atom(1)
        const unrelated = local.atom(0)
        const foreignAtom = foreign.atom(0)
        let valueEvaluations = 0
        let errorEvaluations = 0
        const cause = new Error("scratch getter failed")
        const valueSelector = local.selector(get => {
            valueEvaluations++
            return Object.freeze({ value: get(source) })
        })
        const errorSelector = local.selector(() => {
            errorEvaluations++
            throw cause
        })
        const tree = local.createStoreTree()

        tree.txn(transaction => {
            const firstValue = transaction.get(valueSelector)
            expect(transaction.get(valueSelector)).toBe(firstValue)
            const firstError = thrownBy(() => transaction.get(errorSelector))
            expect(thrownBy(() => transaction.get(errorSelector))).toBe(
                firstError,
            )

            expect(thrownBy(() => transaction.get(foreignAtom))).toBeInstanceOf(
                RuntimeMismatchError,
            )
            expect(
                thrownBy(() =>
                    transaction.update(unrelated, () => {
                        throw new Error("failed updater")
                    }),
                ),
            ).toBeInstanceOf(Error)
            expect(transaction.get(valueSelector)).toBe(firstValue)
            expect(thrownBy(() => transaction.get(errorSelector))).toBe(
                firstError,
            )
            expect([valueEvaluations, errorEvaluations]).toEqual([1, 1])

            transaction.set(unrelated, 1)
            expect(transaction.get(valueSelector)).not.toBe(firstValue)
            expect(thrownBy(() => transaction.get(errorSelector))).not.toBe(
                firstError,
            )
            expect([valueEvaluations, errorEvaluations]).toEqual([2, 2])
        })
    })

    test("compares every scratch generation against one committed-success baseline", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(0)
        const comparisons: [number, number][] = []
        const derived = domain.selector(
            get => Object.freeze({ value: get(source) }),
            {
                equal: (baseline, candidate) => {
                    comparisons.push([baseline.value, candidate.value])
                    return Math.abs(baseline.value - candidate.value) <= 1
                },
            },
        )
        const tree = domain.createStoreTree()
        const committed = tree.get(derived)
        comparisons.splice(0)

        tree.txn(transaction => {
            transaction.set(source, 2)
            expect(transaction.get(derived).value).toBe(2)
            transaction.set(source, 1)
            expect(transaction.get(derived)).toBe(committed)
            expect(comparisons).toEqual([
                [0, 2],
                [0, 1],
            ])
        })
        expect(tree.get(derived)).toBe(committed)
    })

    test("shares draft lazy outcomes across direct and transitive reads without publishing unrelated work", () => {
        const domain = createCommittedStoreTreeDomain()
        const unrelated = domain.atom(0)
        let calls = 0
        const lazy = domain.atomLazy(() =>
            Object.freeze({ invocation: ++calls }),
        )
        const derived = domain.selector(get => get(lazy))
        const lazyCause = new Error("lazy scratch failure")
        let errorCalls = 0
        const failedLazy = domain.atomLazy<number>(() => {
            errorCalls++
            throw lazyCause
        })
        const failedDerived = domain.selector(get => get(failedLazy))
        const tree = domain.createStoreTree()

        let speculative!: Readonly<{ invocation: number }>
        tree.txn(transaction => {
            speculative = transaction.get(lazy)
            expect(transaction.get(derived)).toBe(speculative)
            transaction.set(unrelated, 1)
            expect(transaction.get(derived)).toBe(speculative)
            expect(thrownBy(() => transaction.get(failedLazy))).toBe(lazyCause)
            expect(
                thrownBy(() => transaction.get(failedDerived)),
            ).toBeInstanceOf(Error)
            expect(calls).toBe(1)
            expect(errorCalls).toBe(1)
        })

        const committed = tree.get(lazy)
        expect(committed).not.toBe(speculative)
        expect(committed.invocation).toBe(2)
        expect(thrownBy(() => tree.get(failedLazy))).toBe(lazyCause)
        expect(errorCalls).toBe(2)

        let aborted!: Readonly<{ invocation: number }>
        expect(
            thrownBy(() =>
                tree.txn(transaction => {
                    transaction.reset(lazy)
                    aborted = transaction.get(derived)
                    throw new Error("abort")
                }),
            ),
        ).toBeInstanceOf(Error)
        expect(tree.get(lazy)).toBe(committed)
        expect(aborted).toBe(committed)
        expect(calls).toBe(2)
    })

    test("keeps scratch branch dependencies out of the persistent graph", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(false)
        const left = domain.atom(1)
        const right = domain.atom(10)
        let evaluations = 0
        const choice = domain.selector(get => {
            evaluations++
            return get(get(gate) ? right : left)
        })
        const tree = domain.createStoreTree()

        expect(tree.get(choice)).toBe(1)
        expect(
            thrownBy(() =>
                tree.txn(transaction => {
                    transaction.set(gate, true)
                    expect(transaction.get(choice)).toBe(10)
                    throw new Error("abort scratch branch")
                }),
            ),
        ).toBeInstanceOf(Error)
        expect(evaluations).toBe(2)

        tree.set(right, 11)
        expect(evaluations).toBe(2)
        tree.set(left, 2)
        expect(evaluations).toBe(3)
        expect(tree.get(choice)).toBe(2)
    })

    test("retries memoized scratch cycles only after a successful intent", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const gate = local.atom(true)
        const unrelated = local.atom(0)
        const foreignAtom = foreign.atom(0)
        let evaluations = 0
        let recursive!: Selector<number>
        recursive = local.selector(get => {
            evaluations++
            return get(gate) ? get(recursive) : 1
        })
        const tree = local.createStoreTree()

        tree.txn(transaction => {
            const first = thrownBy(() => transaction.get(recursive))
            expect(first).toBeInstanceOf(SelectorCircularDependencyError)
            expect(thrownBy(() => transaction.get(recursive))).toBe(first)
            expect(evaluations).toBe(1)

            expect(thrownBy(() => transaction.get(foreignAtom))).toBeInstanceOf(
                RuntimeMismatchError,
            )
            expect(thrownBy(() => transaction.get(recursive))).toBe(first)
            expect(evaluations).toBe(1)

            transaction.set(unrelated, 1)
            const retried = thrownBy(() => transaction.get(recursive))
            expect(retried).toBeInstanceOf(SelectorCircularDependencyError)
            expect(retried).not.toBe(first)
            expect(evaluations).toBe(2)

            transaction.set(gate, false)
            expect(transaction.get(recursive)).toBe(1)
            expect(evaluations).toBe(3)
        })
    })

    test("does not reuse or publish an unmaterialized committed selector record", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(2)
        let evaluations = 0
        const derived = domain.selector(get => {
            evaluations++
            return Object.freeze({ doubled: get(source) * 2 })
        })
        const tree = domain.createStoreTree()

        const scratch = tree.txn(transaction => transaction.get(derived))
        expect(evaluations).toBe(1)
        const committed = tree.get(derived)
        expect(evaluations).toBe(2)
        expect(committed).not.toBe(scratch)
        expect(committed).toEqual(scratch)
    })

    test("keeps completed scratch children but never memoizes a control-failed parent", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        let foreignInitializerCalls = 0
        const foreignLazy = foreign.atomLazy(() => {
            foreignInitializerCalls++
            return 9
        })
        const source = local.atom(0)
        const other = local.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        let childEvaluations = 0
        let parentEvaluations = 0
        const nestedFaults: unknown[] = []
        const child = local.selector(get => {
            childEvaluations++
            return get(source) + 1
        })
        const contaminated = local.selector(get => {
            parentEvaluations++
            const value = get(child)
            try {
                sibling.get(foreignLazy)
            } catch (error) {
                nestedFaults.push(error)
            }
            return value
        })

        tree.txn(transaction => {
            transaction.set(source, 1)
            const first = thrownBy(() => transaction.get(contaminated))
            expect(first).toBe(nestedFaults[0])
            expect(first).toBeInstanceOf(RuntimeMismatchError)
            expect(transaction.get(child)).toBe(2)
            expect(childEvaluations).toBe(1)

            const second = thrownBy(() => transaction.get(contaminated))
            expect(second).toBe(nestedFaults[1])
            expect(second).toBeInstanceOf(RuntimeMismatchError)
            expect(second).not.toBe(first)
            expect([childEvaluations, parentEvaluations]).toEqual([1, 2])

            transaction.set(other, 2)
        })
        expect(tree.get(source)).toBe(1)
        expect(tree.get(other)).toBe(2)
        expect(foreignInitializerCalls).toBe(0)
    })

    test("preserves the first nested mismatch through hostile scratch owner inspection", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const foreignAtom = foreign.atom(0)
        const source = local.atom(3)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const nestedFaults: unknown[] = []
        let traps = 0
        const impostor = new Proxy(
            { kind: "atom" },
            {
                getOwnPropertyDescriptor(): undefined {
                    traps++
                    try {
                        sibling.get(foreignAtom)
                    } catch (error) {
                        nestedFaults.push(error)
                    }
                    throw new Error("later trap failure")
                },
            },
        )
        const contaminated = local.selector(get => {
            get(impostor as never)
            return get(source)
        })

        tree.txn(transaction => {
            const first = thrownBy(() => transaction.get(contaminated))
            expect(first).toBe(nestedFaults[0])
            expect(first).toBeInstanceOf(RuntimeMismatchError)
            const second = thrownBy(() => transaction.get(contaminated))
            expect(second).toBe(nestedFaults[1])
            expect(second).toBeInstanceOf(RuntimeMismatchError)
        })
        expect(traps).toBe(2)
    })

    test("performs no owner-descriptor reflection for local scratch handles", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        const derived = domain.selector(get => get(source) + 1)
        const tree = domain.createStoreTree()
        const original = Object.getOwnPropertyDescriptor
        let localHandleProbes = 0

        Object.getOwnPropertyDescriptor = ((target, key) => {
            if (Object.is(target, source) || Object.is(target, derived)) {
                localHandleProbes++
            }
            return original(target, key)
        }) as typeof Object.getOwnPropertyDescriptor
        try {
            tree.txn(transaction => {
                expect(transaction.get(derived)).toBe(2)
                expect(transaction.get(derived)).toBe(2)
            })
        } finally {
            Object.getOwnPropertyDescriptor = original
        }
        expect(localHandleProbes).toBe(0)
    })

    test("quarantines captured Store and cursor operations while independent domains remain usable", () => {
        const local = createCommittedStoreTreeDomain()
        const independent = createCommittedStoreTreeDomain()
        const source = local.atom(1)
        const independentSource = independent.atom(0)
        const independentTree = independent.createStoreTree()
        let tree!: ReturnType<typeof local.createStoreTree>
        let cursor!: RootTransaction
        let evaluations = 0
        const errors: unknown[] = []
        const derived = local.selector(get => {
            evaluations++
            for (const operation of [
                () => tree.get(source),
                () => tree.set(source, 8),
                () => cursor.set(source, 9),
            ]) {
                try {
                    operation()
                } catch (error) {
                    errors.push(error)
                }
            }
            independentTree.set(independentSource, 4)
            return get(source)
        })
        tree = local.createStoreTree()

        tree.txn(transaction => {
            cursor = transaction
            expect(transaction.get(derived)).toBe(1)
            expect(transaction.get(derived)).toBe(1)
        })
        expect(evaluations).toBe(1)
        expect(errors).toEqual([
            expect.objectContaining({
                code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
            }),
            expect.objectContaining({
                code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
            }),
            expect.objectContaining({
                code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
            }),
        ])
        expect(tree.get(source)).toBe(1)
        expect(independentTree.get(independentSource)).toBe(4)
    })

    test("revokes supplied selector reads immediately and retained cursors on callback exit", async () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        let suppliedGet!: <Value>(state: typeof source) => Value
        let retained!: RootTransaction
        const derived = domain.selector(get => {
            suppliedGet = get as typeof suppliedGet
            return get(source)
        })
        const tree = domain.createStoreTree()

        tree.txn(transaction => {
            retained = transaction
            expect(transaction.get(derived)).toBe(1)
            expect(thrownBy(() => suppliedGet(source))).toBeInstanceOf(
                SelectorReadRevokedError,
            )
        })
        await Promise.resolve()
        expect(thrownBy(() => suppliedGet(source))).toBeInstanceOf(
            SelectorReadRevokedError,
        )
        expect(thrownBy(() => retained.get(source))).toMatchObject({
            code: "VALDRES_TRANSACTION_CLOSED",
        })
    })

    test("contains scratch getter and comparator thenables once per generation", () => {
        const domain = createCommittedStoreTreeDomain()
        const unrelated = domain.atom(0)
        const source = domain.atom(0)
        let getterEvaluations = 0
        let getterContainments = 0
        const asynchronousGetter = domain.selector(() => {
            getterEvaluations++
            return {
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    getterContainments++
                    reject(new Error("contained getter"))
                },
            }
        })
        let comparatorContainments = 0
        const compared = domain.selector(get => get(source), {
            equal: (() => ({
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    comparatorContainments++
                    reject(new Error("contained comparator"))
                },
            })) as unknown as (previous: number, next: number) => boolean,
        })
        const tree = domain.createStoreTree()
        expect(tree.get(compared)).toBe(0)

        tree.txn(transaction => {
            const getterError = thrownBy(() =>
                transaction.get(asynchronousGetter),
            )
            expect(getterError).toBeInstanceOf(
                InvalidSynchronousSelectorResultError,
            )
            expect(thrownBy(() => transaction.get(asynchronousGetter))).toBe(
                getterError,
            )

            transaction.set(source, 1)
            const comparatorError = thrownBy(() => transaction.get(compared))
            expect(comparatorError).toBeInstanceOf(
                InvalidSynchronousSelectorResultError,
            )
            expect(thrownBy(() => transaction.get(compared))).toBe(
                comparatorError,
            )
            expect([getterContainments, comparatorContainments]).toEqual([1, 1])

            transaction.set(unrelated, 1)
            expect(
                thrownBy(() => transaction.get(asynchronousGetter)),
            ).not.toBe(getterError)
            expect(thrownBy(() => transaction.get(compared))).not.toBe(
                comparatorError,
            )
            expect([getterContainments, comparatorContainments]).toEqual([2, 2])
        })

        expect(thrownBy(() => tree.get(asynchronousGetter))).toBeInstanceOf(
            InvalidSynchronousSelectorResultError,
        )
        expect(getterEvaluations).toBe(3)
        expect(getterContainments).toBe(3)
    })
})
