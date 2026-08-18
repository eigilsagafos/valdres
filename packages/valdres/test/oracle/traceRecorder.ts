/** # Semantic event-trace oracle — recorder core
 *
 *  A behavioral safety harness for the core commit engine and dependency graph.
 *  It records ONE canonical ordered event log per committed operation and lets a
 *  table-driven test assert it, so a refactor that silently reorders observable
 *  effects produces a clear trace diff. Everything here is built on the PUBLIC
 *  API only (atom `onSet`, `store.sub`, `store.onChange`, `store.onCommitEnd`,
 *  plus a test-side wrapper around a selector's `get` to count evaluations) —
 *  there are no production-code changes and no private hooks.
 *
 *  ## The observable per-commit phase spine (what the tags capture)
 *
 *      onSet:<atom>   hooks run in the write phase, before ALL propagation
 *      eval:<sel>     selector recompute (upstream→downstream within a store)
 *      sub:<name>     subscriber delivery (store.sub)
 *      onChange       store.onChange flush — once per listener per operation
 *      commitEnd      store.onCommitEnd — once, at the outermost commit boundary
 *
 *  ## Contractual vs incidental order (see assertTrace)
 *
 *  The engine only *contracts* the vertical spine above and within-store
 *  dependency order. The relative order of independent same-phase events —
 *  subscribers to different atoms, independent selectors, peer stores, sibling
 *  scopes — is left to Map/Set insertion order and must NOT be locked. Express
 *  those as a nested array ("bag") in the expected pattern; `assertTrace` sorts
 *  the corresponding slice on both sides before comparing. This mirrors the
 *  maintainer convention in `src/lib/onCommitEnd.test.ts` (`.slice().sort()`).
 */
import { expect } from "../performance/test-compat"
import { atom } from "../../src/atom"
import { globalAtom } from "../../src/globalAtom"
import { selector } from "../../src/selector"
import type { Atom } from "../../src/types/Atom"
import type { AtomOptions } from "../../src/types/AtomOptions"
import type { GlobalAtom } from "../../src/types/GlobalAtom"
import type { GlobalAtomOptions } from "../../src/types/GlobalAtomOptions"
import type { Selector, SelectorGetOptions } from "../../src/types/Selector"
import type { GetValue } from "../../src/types/GetValue"
import type { Store } from "../../src/types/Store"
import type { StoreChange } from "../../src/types/StoreChange"
import type { StoreChangeMeta } from "../../src/types/StoreChangeMeta"

/** A recorded onChange invocation: the tag pushed into the spine plus the raw
 *  payload, so a case can assert sources/kinds/values without re-deriving them. */
export type ChangeCall = {
    changes: readonly StoreChange[]
    meta: StoreChangeMeta
}

/** The ordered event log. `events` is a live array (truncated in place by
 *  `clear()`), so a reference captured before setup stays valid after it. */
export interface Recorder {
    readonly events: string[]
    push: (tag: string) => void
    /** Drop every event recorded so far — call after setup so cold reads /
     *  first subscriptions don't pollute the operation's trace. */
    clear: () => void
}

export const createRecorder = (): Recorder => {
    const events: string[] = []
    return {
        events,
        push: tag => {
            events.push(tag)
        },
        clear: () => {
            events.length = 0
        },
    }
}

/** An ordinary atom whose `onSet` pushes `onSet:<label>`. Composes with a
 *  user-supplied `onSet` (which still runs, after the tag). Works for global
 *  atoms too — a real `onSet` replaces the internal no-op marker but keeps the
 *  atom commit-sensitive (see `lib/globalAtom.ts`).
 *
 *  `label` names the trace tag only — it is NOT passed as the atom's `name`
 *  option (atom names are process-global unique addresses; reusing "a" across
 *  cases would throw). Assertions key off the atom object identity, not a name. */
export const tracedAtom = <V>(
    rec: Recorder,
    label: string,
    defaultValue?: V | (() => V) | Selector<V>,
    opts?: AtomOptions<V>,
): Atom<V> => {
    const userOnSet = opts?.onSet
    return atom(defaultValue as V, {
        ...opts,
        onSet: (value, store) => {
            rec.push(`onSet:${label}`)
            userOnSet?.(value, store)
        },
    }) as Atom<V>
}

// Global atoms are named addresses (registerName throws on a duplicate), but
// trace-oracle cases freely reuse short labels like "g" across cases in the
// same process — so the registered name is a synthesized, always-unique
// string. `label` tags the trace only; it is never the registered name.
let tracedGlobalAtomSeq = 0

/** A global atom whose `onSet` pushes `onSet:<label>`. Kept separate so
 *  `globalAtom()` returns the `GlobalAtom` self-accessors. As with
 *  `tracedAtom`, `label` tags the trace only — the registered name is
 *  synthesized (see `tracedGlobalAtomSeq`) so cases can reuse labels freely. */
