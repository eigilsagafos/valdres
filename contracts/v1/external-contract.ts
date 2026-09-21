/** Approved ExternalAtom semantics: contract validation rejects coordinated manifest drift. */
export const externalPublicNotes: Readonly<Record<string, string>> = {
    "core.external-atom":
        "externalAtom<T>(source: ExternalSource<T>, options?: ExternalAtomOptions): ExternalAtom<T> creates a fresh frozen branded definition on every call, including repeated calls with the same source. Accept a non-null, non-array structural object; capture getSnapshot, getServerSnapshot, then subscribe exactly once in that deterministic order. Required methods are callable; getServerSnapshot is undefined or callable. Preserve inherited-method receivers and captured method references. Extra source properties are ignored; the source and application snapshots remain unbranded and unfrozen. Validate one or two positional arguments and options before registration or source invocation. Options are undefined or a non-null, non-array object with no own keys except name, including symbols and non-enumerable keys; name is undefined or a string. Accessor exceptions remain exact and validation runs under capability quarantine. ExternalAtom is read-only, Object.is defines outcome identity, and every StoreTree owns its projection and retained attachment. Async acquisition, equality overrides, and stale/cache policy stay outside this primitive.",
    "core.external-atom-options.name":
        "Optional inert string metadata; undefined is accepted and name never participates in definition identity. ExternalAtomOptions contains only readonly name?: string. Every unknown own option key rejects, including symbol and non-enumerable keys; Object.is and source-owned lifecycle remain fixed semantics.",
    "core.type.external-source":
        "ExternalSource<T> is exactly the readonly structural source contract with getSnapshot(): T, optional getServerSnapshot?(): T, and subscribe(invalidate: () => void): () => void. Inherited callable methods retain their source receiver. Methods are captured once in getSnapshot, getServerSnapshot, subscribe order. The source is neither branded nor frozen. Live and server snapshots are synchronous; subscribe returns one synchronous cleanup function. No named callback, projection, lifecycle, scheduling, or internal metadata type is exported.",
    "core.type.external-atom":
        'ExternalAtom<T> is a distinct invariant read-only State<T> arm over the private invariant value base, with readonly kind: "external". Store and Transaction reads, selectors, subscriptions, React useValue, and the approved family factory admit it; set, update, reset, and delete reject it. Every externalAtom call creates a fresh definition even for the same source. No source, projection, lifecycle, or writable capability is exposed on the handle.',
    "core.type.external-atom-options":
        "ExternalAtomOptions has exactly readonly name?: string. The optional name is inert diagnostic metadata. Undefined options are accepted; otherwise require a non-null, non-array object. Reject every unknown own option key, including symbols and non-enumerable keys, and every name value other than undefined or string. No equality, lifecycle, cache, freshness, or scheduling option is supported.",
    "core.invalid-synchronous-external-snapshot-error":
        'InvalidSynchronousExternalSnapshotError / VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT is the single frozen error class for returned or thrown thenables in either getSnapshot or getServerSnapshot. Its immutable name, code, and message are fixed; message is exactly "External source snapshots must be synchronous". Each actual sample installs exactly one stateless rejection-containment handler and never awaits. A throwing then getter remains its exact ordinary error, subject to sticky control-fault precedence. No phase, source, committed, dependency path, or application snapshot metadata is attached to this error.',
    "core.dormant-external-read-error":
        'DormantExternalReadError / VALDRES_DORMANT_EXTERNAL_READ is frozen with immutable name, code, and message exactly "Subscriber callbacks cannot sample dormant external sources". A subscriber read that would sample a dormant external closure is rejected before sampling or publication. No application data, phase, source, or committed metadata is attached to this error.',
    "core.invalid-external-cleanup-error":
        'InvalidExternalCleanupError / VALDRES_INVALID_EXTERNAL_CLEANUP is frozen with immutable name, code, message, phase, source, and committed metadata. Message is exactly "External source subscribe must return a synchronous cleanup function". Invalid subscribe cleanup has phase admitting and source external-startup; invalid cleanup completion has phase cleanup and source external-cleanup. committed is the boolean publication state when this failure occurs, not whether a later failure or cleanup changes the operation. Returned or thrown thenables are contained once and never awaited; ordinary synchronous cleanup return values are ignored. A sole named lifecycle failure is thrown directly with this metadata; aggregation retains the exact error as a cause and never mutates application errors.',
    "core.external-source-delivery-limit-error":
        'ExternalSourceDeliveryLimitError / VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT is frozen with immutable name, code, message, phase, source, and committed metadata. Message is exactly "External source delivery exceeded the synchronous work bound". Denied entry has phase sampling, source external-invalidation, and committed false: the unentered tree publishes nothing and its generation remains retryable. A sole bound failure is thrown directly with this metadata; aggregation preserves the exact error as a cause. Numeric delivery bounds are internal and are not public timing or scheduling API.',
    "core.external-source-non-convergence-error":
        'ExternalSourceNonConvergenceError / VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE is frozen with immutable name, code, message, phase, source, and committed metadata. Message is exactly "External sources did not settle within the synchronous work bound". Dirty-drain exhaustion has phase sampling, source external-drain, and committed true after terminal projection publication; attachment-work exhaustion has phase admitting and the originating operation source, with committed equal to publication state at failure. Pending active generations publish the exact same terminal error for that exhaustion, retain attachments, ignore same-stack terminal feedback, and recover on a later invalidation. A sole bound failure is thrown directly; aggregation preserves its exact identity. Numeric work bounds are internal.',
    "core.external-source-operation-error":
        'ExternalSourceOperationError / VALDRES_EXTERNAL_SOURCE_OPERATION is reserved for mixed-phase failures and setup/cleanup aggregation; pure notification failures retain SubscriberNotificationError. The error is frozen; immutable name, code, and message are fixed, with message exactly "An external source operation failed". cause is the exact first failure cause; causes is a frozen readonly array of every raw cause in deterministic occurrence order; failures is a frozen readonly array of frozen { cause, committed, phase, source } records. Preserve every independent failure occurrence, including repeated throws of the same value or error object; never deduplicate by error identity. Propagating one control occurrence through multiple selectors does not create new occurrences. Top-level committed, phase, and source mirror failures[0], even if later work commits. Phase is admitting | sampling | settling | notifying | cleanup | instrumenting. Source is owned-mutation | external-read | external-startup | external-invalidation | external-drain | external-cleanup. Complete all required notification, cleanup, and drain work before throwing after idle or terminal. Ordinary sampled snapshot errors are outcomes, not ledger entries. Sole internally generated control occurrences remain exact; provenance belongs to the current runtime occurrence, never a public class, error identity, or application-supplied brand. Application-constructed errors and previously captured runtime errors rethrown in a later setup/cleanup callback are arbitrary causes and use this wrapper without mutating application objects. The constructor requires a readonly non-empty failure tuple; an empty list at runtime throws TypeError with message exactly "ExternalSourceOperationError requires at least one failure". No named failure-record or internal lifecycle type is exported.',
    "core.server-snapshot-unavailable-error":
        'ServerSnapshotUnavailableError / VALDRES_SERVER_SNAPSHOT_UNAVAILABLE is frozen with immutable name, code, message, and dependencyPath. Message is exactly "An external source has no server snapshot". dependencyPath: readonly State<any>[] is a frozen array of exact local State handles ordered requested target -> active dynamic selector reads -> missing ExternalAtom, inclusive; a direct request yields [external]. Preserve the first missing path as host-fatal even when selector code catches it. Derive the path in the disposable hydration host rather than reusing live-cache paths; publish and warm no live projection or graph. Names, values, IDs, and paths are not interpolated into the message; application snapshots are not frozen.',
    "core.family":
        "FamilyOptions contains only encodeKey. A factory returns a same-domain Atom, Selector, or ExternalAtom constructed during the active factory frame, or an already-published family member of those kinds. Arbitrary pre-existing States, collection rows, collection definitions, and collection query States reject. Only Atom members participate in Store override reacquisition; ExternalAtom members retain source-owned lifecycle and read-only projection semantics. Accepting arbitrary pre-existing States would require reverse-indexing every ordinary Store override. The current ShiftX family migration must be validated externally.",
    "core.type.state":
        "The root State<Value> is the discriminated Atom | Selector | ExternalAtom | readonly collection-row | readonly collection union over one private invariant value base, preserving kind narrowing. Family factory admission deliberately remains the narrower Atom | Selector | ExternalAtom definition union and cannot return collection rows or collection definitions. A family factory may return a same-domain definition created in its active factory frame or an already-published family member, never an arbitrary pre-existing State. Store override reacquisition remains Atom-only.",
}

