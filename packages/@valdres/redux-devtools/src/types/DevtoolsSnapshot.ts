/**
 * The serialized state shape sent to the Redux DevTools extension.
 *
 * Root-store atoms live at the top level keyed by their `name`. Scope
 * overrides live under the reserved `@scopes` key, keyed by a `/`-joined
 * scope path (e.g. `"sessionA"` or `"sessionA/nested"`). Derived selector
 * values (with `{ selectors: true }`) live under the reserved `@computed` key,
 * keyed by scope-qualified selector name — display-only, never restored. Only
 * states that have an explicit/materialized value appear.
 */
export type DevtoolsSnapshot = Record<string, unknown> & {
    "@scopes"?: Record<string, Record<string, unknown>>
    "@computed"?: Record<string, unknown>
}
