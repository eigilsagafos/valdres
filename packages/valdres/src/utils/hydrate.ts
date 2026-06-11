import { SchemaValidationError } from "../errors/SchemaValidationError"
import { valdresGlobal } from "../lib/valdresGlobal"
import type { AtomFamily } from "../types/AtomFamily"
import type { Atom } from "../types/Atom"
import type { DehydratedState } from "../types/DehydratedState"
import type { Store } from "../types/Store"
import { isAtomFamily } from "./isAtomFamily"

export type HydrateOptions = {
    /** What to do when a payload value fails schema validation (an atom's
     *  `schema`, with validation enabled on the atom or the store):
     *
     *  - `"throw"` (default) — the `SchemaValidationError` aborts the whole
     *    hydrate transaction; NOTHING from the payload is applied. The strict
     *    choice for a trust boundary: a tampered or malformed payload never
     *    half-applies.
     *  - `"skip"` — warn and drop just the failing entry; every valid entry
     *    still lands. The graceful-degradation choice for deploy skew, where
     *    one stale atom shouldn't cost the rest of the SSR state.
     *
     *  Only schema failures are affected; other errors always throw. */
    invalid?: "throw" | "skip"
}

/** [Docs Reference](https://valdres.dev/valdres/api/hydrate)
 *
 * Apply a `dehydrate(store)` payload to a store — the client half of SSR state
 * transfer. Names resolve through the global name registry; family entries
 * resolve to their member via `family(...args)` (creating the member if this
 * process hasn't touched it yet). Every value is set inside a single
 * `store.txn`, so subscribers and selectors observe one atomic commit.
 *
 * Unknown names are warned about and skipped. This is an inherent
 * code-splitting caveat, not always a bug: an atom registers when the module
 * defining it is evaluated, so if the hydrating side never imported that
 * module (e.g. its chunk hasn't loaded), the entry has no registration to
 * resolve against. Make sure the modules defining transferred atoms are
 * imported before calling hydrate.
 *
 * The payload is wire data, so hydrate is a natural trust boundary: when the
 * store enables `schemaValidation` (or an atom forces it), every entry is
 * validated against its atom's `schema` as it is staged. By default a failing
 * entry throws `SchemaValidationError` and aborts the whole hydration; pass
 * `{ invalid: "skip" }` to drop failing entries individually instead.
 *
 * @example
 * hydrate(store, window.__STATE__)
 * hydrate(store, window.__STATE__, { invalid: "skip" })
 */
export const hydrate = (
    store: Store,
    payload: DehydratedState,
    options?: HydrateOptions,
): void => {
    const skipInvalid = options?.invalid === "skip"
    const { registry } = valdresGlobal()
    store.txn(txn => {
        // Staging a value runs schema validation (when enabled), so in skip
        // mode a schema failure is caught per entry: the entry simply never
        // stages and the rest of the payload still commits.
        const stage = (state: Atom<unknown>, value: unknown) => {
            if (!skipInvalid) {
                txn.set(state, value)
                return
            }
            try {
                txn.set(state, value)
            } catch (error) {
                if (!(error instanceof SchemaValidationError)) throw error
                console.warn(`valdres: hydrate skipped an entry — ${error.message}`)
            }
        }
        for (const [name, value] of payload.atoms) {
            const state = registry.get(name)
            if (state === undefined) {
                console.warn(
                    `valdres: hydrate skipped unknown atom '${name}' — no atom with that name is registered (was the module defining it imported?).`,
                )
                continue
            }
            if (isAtomFamily(state)) {
                console.warn(
                    `valdres: hydrate skipped '${name}' — the payload has an atom entry but '${name}' is registered as an atomFamily.`,
                )
                continue
            }
            stage(state as Atom<unknown>, value)
        }
        for (const [name, args, value] of payload.families) {
            const family = registry.get(name)
            if (family === undefined) {
                console.warn(
                    `valdres: hydrate skipped unknown atomFamily '${name}' — no atomFamily with that name is registered (was the module defining it imported?).`,
                )
                continue
            }
            if (!isAtomFamily(family)) {
                console.warn(
                    `valdres: hydrate skipped '${name}' — the payload has an atomFamily entry but '${name}' is registered as an atom.`,
                )
                continue
            }
            stage(
                (family as AtomFamily<unknown>)(...(args as [any, ...any[]])),
                value,
            )
        }
    })
}
