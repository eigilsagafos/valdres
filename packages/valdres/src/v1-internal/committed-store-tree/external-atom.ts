import { StoreTreeCounterId } from "./counter-ids"
import {
    getExternalDomainRecords,
    type DefinitionDomain,
} from "./committed-store-tree"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import { ExternalProjectionPlane } from "./external-projection"
import type { ExternalOperationFailure } from "./external-types"
import {
    assertRuntimeDefinitionConstructionAllowed,
    isInternalRuntimeMismatch,
    SubscriberNotificationError,
    containThenable,
    inspectThenable,
    makeStateHandle,
    registerRuntimeStateHandle,
    rejectGuardedSelectorRead,
    runInRuntimeActivity,
    type AnyState,
    type ControlFaultSession,
    type ExternalAtomDefinition,
    type ExternalCallbackKind,
    type RuntimeDomainRecords,
    type SynchronousResult,
} from "./runtime-domain"
import type {
    ExternalAtom,
    ExternalAtomOptions,
    ExternalSource,
    State,
} from "./types"

/** @internal Installs the optional external capability for one runtime domain. */
export const createInternalExternalAtom = <Value>(
    domain: DefinitionDomain,
    ...args: [source: ExternalSource<Value>, options?: ExternalAtomOptions]
): ExternalAtom<Value> =>
    defineExternalAtom(getExternalDomainRecords(domain), args)

/** @internal Smaller deterministic work bounds for adversarial fixtures. */
export const configureInternalExternalBounds = (
    domain: DefinitionDomain,
    bounds: Partial<import("./external-types").ExternalBounds>,
): void => {
    const runtime = getExternalDomainRecords(domain).externalRuntime
    if (runtime === undefined)
        throw new TypeError(
            "Define an ExternalAtom before configuring its internal bounds",
        )
    for (const value of Object.values(bounds))
        if (!Number.isInteger(value) || value < 1)
            throw new TypeError(
                "External work bounds must be positive integers",
            )
    Object.assign(runtime.bounds, bounds)
}

/** Approved immutable synchronous snapshot failure. */
export class InvalidSynchronousExternalSnapshotError extends Error {
    readonly code = "VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT"
    constructor() {
        super("External source snapshots must be synchronous")
        this.name = "InvalidSynchronousExternalSnapshotError"
        Object.freeze(this)
    }
}

export class ServerSnapshotUnavailableError extends Error {
    readonly code = "VALDRES_SERVER_SNAPSHOT_UNAVAILABLE"
    readonly dependencyPath: readonly State<any>[]
    constructor(path: readonly State<any>[]) {
        super("An external source has no server snapshot")
        this.name = "ServerSnapshotUnavailableError"
        this.dependencyPath = Object.freeze([...path])
        Object.freeze(this)
    }
}

export class DormantExternalReadError extends Error {
    readonly code = "VALDRES_DORMANT_EXTERNAL_READ"
    constructor() {
        super("Subscriber callbacks cannot sample dormant external sources")
        this.name = "DormantExternalReadError"
        Object.freeze(this)
    }
}

export class InvalidExternalCleanupError extends Error {
    readonly code = "VALDRES_INVALID_EXTERNAL_CLEANUP"
    readonly phase: ExternalOperationFailure["phase"]
    readonly source: ExternalOperationFailure["source"]
    readonly committed: boolean
    constructor(
        metadata: Readonly<
            Pick<ExternalOperationFailure, "phase" | "source" | "committed">
        > = {
            phase: "admitting",
            source: "external-startup",
            committed: false,
        },
    ) {
        super(
            "External source subscribe must return a synchronous cleanup function",
        )
        this.name = "InvalidExternalCleanupError"
        this.phase = metadata.phase
        this.source = metadata.source
        this.committed = metadata.committed
        Object.freeze(this)
    }
}

