export type ScopeId = string
export type TreeId = string
export type AtomId = string
export type CollectionId = string
export type RowId = string

export type ValueToken =
    | Readonly<{ kind: "undefined" }>
    | Readonly<{ kind: "null" }>
    | Readonly<{ kind: "boolean"; value: boolean }>
    | Readonly<{ kind: "number"; value: number }>
    | Readonly<{ kind: "string"; value: string }>
    | Readonly<{ kind: "bigint"; value: bigint }>
    | Readonly<{
          kind: "identity"
          identityKind: "object" | "array" | "function" | "symbol" | "thenable"
          id: string
      }>

export const value = Object.freeze({
    undefined: Object.freeze({ kind: "undefined" }) as ValueToken,
    null: Object.freeze({ kind: "null" }) as ValueToken,
    boolean(input: boolean): ValueToken {
        return Object.freeze({ kind: "boolean", value: input })
    },
    number(input: number): ValueToken {
        return Object.freeze({ kind: "number", value: input })
    },
    string(input: string): ValueToken {
        return Object.freeze({ kind: "string", value: input })
    },
    bigint(input: bigint): ValueToken {
        return Object.freeze({ kind: "bigint", value: input })
    },
    identity(
        identityKind: "object" | "array" | "function" | "symbol" | "thenable",
        id: string,
    ): ValueToken {
        return Object.freeze({ kind: "identity", identityKind, id })
    },
})

export type EqualitySpec =
    | Readonly<{ kind: "object-is" }>
    | Readonly<{ kind: "always" }>
    | Readonly<{ kind: "number-distance"; maximum: number }>

export type AtomFallback =
    | Readonly<{ kind: "eager"; value: ValueToken }>
    | Readonly<{ kind: "lazy"; value: ValueToken }>
    | Readonly<{ kind: "lazy-error"; code: string }>

export interface AtomSpec {
    readonly id: AtomId
    readonly fallback: AtomFallback
    readonly equal?: EqualitySpec
}

export type CollectionKey = string | number | bigint | boolean | null

export interface CollectionSpec {
    readonly id: CollectionId
}

export type TargetRef =
    | Readonly<{ kind: "atom"; atom: AtomId }>
    | Readonly<{ kind: "row"; row: RowId }>
    | Readonly<{ kind: "presence"; row: RowId }>
    | Readonly<{ kind: "collection"; collection: CollectionId }>

export type UpdaterSpec =
    | Readonly<{ kind: "replace"; value: ValueToken }>
    | Readonly<{ kind: "number-add"; amount: number }>
    | Readonly<{ kind: "fail"; code: string }>

export type Mutation =
    | Readonly<{
          kind: "set-atom"
          atom: AtomId
          value: ValueToken
      }>
    | Readonly<{ kind: "update-atom"; atom: AtomId; updater: UpdaterSpec }>
    | Readonly<{ kind: "reset-atom"; atom: AtomId }>
    | Readonly<{ kind: "set-row"; row: RowId; value: ValueToken }>
    | Readonly<{ kind: "update-row"; row: RowId; updater: UpdaterSpec }>
    | Readonly<{ kind: "delete-row"; row: RowId }>
    | Readonly<{ kind: "reset-row"; row: RowId }>

export type CursorTarget =
    | Readonly<{ kind: "scope"; tree: TreeId; scope: ScopeId }>
    | Readonly<{ kind: "child-name"; parentCursor: string; name: string }>

export type TransactionStep =
    | Readonly<{
          kind: "resolve-cursor"
          cursor: string
          target: CursorTarget
      }>
    | Readonly<{
          kind: "mutate"
          cursor: string
          mutation: Mutation
      }>
    | Readonly<{
          kind: "read"
          cursor: string
          target: TargetRef
          as: string
      }>
    | Readonly<{ kind: "attempt"; steps: readonly TransactionStep[] }>
    | Readonly<{ kind: "raise"; code: string }>
    | Readonly<{ kind: "return"; value: ValueToken }>

export type Command =
    | Readonly<{ kind: "define-atom"; atom: AtomSpec }>
    | Readonly<{ kind: "define-collection"; collection: CollectionSpec }>
    | Readonly<{
          kind: "define-row"
          collection: CollectionId
          row: RowId
          key: CollectionKey
      }>
    | Readonly<{ kind: "create-tree"; tree: TreeId; root: ScopeId }>
    | Readonly<{
          kind: "create-scope"
          tree: TreeId
          parent: ScopeId
          scope: ScopeId
          name?: string
      }>
    | Readonly<{ kind: "dispose"; tree: TreeId; scope: ScopeId }>
    | Readonly<{
          kind: "read"
          tree: TreeId
          scope: ScopeId
          target: TargetRef
          as: string
      }>
    | Readonly<{
          kind: "subscribe"
          tree: TreeId
          scope: ScopeId
          target: TargetRef
          subscription: string
          observe?: readonly Readonly<{
              scope: ScopeId
              target: TargetRef
              as: string
          }>[]
      }>
    | Readonly<{ kind: "unsubscribe"; subscription: string }>
    | Readonly<{
          kind: "mutate"
          tree: TreeId
          scope: ScopeId
          mutation: Mutation
      }>
    | Readonly<{
          kind: "transact"
          tree: TreeId
          entryScope: ScopeId
          steps: readonly TransactionStep[]
      }>

export type ReadOutcome =
    | Readonly<{ kind: "value"; value: ValueToken }>
    | Readonly<{ kind: "absent" }>
    | Readonly<{ kind: "presence"; value: boolean }>
    | Readonly<{
          kind: "rows"
          rows: readonly RowId[]
          snapshot: number | string
      }>

export type ObservableEvent =
    | Readonly<{ kind: "read"; as: string; outcome: ReadOutcome }>
    | Readonly<{
          kind: "attempt-error"
          code: string
      }>
    | Readonly<{
          kind: "notifications"
          subscriptions: readonly string[]
      }>
    | Readonly<{
          kind: "notification-observation"
          subscription: string
          reads: readonly Readonly<{ as: string; outcome: ReadOutcome }>[]
      }>
    | Readonly<{
          kind: "transaction"
          status: "committed" | "aborted"
          result?: ValueToken
          error?: string
      }>
    | Readonly<{
          kind: "disposed"
          scopes: readonly ScopeId[]
      }>

export type EffectiveRowOutcome =
    | Readonly<{ kind: "absent" }>
    | Readonly<{ kind: "present"; value: ValueToken }>

export interface EffectiveRowDelta {
    readonly scope: ScopeId
    readonly collection: CollectionId
    readonly row: RowId
    readonly before: EffectiveRowOutcome
    readonly after: EffectiveRowOutcome
    readonly membership: "insert" | "remove" | "unchanged"
    readonly birthSequence?: number
}

export type AuditEvent =
    | Readonly<{
          kind: "commit"
          tree: TreeId
          epoch: number
          ownershipChanges: readonly string[]
          effectiveAtomChanges: readonly string[]
          collectionDeltas: readonly EffectiveRowDelta[]
      }>
    | Readonly<{
          kind: "scope-created"
          tree: TreeId
          scope: ScopeId
          parent: ScopeId | null
          name: string | null
      }>
    | Readonly<{
          kind: "lazy-fallback-resolved"
          tree: TreeId
          atom: AtomId
          committed: boolean
      }>

export interface CommandResult {
    readonly ok: boolean
    readonly outcome?: ReadOutcome
    readonly value?: ValueToken
    readonly error?: string
    readonly committed?: boolean
    readonly row?: RowId
    readonly key?: CollectionKey
}
