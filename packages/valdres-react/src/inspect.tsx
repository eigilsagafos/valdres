import {
    createContext,
    Profiler,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useSyncExternalStore,
    type ProfilerOnRenderCallback,
    type ReactElement,
    type ReactNode,
} from "react"
import type { Atom, AtomUpdater, State, Store } from "valdres"
import {
    assertStore,
    read,
    readHydrationSnapshot,
    subscribe,
} from "valdres/adapter-internals/v1"
import type {
    InspectableStoreResult,
    InspectionCapture,
    InspectionExport,
    StateInspectionCapture,
} from "valdres/inspect"
import { Provider as RootProvider } from "./Provider"
import { StoreContext } from "./lib/StoreContext"
import { useResetAtom as useRootResetAtom } from "./useResetAtom"
import { useSetAtom as useRootSetAtom } from "./useSetAtom"
import { useUpdateAtom as useRootUpdateAtom } from "./useUpdateAtom"

export interface InspectableReactOptions {
    readonly capacity?: Readonly<{
        /** Retained React Profiler boundary summaries. Default: 2,048. */
        summaries?: number
        /** Retained subscriber and snapshot timeline details. Default: 100,000. */
        details?: number
    }>
}

export interface InspectableReactProviderProps {
    /** Defaults to the root Store supplied to createInspectableReact. */
    readonly store?: Store
    readonly children?: ReactNode
}

export interface ReactInspectionFault {
    readonly type: "recorder-fault"
    readonly phase: string
    readonly sequence: number
}

export interface ReactInspectionRetainedBounds {
    readonly firstSequence: number
    readonly lastSequence: number
}

export interface ReactInspectionOverflow {
    readonly summaries: number
    readonly details: number
    readonly retained: Readonly<{
        readonly summaries?: ReactInspectionRetainedBounds
        readonly details?: ReactInspectionRetainedBounds
    }>
}

export interface ReactInspectionTotals {
    /**
     * Adjacent Profiler callbacks grouped by React's shared commitTime value.
     * Reduced timer precision can coalesce separate commits into one group.
     */
    readonly commitTimeGroups: number
    /** Exact Profiler boundary callback count, independent of ring overflow. */
    readonly profilerCallbacks: number
    readonly subscriberCallbacks: number
    readonly snapshots: number
    readonly clientSnapshots: number
    readonly clientSnapshotsDuringSubscriberCallbacks: number
    readonly serverSnapshots: number
    readonly thrownSubscriberCallbacks: number
    readonly thrownSnapshots: number
}

/** One React Profiler boundary callback, not a unique React commit. */
export interface ReactProfilerInspection {
    readonly type: "react-profiler"
    readonly sequence: number
    /**
     * Groups adjacent callbacks with equal React commitTime values. This is
     * not a unique commit identity when the host clock has reduced precision.
     */
    readonly commitTimeGroupId: number
    readonly providerId: number
    readonly phase: "mount" | "update" | "nested-update"
    /** Value-free Store correlation captured inside the Profiler callback. */
    readonly capture: InspectionCapture
    readonly renderStartUs: number
    readonly commitTimeUs: number
    readonly actualDurationUs: number
    readonly baseDurationUs: number
}

interface ReactInspectionDetailCommon {
    readonly sequence: number
    readonly providerId: number
    readonly start: StateInspectionCapture
    readonly end?: StateInspectionCapture
    readonly durationUs: number
    readonly result: "returned" | "threw"
}

export interface ReactSubscriberInspectionDetail
    extends ReactInspectionDetailCommon {
    readonly type: "react-subscriber"
}

export interface ReactClientSnapshotInspectionDetail
    extends ReactInspectionDetailCommon {
    readonly type: "react-snapshot"
    readonly snapshot: "client"
    /** True only for a read made on the subscriber callback's call stack. */
    readonly duringSubscriberCallback: boolean
}

export interface ReactServerSnapshotInspectionDetail
    extends ReactInspectionDetailCommon {
    readonly type: "react-snapshot"
    readonly snapshot: "server"
    /** Server hydration readers preserve the first outcome across calls. */
    readonly cached: boolean
}

