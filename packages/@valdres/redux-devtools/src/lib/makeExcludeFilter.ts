import { isAtomFamily, isSelectorFamily } from "valdres"
import type { SnapshotEntry } from "valdres"
import type { ExcludeOption, ExcludeRule } from "../types/ConnectReduxDevtoolsOptions"

type State = SnapshotEntry["state"]

/** Does a single rule match this state? A string matches the state's `name`
 *  (or, for a family member, the family's `name`, so one string excludes a whole
 *  family). A family reference matches all its members via `state.family`. A
 *  plain function is a predicate — checked AFTER the family cases because an
 *  `atomFamily` / `selectorFamily` is itself callable. Anything else is an atom
 *  / selector reference matched by identity. */
const ruleMatches = (rule: ExcludeRule, state: State): boolean => {
    const family = (state as { family?: unknown }).family
    if (typeof rule === "string") {
        return state.name === rule || (family as { name?: string })?.name === rule
    }
    if (isAtomFamily(rule) || isSelectorFamily(rule)) return family === rule
    if (typeof rule === "function") return rule(state)
    return state === rule
}

/**
 * Compile the `exclude` option into a single `(state) => boolean` predicate
 * (always `false` when nothing is excluded). Atoms whose state matches are
 * dropped from both the seeded snapshot and the live timeline — useful for
 * high-frequency atoms (cursor position, pointer coords) that would otherwise
 * flood the DevTools and crowd out meaningful actions.
 */
export const makeExcludeFilter = (
    exclude: ExcludeOption | undefined,
): ((state: State) => boolean) => {
    if (!exclude) return () => false
    const rules = Array.isArray(exclude) ? exclude : [exclude]
    if (rules.length === 0) return () => false
    return (state: State) => rules.some(rule => ruleMatches(rule, state))
}
