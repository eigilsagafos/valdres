import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import { valdresGlobal } from "./valdresGlobal"

/** Register a `name`d atom or atomFamily in the global name registry (the
 *  `globalThis.__valdres__` slot), keyed by name. Names are global addresses —
 *  `dehydrate`/`hydrate` resolve state by name across processes — so a
 *  duplicate registration is a hard error rather than a silent overwrite.
 *
 *  Only called when a name is present: unnamed atoms/families don't register
 *  (and pay nothing). An atomFamily registers the FAMILY object; its member
 *  atoms are never individually registered — they are addressed as
 *  `family(...args)`. Selectors never register. */
export const registerName = (
    name: string,
    state: Atom<any> | AtomFamily<any>,
) => {
    const { registry } = valdresGlobal()
    if (registry.has(name)) {
        throw new Error(
            `valdres: an atom or atomFamily named '${name}' already exists. ` +
                `Names are global addresses (used by dehydrate/hydrate) and must be unique — ` +
                `namespace them like "@valdres/<pkg>/<atom>", or omit the name.`,
        )
    }
    registry.set(name, state)
}
