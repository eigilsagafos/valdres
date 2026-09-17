import { value, type ValueToken } from "./protocol"
import { selectorTokenObjectIs } from "./selector-oracle"
import {
    externalModelBounds,
    externalTransitions,
    externalWorkCounters,
    type ExternalAction,
    type ExternalCommand,
    type ExternalCommandResult,
    type ExternalFailure,
    type ExternalIdentitySpace,
    type ExternalLifecycle,
    type ExternalModelBounds,
    type ExternalNodeSpec,
    type ExternalOutcome,
    type ExternalPhase,
    type ExternalProtocolDriver,
    type ExternalSample,
    type ExternalSourceSpec,
    type ExternalTraceEvent,
    type ExternalWorkCounter,
} from "./external-protocol"

interface Source {
    readonly spec: ExternalSourceSpec
    snapshot: ExternalSample
    readonly listeners: Set<Generation>
}
interface Generation {
    readonly tree: Tree
    readonly projection: Projection
    readonly id: number
    live: boolean
}
interface Projection {
    readonly external: string
    readonly source: Source
    status: ExternalLifecycle
    outcome?: ExternalOutcome
    generation?: Generation
    nextGeneration: number
    retains: number
    retryRequired: boolean
}
interface RecordView {
    readonly outcome: ExternalOutcome
    readonly dependencies: ReadonlyMap<string, ExternalOutcome>
}
interface Scope {
    readonly id: string
    readonly parent?: Scope
    readonly atoms: Map<string, ValueToken>
    readonly selectors: Map<string, RecordView>
    disposed: boolean
}
interface Subscription {
    readonly id: string
    readonly tree: Tree
    readonly scope: Scope
    readonly node: string
    readonly callback: readonly ExternalAction[]
    observed: ExternalOutcome
    retained: Set<string>
    provisional: boolean
    admissionNotified: boolean
}
interface Tree {
    readonly id: string
    readonly root: Scope
    readonly scopes: Map<string, Scope>
    readonly projections: Map<string, Projection>
    readonly dirty: Set<Generation>
    readonly releases: Set<Projection>
    readonly subscriptions: Map<string, Subscription>
    readonly failures: ExternalFailure[]
    phase: ExternalPhase
    terminal: boolean
    committed: boolean
    sampled: Set<string>
}
interface ReadHost {
    readonly mode: "live" | "server" | "transaction"
    readonly sources: Map<string, ExternalOutcome>
    readonly selectors: Map<string, RecordView>
    readonly path: string[]
    readonly atoms?: Map<Scope, Map<string, ValueToken>>
    fatal?: ExternalOutcome
    publishControl?: boolean
}
type CallbackMode =
    | "sample"
    | "subscribe"
    | "cleanup"
    | "subscriber"
    | undefined
class Fault {
    constructor(
        readonly identity: string,
        readonly space: ExternalIdentitySpace = "control",
    ) {}
}
class RecordedFault extends Fault {
    constructor(readonly failures: readonly ExternalFailure[]) {
        super(failures[0]!.identity, failures[0]!.space)
    }
}
class CombinedFault {
    constructor(readonly failures: readonly unknown[]) {}
}
const val = (input: ValueToken): ExternalOutcome =>
    Object.freeze({ kind: "value", value: input })
const err = (identity: string, space: ExternalIdentitySpace): ExternalOutcome =>
    Object.freeze({ kind: "error", identity, space })
const control = (identity: string): ExternalOutcome =>
    Object.freeze({ kind: "control", identity, space: "control" })

export function sameExternalOutcome(
    a: ExternalOutcome,
    b: ExternalOutcome,
): boolean {
    return a.kind === "value" && b.kind === "value"
        ? selectorTokenObjectIs(a.value, b.value)
        : a.kind !== "value" &&
              b.kind !== "value" &&
              a.kind === b.kind &&
              a.space === b.space &&
              a.identity === b.identity
}

/**
 * Independent semantic oracle, intentionally unsuitable as a runtime kernel.
 * Symbolic definitions and strong maps permit exhaustive scans of materialized
 * records and subscription closures. There are no weak routes, reverse edges,
 * production evaluator imports, or production commit/transaction objects.
 *
 *   source scripts -> projection lifecycle -> recompute affected observations
 *                         |                         |
 *                   ordered dirty rounds       frozen callbacks
 *                         +-------------------------+
 *
 * Transaction/server hosts are observations only and never access projections.
 * Counters describe logical events, not the cost of this brute-force oracle.
 */
export class ExternalReferenceModel implements ExternalProtocolDriver {
    readonly trace: ExternalTraceEvent[] = []
    readonly work = Object.fromEntries(
        externalWorkCounters.map(key => [key, 0]),
    ) as Record<ExternalWorkCounter, number>
    readonly #sources = new Map<string, Source>()
    readonly #nodes = new Map<string, ExternalNodeSpec>()
    readonly #trees = new Map<string, Tree>()
    readonly #subscriptions = new Map<string, Subscription>()
    readonly #bounds: ExternalModelBounds
    #callback: CallbackMode
    #allowedGeneration: Generation | undefined
    #depth = 0
    #deliveryWork = 0
    #nextError = 1

