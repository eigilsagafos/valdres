import type { SelectorOutcome } from "../selector-evaluator/types"
import type { AnyAtom, AnyState, RuntimeDomainRecords } from "./runtime-domain"
import {
    InvalidTransactionCallbackResultError,
    brandRuntimeHandle,
    containThenable,
    inspectThenable,
} from "./runtime-domain"
import type { Atom, AtomUpdater, RootTransaction, State } from "./types"

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
          fallback: DraftAtomOutcome
          publishDraftFallback: boolean
      }>

export interface DraftScratchHost<Node extends object = AnyState> {
    readSelector<Value>(selector: Node): Value
    advanceGeneration(generation: number): void
    revoke(): void
}

/**
 * One root-only StoreTree draft. Maps hold only guarded, inert outcomes and
 * canonical intents; final preflight and apply therefore invoke no user code.
 */
export class TreeDraft {
    readonly transaction = Object.freeze({})
    readonly intents = new Map<AnyAtom, AtomIntent>()
    readonly atomBaselines = new Map<AnyAtom, AtomDraftBaseline>()
    readonly fallbackMemo = new Map<AnyAtom, DraftAtomOutcome>()
    generation = 0
    active = true
    scratchHost: DraftScratchHost | undefined

    stage(intent: AtomIntent): void {
        this.intents.set(intent.atom, intent)
        this.generation += 1
        this.scratchHost?.advanceGeneration(this.generation)
    }

    close(): void {
        if (!this.active) return
        this.active = false
        this.scratchHost?.revoke()
    }
}

export interface TreeTransactionHost {
    readonly runtimeDomain: RuntimeDomainRecords

    transactionGet<Value>(draft: TreeDraft, state: State<Value>): Value
    transactionSet<Value>(
        draft: TreeDraft,
        atom: Atom<Value>,
        value: Value,
    ): void
    transactionUpdate<Value>(
        draft: TreeDraft,
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ): void
    transactionReset<Value>(draft: TreeDraft, atom: Atom<Value>): void
}

class RootTransactionCursor implements RootTransaction {
    readonly get: <Value>(state: State<Value>) => Value
    readonly set: <Value>(atom: Atom<Value>, value: Value) => void
    readonly update: <Value>(
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ) => void
    readonly reset: <Value>(atom: Atom<Value>) => void

    constructor(host: TreeTransactionHost, draft: TreeDraft) {
        this.get = <Value>(state: State<Value>): Value =>
            host.transactionGet(draft, state)
        this.set = <Value>(atom: Atom<Value>, value: Value): void =>
            host.transactionSet(draft, atom, value)
        this.update = <Value>(
            atom: Atom<Value>,
            update: AtomUpdater<Value>,
        ): void => host.transactionUpdate(draft, atom, update)
        this.reset = <Value>(atom: Atom<Value>): void =>
            host.transactionReset(draft, atom)
        brandRuntimeHandle(this, host.runtimeDomain.ownerToken)
        Object.freeze(this)
    }
}

export const createRootTransactionCursor = (
    host: TreeTransactionHost,
    draft: TreeDraft,
): RootTransaction => new RootTransactionCursor(host, draft)

export const inspectTransactionCallbackResult = (result: unknown): void => {
    const inspected = inspectThenable(result)
    if (inspected.kind === "not-thenable") return
    if (inspected.kind === "inspection-error") throw inspected.error
    containThenable(inspected)
    throw new InvalidTransactionCallbackResultError()
}

export type { AnyState }
