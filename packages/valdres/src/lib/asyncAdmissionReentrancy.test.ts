/** # Characterization — async admission and schema re-entrancy
 *
 *  `coordinateAsyncWrite` admits a resolved async write only while the atom
 *  still holds the exact Promise that write installed (`admitAsyncAtomTransition`
 *  compares `data.values.get(atom) === promise` and rejects a disposed store).
 *  The window that is easy to get wrong is `validateResolvedValue`: it runs USER
 *  code (a schema's `parse`) *after* the first admission check and *before* the
 *  value is applied, so that user code can synchronously supersede the very
 *  write being settled. Every path out of the schema call re-checks admission.
 *
 *  These tests pin the observable disposition of each superseding operation —
 *  final value, whether a pending-default placeholder resolves, subscriber and
 *  `onChange` records, and rejection containment — so the upcoming CommitPlan /
 *  `coordinateAsyncWrite` refactor cannot quietly change last-write-wins,
 *  double-publish a stale async value, or lose a notification.
 *
 *  ## Both settlement branches are covered
 *
 *  `settleAsyncAtomResolution` splits on `hasOnSet`, and the two halves re-check
 *  admission by DIFFERENT mechanisms — dropping either one is a distinct
 *  regression, so each is exercised separately:
 *
 *  - **no `onSet`** → the optimized scalar path (`runObserved/UnobservedAsync
 *    AtomResolution`), re-admitted by the `admitted` boolean argument.
 *  - **`onSet`** → `runCommitPlan` with an `admit:` callback (and, for a global
 *    atom, ordered `globalEffects`). A control case with no supersession proves
 *    this branch really does publish `onSet` + `async-set` when admission holds,
 *    so the superseding cases assert a real suppression rather than a path that
 *    never fires.
 *
 *  ## Pending-default (suspense) placeholders
 *
 *  An atom with NO default hands its first reader a placeholder promise held in
 *  `data.pendingDefaults` — a WeakMap keyed by the atom, so there is at most one
 *  live entry per atom per scope chain. Characterizing the superseding cases
 *  surfaced a real defect, fixed in this change: removing a store's own value
 *  (`unset`, or `reset` on an atom with no default) leaves the placeholder live,
 *  and the re-init on the next read used to mint a SECOND placeholder over the
 *  same key — permanently orphaning the reader suspended on the first.
 *  `getAtomInitValue`/`resolveAtomDefaultValue` now reuse the outstanding entry
 *  via `pendingDefaultPromise`, whose scope-chain walk mirrors
 *  `resolvePendingDefault`'s. The cases below cover it through the async
 *  admission window and, in baseline form, with no async write involved at all.
 *
 *  Deliberately NOT duplicated here (referenced, and expected to stay green):
 *  - `test/oracle/asyncAtom.trace.test.ts:207` — a throwing async `onSet`
 *    settles and notifies with NO rollback, and the caller's Promise still
 *    resolves; its companion at `:245` locks the rejection-rollback trace.
 *  - `test/oracle/asyncAtom.trace.test.ts:169` — the SYNC schema-supersede
 *    trace spine (`set`, not an async resolution).
 *  - `test/oracle/disposalAndCancellation.trace.test.ts` — the selector-side
 *    AbortSignal spine and the global/family disposal suppression cases.
 *
 *  Unhandled-rejection assertion: Bun fails a test outright when a detached
 *  promise chain leaks a rejection, so every rejection case below simply awaits
 *  past the rejection turn — reaching its final assertion IS the assertion that
 *  nothing leaked. This mirrors the convention documented in the async oracle.
 */
import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { globalAtom } from "../globalAtom"
import { selector } from "../selector"
import { store } from "../store"
import { wait } from "../../test/utils/wait"
import { uniqueName } from "../../test/utils/uniqueName"
import { isPromiseLike } from "../utils/isPromiseLike"
import { StoreDisposedError } from "../errors/StoreDisposedError"
import type { Atom } from "../types/Atom"
import type { Store } from "../types/Store"
import type { StoreChange } from "../types/StoreChange"
import type { StoreChangeMeta } from "../types/StoreChangeMeta"

