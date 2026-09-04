import type {
    AtomId,
    AtomSpec,
    AuditEvent,
    CollectionId,
    CollectionKey,
    CollectionSpec,
    Command,
    CommandResult,
    EffectiveRowDelta,
    EffectiveRowOutcome,
    EqualitySpec,
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
} from "./protocol"

type AtomIntent = Readonly<{
    targetKind: "atom"
    atom: AtomId
    kind: "set" | "reset"
    value?: ValueToken
}>

type RowIntent = Readonly<{
    targetKind: "row"
    row: RowId
    kind: "present" | "absent" | "reset"
    value?: ValueToken
}>

type Intent = Readonly<{
    sequence: number
    scope: ScopeId
    mutation: AtomIntent | RowIntent
}>

type RowLocal =
    | Readonly<{ kind: "present"; value: ValueToken }>
    | Readonly<{ kind: "absent" }>

interface ScopeRecord {
    readonly id: ScopeId
    readonly parent: ScopeId | null
    readonly children: ScopeId[]
    readonly namedChildren: Map<string, ScopeId>
    readonly atomLocals: Map<AtomId, ValueToken>
    readonly rowLocals: Map<RowId, RowLocal>
    readonly memberships: Map<CollectionId, MembershipSnapshot>
    disposed: boolean
}

interface MembershipSnapshot {
    readonly id: number | string
    readonly rows: readonly RowId[]
}

type MembershipPlacement =
    | Readonly<{ kind: "baseline" }>
    | Readonly<{ kind: "absent" }>
    | Readonly<{ kind: "birth"; sequence: number }>

interface TreeRecord {
    readonly id: TreeId
    readonly root: ScopeId
    readonly scopes: Map<ScopeId, ScopeRecord>
    readonly lazyFallbacks: Map<AtomId, FallbackOutcome>
    epoch: number
    disposed: boolean
}

type FallbackOutcome =
    | Readonly<{ ok: true; value: ValueToken }>
    | Readonly<{ ok: false; error: string }>

interface RowRecord {
    readonly id: RowId
    readonly collection: CollectionId
    readonly key: CollectionKey
    readonly keyIdentity: string
    readonly order: number
}

interface CollectionRecord {
    readonly rows: RowId[]
    readonly rowsByKey: Map<string, RowId>
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
    outcome: ReadOutcome
}

interface Draft {
    readonly id: number
    readonly tree: TreeRecord
    readonly intents: Intent[]
    readonly cursors: Map<string, ScopeId>
    readonly baselineAtoms: Map<string, FallbackOutcome>
    readonly lazyFallbacks: Map<AtomId, FallbackOutcome>
    readonly fallbackUsingIntents: Set<number>
    readonly collectionOutcomes: Map<
        string,
        Extract<ReadOutcome, { readonly kind: "rows" }>
    >
    nextSequence: number
    nextCollectionSnapshot: number
    result?: ValueToken
}

interface CommitBaseline {
    readonly atomOutcomes: Map<string, FallbackOutcome>
    readonly rowOutcomes: Map<string, EffectiveRowOutcome>
    readonly memberships: Map<string, MembershipSnapshot>
}

interface NotificationTarget {
    readonly scope: ScopeId
    readonly target: TargetRef
}

class ModelFault extends Error {
    constructor(readonly code: string) {
        super(code)
    }
}

export class ReferenceModel {
    readonly trace: ObservableEvent[] = []
    readonly audit: AuditEvent[] = []

    private readonly atoms = new Map<AtomId, AtomSpec>()
    private readonly collections = new Map<CollectionId, CollectionRecord>()
    private readonly rows = new Map<RowId, RowRecord>()
    private readonly trees = new Map<TreeId, TreeRecord>()
    private readonly subscriptions = new Map<string, SubscriptionRecord>()
    private nextMembershipSnapshot = 1
    private nextRowOrder = 1
    private nextDraftIdentity = 1

    execute(command: Command): CommandResult {
        try {
            return this.executeChecked(command)
        } catch (error) {
            const code = faultCode(error)
            return { ok: false, error: code, committed: false }
        }
    }

    clearEvents(): void {
        this.trace.splice(0)
        this.audit.splice(0)
    }

    private executeChecked(command: Command): CommandResult {
        switch (command.kind) {
            case "define-atom":
                this.defineAtom(command.atom)
                return { ok: true }
            case "define-collection":
                this.defineCollection(command.collection)
                return { ok: true }
            case "define-row": {
                const row = this.defineRow(
                    command.collection,
                    command.row,
                    command.key,
                )
                return {
                    ok: true,
                    row: row.id,
                    key: row.key,
                }
            }
            case "create-tree":
                this.createTree(command.tree, command.root)
                return { ok: true }
            case "create-scope":
                this.createScope(
                    command.tree,
                    command.parent,
                    command.scope,
                    command.name,
                )
                return { ok: true }
            case "dispose":
                return this.dispose(command.tree, command.scope)
            case "read": {
                const tree = this.liveTree(command.tree)
                const scope = this.liveScope(tree, command.scope)
                const outcome = this.readCommitted(tree, scope, command.target)
                this.trace.push({ kind: "read", as: command.as, outcome })
                return { ok: true, outcome }
            }
            case "subscribe":
                this.subscribe(command)
                return { ok: true }
            case "unsubscribe":
                this.subscriptions.delete(command.subscription)
                return { ok: true }
            case "mutate":
                return this.transact(command.tree, command.scope, [
                    {
                        kind: "mutate",
                        cursor: "entry",
                        mutation: command.mutation,
                    },
                ])
            case "transact":
                return this.transact(
                    command.tree,
                    command.entryScope,
                    command.steps,
                )
        }
    }

    private defineAtom(atom: AtomSpec): void {
        assertModelId(atom.id)
        if (this.atoms.has(atom.id))
            throw new ModelFault("ATOM_ALREADY_DEFINED")
        if (
            atom.fallback.kind === "eager" &&
            atom.fallback.value.kind === "identity" &&
            atom.fallback.value.identityKind === "thenable"
        ) {
            throw new ModelFault("INVALID_SYNC_ATOM_VALUE")
        }
        this.atoms.set(
            atom.id,
            Object.freeze({
                ...atom,
                equal: atom.equal ?? Object.freeze({ kind: "object-is" }),
            }),
        )
    }

    private defineCollection(collection: CollectionSpec): void {
        assertModelId(collection.id)
        if (this.collections.has(collection.id)) {
            throw new ModelFault("COLLECTION_ALREADY_DEFINED")
        }
        this.collections.set(collection.id, {
            rows: [],
            rowsByKey: new Map(),
        })
    }