export class ExternalSourceNonConvergenceError extends Error {
    readonly code = "VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE"
    readonly phase: ExternalOperationFailure["phase"]
    readonly source: ExternalOperationFailure["source"]
    readonly committed: boolean
    constructor(
        metadata: Readonly<
            Pick<ExternalOperationFailure, "phase" | "source" | "committed">
        > = { phase: "sampling", source: "external-drain", committed: true },
    ) {
        super(
            "External sources did not settle within the synchronous work bound",
        )
        this.name = "ExternalSourceNonConvergenceError"
        this.phase = metadata.phase
        this.source = metadata.source
        this.committed = metadata.committed
        Object.freeze(this)
    }
}

export class ExternalSourceDeliveryLimitError extends Error {
    readonly code = "VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT"
    readonly phase: ExternalOperationFailure["phase"]
    readonly source: ExternalOperationFailure["source"]
    readonly committed: boolean
    constructor(
        metadata: Readonly<
            Pick<ExternalOperationFailure, "phase" | "source" | "committed">
        > = {
            phase: "sampling",
            source: "external-invalidation",
            committed: false,
        },
    ) {
        super("External source delivery exceeded the synchronous work bound")
        this.name = "ExternalSourceDeliveryLimitError"
        this.phase = metadata.phase
        this.source = metadata.source
        this.committed = metadata.committed
        Object.freeze(this)
    }
}

/** Immutable, occurrence-ordered metadata for mixed source operation failures. */
export class ExternalSourceOperationError extends Error {
    readonly code = "VALDRES_EXTERNAL_SOURCE_OPERATION"
    readonly failures: readonly ExternalOperationFailure[]
    readonly causes: readonly unknown[]
    readonly cause: unknown
    readonly committed: boolean
    readonly phase: ExternalOperationFailure["phase"]
    readonly source: ExternalOperationFailure["source"]
    constructor(
        failures: readonly [
            ExternalOperationFailure,
            ...ExternalOperationFailure[],
        ],
    ) {
        if (failures.length === 0)
            throw new TypeError(
                "ExternalSourceOperationError requires at least one failure",
            )
        super("An external source operation failed")
        this.name = "ExternalSourceOperationError"
        this.failures = Object.freeze(
            failures.map(({ cause, committed, phase, source }) =>
                Object.freeze({ cause, committed, phase, source }),
            ),
        )
        this.causes = Object.freeze(failures.map(failure => failure.cause))
        this.cause = this.causes[0]
        this.committed = failures[0]!.committed
        this.phase = failures[0]!.phase
        this.source = failures[0]!.source
        Object.freeze(this)
    }
}

// An extent ends when its callback returns. Replaying its error later grants
// no provenance, and handled nonsticky guards remain handled.
const callbackOccurrences = new WeakMap<
    RuntimeDomainRecords,
    Map<unknown, object>
>()

/** Unlike a general guarded callback, source callbacks also close every
 * active selector's supplied read function for the callback's full extent. */
export function runExternalCallback<Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    kind: ExternalCallbackKind | "guarded-callback",
    callback: () => Result,
    generation?: object,
    onControl?: (origin: object) => void,
): Result {
    const previous = domain.activity
    const inherited = callbackOccurrences.get(domain)
    const occurrences =
        onControl === undefined ? inherited : new Map<unknown, object>()
    if (onControl !== undefined) callbackOccurrences.set(domain, occurrences!)
    const selectorActivity =
        previous?.kind === "selector"
            ? previous
            : previous !== undefined && "selectorActivity" in previous
              ? previous.selectorActivity
              : undefined
    const guards: {
        session: SelectorEvaluationSession<AnyState>
        previous: (() => never) | undefined
    }[] = []
    let active = selectorActivity
    while (active !== undefined) {
        const selectorSession =
            active.session as SelectorEvaluationSession<AnyState>
        guards.push({
            session: selectorSession,
            previous: selectorSession.setSuppliedReadGuard(() =>
                rejectGuardedSelectorRead(session, selectorSession),
            ),
        })
        active = active.parentSelectorActivity
    }
    try {
        return runInRuntimeActivity(
            domain,
            {
                kind,
                session,
                ...(selectorActivity === undefined ? {} : { selectorActivity }),
                ...(generation === undefined ? {} : { generation }),
            },
            () => {
                try {
                    return callback()
                } finally {
                    const fault = session.getControlFault()
                    if (fault.kind === "fault") throw fault.error
                }
            },
        )
    } catch (error) {
        const fault = session.getControlFault()
        const origin =
            fault.kind === "fault"
                ? (fault.origin ?? {})
                : occurrences?.get(error)
        if (origin !== undefined) {
            occurrences?.set(error, origin)
            onControl?.(origin)
        }
        throw error
    } finally {
        if (onControl !== undefined) {
            if (inherited === undefined) callbackOccurrences.delete(domain)
            else callbackOccurrences.set(domain, inherited)
        }
        for (let index = guards.length - 1; index >= 0; index--) {
            const guard = guards[index]!
            guard.session.setSuppliedReadGuard(guard.previous)
        }
    }
}