const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (error: unknown) => void
}

const defer = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

/** Render a delivered value for comparison, so a sequence of deliveries can be
 *  asserted as a whole without pinning promise identity delivery-by-delivery
 *  (the cases that care about identity assert it directly). */
const describeValue = (value: unknown) =>
    isPromiseLike(value) ? "promise" : String(value)

/** Bounded race so an unresolved suspense placeholder reports as `pending`
 *  instead of hanging until the test timeout (same helper shape as
 *  `lib/transaction.test.ts`). */
const settleWithin = async <T>(promise: Promise<T>, ms = 50) => {
    let timer: ReturnType<typeof setTimeout>
    try {
        return await Promise.race([
            promise.then(value => ({ kind: "resolved" as const, value })),
            new Promise<{ kind: "pending" }>(resolve => {
                timer = setTimeout(() => resolve({ kind: "pending" }), ms)
            }),
        ])
    } finally {
        clearTimeout(timer!)
    }
}

/** An atom whose schema `parse` records every value it validates and runs
 *  `supersede` once, on the first value validated after the caller arms it.
 *  One-shot by construction: the superseding write re-enters `parse` with its
 *  own value, which must not recurse. */
const reentrantAtom = <T>(defaultValue?: T) => {
    /** Every value handed to the schema, in validation order. */
    const parsed: unknown[] = []
    let armed: (() => void) | undefined
    const state = atom<T>(defaultValue, {
        schema: {
            parse: (value: unknown) => {
                parsed.push(value)
                const supersede = armed
                armed = undefined
                supersede?.()
                return value as T
            },
        },
    })
    return { state, parsed, arm: (fn: () => void) => (armed = fn) }
}

/** A re-entrant atom that also carries an `onSet` hook, so its async
 *  resolution takes the `runCommitPlan` branch of `settleAsyncAtomResolution`
 *  instead of the optimized scalar path. `onSet`, subscriber delivery and
 *  `onChange` all land in ONE ordered log so the branch's phase order is
 *  visible: an admitted resolution must show `onSet` before any notification. */
const hookedCase = (defaultValue?: number, options?: { global?: true }) => {
    const events: string[] = []
    let armed: (() => void) | undefined
    const hookOptions = {
        onSet: (value: number) => events.push(`onSet:${String(value)}`),
        schema: {
            parse: (value: unknown) => {
                const supersede = armed
                armed = undefined
                supersede?.()
                return value as number
            },
        },
    }
    const state = options?.global
        ? globalAtom<number>(defaultValue, {
              ...hookOptions,
              name: uniqueName("hookedCase"),
          })
        : atom<number>(defaultValue, hookOptions)
    /** Attach the ordered log to `store1`, tagging events with `label` so a
     *  global atom's peer stores stay distinguishable. */
    const watch = (store1: Store, label = "") => {
        store1.sub(state, () =>
            events.push(`sub${label}:${String(store1.get(state))}`),
        )
        store1.onChange(
            (reported: readonly StoreChange[], meta: StoreChangeMeta) => {
                for (const change of reported)
                    if (change.type === "atom")
                        events.push(
                            `change${label}:${change.kind}:${meta.source}`,
                        )
            },
        )
    }
    return { state, events, watch, arm: (fn: () => void) => (armed = fn) }
}

/** Subscriber deliveries (as the value each one reads) and atom `onChange`
 *  records (as `kind:source`), both in delivery order. */
const record = <T>(store1: Store, state: Atom<T>) => {
    const observed: unknown[] = []
    const changes: string[] = []
    store1.sub(state, () => observed.push(store1.get(state)))
    store1.onChange(
        (reported: readonly StoreChange[], meta: StoreChangeMeta) => {
            for (const change of reported) {
                if (change.type === "atom")
                    changes.push(`${change.kind}:${meta.source}`)
            }
        },
    )
    return { observed, changes }
}

