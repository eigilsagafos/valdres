import {
    SubscriberNotificationError,
    atom,
    collection,
    presence,
    type Atom,
    type Collection,
    type CollectionKey as RuntimeCollectionKey,
    type CollectionRow,
    type CollectionValue,
    type State,
    type Store,
    type Transaction,
} from "../../src/index"
import {
    createInspectableStore,
    type CollectionSourceInspectionDetail,
    type InspectionDetail,
    type InspectionExport,
    type InspectionReference,
    type InspectionSummary,
} from "../../src/inspect"
import type { CollectionProgram } from "../v1-model/collection-programs"
import type {
    AtomId,
    CollectionId,
    CollectionKey,
    Command,
    Mutation,
    ObservableEvent,
    ReadOutcome,
    RowId,
    ScopeId,
    TargetRef,
    TransactionStep,
    TreeId,
    UpdaterSpec,
    ValueToken,
} from "../v1-model/protocol"

type RuntimeAtom = Atom<unknown>
type RuntimeCollection = Collection<
    RuntimeCollectionKey,
    CollectionValue,
    RuntimeCollectionKey
>
type RuntimeRow = CollectionRow<RuntimeCollectionKey, CollectionValue>
type RuntimePort = Pick<
    Transaction,
    "get" | "set" | "update" | "reset" | "delete"
>

export type RuntimeReadOutcome =
    | Exclude<ReadOutcome, { readonly kind: "rows" }>
    | Readonly<{
          kind: "rows"
          rows: readonly RowId[]
          /** The actual frozen array returned by the public runtime. */
          snapshot: readonly unknown[]
      }>

type RuntimeObservationRead = Readonly<{
    as: string
    outcome: RuntimeReadOutcome
}>

export type RuntimeObservableEvent =
    | Readonly<{ kind: "read"; as: string; outcome: RuntimeReadOutcome }>
    | Extract<ObservableEvent, { readonly kind: "attempt-error" }>
    | Extract<ObservableEvent, { readonly kind: "notifications" }>
    | Readonly<{
          kind: "notification-observation"
          subscription: string
          reads: readonly RuntimeObservationRead[]
      }>
    | Extract<ObservableEvent, { readonly kind: "transaction" }>
    | Extract<ObservableEvent, { readonly kind: "disposed" }>

export interface RuntimeCommandResult {
    readonly ok: boolean
    readonly outcome?: RuntimeReadOutcome
    readonly value?: ValueToken
    readonly error?: string
    readonly committed?: boolean
    readonly row?: RowId
    readonly key?: CollectionKey
}

export type RuntimeMaterializationStage =
    | "pre-commit-or-no-commit"
    | "phase0"
    | "rewire"
    | "subscriber"

export interface RuntimeMaterializedCoordinate {
    readonly scope: ScopeId
    readonly collection: CollectionId
    readonly row?: RowId
    readonly source: "row" | "membership"
    readonly stage: RuntimeMaterializationStage
    readonly sequence: number
    readonly operationId?: number
    readonly commitId?: number
    readonly detail: CollectionSourceInspectionDetail
}

export interface RuntimeCommandFailureContext {
    readonly commandIndex: number
    readonly command: Command
    readonly prefix: readonly Command[]
    readonly error: string
    readonly committed: boolean
}

export interface RuntimeCommandExecution {
    readonly commandIndex: number
    readonly command: Command
    readonly result: RuntimeCommandResult
    readonly trace: readonly RuntimeObservableEvent[]
    readonly details: readonly InspectionDetail[]
    readonly summaries: readonly InspectionSummary[]
    readonly materializations: readonly RuntimeMaterializedCoordinate[]
    readonly report: InspectionExport
    readonly failure?: RuntimeCommandFailureContext
}

export interface RuntimeSubscriptionMetadata {
    readonly id: string
    readonly tree: TreeId
    readonly scope: ScopeId
    readonly target: TargetRef
    readonly observe: readonly Readonly<{
        scope: ScopeId
        target: TargetRef
        as: string
    }>[]
    readonly active: boolean
    readonly notifications: number
}