export function defineExternalAtom<Value>(
    domain: RuntimeDomainRecords,
    args: readonly [
        source: ExternalSource<Value>,
        options?: ExternalAtomOptions,
    ],
): ExternalAtom<Value> {
    assertRuntimeDefinitionConstructionAllowed(domain)
    const session = new SelectorEvaluationSession<AnyState>()
    const definition = runExternalCallback(
        domain,
        session,
        "guarded-callback",
        (): Omit<ExternalAtomDefinition, "sample"> => {
            if (args.length < 1 || args.length > 2)
                throw new TypeError(
                    "externalAtom requires a source and optional options",
                )
            const [source, options] = args
            if (
                typeof source !== "object" ||
                source === null ||
                Array.isArray(source)
            )
                throw new TypeError("externalAtom requires a source object")
            const getSnapshot = source.getSnapshot
            const getServerSnapshot = source.getServerSnapshot
            const subscribe = source.subscribe
            if (
                typeof getSnapshot !== "function" ||
                typeof subscribe !== "function" ||
                (getServerSnapshot !== undefined &&
                    typeof getServerSnapshot !== "function")
            )
                throw new TypeError("External source methods must be functions")
            let name: string | undefined
            if (options !== undefined) {
                if (
                    typeof options !== "object" ||
                    options === null ||
                    Array.isArray(options) ||
                    Reflect.ownKeys(options).some(key => key !== "name")
                )
                    throw new TypeError(
                        "ExternalAtom options support only name",
                    )
                name = options.name
                if (name !== undefined && typeof name !== "string")
                    throw new TypeError("ExternalAtom name must be a string")
            }
            return Object.freeze({
                source,
                getSnapshot,
                subscribe,
                ...(getServerSnapshot === undefined
                    ? {}
                    : { getServerSnapshot }),
                ...(name === undefined ? {} : { name }),
            })
        },
    )
    const handle = registerRuntimeStateHandle(
        domain,
        makeStateHandle("external"),
    ) as unknown as ExternalAtom<Value>
    const definitions = (domain.externalAtoms ??= new WeakMap())
    definitions.set(
        handle,
        Object.freeze({
            ...definition,
            sample: (
                session: ControlFaultSession,
                path?: readonly AnyState[],
                onThenable?: () => void,
            ) => sampleExternal(domain, definition, session, path, onThenable),
        }),
    )
    ensureExternalRuntime(domain)
    return handle
}

