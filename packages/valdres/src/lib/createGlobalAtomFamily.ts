import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyDefaultValue } from "../types/AtomFamilyDefaultValue"
import type { AtomFamilyOptions } from "../types/AtomFamilyOptions"
import { isAtomFamily } from "../utils/isAtomFamily"
import { createAtomFamily } from "./createAtomFamily"
import { IS_PROD } from "./IS_PROD"
import { valdresGlobal } from "./valdresGlobal"

const atomFamilies = valdresGlobal().runtime.globalAtomFamilies

const detectableArity = (callback: { length: number }): number | undefined => {
    if (callback.length === 0) return undefined
    const source = Function.prototype.toString.call(callback)
    const arrowIndex = source.indexOf("=>")
    const parameterEnd = arrowIndex === -1 ? source.indexOf(")") : arrowIndex
    if (parameterEnd === -1) return undefined
    const parameterSource = source.slice(0, parameterEnd)
    // Function.length stops before the first default/rest parameter. Its value
    // is evidence of contract arity only for simple parameter lists.
    return parameterSource.includes("=") || parameterSource.includes("...")
        ? undefined
        : callback.length
}

export const createGlobalAtomFamily = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    defaultValue: AtomFamilyDefaultValue<Value, Args>,
    options: AtomFamilyOptions<Value, Args>,
) => {
    if (!options.name)
        throw new Error("valdres: missing name for global atomFamily")
    const existing = atomFamilies.get(options.name)
    if (existing !== undefined) {
        const usesKeyOf = options.keyOf !== undefined
        const keyOfArity =
            options.keyOf === undefined
                ? undefined
                : detectableArity(options.keyOf)
        if (existing.usesKeyOf !== usesKeyOf) {
            throw new Error(
                `valdres: global atomFamily '${options.name}' contract mismatch: ` +
                    `the first definition ${existing.usesKeyOf ? "uses" : "does not use"} keyOf, ` +
                    `but the later definition ${usesKeyOf ? "does" : "does not"}.`,
            )
        }
        if (
            existing.keyOfArity !== undefined &&
            keyOfArity !== undefined &&
            existing.keyOfArity !== keyOfArity
        ) {
            throw new Error(
                `valdres: global atomFamily '${options.name}' contract mismatch: ` +
                    `keyOf arity was ${existing.keyOfArity} in the first definition and ${keyOfArity} in the later definition.`,
            )
        }
        if (!IS_PROD) {
            console.warn(
                `valdres: global atomFamily '${options.name}' already exists; ` +
                    `keeping the first definition. The later defaultValue and options were ignored.`,
            )
        }
        return existing.family as AtomFamily<Value, Args>
    }

    const { registry } = valdresGlobal()
    const registered = registry.get(options.name)
    if (registered !== undefined) {
        const registeredKind = isAtomFamily(registered)
            ? "an ordinary atomFamily"
            : "an atom"
        throw new Error(
            `valdres: global atomFamily '${options.name}' kind mismatch: the name is already registered as ${registeredKind} ` +
                `and cannot be reused as a global atomFamily.`,
        )
    }

    const family = createAtomFamily(defaultValue, options, true)
    atomFamilies.set(options.name, {
        family,
        usesKeyOf: options.keyOf !== undefined,
        keyOfArity:
            options.keyOf === undefined
                ? undefined
                : detectableArity(options.keyOf),
    })
    return family
}