export interface CollectionRuntimeDriver {
    readonly trace: readonly RuntimeObservableEvent[]
    readonly executions: readonly RuntimeCommandExecution[]
    readonly materializedCoordinates: readonly RuntimeMaterializedCoordinate[]
    execute(command: Command): RuntimeCommandExecution
    report(): InspectionExport
    subscription(id: string): RuntimeSubscriptionMetadata | undefined
    scopeId(reference: InspectionReference | number): ScopeId | undefined
    rowId(reference: InspectionReference | number): RowId | undefined
    collectionId(
        reference: InspectionReference | number,
    ): CollectionId | undefined
}

export interface CollectionRuntimeProgramResult {
    readonly name: string
    readonly executions: readonly RuntimeCommandExecution[]
    readonly results: readonly RuntimeCommandResult[]
    readonly trace: readonly RuntimeObservableEvent[]
    readonly materializedCoordinates: readonly RuntimeMaterializedCoordinate[]
    readonly failures: readonly RuntimeCommandFailureContext[]
    readonly report: InspectionExport
}

interface ScopeRecord {
    readonly id: ScopeId
    readonly tree: TreeId
    readonly store: Store
    readonly parent: ScopeId | null
    readonly children: ScopeId[]
    readonly name: string | undefined
    disposed: boolean
}

interface TreeRecord {
    readonly id: TreeId
    readonly root: ScopeId
    disposed: boolean
}

interface SubscriptionRecord {
    readonly id: string
    readonly tree: TreeId
    readonly scope: ScopeId
    readonly target: TargetRef
    readonly observe: readonly Readonly<{
        scope: ScopeId
        target: TargetRef
        as: string
    }>[]
    readonly unsubscribe: () => void
    active: boolean
    notifications: number
}

interface TransactionContext {
    readonly tree: TreeRecord
    readonly cursors: Map<string, Transaction>
    result?: ValueToken
}

class RuntimeProgramFault extends Error {
    constructor(readonly code: string) {
        super(code)
    }
}

const freeze = <Value>(value: Value): Readonly<Value> => Object.freeze(value)

const referenceId = (reference: InspectionReference | number): number =>
    typeof reference === "number" ? reference : reference.id

const detailSequence = (detail: InspectionDetail): number =>
    detail.sequence ?? detail.seqStart ?? 0

const errorCodeMap: Readonly<Record<string, string>> = Object.freeze({
    VALDRES_INVALID_COLLECTION_KEY: "INVALID_COLLECTION_KEY",
    VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE:
        "INVALID_SYNC_COLLECTION_VALUE",
    VALDRES_UNDEFINED_COLLECTION_VALUE: "UNDEFINED_COLLECTION_VALUE",
    VALDRES_MISSING_COLLECTION_ROW: "MISSING_COLLECTION_ROW",
    VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE: "INVALID_SYNC_ATOM_VALUE",
    VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT:
        "INVALID_TRANSACTION_CALLBACK_RESULT",
    VALDRES_INVALID_TRANSACTION_TARGET: "INVALID_TRANSACTION_TARGET",
    VALDRES_RUNTIME_MISMATCH: "RUNTIME_MISMATCH",
    VALDRES_SCOPE_NOT_FOUND: "SCOPE_NOT_FOUND",
    VALDRES_STORE_DISPOSED: "STORE_DISPOSED",
    VALDRES_STORE_TREE_MISMATCH: "STORE_TREE_MISMATCH",
    VALDRES_TRANSACTION_CLOSED: "TRANSACTION_CLOSED",
    VALDRES_TRANSACTION_PHASE: "TRANSACTION_PHASE",
})

class CollectionRuntimeDriverImpl implements CollectionRuntimeDriver {
    readonly #root: Store
    readonly #inspect: ReturnType<typeof createInspectableStore>["inspect"]
    readonly #atoms = new Map<AtomId, RuntimeAtom>()
    readonly #collections = new Map<CollectionId, RuntimeCollection>()
    readonly #rows = new Map<RowId, RuntimeRow>()
    readonly #rowIds = new Map<object, RowId>()
    readonly #presences = new Map<RowId, State<boolean>>()
    readonly #trees = new Map<TreeId, TreeRecord>()
    readonly #scopes = new Map<ScopeId, ScopeRecord>()
    readonly #subscriptions = new Map<string, SubscriptionRecord>()
    readonly #identityValues = new Map<string, unknown>()
    readonly #identityTokens = new Map<unknown, ValueToken>()
    readonly #scopeIdsByReference = new Map<number, ScopeId>()
    readonly #rowIdsByReference = new Map<number, RowId>()
    readonly #collectionIdsByReference = new Map<number, CollectionId>()
    readonly #trace: RuntimeObservableEvent[] = []
    readonly #executions: RuntimeCommandExecution[] = []
    readonly #materialized: RuntimeMaterializedCoordinate[] = []
    readonly #executedCommands: Command[] = []
    #summaryCount = 0
    #detailCount = 0
    #notifications: string[] | undefined

