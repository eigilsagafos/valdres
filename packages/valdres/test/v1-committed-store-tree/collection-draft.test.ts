import { describe, expect, test } from "bun:test"
import { LeakDetector } from "../../../test/src/LeakDetector"
import { SelectorEvaluationSession } from "../../src/v1-internal/selector-evaluator/types"
import {
    createCollectionKernel,
    InvalidSynchronousCollectionValueError,
    MissingCollectionRowError,
    UndefinedCollectionValueError,
    type CollectionDraftKernel,
    type CollectionKernelBindings,
} from "../../src/v1-internal/collection-kernel"
import {
    createCollectionDefinition,
    getCollectionPresence,
    hasCollectionDefinitionRegistry,
} from "../../src/v1-internal/collection"
import {
    CallbackCapabilityError,
    InvalidTransactionCallbackResultError,
    RuntimeMismatchError,
    SubscriberNotificationError,
    TransactionClosedError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    ensureCollectionKernel,
    getCollectionKernel,
    registerDefinitionHandle,
    type RootTransaction,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    containThenable,
    inspectThenable,
    type AnyAtom,
    type ControlFaultSession,
    type OptionalCollectionVTable,
    type RuntimeDomainRecords,
} from "../../src/v1-internal/committed-store-tree/runtime-domain"
import type { StoreScopeNode } from "../../src/v1-internal/committed-store-tree/scope-node"
import {
    TreeDraft,
    createRootTransactionCursor,
    type TreeTransactionHost,
} from "../../src/v1-internal/committed-store-tree/tree-transaction"
import type { WeakMemberRuntime } from "../../src/v1-internal/weak-member-cache"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const fakeScope = (id: string): StoreScopeNode =>
    Object.freeze({ id }) as unknown as StoreScopeNode

const session = (): ControlFaultSession =>
    new SelectorEvaluationSession<object>()

const installedKernel = (
    domain: ReturnType<typeof createCommittedStoreTreeDomain>,
): CollectionDraftKernel => {
    const kernel = getCollectionKernel(domain)
    if (kernel === undefined)
        throw new Error("Collection kernel is not installed")
    return kernel as CollectionDraftKernel
}

type InternalRead = <Value>(state: object) => Value

const internalRead = <Value>(
    transaction: RootTransaction,
    state: object,
): Value => (transaction.get as unknown as InternalRead)<Value>(state)

const createFakeExtensionRuntime = (
    options: {
        readonly markIntentOnRead?: boolean
        readonly prepareError?: unknown
    } = {},
) => {
    const domain = createCommittedStoreTreeDomain()
    const handle = registerDefinitionHandle(domain, {
        kind: "collection-row" as const,
    })
    const readDrafts: TreeDraft[] = []
    const preparedDrafts: TreeDraft[] = []
    const releasedDrafts: TreeDraft[] = []
    let classifyCalls = 0
    const releaseDraft = (draftValue: object): void => {
        releasedDrafts.push(draftValue as TreeDraft)
    }
    const vtable: OptionalCollectionVTable = Object.freeze({
        has: (node: object): boolean => {
            classifyCalls++
            return Object.is(node, handle)
        },
        read: (draftValue: object, _scope: object, node: object) => {
            if (!Object.is(node, handle)) {
                throw new Error("Unexpected fake extension source")
            }
            const draft = draftValue as TreeDraft
            readDrafts.push(draft)
            draft.installRows(releaseDraft)
            if (options.markIntentOnRead === true) {
                draft.markRow(draft.generation)
            }
            return Object.freeze({ kind: "value" as const, value: "fake" })
        },
        stage: () => {
            throw new Error("Fake collection staging must not run")
        },
        scope: () => undefined,
        plan: (_host: object, draftValue: object) => {
            preparedDrafts.push(draftValue as TreeDraft)
            if (options.prepareError !== undefined) {
                throw options.prepareError
            }
            return undefined
        },
        release: releaseDraft,
    })
    ensureCollectionKernel(domain, () => vtable)
    return {
        domain,
        handle,
        readDrafts,
        preparedDrafts,
        releasedDrafts,
        classifyCalls: (): number => classifyCalls,
    }
}