export type ReactSnapshotInspectionDetail =
    | ReactClientSnapshotInspectionDetail
    | ReactServerSnapshotInspectionDetail

export type ReactInspectionDetail =
    | ReactSubscriberInspectionDetail
    | ReactSnapshotInspectionDetail

export interface ReactInspectionRecording {
    readonly recordingId: string
    readonly coreRecordingId: string
    readonly profiler: Readonly<{
        /** Whether this recording has observed a Profiler callback. */
        readonly commitCallbacksObserved: boolean
    }>
    readonly summaries: readonly ReactProfilerInspection[]
    readonly details: readonly ReactInspectionDetail[]
    readonly totals: ReactInspectionTotals
    readonly complete: boolean
    readonly overflow: ReactInspectionOverflow
    readonly fault?: ReactInspectionFault
}

export interface InspectableReactExport {
    readonly schema: "valdres.react.inspect"
    readonly schemaVersion: 1
    /** The unmodified result of the bound StoreInspector export. */
    readonly core: InspectionExport
    readonly react: ReactInspectionRecording
    readonly complete: boolean
}

export interface InspectableReactInspector {
    readonly recordingId: string
    export(): InspectableReactExport
    reset(): void
}

export interface InspectableReactResult {
    readonly Provider: (props: InspectableReactProviderProps) => ReactElement
    readonly useValue: <Value>(state: State<Value>, store?: Store) => Value
    readonly useAtom: <Value>(
        atom: Atom<Value>,
        store?: Store,
    ) => readonly [Value, (value: Value) => void]
    readonly useStore: () => Store
    readonly useSetAtom: <Value>(
        atom: Atom<Value>,
        store?: Store,
    ) => (value: Value) => void
    readonly useUpdateAtom: <Value>(
        atom: Atom<Value>,
        store?: Store,
    ) => (update: AtomUpdater<Value>) => void
    readonly useResetAtom: <Value>(
        atom: Atom<Value>,
        store?: Store,
    ) => () => void
    readonly inspect: InspectableReactInspector
}

interface HydrationOutcome<Value> {
    readonly didThrow: boolean
    readonly result: Value | unknown
}

interface ProviderController {
    readonly key: object
}

interface ProviderRecording {
    readonly id: number
    subscriberDepth: number
}

interface OperationFrame {
    readonly generation: number
    readonly providerId: number
    readonly provider: ProviderRecording
    readonly start: StateInspectionCapture
}

type SnapshotKind = "client" | "server"

type MutableTotals = {
    -readonly [Key in keyof ReactInspectionTotals]: ReactInspectionTotals[Key]
}

const DEFAULT_SUMMARY_CAPACITY = 2_048
const DEFAULT_DETAIL_CAPACITY = 100_000

let nextReactRecordingId = 1

class BoundedRing<Value> {
    readonly #capacity: number
    readonly #items: Value[] = []
    #start = 0

    constructor(capacity: number) {
        this.#capacity = capacity
    }

