/**
 * Upstream Jotai 3.0.1 and jotai-family tests that this package does not pass,
 * keyed by `describe > ... > test title`. Against Jotai every test runs
 * normally. Against this package:
 *
 * - a **known failure** still runs and must fail with its `expected` outcome
 *   (an error code, or a narrowly matched assertion or missing element, plus
 *   where relevant the documented error code observed during the test; see
 *   `gapCheck.ts`). Passing, or failing any other way, fails the run;
 * - a **skipped** test is not run because its failure escapes the test body.
 *
 * Kinds: `unsupported` (rejected with an explicit error) or `divergence`
 * (supported, observably different). Every reason is documented in
 * ../../COMPATIBILITY.md.
 */
import type { ExpectedFailure } from "./gapCheck"

export interface Gap {
    readonly file: string
    readonly kind: "unsupported" | "divergence"
    readonly reason: string
    /** How a known failure must fail. Absent only for skipped tests. */
    readonly expected?: ExpectedFailure
    /** Not run: the failure escapes the test body. */
    readonly skip?: true
}

const LATE_GET_CODE = "VALDRES_JOTAI_LATE_GET"
const SIGNAL_CODE = "VALDRES_JOTAI_SIGNAL_UNSUPPORTED"
const ON_INIT_CODE = "VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED"
const CAPABILITY_CODE = "VALDRES_SELECTOR_CAPABILITY_ERROR"

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
// Skipped: the late get() throws inside unwrap's own promise callbacks,
// outside the test body.
const UNWRAP = "unwrap needs INTERNAL_onInit and get() in promise callbacks"
const STACK =
    "a stack overflow is cached as the atom's error, so a later store.sub does not throw it"

const known = (
    file: string,
    kind: Gap["kind"],
    reason: string,
    expected: ExpectedFailure,
): Gap => ({ file, kind, reason, expected })

const skipped = (file: string, kind: Gap["kind"], reason: string): Gap => ({
    file,
    kind,
    reason,
    skip: true,
})