export const externalCallbackRules: Readonly<
    Record<
        string,
        Readonly<
            Record<"thenableRule" | "resultBoundary" | "errorRule", string>
        >
    >
> = {
    "callback.external-get-snapshot": {
        thenableRule:
            "A returned or thrown thenable becomes InvalidSynchronousExternalSnapshotError / VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT for both live and server snapshots. Each actual sample receives exactly one stateless rejection-containment handler, is never awaited, and never becomes a Suspense wakeable. A throwing then getter remains its exact ordinary error, subject to sticky control-fault precedence.",
        resultBoundary:
            "Retained reads never poll. A dormant admitted read samples each reached source at most once; a Transaction lazily captures each distinct ExternalAtom once across all scope cursors and draft generations without subscribing. Object.is compares sampled outcomes, and invalidation settles the authoritative snapshot synchronously.",
        errorRule:
            "Forbidden same-domain work throws CallbackCapabilityError. An ordinary non-thenable throw becomes a recoverable external projection error; RuntimeMismatchError remains an exact control fault with host-specific publication rules. Runtime drain non-convergence is owned outside this callback boundary.",
    },
    "callback.external-get-server-snapshot": {
        thenableRule:
            "A returned or thrown thenable becomes InvalidSynchronousExternalSnapshotError / VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT for both live and server snapshots. Each actual sample receives exactly one stateless rejection-containment handler, is never awaited, and never becomes a Suspense wakeable. A throwing then getter remains its exact ordinary error, subject to sticky control-fault precedence.",
        resultBoundary:
            "Sampled at most once per disposable host and never published into the live graph or external projection.",
        errorRule:
            "Forbidden same-domain work throws CallbackCapabilityError. A non-thenable throw is memoized exactly within the disposable host; a missing reader throws the sticky host-fatal ServerSnapshotUnavailableError with frozen dependencyPath of exact State handles ordered requested target to missing ExternalAtom, inclusive, even if selector code catches it.",
    },
    "callback.external-subscribe": {
        thenableRule:
            "subscribe itself is synchronous and must return a cleanup function; a thenable setup or cleanup result throws InvalidExternalCleanupError and is never awaited.",
        resultBoundary:
            "After a valid cleanup is returned, core performs the mandatory second sample and one admission settlement before sub returns.",
        errorRule:
            "Forbidden same-domain work throws CallbackCapabilityError. A throw rolls back provisional admission; a missing, non-function, or thenable cleanup throws InvalidExternalCleanupError. Runtime delivery limits are owned outside this callback boundary. Runtime-generated direct InvalidExternalCleanupError has frozen phase admitting, source external-startup, and committed equal to publication state at failure. Arbitrary setup throws, including application-created public error instances and later rethrows of captured runtime errors, and setup/cleanup aggregation use ExternalSourceOperationError; every failure occurrence is retained without deduplication by error identity.",
    },
    "callback.external-cleanup": {
        thenableRule:
            "A returned or thrown thenable becomes InvalidExternalCleanupError, is never awaited, and cannot add disposeAsync.",
        resultBoundary:
            "The generation is revoked before invocation and remains revoked regardless of cleanup outcome.",
        errorRule:
            "Forbidden same-domain work throws CallbackCapabilityError. Invalid synchronous cleanup results throw InvalidExternalCleanupError with frozen phase cleanup, source external-cleanup, and committed equal to publication state at failure. Cleanup remains revoke-first and all-run. Arbitrary cleanup throws, including application-created public error instances and later rethrows of captured runtime errors, and mixed-phase aggregation use ExternalSourceOperationError after idle or terminal, preserving every occurrence in order, including repeated error identities; application errors remain untouched. Pure notification failures retain SubscriberNotificationError.",
    },
    "callback.family-create-node": {
        thenableRule:
            "A thenable rejects as an invalid family factory result; the factory must synchronously return a same-domain Atom, Selector, or ExternalAtom.",
        resultBoundary:
            "One same-domain Atom, Selector, or ExternalAtom constructed in the active factory frame, or an already-published family member of those kinds, is weakly memoized for the canonical identity tuple. Collection rows and collection definitions reject, as do collection query States and arbitrary pre-existing States. Store override reacquisition remains Atom-only; ExternalAtom members keep source-owned lifecycle.",
        errorRule:
            "Forbidden same-domain work throws CallbackCapabilityError. A borrowed active selector get latches that fault even when caught. Any other throw creates no family member and is not cached.",
    },
}
