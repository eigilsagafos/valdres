import type { State } from "./State"

/**
 * Holder for dep-change tracking during propagation. The Sets inside are
 * allocated lazily by the graph installer only when deps actually changed —
 * the steady-state case (same deps re-evaluated) does no allocation here.
 * Callers should clear `added` / `removed` to `undefined` before reuse.
 */
export type DepsChange = {
    added?: Set<State>
    removed?: Set<State>
}
