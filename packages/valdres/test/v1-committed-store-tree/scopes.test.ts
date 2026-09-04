import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    InvalidTransactionTargetError,
    RuntimeMismatchError,
    ScopeNotFoundError,
    SelectorCapabilityError,
    StoreDisposedError,
    StoreTreeMismatchError,
    TransactionClosedError,
    TransactionPhaseError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type Atom,
    type CommittedStoreTree,
    type RootTransaction,
    type Selector,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { WeakHandleSet } from "../../src/v1-internal/committed-store-tree/scope-node"
import { createReferenceModel, value } from "../v1-model"
import type {
    Mutation,
    TransactionStep,
    ValueToken,
} from "../v1-model/protocol"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const counterHarness = (): Readonly<{
    instrumentation: ReturnType<typeof createInternalStoreTreeInstrumentation>
    read(name: string): number
}> => {
    const instrumentation = createInternalStoreTreeInstrumentation()
    return Object.freeze({
        instrumentation,
        read: (name: string): number =>
            instrumentation.read(
                name as Parameters<typeof instrumentation.read>[0],
            ),
    })
}

describe("v1 scope-keyed committed StoreTree host", () => {
    test("keeps named identity parent-local and anonymous identity fresh without lookup allocation", () => {
        const counters = counterHarness()
        const local = createCommittedStoreTreeDomain(counters.instrumentation)
        const foreign = createCommittedStoreTreeDomain()
        const root = local.createStoreTree()

        expect(counters.read("scopeNodesCreated")).toBe(1)
        expect(counters.read("storeFacadesCreated")).toBe(1)
        const named = root.scope("draft")
        for (let index = 0; index < 99_999; index++) {
            expect(root.scope("draft")).toBe(named)
        }
        expect(counters.read("namedScopeMisses")).toBe(1)
        expect(counters.read("namedScopeHits")).toBe(99_999)
        expect(counters.read("scopeNodesCreated")).toBe(2)
        expect(counters.read("storeFacadesCreated")).toBe(2)

        const anonymousOne = root.scope()
        const anonymousTwo = root.scope()
        expect(anonymousOne).not.toBe(anonymousTwo)
        expect(Object.isFrozen(anonymousOne)).toBe(true)
        expect(root.scope("")).toBe(root.scope(""))
        expect(named.scope("shared")).not.toBe(anonymousOne.scope("shared"))

        let callbackCalls = 0
        expect(
            thrownBy(() =>
                (
                    root.scope as unknown as (
                        id: string,
                        callback: () => void,
                    ) => CommittedStoreTree
                )("callback-form", () => {
                    callbackCalls++
                }),
            ),
        ).toBeInstanceOf(TypeError)
        expect(callbackCalls).toBe(0)
        expect(counters.read("namedScopeMisses")).toBe(4)
        root.scope("callback-form")
        expect(counters.read("namedScopeMisses")).toBe(5)
        if (false) {
            // @ts-expect-error Store.scope deliberately has no callback form.
            root.scope("typed-callback", () => undefined)
        }

        expect(
            thrownBy(() =>
                (root.scope as (id: unknown) => CommittedStoreTree)(undefined),
            ),
        ).toBeInstanceOf(TypeError)
        const foreignStore = foreign.createStoreTree()
        expect(
            thrownBy(() =>
                (root.scope as (id: unknown) => CommittedStoreTree)(
                    foreignStore,
                ),
            ),
        ).toBeInstanceOf(RuntimeMismatchError)
    })

    test("releases scalar one-intent drafts behind retained closed cursors", async () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        let committedCursor!: RootTransaction
        let abortedCursor!: RootTransaction
        const storageBefore = counters.read("draftStorageAllocations")
        const committed = (() => {
            const scope = root.scope()
            const reference = new WeakRef(scope as object)
            root.txn(transaction => {
                committedCursor = transaction
                transaction.scope(scope).set(count, 1)
            })
            return reference
        })()
        const abort = new Error("abort scalar anonymous scope draft")
        const aborted = (() => {
            const scope = root.scope()
            const reference = new WeakRef(scope as object)
            expect(
                thrownBy(() =>
                    root.txn(transaction => {
                        abortedCursor = transaction
                        transaction.scope(scope).set(count, 2)
                        throw abort
                    }),
                ),
            ).toBe(abort)
            return reference
        })()
        expect(counters.read("draftStorageAllocations")).toBe(storageBefore)

        const references = [committed, aborted]
        let retained = references.length
        for (let round = 0; round < 20 && retained !== 0; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
            retained = references.filter(
                reference => reference.deref() !== undefined,
            ).length
        }
        expect(retained).toBe(0)
        expect(thrownBy(() => committedCursor.get(count))).toBeInstanceOf(
            TransactionClosedError,
        )
        expect(thrownBy(() => abortedCursor.get(count))).toBeInstanceOf(
            TransactionClosedError,
        )

        const compactionsBefore = counters.read("deadRouteCompactions")
        root.dispose()
        expect(
            counters.read("deadRouteCompactions") - compactionsBefore,
        ).toBeGreaterThanOrEqual(2)
    })

    test("does not retain promoted multi-scope drafts through topology or closed cursors", async () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        let committedCursor!: RootTransaction
        let abortedCursor!: RootTransaction
        const committed = (() => {
            const first = root.scope()
            const second = root.scope()
            const references = [
                new WeakRef(first as object),
                new WeakRef(second as object),
            ]
            root.txn(transaction => {
                committedCursor = transaction
                transaction.scope(first).set(count, 1)
                transaction.scope(second).set(count, 2)
            })
            return references
        })()
        const abort = new Error("abort anonymous scope draft")
        const aborted = (() => {
            const first = root.scope()
            const second = root.scope()
            const references = [
                new WeakRef(first as object),
                new WeakRef(second as object),
            ]
            expect(
                thrownBy(() =>
                    root.txn(transaction => {
                        abortedCursor = transaction
                        transaction.scope(first).set(count, 3)
                        transaction.scope(second).set(count, 4)
                        throw abort
                    }),
                ),
            ).toBe(abort)
            return references
        })()

        const references = [...committed, ...aborted]
        let retained = references.length
        for (let round = 0; round < 20 && retained !== 0; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
            retained = references.filter(
                reference => reference.deref() !== undefined,
            ).length
        }
        expect(retained).toBe(0)
        expect(thrownBy(() => committedCursor.get(count))).toBeInstanceOf(
            TransactionClosedError,
        )
        expect(thrownBy(() => abortedCursor.get(count))).toBeInstanceOf(
            TransactionClosedError,
        )

        const compactionsBefore = counters.read("deadRouteCompactions")
        root.dispose()
        expect(
            counters.read("deadRouteCompactions") - compactionsBefore,
        ).toBeGreaterThanOrEqual(4)
    })

    test("keeps weak handles ordered and removable while abandoned selector routes compact", async () => {
        let directCompactions = 0
        const handles = new WeakHandleSet<object>(() => {
            directCompactions++
        })
        const first = Object.freeze({ id: "first" })
        const second = Object.freeze({ id: "second" })
        const third = Object.freeze({ id: "third" })
        handles.add(first)
        handles.add(second)
        handles.add(first)
        handles.delete(second)
        handles.add(third)
        handles.add(second)
        const abandonedHandle = (() => {
            const abandoned = Object.freeze({ id: "abandoned" })
            handles.add(abandoned)
            return new WeakRef(abandoned as object)
        })()
        let emptyCompactions = 0
        const deadOnlyHandles = new WeakHandleSet<object>(() => {
            emptyCompactions++
        })
        const deadOnlyReference = (() => {
            const abandoned = Object.freeze({ id: "dead-only" })
            deadOnlyHandles.add(abandoned)
            return new WeakRef(abandoned as object)
        })()

        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const source = domain.atom(0)
        const root = domain.createStoreTree()
        let selectorEvaluations = 0
        const abandonedSelector = (() => {
            const selector = domain.selector(get => {
                selectorEvaluations++
                return get(source)
            })
            expect(root.get(selector)).toBe(0)
            return new WeakRef(selector as object)
        })()

        let retained = 3
        for (let round = 0; round < 20 && retained !== 0; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
            retained = [
                abandonedHandle,
                abandonedSelector,
                deadOnlyReference,
            ].filter(reference => reference.deref() !== undefined).length
        }
        expect(retained).toBe(0)
        expect(deadOnlyHandles.isEmpty()).toBe(true)
        expect(emptyCompactions).toBe(1)

        const visited: object[] = []
        handles.forEach(value => visited.push(value))
        expect(visited).toEqual([first, third, second])
        expect(directCompactions).toBe(1)
        visited.length = 0
        handles.forEach(value => visited.push(value))
        expect(visited).toEqual([first, third, second])
        expect(directCompactions).toBe(1)
        handles.delete(first)
        handles.delete(first)
        expect(handles.isEmpty()).toBe(false)
        handles.clear()
        expect(handles.isEmpty()).toBe(true)

        let emptinessProbes = 0
        const scaledHandles = new WeakHandleSet<object>(undefined, () => {
            emptinessProbes++
        })
        const retainedHandles = Array.from({ length: 4_096 }, (_, index) =>
            Object.freeze({ index }),
        )
        for (const handle of retainedHandles) scaledHandles.add(handle)
        for (let index = 0; index < retainedHandles.length; index++) {
            scaledHandles.delete(retainedHandles[index] as object)
            expect(scaledHandles.isEmpty()).toBe(
                index === retainedHandles.length - 1,
            )
        }
        expect(emptinessProbes).toBe(retainedHandles.length - 1)

        const routeCompactionsBefore = counters.read("deadRouteCompactions")
        root.set(source, 1)
        expect(selectorEvaluations).toBe(1)
        expect(
            counters.read("deadRouteCompactions") - routeCompactionsBefore,
        ).toBe(1)

        const visitsBeforeChurn = counters.read("disposalVisits")
        for (let index = 0; index < 10_000; index++) {
            root.scope().dispose()
        }
        expect(counters.read("disposalVisits") - visitsBeforeChurn).toBe(10_000)
        const visitsBeforeRoot = counters.read("disposalVisits")
        root.dispose()
        expect(counters.read("disposalVisits") - visitsBeforeRoot).toBe(1)
    })

    test("bounds weak-handle traversal by underlying reference probes", () => {
        const handles = new WeakHandleSet<object>()
        const retained = Array.from({ length: 100_000 }, (_, index) => ({
            index,
        }))
        for (const handle of retained) handles.add(handle)

        const budget = { remaining: 128 }
        let visited = 0
        expect(
            handles.visitWithin(budget, () => {
                visited++
                return true
            }),
        ).toBe(false)
        expect(visited).toBe(128)
        expect(budget.remaining).toBe(0)
    })

    test("keeps inheritance live while equal shadow and reset change only routing", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const grandchild = child.scope("grandchild")
        const sibling = root.scope("sibling")
        let grandchildEvaluations = 0
        const doubled = domain.selector(get => {
            grandchildEvaluations++
            return get(count) * 2
        })

        expect(root.get(count)).toBe(0)
        expect(child.get(count)).toBe(0)
        expect(grandchild.get(doubled)).toBe(0)
        expect(sibling.get(count)).toBe(0)
        expect(counters.read("routeAdds")).toBe(3)

        const removesBeforeShadow = counters.read("routeRemoves")
        const epochBeforeShadow = counters.read("sourceEpoch")
        child.set(count, 0)
        expect(counters.read("routeRemoves") - removesBeforeShadow).toBe(1)
        expect(counters.read("sourceEpoch") - epochBeforeShadow).toBe(1)
        expect(grandchildEvaluations).toBe(1)

        const visitsBeforePrunedWrite = counters.read("routeVisits")
        root.set(count, 1)
        expect(child.get(count)).toBe(0)
        expect(grandchild.get(doubled)).toBe(0)
        expect(sibling.get(count)).toBe(1)
        expect(counters.read("routeVisits") - visitsBeforePrunedWrite).toBe(1)
        expect(grandchildEvaluations).toBe(1)

        root.set(count, 0)
        const addsBeforeReset = counters.read("routeAdds")
        const epochBeforeReset = counters.read("sourceEpoch")
        child.reset(count)
        expect(counters.read("routeAdds") - addsBeforeReset).toBe(1)
        expect(counters.read("sourceEpoch") - epochBeforeReset).toBe(1)
        expect(grandchildEvaluations).toBe(1)

        const epochBeforeIdempotentReset = counters.read("sourceEpoch")
        child.reset(count)
        expect(counters.read("sourceEpoch")).toBe(epochBeforeIdempotentReset)
        expect(counters.read("routeAdds") - addsBeforeReset).toBe(1)

        const visitsBeforeInheritedWrite = counters.read("routeVisits")
        root.set(count, 2)
        expect(grandchild.get(doubled)).toBe(4)
        expect(counters.read("routeVisits") - visitsBeforeInheritedWrite).toBe(
            3,
        )
        expect(grandchildEvaluations).toBe(2)
    })

    test("keeps inherited work proportional and reports exact structural deltas", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        let fallbackCalls = 0
        const fallbackOnly = domain.atomLazy(() => ++fallbackCalls)
        const count = domain.atom(0)
        const untouched = domain.atom(0)
        const inlineLeft = domain.atom(0)
        const inlineRight = domain.atom(0)
        const root = domain.createStoreTree()

        const epochBeforeFallback = counters.read("sourceEpoch")
        const publicationsBeforeFallback = counters.read("fallbackPublications")
        expect(root.reset(fallbackOnly)).toBeUndefined()
        expect(fallbackCalls).toBe(1)
        expect(counters.read("fallbackPublications")).toBe(
            publicationsBeforeFallback + 1,
        )
        expect(counters.read("sourceEpoch")).toBe(epochBeforeFallback)
        root.reset(fallbackOnly)
        expect(fallbackCalls).toBe(1)
        expect(counters.read("fallbackPublications")).toBe(
            publicationsBeforeFallback + 1,
        )
        expect(counters.read("sourceEpoch")).toBe(epochBeforeFallback)

        expect(root.get(count)).toBe(0)
        const idleScopes: CommittedStoreTree[] = []
        for (let index = 0; index < 10_000; index++) {
            idleScopes.push(root.scope())
        }
        const visitsBeforeIdleWrite = counters.read("routeVisits")
        root.set(count, 1)
        expect(counters.read("routeVisits")).toBe(visitsBeforeIdleWrite)

        let evaluations = 0
        const derived = domain.selector(get => {
            evaluations++
            return get(count)
        })
        for (let index = 0; index < 64; index++) {
            expect(idleScopes[index]!.get(derived)).toBe(1)
        }
        const visitsBeforeFanout = counters.read("routeVisits")
        const settlementsBeforeFanout = counters.read("propagationSettlements")
        const evaluationsBeforeFanout = evaluations
        root.set(count, 2)
        expect(counters.read("routeVisits") - visitsBeforeFanout).toBe(64)
        expect(
            counters.read("propagationSettlements") - settlementsBeforeFanout,
        ).toBe(1)
        expect(evaluations - evaluationsBeforeFanout).toBe(64)

        let deepest = root
        for (let depth = 0; depth < 256; depth++) {
            deepest = deepest.scope()
        }
        const hopsBeforeColdRead = counters.read("warmParentHops")
        const routeAddsBeforeColdRead = counters.read("routeAdds")
        expect(deepest.get(count)).toBe(2)
        expect(counters.read("warmParentHops") - hopsBeforeColdRead).toBe(256)
        expect(counters.read("routeAdds") - routeAddsBeforeColdRead).toBe(256)
        const hopsBeforeWarmRead = counters.read("warmParentHops")
        const routeAddsBeforeWarmRead = counters.read("routeAdds")
        expect(deepest.get(count)).toBe(2)
        expect(counters.read("warmParentHops")).toBe(hopsBeforeWarmRead)
        expect(counters.read("routeAdds")).toBe(routeAddsBeforeWarmRead)

        expect(root.get(inlineLeft)).toBe(0)
        expect(root.get(inlineRight)).toBe(0)
        const inlineDraftStorageBefore = counters.read(
            "draftStorageAllocations",
        )
        const inlineCommitWorksetsBefore = counters.read(
            "commitWorksetAllocations",
        )
        const inlinePreflightBefore = counters.read("finalPreflightVisits")
        const inlineResolutionBefore = counters.read("finalResolutionVisits")
        root.txn(transaction => {
            transaction.set(inlineLeft, 1)
            transaction.set(inlineRight, 2)
        })
        expect(root.get(inlineLeft)).toBe(1)
        expect(root.get(inlineRight)).toBe(2)
        expect(counters.read("draftStorageAllocations")).toBe(
            inlineDraftStorageBefore,
        )
        expect(counters.read("commitWorksetAllocations")).toBe(
            inlineCommitWorksetsBefore,
        )
        expect(
            counters.read("finalPreflightVisits") - inlinePreflightBefore,
        ).toBe(2)
        expect(
            counters.read("finalResolutionVisits") - inlineResolutionBefore,
        ).toBe(2)

        const scratchHostsBefore = counters.read("scratchHostAllocations")
        const scratchMapsBefore = counters.read("scratchMapAllocations")
        const draftsBefore = counters.read("draftCreations")
        const draftStorageBefore = counters.read("draftStorageAllocations")
        const commitWorksetsBefore = counters.read("commitWorksetAllocations")
        root.set(untouched, 10)
        expect(counters.read("draftStorageAllocations")).toBe(
            draftStorageBefore,
        )
        expect(counters.read("commitWorksetAllocations")).toBe(
            commitWorksetsBefore,
        )
        root.txn(transaction => {
            for (let index = 0; index < 8; index++) {
                transaction.scope(idleScopes[index]!).set(untouched, index)
            }
        })
        expect(counters.read("scratchHostAllocations")).toBe(scratchHostsBefore)
        expect(counters.read("scratchMapAllocations")).toBe(scratchMapsBefore)
        expect(counters.read("draftCreations") - draftsBefore).toBe(2)
        expect(
            counters.read("draftStorageAllocations") - draftStorageBefore,
        ).toBe(18)
        expect(
            counters.read("commitWorksetAllocations") - commitWorksetsBefore,
        ).toBe(2)

        const subtree = root.scope()
        let descendant = subtree
        for (let index = 1; index < 10_000; index++) {
            descendant = descendant.scope()
        }
        const disposalVisitsBefore = counters.read("disposalVisits")
        subtree.dispose()
        expect(counters.read("disposalVisits") - disposalVisitsBefore).toBe(
            10_000,
        )
        expect(thrownBy(() => descendant.get(count))).toBeInstanceOf(
            StoreDisposedError,
        )
        expect(root.get(count)).toBe(2)
    })

    test("materializes and settles deep inherited Atom routes iteratively in linear work", () => {
        for (const depth of [2_000, 4_000, 8_000, 20_000]) {
            const counters = counterHarness()
            const domain = createCommittedStoreTreeDomain(
                counters.instrumentation,
            )
            const count = domain.atom(0)
            const resetOnly = domain.atom(-1)
            const root = domain.createStoreTree()
            let deepest = root
            for (let index = 0; index < depth; index++) {
                deepest = deepest.scope()
            }

            const coldHops = counters.read("warmParentHops")
            const coldRouteAdds = counters.read("routeAdds")
            expect(deepest.get(count)).toBe(0)
            expect(counters.read("warmParentHops") - coldHops).toBe(depth)
            expect(counters.read("routeAdds") - coldRouteAdds).toBe(depth)

            const routeVisits = counters.read("routeVisits")
            const finalResolutionVisits = counters.read("finalResolutionVisits")
            root.set(count, depth)
            expect(counters.read("routeVisits") - routeVisits).toBe(depth)
            expect(
                counters.read("finalResolutionVisits") - finalResolutionVisits,
            ).toBe(depth + 1)
            expect(deepest.get(count)).toBe(depth)

            const warmHops = counters.read("warmParentHops")
            expect(deepest.get(count)).toBe(depth)
            expect(counters.read("warmParentHops")).toBe(warmHops)

            deepest.set(resetOnly, depth)
            expect(deepest.get(resetOnly)).toBe(depth)
            const resetRouteAdds = counters.read("routeAdds")
            deepest.reset(resetOnly)
            expect(counters.read("routeAdds") - resetRouteAdds).toBe(depth)
            expect(deepest.get(resetOnly)).toBe(-1)
        }
    })

    test("prunes deep inherited routes at a final equal owner", () => {
        for (const depth of [1_000, 4_000, 8_000]) {
            const counters = counterHarness()
            const domain = createCommittedStoreTreeDomain(
                counters.instrumentation,
            )
            const count = domain.atom(0)
            const root = domain.createStoreTree()
            const child = root.scope()
            let deepest = child
            for (let index = 1; index < depth; index++) {
                deepest = deepest.scope()
            }
            expect(deepest.get(count)).toBe(0)

            const routeVisits = counters.read("routeVisits")
            const finalResolutionVisits = counters.read("finalResolutionVisits")
            const finalPreflightVisits = counters.read("finalPreflightVisits")
            const routeRemoves = counters.read("routeRemoves")
            root.txn(transaction => {
                transaction.set(count, 1)
                transaction.scope(child).set(count, 0)
            })

            expect(counters.read("routeVisits") - routeVisits).toBe(1)
            expect(
                counters.read("finalResolutionVisits") - finalResolutionVisits,
            ).toBe(1)
            expect(
                counters.read("finalPreflightVisits") - finalPreflightVisits,
            ).toBe(2)
            expect(counters.read("routeRemoves") - routeRemoves).toBe(1)
            expect(root.get(count)).toBe(1)
            expect(child.get(count)).toBe(0)
            expect(deepest.get(count)).toBe(0)
        }
    })

    test("restarts affected-route collection at a changed source below a pruned owner", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope()
        const changed = child.scope()
        const leaf = changed.scope()
        expect(leaf.get(count)).toBe(0)

        const routeVisits = counters.read("routeVisits")
        const finalResolutionVisits = counters.read("finalResolutionVisits")
        root.txn(transaction => {
            transaction.set(count, 1)
            transaction.scope(child).set(count, 0)
            transaction.scope(changed).set(count, 2)
        })

        expect(counters.read("routeVisits") - routeVisits).toBe(2)
        expect(
            counters.read("finalResolutionVisits") - finalResolutionVisits,
        ).toBe(3)
        expect(root.get(count)).toBe(1)
        expect(child.get(count)).toBe(0)
        expect(changed.get(count)).toBe(2)
        expect(leaf.get(count)).toBe(2)
    })

    test("memoizes final preflight across a deep symbolic-reset transaction", () => {
        const depth = 4_096
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const scopes: CommittedStoreTree[] = [root]
        for (let index = 0; index < depth; index++) {
            scopes.push(scopes[index]!.scope())
        }

        root.txn(transaction => {
            transaction.set(count, 1)
            for (let index = 1; index < scopes.length; index++) {
                transaction.scope(scopes[index]!).set(count, index + 1)
            }
        })
        expect(scopes[depth]!.get(count)).toBe(depth + 1)

        const preflightVisits = counters.read("finalPreflightVisits")
        const scratchHosts = counters.read("scratchHostAllocations")
        const scratchMaps = counters.read("scratchMapAllocations")
        root.txn(transaction => {
            for (let index = depth; index > 0; index--) {
                transaction.scope(scopes[index]!).reset(count)
            }
            transaction.reset(count)
        })
        expect(counters.read("finalPreflightVisits") - preflightVisits).toBe(
            depth + 1,
        )
        expect(counters.read("scratchHostAllocations")).toBe(scratchHosts)
        expect(counters.read("scratchMapAllocations")).toBe(scratchMaps)
        expect(scopes[depth]!.get(count)).toBe(0)
    })

    test("keeps selector records scope-qualified and settles all sources before derived work", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const left = domain.atom(0)
        const right = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")
        const observations: [number, number][] = []
        const pair = domain.selector(get => {
            const current: [number, number] = [get(left), get(right)]
            observations.push(current)
            return Object.freeze(current)
        })

        for (const store of [root, child, sibling]) {
            expect(store.get(pair)).toEqual([0, 0])
        }

        const settlementsBefore = counters.read("propagationSettlements")
        root.txn(transaction => {
            transaction.set(left, 1)
            transaction.set(right, 2)
            const childCursor = transaction.scope(child)
            childCursor.set(left, 3)
            childCursor.set(right, 4)
        })
        expect(
            counters.read("propagationSettlements") - settlementsBefore,
        ).toBe(1)

        expect(root.get(pair)).toEqual([1, 2])
        expect(child.get(pair)).toEqual([3, 4])
        expect(sibling.get(pair)).toEqual([1, 2])
        expect(observations).toEqual([
            [0, 0],
            [0, 0],
            [0, 0],
            [1, 2],
            [3, 4],
            [1, 2],
        ])
    })

    test("keeps equal-comparator dynamic branches independent across root, child, and sibling records", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(false)
        const left = domain.atom(10)
        const right = domain.atom(20)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")
        child.set(gate, true)
        child.set(left, 30)
        child.set(right, 30)
        sibling.set(left, 40)
        sibling.set(right, 50)

        const evaluations = { choice: 0, parent: 0 }
        const choice = domain.selector(
            get => {
                evaluations.choice++
                return get(gate) ? get(right) : get(left)
            },
            { equal: Object.is },
        )
        const parent = domain.selector(get => {
            evaluations.parent++
            return get(choice)
        })

        expect(root.get(parent)).toBe(10)
        expect(child.get(parent)).toBe(30)
        expect(sibling.get(parent)).toBe(40)
        expect(evaluations).toEqual({ choice: 3, parent: 3 })

        child.set(gate, false)
        expect(child.get(parent)).toBe(30)
        expect(root.get(parent)).toBe(10)
        expect(sibling.get(parent)).toBe(40)
        expect(evaluations).toEqual({ choice: 4, parent: 3 })

        child.set(right, 31)
        expect(child.get(parent)).toBe(30)
        expect(evaluations).toEqual({ choice: 4, parent: 3 })

        child.set(left, 32)
        expect(child.get(parent)).toBe(32)
        expect(root.get(parent)).toBe(10)
        expect(sibling.get(parent)).toBe(40)
        expect(evaluations).toEqual({ choice: 5, parent: 4 })
    })

    test("settles reverse-source-order selector chains once per affected scope while pruning equal intermediates", () => {
        const domain = createCommittedStoreTreeDomain()
        const left = domain.atom(0)
        const right = domain.atom(0)
        const prunedSource = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const evaluations = {
            upstream: 0,
            middle: 0,
            downstream: 0,
            pruned: 0,
            prunedParent: 0,
        }
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
        const pruned = domain.selector(get => {
            evaluations.pruned++
            get(prunedSource)
            return 0
        })
        const prunedParent = domain.selector(get => {
            evaluations.prunedParent++
            return get(pruned)
        })

        for (const store of [root, child]) {
            expect(store.get(downstream)).toBe(2)
            expect(store.get(prunedParent)).toBe(0)
        }
        root.txn(transaction => {
            transaction.set(right, 10)
            transaction.set(left, 1)
            transaction.set(prunedSource, 1)
        })
        expect(evaluations).toEqual({
            upstream: 4,
            middle: 4,
            downstream: 4,
            pruned: 4,
            prunedParent: 2,
        })
        expect(root.get(downstream)).toBe(13)
        expect(child.get(downstream)).toBe(13)
        expect(root.get(prunedParent)).toBe(0)
        expect(child.get(prunedParent)).toBe(0)
        expect(evaluations).toEqual({
            upstream: 4,
            middle: 4,
            downstream: 4,
            pruned: 4,
            prunedParent: 2,
        })
    })

    test("keeps scoped source commits authoritative across exact post-apply control faults", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const foreignAtom = foreign.atom(0)
        const root = local.createStoreTree()
        const child = root.scope("child")
        let contaminate = false
        let evaluations = 0
        const derived = local.selector(get => {
            evaluations++
            const current = get(count)
            if (contaminate) {
                try {
                    get(foreignAtom)
                } catch {}
            }
            return current
        })

        expect(child.get(derived)).toBe(0)
        contaminate = true
        const propagationError = thrownBy(() => root.set(count, 1))
        expect(propagationError).toBeInstanceOf(RuntimeMismatchError)
        expect(root.get(count)).toBe(1)
        expect(child.get(count)).toBe(1)
        expect(thrownBy(() => child.get(derived))).toBe(propagationError)

        contaminate = false
        root.set(count, 2)
        expect(child.get(derived)).toBe(2)
        expect(evaluations).toBe(3)
    })

    test("keeps reset symbolic across ancestor intent order and comparator baselines scope-local", () => {
        const calls: [number, number][] = []
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0, {
            equal: (baseline, candidate) => {
                calls.push([baseline, candidate])
                return baseline === candidate
            },
        })
        const root = domain.createStoreTree()
        const child = root.scope("child")
        child.set(count, 9)
        calls.length = 0

        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            childCursor.reset(count)
            transaction.set(count, 2)
            expect(childCursor.get(count)).toBe(2)
        })
        expect(child.get(count)).toBe(2)
        expect(calls).toEqual([[0, 2]])

        child.set(count, 9)
        calls.length = 0
        root.txn(transaction => {
            transaction.set(count, 3)
            const childCursor = transaction.scope(child)
            childCursor.reset(count)
            expect(childCursor.get(count)).toBe(3)
        })
        expect(child.get(count)).toBe(3)
        expect(calls).toEqual([[2, 3]])

        child.set(count, 10)
        calls.length = 0
        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            childCursor.set(count, 11)
            childCursor.set(count, 10)
        })
        expect(child.get(count)).toBe(10)
        expect(calls).toEqual([
            [10, 11],
            [10, 10],
        ])

        const nestedCount = domain.atom(0)
        const grandchild = child.scope("grandchild")
        root.set(nestedCount, 2)
        child.set(nestedCount, 3)
        grandchild.set(nestedCount, 4)
        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            const grandchildCursor = transaction.scope(grandchild)
            grandchildCursor.reset(nestedCount)
            expect(grandchildCursor.get(nestedCount)).toBe(3)
            childCursor.reset(nestedCount)
            expect(childCursor.get(nestedCount)).toBe(2)
            expect(grandchildCursor.get(nestedCount)).toBe(2)
            grandchildCursor.update(nestedCount, current => current + 5)
            expect(grandchildCursor.get(nestedCount)).toBe(7)
        })
        expect(child.get(nestedCount)).toBe(2)
        expect(grandchild.get(nestedCount)).toBe(7)

        let forceEqual = false
        const symbolicCalls: [number, number][] = []
        const symbolic = domain.atom(0, {
            equal: (baseline, candidate) => {
                symbolicCalls.push([baseline, candidate])
                return forceEqual
            },
        })
        root.set(symbolic, 1)
        child.set(symbolic, 2)
        symbolicCalls.length = 0
        forceEqual = true
        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            childCursor.reset(symbolic)
            expect(childCursor.get(symbolic)).toBe(1)
        })
        expect(child.get(symbolic)).toBe(1)
        expect(symbolicCalls).toEqual([])

        const distanceCalls: [number, number][] = []
        const distance = domain.atom(1, {
            equal: (baseline, candidate) => {
                distanceCalls.push([baseline, candidate])
                return Math.abs(baseline - candidate) <= 1
            },
        })
        child.set(distance, 10)
        distanceCalls.length = 0
        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            childCursor.reset(distance)
            expect(childCursor.get(distance)).toBe(1)
            childCursor.update(distance, current => current + 10)
            expect(childCursor.get(distance)).toBe(10)
        })
        expect(distanceCalls).toEqual([[10, 11]])
        expect(child.get(distance)).toBe(10)
    })

    test("keeps a prior scoped intent when a caught symbolic reset reaches a draft fallback error", () => {
        const cause = new Error("draft fallback failed")
        let initializerCalls = 0
        const domain = createCommittedStoreTreeDomain()
        const failed = domain.atomLazy<number>(() => {
            initializerCalls++
            throw cause
        })
        const marker = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")

        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            childCursor.set(failed, 7)
            expect(initializerCalls).toBe(1)
            expect(thrownBy(() => childCursor.reset(failed))).toBe(cause)
            expect(childCursor.get(failed)).toBe(7)
            childCursor.set(marker, 1)
        })

        expect(initializerCalls).toBe(1)
        expect(child.get(failed)).toBe(7)
        expect(child.get(marker)).toBe(1)
        expect(root.get(marker)).toBe(0)
        expect(thrownBy(() => root.get(failed))).toBe(cause)
        expect(thrownBy(() => child.reset(failed))).toBe(cause)
        expect(child.get(failed)).toBe(7)
    })

    test("matches direct scoped operations with equivalent one- and two-intent transactions", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(1)
        const paired = domain.atom(2)
        const root = domain.createStoreTree()
        const direct = root.scope("direct")
        const transactional = root.scope("transactional")
        const expectSame = (): void => {
            expect(Object.is(direct.get(count), transactional.get(count))).toBe(
                true,
            )
        }

        expect(direct.set(count, -0)).toBeUndefined()
        expect(
            root.txn(transaction =>
                transaction.scope(transactional).set(count, -0),
            ),
        ).toBeUndefined()
        expectSame()

        expect(direct.update(count, current => current + 4)).toBeUndefined()
        expect(
            root.txn(transaction =>
                transaction
                    .scope(transactional)
                    .update(count, current => current + 4),
            ),
        ).toBeUndefined()
        expectSame()

        expect(direct.reset(count)).toBeUndefined()
        expect(
            root.txn(transaction =>
                transaction.scope(transactional).reset(count),
            ),
        ).toBeUndefined()
        expectSame()
        expect(direct.get(count)).toBe(1)

        direct.set(count, 7)
        direct.set(paired, 9)
        root.txn(transaction => {
            const cursor = transaction.scope(transactional)
            cursor.set(count, 7)
            cursor.set(paired, 9)
        })
        expectSame()
        expect(direct.get(paired)).toBe(transactional.get(paired))
    })

    test("shares one tree fallback across scopes while draft-only and scratch work stays disposable", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        let calls = 0
        const lazy = domain.atomLazy(() =>
            Object.freeze({ invocation: ++calls }),
        )
        const derived = domain.selector(get => get(lazy))
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")

        let draftValue!: Readonly<{ invocation: number }>
        root.txn(transaction => {
            draftValue = transaction.scope(child).get(derived)
            expect(transaction.scope(sibling).get(derived)).toBe(draftValue)
        })
        expect(calls).toBe(1)
        expect(counters.read("scratchHostAllocations")).toBe(2)
        expect(counters.read("scratchMapAllocations")).toBe(1)

        const committed = root.get(lazy)
        expect(committed).not.toBe(draftValue)
        expect(child.get(lazy)).toBe(committed)
        expect(sibling.get(lazy)).toBe(committed)
        expect(calls).toBe(2)

        let unpublishedCalls = 0
        const unpublished = domain.atomLazy(() =>
            Object.freeze({ invocation: ++unpublishedCalls }),
        )
        let fallback!: Readonly<{ invocation: number }>
        const override = Object.freeze({ invocation: 99 })
        root.txn(transaction => {
            fallback = transaction.scope(child).get(unpublished)
            transaction.scope(child).set(unpublished, override)
        })
        expect(child.get(unpublished)).toBe(override)
        child.reset(unpublished)
        expect(child.get(unpublished)).toBe(fallback)
        expect(root.get(unpublished)).toBe(fallback)
        expect(unpublishedCalls).toBe(1)
    })

    test("preserves exact scoped values and retries uncommitted lazy thenable outcomes", () => {
        const domain = createCommittedStoreTreeDomain()
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const exactUndefined = domain.atom<undefined>(undefined)
        const initialFunction = (): number => 1
        const nextFunction = (): number => 2
        const exactFunction = domain.atom(initialFunction)
        const exactNumber = domain.atom(1)

        expect(child.set(exactUndefined, undefined)).toBeUndefined()
        expect(child.get(exactUndefined)).toBeUndefined()
        expect(child.update(exactFunction, () => nextFunction)).toBeUndefined()
        expect(child.get(exactFunction)).toBe(nextFunction)
        expect(root.get(exactFunction)).toBe(initialFunction)
        expect(child.set(exactNumber, -0)).toBeUndefined()
        expect(Object.is(child.get(exactNumber), -0)).toBe(true)
        child.set(exactNumber, Number.NaN)
        expect(Object.is(child.get(exactNumber), Number.NaN)).toBe(true)
        expect(child.reset(exactFunction)).toBeUndefined()
        expect(child.get(exactFunction)).toBe(initialFunction)

        for (const mode of ["return", "throw"] as const) {
            let initializerCalls = 0
            let containmentCalls = 0
            let comparatorCalls = 0
            const thenable = Object.freeze({
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    containmentCalls++
                    reject(new Error("contained"))
                },
            })
            const lazy = domain.atomLazy<number>(
                (() => {
                    initializerCalls++
                    if (mode === "throw") throw thenable
                    return thenable as never
                }) as () => number,
                {
                    equal: () => {
                        comparatorCalls++
                        return false
                    },
                },
            )

            const first = thrownBy(() => child.reset(lazy))
            const second = thrownBy(() => child.reset(lazy))
            expect(first).toBeInstanceOf(InvalidSynchronousAtomValueError)
            expect(second).toBeInstanceOf(InvalidSynchronousAtomValueError)
            expect(second).not.toBe(first)
            expect([
                initializerCalls,
                containmentCalls,
                comparatorCalls,
            ]).toEqual([2, 2, 0])

            child.set(lazy, 99)
            expect([
                initializerCalls,
                containmentCalls,
                comparatorCalls,
            ]).toEqual([3, 3, 0])
            const committedError = thrownBy(() => root.get(lazy))
            expect(committedError).toBeInstanceOf(
                InvalidSynchronousAtomValueError,
            )
            expect(thrownBy(() => child.reset(lazy))).toBe(committedError)
            expect(child.get(lazy)).toBe(99)
            expect(comparatorCalls).toBe(0)
        }
    })

    test("resolves absolute and relative transaction cursors over one flat draft", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const left = root.scope("left")
        const right = root.scope("right")
        const nested = left.scope("shared")
        right.scope("shared")
        const anonymous = root.scope()
        let retainedNested!: RootTransaction

        const result = root.txn(transaction => {
            const leftCursor = transaction.scope("left")
            retainedNested = leftCursor.scope("shared")
            retainedNested.set(count, 1)
            transaction.scope(right).set(count, 2)
            transaction.scope(anonymous).set(count, 3)
            const inner = transaction.scope(left, cursor => {
                cursor.set(count, 4)
                return cursor.get(count)
            })
            expect(inner).toBe(4)
            retainedNested.update(count, value => value + 4)
            return transaction.get(count)
        })

        expect(result).toBe(0)
        expect(left.get(count)).toBe(4)
        expect(nested.get(count)).toBe(5)
        expect(right.get(count)).toBe(2)
        expect(anonymous.get(count)).toBe(3)
        expect(thrownBy(() => retainedNested.get(count))).toBeInstanceOf(
            TransactionClosedError,
        )
    })

    test("invalidates every scoped scratch host only after successful intents and keeps inner callback prefixes flat", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const marker = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")
        let evaluations = 0
        const derived = domain.selector(get => {
            evaluations++
            return Object.freeze({ value: get(count) })
        })
        const caught = new Error("caught inner callback")

        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            const siblingCursor = transaction.scope(sibling)
            const childBefore = childCursor.get(derived)
            expect(childBefore.value).toBe(0)
            expect(
                thrownBy(() => transaction.scope(childCursor as never)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            expect(childCursor.get(derived)).toBe(childBefore)

            const siblingBefore = siblingCursor.get(derived)
            expect(siblingBefore.value).toBe(0)
            expect(siblingCursor.get(derived)).toBe(siblingBefore)
            expect(evaluations).toBe(2)

            childCursor.set(count, 1)
            expect(childCursor.get(derived).value).toBe(1)
            expect(siblingCursor.get(derived).value).toBe(0)
            expect(evaluations).toBe(4)

            expect(
                thrownBy(() =>
                    transaction.scope(child, scoped => {
                        scoped.set(marker, 4)
                        throw caught
                    }),
                ),
            ).toBe(caught)
            expect(childCursor.get(marker)).toBe(4)
        })

        expect(counters.read("scratchHostAllocations")).toBe(2)
        expect(child.get(count)).toBe(1)
        expect(child.get(marker)).toBe(4)
        const escaping = new Error("escaping inner callback")
        expect(
            thrownBy(() =>
                root.txn(transaction => {
                    transaction.scope(child, scoped => {
                        scoped.set(marker, 9)
                        throw escaping
                    })
                }),
            ),
        ).toBe(escaping)
        expect(child.get(marker)).toBe(4)
    })

    test("keeps scoped scratch errors and cycles generation-local without persistent routing", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")
        let errorEvaluations = 0
        let cycleEvaluations = 0
        const failing = domain.selector(get => {
            get(source)
            errorEvaluations++
            throw new Error(`scratch-${errorEvaluations}`)
        })
        let cycle!: Selector<number>
        cycle = domain.selector(get => {
            cycleEvaluations++
            return get(cycle)
        })

        root.txn(transaction => {
            const childCursor = transaction.scope(child)
            const siblingCursor = transaction.scope(sibling)
            const childError = thrownBy(() => childCursor.get(failing))
            const childCycle = thrownBy(() => childCursor.get(cycle))
            expect(thrownBy(() => childCursor.get(failing))).toBe(childError)
            expect(thrownBy(() => childCursor.get(cycle))).toBe(childCycle)
            const siblingError = thrownBy(() => siblingCursor.get(failing))
            const siblingCycle = thrownBy(() => siblingCursor.get(cycle))
            expect(siblingError).not.toBe(childError)
            expect(siblingCycle).not.toBe(childCycle)

            expect(
                thrownBy(() => transaction.scope(childCursor as never)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            expect(thrownBy(() => childCursor.get(failing))).toBe(childError)
            expect(thrownBy(() => siblingCursor.get(cycle))).toBe(siblingCycle)

            childCursor.set(source, 1)
            expect(thrownBy(() => childCursor.get(failing))).not.toBe(
                childError,
            )
            expect(thrownBy(() => childCursor.get(cycle))).not.toBe(childCycle)
            expect(thrownBy(() => siblingCursor.get(failing))).not.toBe(
                siblingError,
            )
            expect(thrownBy(() => siblingCursor.get(cycle))).not.toBe(
                siblingCycle,
            )
        })

        expect(errorEvaluations).toBe(4)
        expect(cycleEvaluations).toBe(4)
        child.set(source, 2)
        root.set(source, 3)
        expect(errorEvaluations).toBe(4)
        expect(cycleEvaluations).toBe(4)
    })

    test("keeps caught scope failures flat and applies exact target error precedence", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const other = local.atom(0)
        const foreignAtom = foreign.atom(0)
        const root = local.createStoreTree()
        const child = root.scope("child")
        const otherTree = local.createStoreTree()
        const disposedOtherTree = local.createStoreTree()
        disposedOtherTree.dispose()
        const foreignTree = foreign.createStoreTree()
        const localProxy = new Proxy(otherTree, {})
        const foreignProxy = new Proxy(foreignTree, {})
        const disposed = root.scope("disposed")
        disposed.dispose()
        let missingCallbackCalls = 0
        let retainedClosed!: RootTransaction
        root.txn(transaction => {
            retainedClosed = transaction
        })

        root.txn(transaction => {
            transaction.set(count, 1)
            expect(
                thrownBy(() =>
                    transaction.scope("missing", () => {
                        missingCallbackCalls++
                    }),
                ),
            ).toBeInstanceOf(ScopeNotFoundError)
            expect(
                thrownBy(() =>
                    (
                        transaction.scope as unknown as (
                            ...arguments_: unknown[]
                        ) => unknown
                    )(
                        child,
                        () => {
                            missingCallbackCalls++
                        },
                        "extra",
                    ),
                ),
            ).toBeInstanceOf(TypeError)
            if (false) {
                // @ts-expect-error Transaction.scope has exactly one optional callback.
                transaction.scope(child, () => undefined, "extra")
            }
            expect(thrownBy(() => transaction.scope(otherTree))).toBeInstanceOf(
                StoreTreeMismatchError,
            )
            expect(
                thrownBy(() => transaction.scope(disposedOtherTree)),
            ).toBeInstanceOf(StoreDisposedError)
            expect(thrownBy(() => transaction.scope(disposed))).toBeInstanceOf(
                StoreDisposedError,
            )
            expect(
                thrownBy(() => transaction.scope(transaction as never)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            expect(
                thrownBy(() => transaction.scope(localProxy)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            expect(
                thrownBy(() => transaction.scope(other as never)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            expect(
                thrownBy(() => transaction.scope(retainedClosed as never)),
            ).toBeInstanceOf(TransactionClosedError)
            expect(
                thrownBy(() => transaction.scope(foreignTree)),
            ).toBeInstanceOf(RuntimeMismatchError)
            expect(
                thrownBy(() => transaction.scope(foreignProxy)),
            ).toBeInstanceOf(RuntimeMismatchError)
            expect(thrownBy(() => transaction.get(foreignAtom))).toBeInstanceOf(
                RuntimeMismatchError,
            )
            transaction.scope(child).set(count, 2)
        })

        expect(missingCallbackCalls).toBe(0)
        expect(root.get(count)).toBe(1)
        expect(child.get(count)).toBe(2)
    })

    test("keeps target owner precedence exact for closed cursors, hostile proxies, and impostors", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        let foreignInitializerCalls = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignInitializerCalls++
            return 0
        })
        const root = local.createStoreTree()
        const child = root.scope("child")
        const foreignTree = foreign.createStoreTree()
        let closed!: RootTransaction
        root.txn(transaction => {
            closed = transaction
        })

        expect(thrownBy(() => closed.scope(foreignTree))).toMatchObject({
            name: "RuntimeMismatchError",
            code: "VALDRES_RUNTIME_MISMATCH",
        })
        expect(thrownBy(() => closed.scope(child))).toMatchObject({
            name: "TransactionClosedError",
            code: "VALDRES_TRANSACTION_CLOSED",
        })

        const brandedImpostor = {}
        Object.defineProperty(
            brandedImpostor,
            Symbol.for("valdres.runtime-owner/v1"),
            { value: Object.freeze({}) },
        )
        let nestedFirstFault: unknown
        let proxyTraps = 0
        let targetCallbackCalls = 0
        const laterTrapFailure = new Error("later target trap failure")
        root.txn(transaction => {
            const hostileTarget = new Proxy(
                {},
                {
                    getOwnPropertyDescriptor(): never {
                        proxyTraps++
                        try {
                            root.get(foreignAtom)
                        } catch (error) {
                            nestedFirstFault = error
                        }
                        throw laterTrapFailure
                    },
                },
            )
            const targetError = thrownBy(() =>
                transaction.scope(hostileTarget as never, () => {
                    targetCallbackCalls++
                }),
            )
            expect(targetError).toBe(nestedFirstFault)
            expect(targetError).toBeInstanceOf(RuntimeMismatchError)
            expect(targetError).not.toBe(laterTrapFailure)
            expect(
                thrownBy(() => transaction.scope(brandedImpostor as never)),
            ).toBeInstanceOf(RuntimeMismatchError)
            expect(
                thrownBy(() => transaction.scope({} as never)),
            ).toBeInstanceOf(InvalidTransactionTargetError)
            transaction.set(count, 1)
        })
        expect(proxyTraps).toBe(1)
        expect(targetCallbackCalls).toBe(0)
        expect(foreignInitializerCalls).toBe(0)
        expect(root.get(count)).toBe(1)

        const original = Object.getOwnPropertyDescriptor
        let localHandleProbes = 0
        Object.getOwnPropertyDescriptor = ((target, key) => {
            if (Object.is(target, root) || Object.is(target, child)) {
                localHandleProbes++
            }
            return original(target, key)
        }) as typeof Object.getOwnPropertyDescriptor
        try {
            root.txn(transaction => {
                expect(transaction.scope(child).get(count)).toBe(1)
            })
        } finally {
            Object.getOwnPropertyDescriptor = original
        }
        expect(localHandleProbes).toBe(0)
    })

    test("guards inner scope callback results without revoking the flat draft", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        let retainedChild!: RootTransaction
        const getterErrors: unknown[] = []
        const containmentErrors: unknown[] = []
        const calls = { getters: 0, containments: 0 }
        const makeThenable = () =>
            Object.freeze({
                get then() {
                    calls.getters++
                    getterErrors.push(thrownBy(() => root.get(count)))
                    getterErrors.push(thrownBy(() => retainedChild.get(count)))
                    return (
                        _resolve: unknown,
                        reject: (error: unknown) => void,
                    ): void => {
                        calls.containments++
                        containmentErrors.push(thrownBy(() => root.get(count)))
                        containmentErrors.push(
                            thrownBy(() => retainedChild.get(count)),
                        )
                        reject(new Error("contained"))
                    }
                },
            })

        root.txn(transaction => {
            retainedChild = transaction.scope(child)
            expect(
                thrownBy(() =>
                    transaction.scope(child, (() =>
                        makeThenable()) as unknown as () => never),
                ),
            ).toBeInstanceOf(InvalidTransactionCallbackResultError)
            expect(
                thrownBy(() =>
                    transaction.scope(child, cursor => {
                        cursor.set(count, 4)
                        throw makeThenable()
                    }),
                ),
            ).toBeInstanceOf(InvalidTransactionCallbackResultError)
            expect(retainedChild.get(count)).toBe(4)
            retainedChild.set(count, 3)
            transaction.set(count, 2)
        })

        expect(calls).toEqual({ getters: 2, containments: 2 })
        for (const error of [...getterErrors, ...containmentErrors]) {
            expect(error).toBeInstanceOf(TransactionPhaseError)
        }
        expect(root.get(count)).toBe(2)
        expect(child.get(count)).toBe(3)

        const escaping = makeThenable()
        expect(
            thrownBy(() =>
                root.txn(transaction => {
                    retainedChild = transaction.scope(child)
                    transaction.set(count, 9)
                    transaction.scope(child, () => {
                        throw escaping
                    })
                }),
            ),
        ).toBeInstanceOf(InvalidTransactionCallbackResultError)
        expect(calls).toEqual({ getters: 3, containments: 3 })
        expect(root.get(count)).toBe(2)
        expect(child.get(count)).toBe(3)
    })

    test("quarantines topology and disposal across callback phases while other domains remain independent", () => {
        const local = createCommittedStoreTreeDomain()
        const independent = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const guarded = local.atom(0)
        const root = local.createStoreTree()
        const child = root.scope("child")
        const other = independent.createStoreTree()
        const otherCount = independent.atom(0)
        const selectorErrors: unknown[] = []
        const updaterErrors: unknown[] = []
        const transactionErrors: unknown[] = []
        const derived = local.selector(get => {
            get(count)
            selectorErrors.push(thrownBy(() => child.scope("forbidden")))
            selectorErrors.push(thrownBy(() => child.dispose()))
            return 1
        })

        expect(root.get(derived)).toBe(1)
        root.update(guarded, current => {
            updaterErrors.push(thrownBy(() => child.scope("updater")))
            other.set(otherCount, 1)
            return current + 1
        })
        root.txn(transaction => {
            transactionErrors.push(thrownBy(() => child.scope("transaction")))
            transactionErrors.push(thrownBy(() => child.dispose()))
            transaction.set(count, 2)
        })

        expect(selectorErrors).toEqual([
            expect.any(SelectorCapabilityError),
            expect.any(SelectorCapabilityError),
            expect.any(SelectorCapabilityError),
            expect.any(SelectorCapabilityError),
        ])
        expect(updaterErrors).toEqual([expect.any(CallbackCapabilityError)])
        expect(transactionErrors).toEqual([
            expect.any(TransactionPhaseError),
            expect.any(TransactionPhaseError),
        ])
        expect(root.scope("child")).toBe(child)
        expect(other.get(otherCount)).toBe(1)
    })

    test("disposes complete subtrees idempotently and recreates named generations without graph reuse", () => {
        const counters = counterHarness()
        const local = createCommittedStoreTreeDomain(counters.instrumentation)
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        let evaluations = 0
        const derived = local.selector(get => {
            evaluations++
            return get(count)
        })
        const root = local.createStoreTree()
        const sibling = root.scope("sibling")
        const first = root.scope("draft")
        const grandchild = first.scope("grandchild")
        expect(grandchild.get(derived)).toBe(0)
        first.set(count, 4)
        expect(grandchild.get(derived)).toBe(4)

        const visitsBefore = counters.read("disposalVisits")
        first.dispose()
        first.dispose()
        expect(counters.read("disposalVisits") - visitsBefore).toBe(2)
        for (const operation of [
            () => first.get(count),
            () => first.set(count, 1),
            () => first.update(count, value => value + 1),
            () => first.reset(count),
            () => first.txn(() => undefined),
            () => first.scope("nested"),
            () => grandchild.get(count),
        ]) {
            expect(thrownBy(operation)).toBeInstanceOf(StoreDisposedError)
        }
        expect(sibling.get(count)).toBe(0)

        const replacement = root.scope("draft")
        expect(replacement).not.toBe(first)
        expect(replacement.get(derived)).toBe(0)
        expect(evaluations).toBe(3)
        first.dispose()
        expect(root.scope("draft")).toBe(replacement)

        const foreignAtom = foreign.atom(0)
        expect(thrownBy(() => first.get(foreignAtom))).toBeInstanceOf(
            RuntimeMismatchError,
        )

        root.dispose()
        root.dispose()
        expect(thrownBy(() => root.get(count))).toBeInstanceOf(
            StoreDisposedError,
        )
        expect(thrownBy(() => replacement.get(count))).toBeInstanceOf(
            StoreDisposedError,
        )
        expect(thrownBy(() => sibling.get(count))).toBeInstanceOf(
            StoreDisposedError,
        )
    })

    test("matches the ReferenceModel across 32 seeds and eight normalized scope programs", () => {
        type MatrixAtom = "primary" | "secondary"
        type MatrixScope = Readonly<{
            id: string
            store: CommittedStoreTree
        }>
        type MatrixCandidate = Readonly<{
            label: string
            token: ValueToken
            actual: unknown
        }>
        type MatrixOperation = Readonly<{
            target: MatrixScope
            atom: MatrixAtom
            mutation: Mutation
            apply(cursor: CommittedStoreTree | RootTransaction): void
        }>

        const coveredCandidates = new Set<string>()
        const coveredShapes = new Set<number>()
        const commandCounts: number[] = []

        for (let seed = 0; seed < 32; seed++) {
            for (let shape = 0; shape < 8; shape++) {
                coveredShapes.add(shape)
                const model = createReferenceModel()
                try {
                    const domain = createCommittedStoreTreeDomain()
                    const functionValue = (): number => seed * 8 + shape
                    const objectValue = Object.freeze({ seed, shape })
                    const symbolValue = Symbol(`matrix-${seed}-${shape}`)
                    let writeContainments = 0
                    let lazyThenableCalls = 0
                    let lazyThenableContainments = 0
                    let lazyValueCalls = 0
                    let lazyFailureCalls = 0
                    const writeThenable = Object.freeze({
                        then(
                            _resolve: unknown,
                            reject: (error: unknown) => void,
                        ) {
                            writeContainments++
                            reject(new Error("contained matrix write"))
                        },
                    })
                    const lazyThenable = Object.freeze({
                        then(
                            _resolve: unknown,
                            reject: (error: unknown) => void,
                        ) {
                            lazyThenableContainments++
                            reject(new Error("contained matrix lazy"))
                        },
                    })
                    const lazyFailure = Object.assign(
                        new Error("matrix lazy failure"),
                        { code: "LAZY_FAILED" },
                    )
                    const updaterFailure = Object.assign(
                        new Error("matrix updater failure"),
                        { code: "UPDATER_FAILED" },
                    )
                    const escapedFailure = Object.assign(
                        new Error("matrix escaped transaction"),
                        { code: "ESCAPED" },
                    )
                    const identityValues = new Map<string, unknown>([
                        ["function", functionValue],
                        ["object", objectValue],
                        ["symbol", symbolValue],
                        ["write-thenable", writeThenable],
                        ["lazy-thenable", lazyThenable],
                    ])
                    const candidates: readonly MatrixCandidate[] = [
                        Object.freeze({
                            label: "undefined",
                            token: value.undefined,
                            actual: undefined,
                        }),
                        Object.freeze({
                            label: "nan",
                            token: value.number(Number.NaN),
                            actual: Number.NaN,
                        }),
                        Object.freeze({
                            label: "negative-zero",
                            token: value.number(-0),
                            actual: -0,
                        }),
                        Object.freeze({
                            label: "number",
                            token: value.number(seed - shape),
                            actual: seed - shape,
                        }),
                        Object.freeze({
                            label: "string",
                            token: value.string(`${seed}:${shape}`),
                            actual: `${seed}:${shape}`,
                        }),
                        Object.freeze({
                            label: "function",
                            token: value.identity("function", "function"),
                            actual: functionValue,
                        }),
                        Object.freeze({
                            label: "object",
                            token: value.identity("object", "object"),
                            actual: objectValue,
                        }),
                        Object.freeze({
                            label: "symbol",
                            token: value.identity("symbol", "symbol"),
                            actual: symbolValue,
                        }),
                    ]

                    const primary = domain.atom<unknown>(undefined)
                    const secondary = domain.atomLazy<unknown>(() => {
                        lazyValueCalls++
                        return functionValue
                    })
                    const faulty = domain.atomLazy<unknown>(() => {
                        lazyFailureCalls++
                        throw lazyFailure
                    })
                    const asynchronous = domain.atomLazy<unknown>(() => {
                        lazyThenableCalls++
                        return lazyThenable
                    })
                    const atoms: Readonly<Record<MatrixAtom, Atom<unknown>>> =
                        Object.freeze({ primary, secondary })

                    for (const atom of [
                        {
                            id: "primary",
                            fallback: {
                                kind: "eager" as const,
                                value: value.undefined,
                            },
                        },
                        {
                            id: "secondary",
                            fallback: {
                                kind: "lazy" as const,
                                value: value.identity("function", "function"),
                            },
                        },
                        {
                            id: "faulty",
                            fallback: {
                                kind: "lazy-error" as const,
                                code: "LAZY_FAILED",
                            },
                        },
                        {
                            id: "asynchronous",
                            fallback: {
                                kind: "lazy" as const,
                                value: value.identity(
                                    "thenable",
                                    "lazy-thenable",
                                ),
                            },
                        },
                    ] as const) {
                        expect(
                            model.execute({ kind: "define-atom", atom }),
                        ).toMatchObject({ ok: true })
                    }
                    expect(
                        model.execute({
                            kind: "create-tree",
                            tree: "tree",
                            root: "root",
                        }),
                    ).toMatchObject({ ok: true })

                    const root: MatrixScope = Object.freeze({
                        id: "root",
                        store: domain.createStoreTree(),
                    })
                    const scopes: MatrixScope[] = [root]
                    const createScope = (
                        parent: MatrixScope,
                        id: string,
                        name?: string,
                        retain = true,
                    ): MatrixScope => {
                        const store =
                            name === undefined
                                ? parent.store.scope()
                                : parent.store.scope(name)
                        expect(
                            model.execute({
                                kind: "create-scope",
                                tree: "tree",
                                parent: parent.id,
                                scope: id,
                                ...(name === undefined ? {} : { name }),
                            }),
                        ).toMatchObject({ ok: true })
                        const created = Object.freeze({ id, store })
                        if (retain) scopes.push(created)
                        return created
                    }

                    if (shape === 1) {
                        createScope(root, "named", "named")
                    } else if (shape === 2) {
                        createScope(root, "anonymous")
                    } else if (shape === 3) {
                        createScope(root, "left", "left")
                        createScope(root, "right", "right")
                    } else if (shape === 4) {
                        const parent = createScope(root, "parent", "parent")
                        createScope(parent, "nested", "nested")
                    } else if (shape === 5) {
                        const parent = createScope(root, "anonymous-parent")
                        createScope(parent, "named-under-anonymous", "nested")
                    } else if (shape === 6) {
                        const named = createScope(root, "named-left", "left")
                        const anonymous = createScope(root, "anonymous-right")
                        createScope(named, "anonymous-under-named")
                        createScope(
                            anonymous,
                            "named-under-anonymous",
                            "nested",
                        )
                    } else if (shape === 7) {
                        const doomed = createScope(
                            root,
                            "doomed",
                            "draft",
                            false,
                        )
                        createScope(doomed, "doomed-child", undefined, false)
                        doomed.store.dispose()
                        expect(
                            model.execute({
                                kind: "dispose",
                                tree: "tree",
                                scope: doomed.id,
                            }),
                        ).toMatchObject({ ok: true })
                        createScope(root, "replacement", "draft")
                    }

                    const actualForToken = (token: ValueToken): unknown => {
                        if (token.kind === "undefined") return undefined
                        if (token.kind === "null") return null
                        if (
                            token.kind === "boolean" ||
                            token.kind === "number" ||
                            token.kind === "string" ||
                            token.kind === "bigint"
                        ) {
                            return token.value
                        }
                        return identityValues.get(token.id)
                    }
                    const assertAllValues = (label: string): void => {
                        for (const scope of scopes) {
                            for (const atom of [
                                "primary",
                                "secondary",
                            ] as const) {
                                const result = model.execute({
                                    kind: "read",
                                    tree: "tree",
                                    scope: scope.id,
                                    target: { kind: "atom", atom },
                                    as: `${label}:${scope.id}:${atom}`,
                                })
                                expect(result).toMatchObject({
                                    ok: true,
                                    outcome: { kind: "value" },
                                })
                                const token = (
                                    result.outcome as Readonly<{
                                        kind: "value"
                                        value: ValueToken
                                    }>
                                ).value
                                expect(
                                    Object.is(
                                        scope.store.get(atoms[atom]),
                                        actualForToken(token),
                                    ),
                                ).toBe(true)
                            }
                        }
                    }
                    const makeOperation = (
                        target: MatrixScope,
                        atom: MatrixAtom,
                        operation: number,
                        candidate: MatrixCandidate,
                    ): MatrixOperation => {
                        if (operation === 0) {
                            coveredCandidates.add(candidate.label)
                            return Object.freeze({
                                target,
                                atom,
                                mutation: Object.freeze({
                                    kind: "set-atom" as const,
                                    atom,
                                    value: candidate.token,
                                }),
                                apply: (
                                    cursor:
                                        | CommittedStoreTree
                                        | RootTransaction,
                                ) => cursor.set(atoms[atom], candidate.actual),
                            })
                        }
                        if (operation === 1) {
                            coveredCandidates.add(candidate.label)
                            return Object.freeze({
                                target,
                                atom,
                                mutation: Object.freeze({
                                    kind: "update-atom" as const,
                                    atom,
                                    updater: Object.freeze({
                                        kind: "replace" as const,
                                        value: candidate.token,
                                    }),
                                }),
                                apply: (
                                    cursor:
                                        | CommittedStoreTree
                                        | RootTransaction,
                                ) =>
                                    cursor.update(
                                        atoms[atom],
                                        () => candidate.actual,
                                    ),
                            })
                        }
                        return Object.freeze({
                            target,
                            atom,
                            mutation: Object.freeze({
                                kind: "reset-atom" as const,
                                atom,
                            }),
                            apply: (
                                cursor: CommittedStoreTree | RootTransaction,
                            ) => cursor.reset(atoms[atom]),
                        })
                    }

                    let random =
                        (Math.imul(seed + 1, 0x9e3779b1) ^
                            Math.imul(shape + 1, 0x85ebca6b)) >>>
                        0
                    const next = (): number => {
                        random =
                            (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0
                        return random
                    }
                    let commandCount = 0
                    for (let command = 0; command < 12; command++) {
                        if ((next() & 1) === 0) {
                            const operation = makeOperation(
                                scopes[next() % scopes.length]!,
                                (next() & 1) === 0 ? "primary" : "secondary",
                                next() % 3,
                                candidates[next() % candidates.length]!,
                            )
                            operation.apply(operation.target.store)
                            expect(
                                model.execute({
                                    kind: "mutate",
                                    tree: "tree",
                                    scope: operation.target.id,
                                    mutation: operation.mutation,
                                }),
                            ).toMatchObject({ ok: true, committed: true })
                        } else {
                            const width = (next() % 3) + 1
                            const operations: MatrixOperation[] = []
                            const steps: TransactionStep[] = []
                            for (let index = 0; index < width; index++) {
                                const operation = makeOperation(
                                    scopes[next() % scopes.length]!,
                                    (next() & 1) === 0
                                        ? "primary"
                                        : "secondary",
                                    next() % 3,
                                    candidates[next() % candidates.length]!,
                                )
                                const cursor = `cursor-${index}`
                                operations.push(operation)
                                steps.push({
                                    kind: "resolve-cursor",
                                    cursor,
                                    target: {
                                        kind: "scope",
                                        tree: "tree",
                                        scope: operation.target.id,
                                    },
                                })
                                steps.push({
                                    kind: "mutate",
                                    cursor,
                                    mutation: operation.mutation,
                                })
                            }
                            root.store.txn(transaction => {
                                for (const operation of operations) {
                                    operation.apply(
                                        transaction.scope(
                                            operation.target.store,
                                        ),
                                    )
                                }
                            })
                            expect(
                                model.execute({
                                    kind: "transact",
                                    tree: "tree",
                                    entryScope: root.id,
                                    steps,
                                }),
                            ).toMatchObject({ ok: true, committed: true })
                        }
                        commandCount++
                        assertAllValues(`${seed}:${shape}:${command}`)
                    }

                    const invalidTarget = scopes[next() % scopes.length]!
                    expect(
                        model.execute({
                            kind: "mutate",
                            tree: "tree",
                            scope: invalidTarget.id,
                            mutation: {
                                kind: "set-atom",
                                atom: "primary",
                                value: value.identity(
                                    "thenable",
                                    "write-thenable",
                                ),
                            },
                        }),
                    ).toMatchObject({
                        ok: false,
                        committed: false,
                        error: "INVALID_SYNC_ATOM_VALUE",
                    })
                    expect(
                        thrownBy(() =>
                            invalidTarget.store.set(primary, writeThenable),
                        ),
                    ).toBeInstanceOf(InvalidSynchronousAtomValueError)
                    expect(writeContainments).toBe(1)
                    commandCount++
                    assertAllValues(`${seed}:${shape}:invalid-write`)

                    const firstTarget = scopes[next() % scopes.length]!
                    const secondTarget = scopes[next() % scopes.length]!
                    const firstCandidate =
                        candidates[next() % candidates.length]!
                    const secondCandidate =
                        candidates[next() % candidates.length]!
                    coveredCandidates.add(firstCandidate.label)
                    coveredCandidates.add(secondCandidate.label)
                    let updaterCalls = 0
                    root.store.txn(transaction => {
                        transaction
                            .scope(firstTarget.store)
                            .set(primary, firstCandidate.actual)
                        expect(
                            thrownBy(() =>
                                transaction
                                    .scope(firstTarget.store)
                                    .update(primary, () => {
                                        updaterCalls++
                                        throw updaterFailure
                                    }),
                            ),
                        ).toBe(updaterFailure)
                        transaction
                            .scope(secondTarget.store)
                            .set(secondary, secondCandidate.actual)
                    })
                    expect(updaterCalls).toBe(1)
                    expect(
                        model.execute({
                            kind: "transact",
                            tree: "tree",
                            entryScope: root.id,
                            steps: [
                                {
                                    kind: "resolve-cursor",
                                    cursor: "first",
                                    target: {
                                        kind: "scope",
                                        tree: "tree",
                                        scope: firstTarget.id,
                                    },
                                },
                                {
                                    kind: "resolve-cursor",
                                    cursor: "second",
                                    target: {
                                        kind: "scope",
                                        tree: "tree",
                                        scope: secondTarget.id,
                                    },
                                },
                                {
                                    kind: "mutate",
                                    cursor: "first",
                                    mutation: {
                                        kind: "set-atom",
                                        atom: "primary",
                                        value: firstCandidate.token,
                                    },
                                },
                                {
                                    kind: "attempt",
                                    steps: [
                                        {
                                            kind: "mutate",
                                            cursor: "first",
                                            mutation: {
                                                kind: "update-atom",
                                                atom: "primary",
                                                updater: {
                                                    kind: "fail",
                                                    code: "UPDATER_FAILED",
                                                },
                                            },
                                        },
                                    ],
                                },
                                {
                                    kind: "mutate",
                                    cursor: "second",
                                    mutation: {
                                        kind: "set-atom",
                                        atom: "secondary",
                                        value: secondCandidate.token,
                                    },
                                },
                            ],
                        }),
                    ).toMatchObject({ ok: true, committed: true })
                    commandCount++
                    assertAllValues(`${seed}:${shape}:caught-prefix`)

                    const abortTarget = scopes[next() % scopes.length]!
                    const abortCandidate =
                        candidates[next() % candidates.length]!
                    coveredCandidates.add(abortCandidate.label)
                    expect(
                        thrownBy(() =>
                            root.store.txn(transaction => {
                                transaction
                                    .scope(abortTarget.store)
                                    .set(primary, abortCandidate.actual)
                                throw escapedFailure
                            }),
                        ),
                    ).toBe(escapedFailure)
                    expect(
                        model.execute({
                            kind: "transact",
                            tree: "tree",
                            entryScope: root.id,
                            steps: [
                                {
                                    kind: "resolve-cursor",
                                    cursor: "abort",
                                    target: {
                                        kind: "scope",
                                        tree: "tree",
                                        scope: abortTarget.id,
                                    },
                                },
                                {
                                    kind: "mutate",
                                    cursor: "abort",
                                    mutation: {
                                        kind: "set-atom",
                                        atom: "primary",
                                        value: abortCandidate.token,
                                    },
                                },
                                { kind: "raise", code: "ESCAPED" },
                            ],
                        }),
                    ).toMatchObject({
                        ok: false,
                        committed: false,
                        error: "ESCAPED",
                    })
                    commandCount++
                    assertAllValues(`${seed}:${shape}:escaped-prefix`)

                    const fallbackTarget = scopes[next() % scopes.length]!
                    expect(
                        model.execute({
                            kind: "read",
                            tree: "tree",
                            scope: fallbackTarget.id,
                            target: { kind: "atom", atom: "faulty" },
                            as: "faulty-read",
                        }),
                    ).toMatchObject({ ok: false, error: "LAZY_FAILED" })
                    expect(
                        thrownBy(() => fallbackTarget.store.get(faulty)),
                    ).toBe(lazyFailure)
                    commandCount++

                    const fallbackCandidate =
                        candidates[next() % candidates.length]!
                    coveredCandidates.add(fallbackCandidate.label)
                    fallbackTarget.store.set(faulty, fallbackCandidate.actual)
                    expect(
                        model.execute({
                            kind: "mutate",
                            tree: "tree",
                            scope: fallbackTarget.id,
                            mutation: {
                                kind: "set-atom",
                                atom: "faulty",
                                value: fallbackCandidate.token,
                            },
                        }),
                    ).toMatchObject({ ok: true, committed: true })
                    commandCount++
                    expect(
                        thrownBy(() => fallbackTarget.store.reset(faulty)),
                    ).toBe(lazyFailure)
                    expect(
                        model.execute({
                            kind: "mutate",
                            tree: "tree",
                            scope: fallbackTarget.id,
                            mutation: { kind: "reset-atom", atom: "faulty" },
                        }),
                    ).toMatchObject({
                        ok: false,
                        committed: false,
                        error: "LAZY_FAILED",
                    })
                    expect(
                        Object.is(
                            fallbackTarget.store.get(faulty),
                            fallbackCandidate.actual,
                        ),
                    ).toBe(true)
                    commandCount++

                    expect(
                        model.execute({
                            kind: "read",
                            tree: "tree",
                            scope: fallbackTarget.id,
                            target: {
                                kind: "atom",
                                atom: "asynchronous",
                            },
                            as: "asynchronous-read",
                        }),
                    ).toMatchObject({
                        ok: false,
                        error: "INVALID_LAZY_ATOM_INITIALIZER",
                    })
                    expect(
                        thrownBy(() => fallbackTarget.store.get(asynchronous)),
                    ).toBeInstanceOf(InvalidSynchronousAtomValueError)
                    expect([
                        lazyThenableCalls,
                        lazyThenableContainments,
                    ]).toEqual([1, 1])
                    commandCount++

                    const transient = root.store.scope()
                    expect(
                        model.execute({
                            kind: "create-scope",
                            tree: "tree",
                            parent: root.id,
                            scope: "transient",
                        }),
                    ).toMatchObject({ ok: true })
                    commandCount++
                    const transientChild = transient.scope()
                    expect(
                        model.execute({
                            kind: "create-scope",
                            tree: "tree",
                            parent: "transient",
                            scope: "transient-child",
                        }),
                    ).toMatchObject({ ok: true })
                    commandCount++
                    transient.dispose()
                    expect(
                        model.execute({
                            kind: "dispose",
                            tree: "tree",
                            scope: "transient",
                        }),
                    ).toMatchObject({ ok: true })
                    expect(
                        thrownBy(() => transient.get(primary)),
                    ).toBeInstanceOf(StoreDisposedError)
                    expect(
                        thrownBy(() => transientChild.get(primary)),
                    ).toBeInstanceOf(StoreDisposedError)
                    commandCount++

                    expect(commandCount).toBe(22)
                    expect(lazyValueCalls).toBe(1)
                    expect(lazyFailureCalls).toBe(1)
                    commandCounts.push(commandCount)
                } catch (error) {
                    const trace = JSON.stringify(
                        model.trace,
                        (_key, current: unknown) => {
                            if (
                                typeof current === "number" &&
                                Number.isNaN(current)
                            ) {
                                return "<NaN>"
                            }
                            if (
                                typeof current === "number" &&
                                Object.is(current, -0)
                            ) {
                                return "<-0>"
                            }
                            if (typeof current === "bigint") {
                                return `<bigint:${current}>`
                            }
                            return current
                        },
                    )
                    throw new Error(
                        `ReferenceModel scope matrix failed at seed=${seed} shape=${shape}; normalizedTrace=${trace}`,
                        { cause: error },
                    )
                }
            }
        }

        expect(coveredShapes).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7]))
        expect(coveredCandidates).toEqual(
            new Set([
                "undefined",
                "nan",
                "negative-zero",
                "number",
                "string",
                "function",
                "object",
                "symbol",
            ]),
        )
        expect(commandCounts).toHaveLength(32 * 8)
        expect(commandCounts.every(count => count >= 8 && count <= 24)).toBe(
            true,
        )
    })

    test("matches the unchanged ReferenceModel across deterministic scoped direct, transaction, and disposal traces", () => {
        const domain = createCommittedStoreTreeDomain()
        const atoms = {
            count: domain.atom(0),
            offset: domain.atom(5),
        }
        const root = domain.createStoreTree()
        const left = root.scope("left")
        const right = root.scope("right")
        let nested = left.scope("nested")
        let nestedGeneration = 1
        const stores: Record<string, CommittedStoreTree> = {
            root,
            left,
            right,
            nested,
        }
        const scopeIds: Record<string, string> = {
            root: "root",
            left: "left",
            right: "right",
            nested: "nested-1",
        }

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
        for (const command of [
            {
                kind: "create-scope",
                tree: "tree",
                parent: "root",
                scope: "left",
                name: "left",
            },
            {
                kind: "create-scope",
                tree: "tree",
                parent: "root",
                scope: "right",
                name: "right",
            },
            {
                kind: "create-scope",
                tree: "tree",
                parent: "left",
                scope: "nested-1",
                name: "nested",
            },
        ] as const) {
            expect(model.execute(command).ok).toBe(true)
        }

        let random = 0x5c0fed
        const next = (): number => {
            random = (Math.imul(random, 1_664_525) + 1_013_904_223) >>> 0
            return random
        }
        const scopeNames = ["root", "left", "right", "nested"] as const
        const atomNames = ["count", "offset"] as const
        const candidates = [Number.NaN, -0, 0, -7, -1, 1, 6, 13] as const

        const makeMutation = (): Readonly<{
            atom: (typeof atomNames)[number]
            model: Mutation
            actual(store: CommittedStoreTree | RootTransaction): void
        }> => {
            const atom = atomNames[next() % atomNames.length]!
            const operation = next() % 3
            if (operation === 0) {
                const candidate = candidates[next() % candidates.length]!
                return Object.freeze({
                    atom,
                    model: Object.freeze({
                        kind: "set-atom" as const,
                        atom,
                        value: value.number(candidate),
                    }),
                    actual: (store: CommittedStoreTree | RootTransaction) =>
                        store.set(atoms[atom], candidate),
                })
            }
            if (operation === 1) {
                const amount = (next() % 9) - 4
                return Object.freeze({
                    atom,
                    model: Object.freeze({
                        kind: "update-atom" as const,
                        atom,
                        updater: Object.freeze({
                            kind: "number-add" as const,
                            amount,
                        }),
                    }),
                    actual: (store: CommittedStoreTree | RootTransaction) =>
                        store.update(atoms[atom], current => current + amount),
                })
            }
            return Object.freeze({
                atom,
                model: Object.freeze({
                    kind: "reset-atom" as const,
                    atom,
                }),
                actual: (store: CommittedStoreTree | RootTransaction) =>
                    store.reset(atoms[atom]),
            })
        }

        for (let trace = 0; trace < 384; trace++) {
            if (trace > 0 && trace % 128 === 0) {
                const previousId = scopeIds.nested!
                nested.dispose()
                expect(
                    model.execute({
                        kind: "dispose",
                        tree: "tree",
                        scope: previousId,
                    }),
                ).toMatchObject({ ok: true })
                nestedGeneration++
                const nextId = `nested-${nestedGeneration}`
                nested = left.scope("nested")
                stores.nested = nested
                scopeIds.nested = nextId
                expect(
                    model.execute({
                        kind: "create-scope",
                        tree: "tree",
                        parent: "left",
                        scope: nextId,
                        name: "nested",
                    }),
                ).toMatchObject({ ok: true })
            }

            if (next() % 3 === 0) {
                const steps: TransactionStep[] = []
                const actual: Readonly<{
                    scope: (typeof scopeNames)[number]
                    mutation: ReturnType<typeof makeMutation>
                }>[] = []
                const width = (next() % 4) + 1
                for (let index = 0; index < width; index++) {
                    const scope = scopeNames[next() % scopeNames.length]!
                    const mutation = makeMutation()
                    const cursor = `${index}-${scope}`
                    steps.push({
                        kind: "resolve-cursor",
                        cursor,
                        target: {
                            kind: "scope",
                            tree: "tree",
                            scope: scopeIds[scope]!,
                        },
                    })
                    steps.push({
                        kind: "mutate",
                        cursor,
                        mutation: mutation.model,
                    })
                    actual.push(Object.freeze({ scope, mutation }))
                }
                root.txn(transaction => {
                    for (const operation of actual) {
                        operation.mutation.actual(
                            transaction.scope(stores[operation.scope]!),
                        )
                    }
                })
                expect(
                    model.execute({
                        kind: "transact",
                        tree: "tree",
                        entryScope: "root",
                        steps,
                    }),
                ).toMatchObject({ ok: true, committed: true })
            } else {
                const scope = scopeNames[next() % scopeNames.length]!
                const mutation = makeMutation()
                mutation.actual(stores[scope]!)
                expect(
                    model.execute({
                        kind: "mutate",
                        tree: "tree",
                        scope: scopeIds[scope]!,
                        mutation: mutation.model,
                    }),
                ).toMatchObject({ ok: true, committed: true })
            }

            for (const scope of scopeNames) {
                for (const atom of atomNames) {
                    const read = model.execute({
                        kind: "read",
                        tree: "tree",
                        scope: scopeIds[scope]!,
                        target: { kind: "atom", atom },
                        as: `${trace}-${scope}-${atom}`,
                    })
                    expect(read.ok).toBe(true)
                    const token = (
                        read.outcome as Readonly<{
                            kind: "value"
                            value: ValueToken
                        }>
                    ).value as Extract<ValueToken, { kind: "number" }>
                    expect(token.kind).toBe("number")
                    expect(
                        Object.is(stores[scope]!.get(atoms[atom]), token.value),
                    ).toBe(true)
                }
            }
        }
    })
})