describe("v1 optional collection draft kernel", () => {
    test("installs once only after a successful definition and remains live for pre-existing Stores", () => {
        const domain = createCommittedStoreTreeDomain()
        const preExistingStore = domain.createStoreTree()
        expect(preExistingStore).toBeDefined()
        expect(getCollectionKernel(domain)).toBeUndefined()
        expect(hasCollectionDefinitionRegistry(domain)).toBe(false)

        expect(() =>
            createCollectionDefinition(domain, {
                unknown: true,
            } as never),
        ).toThrow("unknown option")
        expect(getCollectionKernel(domain)).toBeUndefined()

        const constructionFailure = new Error("weak runtime failed")
        const failingWeakRuntime: WeakMemberRuntime = {
            ref: target => new WeakRef(target),
            registry: () => {
                throw constructionFailure
            },
        }
        expect(
            thrownBy(() =>
                createCollectionDefinition<string, number>(
                    domain,
                    undefined,
                    failingWeakRuntime,
                ),
            ),
        ).toBe(constructionFailure)
        expect(getCollectionKernel(domain)).toBeUndefined()
        expect(hasCollectionDefinitionRegistry(domain)).toBe(false)

        createCollectionDefinition<string, number>(domain)
        const first = installedKernel(domain)
        expect(hasCollectionDefinitionRegistry(domain)).toBe(true)
        expect(Object.isFrozen(first)).toBe(true)
        createCollectionDefinition<number, string>(domain)
        expect(installedKernel(domain)).toBe(first)

        const alias = new Proxy(domain, {}) as typeof domain
        const aliasRows = createCollectionDefinition<string, number>(alias)
        const aliasRow = aliasRows("alias")
        expect(hasCollectionDefinitionRegistry(alias)).toBe(true)
        expect(installedKernel(alias)).toBe(first)
        expect(first.has(aliasRow as never)).toBe(true)
        preExistingStore.txn(transaction => {
            expect(
                internalRead<number | undefined>(transaction, aliasRow),
            ).toBeUndefined()
        })

        const otherDomain = createCommittedStoreTreeDomain()
        createCollectionDefinition<string, number>(otherDomain)
        expect(installedKernel(otherDomain)).not.toBe(first)
    })

    test("keeps first-coordinate order, value-free sequence history, and collection-local membership memos", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const other = createCollectionDefinition<string, number>(domain)
        const kernel = installedKernel(domain)
        const scope = fakeScope("root")
        const draft = new TreeDraft()
        const rowA = sessions("A")
        const rowB = sessions("B")
        const rowC = sessions("C")
        const unrelated = other("X")

        const empty = kernel.readDraftCollection(draft, scope, sessions)
        expect(empty).toEqual([])
        expect(Object.isFrozen(empty)).toBe(true)
        expect(kernel.readDraftCollection(draft, scope, sessions)).toBe(empty)
        expect(kernel.hasDraftLane(draft)).toBe(true)
        expect(draft.hasRows).toBe(false)
        expect(draft.generation).toBe(0)

        kernel.stageSet(draft, scope, rowA, 1, session())
        expect(draft.generation).toBe(1)
        expect(kernel.readDraftRow(draft, scope, rowA)).toBe(1)
        expect(kernel.readDraftCollection(draft, scope, sessions)).toEqual([
            rowA,
        ])

        kernel.stageSet(draft, scope, rowB, 2, session())
        const firstAB = kernel.readDraftCollection(draft, scope, sessions)
        expect(firstAB).toEqual([rowA, rowB])
        kernel.stageUpdate(
            draft,
            scope,
            rowA,
            (value: number) => value + 10,
            session(),
        )
        expect(kernel.readDraftRow(draft, scope, rowA)).toBe(11)
        expect(kernel.readDraftCollection(draft, scope, sessions)).toBe(firstAB)

        const beforeSameValue = draft.generation
        kernel.stageSet(draft, scope, rowA, 11, session())
        expect(draft.generation).toBe(beforeSameValue)

        kernel.stageSet(draft, scope, rowC, Number.NaN, session())
        const firstABC = kernel.readDraftCollection(draft, scope, sessions)
        const beforeSameNaN = draft.generation
        kernel.stageSet(draft, scope, rowC, Number.NaN, session())
        expect(draft.generation).toBe(beforeSameNaN)
        kernel.stageSet(draft, scope, rowC, -0, session())
        expect(Object.is(kernel.readDraftRow(draft, scope, rowC), -0)).toBe(
            true,
        )
        kernel.stageSet(draft, scope, rowC, 0, session())
        expect(Object.is(kernel.readDraftRow(draft, scope, rowC), -0)).toBe(
            false,
        )
        expect(kernel.readDraftCollection(draft, scope, sessions)).toBe(
            firstABC,
        )

        kernel.stageSet(draft, scope, unrelated, 100, session())
        expect(kernel.readDraftCollection(draft, scope, sessions)).toBe(
            firstABC,
        )

        const inspection = kernel.inspectDraft(draft)
        expect(inspection?.planOrder.map(entry => entry.id)).toEqual([
            0, 1, 2, 3,
        ])
        expect(inspection?.history.map(event => event.sequence)).toEqual([
            0, 1, 2, 3, 4, 5, 6,
        ])
        for (const event of inspection?.history ?? []) {
            expect("value" in event).toBe(false)
        }
        expect(inspection?.revision(sessions)).toBe(3)
        expect(inspection?.revision(other)).toBe(1)

        const mixedDraft = new TreeDraft()
        const scratchGenerations: number[] = []
        mixedDraft.installScratchHost(scope, {
            readSelector: <Value>(): Value => undefined as Value,
            advanceGeneration: generation =>
                scratchGenerations.push(generation),
            revoke: () => {},
        })
        kernel.stageSet(mixedDraft, scope, rowA, 1, session())
        mixedDraft.stage(
            scope,
            Object.freeze({
                kind: "set" as const,
                atom: Object.freeze({ id: "atom" }) as unknown as AnyAtom,
                value: "atom",
                publishDraftFallback: false,
            }),
        )
        kernel.stageSet(mixedDraft, scope, rowB, 2, session())
        expect(
            kernel
                .inspectDraft(mixedDraft)
                ?.history.map(event => event.sequence),
        ).toEqual([0, 2])
        expect(mixedDraft.generation).toBe(3)
        expect(scratchGenerations).toEqual([1, 2, 3])

        const readBeforeWriteDraft = new TreeDraft()
        expect(
            kernel.readDraftRow(readBeforeWriteDraft, scope, rowB),
        ).toBeUndefined()
        expect(kernel.inspectDraft(readBeforeWriteDraft)?.planOrder).toEqual([])
        kernel.stageSet(readBeforeWriteDraft, scope, rowA, 1, session())
        kernel.stageSet(readBeforeWriteDraft, scope, rowB, 2, session())
        expect(
            kernel
                .inspectDraft(readBeforeWriteDraft)
                ?.planOrder.map(entry => entry.id),
        ).toEqual([1, 0])
        expect(
            kernel.readDraftCollection(readBeforeWriteDraft, scope, sessions),
        ).toEqual([rowA, rowB])

        kernel.stageDelete(draft, scope, rowA)
        expect(kernel.readDraftCollection(draft, scope, sessions)).toEqual([
            rowB,
            rowC,
        ])
        kernel.stageSet(draft, scope, rowA, 12, session())
        expect(kernel.readDraftCollection(draft, scope, sessions)).toEqual([
            rowB,
            rowC,
            rowA,
        ])
        expect(
            kernel.inspectDraft(draft)?.planOrder.find(entry => entry.id === 0)
                ?.enablingBirth,
        ).toBe(8)
    })

    test("admits only synchronous defined values and never invokes an absent-row updater", () => {
        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, number>(domain)
        const kernel = installedKernel(domain)
        const scope = fakeScope("root")
        const draft = new TreeDraft()
        const missing = rows("missing")
        const present = rows("present")
        let updaterCalls = 0

        const missingError = thrownBy(() =>
            kernel.stageUpdate(
                draft,
                scope,
                missing,
                () => {
                    updaterCalls++
                    return 1
                },
                session(),
            ),
        )
        expect(missingError).toBeInstanceOf(MissingCollectionRowError)
        expect(missingError).toMatchObject({
            code: "VALDRES_MISSING_COLLECTION_ROW",
        })
        expect(updaterCalls).toBe(0)
        expect(draft.generation).toBe(0)
        expect(kernel.inspectDraft(draft)?.history).toEqual([])

        const undefinedError = thrownBy(() =>
            kernel.stageSet(draft, scope, present, undefined, session()),
        )
        expect(undefinedError).toBeInstanceOf(UndefinedCollectionValueError)
        expect(undefinedError).toMatchObject({
            code: "VALDRES_UNDEFINED_COLLECTION_VALUE",
        })
        expect(Object.isFrozen(undefinedError)).toBe(true)
        expect(draft.generation).toBe(0)

        let contained = 0
        const thenable = {
            then(_resolve: unknown, reject: () => void): void {
                contained++
                reject()
            },
        }
        const thenableError = thrownBy(() =>
            kernel.stageSet(draft, scope, present, thenable, session()),
        )
        expect(thenableError).toBeInstanceOf(
            InvalidSynchronousCollectionValueError,
        )
        expect(thenableError).toMatchObject({
            code: "VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE",
        })
        expect(contained).toBe(1)
        expect(draft.generation).toBe(0)

        kernel.stageSet(draft, scope, present, 1, session())
        const admittedGeneration = draft.generation
        const sentinel = new Error("updater failed")
        expect(
            thrownBy(() =>
                kernel.stageUpdate(
                    draft,
                    scope,
                    present,
                    () => {
                        throw sentinel
                    },
                    session(),
                ),
            ),
        ).toBe(sentinel)
        expect(draft.generation).toBe(admittedGeneration)
        expect(kernel.readDraftRow(draft, scope, present)).toBe(1)

        const returnedThenable = thrownBy(() =>
            kernel.stageUpdate(
                draft,
                scope,
                present,
                () => thenable,
                session(),
            ),
        )
        expect(returnedThenable).toBeInstanceOf(
            InvalidSynchronousCollectionValueError,
        )
        expect(contained).toBe(2)
        const thrownThenable = thrownBy(() =>
            kernel.stageUpdate(
                draft,
                scope,
                present,
                () => {
                    throw thenable
                },
                session(),
            ),
        )
        expect(thrownThenable).toBeInstanceOf(
            InvalidSynchronousCollectionValueError,
        )
        expect(contained).toBe(3)
        expect(draft.generation).toBe(admittedGeneration)

        const store = domain.createStoreTree()
        const atom = domain.atom(0)
        const capabilityError = thrownBy(() =>
            kernel.stageUpdate(
                draft,
                scope,
                present,
                () => store.get(atom),
                session(),
            ),
        )
        expect(capabilityError).toBeInstanceOf(CallbackCapabilityError)
        expect(draft.generation).toBe(admittedGeneration)
        expect(kernel.readDraftRow(draft, scope, present)).toBe(1)
    })

    test("keeps local and effective baselines distinct and refreshes birth only after an effective gap", () => {
        const collection = Object.freeze({ kind: "collection" })
        const inherited = Object.freeze({ kind: "collection-row", id: "I" })
        const owned = Object.freeze({ kind: "collection-row", id: "O" })
        const masked = Object.freeze({ kind: "collection-row", id: "M" })
        const rowCollections = new WeakMap<object, object>([
            [inherited, collection],
            [owned, collection],
            [masked, collection],
        ])
        const bindings: CollectionKernelBindings = {
            lookupRow: row => rowCollections.get(row as object),
            lookupCollection: candidate => Object.is(candidate, collection),
            runGuarded: (_session, operation) => operation(),
            inspectThenable,
            containThenable,
        }
        const kernel = createCollectionKernel(bindings, (_scope, row) =>
            Object.is(row, inherited)
                ? Object.freeze({
                      local: Object.freeze({ kind: "none" as const }),
                      effective: Object.freeze({
                          kind: "present" as const,
                          value: "parent",
                      }),
                      inherited: Object.freeze({
                          kind: "present" as const,
                          value: "parent",
                      }),
                  })
                : Object.is(row, owned)
                  ? Object.freeze({
                        local: Object.freeze({
                            kind: "present" as const,
                            value: "owned",
                        }),
                        effective: Object.freeze({
                            kind: "present" as const,
                            value: "owned",
                        }),
                        inherited: Object.freeze({
                            kind: "absent" as const,
                        }),
                    })
                  : Object.freeze({
                        local: Object.freeze({ kind: "absent" as const }),
                        effective: Object.freeze({ kind: "absent" as const }),
                        inherited: Object.freeze({
                            kind: "present" as const,
                            value: "parent",
                        }),
                    }),
        )
        const scope = fakeScope("child")
        const draft = new TreeDraft()

        const memoDraft = new TreeDraft()
        const undiscoveredEmpty = kernel.readDraftCollection(
            memoDraft,
            scope,
            collection,
        )
        expect(undiscoveredEmpty).toEqual([])
        expect(kernel.readDraftRow(memoDraft, scope, inherited)).toBe("parent")
        expect(memoDraft.generation).toBe(0)
        expect(memoDraft.hasRows).toBe(false)
        expect(kernel.inspectDraft(memoDraft)?.planOrder).toEqual([])
        expect(
            kernel
                .inspectDraft(memoDraft)
                ?.discoveryOrder.map(entry => entry.id),
        ).toEqual([0])
        const discoveredMembership = kernel.readDraftCollection(
            memoDraft,
            scope,
            collection,
        )
        expect(discoveredMembership).toBe(undiscoveredEmpty)

        expect(kernel.readDraftRow(draft, scope, inherited)).toBe("parent")
        const baselineMembership = kernel.readDraftCollection(
            draft,
            scope,
            collection,
        )
        expect(baselineMembership).toEqual([])
        const baseline = kernel.inspectDraft(draft)?.discoveryOrder[0]
        expect(baseline?.baselineLocal).toBe("none")
        expect(baseline?.baselineEffective).toBe("present")

        kernel.stageUpdate(draft, scope, inherited, () => "child", session())
        expect(kernel.readDraftCollection(draft, scope, collection)).toBe(
            baselineMembership,
        )
        expect(kernel.inspectDraft(draft)?.planOrder[0]?.enablingBirth).toBe(
            "baseline",
        )

        kernel.stageDelete(draft, scope, inherited)
        expect(kernel.readDraftCollection(draft, scope, collection)).toBe(
            baselineMembership,
        )
        kernel.stageReset(draft, scope, inherited)
        expect(kernel.readDraftRow(draft, scope, inherited)).toBe("parent")
        expect(kernel.readDraftCollection(draft, scope, collection)).toEqual([
            inherited,
        ])
        expect(kernel.inspectDraft(draft)?.planOrder[0]?.enablingBirth).toBe(2)

        const ownedDraft = new TreeDraft()
        expect(kernel.readDraftRow(ownedDraft, scope, owned)).toBe("owned")
        kernel.stageReset(ownedDraft, scope, owned)
        expect(kernel.readDraftRow(ownedDraft, scope, owned)).toBeUndefined()
        expect(kernel.inspectDraft(ownedDraft)?.history).toMatchObject([
            { kind: "reset", sequence: 0 },
        ])

        const maskedDraft = new TreeDraft()
        expect(kernel.readDraftRow(maskedDraft, scope, masked)).toBeUndefined()
        expect(kernel.inspectDraft(maskedDraft)?.discoveryOrder).toMatchObject([
            {
                baselineLocal: "absent",
                baselineEffective: "absent",
                baselineInherited: "present",
            },
        ])
        kernel.stageReset(maskedDraft, scope, masked)
        expect(kernel.readDraftRow(maskedDraft, scope, masked)).toBe("parent")

        const invalidBaselines = [
            Object.freeze({
                baseline: Object.freeze({
                    local: Object.freeze({
                        kind: "present" as const,
                        value: "local",
                    }),
                    effective: Object.freeze({
                        kind: "present" as const,
                        value: "different",
                    }),
                    inherited: Object.freeze({ kind: "absent" as const }),
                }),
                message:
                    "Collection present local baseline must equal its effective outcome",
            }),
            Object.freeze({
                baseline: Object.freeze({
                    local: Object.freeze({
                        kind: "present" as const,
                        value: "local",
                    }),
                    effective: Object.freeze({ kind: "absent" as const }),
                    inherited: Object.freeze({ kind: "absent" as const }),
                }),
                message:
                    "Collection present local baseline must equal its effective outcome",
            }),
            Object.freeze({
                baseline: Object.freeze({
                    local: Object.freeze({ kind: "absent" as const }),
                    effective: Object.freeze({
                        kind: "present" as const,
                        value: "impossible",
                    }),
                    inherited: Object.freeze({ kind: "absent" as const }),
                }),
                message:
                    "Collection absent local baseline must be effectively absent",
            }),
        ]
        for (const invalid of invalidBaselines) {
            const invalidKernel = createCollectionKernel(
                bindings,
                () => invalid.baseline,
            )
            const invalidDraft = new TreeDraft()
            expect(() =>
                invalidKernel.readDraftRow(invalidDraft, scope, inherited),
            ).toThrow(invalid.message)
            expect(invalidDraft.generation).toBe(0)
            expect(invalidDraft.hasRows).toBe(false)
            expect(invalidKernel.inspectDraft(invalidDraft)?.planOrder).toEqual(
                [],
            )
            invalidDraft.release()
            expect(invalidKernel.hasDraftLane(invalidDraft)).toBe(false)
        }
    })

    test("reuses a memo when an unread intent sequence returns to the same final membership", () => {
        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, number>(domain)
        const kernel = installedKernel(domain)
        const scope = fakeScope("root")
        const row = rows("net-zero")
        const draft = new TreeDraft()
        const empty = kernel.readDraftCollection(draft, scope, rows)

        kernel.stageSet(draft, scope, row, 1, session())
        kernel.stageDelete(draft, scope, row)
        expect(kernel.readDraftCollection(draft, scope, rows)).toBe(empty)
        kernel.stageReset(draft, scope, row)
        expect(kernel.readDraftCollection(draft, scope, rows)).toBe(empty)
        expect(
            kernel.inspectDraft(draft)?.history.map(event => event.kind),
        ).toEqual(["present", "absent", "reset"])
    })

    test("releases read-only and staged lanes even while a closed cursor retains its TreeDraft", async () => {
        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, object>(domain)
        const kernel = installedKernel(domain)
        const scope = fakeScope("root")
        const row = rows("retained")
        const orphan = new TreeDraft()
        expect(() => orphan.markRow(0)).toThrow(Error)
        expect(orphan.generation).toBe(0)
        expect(orphan.hasRows).toBe(false)
        const draft = new TreeDraft()
        const runtimeDomain: RuntimeDomainRecords = {
            states: new WeakSet(),
            atoms: new WeakMap(),
            selectors: new WeakMap(),
            stores: new WeakMap(),
            transactionCursors: new WeakMap(),
            ownerToken: Object.freeze({}),
            activity: undefined,
        }
        const host = {
            runtimeDomain,
        } as unknown as TreeTransactionHost
        const cursor = createRootTransactionCursor(host, draft, scope)
        let retainedInspection: ReturnType<
            CollectionDraftKernel["inspectDraft"]
        >
        const detector = (() => {
            let stagedValue: object | undefined = Object.freeze({
                private: true,
            })
            const detector = new LeakDetector(stagedValue)
            kernel.stageSet(draft, scope, row, stagedValue, session())
            retainedInspection = kernel.inspectDraft(draft)
            stagedValue = undefined
            return detector
        })()
        kernel.readDraftCollection(draft, scope, rows)
        expect(JSON.stringify(retainedInspection)).not.toContain("private")
        expect(JSON.stringify(retainedInspection)).not.toContain("retained")
        expect(
            Reflect.ownKeys(retainedInspection!.planOrder[0] ?? {}),
        ).not.toContain("row")
        expect(
            Reflect.ownKeys(retainedInspection!.planOrder[0] ?? {}),
        ).not.toContain("collection")
        expect(kernel.hasDraftLane(draft)).toBe(true)
        expect(runtimeDomain.transactionCursors.get(cursor as object)).toBe(
            draft,
        )
        draft.close()
        draft.release()
        expect(kernel.hasDraftLane(draft)).toBe(false)
        expect(kernel.inspectDraft(draft)).toBeUndefined()
        expect(draft.hasRows).toBe(false)
        expect(runtimeDomain.transactionCursors.get(cursor as object)).toBe(
            draft,
        )
        expect(await detector.isLeaking()).toBe(false)
        expect(retainedInspection?.planOrder).toMatchObject([
            { id: 0, final: "present" },
        ])
        draft.release()
        expect(kernel.hasDraftLane(draft)).toBe(false)

        const readOnlyDraft = new TreeDraft()
        kernel.readDraftCollection(readOnlyDraft, scope, rows)
        expect(readOnlyDraft.hasRows).toBe(false)
        expect(kernel.hasDraftLane(readOnlyDraft)).toBe(true)
        readOnlyDraft.release()
        expect(kernel.hasDraftLane(readOnlyDraft)).toBe(false)

        const collisionDraft = new TreeDraft()
        let otherReleaseCalls = 0
        collisionDraft.installRows(() => {
            otherReleaseCalls++
        })
        expect(() =>
            kernel.readDraftCollection(collisionDraft, scope, rows),
        ).toThrow(Error)
        expect(kernel.hasDraftLane(collisionDraft)).toBe(false)
        collisionDraft.release()
        expect(otherReleaseCalls).toBe(1)
    })

    test("reads real row, collection, and presence sources through one live scratch domain", () => {
        const domain = createCommittedStoreTreeDomain()
        const instrumentation = createInternalStoreTreeInstrumentation()
        const store = domain.createStoreTree(instrumentation)
        const rows = createCollectionDefinition<string, number>(domain)
        const row = rows("A")
        const presence = getCollectionPresence(domain, row)
        const atom = domain.atom(0)
        const rowSelector = domain.selector(get => {
            const read = get as unknown as InternalRead
            return read<number | undefined>(row) ?? -1
        })
        const collectionSelector = domain.selector(get => {
            const read = get as unknown as InternalRead
            return read<readonly object[]>(rows).length
        })
        let retainedCursor: RootTransaction | undefined

        store.txn(transaction => {
            retainedCursor = transaction
            expect(internalRead(transaction, row)).toBeUndefined()
            const empty = internalRead<readonly object[]>(transaction, rows)
            expect(empty).toEqual([])
            expect(Object.isFrozen(empty)).toBe(true)
            expect(internalRead<readonly object[]>(transaction, rows)).toBe(
                empty,
            )
            expect(transaction.get(presence)).toBe(false)
            expect(transaction.get(rowSelector)).toBe(-1)
            expect(transaction.get(collectionSelector)).toBe(0)

            transaction.set(atom, 1)
            expect(internalRead<readonly object[]>(transaction, rows)).toBe(
                empty,
            )
            expect(transaction.get(presence)).toBe(false)
            expect(transaction.get(rowSelector)).toBe(-1)
            expect(transaction.get(collectionSelector)).toBe(0)
        })
        expect(store.get(atom)).toBe(1)
        expect(instrumentation.read("scratchHostAllocations")).toBe(1)

        expect(() => internalRead(retainedCursor!, row)).toThrow(
            TransactionClosedError,
        )
        const fakeLocal = registerDefinitionHandle(domain, {
            kind: "collection-row" as const,
        })
        expect(() =>
            store.txn(transaction => internalRead(transaction, fakeLocal)),
        ).toThrow(TypeError)

        const foreignDomain = createCommittedStoreTreeDomain()
        const foreignRows = createCollectionDefinition<string, number>(
            foreignDomain,
        )
        const foreignRow = foreignRows("foreign")
        expect(() =>
            store.txn(transaction => internalRead(transaction, foreignRow)),
        ).toThrow(RuntimeMismatchError)

        const hydrationRead = domain.adapter
            .readHydrationSnapshot as unknown as (
            target: object,
            state: object,
        ) => unknown
        const scratchBeforeHydration = instrumentation.read(
            "scratchHostAllocations",
        )
        expect(hydrationRead(store, row)).toBeUndefined()
        expect(hydrationRead(store, rows)).toEqual([])
        expect(instrumentation.read("scratchHostAllocations")).toBe(
            scratchBeforeHydration,
        )
        expect(domain.adapter.readHydrationSnapshot(store, presence)).toBe(
            false,
        )
        expect(domain.adapter.readHydrationSnapshot(store, rowSelector)).toBe(
            -1,
        )
        expect(
            domain.adapter.readHydrationSnapshot(store, collectionSelector),
        ).toBe(0)
        expect(instrumentation.read("scratchHostAllocations")).toBe(
            scratchBeforeHydration + 3,
        )
    })

    test("keeps discovered baselines out of scratch collection membership", () => {
        const domain = createCommittedStoreTreeDomain()
        const collection = registerDefinitionHandle(domain, {
            kind: "collection" as const,
        })
        const row = registerDefinitionHandle(domain, {
            kind: "collection-row" as const,
        })
        const rowCollections = new WeakMap<object, object>([[row, collection]])
        const kernel = createCollectionKernel(
            {
                lookupRow: candidate => rowCollections.get(candidate as object),
                lookupCollection: candidate => Object.is(candidate, collection),
                runGuarded: (_session, operation) => operation(),
                inspectThenable,
                containThenable,
            },
            () =>
                Object.freeze({
                    local: Object.freeze({ kind: "none" as const }),
                    effective: Object.freeze({
                        kind: "present" as const,
                        value: "baseline",
                    }),
                    inherited: Object.freeze({
                        kind: "present" as const,
                        value: "baseline",
                    }),
                }),
        )
        ensureCollectionKernel(domain, () => kernel)
        const store = domain.createStoreTree()
        const atom = domain.atom(0)
        const membership = domain.selector(
            get =>
                (get as unknown as InternalRead)<readonly object[]>(collection)
                    .length,
        )
        const collectionThenRow = domain.selector(get => {
            const read = get as unknown as InternalRead
            const count = read<readonly object[]>(collection).length
            read<string | undefined>(row)
            return count
        })

        store.txn(transaction => {
            expect(transaction.get(membership)).toBe(0)
            expect(internalRead<string | undefined>(transaction, row)).toBe(
                "baseline",
            )
            const empty = internalRead<readonly object[]>(
                transaction,
                collection,
            )
            expect(empty).toEqual([])
            expect(transaction.get(membership)).toBe(0)
            expect(transaction.get(collectionThenRow)).toBe(0)

            transaction.set(atom, 1)
            expect(transaction.get(membership)).toBe(0)
            expect(transaction.get(collectionThenRow)).toBe(0)
            expect(
                internalRead<readonly object[]>(transaction, collection),
            ).toBe(empty)
        })
    })

    test("runs collection preflight before any Atom publication or owner mutation", () => {
        const preflightError = new Error("collection preflight failed")
        const fake = createFakeExtensionRuntime({
            markIntentOnRead: true,
            prepareError: preflightError,
        })
        const instrumentation = createInternalStoreTreeInstrumentation()
        const store = fake.domain.createStoreTree(instrumentation)
        let fallbackCalls = 0
        const atom = fake.domain.atomLazy(() => {
            fallbackCalls++
            return -1
        })
        let retainedCursor: RootTransaction | undefined

        const error = thrownBy(() =>
            store.txn(transaction => {
                retainedCursor = transaction
                expect(internalRead<string>(transaction, fake.handle)).toBe(
                    "fake",
                )
                transaction.set(atom, 42)
            }),
        )
        expect(error).toBe(preflightError)
        expect(fake.readDrafts).toHaveLength(1)
        expect(fake.preparedDrafts).toEqual(fake.readDrafts)
        expect(fake.releasedDrafts).toEqual(fake.readDrafts)
        expect(fallbackCalls).toBe(1)
        expect(instrumentation.read("fallbackPublications")).toBe(0)
        expect(instrumentation.read("sourceEpoch")).toBe(0)
        expect(instrumentation.read("propagationSettlements")).toBe(0)
        expect(instrumentation.read("notificationSnapshots")).toBe(0)
        expect(instrumentation.read("subscriberCallbacksAttempted")).toBe(0)
        expect(store.get(atom)).toBe(-1)
        expect(fallbackCalls).toBe(2)
        expect(() => internalRead(retainedCursor!, fake.handle)).toThrow(
            TransactionClosedError,
        )
        expect(fake.releasedDrafts).toHaveLength(1)
    })

    test("stages one row across 1k, 5k, and 20k sibling scopes without quadratic fanout", () => {
        const collection = Object.freeze({ kind: "collection" })
        const row = Object.freeze({ kind: "collection-row" })
        const rowCollections = new WeakMap<object, object>([[row, collection]])
        const kernel = createCollectionKernel({
            lookupRow: candidate => rowCollections.get(candidate as object),
            lookupCollection: candidate => Object.is(candidate, collection),
            runGuarded: (_session, operation) => operation(),
            inspectThenable,
            containThenable,
        })
        const root = Object.freeze({ parent: undefined })
        const measure = (count: number): number => {
            const scopes = Array.from({ length: count }, () =>
                Object.freeze({ parent: root }),
            ) as unknown as StoreScopeNode[]
            const draft = new TreeDraft()
            const started = performance.now()
            for (let index = 0; index < count; index++) {
                kernel.stageSet(
                    draft,
                    scopes[index] as StoreScopeNode,
                    row,
                    index,
                    session(),
                )
            }
            const elapsed = performance.now() - started
            draft.release()
            return elapsed
        }

        const oneThousand = measure(1_000)
        const fiveThousand = measure(5_000)
        const twentyThousand = measure(20_000)
        expect(fiveThousand).toBeLessThan(Math.max(500, oneThousand * 8))
        expect(twentyThousand).toBeLessThan(Math.max(1_000, fiveThousand * 6))
    }, 15_000)

    test("releases actual read-only lanes on every transaction exit path", () => {
        const fake = createFakeExtensionRuntime()
        const instrumentation = createInternalStoreTreeInstrumentation()
        const store = fake.domain.createStoreTree(instrumentation)
        const atom = fake.domain.atom(0)
        let retainedCursor: RootTransaction | undefined

        store.txn(transaction => {
            expect(transaction.get(atom)).toBe(0)
        })
        expect(fake.domain.adapter.readHydrationSnapshot(store, atom)).toBe(0)
        expect(fake.classifyCalls()).toBe(0)
        expect(fake.releasedDrafts).toEqual([])

        store.txn(transaction => {
            retainedCursor = transaction
            expect(internalRead<string>(transaction, fake.handle)).toBe("fake")
        })
        expect(fake.releasedDrafts).toHaveLength(1)

        const abortError = new Error("transaction callback aborted")
        expect(
            thrownBy(() =>
                store.txn(transaction => {
                    internalRead(transaction, fake.handle)
                    throw abortError
                }),
            ),
        ).toBe(abortError)
        expect(fake.releasedDrafts).toHaveLength(2)

        let contained = 0
        const invalidResult = {
            then(_resolve: unknown, reject: () => void): void {
                contained++
                reject()
            },
        }
        const resultError = thrownBy(() =>
            store.txn(transaction => {
                internalRead(transaction, fake.handle)
                return invalidResult as never
            }),
        )
        expect(resultError).toBeInstanceOf(
            InvalidTransactionCallbackResultError,
        )
        expect(contained).toBe(1)
        expect(fake.releasedDrafts).toHaveLength(3)

        const subscriberError = new Error("subscriber failed")
        const unsubscribe = store.sub(atom, () => {
            throw subscriberError
        })
        const notificationError = thrownBy(() =>
            store.txn(transaction => {
                internalRead(transaction, fake.handle)
                transaction.set(atom, 1)
            }),
        )
        expect(notificationError).toBeInstanceOf(SubscriberNotificationError)
        expect(notificationError).toMatchObject({ cause: subscriberError })
        expect(store.get(atom)).toBe(1)
        unsubscribe()
        expect(fake.releasedDrafts).toHaveLength(4)
        expect(new Set(fake.releasedDrafts).size).toBe(4)
        expect(fake.preparedDrafts).toEqual([])

        expect(() => internalRead(retainedCursor!, fake.handle)).toThrow(
            TransactionClosedError,
        )
        expect(fake.releasedDrafts).toHaveLength(4)
        expect(instrumentation.read("subscriberCallbacksAttempted")).toBe(1)
    })
})
