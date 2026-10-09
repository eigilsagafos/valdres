import { atom as valdresAtom, selector as valdresSelector, type Atom } from "valdres"
import { DefaultValue } from "../DefaultValue"
import type { AtomOptions } from "../types/AtomOptions"
import { readThrough } from "./actions"
import { isThenable } from "./isThenable"
import {
    createRecoilValue,
    isRecoilValueObject,
    RESET,
    type RecoilState,
    type RecoilValue,
    type WriteContext,
} from "./recoilValue"
import { registerKey } from "./registerKey"
import { ASYNC_DETAIL, unsupported } from "./unsupported"

/** Recoil compares atom values with `===`, not `Object.is`. */
const strictEqual = (previous: unknown, next: unknown) => previous === next

/** The base atom's value while the atom has no stored value of its own. */
const NOT_STORED = Symbol("not stored")

/**
 * Recoil's base atom `set`: writing the stored value again, or resetting an
 * atom that stores nothing, writes nothing, so an earlier write to it in the
 * same selector `set` survives. Both are judged against the state from before
 * the action, as Recoil judges them.
 */
const atomWrite =
    (base: Atom<unknown>) => (context: WriteContext, value: unknown) => {
        const stored = context.readState(base)
        if (stored === NOT_STORED) {
            if (value instanceof DefaultValue) return
        } else if (value === stored) return
        if (value instanceof DefaultValue) {
            context.writes.set(base, RESET)
            return
        }
        if (isThenable(value)) unsupported("async atom values", ASYNC_DETAIL)
        context.writes.set(base, value)
    }

const EFFECTS_DETAIL =
    "Effects run when Recoil first uses an atom in a <RecoilRoot>, which Valdres definitions cannot observe. Initialize with RecoilRoot's initializeState, and subscribe to the Store for persistence or synchronization."

export const assertNoEffects = (effects: unknown) => {
    if (effects === undefined) return
    if (!Array.isArray(effects) || effects.length > 0)
        unsupported("atom effects", EFFECTS_DETAIL)
}

/**
 * Every atom is a base Valdres atom holding `NOT_STORED` until written, read
 * through a selector that substitutes the default. Recoil distinguishes a
 * stored value from the default; a plain Valdres atom cannot.
 */
export const createAtom = <Value>(
    options: AtomOptions<Value>,
): RecoilState<Value> => {
    const { key } = options
    registerKey(key, "atom")
    assertNoEffects(options.effects)
    assertNoEffects(options.effects_UNSTABLE)

    let readDefault: (get: Parameters<Parameters<typeof valdresSelector>[0]>[0]) => Value
    let publicKey = key
    let kind: "atom" | "selector" = "atom"
    if (!("default" in options)) {
        // Recoil suspends until the atom has a value; nothing suspends here.
        readDefault = () =>
            unsupported(
                "atoms without a default",
                `Recoil suspends on "${key}" until it is set; set it first (for example in initializeState) or give it a default.`,
            )
    } else if (isRecoilValueObject(options.default)) {
        // Recoil's atomWithFallback: a selector over the base atom.
        publicKey = `${key}__withFallback`
        kind = "selector"
        registerKey(publicKey, "selector")
        const fallback = options.default as RecoilValue<Value>
        readDefault = get => readThrough({ get }, fallback, "atom default")
    } else {
        const initial = options.default as Value
        if (isThenable(initial)) unsupported("async atom defaults", ASYNC_DETAIL)
        readDefault = () => initial
    }

    const base = valdresAtom<unknown>(NOT_STORED, { name: key, equal: strictEqual })
    return createRecoilValue<Value>({
        key: publicKey,
        kind,
        state: valdresSelector(
            get => {
                const value = get(base)
                return value === NOT_STORED ? readDefault(get) : (value as Value)
            },
            { name: publicKey, equal: strictEqual },
        ),
        write: atomWrite(base),
    }) as RecoilState<Value>
}
