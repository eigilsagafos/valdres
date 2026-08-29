import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    createCommittedStoreTreeDomain,
    type RootTransaction,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
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
})
