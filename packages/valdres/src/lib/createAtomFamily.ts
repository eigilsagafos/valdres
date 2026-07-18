import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomFamilyOptions } from "../types/AtomFamilyOptions"
import type { AtomOptions } from "../types/AtomOptions"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { displayFamilyArgs } from "./displayFamilyArgs"
import { equal } from "./equal"
import { familyKey, type FamilyKey } from "./familyKey"
import { globalAtom } from "./globalAtom"
import { registerName } from "./registerName"
import { WeakValueMap } from "./WeakValueMap"

export const createAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options?: AtomFamilyOptions<Value, Args>,
) => {
    const map = new WeakValueMap<FamilyKey, AtomFamilyAtom<Value, Args>>()
    // String arguments need canonical encoded keys in the family map, but the
    // raw-string side cache preserves the allocation-free atom-family hit path.
    // Values are weak here too, so this does not extend member lifetime or
    // change the family's bounded-memory behavior.
    const stringMap = new WeakValueMap<string, AtomFamilyAtom<Value, Args>>()
    const keyOf = options?.keyOf
    let memberOptions: AtomOptions<Value> | undefined
    if (options !== undefined) {
        const { keyOf: _, ...rest } = options
        memberOptions = rest
    }
    // Hoist type checks to family creation time — avoid per-call overhead
    const isSelectorFamilyDefault = isSelectorFamily(defaultValue)
    const isFunctionDefault =
        !isSelectorFamilyDefault && typeof defaultValue === "function"
    const hasName = !!memberOptions?.name
    const isGlobal = !!memberOptions?.global

    // Cold path: resolve default, build the atom, cache it. Only runs on a cache
    // miss, so the per-call hot path (cache hit) never pays for any of this.
    const build = (
        args: any[],
        key: FamilyKey,
        displayedKey?: string | number | boolean,
        rawStringKey?: string,
    ) => {
        // Resolve default value — inlined to avoid intermediate closures
        let dv: any
        if (isSelectorFamilyDefault) {
            // @ts-ignore @ts-todo
            dv = defaultValue(...args)
        } else if (isFunctionDefault) {
            // @ts-ignore @ts-todo
            dv = () => defaultValue(...args)
        } else {
            dv = defaultValue
        }

        const memberName = hasName
            ? memberOptions!.name + "_" + displayedKey!
            : undefined

        let familyAtom: any
        if (isGlobal) {
            familyAtom = globalAtom(dv, {
                ...memberOptions,
                name: memberName,
            })
        } else {
            // Build atom in a single allocation — no intermediate objects
            familyAtom = {
                equal,
                ...memberOptions,
                defaultValue: dv,
                name: memberName,
            }
        }

        // @ts-ignore @ts-todo
        familyAtom.family = atomFamily
        familyAtom.familyArgs = args
        familyAtom.familyArgsStringified = key

        map.set(key, familyAtom)
        if (rawStringKey !== undefined) stringMap.set(rawStringKey, familyAtom)
        return familyAtom
    }

    // Hot path is the cache hit. Declaring a single positional param and reading
    // only `arguments.length` (never indexing `arguments`) lets JSC skip
    // materializing the arguments object and skip the rest-parameter array
    // allocation that `(...args)` forces on every call. The key for a single
    // non-string primitive arg IS that primitive (see familyKey), so we look it
    // up directly. Strings use the raw side cache above. Neither hit path calls
    // familyKey() or allocates a tagged string.
    function defaultAtomFamily(a0?: any) {
        if (arguments.length === 1) {
            const t = typeof a0
            // Keep the overwhelmingly common numeric-id branch first. The
            // reciprocal is only evaluated for zero, preserving -0 identity
            // without putting Object.is() on every numeric cache hit.
            if (t === "number" && (a0 !== 0 || 1 / a0 === Infinity)) {
                const cached = map.get(a0)
                if (cached !== undefined) return cached
                const args = [a0]
                return build(args, a0, a0)
            }
            if (t === "string") {
                const cached = stringMap.get(a0)
                if (cached !== undefined) return cached
                const args = [a0]
                return build(args, familyKey(args), a0, a0)
            }
            if (t === "boolean" || t === "bigint") {
                const cached = map.get(a0)
                if (cached !== undefined) return cached
                const args = [a0]
                return build(
                    args,
                    a0,
                    t === "bigint" ? (hasName ? String(a0) : undefined) : a0,
                )
            }
        }
        // Cold/variadic path: object/multi args need a stable stringified key.
        const args = Array.prototype.slice.call(arguments)
        const key = familyKey(args)
        const cached = map.get(key)
        if (cached !== undefined) return cached
        return build(args, key, hasName ? displayFamilyArgs(args) : undefined)
    }

    function keyedAtomFamily(a0?: any) {
        const args = Array.prototype.slice.call(arguments)
        const keyArgs = [keyOf!(...(args as Args))]
        const key = familyKey(keyArgs)
        const cached = map.get(key)
        if (cached !== undefined) return cached
        return build(
            args,
            key,
            hasName ? displayFamilyArgs(keyArgs) : undefined,
        )
    }

    const atomFamily = keyOf === undefined ? defaultAtomFamily : keyedAtomFamily

    // Define `name` explicitly. When named, expose the user's name. When unnamed,
    // override the intrinsic JS function name ("atomFamily") with `undefined` so
    // an unnamed family mirrors an unnamed atom — consumers (devtools, sync,
    // persistence) can detect "unnamed" via `name === undefined` instead of
    // matching the literal string "atomFamily", which breaks under minification
    // and wrongly flags a family a user legitimately named "atomFamily".
    Object.defineProperty(atomFamily, "name", {
        value: hasName ? memberOptions!.name : undefined,
        writable: false,
    })

    // The single-positional-param + `arguments` shape isn't structurally a
    // `(...args: Args)` signature, so the callable needs an unchecked assertion.
    // Narrow that `unknown` cast to *only* the call signature so the assembled
    // object's properties below still get checked against AtomFamily.
    const callable = atomFamily as unknown as (
        ...args: Args
    ) => AtomFamilyAtom<Value, Args>

    const family = Object.assign(callable, {
        __valdresAtomFamilyMap: map,
        release: (...args: Args) => {
            if (
                keyOf === undefined &&
                args.length === 1 &&
                typeof args[0] === "string"
            ) {
                stringMap.delete(args[0])
            }
            const keyArgs = keyOf === undefined ? args : [keyOf(...args)]
            map.delete(familyKey(keyArgs))
        },
        equal,
        // Exposed on the family object too (members carry them via ...options)
        // so a consumer (devtools, sync) can read a family's schema without
        // materializing a member.
        schema: memberOptions?.schema,
        schemaValidation: memberOptions?.schemaValidation,
    }) as AtomFamily<Value, Args>
    // The FAMILY registers under its name; member atoms never do (they are
    // addressed as `family(...args)`). Global families can't double-register:
    // createGlobalAtomFamily returns its cached instance before re-creating.
    if (hasName) registerName(memberOptions!.name!, family)
    return family
}