describe("async admission · promise fallback rollback", () => {
    test("settles a fallback that resolved before the newer write rejected", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()

        store1.set(state, first.promise)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)

        // The first coordinator observes that p2 still owns the atom and exits.
        // Rolling p2 back must restore more than the already-settled Promise:
        // its settlement still needs to be applied to the atom.
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
    })

    test("a dependent async selector converges after promise fallback rollback", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()

        store1.set(state, first.promise)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        let evaluations = 0
        const dependent = selector(get => {
            // A broken rollback repeatedly suspends on the same already-resolved
            // Promise. Bound that retry loop so this regression fails with an
            // assertion instead of starving Bun's timeout timer forever.
            if (++evaluations > 10) return Promise.resolve(Number.NaN)
            return Promise.resolve(get(state) + 1)
        })

        await store1.get(dependent)
        await flushMicrotasks()

        expect(store1.get(dependent)).toBe(2)
        expect(evaluations).toBeLessThanOrEqual(2)
    })

    test("settles a restored async function default", async () => {
        const store1 = store()
        const first = defer<number>()
        const second = defer<number>()
        const state = atom(() => first.promise)

        expect(store1.get(state)).toBe(first.promise)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
    })

    test("settles a restored async selector default", async () => {
        const store1 = store()
        const first = defer<number>()
        const second = defer<number>()
        const source = selector(() => first.promise)
        const state = atom(source)

        expect(store1.get(state)).toBe(first.promise)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
    })

    test("settles a restored promise inherited from a parent scope", async () => {
        const root = store()
        const scoped = root.scope("child")
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()

        root.set(state, first.promise)
        const returned = scoped.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        expect(root.get(state)).toBe(1)
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        expect(scoped.get(state)).toBe(1)
    })

    test("does not re-arm a fallback whose original coordinator is still pending", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()
        const originalThen = first.promise.then.bind(first.promise)
        let thenCalls = 0
        ;(first.promise as any).then = (...args: any[]) => {
            thenCalls++
            return originalThen(...args)
        }

        store1.set(state, first.promise)
        expect(thenCalls).toBe(1)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()

        // Restoring p1 is sufficient: its first reaction has not run yet.
        expect(thenCalls).toBe(1)
        first.resolve(1)
        await flushMicrotasks()
        expect(store1.get(state)).toBe(1)
    })

    test("re-armed observed settlement runs onSet and converges", async () => {
        const store1 = store()
        const events: string[] = []
        const state = atom(0, {
            onSet: value => events.push(`onSet:${value}`),
        })
        store1.sub(state, () =>
            events.push(`sub:${describeValue(store1.get(state))}`),
        )
        store1.onChange((changes, meta) => {
            if (changes.some(change => change.type === "atom"))
                events.push(`change:${meta.source}`)
        })
        const first = defer<number>()
        const second = defer<number>()

        store1.set(state, first.promise)
        store1.set(state, second.promise)
        events.length = 0
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await Promise.resolve(second.promise).catch(() => undefined)
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
        expect(events.slice(-3)).toEqual([
            "onSet:1",
            "sub:1",
            "change:async-set",
        ])
    })

    test("re-armed rejection keeps the fallback's own rollback chain", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()

        store1.set(state, first.promise)
        store1.set(state, second.promise)
        first.reject(new Error("fallback failed"))
        await Promise.resolve(first.promise).catch(() => undefined)
        await flushMicrotasks()
        second.reject(new Error("newer write failed"))
        await Promise.resolve(second.promise).catch(() => undefined)
        await flushMicrotasks()

        expect(store1.get(state)).toBe(0)
    })

    test("a three-deep rejected write chain converges through its fallbacks", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()
        const third = defer<number>()

        store1.set(state, first.promise)
        store1.set(state, second.promise)
        store1.set(state, third.promise)
        first.resolve(1)
        await first.promise
        await flushMicrotasks()
        second.reject(new Error("middle write failed"))
        await Promise.resolve(second.promise).catch(() => undefined)
        await flushMicrotasks()
        third.reject(new Error("newest write failed"))
        await Promise.resolve(third.promise).catch(() => undefined)
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
    })

    test("control: fallback remains coordinated when the newer write rejects first", async () => {
        const store1 = store()
        const state = atom(0)
        const first = defer<number>()
        const second = defer<number>()

        store1.set(state, first.promise)
        const returned = store1.set(state, second.promise)
        const rejected = Promise.resolve(returned).catch(() => undefined)

        // In this order p1's original coordinator is still live when rollback
        // restores it, so the pre-fix implementation already settles correctly.
        second.reject(new Error("newer write failed"))
        await rejected
        await flushMicrotasks()
        first.resolve(1)
        await first.promise
        await flushMicrotasks()

        expect(store1.get(state)).toBe(1)
    })
})