    constructor() {
        const fixture = createInspectableStore({
            capacity: { summaries: 100_000, details: 1_000_000 },
        })
        this.#root = fixture.store
        this.#inspect = fixture.inspect
    }

    get trace(): readonly RuntimeObservableEvent[] {
        return Object.freeze([...this.#trace])
    }

    get executions(): readonly RuntimeCommandExecution[] {
        return Object.freeze([...this.#executions])
    }

    get materializedCoordinates(): readonly RuntimeMaterializedCoordinate[] {
        return Object.freeze([...this.#materialized])
    }

    report(): InspectionExport {
        const report = this.#inspect.export()
        if (!report.complete || report.fault !== undefined) {
            throw new Error(
                `Incomplete public-runtime inspection recording: ${JSON.stringify(
                    report.overflow,
                )}`,
            )
        }
        return report
    }

    subscription(id: string): RuntimeSubscriptionMetadata | undefined {
        const record = this.#subscriptions.get(id)
        if (record === undefined) return undefined
        return Object.freeze({
            id: record.id,
            tree: record.tree,
            scope: record.scope,
            target: record.target,
            observe: record.observe,
            active: record.active,
            notifications: record.notifications,
        })
    }

    scopeId(reference: InspectionReference | number): ScopeId | undefined {
        return this.#scopeIdsByReference.get(referenceId(reference))
    }

    rowId(reference: InspectionReference | number): RowId | undefined {
        return this.#rowIdsByReference.get(referenceId(reference))
    }

    collectionId(
        reference: InspectionReference | number,
    ): CollectionId | undefined {
        return this.#collectionIdsByReference.get(referenceId(reference))
    }

    execute(command: Command): RuntimeCommandExecution {
        const commandIndex = this.#executions.length
        const traceStart = this.#trace.length
        this.#notifications = []
        let result: RuntimeCommandResult
        try {
            result = this.#executeChecked(command)
        } catch (error) {
            result = freeze({
                ok: false,
                error: this.#normalizeError(error),
                committed: false,
            })
        } finally {
            this.#notifications = undefined
        }

        const report = this.report()
        const details = Object.freeze(
            report.details.slice(this.#detailCount),
        ) as readonly InspectionDetail[]
        const summaries = Object.freeze(
            report.summaries.slice(this.#summaryCount),
        ) as readonly InspectionSummary[]
        this.#detailCount = report.details.length
        this.#summaryCount = report.summaries.length
        const materializations = this.#materializations(details, report)
        this.#materialized.push(...materializations)
        this.#executedCommands.push(command)
        const failure = result.ok
            ? undefined
            : Object.freeze({
                  commandIndex,
                  command,
                  prefix: Object.freeze([...this.#executedCommands]),
                  error: result.error ?? "UNEXPECTED_RUNTIME_ERROR",
                  committed: result.committed === true,
              })
        const execution = Object.freeze({
            commandIndex,
            command,
            result,
            trace: Object.freeze(this.#trace.slice(traceStart)),
            details,
            summaries,
            materializations,
            report,
            ...(failure === undefined ? {} : { failure }),
        })
        this.#executions.push(execution)
        return execution
    }

    #executeChecked(command: Command): RuntimeCommandResult {
        switch (command.kind) {
            case "define-atom":
                return this.#defineAtom(command.atom)
            case "define-collection":
                return this.#defineCollection(command.collection.id)
            case "define-row":
                return this.#defineRow(
                    command.collection,
                    command.row,
                    command.key,
                )
            case "create-tree":
                return this.#createTree(command.tree, command.root)
            case "create-scope":
                return this.#createScope(
                    command.tree,
                    command.parent,
                    command.scope,
                    command.name,
                )
            case "dispose":
                return this.#dispose(command.tree, command.scope)
            case "read": {
                const scope = this.#liveScope(command.tree, command.scope)
                const outcome = this.#read(scope.store, command.target)
                this.#trace.push(
                    freeze({ kind: "read", as: command.as, outcome }),
                )
                return freeze({ ok: true, outcome })
            }
            case "subscribe":
                return this.#subscribe(command)
            case "unsubscribe":
                return this.#unsubscribe(command.subscription)
            case "mutate": {
                const scope = this.#liveScope(command.tree, command.scope)
                return this.#ownedMutation(() =>
                    this.#mutate(scope.store, command.mutation),
                )
            }
            case "transact":
                return this.#transact(
                    command.tree,
                    command.entryScope,
                    command.steps,
                )
        }
    }

    #defineAtom(
        spec: Extract<Command, { readonly kind: "define-atom" }>["atom"],
    ): RuntimeCommandResult {
        if (this.#atoms.has(spec.id)) {
            throw new RuntimeProgramFault("ATOM_ALREADY_DEFINED")
        }
        const options = {
            equal: this.#equality(spec.equal),
        }
        const fallback = spec.fallback
        let runtime: RuntimeAtom
        if (fallback.kind === "eager") {
            runtime = atom(this.#decode(fallback.value), options)
        } else if (fallback.kind === "lazy") {
            runtime = atom.lazy(() => this.#decode(fallback.value), options)
        } else {
            runtime = atom.lazy(() => {
                throw new RuntimeProgramFault(fallback.code)
            }, options)
        }
        this.#atoms.set(spec.id, runtime)
        return freeze({ ok: true })
    }

    #defineCollection(id: CollectionId): RuntimeCommandResult {
        if (this.#collections.has(id)) {
            throw new RuntimeProgramFault("COLLECTION_ALREADY_DEFINED")
        }
        const runtime = collection<RuntimeCollectionKey, CollectionValue>()
        this.#collections.set(id, runtime)
        const capture = this.#inspect.capture(this.#root, runtime)
        this.#collectionIdsByReference.set(capture.state.id, id)
        return freeze({ ok: true })
    }

    #defineRow(
        collectionId: CollectionId,
        rowId: RowId,
        key: CollectionKey,
    ): RuntimeCommandResult {
        const runtimeCollection = this.#collection(collectionId)
        const runtimeRow = runtimeCollection(key)
        const existing = this.#rows.get(rowId)
        if (existing !== undefined) {
            if (Object.is(runtimeRow, existing)) {
                return freeze({ ok: true, row: rowId, key: runtimeRow.key })
            }
            throw new RuntimeProgramFault("ROW_ALREADY_DEFINED")
        }
        const canonicalId = this.#rowIds.get(runtimeRow as object)
        if (canonicalId !== undefined) {
            return freeze({ ok: true, row: canonicalId, key: runtimeRow.key })
        }
        this.#rows.set(rowId, runtimeRow)
        this.#rowIds.set(runtimeRow as object, rowId)
        const capture = this.#inspect.capture(this.#root, runtimeRow)
        this.#rowIdsByReference.set(capture.state.id, rowId)
        return freeze({ ok: true, row: rowId, key: runtimeRow.key })
    }

    #createTree(treeId: TreeId, rootId: ScopeId): RuntimeCommandResult {
        if (this.#trees.has(treeId)) {
            throw new RuntimeProgramFault("TREE_ALREADY_DEFINED")
        }
        if (this.#trees.size !== 0) {
            throw new RuntimeProgramFault("TREE_ALREADY_DEFINED")
        }
        if (this.#scopes.has(rootId)) {
            throw new RuntimeProgramFault("SCOPE_ID_EXISTS")
        }
        const tree: TreeRecord = { id: treeId, root: rootId, disposed: false }
        const root: ScopeRecord = {
            id: rootId,
            tree: treeId,
            store: this.#root,
            parent: null,
            children: [],
            name: undefined,
            disposed: false,
        }
        this.#trees.set(treeId, tree)
        this.#scopes.set(rootId, root)
        this.#captureScope(root)
        return freeze({ ok: true })
    }

    #createScope(
        treeId: TreeId,
        parentId: ScopeId,
        scopeId: ScopeId,
        name: string | undefined,
    ): RuntimeCommandResult {
        this.#liveTree(treeId)
        const parent = this.#liveScope(treeId, parentId)
        if (name !== undefined) {
            const named = parent.children
                .map(childId => this.#scopes.get(childId))
                .find(
                    child =>
                        child !== undefined &&
                        !child.disposed &&
                        child.name === name,
                )
            if (named !== undefined) {
                const publicNamed = parent.store.scope(name)
                if (!Object.is(publicNamed, named.store)) {
                    throw new Error(
                        "Named scope metadata does not match the public Store",
                    )
                }
                if (named.id !== scopeId) {
                    throw new RuntimeProgramFault("NAMED_SCOPE_ID_MISMATCH")
                }
                return freeze({ ok: true })
            }
        }
        if (this.#scopes.has(scopeId)) {
            throw new RuntimeProgramFault("SCOPE_ID_EXISTS")
        }
        const childStore =
            name === undefined ? parent.store.scope() : parent.store.scope(name)
        const child: ScopeRecord = {
            id: scopeId,
            tree: treeId,
            store: childStore,
            parent: parentId,
            children: [],
            name,
            disposed: false,
        }
        parent.children.push(scopeId)
        this.#scopes.set(scopeId, child)
        this.#captureScope(child)
        return freeze({ ok: true })
    }

    #dispose(treeId: TreeId, scopeId: ScopeId): RuntimeCommandResult {
        const tree = this.#liveTree(treeId)
        const scope = this.#liveScope(treeId, scopeId)
        const disposed: ScopeId[] = []
        const visit = (current: ScopeRecord): void => {
            for (const childId of current.children) {
                const child = this.#scopes.get(childId)
                if (child !== undefined && !child.disposed) visit(child)
            }
            current.disposed = true
            disposed.push(current.id)
        }
        scope.store.dispose()
        visit(scope)
        if (scopeId === tree.root) tree.disposed = true
        for (const [id, subscription] of this.#subscriptions) {
            if (
                subscription.tree === treeId &&
                disposed.includes(subscription.scope)
            ) {
                this.#subscriptions.delete(id)
            }
        }
        this.#trace.push(
            freeze({ kind: "disposed", scopes: Object.freeze(disposed) }),
        )
        return freeze({ ok: true })
    }

    #subscribe(
        command: Extract<Command, { readonly kind: "subscribe" }>,
    ): RuntimeCommandResult {
        if (this.#subscriptions.has(command.subscription)) {
            throw new RuntimeProgramFault("SUBSCRIPTION_ID_EXISTS")
        }
        const scope = this.#liveScope(command.tree, command.scope)
        const state = this.#state(command.target)
        const observe = Object.freeze([...(command.observe ?? [])])
        const callback = (): void => {
            const current = this.#subscriptions.get(command.subscription)
            if (current === undefined || !current.active) return
            current.notifications++
            this.#notifications?.push(current.id)
            if (current.observe.length === 0) return
            const reads = current.observe.map(observation => {
                const observationScope = this.#liveScope(
                    current.tree,
                    observation.scope,
                )
                return freeze({
                    as: observation.as,
                    outcome: this.#read(
                        observationScope.store,
                        observation.target,
                    ),
                })
            })
            this.#trace.push(
                freeze({
                    kind: "notification-observation",
                    subscription: current.id,
                    reads: Object.freeze(reads),
                }),
            )
        }
        const unsubscribe = scope.store.sub(state, callback)
        this.#subscriptions.set(command.subscription, {
            id: command.subscription,
            tree: command.tree,
            scope: command.scope,
            target: command.target,
            observe,
            unsubscribe,
            active: true,
            notifications: 0,
        })
        return freeze({ ok: true })
    }

    #unsubscribe(id: string): RuntimeCommandResult {
        const subscription = this.#subscriptions.get(id)
        if (subscription !== undefined && subscription.active) {
            subscription.active = false
            subscription.unsubscribe()
            this.#subscriptions.delete(id)
        }
        return freeze({ ok: true })
    }

    #transact(
        treeId: TreeId,
        entryScopeId: ScopeId,
        steps: readonly TransactionStep[],
    ): RuntimeCommandResult {
        const tree = this.#liveTree(treeId)
        const entry = this.#liveScope(treeId, entryScopeId)
        const context: TransactionContext = {
            tree,
            cursors: new Map(),
        }
        return this.#ownedMutation(
            () => {
                const returned = entry.store.txn(transaction => {
                    context.cursors.set("entry", transaction)
                    this.#transactionSteps(context, steps)
                    return context.result === undefined
                        ? undefined
                        : this.#decode(context.result)
                })
                void returned
            },
            () => context.result,
        )
    }

    #transactionSteps(
        context: TransactionContext,
        steps: readonly TransactionStep[],
    ): boolean {
        for (const step of steps) {
            switch (step.kind) {
                case "resolve-cursor": {
                    let cursor: Transaction
                    if (step.target.kind === "scope") {
                        if (step.target.tree !== context.tree.id) {
                            throw new RuntimeProgramFault("STORE_TREE_MISMATCH")
                        }
                        const scope = this.#liveScope(
                            context.tree.id,
                            step.target.scope,
                        )
                        cursor = this.#cursor(context, "entry").scope(
                            scope.store,
                        )
                    } else {
                        cursor = this.#cursor(
                            context,
                            step.target.parentCursor,
                        ).scope(step.target.name)
                    }
                    context.cursors.set(step.cursor, cursor)
                    break
                }
                case "mutate":
                    this.#mutate(
                        this.#cursor(context, step.cursor),
                        step.mutation,
                    )
                    break
                case "read": {
                    const outcome = this.#read(
                        this.#cursor(context, step.cursor),
                        step.target,
                    )
                    this.#trace.push(
                        freeze({ kind: "read", as: step.as, outcome }),
                    )
                    break
                }
                case "attempt":
                    try {
                        if (this.#transactionSteps(context, step.steps)) {
                            return true
                        }
                    } catch (error) {
                        this.#trace.push(
                            freeze({
                                kind: "attempt-error",
                                code: this.#normalizeError(error),
                            }),
                        )
                    }
                    break
                case "raise":
                    throw new RuntimeProgramFault(step.code)
                case "return":
                    context.result = step.value
                    return true
            }
        }
        return false
    }

    #ownedMutation(
        mutate: () => void,
        resultToken: () => ValueToken | undefined = () => undefined,
    ): RuntimeCommandResult {
        try {
            mutate()
        } catch (error) {
            this.#flushNotifications()
            const committed =
                error instanceof SubscriberNotificationError ||
                (typeof error === "object" && error !== null
                    ? (error as { readonly committed?: unknown }).committed
                    : undefined) === true
            const code = this.#normalizeError(error)
            this.#trace.push(
                freeze({
                    kind: "transaction",
                    status: committed
                        ? ("committed" as const)
                        : ("aborted" as const),
                    error: code,
                }),
            )
            return freeze({
                ok: false,
                error: code,
                committed,
            })
        }
        this.#flushNotifications()
        const result = resultToken()
        this.#trace.push(
            freeze({
                kind: "transaction",
                status: "committed" as const,
                ...(result === undefined ? {} : { result }),
            }),
        )
        return freeze({
            ok: true,
            committed: true,
            ...(result === undefined ? {} : { value: result }),
        })
    }

    #flushNotifications(): void {
        const notifications = this.#notifications
        if (notifications === undefined || notifications.length === 0) return
        this.#trace.push(
            freeze({
                kind: "notifications",
                subscriptions: Object.freeze([...notifications]),
            }),
        )
        notifications.splice(0)
    }

    #mutate(target: RuntimePort, mutation: Mutation): void {
        switch (mutation.kind) {
            case "set-atom":
                Reflect.apply(target.set, target, [
                    this.#atom(mutation.atom),
                    this.#decode(mutation.value),
                ])
                return
            case "update-atom":
                Reflect.apply(target.update, target, [
                    this.#atom(mutation.atom),
                    this.#updater(mutation.updater),
                ])
                return
            case "reset-atom":
                Reflect.apply(target.reset, target, [this.#atom(mutation.atom)])
                return
            case "set-row":
                Reflect.apply(target.set, target, [
                    this.#row(mutation.row),
                    this.#decode(mutation.value),
                ])
                return
            case "update-row":
                Reflect.apply(target.update, target, [
                    this.#row(mutation.row),
                    this.#updater(mutation.updater),
                ])
                return
            case "delete-row":
                Reflect.apply(target.delete, target, [this.#row(mutation.row)])
                return
            case "reset-row":
                Reflect.apply(target.reset, target, [this.#row(mutation.row)])
                return
        }
    }

    #read(target: Pick<Store, "get">, ref: TargetRef): RuntimeReadOutcome {
        const raw = target.get(this.#state(ref) as State<unknown>)
        if (ref.kind === "row") {
            return raw === undefined
                ? freeze({ kind: "absent" })
                : freeze({ kind: "value", value: this.#encode(raw) })
        }
        if (ref.kind === "presence") {
            return freeze({ kind: "presence", value: raw === true })
        }
        if (ref.kind === "collection") {
            if (!Array.isArray(raw)) {
                throw new RuntimeProgramFault("INVALID_MEMBERSHIP_SNAPSHOT")
            }
            const rows = raw.map(candidate => {
                const id = this.#rowIds.get(candidate as object)
                if (id === undefined) {
                    throw new RuntimeProgramFault("ROW_NOT_FOUND")
                }
                return id
            })
            return freeze({
                kind: "rows",
                rows: Object.freeze(rows),
                snapshot: raw,
            })
        }
        return freeze({ kind: "value", value: this.#encode(raw) })
    }

    #state(ref: TargetRef): State<unknown> {
        switch (ref.kind) {
            case "atom":
                return this.#atom(ref.atom)
            case "row":
                return this.#row(ref.row) as State<unknown>
            case "presence": {
                let state = this.#presences.get(ref.row)
                if (state === undefined) {
                    state = presence(this.#row(ref.row))
                    this.#presences.set(ref.row, state)
                }
                return state as State<unknown>
            }
            case "collection":
                return this.#collection(ref.collection) as State<unknown>
        }
    }

    #updater(spec: UpdaterSpec): (current: unknown) => unknown {
        return current => {
            switch (spec.kind) {
                case "replace":
                    return this.#decode(spec.value)
                case "number-add":
                    if (typeof current !== "number") {
                        throw new RuntimeProgramFault("UPDATER_TYPE_ERROR")
                    }
                    return current + spec.amount
                case "fail":
                    throw new RuntimeProgramFault(spec.code)
            }
        }
    }

    #equality(
        spec: Extract<
            Command,
            { readonly kind: "define-atom" }
        >["atom"]["equal"],
    ): (previous: unknown, next: unknown) => boolean {
        if (spec === undefined || spec.kind === "object-is") return Object.is
        if (spec.kind === "always") return () => true
        return (previous, next) =>
            typeof previous === "number" &&
            typeof next === "number" &&
            Math.abs(previous - next) <= spec.maximum
    }

    #decode(token: ValueToken): unknown {
        switch (token.kind) {
            case "undefined":
                return undefined
            case "null":
                return null
            case "boolean":
            case "number":
            case "string":
            case "bigint":
                return token.value
            case "identity": {
                const identityKey = `${token.identityKind}\u0000${token.id}`
                let runtime = this.#identityValues.get(identityKey)
                if (runtime === undefined) {
                    switch (token.identityKind) {
                        case "object":
                            runtime = Object.freeze({})
                            break
                        case "array":
                            runtime = Object.freeze([])
                            break
                        case "function":
                            runtime = Object.freeze(() => undefined)
                            break
                        case "symbol":
                            runtime = Symbol(token.id)
                            break
                        case "thenable":
                            runtime = Object.freeze({
                                then: () => undefined,
                            })
                            break
                    }
                    this.#identityValues.set(identityKey, runtime)
                    this.#identityTokens.set(runtime, token)
                }
                return runtime
            }
        }
    }

    #encode(runtime: unknown): ValueToken {
        const identity = this.#identityTokens.get(runtime)
        if (identity !== undefined) return identity
        if (runtime === undefined) return freeze({ kind: "undefined" })
        if (runtime === null) return freeze({ kind: "null" })
        switch (typeof runtime) {
            case "boolean":
                return freeze({ kind: "boolean", value: runtime })
            case "number":
                return freeze({ kind: "number", value: runtime })
            case "string":
                return freeze({ kind: "string", value: runtime })
            case "bigint":
                return freeze({ kind: "bigint", value: runtime })
            default:
                throw new RuntimeProgramFault("UNKNOWN_RUNTIME_VALUE")
        }
    }

    #normalizeError(error: unknown): string {
        if (error instanceof RuntimeProgramFault) return error.code
        if (error instanceof SubscriberNotificationError) {
            return this.#normalizeError(error.cause)
        }
        if (typeof error === "object" && error !== null) {
            const code = (error as { readonly code?: unknown }).code
            if (typeof code === "string") return errorCodeMap[code] ?? code
        }
        return "UNEXPECTED_RUNTIME_ERROR"
    }

    #materializations(
        details: readonly InspectionDetail[],
        report: InspectionExport,
    ): readonly RuntimeMaterializedCoordinate[] {
        const materialized = details.filter(
            (detail): detail is CollectionSourceInspectionDetail =>
                detail.type === "collection-source" &&
                detail.action === "materialized",
        )
        return Object.freeze(
            materialized.map(detail => {
                const scope = this.scopeId(detail.scope)
                const collection = this.collectionId(
                    detail.collection ?? detail.state,
                )
                const row =
                    detail.source === "row"
                        ? this.rowId(detail.state)
                        : undefined
                if (
                    scope === undefined ||
                    collection === undefined ||
                    (detail.source === "row" && row === undefined)
                ) {
                    throw new Error(
                        "Unmapped collection inspection reference in public runtime",
                    )
                }
                const sequence = detailSequence(detail)
                const firstPublication =
                    detail.commitId === undefined
                        ? undefined
                        : report.details.find(
                              candidate =>
                                  candidate.type === "collection-source" &&
                                  candidate.action === "published" &&
                                  candidate.commitId === detail.commitId,
                          )
                const stage: RuntimeMaterializationStage =
                    detail.commitId === undefined
                        ? "pre-commit-or-no-commit"
                        : firstPublication !== undefined &&
                            detailSequence(firstPublication) < sequence
                          ? "subscriber"
                          : detail.source === "membership"
                            ? "phase0"
                            : "rewire"
                return Object.freeze({
                    scope,
                    collection,
                    ...(row === undefined ? {} : { row }),
                    source: detail.source,
                    stage,
                    sequence,
                    ...(detail.operationId === undefined
                        ? {}
                        : { operationId: detail.operationId }),
                    ...(detail.commitId === undefined
                        ? {}
                        : { commitId: detail.commitId }),
                    detail,
                })
            }),
        )
    }

    #captureScope(scope: ScopeRecord): void {
        const capture = this.#inspect.capture(scope.store)
        this.#scopeIdsByReference.set(capture.store.id, scope.id)
    }

    #liveTree(id: TreeId): TreeRecord {
        const tree = this.#trees.get(id)
        if (tree === undefined) throw new RuntimeProgramFault("TREE_NOT_FOUND")
        if (tree.disposed) throw new RuntimeProgramFault("STORE_DISPOSED")
        return tree
    }

    #liveScope(treeId: TreeId, id: ScopeId): ScopeRecord {
        this.#liveTree(treeId)
        const scope = this.#scopes.get(id)
        if (scope === undefined || scope.tree !== treeId) {
            throw new RuntimeProgramFault("SCOPE_NOT_FOUND")
        }
        if (scope.disposed) throw new RuntimeProgramFault("STORE_DISPOSED")
        return scope
    }

    #atom(id: AtomId): RuntimeAtom {
        const runtime = this.#atoms.get(id)
        if (runtime === undefined)
            throw new RuntimeProgramFault("ATOM_NOT_FOUND")
        return runtime
    }

    #collection(id: CollectionId): RuntimeCollection {
        const runtime = this.#collections.get(id)
        if (runtime === undefined) {
            throw new RuntimeProgramFault("COLLECTION_NOT_FOUND")
        }
        return runtime
    }

    #row(id: RowId): RuntimeRow {
        const runtime = this.#rows.get(id)
        if (runtime === undefined)
            throw new RuntimeProgramFault("ROW_NOT_FOUND")
        return runtime
    }

    #cursor(context: TransactionContext, id: string): Transaction {
        const cursor = context.cursors.get(id)
        if (cursor === undefined) {
            throw new RuntimeProgramFault("CURSOR_NOT_FOUND")
        }
        return cursor
    }
}

export const createCollectionRuntimeDriver = (): CollectionRuntimeDriver =>
    new CollectionRuntimeDriverImpl()

export const runCollectionProgram = (
    program: CollectionProgram,
): CollectionRuntimeProgramResult => {
    const driver = createCollectionRuntimeDriver()
    const executions = program.commands.map(command => driver.execute(command))
    const failures = executions.flatMap(execution =>
        execution.failure === undefined ? [] : [execution.failure],
    )
    return Object.freeze({
        name: program.name,
        executions: Object.freeze(executions),
        results: Object.freeze(executions.map(execution => execution.result)),
        trace: driver.trace,
        materializedCoordinates: driver.materializedCoordinates,
        failures: Object.freeze(failures),
        report: driver.report(),
    })
}
