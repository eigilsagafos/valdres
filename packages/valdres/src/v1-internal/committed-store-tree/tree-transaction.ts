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
 * Scratch storage is absent until the first Selector read. Atom-only direct
 * and transaction paths therefore allocate neither a scratch map nor a host.
 */
export class TreeDraft {
    readonly transaction = Object.freeze({})
    readonly intents = new Map<StoreScopeNode, Map<AnyAtom, AtomIntent>>()
    readonly atomBaselines = new Map<
        StoreScopeNode,
        Map<AnyAtom, AtomDraftBaseline>
    >()
    readonly fallbackMemo = new Map<AnyAtom, DraftAtomOutcome>()
    #scratchHosts: Map<StoreScopeNode, DraftScratchHost> | undefined
    generation = 0
    active = true

    stage(scope: StoreScopeNode, intent: AtomIntent): void {
        let intents = this.intents.get(scope)
        if (intents === undefined) {
            intents = new Map()
            this.intents.set(scope, intents)
        }
        intents.set(intent.atom, intent)
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
        this.intents.clear()
        this.atomBaselines.clear()
        this.fallbackMemo.clear()
        this.#scratchHosts?.clear()
        this.#scratchHosts = undefined
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