// Keep the domain's long-lived factory outside a definition's closure scope.
// Sharing that activation can retain its source even through an ephemeron map.
function ensureExternalRuntime(domain: RuntimeDomainRecords): void {
    if (domain.externalRuntime !== undefined) return
    const delivery = { depth: 0, work: 0 }
    const bounds = {
        rounds: 64,
        samples: 4096,
        deliveryDepth: 32,
        deliveryWork: 4096,
    }
    domain.externalRuntime ??= Object.freeze<
        import("./external-types").ExternalRuntime
    >({
        bounds,
        guard: error => {
            callbackOccurrences.get(domain)?.set(error, {})
        },
        createTree: (host: import("./external-types").ExternalTreeHost) =>
            new ExternalProjectionPlane(host, delivery, bounds),
        read: (draft, node, session, serverPath, count) => {
            const sample = () => {
                count?.(
                    serverPath === undefined
                        ? StoreTreeCounterId.liveSamples
                        : StoreTreeCounterId.serverSamples,
                    1,
                )
                const outcome = domain
                    .externalAtoms!.get(node)!
                    .sample(
                        session,
                        serverPath,
                        count === undefined
                            ? undefined
                            : () =>
                                  count(
                                      StoreTreeCounterId.thenableContainments,
                                      1,
                                  ),
                    )
                if (serverPath === undefined)
                    count?.(StoreTreeCounterId.transactionCaptures, 1)
                return outcome
            }
            if (serverPath !== undefined) return sample()
            const current = draft.externalCaptures?.get(node)
            if (current !== undefined) return current
            // A control fault escapes before a transaction capture is stored.
            const outcome = sample()
            let captures = draft.externalCaptures
            if (captures === undefined) {
                draft.onAllocation?.()
                captures = draft.externalCaptures = new Map()
            }
            captures.set(node, outcome)
            return outcome
        },
        fail: (
            failures: readonly ExternalOperationFailure[],
            preserveMetadata = false,
            internal: readonly boolean[] = [],
        ): never => {
            if (failures.length === 0)
                throw new TypeError(
                    "ExternalSourceOperationError requires at least one failure",
                )
            if (
                failures.length > 1 &&
                internal[0] &&
                isInternalRuntimeMismatch(failures[0]!.cause) &&
                failures.every(
                    failure => failure.source === "owned-mutation",
                ) &&
                failures
                    .slice(1)
                    .every(failure => failure.phase === "notifying")
            )
                throw new SubscriberNotificationError(
                    failures.map(failure => failure.cause),
                )
            if (failures.every(failure => failure.phase === "notifying"))
                throw new SubscriberNotificationError(
                    failures.map(failure => failure.cause),
                    failures[0]!
                        .source as SubscriberNotificationError["source"],
                )
            if (!preserveMetadata && failures.length === 1) {
                const failure = failures[0]!
                if (
                    (failure.phase !== "admitting" &&
                        failure.phase !== "cleanup") ||
                    internal[0]
                )
                    throw failure.cause
            }
            throw new ExternalSourceOperationError(
                failures as readonly [
                    ExternalOperationFailure,
                    ...ExternalOperationFailure[],
                ],
            )
        },
    })
}

export function sampleExternal(
    domain: RuntimeDomainRecords,
    definition: Omit<ExternalAtomDefinition, "sample">,
    session: ControlFaultSession,
    serverPath?: readonly State<any>[],
    onThenable?: () => void,
): SynchronousResult {
    const server = serverPath !== undefined
    const read = server ? definition.getServerSnapshot : definition.getSnapshot
    if (read === undefined) {
        const error = new ServerSnapshotUnavailableError(serverPath!)
        session.latchControlFault(error)
        throw error
    }
    return runExternalCallback(
        domain,
        session,
        server ? "external-server-snapshot" : "external-snapshot",
        () => {
            let value: unknown
            let threw = false
            try {
                value = Reflect.apply(read, definition.source, [])
            } catch (error) {
                value = error
                threw = true
            }
            const inspected = inspectThenable(value)
            if (inspected.kind === "inspection-error")
                return Object.freeze({ kind: "error", error: inspected.error })
            if (inspected.kind === "thenable") {
                onThenable?.()
                containThenable(inspected)
                return Object.freeze({
                    kind: "error",
                    error: new InvalidSynchronousExternalSnapshotError(),
                })
            }
            return threw
                ? Object.freeze({ kind: "error", error: value })
                : Object.freeze({ kind: "value", value })
        },
    )
}