    constructor(
        sources: readonly ExternalSourceSpec[],
        nodes: readonly ExternalNodeSpec[],
        bounds: ExternalModelBounds = externalModelBounds,
    ) {
        for (const bound of Object.values(bounds)) {
            if (!Number.isSafeInteger(bound) || bound < 1)
                throw new Error("Model bounds must be positive integers")
        }
        this.#bounds = Object.freeze({ ...bounds })
        for (const spec of sources) {
            this.#unique(this.#sources, spec.id)
            this.#sources.set(spec.id, {
                spec,
                snapshot: spec.snapshot,
                listeners: new Set(),
            })
        }
        for (const spec of nodes) {
            this.#unique(this.#nodes, spec.id)
            if (spec.kind === "external" && !this.#sources.has(spec.source))
                throw new Error("Unknown model source")
            this.#nodes.set(spec.id, spec)
        }
    }

    execute(command: ExternalCommand): ExternalCommandResult {
        const start = this.trace.length
        let outcome: ExternalOutcome | undefined
        let reads: ExternalOutcome[] | undefined
        try {
            switch (command.kind) {
                case "tree": {
                    this.#assertCommand()
                    this.#unique(this.#trees, command.tree)
                    this.#identifier(command.root)
                    const root: Scope = {
                        id: command.root,
                        atoms: new Map(),
                        selectors: new Map(),
                        disposed: false,
                    }
                    this.#trees.set(command.tree, {
                        id: command.tree,
                        root,
                        scopes: new Map([[root.id, root]]),
                        projections: new Map(),
                        dirty: new Set(),
                        releases: new Set(),
                        subscriptions: new Map(),
                        failures: [],
                        phase: "idle",
                        terminal: false,
                        committed: false,
                        sampled: new Set(),
                    })
                    break
                }
                case "scope": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const parent = this.#scope(tree, command.parent)
                    this.#unique(tree.scopes, command.scope)
                    tree.scopes.set(command.scope, {
                        id: command.scope,
                        parent,
                        atoms: new Map(),
                        selectors: new Map(),
                        disposed: false,
                    })
                    break
                }
                case "write":
                    this.#source(command.source).snapshot = command.snapshot
                    break
                case "emit":
                    this.#emit(this.#source(command.source))
                    break
                case "invalidate": {
                    const tree = this.#tree(command.tree)
                    const generation = tree.projections.get(
                        command.external,
                    )?.generation
                    if (generation?.id === command.generation)
                        this.#invalidate(generation)
                    break
                }
                case "unsubscribe":
                    this.#unsubscribe(command.subscription)
                    break
                case "read": {
                    const tree = this.#tree(command.tree)
                    const scope = this.#scope(tree, command.scope)
                    const host = this.#host("live")
                    if (this.#callback === "subscriber") {
                        outcome = this.#read(tree, scope, command.node, host)
                    } else {
                        this.#assertCommand()
                        this.#frame(tree, "reading", () => {
                            this.#refreshClosure(
                                tree,
                                scope,
                                command.node,
                                new Set(),
                                host,
                            )
                            this.#read(tree, scope, command.node, host)
                            if (host.fatal === undefined) this.#settle(tree)
                        })
                        // Final installed answer after drain, without another sample.
                        outcome =
                            host.fatal ??
                            this.#read(tree, scope, command.node, host, true)
                    }
                    this.trace.push({
                        kind: "read",
                        tree: tree.id,
                        scope: scope.id,
                        node: command.node,
                        outcome,
                        mode: "live",
                    })
                    break
                }
                case "hydrate": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const scope = this.#scope(tree, command.scope)
                    const host = this.#host("server")
                    outcome = this.#read(tree, scope, command.node, host)
                    outcome = host.fatal ?? outcome
                    this.trace.push({
                        kind: "read",
                        tree: tree.id,
                        scope: scope.id,
                        node: command.node,
                        outcome,
                        mode: "server",
                    })
                    break
                }
                case "subscribe": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const scope = this.#scope(tree, command.scope)
                    this.#unique(this.#subscriptions, command.subscription)
                    this.#frame(
                        tree,
                        "admitting",
                        () => {
                            const host = this.#host("live")
                            this.#refreshClosure(
                                tree,
                                scope,
                                command.node,
                                new Set(),
                                host,
                            )
                            const initial = this.#read(
                                tree,
                                scope,
                                command.node,
                                host,
                            )
                            if (initial.kind === "control")
                                throw new Fault(initial.identity, initial.space)
                            // The initial read settles before provisional admission.
                            this.#settle(tree)
                            const subscription: Subscription = {
                                id: command.subscription,
                                tree,
                                scope,
                                node: command.node,
                                callback: command.callback ?? [],
                                observed: initial,
                                retained: new Set(),
                                provisional: true,
                                admissionNotified: false,
                            }
                            tree.subscriptions.set(
                                subscription.id,
                                subscription,
                            )
                            this.#subscriptions.set(
                                subscription.id,
                                subscription,
                            )
                            try {
                                this.#reconcile(tree)
                                this.#settle(tree)
                            } catch (failure) {
                                this.#failure(tree, failure)
                                this.#remove(subscription)
                            }
                        },
                        () => {
                            // Any escaping frame failure leaves the caller without
                            // an unsubscribe handle, including a warm callback's
                            // failure during the admission frame's later drain.
                            const admitted = this.#subscriptions.get(
                                command.subscription,
                            )
                            if (admitted !== undefined) this.#remove(admitted)
                        },
                    )
                    const admitted = this.#subscriptions.get(
                        command.subscription,
                    )
                    if (admitted !== undefined) admitted.provisional = false
                    break
                }
                case "set": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const scope = this.#scope(tree, command.scope)
                    if (this.#node(command.atom).kind !== "atom")
                        throw new Fault("readonly")
                    this.#frame(tree, "settling", () => {
                        scope.atoms.set(command.atom, command.value)
                        tree.committed = true
                        this.#settle(tree)
                    })
                    break
                }
                case "dispose": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const scope = this.#scope(tree, command.scope, true)
                    this.#frame(tree, "cleanup", () =>
                        this.#dispose(tree, scope),
                    )
                    break
                }
                case "transaction": {
                    this.#assertCommand()
                    const tree = this.#tree(command.tree)
                    const sources = new Map<string, ExternalOutcome>()
                    const atoms = new Map<Scope, Map<string, ValueToken>>()
                    let host = this.#host("transaction", sources, atoms)
                    reads = []
                    const capturedReads = reads
                    this.#frame(tree, "reading", () => {
                        for (const step of command.steps) {
                            if (step.kind === "write")
                                this.#source(step.source).snapshot =
                                    step.snapshot
                            else if (step.kind === "set") {
                                if (this.#node(step.atom).kind !== "atom")
                                    throw new Fault("readonly")
                                const scope = this.#scope(tree, step.scope)
                                let local = atoms.get(scope)
                                if (local === undefined)
                                    atoms.set(scope, (local = new Map()))
                                local.set(step.atom, step.value)
                                host = this.#host("transaction", sources, atoms)
                            } else {
                                const scope = this.#scope(tree, step.scope)
                                const result = this.#read(
                                    tree,
                                    scope,
                                    step.node,
                                    host,
                                )
                                capturedReads.push(result)
                                this.trace.push({
                                    kind: "read",
                                    tree: tree.id,
                                    scope: scope.id,
                                    node: step.node,
                                    outcome: result,
                                    mode: "transaction",
                                })
                                // A caught control fault permits an explicit retry.
                                if (result.kind === "control")
                                    host = this.#host(
                                        "transaction",
                                        sources,
                                        atoms,
                                    )
                            }
                        }
                        for (const [scope, local] of atoms)
                            for (const [atom, next] of local)
                                scope.atoms.set(atom, next)
                        if (atoms.size > 0) {
                            tree.committed = true
                            this.#settle(tree)
                        }
                    })
                    break
                }
            }
        } catch (failure) {
            for (const thrown of this.#flattenFailures(failure)) {
                if (!(thrown instanceof RecordedFault)) {
                    const identity = this.#faultIdentity(thrown)
                    this.trace.push({
                        kind: "failure",
                        tree: "tree" in command ? command.tree : "hub",
                        failure: Object.freeze({
                            identity,
                            space: this.#faultSpace(thrown),
                            phase: "idle",
                            committed: false,
                        }),
                    })
                }
            }
        }
        const failures = this.trace
            .slice(start)
            .flatMap(event => (event.kind === "failure" ? [event.failure] : []))
        return Object.freeze({
            ...(outcome === undefined ? {} : { outcome }),
            ...(reads === undefined ? {} : { reads: Object.freeze(reads) }),
            failures: Object.freeze(failures),
        })
    }

    inspect(
        treeId: string,
        external: string,
    ):
        | Readonly<{
              status: ExternalLifecycle
              retains: number
              generation: number
              retryRequired: boolean
              outcome?: ExternalOutcome
          }>
        | undefined {
        const projection = this.#tree(treeId).projections.get(external)
        return projection === undefined
            ? undefined
            : Object.freeze({
                  status: projection.status,
                  retains: projection.retains,
                  generation: projection.generation?.id ?? 0,
                  retryRequired: projection.retryRequired,
                  ...(projection.outcome === undefined
                      ? {}
                      : { outcome: projection.outcome }),
              })
    }

    phase(treeId: string): ExternalPhase {
        return this.#tree(treeId).phase
    }
    clearTrace(): void {
        this.trace.length = 0
    }

    #host(
        mode: ReadHost["mode"],
        sources = new Map<string, ExternalOutcome>(),
        atoms?: ReadHost["atoms"],
    ): ReadHost {
        return {
            mode,
            sources,
            selectors: new Map(),
            path: [],
            ...(atoms === undefined ? {} : { atoms }),
        }
    }

    #read(
        tree: Tree,
        scope: Scope,
        nodeId: string,
        host: ReadHost,
        installed = false,
        checking = false,
    ): ExternalOutcome {
        if (host.fatal !== undefined) return host.fatal
        const node = this.#node(nodeId)
        if (node.kind === "atom") {
            for (
                let current: Scope | undefined = scope;
                current !== undefined;
                current = current.parent
            ) {
                const staged = host.atoms?.get(current)?.get(nodeId)
                if (staged !== undefined) return val(staged)
                const owned = current.atoms.get(nodeId)
                if (owned !== undefined) return val(owned)
            }
            return val(node.value)
        }
        if (node.kind === "external") {
            if (host.mode !== "live") {
                const cached = host.sources.get(nodeId)
                if (cached !== undefined) return cached
                const source = this.#source(node.source)
                let sampled: ExternalOutcome
                if (
                    host.mode === "server" &&
                    source.spec.serverSnapshot === undefined
                ) {
                    const path = Object.freeze([...host.path, nodeId])
                    this.trace.push({ kind: "missing-server", path })
                    sampled = control(`missing-server:${JSON.stringify(path)}`)
                    host.fatal = sampled
                } else sampled = this.#sample(tree, nodeId, source, host.mode)
                if (sampled.kind === "control") host.fatal = sampled
                else {
                    host.sources.set(nodeId, sampled)
                    if (host.mode === "transaction")
                        this.work.transactionCaptures++
                }
                return sampled
            }
            const existingProjection = tree.projections.get(nodeId)
            if (
                this.#callback === "subscriber" &&
                !host.publishControl &&
                !installed &&
                (existingProjection === undefined ||
                    existingProjection.status === "dormant")
            ) {
                host.fatal = control("dormant-read")
                return host.fatal
            }
            const projection =
                existingProjection ?? this.#projection(tree, nodeId)
            if (
                projection.status === "dormant" &&
                !installed &&
                (!checking || projection.outcome === undefined) &&
                !tree.sampled.has(nodeId)
            ) {
                tree.sampled.add(nodeId)
                const sample = this.#sample(
                    tree,
                    nodeId,
                    projection.source,
                    "live",
                )
                if (sample.kind === "control") {
                    host.fatal = sample
                    return sample
                }
                this.#publish(tree, projection, sample)
            }
            const current =
                projection.outcome ?? err("unread-projection", "model-error")
            if (current.kind === "control") host.fatal = current
            return current
        }
        const key = `${scope.id}\0${nodeId}`
        const records = host.mode === "live" ? scope.selectors : host.selectors
        const recordKey = host.mode === "live" ? nodeId : key
        const memo = records.get(recordKey)
        if (host.path.includes(nodeId)) return control("selector-cycle")
        // A newly chosen, already materialized selector can hide a dormant
        // external branch. Refresh that closure when reached by a getter, not
        // while the oracle checks old dependency outcomes for changes.
        if (
            memo !== undefined &&
            host.mode === "live" &&
            !checking &&
            !installed &&
            host.path.length > 0
        ) {
            this.#refreshClosure(tree, scope, nodeId, new Set(), host)
            if (host.fatal !== undefined && !host.publishControl)
                return host.fatal
        }
        if (memo !== undefined) {
            if (host.mode !== "live" || installed) return memo.outcome
            let changed = false
            for (const [dependency, before] of memo.dependencies) {
                const after = this.#read(
                    tree,
                    scope,
                    dependency,
                    host,
                    installed,
                    true,
                )
                if (host.fatal !== undefined) {
                    if (!host.publishControl) return host.fatal
                    changed = true
                    break
                }
                changed ||= !sameExternalOutcome(before, after)
            }
            if (!changed) return memo.outcome
        }
        this.work.selectorEvaluations++
        host.path.push(nodeId)
        const dependencies = new Map<string, ExternalOutcome>()
        const read = (dependency: string): ExternalOutcome => {
            const outcome = this.#read(tree, scope, dependency, host, installed)
            dependencies.set(dependency, outcome)
            return outcome
        }
        const expression = node.expression
        let outcome: ExternalOutcome
        switch (expression.kind) {
            case "constant":
                outcome = val(expression.value)
                break
            case "read":
                outcome = read(expression.node)
                break
            case "catch": {
                const attempt = read(expression.node)
                outcome =
                    attempt.kind === "value"
                        ? attempt
                        : val(expression.fallback)
                break
            }
            case "choose": {
                const condition = read(expression.condition)
                outcome =
                    condition.kind !== "value"
                        ? condition
                        : read(
                              this.#truthy(condition.value)
                                  ? expression.yes
                                  : expression.no,
                          )
                break
            }
            case "sum": {
                let total = 0
                outcome = val(value.number(0))
                for (const dependency of expression.nodes) {
                    const current = read(dependency)
                    if (current.kind !== "value") {
                        outcome = current
                        break
                    }
                    if (current.value.kind !== "number") {
                        outcome = err("expected-number", "model-error")
                        break
                    }
                    total += current.value.value
                    outcome = val(value.number(total))
                }
                break
            }
        }
        host.path.pop()
        if (host.fatal !== undefined) {
            if (!host.publishControl) return host.fatal
            outcome = host.fatal
        }
        if (outcome.kind === "control") {
            host.fatal = outcome
            if (!host.publishControl) return outcome
        }
        const baseline =
            memo ??
            (host.mode === "transaction"
                ? scope.selectors.get(nodeId)
                : undefined)
        if (
            node.equal === "always" &&
            baseline?.outcome.kind === "value" &&
            outcome.kind === "value"
        )
            outcome = baseline.outcome
        records.set(recordKey, { outcome, dependencies })
        return outcome
    }

    #refreshClosure(
        tree: Tree,
        scope: Scope,
        nodeId: string,
        seen: Set<string>,
        host: ReadHost,
    ): void {
        if (seen.has(nodeId)) return
        seen.add(nodeId)
        const node = this.#node(nodeId)
        if (node.kind === "external") {
            if (
                tree.projections.get(nodeId)?.status === "active" ||
                tree.sampled.has(nodeId)
            )
                return
            this.work.externalClosureVisits++
            this.#read(tree, scope, nodeId, host)
        } else if (node.kind === "selector") {
            const record = scope.selectors.get(nodeId)
            if (record !== undefined)
                for (const dependency of record.dependencies.keys())
                    this.#refreshClosure(tree, scope, dependency, seen, host)
        }
    }

    #closure(
        scope: Scope,
        nodeId: string,
        found = new Set<string>(),
        seen = new Set<string>(),
    ): Set<string> {
        if (seen.has(nodeId)) return found
        seen.add(nodeId)
        const node = this.#node(nodeId)
        if (node.kind === "external") found.add(nodeId)
        else if (node.kind === "selector") {
            for (const dependency of scope.selectors
                .get(nodeId)
                ?.dependencies.keys() ?? [])
                this.#closure(scope, dependency, found, seen)
        }
        return found
    }

    #settle(tree: Tree): void {
        const previousPhase = tree.phase
        tree.phase = "settling"
        // Full scans intentionally differ from production dependency routing.
        // Catch-up may discover another source. Releases stay deferred, so each
        // definition can attach at most once before this snapshot: the finite
        // definition inventory is a strict oracle bound on this loop.
        for (let pass = 0; pass <= this.#nodes.size; pass++) {
            for (const scope of tree.scopes.values()) {
                if (scope.disposed) continue
                for (const selector of [...scope.selectors.keys()]) {
                    const host = this.#host("live")
                    host.publishControl = true
                    this.#read(tree, scope, selector, host)
                }
            }
            const beforeAttach = this.work.projectionPublications
            this.#reconcile(tree)
            if (this.work.projectionPublications === beforeAttach) break
            if (pass === this.#nodes.size)
                throw new Error("Model lifecycle exceeded its definition bound")
        }
        const callbacks: {
            subscription: Subscription
            outcome: ExternalOutcome
        }[] = []
        for (const subscription of tree.subscriptions.values()) {
            const outcome = this.#read(
                tree,
                subscription.scope,
                subscription.node,
                this.#host("live"),
                true,
            )
            if (!sameExternalOutcome(subscription.observed, outcome)) {
                subscription.observed = outcome
                if (
                    !subscription.provisional ||
                    !subscription.admissionNotified
                )
                    callbacks.push({ subscription, outcome })
            }
        }
        if (callbacks.length > 0) this.work.notificationSnapshots++
        tree.phase = "notifying"
        // Capture both callback and target: unsubscribe cannot skip this snapshot.
        for (const { subscription, outcome } of callbacks) {
            this.work.subscriberCalls++
            subscription.admissionNotified = true
            this.trace.push({
                kind: "notify",
                subscription: subscription.id,
                outcome,
            })
            try {
                this.#withCallback("subscriber", undefined, () =>
                    this.#actions(subscription.callback),
                )
            } catch (failure) {
                this.#failure(tree, failure)
                if (subscription.provisional) this.#remove(subscription)
            }
        }
        this.#flushReleases(tree)
        tree.phase = previousPhase
    }

    #reconcile(tree: Tree): void {
        const releases: { subscription: Subscription; external: string }[] = []
        for (const subscription of [...tree.subscriptions.values()]) {
            const next = this.#closure(subscription.scope, subscription.node)
            for (const external of next) {
                if (subscription.retained.has(external)) continue
                this.work.lifecycleEdgeVisits++
                const projection = this.#projection(tree, external)
                projection.retains++
                tree.releases.delete(projection)
                subscription.retained.add(external)
                if (
                    projection.retains === 1 &&
                    projection.status === "dormant"
                ) {
                    try {
                        this.#attach(tree, projection)
                    } catch (failure) {
                        projection.retains--
                        subscription.retained.delete(external)
                        throw failure
                    }
                }
            }
            for (const external of subscription.retained)
                if (!next.has(external))
                    releases.push({ subscription, external })
        }
        for (const { subscription, external } of releases)
            this.#release(subscription, external)
    }

    #attach(tree: Tree, projection: Projection): void {
        const generation: Generation = {
            tree,
            projection,
            id: projection.nextGeneration++,
            live: true,
        }
        projection.generation = generation
        this.#transition(tree, projection, "attaching")
        this.work.adapterSubscriptions++
        let acquired = false
        try {
            this.#withCallback("subscribe", generation, () =>
                this.#actions(projection.source.spec.startup ?? []),
            )
            const result = projection.source.spec.cleanupResult ?? "valid"
            if (result !== "valid") {
                if (result === "thenable") this.work.thenableContainments++
                throw new Fault("invalid-cleanup")
            }
            acquired = true
            projection.source.listeners.add(generation)
            tree.dirty.delete(generation)
            const sampled = this.#sample(
                tree,
                projection.external,
                projection.source,
                "live",
            )
            if (sampled.kind === "control")
                throw new Fault(sampled.identity, sampled.space)
            this.#publish(tree, projection, sampled)
            this.#transition(tree, projection, "active")
        } catch (failure) {
            const before = tree.failures.length
            this.#failure(tree, failure, false)
            generation.live = false
            tree.dirty.delete(generation)
            projection.source.listeners.delete(generation)
            if (acquired) this.#cleanup(tree, projection)
            else this.#transition(tree, projection, "dormant")
            throw new RecordedFault(
                failure instanceof RecordedFault
                    ? [
                          ...failure.failures,
                          ...tree.failures
                              .slice(before)
                              .filter(item => !failure.failures.includes(item)),
                      ]
                    : tree.failures.slice(before),
            )
        }
    }

    #remove(subscription: Subscription): void {
        subscription.tree.subscriptions.delete(subscription.id)
        this.#subscriptions.delete(subscription.id)
        for (const external of [...subscription.retained])
            this.#release(subscription, external)
    }

    #release(subscription: Subscription, external: string): void {
        if (!subscription.retained.delete(external)) return
        this.work.lifecycleEdgeVisits++
        const projection = this.#projection(subscription.tree, external)
        projection.retains--
        if (projection.retains === 0) {
            if (subscription.tree.phase === "cleanup")
                this.#cleanup(subscription.tree, projection)
            else subscription.tree.releases.add(projection)
        }
    }

    #flushReleases(tree: Tree): void {
        for (const projection of tree.releases) {
            tree.releases.delete(projection)
            if (projection.retains === 0) this.#cleanup(tree, projection)
        }
    }

    #cleanup(tree: Tree, projection: Projection): void {
        const generation = projection.generation
        if (
            generation === undefined ||
            projection.status === "dormant" ||
            projection.status === "disposed"
        )
            return
        generation.live = false
        tree.dirty.delete(generation)
        projection.source.listeners.delete(generation)
        this.#transition(tree, projection, "detaching")
        const previousPhase = tree.phase
        tree.phase = "cleanup"
        this.work.adapterCleanups++
        try {
            this.#withCallback("cleanup", generation, () =>
                this.#actions(projection.source.spec.cleanup ?? []),
            )
            if (projection.source.spec.cleanupThenable) {
                this.work.thenableContainments++
                throw new Fault("invalid-cleanup")
            }
        } catch (failure) {
            this.#failure(tree, failure)
        } finally {
            this.#transition(
                tree,
                projection,
                tree.root.disposed ? "disposed" : "dormant",
            )
            tree.phase = previousPhase
        }
    }

    #unsubscribe(id: string): void {
        const subscription = this.#subscriptions.get(id)
        if (subscription === undefined) return
        if (this.#callback !== undefined && this.#callback !== "subscriber")
            throw new Fault("callback-capability")
        const tree = subscription.tree
        if (tree.phase === "idle")
            this.#frame(tree, "cleanup", () => this.#remove(subscription))
        else this.#remove(subscription)
    }

    #dispose(tree: Tree, scope: Scope): void {
        if (scope.disposed) return
        const children = [...tree.scopes.values()].filter(
            candidate => candidate.parent === scope,
        )
        scope.disposed = true
        for (const child of children) this.#dispose(tree, child)
        for (const subscription of [...tree.subscriptions.values()])
            if (subscription.scope === scope) this.#remove(subscription)
        scope.selectors.clear()
        scope.atoms.clear()
        if (scope === tree.root)
            for (const projection of tree.projections.values()) {
                if (projection.status !== "disposed")
                    this.#transition(tree, projection, "disposed")
            }
    }

    #emit(source: Source): void {
        const failures: unknown[] = []
        for (const generation of [...source.listeners]) {
            try {
                this.#invalidate(generation)
            } catch (failure) {
                failures.push(failure)
            }
        }
        if (failures.length === 1) throw failures[0]
        if (failures.length > 1) throw new CombinedFault(failures)
    }

    #invalidate(generation: Generation): void {
        if (!generation.live) return
        const { tree, projection } = generation
        if (
            this.#callback === "subscribe" &&
            this.#allowedGeneration === generation
        ) {
            tree.dirty.add(generation)
            return
        }
        if (
            this.#callback === "sample" ||
            this.#callback === "subscribe" ||
            this.#callback === "cleanup"
        )
            throw new Fault("callback-capability")
        if (tree.terminal) return
        if (tree.phase !== "idle") {
            tree.dirty.add(generation)
            return
        }
        if (this.#depth === 0) this.#deliveryWork = 0
        if (
            this.#depth >= this.#bounds.deliveryDepth ||
            this.#deliveryWork >= this.#bounds.deliveryWork
        ) {
            projection.retryRequired = true
            this.work.deliveryLimitHits++
            this.trace.push({
                kind: "retry-required",
                tree: tree.id,
                external: projection.external,
            })
            throw new Fault("delivery-limit")
        }
        this.#depth++
        this.#deliveryWork++
        this.work.deliveryEntries++
        projection.retryRequired = false
        try {
            tree.dirty.add(generation)
            this.#frame(tree, "sampling", () => {})
        } finally {
            this.#depth--
        }
    }

    #frame(
        tree: Tree,
        phase: ExternalPhase,
        operation: () => void,
        rollback?: () => void,
    ): void {
        if (tree.phase !== "idle") throw new Fault("active-tree")
        tree.phase = phase
        tree.sampled = new Set()
        tree.failures.length = 0
        tree.committed = false
        try {
            try {
                operation()
            } catch (failure) {
                this.#failure(tree, failure)
            }
            this.#flushReleases(tree)
            this.#drain(tree)
            if (tree.failures.length > 0 && rollback !== undefined) {
                rollback()
                this.#flushReleases(tree)
            }
        } finally {
            tree.phase = "idle"
            tree.terminal = false
            tree.sampled.clear()
        }
        if (tree.failures.length > 0)
            throw new RecordedFault([...tree.failures])
    }

    #drain(tree: Tree): void {
        let rounds = 0
        let samples = 0
        while (tree.dirty.size > 0) {
            if (
                rounds >= this.#bounds.rounds ||
                samples >= this.#bounds.samples
            ) {
                this.#exhaust(tree, [...tree.dirty])
                return
            }
            tree.phase = "draining"
            const batch = [...tree.dirty]
            tree.dirty.clear()
            rounds++
            this.work.dirtyRounds++
            this.trace.push({
                kind: "dirty-round",
                tree: tree.id,
                externals: Object.freeze(
                    batch.map(generation => generation.projection.external),
                ),
            })
            const outcomes: {
                projection: Projection
                outcome: ExternalOutcome
            }[] = []
            let cursor = 0
            for (; cursor < batch.length; cursor++) {
                const generation = batch[cursor]!
                if (
                    !generation.live ||
                    generation.projection.status !== "active"
                )
                    continue
                if (samples >= this.#bounds.samples) break
                samples++
                this.work.dirtySamples++
                const projection = generation.projection
                const outcome = this.#sample(
                    tree,
                    projection.external,
                    projection.source,
                    "live",
                )
                outcomes.push({ projection, outcome })
                if (outcome.kind === "control")
                    this.#failure(
                        tree,
                        new Fault(outcome.identity, outcome.space),
                        true,
                    )
            }
            for (const { projection, outcome } of outcomes)
                this.#publish(tree, projection, outcome)
            if (cursor < batch.length) {
                this.#exhaust(tree, [...batch.slice(cursor), ...tree.dirty])
                return
            }
            try {
                this.#settle(tree)
            } catch (failure) {
                this.#failure(tree, failure)
            }
        }
    }

    #exhaust(tree: Tree, pending: readonly Generation[]): void {
        tree.terminal = true
        tree.phase = "terminal"
        this.work.nonConvergenceTerminations++
        const outcome = err(
            `non-convergence:${this.#nextError++}`,
            "non-convergence",
        )
        for (const generation of new Set(pending))
            if (generation.live && generation.projection.status === "active")
                this.#publish(tree, generation.projection, outcome)
        tree.dirty.clear()
        this.#failure(
            tree,
            new Fault(
                outcome.kind === "value" ? "unreachable" : outcome.identity,
                "non-convergence",
            ),
            true,
        )
        try {
            this.#settle(tree)
        } catch (failure) {
            this.#failure(tree, failure)
        }
        tree.dirty.clear()
    }

    #sample(
        tree: Tree,
        external: string,
        source: Source,
        mode: ReadHost["mode"],
    ): ExternalOutcome {
        if (mode === "server") this.work.serverSamples++
        else this.work.liveSamples++
        let outcome: ExternalOutcome
        try {
            outcome = this.#withCallback("sample", undefined, () => {
                this.#actions(
                    (mode === "server"
                        ? source.spec.serverActions
                        : source.spec.sampleActions) ?? [],
                )
                const snapshot =
                    mode === "server"
                        ? source.spec.serverSnapshot!
                        : source.snapshot
                if (snapshot.kind === "value") return snapshot
                if (snapshot.kind !== "thenable")
                    return Object.freeze({
                        ...snapshot,
                        space: "source" as const,
                    })
                this.work.thenableContainments++
                return err(
                    `invalid-snapshot:${this.#nextError++}`,
                    "invalid-snapshot",
                )
            })
        } catch (failure) {
            outcome = err(
                this.#faultIdentity(failure),
                this.#faultSpace(failure),
            )
        }
        this.trace.push({
            kind: "sample",
            tree: tree.id,
            external,
            mode,
            outcome,
        })
        return outcome
    }

    #publish(
        tree: Tree,
        projection: Projection,
        outcome: ExternalOutcome,
    ): void {
        if (
            projection.outcome !== undefined &&
            sameExternalOutcome(projection.outcome, outcome)
        )
            return
        projection.outcome = outcome
        tree.committed = true
        this.work.projectionPublications++
        this.trace.push({
            kind: "publish",
            tree: tree.id,
            external: projection.external,
            outcome,
        })
    }

    #actions(actions: readonly ExternalAction[]): void {
        for (const action of actions) {
            switch (action.kind) {
                case "write":
                    this.#source(action.source).snapshot = action.snapshot
                    break
                case "emit":
                    this.#emit(this.#source(action.source))
                    break
                case "invalidate-self":
                    if (this.#allowedGeneration !== undefined)
                        this.#invalidate(this.#allowedGeneration)
                    break
                case "unsubscribe":
                    this.#unsubscribe(action.subscription)
                    break
                case "fail":
                    throw new Fault(action.identity, "source")
                case "read": {
                    if (this.#callback !== "subscriber")
                        throw new Fault("callback-capability")
                    const tree = this.#tree(action.tree)
                    const result = this.#read(
                        tree,
                        this.#scope(tree, action.scope),
                        action.node,
                        this.#host("live"),
                    )
                    if (result.kind !== "value")
                        throw new Fault(result.identity, result.space)
                    break
                }
            }
        }
    }

    #withCallback<Result>(
        mode: CallbackMode,
        generation: Generation | undefined,
        operation: () => Result,
    ): Result {
        const previous = this.#callback
        const previousGeneration = this.#allowedGeneration
        this.#callback = mode
        this.#allowedGeneration = generation
        try {
            return operation()
        } finally {
            this.#callback = previous
            this.#allowedGeneration = previousGeneration
        }
    }

    #failure(tree: Tree, thrown: unknown, committed = tree.committed): void {
        if (thrown instanceof CombinedFault) {
            for (const failure of thrown.failures)
                this.#failure(tree, failure, committed)
            return
        }
        if (thrown instanceof RecordedFault) {
            for (const failure of thrown.failures) {
                if (!tree.failures.includes(failure))
                    tree.failures.push(failure)
            }
            return
        }
        const failure = Object.freeze({
            identity: this.#faultIdentity(thrown),
            space: this.#faultSpace(thrown),
            phase: tree.phase,
            committed,
        })
        tree.failures.push(failure)
        this.trace.push({ kind: "failure", tree: tree.id, failure })
    }
    #faultIdentity(thrown: unknown): string {
        if (thrown instanceof CombinedFault)
            return this.#faultIdentity(thrown.failures[0])
        return thrown instanceof Fault
            ? thrown.identity
            : `model-error:${String(thrown)}`
    }
    #faultSpace(thrown: unknown): ExternalIdentitySpace {
        if (thrown instanceof CombinedFault)
            return this.#faultSpace(thrown.failures[0])
        return thrown instanceof Fault ? thrown.space : "model-error"
    }
    #flattenFailures(thrown: unknown): unknown[] {
        return thrown instanceof CombinedFault
            ? thrown.failures.flatMap(item => this.#flattenFailures(item))
            : [thrown]
    }
    #assertCommand(): void {
        if (this.#callback !== undefined) throw new Fault("callback-capability")
    }
    #projection(tree: Tree, external: string): Projection {
        let projection = tree.projections.get(external)
        if (projection !== undefined) return projection
        const node = this.#node(external)
        if (node.kind !== "external")
            throw new Error("Expected external definition")
        projection = {
            external,
            source: this.#source(node.source),
            status: "dormant",
            nextGeneration: 1,
            retains: 0,
            retryRequired: false,
        }
        tree.projections.set(external, projection)
        return projection
    }
    #transition(
        tree: Tree,
        projection: Projection,
        to: ExternalLifecycle,
    ): void {
        const from = projection.status
        if (
            !(
                externalTransitions[from] as readonly ExternalLifecycle[]
            ).includes(to)
        )
            throw new Error(`Illegal model transition ${from} -> ${to}`)
        projection.status = to
        this.trace.push({
            kind: "transition",
            tree: tree.id,
            external: projection.external,
            from,
            to,
            generation: projection.generation?.id ?? 0,
        })
    }
    #tree(id: string): Tree {
        const tree = this.#trees.get(id)
        if (tree === undefined) throw new Fault("missing-tree")
        return tree
    }
    #scope(tree: Tree, id: string, allowDisposed = false): Scope {
        const scope = tree.scopes.get(id)
        if (scope === undefined) throw new Fault("missing-scope")
        if (!allowDisposed && scope.disposed) throw new Fault("disposed")
        return scope
    }
    #node(id: string): ExternalNodeSpec {
        const node = this.#nodes.get(id)
        if (node === undefined) throw new Fault("missing-node")
        return node
    }
    #source(id: string): Source {
        const source = this.#sources.get(id)
        if (source === undefined) throw new Fault("missing-source")
        return source
    }
    #identifier(id: string): void {
        if (id.length === 0 || id.includes("\0"))
            throw new Error("Invalid model identity")
    }
    #unique(map: ReadonlyMap<string, unknown>, id: string): void {
        this.#identifier(id)
        if (map.has(id)) throw new Error(`Duplicate model identity: ${id}`)
    }
    #truthy(token: ValueToken): boolean {
        if (token.kind === "undefined" || token.kind === "null") return false
        if (token.kind === "identity") return true
        return Boolean(token.value)
    }
}
