import { valdresGlobal } from "../lib/valdresGlobal"
import type { AtomFamily } from "../types/AtomFamily"
import type { Atom } from "../types/Atom"
import type { DehydratedState } from "../types/DehydratedState"
import type { Store } from "../types/Store"
import { isAtomFamily } from "./isAtomFamily"

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
 * @example
 * hydrate(store, window.__STATE__)
 */
export const hydrate = (store: Store, payload: DehydratedState): void => {
    const { registry } = valdresGlobal()
    store.txn(txn => {
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
            txn.set(state as Atom<unknown>, value)
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
            txn.set(
                (family as AtomFamily<unknown>)(...(args as [any, ...any[]])),
                value,
            )
        }
    })
}
