import type { ValueToken } from "./protocol"

/** Test-only symbolic vocabulary. No spelling below approves a public error. */
export type ExternalIdentitySpace =
    | "source"
    | "invalid-snapshot"
    | "non-convergence"
    | "control"
    | "model-error"

export type ExternalOutcome =
    | Readonly<{ kind: "value"; value: ValueToken }>
    | Readonly<{
          kind: "error" | "control"
          identity: string
          space: ExternalIdentitySpace
      }>

export type ExternalSample =
    | Readonly<{ kind: "value"; value: ValueToken }>
    | Readonly<{ kind: "error" | "control"; identity: string }>
    | Readonly<{ kind: "thenable"; identity: string; thrown?: boolean }>

export type ExternalExpression =
    | Readonly<{ kind: "read"; node: string }>
    | Readonly<{ kind: "constant"; value: ValueToken }>
    | Readonly<{ kind: "sum"; nodes: readonly string[] }>
    | Readonly<{
          kind: "choose"
          condition: string
          yes: string
          no: string
      }>
    | Readonly<{ kind: "catch"; node: string; fallback: ValueToken }>

export type ExternalAction =
    | Readonly<{ kind: "write"; source: string; snapshot: ExternalSample }>
    | Readonly<{ kind: "emit"; source: string }>
    | Readonly<{ kind: "invalidate-self" }>
    | Readonly<{ kind: "unsubscribe"; subscription: string }>
    | Readonly<{ kind: "read"; tree: string; scope: string; node: string }>
    | Readonly<{ kind: "fail"; identity: string }>

export interface ExternalSourceSpec {
    readonly id: string
    readonly snapshot: ExternalSample
    readonly serverSnapshot?: ExternalSample
    readonly sampleActions?: readonly ExternalAction[]
    readonly serverActions?: readonly ExternalAction[]
    readonly startup?: readonly ExternalAction[]
    readonly cleanup?: readonly ExternalAction[]
    readonly cleanupResult?: "valid" | "invalid" | "thenable"
    readonly cleanupThenable?: boolean
}

export type ExternalNodeSpec =
    | Readonly<{ kind: "external"; id: string; source: string }>
    | Readonly<{ kind: "atom"; id: string; value: ValueToken }>
    | Readonly<{
          kind: "selector"
          id: string
          expression: ExternalExpression
          equal?: "always"
      }>

export interface ExternalModelBounds {
    readonly rounds: number
    readonly samples: number
    readonly deliveryDepth: number
    readonly deliveryWork: number
}

/** Internal engineering defaults, not public timing guarantees. */
export const externalModelBounds: ExternalModelBounds = Object.freeze({
    rounds: 64,
    samples: 4_096,
    deliveryDepth: 32,
    deliveryWork: 4_096,
})

export type ExternalPhase =
    | "idle"
    | "reading"
    | "admitting"
    | "sampling"
    | "settling"
    | "notifying"
    | "cleanup"
    | "draining"
    | "terminal"

export type ExternalLifecycle =
    | "dormant"
    | "attaching"
    | "active"
    | "detaching"
    | "disposed"

export const externalTransitions = Object.freeze({
    dormant: Object.freeze(["attaching", "disposed"] as const),
    attaching: Object.freeze([
        "active",
        "detaching",
        "dormant",
        "disposed",
    ] as const),
    active: Object.freeze(["detaching"] as const),
    detaching: Object.freeze(["dormant", "disposed"] as const),
    disposed: Object.freeze([] as const),
}) satisfies Readonly<Record<ExternalLifecycle, readonly ExternalLifecycle[]>>

export const externalWorkCounters = Object.freeze([
    "liveSamples",
    "serverSamples",
    "transactionCaptures",
    "selectorEvaluations",
    "externalClosureVisits",
    "lifecycleEdgeVisits",
    "projectionPublications",
    "adapterSubscriptions",
    "adapterCleanups",
    "dirtyRounds",
    "dirtySamples",
    "notificationSnapshots",
    "subscriberCalls",
    "thenableContainments",
    "deliveryEntries",
    "deliveryLimitHits",
    "nonConvergenceTerminations",
] as const)

export type ExternalWorkCounter = (typeof externalWorkCounters)[number]

export interface ExternalFailure {
    readonly identity: string
    readonly space: ExternalIdentitySpace
    readonly phase: ExternalPhase
    readonly committed: boolean
}

export type ExternalTraceEvent =
    | Readonly<{
          kind: "sample"
          tree: string
          external: string
          mode: "live" | "server" | "transaction"
          outcome: ExternalOutcome
      }>
    | Readonly<{
          kind: "transition"
          tree: string
          external: string
          from: ExternalLifecycle
          to: ExternalLifecycle
          generation: number
      }>
    | Readonly<{
          kind: "publish"
          tree: string
          external: string
          outcome: ExternalOutcome
      }>
    | Readonly<{
          kind: "read"
          tree: string
          scope: string
          node: string
          outcome: ExternalOutcome
          mode: "live" | "server" | "transaction"
      }>
    | Readonly<{
          kind: "notify"
          subscription: string
          outcome: ExternalOutcome
      }>
    | Readonly<{
          kind: "dirty-round"
          tree: string
          externals: readonly string[]
      }>
    | Readonly<{ kind: "failure"; tree: string; failure: ExternalFailure }>
    | Readonly<{ kind: "missing-server"; path: readonly string[] }>
    | Readonly<{ kind: "retry-required"; tree: string; external: string }>

export type ExternalTransactionStep =
    | Readonly<{ kind: "read"; scope: string; node: string }>
    | Readonly<{ kind: "set"; scope: string; atom: string; value: ValueToken }>
    | Readonly<{ kind: "write"; source: string; snapshot: ExternalSample }>

export type ExternalCommand =
    | Readonly<{ kind: "tree"; tree: string; root: string }>
    | Readonly<{ kind: "scope"; tree: string; scope: string; parent: string }>
    | Readonly<{ kind: "read"; tree: string; scope: string; node: string }>
    | Readonly<{ kind: "hydrate"; tree: string; scope: string; node: string }>
    | Readonly<{
          kind: "subscribe"
          tree: string
          scope: string
          node: string
          subscription: string
          callback?: readonly ExternalAction[]
      }>
    | Readonly<{ kind: "unsubscribe"; subscription: string }>
    | Readonly<{ kind: "dispose"; tree: string; scope: string }>
    | Readonly<{
          kind: "set"
          tree: string
          scope: string
          atom: string
          value: ValueToken
      }>
    | Readonly<{ kind: "write"; source: string; snapshot: ExternalSample }>
    | Readonly<{ kind: "emit"; source: string }>
    | Readonly<{
          kind: "invalidate"
          tree: string
          external: string
          generation: number
      }>
    | Readonly<{
          kind: "transaction"
          tree: string
          steps: readonly ExternalTransactionStep[]
      }>

export interface ExternalCommandResult {
    readonly outcome?: ExternalOutcome
    readonly reads?: readonly ExternalOutcome[]
    readonly failures: readonly ExternalFailure[]
}

/** E1/E3 drivers implement this seam without importing the reference model. */
export interface ExternalProtocolDriver {
    execute(command: ExternalCommand): ExternalCommandResult
    readonly trace: readonly ExternalTraceEvent[]
}