export const tracedGlobalAtom = <V>(
    rec: Recorder,
    label: string,
    defaultValue?: V | (() => V) | Selector<V>,
    opts?: Omit<GlobalAtomOptions<V>, "name">,
): GlobalAtom<V> => {
    const userOnSet = opts?.onSet
    return globalAtom(defaultValue as V, {
        ...opts,
        name: `trace-oracle/${label}#${tracedGlobalAtomSeq++}`,
        onSet: (value, store) => {
            rec.push(`onSet:${label}`)
            userOnSet?.(value, store)
        },
    })
}

/** A selector whose `get` pushes `eval:<name>` on every evaluation (each live
 *  recompute — including recomputes that yield an unchanged value — is one
 *  event). The wrapper is transparent: it forwards the real `get` and returns
 *  the body's result, so async selectors (which return a promise) still work. */
export const tracedSelector = <V>(
    rec: Recorder,
    name: string,
    get: (get: GetValue, opts: SelectorGetOptions) => V,
    opts?: Record<string, unknown>,
): Selector<V> => {
    return selector((innerGet, getOpts) => {
        rec.push(`eval:${name}`)
        return get(innerGet, getOpts)
    }, opts as never)
}

/** Subscribe, pushing `sub:<name>` on each delivery. Returns the unsubscribe. */
export const traceSub = (
    rec: Recorder,
    store: Store,
    state: Atom<any> | Selector<any>,
    name: string,
): (() => void) => store.sub(state as never, () => rec.push(`sub:${name}`))

/** Wire `store.onChange`, pushing `onChange` (or `onChange:<label>` when a
 *  label is given, to distinguish per-store listeners in a cross-scope case).
 *  Returns the unsub plus the live `calls` array of raw payloads. */
export const traceChange = (
    rec: Recorder,
    store: Store,
    label?: string,
    options?: { atoms?: boolean; selectors?: boolean },
): { unsub: () => void; calls: ChangeCall[] } => {
    const tag = label ? `onChange:${label}` : "onChange"
    const calls: ChangeCall[] = []
    const unsub = (store.onChange as (cb: unknown, opts?: unknown) => () => void)(
        (changes: readonly StoreChange[], meta: StoreChangeMeta) => {
            rec.push(tag)
            calls.push({ changes, meta })
        },
        options,
    )
    return { unsub, calls }
}

/** Wire `store.onCommitEnd`, pushing `commitEnd` (or `commitEnd:<label>`). */
export const traceCommitEnd = (
    rec: Recorder,
    store: Store,
    label?: string,
): (() => void) => {
    const tag = label ? `commitEnd:${label}` : "commitEnd"
    return store.onCommitEnd(() => rec.push(tag))
}

/** Resolve on the next commit boundary of `store`'s tree — the deterministic
 *  "settle signal" for async cases (prefer this over counting `await`s). */
export const nextCommit = (store: Store): Promise<void> =>
    new Promise(resolve => {
        const unsub = store.onCommitEnd(() => {
            unsub()
            resolve()
        })
    })

/** A pattern element is either an exact tag (locked position) or a "bag" — a
 *  nested array of tags that must appear contiguously, in ANY order (an
 *  incidental same-phase segment). */
export type TracePattern = ReadonlyArray<string | readonly string[]>

/** Canonicalize `actual` and `expected` against `pattern` for a single clean
 *  `.toEqual` comparison: every bag is sorted on both sides (so incidental
 *  order never fails), exact tags keep their position, and any surplus actual
 *  events are appended so they surface in the diff. Pure — used by the
 *  self-test to prove a genuine reorder still fails. */
export const canonicalizeTrace = (
    actual: readonly string[],
    pattern: TracePattern,
): { actual: string[]; expected: string[] } => {
    const canonActual: string[] = []
    const flatExpected: string[] = []
    let i = 0
    for (const el of pattern) {
        if (Array.isArray(el)) {
            const slice = actual.slice(i, i + el.length)
            canonActual.push(...[...slice].sort())
            flatExpected.push(...[...el].sort())
            i += el.length
        } else {
            canonActual.push(actual[i] as string)
            flatExpected.push(el as string)
            i += 1
        }
    }
    if (i < actual.length) canonActual.push(...actual.slice(i))
    return { actual: canonActual, expected: flatExpected }
}

/** Assert a recorded trace against a pattern (exact tags + order-free bags) with
 *  a single `.toEqual`, so any spine reorder or missing/extra event is a clear
 *  one-array diff. */
export const assertTrace = (
    actual: readonly string[],
    pattern: TracePattern,
): void => {
    const { actual: a, expected: e } = canonicalizeTrace(actual, pattern)
    expect(a).toEqual(e)
}
