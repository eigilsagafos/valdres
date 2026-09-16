import { SelectorEvaluationSession } from "../selector-evaluator/types"
import { ExternalProjectionPlane } from "./external-projection"
import type { ExternalOperationFailure } from "./external-types"
import {
    assertRuntimeDefinitionConstructionAllowed,
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

/** Internal names and fields remain provisional until Gate 0 approval. */
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

/** Proposed operation ledger; remains unexported from the public facade. */
export class ExternalSourceOperationError extends Error {
    readonly code = "VALDRES_EXTERNAL_SOURCE_OPERATION"
    readonly failures: readonly ExternalOperationFailure[]
    readonly causes: readonly unknown[]
    readonly cause: unknown
    readonly committed: boolean
    readonly phase: ExternalOperationFailure["phase"]
    readonly source: ExternalOperationFailure["source"]
    constructor(failures: readonly ExternalOperationFailure[]) {
        super("An external source operation failed")
        this.name = "ExternalSourceOperationError"
        this.failures = Object.freeze(
            failures.map(failure => Object.freeze({ ...failure })),
        )
        this.causes = Object.freeze(failures.map(failure => failure.cause))
        this.cause = this.causes[0]
        this.committed = failures[0]!.committed
        this.phase = failures[0]!.phase
        this.source = failures[0]!.source
        Object.freeze(this)
    }
}

/** Unlike a general guarded callback, source callbacks also close every
 * active selector's supplied read function for the callback's full extent. */
export function runExternalCallback<Result>(
    domain: RuntimeDomainRecords,
    session: ControlFaultSession,
    kind: ExternalCallbackKind | "guarded-callback",
    callback: () => Result,
    generation?: object,
): Result {
    const previous = domain.activity
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
    } finally {
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
    domain.externalRuntime ??= Object.freeze({
        createTree: (
            bindings: import("./external-types").ExternalTreeBindings,
        ) => new ExternalProjectionPlane(bindings),
        fail: (failures: readonly ExternalOperationFailure[]): never => {
            const seen = new Set<unknown>()
            const distinct = failures.filter(failure => {
                if (failure.phase === "notifying") return true
                if (seen.has(failure.cause)) return false
                seen.add(failure.cause)
                return true
            })
            if (distinct.length === 1 && distinct[0]!.phase !== "notifying")
                throw distinct[0]!.cause
            throw new ExternalSourceOperationError(distinct)
        },
    })
    return handle
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