    private defineRow(
        collectionId: CollectionId,
        rowId: RowId,
        key: CollectionKey,
    ): RowRecord {
        assertModelId(rowId)
        const collection = this.collection(collectionId)
        const normalized = normalizeKey(key)
        const identity = keyIdentity(normalized)
        const rowWithId = this.rows.get(rowId)
        if (rowWithId !== undefined) {
            if (
                rowWithId.collection === collectionId &&
                rowWithId.keyIdentity === identity
            ) {
                return rowWithId
            }
            throw new ModelFault("ROW_ALREADY_DEFINED")
        }
        const existing = collection.rowsByKey.get(identity)
        if (existing !== undefined) return this.row(existing)
        const row: RowRecord = {
            id: rowId,
            collection: collectionId,
            key: normalized,
            keyIdentity: identity,
            order: this.nextRowOrder++,
        }
        this.rows.set(rowId, row)
        collection.rows.push(rowId)
        collection.rowsByKey.set(identity, rowId)
        return row
    }

    private createTree(treeId: TreeId, rootId: ScopeId): void {
        assertModelId(treeId)
        assertModelId(rootId)
        if (this.trees.has(treeId)) throw new ModelFault("TREE_ALREADY_DEFINED")
        const root = this.newScope(rootId, null)
        const tree: TreeRecord = {
            id: treeId,
            root: rootId,
            scopes: new Map([[rootId, root]]),
            lazyFallbacks: new Map(),
            epoch: 0,
            disposed: false,
        }
        this.trees.set(treeId, tree)
        this.audit.push({
            kind: "scope-created",
            tree: treeId,
            scope: rootId,
            parent: null,
            name: null,
        })
    }

    private createScope(
        treeId: TreeId,
        parentId: ScopeId,
        scopeId: ScopeId,
        name?: string,
    ): void {
        assertModelId(scopeId)
        const tree = this.liveTree(treeId)
        const parent = this.liveScope(tree, parentId)
        if (name !== undefined) {
            const existing = parent.namedChildren.get(name)
            if (existing !== undefined) {
                this.liveScope(tree, existing)
                if (existing !== scopeId)
                    throw new ModelFault("NAMED_SCOPE_ID_MISMATCH")
                return
            }
        }
        if (tree.scopes.has(scopeId)) throw new ModelFault("SCOPE_ID_EXISTS")
        const scope = this.newScope(scopeId, parentId)
        tree.scopes.set(scopeId, scope)
        parent.children.push(scopeId)
        if (name !== undefined) parent.namedChildren.set(name, scopeId)
        this.audit.push({
            kind: "scope-created",
            tree: treeId,
            scope: scopeId,
            parent: parentId,
            name: name ?? null,
        })
    }

    private newScope(id: ScopeId, parent: ScopeId | null): ScopeRecord {
        return {
            id,
            parent,
            children: [],
            namedChildren: new Map(),
            atomLocals: new Map(),
            rowLocals: new Map(),
            memberships: new Map(),
            disposed: false,
        }
    }

    private dispose(treeId: TreeId, scopeId: ScopeId): CommandResult {
        const tree = this.liveTree(treeId)
        const scope = this.liveScope(tree, scopeId)
        const disposed: ScopeId[] = []
        const visit = (current: ScopeRecord): void => {
            for (const childId of current.children) {
                const child = tree.scopes.get(childId)
                if (child !== undefined && !child.disposed) visit(child)
            }
            current.disposed = true
            disposed.push(current.id)
            if (current.parent !== null) {
                const parent = tree.scopes.get(current.parent)
                if (parent !== undefined) {
                    for (const [name, childId] of parent.namedChildren) {
                        if (childId === current.id)
                            parent.namedChildren.delete(name)
                    }
                }
            }
        }
        visit(scope)
        if (scopeId === tree.root) tree.disposed = true
        for (const [id, subscription] of this.subscriptions) {
            if (
                subscription.tree === treeId &&
                disposed.includes(subscription.scope)
            ) {
                this.subscriptions.delete(id)
            }
        }
        this.trace.push({ kind: "disposed", scopes: disposed })
        return { ok: true }
    }

    private subscribe(command: Extract<Command, { kind: "subscribe" }>): void {
        if (this.subscriptions.has(command.subscription)) {
            throw new ModelFault("SUBSCRIPTION_ID_EXISTS")
        }
        const tree = this.liveTree(command.tree)
        const scope = this.liveScope(tree, command.scope)
        const outcome = this.readCommitted(tree, scope, command.target)
        this.subscriptions.set(command.subscription, {
            id: command.subscription,
            tree: command.tree,
            scope: command.scope,
            target: command.target,
            observe: command.observe ?? [],
            outcome,
        })
    }

    private transact(
        treeId: TreeId,
        entryScopeId: ScopeId,
        steps: readonly TransactionStep[],
    ): CommandResult {
        const tree = this.liveTree(treeId)
        this.liveScope(tree, entryScopeId)
        const draft: Draft = {
            id: this.nextDraftIdentity++,
            tree,
            intents: [],
            cursors: new Map([["entry", entryScopeId]]),
            baselineAtoms: new Map(),
            lazyFallbacks: new Map(),
            fallbackUsingIntents: new Set(),
            collectionOutcomes: new Map(),
            nextSequence: 1,
            nextCollectionSnapshot: 1,
        }
        try {
            this.executeTransactionSteps(draft, steps)
            if (
                draft.result?.kind === "identity" &&
                draft.result.identityKind === "thenable"
            ) {
                throw new ModelFault("INVALID_TRANSACTION_CALLBACK_RESULT")
            }
        } catch (error) {
            const code = faultCode(error)
            this.trace.push({
                kind: "transaction",
                status: "aborted",
                error: code,
            })
            return { ok: false, error: code, committed: false }
        }

        let notificationError: string | undefined
        try {
            notificationError = this.commitDraft(draft)
        } catch (error) {
            const code = faultCode(error)
            this.trace.push({
                kind: "transaction",
                status: "aborted",
                error: code,
            })
            return { ok: false, error: code, committed: false }
        }
        this.trace.push({
            kind: "transaction",
            status: "committed",
            ...(draft.result === undefined ? {} : { result: draft.result }),
            ...(notificationError === undefined
                ? {}
                : { error: notificationError }),
        })
        if (notificationError !== undefined) {
            return {
                ok: false,
                error: notificationError,
                committed: true,
            }
        }
        return {
            ok: true,
            committed: true,
            ...(draft.result === undefined ? {} : { value: draft.result }),
        }
    }

