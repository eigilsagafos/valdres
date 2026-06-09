import type { DevtoolsSnapshot } from "../types/DevtoolsSnapshot"

/** Reserved top-level key under which scope overrides are nested. */
export const SCOPES_KEY = "@scopes"

/** Reserved key under which derived (selector) values live — at the top level
 *  for root selectors, and under `@scopes.<path>.@computed` for scope ones.
 *  Display-only; never restored. */
export const COMPUTED_KEY = "@computed"

/** The object an atom value lives in: the model itself for the root, or the
 *  per-scope bucket under `@scopes` (created on demand). */
export const atomBucket = (
    model: DevtoolsSnapshot,
    scopeKey: string | null,
): Record<string, unknown> =>
    scopeKey === null
        ? model
        : ((model[SCOPES_KEY] ??= {})[scopeKey] ??= {})

/** The `@computed` object a selector value lives in (created on demand): the
 *  top-level one for a root selector, or one nested inside the scope's bucket
 *  (`@scopes.<scope>.@computed`) for a scoped selector. */
export const computedBucket = (
    model: DevtoolsSnapshot,
    scopeKey: string | null,
): Record<string, unknown> => {
    const parent = scopeKey === null ? model : atomBucket(model, scopeKey)
    return ((parent as Record<string, any>)[COMPUTED_KEY] ??= {})
}

/**
 * Shallow structural copy so each action gets an immutable snapshot — the
 * extension may read the state asynchronously after we've mutated the live
 * model. Atom values themselves are shared by reference (not deep-cloned).
 */
export const cloneSnapshot = (model: DevtoolsSnapshot): DevtoolsSnapshot => {
    const copy: DevtoolsSnapshot = {}
    for (const key of Object.keys(model)) {
        if (key === SCOPES_KEY || key === COMPUTED_KEY) continue
        copy[key] = model[key]
    }
    const scopes = model[SCOPES_KEY]
    if (scopes) {
        const scopesCopy: Record<string, Record<string, unknown>> = {}
        for (const path of Object.keys(scopes)) {
            const bucket: Record<string, unknown> = { ...scopes[path] }
            // The scope's nested @computed needs its own copy too, else later
            // selector recomputes would mutate an already-sent snapshot.
            const nested = bucket[COMPUTED_KEY]
            if (nested) {
                bucket[COMPUTED_KEY] = { ...(nested as Record<string, unknown>) }
            }
            scopesCopy[path] = bucket
        }
        copy[SCOPES_KEY] = scopesCopy
    }
    const computed = model[COMPUTED_KEY]
    if (computed) copy[COMPUTED_KEY] = { ...computed }
    return copy
}