export const gaps: Readonly<Record<string, Gap>> = {
    "abortable atom test > can abort with signal.aborted": known(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
        { code: SIGNAL_CODE },
    ),
    "abortable atom test > can abort with event listener": known(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
        { code: SIGNAL_CODE },
    ),
    "abortable atom test > does not abort on unmount": known(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
        { code: SIGNAL_CODE },
    ),
    "abortable atom test > throws aborted error (like fetch)": known(
        "react/abortable.test.tsx",
        "unsupported",
        SIGNAL,
        { code: SIGNAL_CODE },
    ),
    "does not show async stale result": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "works with async get with extra deps": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "uses async atom in the middle of dependency chain": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "updates an async atom in child useEffect on remount": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "uses async atom double chain (#306)": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "uses an async atom that depends on another async atom": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "combine two promise atom values (#442)": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "set two promise atoms at once": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "async atom double chain with setTimeout": known(
        "react/async.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "timing issue > resolves dependencies reliably after a delay (#2192)":
        known("react/async2.test.tsx", "unsupported", LATE_GET, {
            assertion:
                /^expect\(received\)\.toBe\(expected\)\s+Expected: 0\s+Received: null\s*$/,
            observed: LATE_GET_CODE,
        }),
    "works with async get": known(
        "react/basic.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "async chain for multiple sync and async atoms (#443)": known(
        "react/basic.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "works a primitive atom and a dependent async atom": known(
        "react/dependency.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "should keep a dependent atom value even if unmounted": known(
        "react/dependency.test.tsx",
        "divergence",
        EAGER,
        {
            assertion:
                /^expect\(received\)\.toHaveReturnedTimes\(expected\)\s+Expected number of succesful returns: == 1\s+Received number of succesful returns:\s+2\b/,
        },
    ),
    "should not call read function for unmounted atoms in StrictMode (#2076)":
        known("react/dependency.test.tsx", "divergence", EAGER, {
            assertion:
                /^expect\(received\)\.toHaveBeenCalledTimes\(expected\)\s+Expected number of calls: 0\s+Received number of calls: 1\s*$/,
        }),
    "works with async dependencies (#2565)": known(
        "react/dependency.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "can throw an error in async read function": known(
        "react/error.test.tsx",
        "unsupported",
        LATE_GET,
        {
            missingText: "no error",
            rendered:
                /Errored: [\s\S]*atom\d+ called get\(atom\d+\) after its read function returned/,
            observed: LATE_GET_CODE,
        },
    ),
    "create atom with onMount in async get": known(
        "react/onmount.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "useTransition > no extra commit with useTransition (#1125)": known(
        "react/transition.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "keeps atoms mounted between recalculations": known(
        "vanilla/dependency.test.tsx",
        "unsupported",
        LATE_GET,
        {
            assertion:
                /^expect\(received\)\.toEqual\(expected\)[\s\S]*-\s+"mounted": 1,\s+\+\s+"mounted": 0,/,
            observed: LATE_GET_CODE,
        },
    ),
    "settles never resolving async derivations with deps picked up async":
        skipped("vanilla/dependency.test.tsx", "unsupported", LATE_GET),
    "deriveStore for scoping atoms > primitive atom": known(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "deriveStore for scoping atoms > derived atom (scoping primitive)": known(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "deriveStore for scoping atoms > derived atom with subscribe": known(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "should pass the correct store instance to the atom initializer": known(
        "vanilla/derive.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "should update async atom with deps after await (#1905)": known(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "should not call read function for unmounted atoms (#2076)": known(
        "vanilla/store.test.tsx",
        "divergence",
        EAGER,
        {
            assertion:
                /^expect\(received\)\.toHaveBeenCalledTimes\(expected\)\s+Expected number of calls: 1\s+Received number of calls: 2\s*$/,
        },
    ),
    "resolves dependencies reliably after a delay (#2192)": known(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
        {
            assertion:
                /^expect\(received\)\.toBe\(expected\)\s+Expected: 2\s+Received: null\s*$/,
            observed: LATE_GET_CODE,
        },
    ),
    "should mount sibling dependencies in read order": known(
        "vanilla/store.test.tsx",
        "divergence",
        MOUNT_ORDER,
        {
            assertion:
                /^expect\(received\)\.toEqual\(expected\)\s+\[\s+-\s+"first",\s+"second",\s+\+\s+"first",\s+\]/,
        },
    ),
    "async atom with subtle timing > case 1": known(
        "vanilla/store.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "aborting atoms > should abort the signal when dependencies change": known(
        "vanilla/store.test.tsx",
        "unsupported",
        SIGNAL,
        {
            assertion:
                /^expect\(received\)\.toThrow\(expected\)\s+Expected substring: "aborted"\s+Received message: "atom\d+ read options\.signal, which @valdres-react\/jotai does not support/,
            observed: SIGNAL_CODE,
        },
    ),
    "aborting atoms > should abort the signal when dependencies change and the atom is mounted":
        known("vanilla/store.test.tsx", "unsupported", SIGNAL, {
            assertion:
                /^expect\(received\)\.toHaveBeenCalledTimes\(expected\)\s+Expected number of calls: 2\s+Received number of calls: 0\s*$/,
            observed: SIGNAL_CODE,
        }),
    "aborting atoms > should not abort the signal when unsubscribed": known(
        "vanilla/store.test.tsx",
        "unsupported",
        SIGNAL,
        { code: SIGNAL_CODE },
    ),
    "should mount and trigger listeners even when an error is thrown > in asynchronous read":
        known("vanilla/store.test.tsx", "unsupported", LATE_GET, {
            assertion:
                /^expect\(received\)\.toHaveBeenCalledOnce\(expected\)\s+Expected number of calls: 1\s+Received number of calls: 0\s*$/,
            observed: LATE_GET_CODE,
        }),
    "should mount and trigger listeners even when an error is thrown > in read promise on settled":
        known("vanilla/store.test.tsx", "unsupported", LATE_GET, {
            assertion:
                /^expect\(received\)\.toHaveBeenCalledOnce\(expected\)\s+Expected number of calls: 1\s+Received number of calls: 0\s*$/,
            observed: LATE_GET_CODE,
        }),
    "surfaces a stack overflow for a graph too deep to read synchronously":
        known("vanilla/store.test.tsx", "divergence", STACK, {
            assertion:
                /^expect\(received\)\.toThrow\(expected\)\s+Expected pattern: \/call stack\|recursion\/i\s+Received function did not throw/,
        }),
    "should call onInit only once per atom": known(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "should call onInit only once per store": known(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "should pass store and atomState to the atom initializer": known(
        "vanilla/store.test.tsx",
        "unsupported",
        ON_INIT,
        { code: ON_INIT_CODE },
    ),
    "[DEV-ONLY] should warn store mutation during read": known(
        "vanilla/store.test.tsx",
        "unsupported",
        STORE_IN_READ,
        { code: CAPABILITY_CODE },
    ),
    "should keep reactivity when a derived atom returns a function that calls get (#3240)":
        known("vanilla/store.test.tsx", "unsupported", LATE_GET, {
            code: LATE_GET_CODE,
        }),
    "notifies subscriber when nested write uses get to read atom with store.set":
        known("vanilla/store.test.tsx", "unsupported", STORE_IN_READ, {
            code: CAPABILITY_CODE,
        }),
    "simple async get default": known(
        "react/vanilla-utils/atomWithDefault.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "refresh async atoms to default values": known(
        "react/vanilla-utils/atomWithDefault.test.tsx",
        "unsupported",
        LATE_GET,
        { code: LATE_GET_CODE },
    ),
    "unwrap > should unwrap a promise with no fallback function": skipped(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
    ),
    "unwrap > should unwrap a promise with fallback function without prev":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should unwrap a promise with fallback function with prev":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should unwrap an async writable atom": skipped(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
    ),
    "unwrap > should unwrap to a fulfilled value of an already resolved async atom":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should get a fulfilled value after the promise resolves": skipped(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
    ),
    "unwrap > should throw an error if underlying promise is rejected": skipped(
        "vanilla/utils/unwrap.test.ts",
        "unsupported",
        UNWRAP,
    ),
    "unwrap > should not enter an infinite loop when a rejected source recomputes":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should pass the last value to fallback after an error state":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should update dependents with the value of the unwrapped atom when the promise resolves":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
    "unwrap > should expose the latest value after a linked async read resolves (#3296)":
        skipped("vanilla/utils/unwrap.test.ts", "unsupported", UNWRAP),
}