    private executeTransactionSteps(
        draft: Draft,
        steps: readonly TransactionStep[],
    ): boolean {
        for (const step of steps) {
            switch (step.kind) {
                case "resolve-cursor":
                    draft.cursors.set(
                        step.cursor,
                        this.resolveCursor(draft, step.target),
                    )
                    break
                case "mutate":
                    this.stageMutation(
                        draft,
                        this.cursor(draft, step.cursor),
                        step.mutation,
                    )
                    break
                case "read": {
                    const scope = this.liveScope(
                        draft.tree,
                        this.cursor(draft, step.cursor),
                    )
                    const outcome = this.readDraft(draft, scope, step.target)
                    this.trace.push({ kind: "read", as: step.as, outcome })
                    break
                }
                case "attempt":
                    try {
                        if (this.executeTransactionSteps(draft, step.steps)) {
                            return true
                        }
                    } catch (error) {
                        this.trace.push({
                            kind: "attempt-error",
                            code: faultCode(error),
                        })
                    }
                    break
                case "raise":
                    throw new ModelFault(step.code)
                case "return":
                    draft.result = step.value
                    return true
                default:
                    return unreachable(step, "UNKNOWN_TRANSACTION_STEP")
            }
        }
        return false
    }

    private resolveCursor(
        draft: Draft,
        target: Extract<TransactionStep, { kind: "resolve-cursor" }>["target"],
    ): ScopeId {
        if (target.kind === "scope") {
            if (target.tree !== draft.tree.id) {
                throw new ModelFault("STORE_TREE_MISMATCH")
            }
            this.liveScope(draft.tree, target.scope)
            return target.scope
        }
        const parent = this.liveScope(
            draft.tree,
            this.cursor(draft, target.parentCursor),
        )
        const child = parent.namedChildren.get(target.name)
        if (child === undefined) throw new ModelFault("SCOPE_NOT_FOUND")
        this.liveScope(draft.tree, child)
        return child
    }

    private cursor(draft: Draft, id: string): ScopeId {
        const cursor = draft.cursors.get(id)
        if (cursor === undefined) throw new ModelFault("CURSOR_NOT_FOUND")
        return cursor
    }

    private stageMutation(
        draft: Draft,
        scopeId: ScopeId,
        mutation: Mutation,
    ): void {
        const scope = this.liveScope(draft.tree, scopeId)
        switch (mutation.kind) {
            case "set-atom":
                this.stageAtomSet(draft, scope, mutation.atom, mutation.value)
                return
            case "update-atom": {
                const current = this.readAtomDraft(draft, scope, mutation.atom)
                const candidate = applyUpdater(mutation.updater, current)
                this.stageAtomSet(draft, scope, mutation.atom, candidate)
                return
            }
            case "reset-atom": {
                this.atom(mutation.atom)
                const intent = this.intent(draft, scopeId, {
                    targetKind: "atom",
                    atom: mutation.atom,
                    kind: "reset",
                })
                this.readAtomDraft(draft, scope, mutation.atom, [
                    ...draft.intents,
                    intent,
                ])
                if (
                    this.atomPathReachesFallback(draft, scope, mutation.atom, [
                        ...draft.intents,
                        intent,
                    ])
                ) {
                    draft.fallbackUsingIntents.add(intent.sequence)
                }
                this.appendIntent(draft, intent)
                return
            }
            case "set-row":
                this.assertPresentValue(mutation.value)
                this.row(mutation.row)
                this.appendIntent(
                    draft,
                    this.intent(draft, scopeId, {
                        targetKind: "row",
                        row: mutation.row,
                        kind: "present",
                        value: mutation.value,
                    }),
                )
                return
            case "update-row": {
                const current = this.readRowDraft(draft, scope, mutation.row)
                if (current.kind === "absent")
                    throw new ModelFault("MISSING_COLLECTION_ROW")
                const candidate = applyUpdater(mutation.updater, current.value)
                this.assertPresentValue(candidate)
                this.appendIntent(
                    draft,
                    this.intent(draft, scopeId, {
                        targetKind: "row",
                        row: mutation.row,
                        kind: "present",
                        value: candidate,
                    }),
                )
                return
            }
            case "delete-row":
                this.row(mutation.row)
                this.appendIntent(
                    draft,
                    this.intent(draft, scopeId, {
                        targetKind: "row",
                        row: mutation.row,
                        kind: "absent",
                    }),
                )
                return
            case "reset-row":
                this.row(mutation.row)
                this.appendIntent(
                    draft,
                    this.intent(draft, scopeId, {
                        targetKind: "row",
                        row: mutation.row,
                        kind: "reset",
                    }),
                )
                return
            default:
                return unreachable(mutation, "UNKNOWN_MUTATION")
        }
    }

    private stageAtomSet(
        draft: Draft,
        scope: ScopeRecord,
        atomId: AtomId,
        candidate: ValueToken,
    ): void {
        this.assertAtomValue(candidate)
        const atom = this.atom(atomId)
        const baselineKey = localKey(scope.id, "atom", atomId)
        let baselineOutcome = draft.baselineAtoms.get(baselineKey)
        if (baselineOutcome === undefined) {
            baselineOutcome = this.readAtomBaselineOutcome(draft, scope, atomId)
            draft.baselineAtoms.set(baselineKey, baselineOutcome)
        }
        const canonical = baselineOutcome.ok
            ? compare(atom.equal, baselineOutcome.value, candidate)
                ? baselineOutcome.value
                : candidate
            : candidate
        const intent = this.intent(draft, scope.id, {
            targetKind: "atom",
            atom: atomId,
            kind: "set",
            value: canonical,
        })
        if (this.atomPathReachesFallback(draft, scope, atomId, [])) {
            draft.fallbackUsingIntents.add(intent.sequence)
        }
        this.appendIntent(draft, intent)
    }

    private intent(
        draft: Draft,
        scope: ScopeId,
        mutation: AtomIntent | RowIntent,
    ): Intent {
        return { sequence: draft.nextSequence, scope, mutation }
    }

    private appendIntent(draft: Draft, intent: Intent): void {
        draft.intents.push(intent)
        draft.nextSequence += 1
    }

