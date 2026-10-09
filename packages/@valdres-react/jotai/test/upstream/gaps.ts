/**
 * Upstream Jotai 3.0.1 tests that this package does not pass, keyed by
 * `describe > ... > test title`. `vi.ts` runs each as `test.failing` against
 * the adapter (`not-applicable` ones are skipped) and normally against Jotai.
 * A listed test that starts passing fails the run until it is removed here.
 *
 * - `unsupported`: Jotai behavior this package rejects with an explicit error.
 * - `divergence`: supported behavior that differs observably from Jotai.
 * - `not-applicable`: exercises an API this package does not export.
 *
 * Every reason is documented in ../../COMPATIBILITY.md.
 */
export interface Gap {
    readonly file: string
    readonly kind: "unsupported" | "divergence" | "not-applicable"
    readonly reason: string
    /** Skip instead of inverting: the failure escapes the test body. */
    readonly skip?: true
}

const LATE_GET =
    "get() after the read function returned (e.g. after await) throws VALDRES_JOTAI_LATE_GET"
const SIGNAL = "read options.signal throws VALDRES_JOTAI_SIGNAL_UNSUPPORTED"
const ON_INIT =
    "Jotai's internal INTERNAL_onInit hook throws VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED"
const STORE_IN_READ =
    "store methods inside a read function throw Valdres SelectorCapabilityError"
const EAGER =
    "Valdres recomputes a previously read, unsubscribed selector when a dependency changes"
const MOUNT_ORDER =
    "Valdres attaches sibling dependencies in reverse read order, so their onMount order is reversed"
const PREVIOUS_VALUE =
    "a derived atom with init reading itself gets its init or last set value, not its previous computed value"
// Skipped: the late get() throws inside unwrap's own promise callbacks,
// outside the test body.
const UNWRAP =
    "unwrap needs INTERNAL_onInit, get() in promise callbacks and previous-value self-reads"
const STACK =
    "a stack overflow is cached as the atom's error, so a later store.sub does not throw it"

const gap = (
    file: string,
    kind: Gap["kind"],
    reason: string,
    skip?: true,
): Gap => ({ file, kind, reason, skip })

export const gaps: Readonly<Record<string, Gap>> = {
    "abortable atom test > can abort with signal.aborted": gap(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "abortable atom test > can abort with event listener": gap(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "abortable atom test > does not abort on unmount": gap(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "abortable atom test > throws aborted error (like fetch)": gap(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "does not show async stale result": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "works with async get with extra deps": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "uses async atom in the middle of dependency chain": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "updates an async atom in child useEffect on remount": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "uses async atom double chain (#306)": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "uses an async atom that depends on another async atom": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "combine two promise atom values (#442)": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "set two promise atoms at once": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "async atom double chain with setTimeout": gap(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "timing issue > resolves dependencies reliably after a delay (#2192)": gap(
        "react/async2.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "works with async get": gap(
        "react/basic.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "async chain for multiple sync and async atoms (#443)": gap(
        "react/basic.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "works a primitive atom and a dependent async atom": gap(
        "react/dependency.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "should keep a dependent atom value even if unmounted": gap(
        "react/dependency.test.tsx",
        "divergence",
        EAGER,
    ),
    "should not call read function for unmounted atoms in StrictMode (#2076)":
        gap("react/dependency.test.tsx", "divergence", EAGER),
    "works with async dependencies (#2565)": gap(
        "react/dependency.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "can throw an error in async read function": gap(
        "react/error.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "create atom with onMount in async get": gap(
        "react/onmount.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "useTransition > no extra commit with useTransition (#1125)": gap(
        "react/transition.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "keeps atoms mounted between recalculations": gap(
        "vanilla/dependency.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "settles never resolving async derivations with deps picked up async": gap(
        "vanilla/dependency.test.tsx",
        "unsupported",
        LATE_GET,
        // The rejection reaches the test's own unhandled `.then` chain.
        true,
    ),
    "deriveStore for scoping atoms > primitive atom": gap(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "deriveStore for scoping atoms > derived atom (scoping primitive)": gap(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "deriveStore for scoping atoms > derived atom with subscribe": gap(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "should pass the correct store instance to the atom initializer": gap(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "should update async atom with deps after await (#1905)": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "should not call read function for unmounted atoms (#2076)": gap(
        "vanilla/store.test.tsx",
        "divergence",
        EAGER,
    ),
    "resolves dependencies reliably after a delay (#2192)": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "should mount sibling dependencies in read order": gap(
        "vanilla/store.test.tsx",
        "divergence",
        MOUNT_ORDER,
    ),
    "async atom with subtle timing > case 1": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "aborting atoms > should abort the signal when dependencies change": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "aborting atoms > should abort the signal when dependencies change and the atom is mounted":
        gap("vanilla/store.test.tsx", "unsupported", SIGNAL),
    "aborting atoms > should not abort the signal when unsubscribed": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        SIGNAL,
    ),
    "should mount and trigger listeners even when an error is thrown > in asynchronous read":
        gap("vanilla/store.test.tsx", "unsupported", LATE_GET),
    "should mount and trigger listeners even when an error is thrown > in read promise on settled":
        gap("vanilla/store.test.tsx", "unsupported", LATE_GET),
    "surfaces a stack overflow for a graph too deep to read synchronously": gap(
        "vanilla/store.test.tsx",
        "divergence",
        STACK,
    ),
    "should call onInit only once per atom": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "should call onInit only once per store": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "should pass store and atomState to the atom initializer": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
    ),
    "[DEV-ONLY] should warn store mutation during read": gap(
        "vanilla/store.test.tsx",
        "unsupported",
        STORE_IN_READ,
    ),
    "should keep reactivity when a derived atom returns a function that calls get (#3240)":
        gap("vanilla/store.test.tsx", "unsupported", LATE_GET),
    "notifies subscriber when nested write uses get to read atom with store.set":
        gap("vanilla/store.test.tsx", "unsupported", STORE_IN_READ),
    "simple async get default": gap(
        "react/vanilla-utils/atomWithDefault.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "refresh async atoms to default values": gap(
        "react/vanilla-utils/atomWithDefault.test.tsx",
        "unsupported",
        LATE_GET,
    ),
    "do not update unless equality function says value has changed": gap(
        "react/vanilla-utils/selectAtom.test.tsx",
        "divergence",
        PREVIOUS_VALUE,
    ),
    "no unnecessary updates when updating atoms": gap(
        "react/vanilla-utils/splitAtom.test.tsx",
        "divergence",
        PREVIOUS_VALUE,
    ),
    "unwrap > should unwrap a promise with no fallback function": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should unwrap a promise with fallback function without prev": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should unwrap a promise with fallback function with prev": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should unwrap an async writable atom": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should unwrap to a fulfilled value of an already resolved async atom":
        gap("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP, true),
    "unwrap > should get a fulfilled value after the promise resolves": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should throw an error if underlying promise is rejected": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should not enter an infinite loop when a rejected source recomputes":
        gap("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP, true),
    "unwrap > should pass the last value to fallback after an error state": gap(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
        true,
    ),
    "unwrap > should update dependents with the value of the unwrapped atom when the promise resolves":
        gap("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP, true),
    "unwrap > should expose the latest value after a linked async read resolves (#3296)":
        gap("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP, true),
}