    add(value: Value): boolean {
        if (this.#capacity === 0) return true
        if (this.#items.length < this.#capacity) {
            this.#items.push(value)
            return false
        }
        this.#items[this.#start] = value
        this.#start = (this.#start + 1) % this.#capacity
        return true
    }

    snapshot(): readonly Value[] {
        if (this.#items.length < this.#capacity || this.#start === 0) {
            return Object.freeze([...this.#items])
        }
        return Object.freeze([
            ...this.#items.slice(this.#start),
            ...this.#items.slice(0, this.#start),
        ])
    }
}

const readCapacity = (
    value: number | undefined,
    fallback: number,
    label: string,
    allowZero: boolean,
): number => {
    const capacity = value ?? fallback
    if (!Number.isSafeInteger(capacity) || capacity < (allowZero ? 0 : 1)) {
        throw new TypeError(
            `${label} capacity must be ${allowZero ? "a non-negative" : "a positive"} safe integer`,
        )
    }
    return capacity
}

const captureDurationUs = (
    start: StateInspectionCapture,
    end: StateInspectionCapture | undefined,
): number =>
    end === undefined
        ? 0
        : Math.max(
              0,
              Math.round((end.monotonicTimeMs - start.monotonicTimeMs) * 1_000),
          )

const retainedBounds = <Value extends { readonly sequence: number }>(
    records: readonly Value[],
): ReactInspectionRetainedBounds | undefined => {
    if (records.length === 0) return undefined
    let firstSequence = Number.POSITIVE_INFINITY
    let lastSequence = 0
    for (const record of records) {
        firstSequence = Math.min(firstSequence, record.sequence)
        lastSequence = Math.max(lastSequence, record.sequence)
    }
    return Object.freeze({ firstSequence, lastSequence })
}

class ReactInspectionRecorder {
    readonly #core: InspectableStoreResult
    readonly #summaryCapacity: number
    readonly #detailCapacity: number
    #summaryRing: BoundedRing<ReactProfilerInspection>
    #detailRing: BoundedRing<ReactInspectionDetail>
    #recordingId = ""
    #coreRecordingId = ""
    #generation = 0
    #nextSequence = 1
    #nextProviderId = 1
    #nextCommitTimeGroupId = 1
    #lastCommitTimeMs: number | undefined
    #lastCommitTimeGroupId: number | undefined
    #lastCommitTimeGroupUs: number | undefined
    #providerRecordings = new WeakMap<object, ProviderRecording>()
    #validatedStores = new WeakSet<object>()
    #profilerCallbacksObserved = false
    #summaryOverflow = 0
    #detailOverflow = 0
    #totals: MutableTotals
    #fault: ReactInspectionFault | undefined

    constructor(
        core: InspectableStoreResult,
        options: InspectableReactOptions,
    ) {
        this.#core = core
        this.#summaryCapacity = readCapacity(
            options.capacity?.summaries,
            DEFAULT_SUMMARY_CAPACITY,
            "React inspection summary",
            false,
        )
        this.#detailCapacity = readCapacity(
            options.capacity?.details,
            DEFAULT_DETAIL_CAPACITY,
            "React inspection detail",
            true,
        )
        this.#summaryRing = new BoundedRing(this.#summaryCapacity)
        this.#detailRing = new BoundedRing(this.#detailCapacity)
        this.#totals = this.#emptyTotals()

        assertStore(core.store)
        const initial = core.inspect.capture(core.store)
        this.#startRecording(initial.recordingId)
        this.#validatedStores.add(core.store as object)
    }

    get recordingId(): string {
        this.#synchronize(this.#core.inspect.recordingId)
        return this.#recordingId
    }

    validateStore(store: Store): void {
        assertStore(store)
        this.#synchronize(this.#core.inspect.recordingId)
        const target = store as object
        if (this.#validatedStores.has(target)) return
        const capture = this.#core.inspect.capture(store)
        this.#synchronize(capture.recordingId)
        this.#validatedStores.add(target)
    }

    runSubscriber<Value, Result>(
        controller: ProviderController,
        store: Store,
        state: State<Value>,
        operation: () => Result,
    ): Result {
        const frame = this.#beginOperation(
            "react-subscriber-start",
            controller,
            store,
            state,
        )
        if (this.#fault === undefined) this.#totals.subscriberCallbacks++
        if (frame !== undefined) frame.provider.subscriberDepth++

        let result: "returned" | "threw" = "threw"
        try {
            const value = operation()
            result = "returned"
            return value
        } finally {
            if (frame !== undefined) frame.provider.subscriberDepth--
            if (result === "threw" && this.#fault === undefined) {
                this.#totals.thrownSubscriberCallbacks++
            }
            this.#finishDetail(
                "react-subscriber-finish",
                frame,
                store,
                state,
                result,
                undefined,
                false,
                false,
            )
        }
    }

    runSnapshot<Value>(
        controller: ProviderController,
        store: Store,
        state: State<Value>,
        snapshot: SnapshotKind,
        cached: boolean,
        operation: () => Value,
    ): Value {
        const frame = this.#beginOperation(
            "react-snapshot-start",
            controller,
            store,
            state,
        )
        const duringSubscriberCallback =
            snapshot === "client" &&
            frame !== undefined &&
            frame.provider.subscriberDepth > 0
        if (this.#fault === undefined) {
            this.#totals.snapshots++
            if (snapshot === "client") {
                this.#totals.clientSnapshots++
                if (duringSubscriberCallback) {
                    this.#totals.clientSnapshotsDuringSubscriberCallbacks++
                }
            } else this.#totals.serverSnapshots++
        }

        let result: "returned" | "threw" = "threw"
        try {
            const value = operation()
            result = "returned"
            return value
        } finally {
            if (result === "threw" && this.#fault === undefined) {
                this.#totals.thrownSnapshots++
            }
            this.#finishDetail(
                "react-snapshot-finish",
                frame,
                store,
                state,
                result,
                snapshot,
                cached,
                duringSubscriberCallback,
            )
        }
    }

    recordProfiler(
        controller: ProviderController,
        store: Store,
        phase: "mount" | "update" | "nested-update",
        actualDuration: number,
        baseDuration: number,
        startTime: number,
        commitTime: number,
    ): void {
        try {
            this.#profilerCallbacksObserved = true
            if (this.#fault !== undefined) return
            const capture = this.#capture(store)
            if (capture === undefined || this.#fault !== undefined) return
            const provider = this.#provider(controller)
            if (provider === undefined) return
            const sequence = this.#allocateSequence("react-profiler")
            if (sequence === undefined) return
            const timingOffsetUs =
                capture.timeUs - Math.round(capture.monotonicTimeMs * 1_000)
            const alignedCommitTimeUs = this.#alignedTimeUs(
                commitTime,
                timingOffsetUs,
                "react-profiler-commit-time",
            )
            const commitTimeGroup = this.#commitTimeGroup(
                commitTime,
                alignedCommitTimeUs,
                "react-profiler-time-group",
            )
            if (commitTimeGroup === undefined) return
            const summary = Object.freeze({
                type: "react-profiler" as const,
                sequence,
                commitTimeGroupId: commitTimeGroup.id,
                providerId: provider.id,
                phase,
                capture,
                renderStartUs: this.#alignedTimeUs(
                    startTime,
                    timingOffsetUs,
                    "react-profiler-start-time",
                ),
                commitTimeUs: commitTimeGroup.timeUs,
                actualDurationUs: this.#durationUs(
                    actualDuration,
                    "react-profiler-actual-duration",
                ),
                baseDurationUs: this.#durationUs(
                    baseDuration,
                    "react-profiler-base-duration",
                ),
            })
            if (this.#fault !== undefined) return
            this.#totals.profilerCallbacks++
            if (this.#summaryRing.add(summary)) this.#summaryOverflow++
        } catch {
            this.#recordFault("react-profiler")
        }
    }

    export(core: InspectionExport): InspectableReactExport {
        this.#synchronize(core.recordingId)
        const summaries = this.#summaryRing.snapshot()
        const details = this.#detailRing.snapshot()
        const summaryBounds = retainedBounds(summaries)
        const detailBounds = retainedBounds(details)
        const reactComplete =
            this.#summaryOverflow === 0 &&
            this.#detailOverflow === 0 &&
            this.#fault === undefined
        const react = Object.freeze({
            recordingId: this.#recordingId,
            coreRecordingId: this.#coreRecordingId,
            profiler: Object.freeze({
                commitCallbacksObserved: this.#profilerCallbacksObserved,
            }),
            summaries,
            details,
            totals: Object.freeze({ ...this.#totals }),
            complete: reactComplete,
            overflow: Object.freeze({
                summaries: this.#summaryOverflow,
                details: this.#detailOverflow,
                retained: Object.freeze({
                    ...(summaryBounds === undefined
                        ? {}
                        : { summaries: summaryBounds }),
                    ...(detailBounds === undefined
                        ? {}
                        : { details: detailBounds }),
                }),
            }),
            ...(this.#fault === undefined ? {} : { fault: this.#fault }),
        })
        return Object.freeze({
            schema: "valdres.react.inspect" as const,
            schemaVersion: 1 as const,
            core,
            react,
            complete: core.complete && reactComplete,
        })
    }

    reset(coreRecordingId: string): void {
        this.#startRecording(coreRecordingId)
    }

    #beginOperation<Value>(
        phase: string,
        controller: ProviderController,
        store: Store,
        state: State<Value>,
    ): OperationFrame | undefined {
        try {
            if (this.#fault !== undefined) return undefined
            const start = this.#capture(store, state)
            if (start === undefined || this.#fault !== undefined) {
                return undefined
            }
            const provider = this.#provider(controller)
            if (provider === undefined) return undefined
            return {
                generation: this.#generation,
                providerId: provider.id,
                provider,
                start,
            }
        } catch {
            this.#recordFault(phase)
            return undefined
        }
    }

    #finishDetail<Value>(
        phase: string,
        frame: OperationFrame | undefined,
        store: Store,
        state: State<Value>,
        result: "returned" | "threw",
        snapshot: SnapshotKind | undefined,
        cached: boolean,
        duringSubscriberCallback: boolean,
    ): void {
        try {
            if (
                frame === undefined ||
                frame.generation !== this.#generation ||
                this.#fault !== undefined
            ) {
                return
            }
            const end = this.#capture(store, state)
            if (
                this.#fault !== undefined ||
                frame.generation !== this.#generation
            ) {
                return
            }
            const sequence = this.#allocateSequence(phase)
            if (sequence === undefined) return
            const common = {
                sequence,
                providerId: frame.providerId,
                start: frame.start,
                ...(end === undefined ? {} : { end }),
                durationUs: captureDurationUs(frame.start, end),
                result,
            }
            const detail: ReactInspectionDetail = Object.freeze(
                snapshot === undefined
                    ? {
                          ...common,
                          type: "react-subscriber" as const,
                      }
                    : snapshot === "client"
                      ? {
                            ...common,
                            type: "react-snapshot" as const,
                            snapshot,
                            duringSubscriberCallback,
                        }
                      : {
                            ...common,
                            type: "react-snapshot" as const,
                            snapshot,
                            cached,
                        },
            )
            if (this.#detailRing.add(detail)) this.#detailOverflow++
        } catch {
            this.#recordFault(phase)
        }
    }

    #capture(store: Store): InspectionCapture | undefined
    #capture<Value>(
        store: Store,
        state: State<Value>,
    ): StateInspectionCapture | undefined
    #capture<Value>(
        store: Store,
        state?: State<Value>,
    ): InspectionCapture | StateInspectionCapture | undefined {
        if (this.#fault !== undefined) return undefined
        try {
            const capture =
                state === undefined
                    ? this.#core.inspect.capture(store)
                    : this.#core.inspect.capture(store, state)
            this.#synchronize(capture.recordingId)
            return capture
        } catch {
            this.#recordFault("capture")
            return undefined
        }
    }

    #provider(controller: ProviderController): ProviderRecording | undefined {
        let provider = this.#providerRecordings.get(controller.key)
        if (provider !== undefined) return provider
        if (!Number.isSafeInteger(this.#nextProviderId)) {
            this.#recordFault("provider-id")
            return undefined
        }
        provider = { id: this.#nextProviderId++, subscriberDepth: 0 }
        this.#providerRecordings.set(controller.key, provider)
        return provider
    }

    #synchronize(coreRecordingId: string): void {
        if (coreRecordingId === this.#coreRecordingId) return
        this.#startRecording(coreRecordingId)
    }

    #startRecording(coreRecordingId: string): void {
        this.#recordingId = `react-inspection-${nextReactRecordingId++}`
        this.#coreRecordingId = coreRecordingId
        this.#generation++
        this.#summaryRing = new BoundedRing(this.#summaryCapacity)
        this.#detailRing = new BoundedRing(this.#detailCapacity)
        this.#nextSequence = 1
        this.#nextProviderId = 1
        this.#nextCommitTimeGroupId = 1
        this.#lastCommitTimeMs = undefined
        this.#lastCommitTimeGroupId = undefined
        this.#lastCommitTimeGroupUs = undefined
        this.#providerRecordings = new WeakMap()
        this.#validatedStores = new WeakSet()
        this.#summaryOverflow = 0
        this.#detailOverflow = 0
        this.#totals = this.#emptyTotals()
        this.#fault = undefined
    }

    #allocateSequence(phase: string): number | undefined {
        if (!Number.isSafeInteger(this.#nextSequence)) {
            this.#recordFault(phase)
            return undefined
        }
        return this.#nextSequence++
    }

    #commitTimeGroup(
        commitTimeMs: number,
        commitTimeUs: number,
        phase: string,
    ): Readonly<{ id: number; timeUs: number }> | undefined {
        if (!Number.isFinite(commitTimeMs)) {
            this.#recordFault(phase)
            return undefined
        }
        if (
            this.#lastCommitTimeGroupId !== undefined &&
            this.#lastCommitTimeGroupUs !== undefined &&
            commitTimeMs === this.#lastCommitTimeMs
        ) {
            return {
                id: this.#lastCommitTimeGroupId,
                timeUs: this.#lastCommitTimeGroupUs,
            }
        }
        if (!Number.isSafeInteger(this.#nextCommitTimeGroupId)) {
            this.#recordFault(phase)
            return undefined
        }
        const commitTimeGroupId = this.#nextCommitTimeGroupId++
        this.#lastCommitTimeMs = commitTimeMs
        this.#lastCommitTimeGroupId = commitTimeGroupId
        this.#lastCommitTimeGroupUs = commitTimeUs
        this.#totals.commitTimeGroups++
        return { id: commitTimeGroupId, timeUs: commitTimeUs }
    }

    #recordFault(phase: string): void {
        if (this.#fault !== undefined) return
        const sequence = Number.isSafeInteger(this.#nextSequence)
            ? this.#nextSequence++
            : Number.MAX_SAFE_INTEGER
        this.#fault = Object.freeze({
            type: "recorder-fault",
            phase,
            sequence,
        })
    }

    #durationUs(durationMs: number, phase: string): number {
        if (!Number.isFinite(durationMs) || durationMs < 0) {
            this.#recordFault(phase)
            return 0
        }
        return Math.round(durationMs * 1_000)
    }

    #alignedTimeUs(timeMs: number, offsetUs: number, phase: string): number {
        if (!Number.isFinite(timeMs)) {
            this.#recordFault(phase)
            return 0
        }
        return Math.max(0, Math.round(timeMs * 1_000) + offsetUs)
    }

    #emptyTotals(): MutableTotals {
        return {
            commitTimeGroups: 0,
            profilerCallbacks: 0,
            subscriberCallbacks: 0,
            snapshots: 0,
            clientSnapshots: 0,
            clientSnapshotsDuringSubscriberCallbacks: 0,
            serverSnapshots: 0,
            thrownSubscriberCallbacks: 0,
            thrownSnapshots: 0,
        }
    }
}