    private commitDraft(draft: Draft): string | undefined {
        const finalIntents = collapseIntents(draft.intents)
        if (finalIntents.size === 0) return undefined
        const touchedAtoms = new Set<AtomId>()
        const touchedRows = new Set<RowId>()
        for (const intent of finalIntents.values()) {
            if (intent.mutation.targetKind === "atom") {
                touchedAtoms.add(intent.mutation.atom)
            } else {
                touchedRows.add(intent.mutation.row)
            }
        }
        const baseline = this.captureCommitBaseline(
            draft,
            touchedAtoms,
            touchedRows,
        )
        const candidateTree = cloneTree(draft.tree)
        let fallbackPublicationChanged = false
        for (const intent of finalIntents.values()) {
            if (
                intent.mutation.targetKind === "atom" &&
                draft.fallbackUsingIntents.has(intent.sequence)
            ) {
                const outcome = draft.lazyFallbacks.get(intent.mutation.atom)
                if (outcome !== undefined) {
                    const previous = candidateTree.lazyFallbacks.get(
                        intent.mutation.atom,
                    )
                    candidateTree.lazyFallbacks.set(
                        intent.mutation.atom,
                        outcome,
                    )
                    if (!fallbackOutcomeEqual(previous, outcome)) {
                        fallbackPublicationChanged = true
                    }
                }
            }
        }
        const ownershipChanges: string[] = []

        for (const intent of finalIntents.values()) {
            const scope = this.liveScope(candidateTree, intent.scope)
            if (intent.mutation.targetKind === "atom") {
                const atomId = intent.mutation.atom
                const beforeOwned = scope.atomLocals.has(atomId)
                const before = scope.atomLocals.get(atomId)
                if (intent.mutation.kind === "reset") {
                    scope.atomLocals.delete(atomId)
                } else {
                    scope.atomLocals.set(
                        atomId,
                        requiredValue(intent.mutation.value),
                    )
                }
                const afterOwned = scope.atomLocals.has(atomId)
                const after = scope.atomLocals.get(atomId)
                if (
                    beforeOwned !== afterOwned ||
                    (beforeOwned &&
                        afterOwned &&
                        !tokenObjectIs(before!, after!))
                ) {
                    ownershipChanges.push(localKey(scope.id, "atom", atomId))
                }
            } else {
                const rowId = intent.mutation.row
                const before = scope.rowLocals.get(rowId)
                if (intent.mutation.kind === "reset") {
                    scope.rowLocals.delete(rowId)
                } else if (intent.mutation.kind === "absent") {
                    if (scope.parent === null) scope.rowLocals.delete(rowId)
                    else scope.rowLocals.set(rowId, ABSENT_LOCAL)
                } else {
                    scope.rowLocals.set(rowId, {
                        kind: "present",
                        value: requiredValue(intent.mutation.value),
                    })
                }
                const after = scope.rowLocals.get(rowId)
                if (!rowLocalEqual(before, after)) {
                    ownershipChanges.push(localKey(scope.id, "row", rowId))
                }
            }
        }

        const effectiveAtomChanges: string[] = []
        for (const scope of liveScopes(candidateTree)) {
            for (const atomId of touchedAtoms) {
                const key = effectiveKey(scope.id, atomId)
                const before = baseline.atomOutcomes.get(key)!
                const after = this.readAtomCommittedOutcome(
                    candidateTree,
                    scope,
                    atomId,
                )
                if (!fallbackOutcomeEqual(before, after))
                    effectiveAtomChanges.push(key)
            }
        }

        const { deltas: collectionDeltas, membershipChanges } =
            this.recomputeCollections(
                candidateTree,
                touchedRows,
                baseline,
                draft,
            )

        if (ownershipChanges.length === 0 && membershipChanges.length === 0) {
            if (fallbackPublicationChanged) {
                this.trees.set(candidateTree.id, candidateTree)
            }
            return undefined
        }
        candidateTree.epoch += 1
        this.trees.set(candidateTree.id, candidateTree)
        this.audit.push({
            kind: "commit",
            tree: candidateTree.id,
            epoch: candidateTree.epoch,
            ownershipChanges: Object.freeze([...ownershipChanges]),
            effectiveAtomChanges: Object.freeze([...effectiveAtomChanges]),
            collectionDeltas: Object.freeze([...collectionDeltas]),
            membershipChanges,
        })
        return this.notify(
            candidateTree,
            this.notificationTargets(candidateTree, baseline, finalIntents),
        )
    }

    private captureCommitBaseline(
        draft: Draft,
        touchedAtoms: ReadonlySet<AtomId>,
        touchedRows: ReadonlySet<RowId>,
    ): CommitBaseline {
        const tree = draft.tree
        const atomOutcomes = new Map<string, FallbackOutcome>()
        const rowOutcomes = new Map<string, EffectiveRowOutcome>()
        const memberships = new Map<string, MembershipSnapshot>()
        const collections = new Set<CollectionId>()
        for (const rowId of touchedRows)
            collections.add(this.row(rowId).collection)
        for (const scope of liveScopes(tree)) {
            for (const atomId of touchedAtoms) {
                atomOutcomes.set(
                    effectiveKey(scope.id, atomId),
                    this.readAtomBaselineOutcome(draft, scope, atomId),
                )
            }
            for (const rowId of touchedRows) {
                rowOutcomes.set(
                    effectiveKey(scope.id, rowId),
                    this.readRowCommitted(tree, scope, rowId),
                )
            }
            for (const collectionId of collections) {
                memberships.set(
                    membershipKey(scope.id, collectionId),
                    this.peekMembership(tree, scope, collectionId),
                )
            }
        }
        return { atomOutcomes, rowOutcomes, memberships }
    }

    private recomputeCollections(
        tree: TreeRecord,
        touchedRows: ReadonlySet<RowId>,
        baseline: CommitBaseline,
        draft: Draft,
    ): Readonly<{
        deltas: readonly EffectiveRowDelta[]
        membershipChanges: readonly Readonly<{
            scope: ScopeId
            collection: CollectionId
            sourceChanged: boolean
        }>[]
    }> {
        const collections = new Set<CollectionId>()
        for (const rowId of touchedRows)
            collections.add(this.row(rowId).collection)
        const deltas: EffectiveRowDelta[] = []
        const membershipChanges: Array<{
            scope: ScopeId
            collection: CollectionId
            sourceChanged: boolean
        }> = []
        for (const scope of liveScopes(tree)) {
            for (const collectionId of collections) {
                const collection = this.collection(collectionId)
                const beforeMembership = baseline.memberships.get(
                    membershipKey(scope.id, collectionId),
                )!
                const placements = new Map<RowId, MembershipPlacement>()
                const births: Array<{
                    rowId: RowId
                    sequence: number
                }> = []
                for (const rowId of collection.rows) {
                    const placement = this.continuousMembershipPlacement(
                        draft,
                        scope,
                        rowId,
                    )
                    placements.set(rowId, placement)
                    if (placement.kind === "birth") {
                        births.push({ rowId, sequence: placement.sequence })
                    }
                }
                const survivors = beforeMembership.rows.filter(
                    rowId => placements.get(rowId)?.kind === "baseline",
                )
                births.sort((left, right) =>
                    left.sequence === right.sequence
                        ? this.row(left.rowId).order -
                          this.row(right.rowId).order
                        : left.sequence - right.sequence,
                )
                const nextRows = [
                    ...survivors,
                    ...births.map(birth => birth.rowId),
                ]
                const inheritedRows =
                    scope.parent === null
                        ? EMPTY_ROWS
                        : this.peekMembership(
                              tree,
                              this.liveScope(tree, scope.parent),
                              collectionId,
                          ).rows
                const sourceChanged = !sameStrings(
                    beforeMembership.rows,
                    nextRows,
                )
                if (
                    sourceChanged ||
                    (scope.memberships.get(collectionId) === undefined &&
                        !sameStrings(inheritedRows, nextRows))
                ) {
                    membershipChanges.push(
                        Object.freeze({
                            scope: scope.id,
                            collection: collectionId,
                            sourceChanged,
                        }),
                    )
                    scope.memberships.set(
                        collectionId,
                        this.newMembership(nextRows),
                    )
                }

                for (const rowId of touchedRows) {
                    if (this.row(rowId).collection !== collectionId) continue
                    const before = baseline.rowOutcomes.get(
                        effectiveKey(scope.id, rowId),
                    )!
                    const after = this.readRowCommitted(tree, scope, rowId)
                    if (rowOutcomeEqual(before, after)) continue
                    const membership =
                        before.kind === "absent" && after.kind === "present"
                            ? "insert"
                            : before.kind === "present" &&
                                after.kind === "absent"
                              ? "remove"
                              : "unchanged"
                    const delta: EffectiveRowDelta = {
                        scope: scope.id,
                        collection: collectionId,
                        row: rowId,
                        before,
                        after,
                        membership,
                        ...(membership === "insert"
                            ? {
                                  birthSequence: births.find(
                                      birth => birth.rowId === rowId,
                                  )!.sequence,
                              }
                            : {}),
                    }
                    deltas.push(Object.freeze(delta))
                }
            }
        }
        return {
            deltas,
            membershipChanges: Object.freeze(membershipChanges),
        }
    }

