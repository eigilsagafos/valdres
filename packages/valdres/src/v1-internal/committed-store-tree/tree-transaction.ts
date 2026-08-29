import type { SelectorOutcome } from "../selector-evaluator/types"
import type { AnyAtom, AnyState, RuntimeDomainRecords } from "./runtime-domain"
import {
    InvalidTransactionCallbackResultError,
    brandRuntimeHandle,
    containThenable,
    inspectThenable,
} from "./runtime-domain"
import type { StoreScopeNode } from "./scope-node"
import type {
    Atom,
    AtomUpdater,
    CommittedStoreTree,
    RootTransaction,
    State,
    TransactionCallback,
} from "./types"

export type DraftAtomOutcome = Extract<
    SelectorOutcome<unknown>,
    { readonly kind: "value" | "error" }
>

export interface AtomDraftBaseline {
    readonly owned: boolean
    readonly outcome: DraftAtomOutcome
    readonly reachesFallback: boolean
}

export type AtomIntent =
    | Readonly<{
          kind: "set"
          atom: AnyAtom
          value: unknown
          publishDraftFallback: boolean
      }>
    | Readonly<{
          kind: "reset"
          atom: AnyAtom
          publishDraftFallback: boolean
      }>

export interface DraftScratchHost<Node extends object = AnyState> {
    readSelector<Value>(selector: Node): Value
    advanceGeneration(generation: number): void
    revoke(): void
}

/**
 * One StoreTree draft. Maps hold only guarded, inert outcomes and
 * canonical intents; final preflight and apply therefore invoke no user code.
 *
 *     read(scope, atom)
 *       -> nearest staged set (a symbolic reset keeps walking)
 *       -> nearest committed override
 *       -> draft/committed fallback
 *
 * Two same-scope intent/baseline coordinates stay inline before promotion.
 * Scratch storage is absent until the first Selector read, so Atom-only direct
 * and transaction paths allocate neither a scratch map nor a host.
 */
export class TreeDraft {
    readonly transaction = Object.freeze({})
    readonly #onStorageAllocation: (() => void) | undefined
    #singleIntentScope: StoreScopeNode | undefined
    #singleIntent: AtomIntent | undefined
    #secondIntent: AtomIntent | undefined
    #intentBucket: Map<AnyAtom, AtomIntent> | undefined
    #intentScopes: Map<StoreScopeNode, Map<AnyAtom, AtomIntent>> | undefined
    #singleBaselineScope: StoreScopeNode | undefined
    #singleBaselineAtom: AnyAtom | undefined
    #singleBaseline: AtomDraftBaseline | undefined
    #secondBaselineAtom: AnyAtom | undefined
    #secondBaseline: AtomDraftBaseline | undefined
    #baselineBucket: Map<AnyAtom, AtomDraftBaseline> | undefined
    #baselineScopes:
        | Map<StoreScopeNode, Map<AnyAtom, AtomDraftBaseline>>
        | undefined
    #singleFallbackAtom: AnyAtom | undefined
    #singleFallback: DraftAtomOutcome | undefined
    #fallbackMemo: Map<AnyAtom, DraftAtomOutcome> | undefined
    #scratchHosts: Map<StoreScopeNode, DraftScratchHost> | undefined
    generation = 0
    active = true

    constructor(onStorageAllocation?: () => void) {
        this.#onStorageAllocation = onStorageAllocation
    }

    get hasIntents(): boolean {
        return (
            this.#singleIntent !== undefined ||
            this.#secondIntent !== undefined ||
            this.#intentBucket !== undefined ||
            this.#intentScopes !== undefined
        )
    }

    get singleIntentScope(): StoreScopeNode | undefined {
        return this.#singleIntentScope
    }

    get singleIntent(): AtomIntent | undefined {
        return this.#secondIntent === undefined ? this.#singleIntent : undefined
    }