const createController = (): ProviderController =>
    Object.freeze({ key: Object.freeze({}) })

const createHydrationReader = <Value,>(
    recorder: ReactInspectionRecorder,
    controller: ProviderController,
    store: Store,
    state: State<Value>,
): (() => Value) => {
    let outcome: HydrationOutcome<Value> | undefined

    return () => {
        const cached = outcome !== undefined
        return recorder.runSnapshot(
            controller,
            store,
            state,
            "server",
            cached,
            () => {
                assertStore(store)
                if (outcome === undefined) {
                    try {
                        outcome = {
                            didThrow: false,
                            result: readHydrationSnapshot(store, state),
                        }
                    } catch (error) {
                        outcome = { didThrow: true, result: error }
                    }
                }
                if (outcome.didThrow) throw outcome.result
                return outcome.result as Value
            },
        )
    }
}

/**
 * Create opt-in React bindings correlated with an inspectable Valdres Store.
 * Ordinary `valdres-react` imports remain free of the React recorder.
 */
export const createInspectableReact = (
    core: InspectableStoreResult,
    options: InspectableReactOptions = {},
): InspectableReactResult => {
    const recorder = new ReactInspectionRecorder(core, options)
    const InspectionContext = createContext<ProviderController | undefined>(
        undefined,
    )
    const fallbackController = createController()

    const useController = (): ProviderController =>
        useContext(InspectionContext) ?? fallbackController

    const useSelectedStore = (explicitStore?: Store): Store => {
        const contextStore = useContext(StoreContext)
        const selectedStore = explicitStore ?? contextStore ?? core.store
        recorder.validateStore(selectedStore)
        return selectedStore
    }

    const Provider = ({
        store = core.store,
        children,
    }: InspectableReactProviderProps): ReactElement => {
        recorder.validateStore(store)
        const controllerRef = useRef<ProviderController | undefined>(undefined)
        if (controllerRef.current === undefined) {
            controllerRef.current = createController()
        }
        const controller = controllerRef.current
        const onRender = useCallback<ProfilerOnRenderCallback>(
            (
                _id,
                phase,
                actualDuration,
                baseDuration,
                startTime,
                commitTime,
            ) => {
                recorder.recordProfiler(
                    controller,
                    store,
                    phase,
                    actualDuration,
                    baseDuration,
                    startTime,
                    commitTime,
                )
            },
            [controller, store],
        )

        return (
            <RootProvider store={store}>
                <InspectionContext.Provider value={controller}>
                    <Profiler id="valdres-inspect" onRender={onRender}>
                        {children}
                    </Profiler>
                </InspectionContext.Provider>
            </RootProvider>
        )
    }

    const useValue = <Value,>(state: State<Value>, store?: Store): Value => {
        const selectedStore = useSelectedStore(store)
        const controller = useController()
        const subscribeToState = useCallback(
            (callback: () => void) =>
                subscribe(selectedStore, state, () =>
                    recorder.runSubscriber(
                        controller,
                        selectedStore,
                        state,
                        callback,
                    ),
                ),
            [controller, selectedStore, state],
        )
        const getSnapshot = useCallback(
            () =>
                recorder.runSnapshot(
                    controller,
                    selectedStore,
                    state,
                    "client",
                    false,
                    () => read(selectedStore, state),
                ),
            [controller, selectedStore, state],
        )
        const getServerSnapshot = useMemo(
            () =>
                createHydrationReader(
                    recorder,
                    controller,
                    selectedStore,
                    state,
                ),
            [controller, selectedStore, state],
        )

        return useSyncExternalStore(
            subscribeToState,
            getSnapshot,
            getServerSnapshot,
        )
    }

    const useSetAtom = <Value,>(
        atom: Atom<Value>,
        store?: Store,
    ): ((value: Value) => void) => useRootSetAtom(atom, useSelectedStore(store))

    const useUpdateAtom = <Value,>(
        atom: Atom<Value>,
        store?: Store,
    ): ((update: AtomUpdater<Value>) => void) =>
        useRootUpdateAtom(atom, useSelectedStore(store))

    const useResetAtom = <Value,>(
        atom: Atom<Value>,
        store?: Store,
    ): (() => void) => useRootResetAtom(atom, useSelectedStore(store))

    const useAtom = <Value,>(
        atom: Atom<Value>,
        store?: Store,
    ): readonly [Value, (value: Value) => void] =>
        [useValue(atom, store), useSetAtom(atom, store)] as const

    const useStore = (): Store => useSelectedStore()

    const inspect = Object.freeze({
        get recordingId(): string {
            return recorder.recordingId
        },
        export: (): InspectableReactExport => {
            const coreExport = core.inspect.export()
            return recorder.export(coreExport)
        },
        reset: (): void => {
            core.inspect.reset()
            recorder.reset(core.inspect.recordingId)
        },
    }) satisfies InspectableReactInspector

    return Object.freeze({
        Provider,
        useValue,
        useAtom,
        useStore,
        useSetAtom,
        useUpdateAtom,
        useResetAtom,
        inspect,
    })
}