    private notificationTargets(
        tree: TreeRecord,
        baseline: CommitBaseline,
        finalIntents: ReadonlyMap<string, Intent>,
    ): readonly NotificationTarget[] {
        const atoms: NotificationTarget[] = []
        const rows: NotificationTarget[] = []
        const collections: NotificationTarget[] = []
        const seenAtoms = new Set<string>()
        const seenRows = new Set<string>()
        const seenCollections = new Set<string>()
        const root = this.liveScope(tree, tree.root)

        for (const intent of finalIntents.values()) {
            if (intent.scope !== tree.root) continue
            if (intent.mutation.targetKind === "atom") {
                const atomId = intent.mutation.atom
                const key = effectiveKey(root.id, atomId)
                const before = baseline.atomOutcomes.get(key)!
                const after = this.readAtomCommittedOutcome(tree, root, atomId)
                if (
                    !seenAtoms.has(key) &&
                    !fallbackOutcomeEqual(before, after)
                ) {
                    seenAtoms.add(key)
                    atoms.push({
                        scope: root.id,
                        target: { kind: "atom", atom: atomId },
                    })
                }
                continue
            }

            const rowId = intent.mutation.row
            const rowKey = effectiveKey(root.id, rowId)
            const beforeRow = baseline.rowOutcomes.get(rowKey)!
            const afterRow = this.readRowCommitted(tree, root, rowId)
            if (
                !seenRows.has(rowKey) &&
                !rowOutcomeEqual(beforeRow, afterRow)
            ) {
                seenRows.add(rowKey)
                rows.push({
                    scope: root.id,
                    target: { kind: "row", row: rowId },
                })
            }

            const collectionId = this.row(rowId).collection
            const collectionKey = membershipKey(root.id, collectionId)
            const beforeMembership = baseline.memberships.get(collectionKey)!
            const afterMembership = this.peekMembership(
                tree,
                root,
                collectionId,
            )
            if (
                !seenCollections.has(collectionKey) &&
                !sameStrings(beforeMembership.rows, afterMembership.rows)
            ) {
                seenCollections.add(collectionKey)
                collections.push({
                    scope: root.id,
                    target: {
                        kind: "collection",
                        collection: collectionId,
                    },
                })
            }
        }

        return Object.freeze([...atoms, ...rows, ...collections])
    }

    private notify(
        tree: TreeRecord,
        targets: readonly NotificationTarget[],
    ): string | undefined {
        const notified: string[] = []
        const visited = new Set<string>()
        let firstError: string | undefined

        const visit = (subscription: SubscriptionRecord): void => {
            visited.add(subscription.id)
            const scope = this.liveScope(tree, subscription.scope)
            const next = this.readCommitted(tree, scope, subscription.target)
            if (!readOutcomeEqual(subscription.outcome, next)) {
                subscription.outcome = next
                notified.push(subscription.id)
                if (subscription.observe.length > 0) {
                    try {
                        this.trace.push({
                            kind: "notification-observation",
                            subscription: subscription.id,
                            reads: Object.freeze(
                                subscription.observe.map(observation => ({
                                    as: observation.as,
                                    outcome: this.readCommitted(
                                        tree,
                                        this.liveScope(tree, observation.scope),
                                        observation.target,
                                    ),
                                })),
                            ),
                        })
                    } catch (error) {
                        firstError ??= faultCode(error)
                    }
                }
            }
        }

        for (const notificationTarget of targets) {
            for (const subscription of this.subscriptions.values()) {
                if (
                    subscription.tree !== tree.id ||
                    visited.has(subscription.id) ||
                    subscription.scope !== notificationTarget.scope ||
                    !targetRefEqual(
                        subscription.target,
                        notificationTarget.target,
                    )
                ) {
                    continue
                }
                visit(subscription)
            }
        }

        // The model has no route-materialization state. Only root-native
        // targets above are ordering authority; cross-scope targets and
        // presence Selectors retain legacy registration order and must be
        // normalized out of differential ordering comparisons.
        for (const subscription of this.subscriptions.values()) {
            if (subscription.tree !== tree.id || visited.has(subscription.id)) {
                continue
            }
            visit(subscription)
        }
        if (notified.length > 0) {
            this.trace.push({
                kind: "notifications",
                subscriptions: Object.freeze(notified),
            })
        }
        return firstError
    }

    private readCommitted(
        tree: TreeRecord,
        scope: ScopeRecord,
        target: TargetRef,
    ): ReadOutcome {
        switch (target.kind) {
            case "atom":
                return {
                    kind: "value",
                    value: this.readAtomCommitted(tree, scope, target.atom),
                }
            case "row": {
                const outcome = this.readRowCommitted(tree, scope, target.row)
                return outcome.kind === "present"
                    ? { kind: "value", value: outcome.value }
                    : ABSENT_OUTCOME
            }
            case "presence":
                return {
                    kind: "presence",
                    value:
                        this.readRowCommitted(tree, scope, target.row).kind ===
                        "present",
                }
            case "collection": {
                const snapshot = this.membership(tree, scope, target.collection)
                return {
                    kind: "rows",
                    rows: snapshot.rows,
                    snapshot: snapshot.id,
                }
            }
        }
    }