    stage(scope: StoreScopeNode, intent: AtomIntent): void {
        const intentScopes = this.#intentScopes
        if (intentScopes !== undefined) {
            let intents = intentScopes.get(scope)
            if (intents === undefined) {
                intents = this.#allocateMap<AnyAtom, AtomIntent>()
                intentScopes.set(scope, intents)
            }
            intents.set(intent.atom, intent)
            this.#advanceGeneration()
            return
        }

        const intentBucket = this.#intentBucket
        if (intentBucket !== undefined) {
            if (Object.is(this.#singleIntentScope, scope)) {
                intentBucket.set(intent.atom, intent)
            } else {
                const scopes = this.#allocateMap<
                    StoreScopeNode,
                    Map<AnyAtom, AtomIntent>
                >()
                scopes.set(
                    this.#singleIntentScope as StoreScopeNode,
                    intentBucket,
                )
                const next = this.#allocateMap<AnyAtom, AtomIntent>()
                next.set(intent.atom, intent)
                scopes.set(scope, next)
                this.#intentScopes = scopes
                this.#intentBucket = undefined
                this.#singleIntentScope = undefined
            }
            this.#advanceGeneration()
            return
        }

        const singleIntent = this.#singleIntent
        if (singleIntent === undefined) {
            this.#singleIntentScope = scope
            this.#singleIntent = intent
            this.#advanceGeneration()
            return
        }
        if (
            Object.is(this.#singleIntentScope, scope) &&
            Object.is(singleIntent.atom, intent.atom)
        ) {
            this.#singleIntent = intent
            this.#advanceGeneration()
            return
        }

        if (Object.is(this.#singleIntentScope, scope)) {
            const secondIntent = this.#secondIntent
            if (secondIntent === undefined) {
                this.#secondIntent = intent
                this.#advanceGeneration()
                return
            }
            if (Object.is(secondIntent.atom, intent.atom)) {
                this.#secondIntent = intent
                this.#advanceGeneration()
                return
            }
            const intents = this.#allocateMap<AnyAtom, AtomIntent>()
            intents.set(singleIntent.atom, singleIntent)
            intents.set(secondIntent.atom, secondIntent)
            intents.set(intent.atom, intent)
            this.#intentBucket = intents
        } else {
            const scopes = this.#allocateMap<
                StoreScopeNode,
                Map<AnyAtom, AtomIntent>
            >()
            const first = this.#allocateMap<AnyAtom, AtomIntent>()
            first.set(singleIntent.atom, singleIntent)
            if (this.#secondIntent !== undefined) {
                first.set(this.#secondIntent.atom, this.#secondIntent)
            }
            scopes.set(this.#singleIntentScope as StoreScopeNode, first)
            const next = this.#allocateMap<AnyAtom, AtomIntent>()
            next.set(intent.atom, intent)
            scopes.set(scope, next)
            this.#intentScopes = scopes
            this.#singleIntentScope = undefined
        }
        this.#singleIntent = undefined
        this.#secondIntent = undefined
        this.#advanceGeneration()
    }

    forEachIntent(
        visit: (scope: StoreScopeNode, intent: AtomIntent) => void,
    ): void {
        const singleIntent = this.#singleIntent
        if (singleIntent !== undefined) {
            visit(this.#singleIntentScope as StoreScopeNode, singleIntent)
            if (this.#secondIntent !== undefined) {
                visit(
                    this.#singleIntentScope as StoreScopeNode,
                    this.#secondIntent,
                )
            }
            return
        }
        const intentBucket = this.#intentBucket
        if (intentBucket !== undefined) {
            const scope = this.#singleIntentScope as StoreScopeNode
            for (const intent of intentBucket.values()) visit(scope, intent)
            return
        }
        const intentScopes = this.#intentScopes
        if (intentScopes === undefined) return
        for (const [scope, intents] of intentScopes) {
            for (const intent of intents.values()) visit(scope, intent)
        }
    }

    getIntent(scope: StoreScopeNode, atom: AnyAtom): AtomIntent | undefined {
        const singleIntent = this.#singleIntent
        if (
            singleIntent !== undefined &&
            Object.is(this.#singleIntentScope, scope) &&
            Object.is(singleIntent.atom, atom)
        ) {
            return singleIntent
        }
        const secondIntent = this.#secondIntent
        if (
            secondIntent !== undefined &&
            Object.is(this.#singleIntentScope, scope) &&
            Object.is(secondIntent.atom, atom)
        ) {
            return secondIntent
        }
        if (Object.is(this.#singleIntentScope, scope)) {
            return this.#intentBucket?.get(atom)
        }
        return this.#intentScopes?.get(scope)?.get(atom)
    }

    getAtomBaseline(
        scope: StoreScopeNode,
        atom: AnyAtom,
    ): AtomDraftBaseline | undefined {
        if (
            this.#singleBaseline !== undefined &&
            Object.is(this.#singleBaselineScope, scope) &&
            Object.is(this.#singleBaselineAtom, atom)
        ) {
            return this.#singleBaseline
        }
        if (
            this.#secondBaseline !== undefined &&
            Object.is(this.#singleBaselineScope, scope) &&
            Object.is(this.#secondBaselineAtom, atom)
        ) {
            return this.#secondBaseline
        }
        if (Object.is(this.#singleBaselineScope, scope)) {
            return this.#baselineBucket?.get(atom)
        }
        return this.#baselineScopes?.get(scope)?.get(atom)
    }

    setAtomBaseline(
        scope: StoreScopeNode,
        atom: AnyAtom,
        baseline: AtomDraftBaseline,
    ): void {
        const baselineScopes = this.#baselineScopes
        if (baselineScopes !== undefined) {
            let baselines = baselineScopes.get(scope)
            if (baselines === undefined) {
                baselines = this.#allocateMap<AnyAtom, AtomDraftBaseline>()
                baselineScopes.set(scope, baselines)
            }
            if (!baselines.has(atom)) baselines.set(atom, baseline)
            return
        }

        const baselineBucket = this.#baselineBucket
        if (baselineBucket !== undefined) {
            if (Object.is(this.#singleBaselineScope, scope)) {
                if (!baselineBucket.has(atom)) {
                    baselineBucket.set(atom, baseline)
                }
            } else {
                const scopes = this.#allocateMap<
                    StoreScopeNode,
                    Map<AnyAtom, AtomDraftBaseline>
                >()
                scopes.set(
                    this.#singleBaselineScope as StoreScopeNode,
                    baselineBucket,
                )
                const next = this.#allocateMap<AnyAtom, AtomDraftBaseline>()
                next.set(atom, baseline)
                scopes.set(scope, next)
                this.#baselineScopes = scopes
                this.#baselineBucket = undefined
                this.#singleBaselineScope = undefined
            }
            return
        }

        const singleBaseline = this.#singleBaseline
        if (singleBaseline === undefined) {
            this.#singleBaselineScope = scope
            this.#singleBaselineAtom = atom
            this.#singleBaseline = baseline
            return
        }
        if (
            Object.is(this.#singleBaselineScope, scope) &&
            Object.is(this.#singleBaselineAtom, atom)
        ) {
            return
        }

        if (Object.is(this.#singleBaselineScope, scope)) {
            const secondBaseline = this.#secondBaseline
            if (secondBaseline === undefined) {
                this.#secondBaselineAtom = atom
                this.#secondBaseline = baseline
                return
            }
            if (Object.is(this.#secondBaselineAtom, atom)) return
            const baselines = this.#allocateMap<AnyAtom, AtomDraftBaseline>()
            baselines.set(this.#singleBaselineAtom as AnyAtom, singleBaseline)
            baselines.set(this.#secondBaselineAtom as AnyAtom, secondBaseline)
            baselines.set(atom, baseline)
            this.#baselineBucket = baselines
        } else {
            const scopes = this.#allocateMap<
                StoreScopeNode,
                Map<AnyAtom, AtomDraftBaseline>
            >()
            const first = this.#allocateMap<AnyAtom, AtomDraftBaseline>()
            first.set(this.#singleBaselineAtom as AnyAtom, singleBaseline)
            if (
                this.#secondBaselineAtom !== undefined &&
                this.#secondBaseline !== undefined
            ) {
                first.set(this.#secondBaselineAtom, this.#secondBaseline)
            }
            scopes.set(this.#singleBaselineScope as StoreScopeNode, first)
            const next = this.#allocateMap<AnyAtom, AtomDraftBaseline>()
            next.set(atom, baseline)
            scopes.set(scope, next)
            this.#baselineScopes = scopes
            this.#singleBaselineScope = undefined
        }
        this.#singleBaselineAtom = undefined
        this.#singleBaseline = undefined
        this.#secondBaselineAtom = undefined
        this.#secondBaseline = undefined
    }

    getFallback(atom: AnyAtom): DraftAtomOutcome | undefined {
        if (Object.is(this.#singleFallbackAtom, atom)) {
            return this.#singleFallback
        }
        return this.#fallbackMemo?.get(atom)
    }

    hasFallback(atom: AnyAtom): boolean {
        return (
            Object.is(this.#singleFallbackAtom, atom) ||
            (this.#fallbackMemo?.has(atom) ?? false)
        )
    }

    setFallback(atom: AnyAtom, outcome: DraftAtomOutcome): void {
        const fallbackMemo = this.#fallbackMemo
        if (fallbackMemo !== undefined) {
            fallbackMemo.set(atom, outcome)
            return
        }
        if (this.#singleFallback === undefined) {
            this.#singleFallbackAtom = atom
            this.#singleFallback = outcome
            return
        }
        if (Object.is(this.#singleFallbackAtom, atom)) {
            this.#singleFallback = outcome
            return
        }
        const memo = this.#allocateMap<AnyAtom, DraftAtomOutcome>()
        memo.set(this.#singleFallbackAtom as AnyAtom, this.#singleFallback)
        memo.set(atom, outcome)
        this.#fallbackMemo = memo
        this.#singleFallbackAtom = undefined
        this.#singleFallback = undefined
    }

    #advanceGeneration(): void {
        this.generation += 1
        const scratchHosts = this.#scratchHosts
        if (scratchHosts !== undefined) {
            for (const scratchHost of scratchHosts.values()) {
                scratchHost.advanceGeneration(this.generation)
            }
        }
    }

    getScratchHost(scope: StoreScopeNode): DraftScratchHost | undefined {
        return this.#scratchHosts?.get(scope)
    }

    installScratchHost(
        scope: StoreScopeNode,
        scratchHost: DraftScratchHost,
    ): boolean {
        let scratchHosts = this.#scratchHosts
        const allocated = scratchHosts === undefined
        if (scratchHosts === undefined) {
            scratchHosts = new Map()
            this.#scratchHosts = scratchHosts
        }
        scratchHosts.set(scope, scratchHost)
        return allocated
    }

    close(): void {
        if (!this.active) return
        this.active = false
        const scratchHosts = this.#scratchHosts
        if (scratchHosts !== undefined) {
            for (const scratchHost of scratchHosts.values()) {
                scratchHost.revoke()
            }
            scratchHosts.clear()
        }
        this.#scratchHosts = undefined
    }

    release(): void {
        this.#intentBucket?.clear()
        if (this.#intentScopes !== undefined) {
            for (const intents of this.#intentScopes.values()) intents.clear()
            this.#intentScopes.clear()
        }
        this.#baselineBucket?.clear()
        if (this.#baselineScopes !== undefined) {
            for (const baselines of this.#baselineScopes.values()) {
                baselines.clear()
            }
            this.#baselineScopes.clear()
        }
        this.#fallbackMemo?.clear()
        this.#singleIntentScope = undefined
        this.#singleIntent = undefined
        this.#secondIntent = undefined
        this.#intentBucket = undefined
        this.#intentScopes = undefined
        this.#singleBaselineScope = undefined
        this.#singleBaselineAtom = undefined
        this.#singleBaseline = undefined
        this.#secondBaselineAtom = undefined
        this.#secondBaseline = undefined
        this.#baselineBucket = undefined
        this.#baselineScopes = undefined
        this.#singleFallbackAtom = undefined
        this.#singleFallback = undefined
        this.#fallbackMemo = undefined
        this.#scratchHosts?.clear()
        this.#scratchHosts = undefined
    }

    #allocateMap<Key, Value>(): Map<Key, Value> {
        this.#onStorageAllocation?.()
        return new Map<Key, Value>()
    }
}

export interface TreeTransactionHost {
    readonly runtimeDomain: RuntimeDomainRecords

    transactionGet<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        state: State<Value>,
    ): Value
    transactionSet<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
        value: Value,
    ): void
    transactionUpdate<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ): void
    transactionReset<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
    ): void
    transactionScope<Result>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        target: string | CommittedStoreTree,
        argumentCount: number,
        callback?: TransactionCallback<Result>,
    ): RootTransaction | Result
}

class RootTransactionCursor implements RootTransaction {
    readonly get: <Value>(state: State<Value>) => Value
    readonly set: <Value>(atom: Atom<Value>, value: Value) => void
    readonly update: <Value>(
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ) => void
    readonly reset: <Value>(atom: Atom<Value>) => void
    readonly scope: {
        (target: string | CommittedStoreTree): RootTransaction
        <Result>(
            target: string | CommittedStoreTree,
            callback: TransactionCallback<Result>,
        ): Result
    }

    constructor(
        host: TreeTransactionHost,
        draft: TreeDraft,
        scope: StoreScopeNode,
    ) {
        this.get = <Value>(state: State<Value>): Value =>
            host.transactionGet(draft, scope, state)
        this.set = <Value>(atom: Atom<Value>, value: Value): void =>
            host.transactionSet(draft, scope, atom, value)
        this.update = <Value>(
            atom: Atom<Value>,
            update: AtomUpdater<Value>,
        ): void => host.transactionUpdate(draft, scope, atom, update)
        this.reset = <Value>(atom: Atom<Value>): void =>
            host.transactionReset(draft, scope, atom)
        this.scope = (<Result>(
            ...args:
                | [target: string | CommittedStoreTree]
                | [
                      target: string | CommittedStoreTree,
                      callback: TransactionCallback<Result>,
                  ]
        ): RootTransaction | Result =>
            host.transactionScope(
                draft,
                scope,
                args[0],
                args.length,
                args[1],
            )) as {
            (target: string | CommittedStoreTree): RootTransaction
            <Result>(
                target: string | CommittedStoreTree,
                callback: TransactionCallback<Result>,
            ): Result
        }
        brandRuntimeHandle(this, host.runtimeDomain.ownerToken)
        host.runtimeDomain.transactionCursors.set(this, draft)
        Object.freeze(this)
    }
}

export const createRootTransactionCursor = (
    host: TreeTransactionHost,
    draft: TreeDraft,
    scope: StoreScopeNode,
): RootTransaction => new RootTransactionCursor(host, draft, scope)

export const inspectTransactionCallbackResult = (result: unknown): void => {
    const inspected = inspectThenable(result)
    if (inspected.kind === "not-thenable") return
    if (inspected.kind === "inspection-error") throw inspected.error
    containThenable(inspected)
    throw new InvalidTransactionCallbackResultError()
}

export const rethrowTransactionCallbackThrow = (thrown: unknown): never => {
    const inspected = inspectThenable(thrown)
    if (inspected.kind === "not-thenable") throw thrown
    if (inspected.kind === "inspection-error") throw inspected.error
    containThenable(inspected)
    throw new InvalidTransactionCallbackResultError()
}

export type { AnyState }
