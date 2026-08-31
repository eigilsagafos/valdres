import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import {
    RuntimeMismatchError,
    createCommittedStoreTreeDomain,
    type CommittedStoreTree,
    type Selector,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    SelectorCircularDependencyError,
    SelectorGetterError,
} from "../../src/v1-internal/selector-evaluator/errors"
import { createReferenceModel, value } from "../v1-model"
import type { Mutation, ValueToken } from "../v1-model/protocol"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 persistent committed StoreTree host", () => {
    test("stores exact Atom values with Object.is defaults and isolates StoreTrees", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const optional = domain.atom<undefined>(undefined)
        const fallbackHandler = (): string => "fallback"
        const handler = domain.atom(fallbackHandler)
        const nan = domain.atom(Number.NaN)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        const replacementHandler = (): string => "replacement"

        expect(Object.isFrozen(count)).toBe(true)
        expect(first.get(optional)).toBeUndefined()
        expect(Number.isNaN(first.get(nan))).toBe(true)
        expect(first.get(handler)).toBe(fallbackHandler)

        first.set(count, -0)
        first.set(handler, replacementHandler)

        expect(Object.is(first.get(count), -0)).toBe(true)
        expect(first.get(handler)).toBe(replacementHandler)
        expect(Object.is(second.get(count), 0)).toBe(true)
        expect(second.get(handler)).toBe(fallbackHandler)

        if (false) {
            // @ts-expect-error Atom values are invariant.
            first.set(count, "not a number")
        }
    })

    test("updates and resets exact Atom values through the direct facade", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const optional = domain.atom<number | undefined>(undefined)
        const fallbackHandler = (): string => "fallback"
        const replacementHandler = (): string => "replacement"
        const handler = domain.atom(fallbackHandler)
        const nan = domain.atom(Number.NaN)
        const tree = domain.createStoreTree()
        const sibling = domain.createStoreTree()
        let updaterCalls = 0

        expect(
            tree.update(count, current => {
                updaterCalls++
                expect(current).toBe(0)
                return -0
            }),
        ).toBeUndefined()
        tree.update(optional, current => {
            updaterCalls++
            expect(current).toBeUndefined()
            return undefined
        })
        tree.update(handler, current => {
            updaterCalls++
            expect(current).toBe(fallbackHandler)
            return replacementHandler
        })
        tree.update(nan, current => {
            updaterCalls++
            expect(Number.isNaN(current)).toBe(true)
            return Number.NaN
        })

        expect(updaterCalls).toBe(4)
        expect(Object.is(tree.get(count), -0)).toBe(true)
        expect(tree.get(optional)).toBeUndefined()
        expect(tree.get(handler)).toBe(replacementHandler)
        expect(Number.isNaN(tree.get(nan))).toBe(true)
        expect(Object.is(sibling.get(count), 0)).toBe(true)
        expect(sibling.get(handler)).toBe(fallbackHandler)

        expect(tree.reset(count)).toBeUndefined()
        tree.reset(optional)
        tree.reset(handler)
        tree.reset(nan)
        expect(Object.is(tree.get(count), 0)).toBe(true)
        expect(tree.get(optional)).toBeUndefined()
        expect(tree.get(handler)).toBe(fallbackHandler)
        expect(Number.isNaN(tree.get(nan))).toBe(true)
        expect(Object.is(sibling.get(count), 0)).toBe(true)
        expect(sibling.get(handler)).toBe(fallbackHandler)

        const selector = domain.selector(get => get(count))
        if (false) {
            // @ts-expect-error Selectors cannot be updated.
            tree.update(selector, current => current + 1)
            // @ts-expect-error Selectors cannot be reset.
            tree.reset(selector)
            // @ts-expect-error Updaters must preserve the Atom value type.
            tree.update(count, () => "wrong")
        }
    })

    test("matches the unchanged ReferenceModel across deterministic direct-operation traces", () => {
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

        let random = 0xd1ec7
        const next = (): number => {
            random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0
            return random
        }
        const candidates = [Number.NaN, -0, 0, -8, -1, 1, 7, 12] as const

        for (let trace = 0; trace < 384; trace++) {
            const atom = next() % 2 === 0 ? "count" : "offset"
            const operation = next() % 3
            let mutation: Mutation
            if (operation === 0) {
                const candidate = candidates[next() % candidates.length]!
                tree.set(actualAtoms[atom], candidate)
                mutation = {
                    kind: "set-atom",
                    atom,
                    value: value.number(candidate),
                }
            } else if (operation === 1) {
                const amount = (next() % 9) - 4
                tree.update(actualAtoms[atom], current => current + amount)
                mutation = {
                    kind: "update-atom",
                    atom,
                    updater: { kind: "number-add", amount },
                }
            } else {
                tree.reset(actualAtoms[atom])
                mutation = { kind: "reset-atom", atom }
            }

            expect(
                model.execute({
                    kind: "mutate",
                    tree: "tree",
                    scope: "root",
                    mutation,
                }),
            ).toMatchObject({ ok: true, committed: true })

            for (const id of ["count", "offset"] as const) {
                const read = model.execute({
                    kind: "read",
                    tree: "tree",
                    scope: "root",
                    target: { kind: "atom", atom: id },
                    as: `${trace}-${id}`,
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
                        tree.get(actualAtoms[id]),
                        (token as Extract<ValueToken, { kind: "number" }>)
                            .value,
                    ),
                ).toBe(true)
            }
        }
    })

    test("memoizes lazy value and error outcomes once per StoreTree and rejects thenables", () => {
        const domain = createCommittedStoreTreeDomain()
        let valueCalls = 0
        const lazy = domain.atomLazy(() =>
            Object.freeze({ invocation: ++valueCalls }),
        )
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()

        const firstValue = first.get(lazy)
        expect(first.get(lazy)).toBe(firstValue)
        expect(second.get(lazy)).not.toBe(firstValue)
        expect(valueCalls).toBe(2)

        const cause = new Error("lazy failed")
        let errorCalls = 0
        const failed = domain.atomLazy(() => {
            errorCalls++
            throw cause
        })
        const firstError = thrownBy(() => first.get(failed))
        expect(thrownBy(() => first.get(failed))).toBe(firstError)
        expect(firstError).toBe(cause)
        expect(errorCalls).toBe(1)

        let thenGets = 0
        let thenCalls = 0
        const thenable = {
            get then() {
                thenGets++
                return (
                    _resolve: unknown,
                    reject: (error: unknown) => void,
                ): void => {
                    thenCalls++
                    reject(new Error("contained"))
                }
            },
        }
        const asynchronous = domain.atomLazy(() => thenable)
        const asynchronousError = thrownBy(() => first.get(asynchronous))
        expect(asynchronousError).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(thrownBy(() => first.get(asynchronous))).toBe(asynchronousError)

        const thrownAsynchronous = domain.atomLazy(() => {
            throw thenable
        })
        expect(thrownBy(() => first.get(thrownAsynchronous))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })

        expect(thrownBy(() => domain.atom(thenable))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })

        const holder = domain.atom<unknown>(0)
        expect(thrownBy(() => first.set(holder, thenable))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(first.get(holder)).toBe(0)
        expect(thenGets).toBe(4)
        expect(thenCalls).toBe(4)
    })

    test("supports a lazy initializer reentering its active selector read", () => {
        const domain = createCommittedStoreTreeDomain()
        let suppliedGet: (() => number) | undefined
        let reenter = true
        let initializerCalls = 0
        const lazy = domain.atomLazy(() => {
            initializerCalls++
            if (!reenter) return 7
            reenter = false
            return suppliedGet!()
        })
        const parent = domain.selector(get => {
            suppliedGet = () => get(lazy)
            return get(lazy)
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(7)
        expect(tree.get(parent)).toBe(7)
        expect(initializerCalls).toBe(2)
    })

    test("quarantines direct-set thenable containment across same-domain StoreTrees", () => {
        const domain = createCommittedStoreTreeDomain()
        const target = domain.atom<unknown>(0)
        const reentryTarget = domain.atom(0)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        let reentryError: unknown
        const hostileThenable = {
            then(): void {
                try {
                    second.set(reentryTarget, 9)
                } catch (error) {
                    reentryError = error
                }
            },
        }

        expect(
            thrownBy(() => first.set(target, hostileThenable)),
        ).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(reentryError).toMatchObject({
            name: "CallbackCapabilityError",
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(first.get(target)).toBe(0)
        expect(second.get(reentryTarget)).toBe(0)
    })

    test("contains returned and thrown direct-updater thenables under one callback quarantine", () => {
        const domain = createCommittedStoreTreeDomain()
        const target = domain.atom<unknown>(0)
        const reentryTarget = domain.atom(0)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        const reentryErrors: unknown[] = []
        let thenCalls = 0
        let nestedUpdaterCalls = 0
        const hostileThenable = {
            then(
                _resolve: (value: unknown) => void,
                reject: (error: unknown) => void,
            ): void {
                thenCalls++
                try {
                    second.update(reentryTarget, current => {
                        nestedUpdaterCalls++
                        return current + 1
                    })
                } catch (error) {
                    reentryErrors.push(error)
                }
                reject(new Error("contained"))
            },
        }

        expect(
            thrownBy(() => first.update(target, () => hostileThenable)),
        ).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(
            thrownBy(() =>
                first.update(target, () => {
                    throw hostileThenable
                }),
            ),
        ).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(thenCalls).toBe(2)
        expect(nestedUpdaterCalls).toBe(0)
        expect(reentryErrors).toHaveLength(2)
        for (const error of reentryErrors) {
            expect(error).toMatchObject({
                name: "CallbackCapabilityError",
                code: "VALDRES_CALLBACK_CAPABILITY",
            })
        }
        expect(first.get(target)).toBe(0)
        expect(second.get(reentryTarget)).toBe(0)

        expect(thrownBy(() => first.update(target, 1 as never))).toBeInstanceOf(
            TypeError,
        )
        expect(first.get(target)).toBe(0)
    })

    test("inspects a direct updater candidate exactly once before committing it", () => {
        const domain = createCommittedStoreTreeDomain()
        const target = domain.atom<unknown>(0)
        const tree = domain.createStoreTree()
        let thenGetterCalls = 0
        const candidate = Object.freeze(
            Object.defineProperty({}, "then", {
                get(): undefined {
                    thenGetterCalls++
                    return undefined
                },
            }),
        )

        tree.update(target, () => candidate)

        expect(thenGetterCalls).toBe(1)
        expect(tree.get(target)).toBe(candidate)
    })

    test("preserves updater control faults while quarantining same-domain and transaction reentry", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const independent = createCommittedStoreTreeDomain()
        const source = local.atom<unknown>(0)
        const count = local.atom(1)
        const siblingTarget = local.atom(0)
        const independentUpdated = independent.atom(0)
        const independentReset = independent.atom(3)
        let foreignCalls = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignCalls++
            return 9
        })
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const independentTree = independent.createStoreTree()
        independentTree.set(independentReset, 9)
        let caughtMismatch: unknown
        let thenCalls = 0
        const candidateThenable = {
            then(
                _resolve: (value: unknown) => void,
                reject: (error: unknown) => void,
            ): void {
                thenCalls++
                reject(new Error("contained"))
            },
        }

        const mismatch = thrownBy(() =>
            tree.update(source, () => {
                try {
                    sibling.get(foreignAtom)
                } catch (error) {
                    caughtMismatch = error
                }
                return candidateThenable
            }),
        )
        expect(mismatch).toBe(caughtMismatch)
        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(thenCalls).toBe(1)
        expect(foreignCalls).toBe(0)
        expect(tree.get(source)).toBe(0)

        const callbackErrors: unknown[] = []
        tree.update(count, current => {
            for (const operation of [
                () => sibling.set(siblingTarget, 1),
                () => sibling.update(siblingTarget, candidate => candidate + 1),
                () => sibling.reset(siblingTarget),
            ]) {
                try {
                    operation()
                } catch (error) {
                    callbackErrors.push(error)
                }
            }
            independentTree.update(
                independentUpdated,
                candidate => candidate + 2,
            )
            independentTree.reset(independentReset)
            return current + 1
        })
        expect(callbackErrors).toHaveLength(3)
        for (const error of callbackErrors) {
            expect(error).toMatchObject({
                name: "CallbackCapabilityError",
                code: "VALDRES_CALLBACK_CAPABILITY",
            })
        }
        expect(tree.get(count)).toBe(2)
        expect(sibling.get(siblingTarget)).toBe(0)
        expect(independentTree.get(independentUpdated)).toBe(2)
        expect(independentTree.get(independentReset)).toBe(3)

        const transactionErrors: unknown[] = []
        tree.txn(() => {
            for (const operation of [
                () => tree.update(count, current => current + 1),
                () => tree.reset(count),
            ]) {
                try {
                    operation()
                } catch (error) {
                    transactionErrors.push(error)
                }
            }
        })
        expect(transactionErrors).toHaveLength(2)
        for (const error of transactionErrors) {
            expect(error).toMatchObject({
                name: "TransactionPhaseError",
                code: "VALDRES_TRANSACTION_PHASE",
            })
        }
        expect(tree.get(count)).toBe(2)
    })

    test("quarantines hostile owner-brand inspection before work", () => {
        const domain = createCommittedStoreTreeDomain()
        const target = domain.atom(0)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        let traps = 0
        let updaterCalls = 0
        let reentryError: unknown
        const impostor = new Proxy(
            { kind: "atom" },
            {
                getOwnPropertyDescriptor(): undefined {
                    traps++
                    try {
                        second.set(target, 9)
                    } catch (error) {
                        reentryError = error
                    }
                    return undefined
                },
            },
        )

        expect(thrownBy(() => first.get(impostor as never))).toBeInstanceOf(
            TypeError,
        )
        expect(reentryError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(second.get(target)).toBe(0)

        expect(
            thrownBy(() => first.set(impostor as never, 1 as never)),
        ).toBeInstanceOf(TypeError)
        expect(reentryError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(second.get(target)).toBe(0)

        expect(
            thrownBy(() =>
                first.update(impostor as never, () => {
                    updaterCalls++
                    return 1 as never
                }),
            ),
        ).toBeInstanceOf(TypeError)
        expect(thrownBy(() => first.reset(impostor as never))).toBeInstanceOf(
            TypeError,
        )
        expect(updaterCalls).toBe(0)
        expect(reentryError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(second.get(target)).toBe(0)
        expect(traps).toBe(4)
    })

    test("preserves the first mismatch caught inside owner-brand inspection", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const foreignAtom = foreign.atom(7)
        const first = local.createStoreTree()
        const sibling = local.createStoreTree()
        const caught: unknown[] = []
        const catchNestedMismatch = (): void => {
            try {
                sibling.get(foreignAtom)
            } catch (error) {
                caught.push(error)
            }
        }
        const invalidProxy = new Proxy(
            { kind: "atom" },
            {
                getOwnPropertyDescriptor(): undefined {
                    catchNestedMismatch()
                    return undefined
                },
            },
        )

        expect(thrownBy(() => first.get(invalidProxy as never))).toBe(caught[0])
        expect(
            thrownBy(() => first.set(invalidProxy as never, 1 as never)),
        ).toBe(caught[1])
        expect(
            thrownBy(() =>
                first.update(invalidProxy as never, () => 1 as never),
            ),
        ).toBe(caught[2])
        expect(thrownBy(() => first.reset(invalidProxy as never))).toBe(
            caught[3],
        )
        expect(caught).toHaveLength(4)
        for (const error of caught) {
            expect(error).toBeInstanceOf(RuntimeMismatchError)
            expect(error).toMatchObject({ code: "VALDRES_RUNTIME_MISMATCH" })
        }

        const foreignProxy = new Proxy(foreignAtom, {
            getOwnPropertyDescriptor(
                target,
                key,
            ): PropertyDescriptor | undefined {
                catchNestedMismatch()
                return Reflect.getOwnPropertyDescriptor(target, key)
            },
        })
        const outerMismatch = thrownBy(() => first.get(foreignProxy))
        expect(outerMismatch).toBe(caught[4])
        expect(outerMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(caught).toHaveLength(5)
    })

    test("sets over fresh and previously exposed lazy initializer errors without retry", () => {
        const domain = createCommittedStoreTreeDomain()
        const freshCause = new Error("fresh lazy failure")
        const exposedCause = new Error("exposed lazy failure")
        let freshCalls = 0
        let exposedCalls = 0
        const fresh = domain.atomLazy<number>(() => {
            freshCalls++
            throw freshCause
        })
        const exposed = domain.atomLazy<number>(() => {
            exposedCalls++
            throw exposedCause
        })
        const tree = domain.createStoreTree()

        expect(() => tree.set(fresh, 4)).not.toThrow()
        expect(tree.get(fresh)).toBe(4)
        expect(freshCalls).toBe(1)

        expect(thrownBy(() => tree.get(exposed))).toBe(exposedCause)
        expect(() => tree.set(exposed, 5)).not.toThrow()
        expect(tree.get(exposed)).toBe(5)
        expect(exposedCalls).toBe(1)
    })

    test("resets lazy fallbacks symbolically without invoking Atom comparators", () => {
        const domain = createCommittedStoreTreeDomain()
        let lazyCalls = 0
        const comparisons: [number, number][] = []
        const lazy = domain.atomLazy(
            () => {
                lazyCalls++
                return 5
            },
            {
                equal: (previous, next) => {
                    comparisons.push([previous, next])
                    return Object.is(previous, next)
                },
            },
        )
        const tree = domain.createStoreTree()

        tree.reset(lazy)
        expect(tree.get(lazy)).toBe(5)
        expect(lazyCalls).toBe(1)
        expect(comparisons).toEqual([])

        tree.set(lazy, 9)
        expect(tree.get(lazy)).toBe(9)
        expect(comparisons).toEqual([[5, 9]])
        comparisons.splice(0)

        tree.reset(lazy)
        expect(tree.get(lazy)).toBe(5)
        expect(lazyCalls).toBe(1)
        expect(comparisons).toEqual([])

        const cause = new Error("lazy reset failed")
        let failedCalls = 0
        const failed = domain.atomLazy<number>(() => {
            failedCalls++
            throw cause
        })
        tree.set(failed, 7)
        expect(tree.get(failed)).toBe(7)
        expect(failedCalls).toBe(1)
        expect(thrownBy(() => tree.reset(failed))).toBe(cause)
        expect(tree.get(failed)).toBe(7)
        expect(failedCalls).toBe(1)

        const transientErrors: Error[] = []
        let transientCalls = 0
        const transientFailure = domain.atomLazy<number>(() => {
            transientCalls++
            const error = new Error(`transient reset ${transientCalls}`)
            transientErrors.push(error)
            throw error
        })
        expect(thrownBy(() => tree.reset(transientFailure))).toBe(
            transientErrors[0],
        )
        expect(thrownBy(() => tree.reset(transientFailure))).toBe(
            transientErrors[1],
        )
        expect(transientCalls).toBe(2)

        const stickyCause = new Error("committed lazy failure")
        let stickyCalls = 0
        const stickyFailure = domain.atomLazy<number>(() => {
            stickyCalls++
            throw stickyCause
        })
        expect(thrownBy(() => tree.get(stickyFailure))).toBe(stickyCause)
        expect(thrownBy(() => tree.reset(stickyFailure))).toBe(stickyCause)
        expect(stickyCalls).toBe(1)
    })

    test("publishes lazy fallback only after a successful direct update", () => {
        const domain = createCommittedStoreTreeDomain()
        let successfulCalls = 0
        const fallbacks: Readonly<{ invocation: number }>[] = []
        const successful = domain.atomLazy(() => {
            const fallback = Object.freeze({ invocation: ++successfulCalls })
            fallbacks.push(fallback)
            return fallback
        })
        const tree = domain.createStoreTree()

        tree.update(successful, current =>
            Object.freeze({ invocation: current.invocation + 10 }),
        )
        expect(tree.get(successful).invocation).toBe(11)
        tree.reset(successful)
        expect(tree.get(successful)).toBe(fallbacks[0])
        expect(successfulCalls).toBe(1)

        const updaterCause = new Error("updater failed")
        let failedCalls = 0
        const failed = domain.atomLazy(() =>
            Object.freeze({ invocation: ++failedCalls }),
        )
        expect(
            thrownBy(() =>
                tree.update(failed, () => {
                    throw updaterCause
                }),
            ),
        ).toBe(updaterCause)
        expect(failedCalls).toBe(1)
        expect(tree.get(failed).invocation).toBe(2)

        let asynchronousCalls = 0
        let thenCalls = 0
        const asynchronousFallbacks: object[] = []
        const asynchronous = domain.atomLazy<unknown>(() => {
            const fallback = Object.freeze({
                invocation: ++asynchronousCalls,
            })
            asynchronousFallbacks.push(fallback)
            return fallback
        })
        const thenable = {
            then(
                _resolve: (value: unknown) => void,
                reject: (error: unknown) => void,
            ): void {
                thenCalls++
                reject(new Error("contained"))
            },
        }
        expect(
            thrownBy(() => tree.update(asynchronous, () => thenable)),
        ).toMatchObject({
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(asynchronousCalls).toBe(1)
        expect(thenCalls).toBe(1)
        expect(tree.get(asynchronous)).toBe(asynchronousFallbacks[1])
        expect(asynchronousCalls).toBe(2)
    })

    test("retries uncommitted returned and thrown lazy thenables on direct reset", () => {
        const domain = createCommittedStoreTreeDomain()
        let returnedInitializerCalls = 0
        let returnedThenCalls = 0
        let returnedComparatorCalls = 0
        const returnedThenable = {
            then(
                _resolve: (value: unknown) => void,
                reject: (error: unknown) => void,
            ): void {
                returnedThenCalls++
                reject(new Error("contained returned lazy thenable"))
            },
        }
        const returned = domain.atomLazy<unknown>(
            () => {
                returnedInitializerCalls++
                return returnedInitializerCalls <= 2
                    ? returnedThenable
                    : "returned fallback"
            },
            {
                equal: () => {
                    returnedComparatorCalls++
                    return false
                },
            },
        )

        let thrownInitializerCalls = 0
        let thrownThenCalls = 0
        let thrownComparatorCalls = 0
        const thrownThenable = {
            then(
                _resolve: (value: unknown) => void,
                reject: (error: unknown) => void,
            ): void {
                thrownThenCalls++
                reject(new Error("contained thrown lazy thenable"))
            },
        }
        const thrown = domain.atomLazy<unknown>(
            () => {
                thrownInitializerCalls++
                if (thrownInitializerCalls <= 2) throw thrownThenable
                return "thrown fallback"
            },
            {
                equal: () => {
                    thrownComparatorCalls++
                    return false
                },
            },
        )
        const tree = domain.createStoreTree()

        for (const atom of [returned, thrown]) {
            for (let attempt = 0; attempt < 2; attempt++) {
                expect(thrownBy(() => tree.reset(atom))).toMatchObject({
                    name: "InvalidSynchronousAtomValueError",
                    code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
                })
            }
        }
        expect(returnedInitializerCalls).toBe(2)
        expect(returnedThenCalls).toBe(2)
        expect(returnedComparatorCalls).toBe(0)
        expect(thrownInitializerCalls).toBe(2)
        expect(thrownThenCalls).toBe(2)
        expect(thrownComparatorCalls).toBe(0)

        expect(tree.get(returned)).toBe("returned fallback")
        expect(tree.get(thrown)).toBe("thrown fallback")
        expect(returnedInitializerCalls).toBe(3)
        expect(thrownInitializerCalls).toBe(3)
        expect(returnedComparatorCalls).toBe(0)
        expect(thrownComparatorCalls).toBe(0)
    })

    test("integrates the evaluator once per relevant committed token change", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        const unrelated = domain.atom(0)
        let childEvaluations = 0
        let parentEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            return get(source) * 2
        })
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(child) + 1
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(3)
        expect(tree.get(parent)).toBe(3)
        expect([childEvaluations, parentEvaluations]).toEqual([1, 1])

        tree.set(unrelated, 1)
        tree.set(source, 1)
        expect([childEvaluations, parentEvaluations]).toEqual([1, 1])

        tree.set(source, 2)
        expect(tree.get(parent)).toBe(5)
        expect([childEvaluations, parentEvaluations]).toEqual([2, 2])

        if (false) {
            // @ts-expect-error Selectors are not writable cells.
            tree.set(parent, 1)
        }
    })

    test("keeps direct update and reset authoritative across post-apply propagation", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const source = local.atom(1)
        let foreignCalls = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignCalls++
            return 9
        })
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        let contaminate = false
        let evaluations = 0
        let updaterCalls = 0
        const derived = local.selector(get => {
            evaluations++
            const current = get(source)
            if (contaminate) {
                try {
                    sibling.get(foreignAtom)
                } catch {}
            }
            return current
        })

        expect(tree.get(derived)).toBe(1)
        tree.set(source, 2)
        expect(tree.get(derived)).toBe(2)

        contaminate = true
        const propagationError = thrownBy(() =>
            tree.update(source, current => {
                updaterCalls++
                return current + 1
            }),
        )
        expect(propagationError).toBeInstanceOf(RuntimeMismatchError)
        expect(tree.get(source)).toBe(3)
        expect(thrownBy(() => tree.get(derived))).toBe(propagationError)
        expect(updaterCalls).toBe(1)
        expect(foreignCalls).toBe(0)

        const resetPropagationError = thrownBy(() => tree.reset(source))
        expect(resetPropagationError).toBeInstanceOf(RuntimeMismatchError)
        expect(resetPropagationError).not.toBe(propagationError)
        expect(tree.get(source)).toBe(1)
        expect(thrownBy(() => tree.get(derived))).toBe(resetPropagationError)

        contaminate = false
        tree.update(source, current => {
            updaterCalls++
            return current + 1
        })
        expect(tree.get(source)).toBe(2)
        expect(tree.get(derived)).toBe(2)
        expect(updaterCalls).toBe(2)
        expect(evaluations).toBe(5)
    })

    test("settles a wide fanout with one evaluation per affected selector", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(0)
        const tree = domain.createStoreTree()
        const width = 2_048
        const evaluations = Array<number>(width).fill(0)
        const selectors = evaluations.map((_, index) =>
            domain.selector(get => {
                evaluations[index]++
                return get(source) + index
            }),
        )

        expect(selectors.map(selector => tree.get(selector))).toEqual(
            selectors.map((_, index) => index),
        )
        tree.set(source, 1)
        expect(evaluations).toEqual(Array<number>(width).fill(2))
        expect(selectors.map(selector => tree.get(selector))).toEqual(
            selectors.map((_, index) => index + 1),
        )
    })

    test("switches dynamic selector fanouts at 1k, 2k, and 4k with linear evaluations", () => {
        for (const width of [1_000, 2_000, 4_000]) {
            const domain = createCommittedStoreTreeDomain()
            const gate = domain.atom(false)
            const left = domain.atom(0)
            const right = domain.atom(0)
            const tree = domain.createStoreTree()
            const evaluations = Array<number>(width).fill(0)
            const selectors = evaluations.map((_, index) =>
                domain.selector(get => {
                    evaluations[index]++
                    return (get(gate) ? get(right) : get(left)) + index
                }),
            )

            for (let index = 0; index < width; index++) {
                expect(tree.get(selectors[index]!)).toBe(index)
            }
            tree.set(gate, true)
            expect(evaluations.every(count => count === 2)).toBe(true)

            tree.set(left, 1)
            expect(evaluations.every(count => count === 2)).toBe(true)

            tree.set(right, 2)
            expect(evaluations.every(count => count === 3)).toBe(true)
            expect(tree.get(selectors[width - 1]!)).toBe(width + 1)
        }
    })

    test("settles upstream selector work before reverse-source-order downstream work", () => {
        const domain = createCommittedStoreTreeDomain()
        const left = domain.atom(0)
        const right = domain.atom(0)
        const tree = domain.createStoreTree()
        const evaluations = { upstream: 0, middle: 0, downstream: 0 }
        const upstream = domain.selector(get => {
            evaluations.upstream++
            return get(left) + 1
        })
        const middle = domain.selector(get => {
            evaluations.middle++
            return get(upstream) + 1
        })
        const downstream = domain.selector(get => {
            evaluations.downstream++
            return get(right) + get(middle)
        })

        expect(tree.get(downstream)).toBe(2)
        tree.txn(transaction => {
            transaction.set(right, 10)
            transaction.set(left, 1)
        })
        expect(evaluations).toEqual({
            upstream: 2,
            middle: 2,
            downstream: 2,
        })
        expect(tree.get(downstream)).toBe(13)
        expect(evaluations).toEqual({
            upstream: 2,
            middle: 2,
            downstream: 2,
        })
    })

    test("settles a newly selected dependency before a dynamic downstream read", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(0)
        const source = domain.atom(0)
        const tree = domain.createStoreTree()
        const evaluations = { leaf: 0, branch: 0, choice: 0, parent: 0 }
        const leaf = domain.selector(get => {
            evaluations.leaf++
            return get(source) + 1
        })
        const branch = domain.selector(get => {
            evaluations.branch++
            return get(leaf) + 1
        })
        const choice = domain.selector(get => {
            evaluations.choice++
            return get(gate) === 0 ? 0 : get(branch)
        })
        const parent = domain.selector(get => {
            evaluations.parent++
            return get(choice)
        })

        expect(tree.get(parent)).toBe(0)
        expect(tree.get(branch)).toBe(2)
        tree.txn(transaction => {
            transaction.set(gate, 1)
            transaction.set(source, 1)
        })
        expect(tree.get(parent)).toBe(3)
        expect(evaluations).toEqual({
            leaf: 2,
            branch: 2,
            choice: 2,
            parent: 2,
        })
        expect(tree.get(parent)).toBe(3)
        expect(evaluations).toEqual({
            leaf: 2,
            branch: 2,
            choice: 2,
            parent: 2,
        })
    })

    test("settles a new dependency closure before later fresh-session rewrites", () => {
        const domain = createCommittedStoreTreeDomain()
        const parentGate = domain.atom(false)
        const changedGate = domain.atom(false)
        const laterGate = domain.atom(false)
        const evaluations = {
            parent: 0,
            changed: 0,
            newEdge: 0,
            cached: 0,
            later: 0,
        }
        let parent!: Selector<number>
        let cached!: Selector<number>
        const changed = domain.selector(get => {
            evaluations.changed++
            return get(changedGate) ? get(cached) : 1
        })
        const newEdge = domain.selector(get => {
            evaluations.newEdge++
            return get(changed)
        })
        parent = domain.selector(get => {
            evaluations.parent++
            get(parentGate)
            return get(parentGate) ? get(newEdge) : 1
        })
        cached = domain.selector(get => {
            evaluations.cached++
            return get(parent)
        })
        const later = domain.selector(get => {
            evaluations.later++
            return get(laterGate) ? 1 : get(changed)
        })
        const tree = domain.createStoreTree()

        expect(tree.get(newEdge)).toBe(1)
        expect(tree.get(cached)).toBe(1)
        expect(tree.get(later)).toBe(1)

        tree.txn(transaction => {
            transaction.set(parentGate, true)
            transaction.set(changedGate, true)
            transaction.set(laterGate, true)
        })

        const error = thrownBy(() => tree.get(parent))
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            parent,
            newEdge,
            changed,
            cached,
            parent,
        ])
        expect(tree.get(later)).toBe(1)
        expect(evaluations).toEqual({
            parent: 2,
            changed: 2,
            newEdge: 1,
            cached: 1,
            later: 2,
        })
    })

    test("proves a warm parent's newly materialized selector edge", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(false)
        let parent!: Selector<number>
        let cached!: Selector<number>
        const fresh = domain.selector(get => get(cached))
        parent = domain.selector(get => (get(gate) ? get(fresh) : 1))
        cached = domain.selector(get => get(parent))
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(1)
        expect(tree.get(cached)).toBe(1)
        tree.set(gate, true)

        const error = thrownBy(() => tree.get(parent))
        expect(error).toBeInstanceOf(SelectorCircularDependencyError)
        expect((error as SelectorCircularDependencyError).path).toEqual([
            parent,
            fresh,
            cached,
            parent,
        ])
    })

    test("replaces dynamic reverse edges while equal selector values prune parents", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(true)
        const left = domain.atom(1)
        const right = domain.atom(1)
        let choiceEvaluations = 0
        let parentEvaluations = 0
        const choice = domain.selector(
            get => {
                choiceEvaluations++
                return Object.freeze({ value: get(get(gate) ? left : right) })
            },
            {
                equal: (previous, next) => previous.value === next.value,
            },
        )
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(choice).value
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(1)
        tree.set(gate, false)
        expect([choiceEvaluations, parentEvaluations]).toEqual([2, 1])

        tree.set(left, 2)
        expect([choiceEvaluations, parentEvaluations]).toEqual([2, 1])

        tree.set(right, 2)
        expect(tree.get(parent)).toBe(2)
        expect([choiceEvaluations, parentEvaluations]).toEqual([3, 2])
    })

    test("preserves established reaching order when selector dependencies stay unchanged", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const source = local.atom(0)
        const side = local.atom(0)
        const foreignAtom = foreign.atom(0)
        const tree = local.createStoreTree()
        const order: string[] = []
        const faults: unknown[] = []
        let faulting = false
        const readForeign = (label: string): void => {
            if (!faulting) return
            order.push(label)
            try {
                tree.get(foreignAtom)
            } catch (error) {
                faults.push(error)
            }
        }
        const first = local.selector(get => {
            const value = get(source)
            get(side)
            readForeign("first")
            return value
        })
        const second = local.selector(get => {
            const value = get(source)
            readForeign("second")
            return value
        })

        expect(tree.get(first)).toBe(0)
        expect(tree.get(second)).toBe(0)
        tree.set(side, 1)

        faulting = true
        const surfaced = thrownBy(() => tree.set(source, 1))

        expect(order).toEqual(["first", "second"])
        expect(faults).toHaveLength(2)
        expect(surfaced).toBe(faults[0])
        expect(faults[0]).toBeInstanceOf(RuntimeMismatchError)
        expect(faults[1]).toBeInstanceOf(RuntimeMismatchError)
        expect(thrownBy(() => tree.get(first))).toBe(faults[0])
        expect(thrownBy(() => tree.get(second))).toBe(faults[1])

        faulting = false
        tree.set(source, 2)
        expect(tree.get(first)).toBe(2)
        expect(tree.get(second)).toBe(2)
    })

    test("publishes ordinary selector errors and recovers through retained routing", () => {
        const domain = createCommittedStoreTreeDomain()
        const fail = domain.atom(false)
        const cause = new Error("getter failed")
        let childEvaluations = 0
        let parentEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            if (get(fail)) throw cause
            return 3
        })
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(child) + 1
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(4)
        expect(() => tree.set(fail, true)).not.toThrow()
        const firstError = thrownBy(() => tree.get(child))
        expect(firstError).toBeInstanceOf(SelectorGetterError)
        expect((firstError as SelectorGetterError).cause).toBe(cause)
        expect(thrownBy(() => tree.get(child))).toBe(firstError)
        expect(thrownBy(() => tree.get(parent))).toBeInstanceOf(
            SelectorGetterError,
        )

        tree.set(fail, false)
        expect(tree.get(parent)).toBe(4)
        expect([childEvaluations, parentEvaluations]).toEqual([3, 3])
    })

    test("keeps completed children when an active parent proposal fails", () => {
        const domain = createCommittedStoreTreeDomain()
        const leaf = domain.atom(2)
        let childEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            return get(leaf) * 2
        })
        const parent = domain.selector(get => {
            get(child)
            throw new Error("parent failed")
        })
        const tree = domain.createStoreTree()

        expect(thrownBy(() => tree.get(parent))).toBeInstanceOf(
            SelectorGetterError,
        )
        expect(tree.get(child)).toBe(4)
        expect(childEvaluations).toBe(1)
    })

    test("stores an acyclic attempted prefix and retries a dynamic cycle from it", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(false)
        let left!: Selector<number>
        let right!: Selector<number>
        left = domain.selector(get => (get(gate) ? get(right) : 1))
        right = domain.selector(get => get(left))
        const tree = domain.createStoreTree()

        expect(tree.get(right)).toBe(1)
        tree.set(gate, true)
        expect(thrownBy(() => tree.get(left))).toBeInstanceOf(
            SelectorCircularDependencyError,
        )

        tree.set(gate, false)
        expect(tree.get(right)).toBe(1)
    })

    test("rejects captured StoreTree operations without applying their work", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        let tree!: CommittedStoreTree
        const caught: unknown[] = []
        let updaterCalls = 0
        const caughtMutation = domain.selector(get => {
            try {
                tree.set(source, 99)
            } catch (error) {
                caught.push(error)
            }
            try {
                tree.update(source, current => {
                    updaterCalls++
                    return current + 1
                })
            } catch (error) {
                caught.push(error)
            }
            try {
                tree.reset(source)
            } catch (error) {
                caught.push(error)
            }
            return get(source)
        })
        const uncaughtMutation = domain.selector(() => {
            tree.set(source, 100)
            return 0
        })
        tree = domain.createStoreTree()

        expect(tree.get(caughtMutation)).toBe(1)
        expect(caught).toHaveLength(3)
        for (const error of caught) {
            expect(error).toMatchObject({
                name: "SelectorCapabilityError",
                code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
            })
        }
        expect(updaterCalls).toBe(0)
        expect(thrownBy(() => tree.get(uncaughtMutation))).toBeInstanceOf(
            SelectorGetterError,
        )
        expect(tree.get(source)).toBe(1)
    })

    test("shares callback quarantine across selector, comparator, and lazy hosts", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        const otherTreeTarget = domain.atom(0)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        let selectorGetError: unknown
        let selectorSetError: unknown
        let invalidGetError: unknown
        let createTreeError: unknown
        let comparatorSetError: unknown
        let comparatorUpdateError: unknown
        let comparatorResetError: unknown
        let lazySetError: unknown
        let lazyUpdateError: unknown
        let lazyResetError: unknown
        const atomComparatorErrors: unknown[] = []
        let otherLazyCalls = 0
        const otherLazy = domain.atomLazy(() => {
            otherLazyCalls++
            return 11
        })
        const derived = domain.selector(
            get => {
                try {
                    second.get(otherLazy)
                } catch (error) {
                    selectorGetError = error
                }
                try {
                    second.set(otherTreeTarget, 7)
                } catch (error) {
                    selectorSetError = error
                }
                try {
                    second.get({ kind: "atom" } as never)
                } catch (error) {
                    invalidGetError = error
                }
                try {
                    domain.createStoreTree()
                } catch (error) {
                    createTreeError = error
                }
                return get(source)
            },
            {
                equal: (previous, next) => {
                    try {
                        second.set(otherTreeTarget, 8)
                    } catch (error) {
                        comparatorSetError = error
                    }
                    try {
                        second.update(otherTreeTarget, current => current + 1)
                    } catch (error) {
                        comparatorUpdateError = error
                    }
                    try {
                        second.reset(otherTreeTarget)
                    } catch (error) {
                        comparatorResetError = error
                    }
                    return Object.is(previous, next)
                },
            },
        )
        const guardedLazy = domain.atomLazy(() => {
            try {
                second.set(otherTreeTarget, 9)
            } catch (error) {
                lazySetError = error
            }
            try {
                second.update(otherTreeTarget, current => current + 1)
            } catch (error) {
                lazyUpdateError = error
            }
            try {
                second.reset(otherTreeTarget)
            } catch (error) {
                lazyResetError = error
            }
            return 3
        })
        const guardedAtom = domain.atom(0, {
            equal: () => {
                for (const operation of [
                    () =>
                        second.update(otherTreeTarget, current => current + 1),
                    () => second.reset(otherTreeTarget),
                ]) {
                    try {
                        operation()
                    } catch (error) {
                        atomComparatorErrors.push(error)
                    }
                }
                return false
            },
        })

        expect(first.get(derived)).toBe(1)
        expect(selectorGetError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(selectorSetError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(invalidGetError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(createTreeError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(otherLazyCalls).toBe(0)
        expect(second.get(otherTreeTarget)).toBe(0)

        first.set(source, 2)
        expect(first.get(derived)).toBe(2)
        expect(comparatorSetError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(comparatorUpdateError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(comparatorResetError).toMatchObject({
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(second.get(otherTreeTarget)).toBe(0)

        first.reset(guardedLazy)
        expect(first.get(guardedLazy)).toBe(3)
        expect(lazySetError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(lazyUpdateError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        expect(lazyResetError).toMatchObject({
            code: "VALDRES_CALLBACK_CAPABILITY",
        })
        first.set(guardedAtom, 1)
        expect(atomComparatorErrors).toHaveLength(2)
        for (const error of atomComparatorErrors) {
            expect(error).toMatchObject({
                code: "VALDRES_CALLBACK_CAPABILITY",
            })
        }
        expect(second.get(otherTreeTarget)).toBe(0)
    })

    test("keeps owner mismatches nonpublishing before apply and authoritative after apply", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        let foreignInitializerCalls = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignInitializerCalls++
            return 7
        })
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()

        expect(Object.keys(tree)).toEqual([
            "get",
            "sub",
            "set",
            "update",
            "reset",
            "txn",
            "scope",
            "dispose",
        ])
        expect("domain" in tree).toBe(false)
        expect(Object.getOwnPropertyNames(Object.getPrototypeOf(tree))).toEqual(
            ["constructor"],
        )
        expect((tree as CommittedStoreTree & { serve?: unknown }).serve).toBe(
            undefined,
        )

        const impostor = Object.freeze({ kind: "atom" })
        const impostorGetError = thrownBy(() => tree.get(impostor as never))
        expect(impostorGetError).toBeInstanceOf(TypeError)
        expect(impostorGetError).not.toBeInstanceOf(RuntimeMismatchError)
        const impostorSetError = thrownBy(() =>
            tree.set(impostor as never, 1 as never),
        )
        expect(impostorSetError).toBeInstanceOf(TypeError)
        expect(impostorSetError).not.toBeInstanceOf(RuntimeMismatchError)
        const impostorUpdateError = thrownBy(() =>
            tree.update(impostor as never, (() => 1) as never),
        )
        expect(impostorUpdateError).toBeInstanceOf(TypeError)
        expect(impostorUpdateError).not.toBeInstanceOf(RuntimeMismatchError)
        const impostorResetError = thrownBy(() => tree.reset(impostor as never))
        expect(impostorResetError).toBeInstanceOf(TypeError)
        expect(impostorResetError).not.toBeInstanceOf(RuntimeMismatchError)

        const brandedImpostor = { kind: "atom" }
        Object.defineProperty(
            brandedImpostor,
            Symbol.for("valdres.runtime-owner/v1"),
            { value: Object.freeze({}) },
        )
        expect(
            thrownBy(() => tree.get(Object.freeze(brandedImpostor) as never)),
        ).toBeInstanceOf(RuntimeMismatchError)

        expect(thrownBy(() => tree.get(foreignAtom))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        let foreignUpdaterCalls = 0
        expect(
            thrownBy(() =>
                tree.update(foreignAtom, (() => {
                    foreignUpdaterCalls++
                    return 8
                }) as never),
            ),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(
            thrownBy(() => tree.update(foreignAtom, 1 as never)),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(thrownBy(() => tree.reset(foreignAtom))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(foreignUpdaterCalls).toBe(0)
        expect(foreignInitializerCalls).toBe(0)

        let includeForeign = true
        let preApplyEvaluations = 0
        const preApply = local.selector(() => {
            preApplyEvaluations++
            if (includeForeign) {
                try {
                    sibling.get(foreignAtom)
                } catch {}
            }
            return 1
        })
        expect(thrownBy(() => tree.get(preApply))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        includeForeign = false
        expect(tree.get(preApply)).toBe(1)
        expect(preApplyEvaluations).toBe(2)

        const trigger = local.atom(0)
        let contaminate = false
        let postApplyEvaluations = 0
        const postApply = local.selector(get => {
            postApplyEvaluations++
            const value = get(trigger)
            if (contaminate) {
                try {
                    sibling.get(foreignAtom)
                } catch {}
            }
            return value
        })
        expect(tree.get(postApply)).toBe(0)

        contaminate = true
        const commitError = thrownBy(() => tree.set(trigger, 1))
        expect(commitError).toBeInstanceOf(RuntimeMismatchError)
        expect(tree.get(trigger)).toBe(1)
        expect(thrownBy(() => tree.get(postApply))).toBe(commitError)
        expect(postApplyEvaluations).toBe(2)

        contaminate = false
        tree.set(trigger, 2)
        expect(tree.get(postApply)).toBe(2)
        expect(postApplyEvaluations).toBe(3)
    })

    test("is the only runtime reachable from the reviewed package entrypoints", () => {
        const packageRoot = resolve(import.meta.dir, "../..")
        const manifest = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        ) as { readonly exports: Readonly<Record<string, unknown>> }
        expect(JSON.stringify(manifest.exports)).not.toContain("v1-internal")

        const exportedSources = collectStrings(manifest.exports)
            .filter(path => path.endsWith(".ts") || path.endsWith(".tsx"))
            .map(path => resolve(packageRoot, path))
        expect(exportedSources).toHaveLength(3)

        const runtimeEntrypoints = [".", "./adapter-internals/v1"].flatMap(
            subpath =>
                collectStrings(manifest.exports[subpath])
                    .filter(
                        path => path.endsWith(".ts") || path.endsWith(".tsx"),
                    )
                    .map(path => resolve(packageRoot, path)),
        )
        expect(runtimeEntrypoints).toHaveLength(2)
        const equalityEntrypoints = collectStrings(
            manifest.exports["./equality"],
        )
            .filter(path => path.endsWith(".ts") || path.endsWith(".tsx"))
            .map(path => resolve(packageRoot, path))
        expect(equalityEntrypoints).toHaveLength(1)

        const reachable = collectRuntimeSourceGraph(
            runtimeEntrypoints,
            packageRoot,
        )
        expect(reachable.size).toBeGreaterThan(10)
        expect(
            [...reachable].map(path => relative(packageRoot, path)),
        ).not.toContain("src/equality.ts")
        const v1Runtime = [...reachable]
            .filter(path => path.includes("/src/v1-internal/"))
            .map(path => relative(packageRoot, path))
        expect(v1Runtime).toContain("src/v1-internal/public-domain.ts")
        expect(v1Runtime).toContain(
            "src/v1-internal/committed-store-tree/committed-store-tree.ts",
        )
        expect(v1Runtime).toContain(
            "src/v1-internal/selector-evaluator/evaluate.ts",
        )
        expect(
            [...reachable].filter(path => path.includes("/src/lib/")),
        ).toEqual([])

        expect(
            [
                ...collectRuntimeSourceGraph(equalityEntrypoints, packageRoot),
            ].map(path => relative(packageRoot, path)),
        ).toEqual(["src/equality.ts"])
    })
})

const collectStrings = (value: unknown): readonly string[] => {
    if (typeof value === "string") return [value]
    if (Array.isArray(value)) return value.flatMap(collectStrings)
    if (value === null || typeof value !== "object") return []
    return Object.values(value).flatMap(collectStrings)
}

const collectRuntimeSourceGraph = (
    entrypoints: readonly string[],
    packageRoot: string,
): ReadonlySet<string> => {
    const typeScriptTranspiler = new Bun.Transpiler({ loader: "ts" })
    const tsxTranspiler = new Bun.Transpiler({ loader: "tsx" })
    const pending = entrypoints.map(entrypoint => realpathSync(entrypoint))
    const visited = new Set<string>()

    while (pending.length > 0) {
        const path = pending.pop()!
        if (visited.has(path)) continue
        visited.add(path)
        const source = readFileSync(path, "utf8")
        const transpiler = path.endsWith(".tsx")
            ? tsxTranspiler
            : typeScriptTranspiler
        let imports: ReturnType<typeof transpiler.scanImports>
        try {
            imports = transpiler.scanImports(source)
        } catch (error) {
            throw new Error(`Failed to scan ${relative(packageRoot, path)}`, {
                cause: error,
            })
        }
        for (const imported of imports) {
            if (!imported.path.startsWith(".")) continue
            const resolved = resolveSourceImport(path, imported.path)
            if (resolved === undefined) continue
            const relativePath = relative(packageRoot, resolved)
            expect(relativePath.startsWith("..")).toBe(false)
            if (!visited.has(resolved)) pending.push(resolved)
        }
    }
    return visited
}

const resolveSourceImport = (
    importer: string,
    specifier: string,
): string | undefined => {
    const unresolved = resolve(dirname(importer), specifier)
    for (const candidate of [
        unresolved,
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        `${unresolved}.js`,
        join(unresolved, "index.ts"),
        join(unresolved, "index.tsx"),
    ]) {
        if (!existsSync(candidate) || !statSync(candidate).isFile()) continue
        if (![".ts", ".tsx", ".js"].includes(extname(candidate))) continue
        return realpathSync(candidate)
    }
    return undefined
}