    private readDraft(
        draft: Draft,
        scope: ScopeRecord,
        target: TargetRef,
    ): ReadOutcome {
        switch (target.kind) {
            case "atom":
                return {
                    kind: "value",
                    value: this.readAtomDraft(draft, scope, target.atom),
                }
            case "row": {
                const outcome = this.readRowDraft(draft, scope, target.row)
                return outcome.kind === "present"
                    ? { kind: "value", value: outcome.value }
                    : ABSENT_OUTCOME
            }
            case "presence":
                return {
                    kind: "presence",
                    value:
                        this.readRowDraft(draft, scope, target.row).kind ===
                        "present",
                }
            case "collection":
                return this.readCollectionDraft(draft, scope, target.collection)
        }
    }

    private readAtomCommitted(
        tree: TreeRecord,
        scope: ScopeRecord,
        atomId: AtomId,
    ): ValueToken {
        return serveFallback(this.readAtomCommittedOutcome(tree, scope, atomId))
    }

    private readAtomCommittedOutcome(
        tree: TreeRecord,
        scope: ScopeRecord,
        atomId: AtomId,
    ): FallbackOutcome {
        this.atom(atomId)
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            if (current.atomLocals.has(atomId))
                return { ok: true, value: current.atomLocals.get(atomId)! }
            current =
                current.parent === null
                    ? undefined
                    : tree.scopes.get(current.parent)
        }
        return this.resolveFallbackOutcome(
            tree,
            atomId,
            tree.lazyFallbacks,
            true,
        )
    }

    private readAtomBaselineOutcome(
        draft: Draft,
        scope: ScopeRecord,
        atomId: AtomId,
    ): FallbackOutcome {
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            if (current.atomLocals.has(atomId))
                return { ok: true, value: current.atomLocals.get(atomId)! }
            current =
                current.parent === null
                    ? undefined
                    : draft.tree.scopes.get(current.parent)
        }
        return this.resolveDraftFallbackOutcome(draft, atomId)
    }

    private readAtomDraft(
        draft: Draft,
        scope: ScopeRecord,
        atomId: AtomId,
        intents: readonly Intent[] = draft.intents,
    ): ValueToken {
        this.atom(atomId)
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            const intent = lastIntent(intents, current.id, "atom", atomId)
            if (intent?.mutation.targetKind === "atom") {
                if (intent.mutation.kind === "set")
                    return requiredValue(intent.mutation.value)
            } else if (current.atomLocals.has(atomId)) {
                return current.atomLocals.get(atomId)!
            }
            current =
                current.parent === null
                    ? undefined
                    : draft.tree.scopes.get(current.parent)
        }
        return this.resolveDraftFallback(draft, atomId)
    }

    private resolveDraftFallback(draft: Draft, atomId: AtomId): ValueToken {
        return serveFallback(this.resolveDraftFallbackOutcome(draft, atomId))
    }

    private resolveDraftFallbackOutcome(
        draft: Draft,
        atomId: AtomId,
    ): FallbackOutcome {
        const committed = draft.tree.lazyFallbacks.get(atomId)
        if (committed !== undefined) return committed
        return this.resolveFallbackOutcome(
            draft.tree,
            atomId,
            draft.lazyFallbacks,
            false,
        )
    }

    private atomPathReachesFallback(
        draft: Draft,
        scope: ScopeRecord,
        atomId: AtomId,
        intents: readonly Intent[],
    ): boolean {
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            const intent = lastIntent(intents, current.id, "atom", atomId)
            if (intent?.mutation.targetKind === "atom") {
                if (intent.mutation.kind === "set") return false
            } else if (current.atomLocals.has(atomId)) {
                return false
            }
            current =
                current.parent === null
                    ? undefined
                    : draft.tree.scopes.get(current.parent)
        }
        return true
    }

    private resolveFallbackOutcome(
        tree: TreeRecord,
        atomId: AtomId,
        memo: Map<AtomId, FallbackOutcome>,
        committed: boolean,
    ): FallbackOutcome {
        const atom = this.atom(atomId)
        if (atom.fallback.kind === "eager") {
            return { ok: true, value: atom.fallback.value }
        }
        let outcome = memo.get(atomId)
        if (outcome === undefined) {
            outcome =
                atom.fallback.kind === "lazy"
                    ? atom.fallback.value.kind === "identity" &&
                      atom.fallback.value.identityKind === "thenable"
                        ? {
                              ok: false,
                              error: "INVALID_LAZY_ATOM_INITIALIZER",
                          }
                        : { ok: true, value: atom.fallback.value }
                    : { ok: false, error: atom.fallback.code }
            memo.set(atomId, outcome)
            this.audit.push({
                kind: "lazy-fallback-resolved",
                tree: tree.id,
                atom: atomId,
                committed,
            })
        }
        return outcome
    }

    private readRowCommitted(
        tree: TreeRecord,
        scope: ScopeRecord,
        rowId: RowId,
    ): EffectiveRowOutcome {
        this.row(rowId)
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            const local = current.rowLocals.get(rowId)
            if (local?.kind === "present")
                return { kind: "present", value: local.value }
            if (local?.kind === "absent") return ABSENT_ROW
            current =
                current.parent === null
                    ? undefined
                    : tree.scopes.get(current.parent)
        }
        return ABSENT_ROW
    }

    private readRowDraft(
        draft: Draft,
        scope: ScopeRecord,
        rowId: RowId,
        intents: readonly Intent[] = draft.intents,
    ): EffectiveRowOutcome {
        this.row(rowId)
        let current: ScopeRecord | undefined = scope
        while (current !== undefined) {
            const intent = lastIntent(intents, current.id, "row", rowId)
            if (intent?.mutation.targetKind === "row") {
                if (intent.mutation.kind === "present") {
                    return {
                        kind: "present",
                        value: requiredValue(intent.mutation.value),
                    }
                }
                if (intent.mutation.kind === "absent") return ABSENT_ROW
            } else {
                const local = current.rowLocals.get(rowId)
                if (local?.kind === "present")
                    return { kind: "present", value: local.value }
                if (local?.kind === "absent") return ABSENT_ROW
            }
            current =
                current.parent === null
                    ? undefined
                    : draft.tree.scopes.get(current.parent)
        }
        return ABSENT_ROW
    }

    private readCollectionDraft(
        draft: Draft,
        scope: ScopeRecord,
        collectionId: CollectionId,
    ): ReadOutcome {
        const collection = this.collection(collectionId)
        const baseline = this.peekMembership(draft.tree, scope, collectionId)
        const placements = new Map<RowId, MembershipPlacement>()
        const births: Array<{ rowId: RowId; sequence: number }> = []
        for (const rowId of collection.rows) {
            const placement = this.continuousMembershipPlacement(
                draft,
                scope,
                rowId,
            )
            placements.set(rowId, placement)
            if (placement.kind === "birth") {
                births.push({ rowId, sequence: placement.sequence })
            }
        }
        const survivors = baseline.rows.filter(
            rowId => placements.get(rowId)?.kind === "baseline",
        )
        births.sort((left, right) =>
            left.sequence === right.sequence
                ? this.row(left.rowId).order - this.row(right.rowId).order
                : left.sequence - right.sequence,
        )
        const nextRows = [...survivors, ...births.map(birth => birth.rowId)]
        const key = membershipKey(scope.id, collectionId)
        const previous = draft.collectionOutcomes.get(key)
        if (previous !== undefined && sameStrings(previous.rows, nextRows)) {
            return previous
        }
        if (sameStrings(baseline.rows, nextRows)) {
            const unchanged: Extract<ReadOutcome, { kind: "rows" }> = {
                kind: "rows",
                rows: baseline.rows,
                snapshot: baseline.id,
            }
            draft.collectionOutcomes.set(key, unchanged)
            return unchanged
        }
        const changed: Extract<ReadOutcome, { kind: "rows" }> = {
            kind: "rows",
            rows: Object.freeze(nextRows),
            snapshot: `draft:${draft.id}:${draft.nextCollectionSnapshot++}`,
        }
        draft.collectionOutcomes.set(key, changed)
        return changed
    }

    private continuousMembershipPlacement(
        draft: Draft,
        targetScope: ScopeRecord,
        rowId: RowId,
    ): MembershipPlacement {
        const baselineScope = this.liveScope(draft.tree, targetScope.id)
        let previous = this.readRowCommitted(draft.tree, baselineScope, rowId)
        let placement: MembershipPlacement =
            previous.kind === "present"
                ? BASELINE_MEMBERSHIP_PLACEMENT
                : ABSENT_MEMBERSHIP_PLACEMENT
        const prefix: Intent[] = []

        for (const intent of draft.intents) {
            prefix.push(intent)
            if (
                intent.mutation.targetKind !== "row" ||
                intent.mutation.row !== rowId
            ) {
                continue
            }
            const next = this.readRowDraft(draft, baselineScope, rowId, prefix)
            if (previous.kind === "absent" && next.kind === "present") {
                placement = { kind: "birth", sequence: intent.sequence }
            } else if (previous.kind === "present" && next.kind === "absent") {
                placement = ABSENT_MEMBERSHIP_PLACEMENT
            }
            previous = next
        }

        return placement
    }

    private membership(
        tree: TreeRecord,
        scope: ScopeRecord,
        collectionId: CollectionId,
    ): MembershipSnapshot {
        this.collection(collectionId)
        let snapshot = scope.memberships.get(collectionId)
        if (snapshot !== undefined) return snapshot
        const inherited =
            scope.parent === null
                ? []
                : this.membership(
                      tree,
                      this.liveScope(tree, scope.parent),
                      collectionId,
                  ).rows
        const rows = inherited.filter(
            rowId =>
                this.readRowCommitted(tree, scope, rowId).kind === "present",
        )
        snapshot = this.newMembership(rows)
        scope.memberships.set(collectionId, snapshot)
        return snapshot
    }

    private peekMembership(
        tree: TreeRecord,
        scope: ScopeRecord,
        collectionId: CollectionId,
    ): MembershipSnapshot {
        this.collection(collectionId)
        const existing = scope.memberships.get(collectionId)
        if (existing !== undefined) return existing
        const inherited =
            scope.parent === null
                ? EMPTY_ROWS
                : this.peekMembership(
                      tree,
                      this.liveScope(tree, scope.parent),
                      collectionId,
                  ).rows
        const rows = inherited.filter(
            rowId =>
                this.readRowCommitted(tree, scope, rowId).kind === "present",
        )
        return {
            id: `unmaterialized:${JSON.stringify([
                tree.id,
                scope.id,
                collectionId,
            ])}`,
            rows: sameStrings(inherited, rows)
                ? inherited
                : Object.freeze(rows),
        }
    }

    private newMembership(rows: readonly RowId[]): MembershipSnapshot {
        return {
            id: this.nextMembershipSnapshot++,
            rows: Object.freeze([...rows]),
        }
    }

    private assertPresentValue(candidate: ValueToken): void {
        if (candidate.kind === "undefined") {
            throw new ModelFault("UNDEFINED_COLLECTION_VALUE")
        }
        if (
            candidate.kind === "identity" &&
            candidate.identityKind === "thenable"
        ) {
            throw new ModelFault("INVALID_SYNC_COLLECTION_VALUE")
        }
    }

    private assertAtomValue(candidate: ValueToken): void {
        if (
            candidate.kind === "identity" &&
            candidate.identityKind === "thenable"
        ) {
            throw new ModelFault("INVALID_SYNC_ATOM_VALUE")
        }
    }

    private atom(id: AtomId): AtomSpec {
        const atom = this.atoms.get(id)
        if (atom === undefined) throw new ModelFault("ATOM_NOT_FOUND")
        return atom
    }

    private collection(id: CollectionId): CollectionRecord {
        const collection = this.collections.get(id)
        if (collection === undefined)
            throw new ModelFault("COLLECTION_NOT_FOUND")
        return collection
    }

    private row(id: RowId): RowRecord {
        const row = this.rows.get(id)
        if (row === undefined) throw new ModelFault("ROW_NOT_FOUND")
        return row
    }

    private liveTree(id: TreeId): TreeRecord {
        const tree = this.trees.get(id)
        if (tree === undefined) throw new ModelFault("TREE_NOT_FOUND")
        if (tree.disposed) throw new ModelFault("STORE_DISPOSED")
        return tree
    }

    private liveScope(tree: TreeRecord, id: ScopeId): ScopeRecord {
        const scope = tree.scopes.get(id)
        if (scope === undefined) throw new ModelFault("SCOPE_NOT_FOUND")
        if (scope.disposed) throw new ModelFault("STORE_DISPOSED")
        return scope
    }
}