describe("async admission · superseding schema re-entrancy", () => {
    test("control: an admitted resolution publishes once and reports async-set", async () => {
        // The optimized-path mirror of the hooked control. Every other case in
        // this block DENIES admission, so without this one the whole block would
        // stay green against a path that never publishes — and a double-publish
        // in the admitted resolution would go unnoticed here.
        const store1 = store({ schemaValidation: true })
        const { state, parsed } = reentrantAtom<number>(1)
        const rec = record(store1, state)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        expect(store1.get(state)).toBe(42)
        expect(parsed).toEqual([1, 42])
        // Exactly two deliveries: the in-flight promise, then the resolution.
        expect(rec.observed.map(describeValue)).toEqual(["promise", "42"])
        expect(rec.changes).toEqual(["set:set", "set:async-set"])
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding set wins and the async result never publishes", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, parsed, arm } = reentrantAtom<number>(1)
        const rec = record(store1, state)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        arm(() => {
            store1.set(state, 99)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // Last write wins — not last promise to settle.
        expect(store1.get(state)).toBe(99)
        // The schema saw the eager default init, the resolved async value, then
        // the superseding value; 42 was validated but dropped at re-admission.
        expect(parsed).toEqual([1, 42, 99])
        // Two publishes: the in-flight promise, then the superseding value. The
        // dropped async resolution adds no third notification and no stale 42.
        expect(rec.observed).toEqual([pending.promise, 99])
        // No `async-set` source anywhere: the resolution was never admitted.
        expect(rec.changes).toEqual(["set:set", "set:set"])
        // The caller's Promise identity and result are untouched by supersession.
        expect(returned).toBe(pending.promise)
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding unset reverts to the default and drops the async result", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, parsed, arm } = reentrantAtom<number>(1)
        const rec = record(store1, state)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        arm(() => {
            store1.unset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // Root unset de-materializes the value; the live subscriber's read
        // re-initializes the default (which the schema validates again).
        expect(store1.get(state)).toBe(1)
        expect(parsed).toEqual([1, 42, 1])
        // The doubled tail is the pre-existing shape of a root unset with a live
        // subscriber (see the baseline below) — NOT an artifact of the async
        // supersede. What matters here: 42 never appears.
        expect(rec.observed).toEqual([pending.promise, 1, 1])
        expect(rec.observed).not.toContain(42)
        expect(rec.changes).toEqual(["set:set", "unset:unset"])
        expect(returned).toBe(pending.promise)
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding reset reinstates the default and drops the async result", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, parsed, arm } = reentrantAtom<number>(1)
        const rec = record(store1, state)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        arm(() => {
            store1.reset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // Unlike unset, reset eagerly writes the default back, so the atom
        // publishes exactly once more and the change carries `reset`.
        expect(store1.get(state)).toBe(1)
        expect(parsed).toEqual([1, 42, 1])
        expect(rec.observed).toEqual([pending.promise, 1])
        expect(rec.changes).toEqual(["set:set", "set:reset"])
        expect(returned).toBe(pending.promise)
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding set resolves the pending default placeholder", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, arm } = reentrantAtom<number>()

        // An atom with no default hands the first reader a suspense placeholder.
        const suspense = store1.get(state) as Promise<number>
        const rec = record(store1, state)
        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        arm(() => {
            store1.set(state, 99)
        })
        pending.resolve(42)
        await flushMicrotasks()

        // The superseding write owns the placeholder: it resolves with the value
        // that actually won, so a suspended reader never observes the dropped 42.
        expect(store1.get(state)).toBe(99)
        expect(await settleWithin(suspense)).toEqual({
            kind: "resolved",
            value: 99,
        })
        // Exactly two publishes and no `async-set`: the dropped resolution adds
        // no delivery of its own.
        expect(rec.observed.map(describeValue)).toEqual(["promise", "99"])
        expect(rec.changes).toEqual(["set:set", "set:set"])
        expect(returned).toBe(pending.promise)
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding unset publishes the unset and no stale async-set", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, arm } = reentrantAtom<number>()

        const suspense = store1.get(state) as Promise<number>
        const rec = record(store1, state)
        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        arm(() => {
            store1.unset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()

        // The atom is back to "unread with no default", so every delivery reads a
        // placeholder promise — but 42 is never published and the only change
        // reported after the initial write is the unset.
        expect(describeValue(store1.get(state))).toBe("promise")
        expect(rec.observed.map(describeValue)).toEqual([
            "promise",
            "promise",
            "promise",
        ])
        expect(rec.changes).toEqual(["set:set", "unset:unset"])
        expect(returned).toBe(pending.promise)
        await expect(returned).resolves.toBe(42)
        // The re-read hands back the SAME placeholder the first reader is
        // suspended on, so a later write can still resolve it.
        expect(store1.get(state)).toBe(suspense)
    })

    // Regression: `unset` removes the store's own value but leaves the
    // placeholder in `data.pendingDefaults` live, and the re-init on the next
    // read used to mint a SECOND placeholder over the same WeakMap key —
    // orphaning the reader already suspended on the first. `getAtomInitValue`
    // now reuses the outstanding placeholder (`pendingDefaultPromise`).
    test("a superseding unset leaves the pending default resolvable by a later write", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, arm } = reentrantAtom<number>()

        const suspense = store1.get(state) as Promise<number>
        const pending = defer<number>()
        store1.set(state, pending.promise)
        arm(() => {
            store1.unset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()

        // A later settled write must resolve the reader that is still
        // suspended on the original placeholder.
        store1.set(state, 7)
        await flushMicrotasks()

        expect(store1.get(state)).toBe(7)
        expect(await settleWithin(suspense, 20)).toEqual({
            kind: "resolved",
            value: 7,
        })
    })

    // Scopes the regression: no promise, no schema, no admission window — it
    // was never specific to the async path.
    test("baseline: unset leaves the pending default resolvable by a later write", async () => {
        const store1 = store()
        const emptyAtom = atom<number>()
        const suspense = store1.get(emptyAtom) as Promise<number>

        store1.unset(emptyAtom)
        store1.set(emptyAtom, 7)

        expect(store1.get(emptyAtom)).toBe(7)
        // `lib/transaction.test.ts` "txn set resolves pending-default
        // suspense promise" asserts exactly this for the write path; the
        // intervening `unset` used to orphan the entry.
        expect(await settleWithin(suspense, 20)).toEqual({
            kind: "resolved",
            value: 7,
        })
    })

    // `reset` reaches the same re-init through `resetAtom` → `getAtomInitValue`,
    // so it stranded the placeholder the same way.
    test("baseline: reset leaves the pending default resolvable by a later write", async () => {
        const store1 = store()
        const emptyAtom = atom<number>()
        const suspense = store1.get(emptyAtom) as Promise<number>

        store1.reset(emptyAtom)
        store1.set(emptyAtom, 7)

        expect(store1.get(emptyAtom)).toBe(7)
        expect(await settleWithin(suspense, 20)).toEqual({
            kind: "resolved",
            value: 7,
        })
    })

    // A no-default atom registers its placeholder in ROOT (the scoped read
    // falls through), so the write that resolves it comes from a descendant.
    // This is what guards `resolvePendingDefault`'s upward walk: made
    // local-only, the scoped `set` below misses root's entry and the reader
    // hangs. The reuse lookup mirrors that walk for the same reason.
    test("a scoped write resolves the placeholder registered in root", async () => {
        const root = store()
        const scoped = root.scope("s1")
        const emptyAtom = atom<number>()

        const suspense = root.get(emptyAtom) as Promise<number>
        root.unset(emptyAtom)

        // No store on the chain holds a value now, so this read re-inits.
        expect(scoped.get(emptyAtom)).toBe(suspense)
        scoped.set(emptyAtom, 7)

        expect(scoped.get(emptyAtom)).toBe(7)
        expect(await settleWithin(suspense, 20)).toEqual({
            kind: "resolved",
            value: 7,
        })
    })
})

describe("async admission · superseding re-entrancy on a hooked atom", () => {
    test("control: an admitted resolution runs onSet and reports async-set", async () => {
        // Without this control the suppression assertions below would also pass
        // against a branch that never publishes at all.
        const store1 = store({ schemaValidation: true })
        const { state, events, watch } = hookedCase(1)
        watch(store1)

        const pending = defer<number>()
        store1.set(state, pending.promise)
        events.length = 0
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        expect(store1.get(state)).toBe(42)
        expect(events).toEqual(["onSet:42", "sub:42", "change:set:async-set"])
    })

    test("a superseding set suppresses the hooked async commit entirely", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, events, watch, arm } = hookedCase(1)
        watch(store1)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        events.length = 0
        arm(() => {
            store1.set(state, 99)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // `runCommitPlan`'s `admit:` callback re-checks after the schema ran, so
        // the whole plan is a no-op: no onSet, no notification, no report for 42.
        expect(store1.get(state)).toBe(99)
        expect(events).toEqual(["onSet:99", "sub:99", "change:set:set"])
        expect(events).not.toContain("onSet:42")
        expect(events.join()).not.toContain("async-set")
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding unset suppresses the hooked async commit entirely", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, events, watch, arm } = hookedCase(1)
        watch(store1)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        events.length = 0
        arm(() => {
            store1.unset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // `unset` runs no `onSet` of its own, so the hook is absent entirely —
        // proof the denied resolution never reached phase 3.
        expect(store1.get(state)).toBe(1)
        expect(events).toEqual(["sub:1", "sub:1", "change:unset:unset"])
        expect(events.join()).not.toContain("onSet")
        expect(events.join()).not.toContain("async-set")
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding reset suppresses the hooked async commit entirely", async () => {
        const store1 = store({ schemaValidation: true })
        const { state, events, watch, arm } = hookedCase(1)
        watch(store1)

        const pending = defer<number>()
        const returned = store1.set(state, pending.promise)
        events.length = 0
        arm(() => {
            store1.reset(state)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // Reset writes the default back through its own commit, so `onSet` fires
        // with 1 — never with the dropped 42.
        expect(store1.get(state)).toBe(1)
        expect(events).toEqual(["onSet:1", "sub:1", "change:set:reset"])
        expect(events).not.toContain("onSet:42")
        expect(events.join()).not.toContain("async-set")
        await expect(returned).resolves.toBe(42)
    })

    test("a superseding set suppresses the hooked global fan-out", async () => {
        // The global branch builds an ordered `globalEffects` plan and a forest
        // settlement, and admits through the same callback — peers must not see
        // the dropped value either.
        const storeA = store({ schemaValidation: true })
        const storeB = store({ schemaValidation: true })
        const { state, events, watch, arm } = hookedCase(1, { global: true })
        watch(storeA, "A")
        watch(storeB, "B")
        await flushMicrotasks()

        const pending = defer<number>()
        storeA.set(state, pending.promise)
        await flushMicrotasks()
        events.length = 0
        arm(() => {
            storeA.set(state, 99)
        })
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        expect(storeA.get(state)).toBe(99)
        expect(storeB.get(state)).toBe(99)
        // `onSet` runs once, before any delivery; peer-store order within the
        // fan-out is incidental, so compare those as a bag (oracle convention).
        expect(events[0]).toBe("onSet:99")
        expect(events.slice(1).sort()).toEqual([
            "changeA:set:set",
            "changeB:set:set",
            "subA:99",
            "subB:99",
        ])
        expect(events.join()).not.toContain("async-set")
    })
})

describe("async admission · store disposal", () => {
    test("a stale resolution after dispose is a silent no-op", async () => {
        const store1 = store()
        const events: string[] = []
        // `onSet` is the probe that survives disposal: subscribers and listeners
        // are torn down by `dispose`, so they would stay silent even if a stale
        // settlement WERE admitted, but an admitted resolution still runs the
        // user hook. The disposal oracle covers the global/family atoms; a plain
        // same-store atom is the case that had no direct coverage.
        const valueAtom = atom(1, { onSet: () => events.push("onSet") })
        let signal: AbortSignal | undefined
        // A selector with its own in-flight work, so the commit's cancellation
        // state is observable alongside the atom's suppressed settlement. The
        // full signal-abort spine lives in the disposal oracle.
        const derived = selector((get, opts) => {
            get(valueAtom)
            signal = opts.signal
            return new Promise<number>(() => {})
        })
        store1.sub(derived, () => events.push("sub:derived"))
        store1.sub(valueAtom, () => events.push("sub:atom"))
        store1.onChange(() => events.push("onChange"))
        store1.onCommitEnd(() => events.push("commitEnd"))
        await flushMicrotasks()

        const pending = defer<number>()
        const returned = store1.set(valueAtom, pending.promise)
        await flushMicrotasks()
        events.length = 0

        store1.dispose()
        pending.resolve(42)
        await flushMicrotasks()
        await wait(10)

        // `admitAsyncAtomTransition` rejects a disposed store before any write,
        // hook, settlement or report: not even `onSet` runs.
        expect(events).toEqual([])
        // In-flight work is cancelled rather than left live.
        expect(signal?.aborted).toBe(true)
        expect(() => store1.get(valueAtom)).toThrow(StoreDisposedError)
        // The caller's Promise is unaffected by the store going away.
        await expect(returned).resolves.toBe(42)
    })

    test("a stale rejection after dispose neither rolls back nor leaks", async () => {
        const store1 = store()
        const valueAtom = atom(1)
        const events: string[] = []
        store1.sub(valueAtom, () => events.push("sub:atom"))
        store1.onChange(() => events.push("onChange"))

        const pending = defer<number>()
        // Intentionally no `.catch` on the returned Promise: the internal chain
        // must contain the rejection on its own. Bun fails this test if it leaks.
        store1.set(valueAtom, pending.promise)
        await flushMicrotasks()
        events.length = 0

        store1.dispose()
        pending.reject(new Error("boom"))
        await flushMicrotasks()
        await wait(20)

        // Rollback is admission-gated too (including its deferred
        // `queueMicrotask` re-check), so a disposed store gets no fallback write
        // and no notification. Note this stays a containment assertion: a
        // disposed store tears its listeners down, so the load-bearing part is
        // that the turn completes without a leaked rejection or a throw.
        expect(events).toEqual([])
        expect(() => store1.get(valueAtom)).toThrow(StoreDisposedError)
    })

    test("dispose leaves an unresolved default placeholder pending", async () => {
        const store1 = store()
        const emptyAtom = atom<number>()
        const suspense = store1.get(emptyAtom) as Promise<number>

        const pending = defer<number>()
        store1.set(emptyAtom, pending.promise)
        store1.dispose()
        pending.resolve(42)
        await flushMicrotasks()

        // Disposal neither resolves nor rejects outstanding placeholders. Unlike
        // the unset case above this is defensible — the store is gone and every
        // read now throws — but it is pinned so the refactor keeps it deliberate.
        expect(await settleWithin(suspense, 20)).toEqual({ kind: "pending" })
    })
})
