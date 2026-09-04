import type { Store } from "./v1"
import { createInspectableStoreTree } from "./v1-internal/public-domain"
import { createInspectionRecorder } from "./v1-internal/inspection"
import type {
    CommitInspection,
    CycleSearchInspectionDetail,
    InspectableStoreOptions,
    InspectionCycleBucket,
    InspectionCycleTotals,
    InspectionCapture,
    InspectionDetail,
    InspectionDetailType,
    InspectionExport,
    InspectionJsonObject,
    InspectionJsonPrimitive,
    InspectionJsonValue,
    InspectionNewEdgeProofMemoTotals,
    InspectionOverflow,
    InspectionRecorderFault,
    InspectionReference,
    InspectionReferenceKind,
    InspectionReverseProofOutcome,
    InspectionReverseProofTotals,
    InspectionTopologyDeltaReverseSnapshotTotals,
    InspectionSummary,
    InspectionWorkTotals,
    OperationInspection,
    IntentInspectionDetail,
    SelectorEvaluationInspectionDetail,
    SpanInspection,
    StateInspectionCapture,
    StoreInspector,
} from "./v1-internal/inspection"

export interface InspectableStoreResult {
    readonly store: Store
    readonly inspect: StoreInspector
}

/**
 * Create a StoreTree with an isolated, bounded structural flight recorder.
 * State values, callbacks, and Store internals never enter the recording.
 */
export const createInspectableStore = (
    options: InspectableStoreOptions = {},
): InspectableStoreResult => {
    const { inspect, instrumentation, trace } =
        createInspectionRecorder(options)
    const store = createInspectableStoreTree(instrumentation, trace)
    return Object.freeze({ store, inspect })
}

export type {
    CommitInspection,
    CycleSearchInspectionDetail,
    InspectableStoreOptions,
    InspectionCycleBucket,
    InspectionCycleTotals,
    InspectionCapture,
    InspectionDetail,
    InspectionDetailType,
    InspectionExport,
    InspectionJsonObject,
    InspectionJsonPrimitive,
    InspectionJsonValue,
    InspectionNewEdgeProofMemoTotals,
    InspectionOverflow,
    InspectionRecorderFault,
    InspectionReference,
    InspectionReferenceKind,
    InspectionReverseProofOutcome,
    InspectionReverseProofTotals,
    InspectionTopologyDeltaReverseSnapshotTotals,
    InspectionSummary,
    InspectionWorkTotals,
    OperationInspection,
    IntentInspectionDetail,
    SelectorEvaluationInspectionDetail,
    SpanInspection,
    StateInspectionCapture,
    StoreInspector,
}