export function createReferenceModel(): ReferenceModel {
    return new ReferenceModel()
}

export function tokenObjectIs(left: ValueToken, right: ValueToken): boolean {
    if (left.kind !== right.kind) return false
    switch (left.kind) {
        case "undefined":
        case "null":
            return true
        case "boolean":
        case "string":
        case "bigint":
            return left.value === (right as typeof left).value
        case "number":
            return Object.is(left.value, (right as typeof left).value)
        case "identity": {
            const other = right as typeof left
            return (
                left.identityKind === other.identityKind && left.id === other.id
            )
        }
    }
}

function applyUpdater(updater: UpdaterSpec, current: ValueToken): ValueToken {
    switch (updater.kind) {
        case "replace":
            return updater.value
        case "number-add":
            if (current.kind !== "number")
                throw new ModelFault("UPDATER_TYPE_ERROR")
            return { kind: "number", value: current.value + updater.amount }
        case "fail":
            throw new ModelFault(updater.code)
    }
}

function compare(
    spec: EqualitySpec | undefined,
    previous: ValueToken,
    next: ValueToken,
): boolean {
    const resolved = spec ?? DEFAULT_EQUALITY
    switch (resolved.kind) {
        case "object-is":
            return tokenObjectIs(previous, next)
        case "always":
            return true
        case "number-distance":
            return (
                previous.kind === "number" &&
                next.kind === "number" &&
                Math.abs(previous.value - next.value) <= resolved.maximum
            )
    }
}

function collapseIntents(intents: readonly Intent[]): Map<string, Intent> {
    const collapsed = new Map<string, Intent>()
    for (const intent of intents) {
        const mutation = intent.mutation
        collapsed.set(
            mutation.targetKind === "atom"
                ? localKey(intent.scope, "atom", mutation.atom)
                : localKey(intent.scope, "row", mutation.row),
            intent,
        )
    }
    return collapsed
}

function lastIntent(
    intents: readonly Intent[],
    scope: ScopeId,
    targetKind: "atom" | "row",
    targetId: string,
): Intent | undefined {
    for (let index = intents.length - 1; index >= 0; index -= 1) {
        const intent = intents[index]!
        if (intent.scope !== scope || intent.mutation.targetKind !== targetKind)
            continue
        if (
            (targetKind === "atom" &&
                intent.mutation.targetKind === "atom" &&
                intent.mutation.atom === targetId) ||
            (targetKind === "row" &&
                intent.mutation.targetKind === "row" &&
                intent.mutation.row === targetId)
        ) {
            return intent
        }
    }
    return undefined
}

function liveScopes(tree: TreeRecord): readonly ScopeRecord[] {
    return [...tree.scopes.values()].filter(scope => !scope.disposed)
}

function cloneTree(tree: TreeRecord): TreeRecord {
    const scopes = new Map<ScopeId, ScopeRecord>()
    for (const scope of tree.scopes.values()) {
        scopes.set(scope.id, {
            id: scope.id,
            parent: scope.parent,
            children: [...scope.children],
            namedChildren: new Map(scope.namedChildren),
            atomLocals: new Map(scope.atomLocals),
            rowLocals: new Map(scope.rowLocals),
            memberships: new Map(scope.memberships),
            disposed: scope.disposed,
        })
    }
    return {
        id: tree.id,
        root: tree.root,
        scopes,
        lazyFallbacks: new Map(tree.lazyFallbacks),
        epoch: tree.epoch,
        disposed: tree.disposed,
    }
}

function rowLocalEqual(
    left: RowLocal | undefined,
    right: RowLocal | undefined,
): boolean {
    if (left === undefined || right === undefined) return left === right
    if (left.kind !== right.kind) return false
    if (left.kind === "absent") return true
    return tokenObjectIs(
        left.value,
        (right as Extract<RowLocal, { kind: "present" }>).value,
    )
}

function fallbackOutcomeEqual(
    left: FallbackOutcome | undefined,
    right: FallbackOutcome,
): boolean {
    if (left === undefined || left.ok !== right.ok) return false
    if (!left.ok)
        return left.error === (right as { readonly error: string }).error
    return tokenObjectIs(
        left.value,
        (right as { readonly ok: true; readonly value: ValueToken }).value,
    )
}

function rowOutcomeEqual(
    left: EffectiveRowOutcome,
    right: EffectiveRowOutcome,
): boolean {
    if (left.kind !== right.kind) return false
    if (left.kind === "absent") return true
    return tokenObjectIs(
        left.value,
        (right as Extract<EffectiveRowOutcome, { kind: "present" }>).value,
    )
}

function readOutcomeEqual(left: ReadOutcome, right: ReadOutcome): boolean {
    if (left.kind !== right.kind) return false
    switch (left.kind) {
        case "absent":
            return true
        case "presence":
            return left.value === (right as typeof left).value
        case "value":
            return tokenObjectIs(left.value, (right as typeof left).value)
        case "rows":
            return sameStrings(left.rows, (right as typeof left).rows)
    }
}

function targetRefEqual(left: TargetRef, right: TargetRef): boolean {
    if (left.kind !== right.kind) return false
    switch (left.kind) {
        case "atom":
            return left.atom === (right as typeof left).atom
        case "row":
        case "presence":
            return left.row === (right as typeof left).row
        case "collection":
            return left.collection === (right as typeof left).collection
    }
}

function sameStrings(
    left: readonly string[],
    right: readonly string[],
): boolean {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    )
}

function normalizeKey(key: CollectionKey): CollectionKey {
    if (typeof key === "number") {
        if (!Number.isFinite(key))
            throw new ModelFault("INVALID_COLLECTION_KEY")
        return Object.is(key, -0) ? 0 : key
    }
    return key
}

function assertModelId(id: string): void {
    if (id.includes("\u0000")) throw new ModelFault("INVALID_MODEL_ID")
}

function keyIdentity(key: CollectionKey): string {
    if (key === null) return "null:"
    return `${typeof key}:${String(key)}`
}

function localKey(scope: ScopeId, kind: "atom" | "row", id: string): string {
    return `${scope}\u0000${kind}\u0000${id}`
}

function effectiveKey(scope: ScopeId, id: string): string {
    return `${scope}\u0000${id}`
}

function membershipKey(scope: ScopeId, collection: CollectionId): string {
    return `${scope}\u0000${collection}`
}

function requiredValue(value: ValueToken | undefined): ValueToken {
    if (value === undefined) throw new ModelFault("MISSING_INTENT_VALUE")
    return value
}

function serveFallback(outcome: FallbackOutcome): ValueToken {
    if (!outcome.ok) throw new ModelFault(outcome.error)
    return outcome.value
}

function faultCode(error: unknown): string {
    if (error instanceof ModelFault) return error.code
    return "UNEXPECTED_MODEL_ERROR"
}

function unreachable(value: never, code: string): never {
    void value
    throw new ModelFault(code)
}

const ABSENT_LOCAL: RowLocal = Object.freeze({ kind: "absent" })
const ABSENT_ROW: EffectiveRowOutcome = Object.freeze({ kind: "absent" })
const ABSENT_OUTCOME: ReadOutcome = Object.freeze({ kind: "absent" })
const BASELINE_MEMBERSHIP_PLACEMENT: MembershipPlacement = Object.freeze({
    kind: "baseline",
})
const ABSENT_MEMBERSHIP_PLACEMENT: MembershipPlacement = Object.freeze({
    kind: "absent",
})
const EMPTY_ROWS: readonly RowId[] = Object.freeze([])
const DEFAULT_EQUALITY: EqualitySpec = Object.freeze({ kind: "object-is" })
